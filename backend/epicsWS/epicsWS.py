# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import asyncio
import os
import struct
import threading
from collections import deque
from dataclasses import asdict
from typing import Any, Callable, Deque, Dict, Optional, Set, Tuple, Union

import orjson
import uvloop
import websockets
from websockets.asyncio.server import ServerConnection

from CAClient import CAClient
from PVAClient import PVAClient
from pvParser import ARRAY_ITEMSIZE, PVMetadata, PVParser

CA_PROVIDER_KEY = "ca"
PVA_PROVIDER_KEY = "pva"


# (payload, is_text) pairs are shared between all clients receiving the same message
Frame = Tuple[bytes, bool]


def build_binary_frame(json_header: dict, raw_bytes: memoryview, dtype_size: int) -> bytes:
    if dtype_size not in (1, 2, 4, 8) or len(raw_bytes) % dtype_size:
        raise ValueError("Invalid array element size or payload length")

    header = orjson.dumps(json_header)
    header += b" " * (-(4 + len(header)) % dtype_size)
    return b"".join((struct.pack("<I", len(header)), header, raw_bytes))


# map PV -> set of websocket clients
subscriptions: Dict[str, Set[ServerConnection]] = {}

# per-ws inverse index for O(pvs_per_client) disconnect cleanup
ws_subscriptions: Dict[ServerConnection, Set[str]] = {}

# per-ws queue of messages to send, handled by a dedicated writer task
send_queues: Dict[ServerConnection, asyncio.Queue] = {}

# Clients that already received metadata, per PV name
metadata_sent_to_clients: Dict[str, Set[ServerConnection]] = {}

# cached quasi-static metadata per pv_name
_pv_metadata: Dict[str, PVMetadata] = {}

# environment variable fallback
DEFAULT_PROTOCOL = os.getenv("EPICS_DEFAULT_PROTOCOL", PVA_PROVIDER_KEY).lower()

# Max rate (Hz) at which updates for a single PV are forwarded to clients; 0 disables throttling.
MAX_UPDATE_RATE_HZ = float(os.getenv("EPICS_MAX_UPDATE_RATE_HZ", 30))
MIN_UPDATE_INTERVAL = 1.0 / MAX_UPDATE_RATE_HZ if MAX_UPDATE_RATE_HZ > 0 else 0.0

# Clients with more queued messages than this are disconnected.
MAX_CLIENT_QUEUE = int(os.getenv("EPICS_MAX_CLIENT_QUEUE", 1000))

# Per-PV throttle bookkeeping
_last_sent_time: Dict[str, float] = {}
_pending_updates: Dict[str, Tuple[Any, str]] = {}
_throttle_timer_handles: Dict[str, asyncio.TimerHandle] = {}


def parse_protocol(pv_name: str) -> Tuple[str, str]:
    """Decide protocol from PV prefix or default env var.
    Returns PV without protocol prefix"""
    if pv_name.startswith("pva://"):
        return PVA_PROVIDER_KEY, pv_name[6:]
    elif pv_name.startswith("ca://"):
        return CA_PROVIDER_KEY, pv_name[5:]
    return DEFAULT_PROTOCOL, pv_name


def format_pv_name(pv_name: str, provider: str) -> str:
    """Re-prefixes a PV name with its protocol, unless it matches the default protocol."""
    if provider != DEFAULT_PROTOCOL:
        return f"{provider}://{pv_name}"
    return pv_name


def _cleanup_pv_state(pv_name: str) -> None:
    """Called once a PV has no more subscribers, from any teardown path."""
    _pv_metadata.pop(pv_name, None)
    metadata_sent_to_clients.pop(pv_name, None)
    _last_sent_time.pop(pv_name, None)
    _pending_updates.pop(pv_name, None)
    throttle_timer = _throttle_timer_handles.pop(pv_name, None)
    if throttle_timer:
        throttle_timer.cancel()


_loop: Optional[asyncio.AbstractEventLoop] = None

# EPICS callbacks can run on worker threads, so queue them for ordered dispatch on the event loop.
_loop_callback_queue: Deque[Tuple[Callable[..., None], tuple]] = deque()
_loop_callback_queue_lock = threading.Lock()
_loop_callback_dispatch_scheduled = False


def _enqueue_loop_callback(func: Callable[..., None], *args):
    global _loop_callback_dispatch_scheduled
    if not _loop:
        return
    with _loop_callback_queue_lock:
        _loop_callback_queue.append((func, args))
        if _loop_callback_dispatch_scheduled:
            return
        _loop_callback_dispatch_scheduled = True
    _loop.call_soon_threadsafe(_dispatch_queued_loop_callbacks)


def _dispatch_queued_loop_callbacks():
    global _loop_callback_dispatch_scheduled
    with _loop_callback_queue_lock:
        queued_callbacks = list(_loop_callback_queue)
        _loop_callback_queue.clear()
        _loop_callback_dispatch_scheduled = False
    for callback, callback_args in queued_callbacks:
        try:
            callback(*callback_args)
        except Exception as e:
            print(f"[epicsWS]: Error processing {callback.__name__}: {e}")


def ca_callback(pv_name, pv_obj):
    _enqueue_loop_callback(_send_throttled, pv_name, pv_obj, CA_PROVIDER_KEY)


def pva_callback(pv_name, pv_obj):
    _enqueue_loop_callback(_send_throttled, pv_name, pv_obj, PVA_PROVIDER_KEY)


def ca_disconnect_callback(pv_name):
    _enqueue_loop_callback(_send_disconnect, pv_name, CA_PROVIDER_KEY)


def pva_disconnect_callback(pv_name):
    _enqueue_loop_callback(_send_disconnect, pv_name, PVA_PROVIDER_KEY)


def _send_throttled(pv_name: str, pv_obj, provider: str):
    """Forwards immediately if the rate limit allows, otherwise sends the latest
    value and flushes once the window elapses"""
    if MIN_UPDATE_INTERVAL <= 0:
        send_update(pv_name, pv_obj, provider)
        return
    if not _loop:
        return
    now = _loop.time()
    elapsed = now - _last_sent_time.get(pv_name, 0.0)
    if elapsed >= MIN_UPDATE_INTERVAL:
        _last_sent_time[pv_name] = now
        _pending_updates.pop(pv_name, None)
        send_update(pv_name, pv_obj, provider)
        return

    _pending_updates[pv_name] = (pv_obj, provider)
    if pv_name not in _throttle_timer_handles:
        _throttle_timer_handles[pv_name] = _loop.call_later(
            MIN_UPDATE_INTERVAL - elapsed, _send_pending_update, pv_name
        )


def _send_pending_update(pv_name: str):
    _throttle_timer_handles.pop(pv_name, None)
    pending_update = _pending_updates.pop(pv_name, None)
    if pending_update is None:
        return
    if not _loop:
        return
    pv_obj, provider = pending_update
    _last_sent_time[pv_name] = _loop.time()
    send_update(pv_name, pv_obj, provider)


# EPICS clients initialized in main() once the event loop is running
clients: Dict[str, Optional[Union[PVAClient, CAClient]]] = {
    PVA_PROVIDER_KEY: None,
    CA_PROVIDER_KEY: None,
}


def get_client(protocol: str) -> Union[PVAClient, CAClient]:
    client = clients.get(protocol)
    if client is None:
        raise ValueError(f"[epicsWS]: Unsupported protocol: {protocol}")
    return client


def _enqueue(ws: ServerConnection, frame: Frame):
    queue = send_queues.get(ws)
    if queue is None:
        return
    if queue.qsize() >= MAX_CLIENT_QUEUE:
        print(f"[epicsWS]: Client {ws.remote_address} is too slow, closing connection")
        del send_queues[ws]
        asyncio.create_task(ws.close(code=1013, reason="Client too slow"))
        return
    queue.put_nowait(frame)


async def _writer(ws: ServerConnection, queue: asyncio.Queue):
    try:
        while True:
            payload, text = await queue.get()
            await ws.send(payload, text=text)
    except Exception:
        print(f"[epicsWS]: Error sending update to {ws}")


def send_update(pv_name: str, pv_obj, provider: str):
    subscribed_clients = subscriptions.get(pv_name)
    if not subscribed_clients:
        return

    def serialize(msg) -> Frame:
        fields = {key: val for key, val in msg.items() if val is not None}
        if raw_array is not None:
            return build_binary_frame(fields, raw_array, ARRAY_ITEMSIZE[update.dtype]), False
        return orjson.dumps(fields), True

    parser = PVParser.pva_update if provider == PVA_PROVIDER_KEY else PVParser.ca_update
    update = parser(pv_obj, pv_name)

    # Populate metadata cache on first update for this PV
    if pv_name not in _pv_metadata:
        if provider == PVA_PROVIDER_KEY:
            _pv_metadata[pv_name] = PVParser.pva_metadata(pv_obj)
        else:
            _pv_metadata[pv_name] = PVParser.ca_metadata(pv_obj)

    pv_name_with_provider = format_pv_name(pv_name, provider)

    raw_array = update.rawArray
    base_msg = {
        "type": "update",
        "pv": pv_name_with_provider,
        "alarm": update.alarm,
        "timeStamp": update.timeStamp,
    }
    if raw_array is not None:
        base_msg["dtype"] = update.dtype
    else:
        base_msg["value"] = update.value
    if update.enumChoices is not None:
        base_msg["enumChoices"] = update.enumChoices

    clients_with_metadata = metadata_sent_to_clients.setdefault(pv_name, set())
    clients_needing_metadata = subscribed_clients - clients_with_metadata
    clients_with_metadata_to_update = subscribed_clients & clients_with_metadata
    if clients_with_metadata_to_update:
        data = serialize(base_msg)
        for ws in clients_with_metadata_to_update:
            _enqueue(ws, data)
    if clients_needing_metadata:
        full_msg = dict(base_msg)
        full_msg.update(asdict(_pv_metadata[pv_name]))
        full_msg["connected"] = True
        data = serialize(full_msg)
        clients_with_metadata |= clients_needing_metadata
        for ws in clients_needing_metadata:
            _enqueue(ws, data)


def _send_disconnect(pv_name: str, provider: str):
    """Notifies subscribed clients that a PV has disconnected and forces metadata resend on reconnect."""
    subscribed_clients = subscriptions.get(pv_name)
    if not subscribed_clients:
        return

    msg = {"type": "update", "pv": format_pv_name(pv_name, provider), "connected": False}
    data = (orjson.dumps(msg), True)

    for ws in set(subscribed_clients):
        _enqueue(ws, data)
    metadata_sent_to_clients.pop(pv_name, None)
    _pv_metadata.pop(pv_name, None)


async def message_handler(ws: ServerConnection):
    client_id = f"{ws.remote_address[0]}:{ws.remote_address[1]}"
    print(f"New connection from {client_id}")
    ws_subscriptions[ws] = set()
    send_queues[ws] = asyncio.Queue()
    writer_task = asyncio.create_task(_writer(ws, send_queues[ws]))

    try:
        async for message in ws:
            msg = orjson.loads(message)
            msg_type = msg.get("type")

            if msg_type == "subscribe":
                for pv in msg.get("pvs", []):
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    if pv_name not in subscriptions:
                        subscriptions[pv_name] = set()
                    subscriptions[pv_name].add(ws)
                    ws_subscriptions[ws].add(pv_name)
                    _pv_metadata.pop(pv_name, None)
                    asyncio.create_task(asyncio.to_thread(client.subscribe, client_id, pv_name))

            elif msg_type == "unsubscribe":
                for pv in msg.get("pvs", []):
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    if pv_name in subscriptions:
                        subscriptions[pv_name].discard(ws)
                        ws_subscriptions[ws].discard(pv_name)
                        if not subscriptions[pv_name]:
                            del subscriptions[pv_name]
                            _cleanup_pv_state(pv_name)
                        asyncio.create_task(asyncio.to_thread(client.unsubscribe, client_id, pv_name))
                    metadata_sent_to_clients.get(pv_name, set()).discard(ws)

            elif msg_type == "write":
                pv = msg.get("pv")
                value = msg.get("value")
                if pv and value is not None:
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    asyncio.create_task(asyncio.to_thread(client.write_to_pv, pv_name, value))

            elif msg_type == "snapshot":
                # Capture current values of all subscribed PVs
                snapshot_data = {}
                for pv_name in ws_subscriptions.get(ws, set()):
                    protocol, clean_name = parse_protocol(pv_name)
                    client = get_client(protocol)
                    if hasattr(client, "_latest_value"):
                        raw = client._latest_value.get(clean_name)
                        if raw is not None:
                            if protocol == PVA_PROVIDER_KEY:
                                parsed = PVParser.pva_update(raw, clean_name)
                            else:
                                parsed = PVParser.ca_update(raw, clean_name)
                            snapshot_data[pv_name] = PVParser.snapshot_update(parsed)

                await ws.send(
                    orjson.dumps(
                        {
                            k: v
                            for k, v in {
                                "type": "snapshot",
                                "pvs": snapshot_data,
                                "count": len(snapshot_data),
                            }.items()
                            if v is not None
                        }
                    ),
                    text=True,
                )

            elif msg_type == "restore":
                pvs_to_restore = msg.get("pvs", {})

                async def _restore_one(pv_name: str, pv_data):
                    try:
                        protocol, clean_name = parse_protocol(pv_name)
                        client = get_client(protocol)
                        value = pv_data if not isinstance(pv_data, dict) else pv_data.get("value")
                        await asyncio.to_thread(client.write_to_pv, clean_name, value)
                        return {"pv": pv_name, "success": True}
                    except Exception as e:
                        return {"pv": pv_name, "success": False, "error": str(e)}

                results = await asyncio.gather(
                    *(_restore_one(pv_name, pv_data) for pv_name, pv_data in pvs_to_restore.items())
                )

                await ws.send(
                    orjson.dumps(
                        {
                            "type": "restore_result",
                            "results": results,
                            "total": len(results),
                            "succeeded": sum(1 for r in results if r["success"]),
                        }
                    ),
                    text=True,
                )

            else:
                await ws.send(orjson.dumps({"type": "error", "message": "Unknown message type"}), text=True)

    except Exception as e:
        print(f"[epicsWS]: Error handling message from {client_id}: {e}")

    finally:
        print(f"[epicsWS]: Client disconnected: {client_id}")
        writer_task.cancel()
        send_queues.pop(ws, None)
        # Clean up all subscriptions for this client using the inverse index
        pv_names = ws_subscriptions.pop(ws, set())
        for pv_name in pv_names:
            pv_set = subscriptions.get(pv_name)
            if pv_set is not None:
                pv_set.discard(ws)
                if not pv_set:
                    del subscriptions[pv_name]
                    _cleanup_pv_state(pv_name)
            metadata_sent_to_clients.get(pv_name, set()).discard(ws)
        for c in clients.values():
            if c:
                asyncio.create_task(asyncio.to_thread(c.unsubscribe_all, client_id))


async def main():
    global _loop
    _loop = asyncio.get_running_loop()

    clients[PVA_PROVIDER_KEY] = PVAClient(pva_callback, pva_disconnect_callback)
    clients[CA_PROVIDER_KEY] = CAClient(ca_callback, ca_disconnect_callback)

    async with websockets.serve(message_handler, "0.0.0.0", 8080, compression=None):
        print("[epicsWS]: WebSocket server running on ws://localhost:8080")
        await asyncio.Future()


if __name__ == "__main__":
    uvloop.run(main())
