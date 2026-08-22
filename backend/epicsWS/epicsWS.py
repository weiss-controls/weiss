# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import asyncio
import json
import os
from typing import Any, Dict, Optional, Set, Tuple, Union

import websockets
from websockets.asyncio.server import ServerConnection

from CAClient import CAClient
from PVAClient import PVAClient
from pvParser import PVParser

CA_PROVIDER_KEY = "ca"
PVA_PROVIDER_KEY = "pva"

# map PV -> set of websocket clients
subscriptions: Dict[str, Set[ServerConnection]] = {}

# per-ws inverse index for O(pvs_per_client) disconnect cleanup
ws_subscriptions: Dict[ServerConnection, Set[str]] = {}

# track if metadata has been sent per (ws, pv_name)
sent_metadata: Dict[Tuple[ServerConnection, str], bool] = {}

# cached quasi-static metadata per pv_name
_pv_metadata: Dict[str, dict] = {}

# environment variable fallback
DEFAULT_PROTOCOL = os.getenv("EPICS_DEFAULT_PROTOCOL", PVA_PROVIDER_KEY).lower()

# Max rate (Hz) at which updates for a single PV are forwarded to clients; 0 disables throttling.
MAX_UPDATE_RATE_HZ = float(os.getenv("EPICS_MAX_UPDATE_RATE_HZ", "30"))
MIN_UPDATE_INTERVAL = 1.0 / MAX_UPDATE_RATE_HZ if MAX_UPDATE_RATE_HZ > 0 else 0.0

# Per-PV throttle bookkeeping
_last_sent_time: Dict[str, float] = {}
_pending_update: Dict[str, Tuple[Any, str]] = {}
_trailing_handle: Dict[str, asyncio.TimerHandle] = {}


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


_loop: Optional[asyncio.AbstractEventLoop] = None


def ca_callback(pv_name, pv_obj):
    if _loop:
        _loop.call_soon_threadsafe(_send_throttled, pv_name, pv_obj, CA_PROVIDER_KEY)


def pva_callback(pv_name, pv_obj):
    if _loop:
        _loop.call_soon_threadsafe(_send_throttled, pv_name, pv_obj, PVA_PROVIDER_KEY)


def ca_disconnect_callback(pv_name):
    if _loop:
        _loop.call_soon_threadsafe(_schedule_disconnect, pv_name, CA_PROVIDER_KEY)


def pva_disconnect_callback(pv_name):
    if _loop:
        _loop.call_soon_threadsafe(_schedule_disconnect, pv_name, PVA_PROVIDER_KEY)


def _schedule_disconnect(pv_name: str, provider: str):
    asyncio.create_task(_send_disconnect(pv_name, provider))


def _send_throttled(pv_name: str, pv_obj, provider: str):
    """Forwards immediately if the rate limit allows, otherwise sends the latest
    value and flushes once the window elapses"""
    if MIN_UPDATE_INTERVAL <= 0:
        asyncio.create_task(send_update(pv_name, pv_obj, provider))
        return
    if not _loop:
        return
    now = _loop.time()
    elapsed = now - _last_sent_time.get(pv_name, 0.0)
    if elapsed >= MIN_UPDATE_INTERVAL:
        _last_sent_time[pv_name] = now
        _pending_update.pop(pv_name, None)
        asyncio.create_task(send_update(pv_name, pv_obj, provider))
        return

    _pending_update[pv_name] = (pv_obj, provider)
    if pv_name not in _trailing_handle:
        _trailing_handle[pv_name] = _loop.call_later(MIN_UPDATE_INTERVAL - elapsed, _flush_trailing, pv_name)


def _flush_trailing(pv_name: str):
    _trailing_handle.pop(pv_name, None)
    pending = _pending_update.pop(pv_name, None)
    if pending is None:
        return
    if not _loop:
        return
    pv_obj, provider = pending
    _last_sent_time[pv_name] = _loop.time()
    asyncio.create_task(send_update(pv_name, pv_obj, provider))


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


async def send_update(pv_name: str, pv_obj, provider: str):
    ws_set = subscriptions.get(pv_name)
    if not ws_set:
        return

    # Parse fast-changing fields (value, alarm, timeStamp, b64arr/dtype)
    if provider == PVA_PROVIDER_KEY:
        update = PVParser.pva_update(pv_obj, pv_name)
    else:
        update = PVParser.ca_update(pv_obj, pv_name)

    # Populate metadata cache on first update for this PV
    if pv_name not in _pv_metadata:
        if provider == PVA_PROVIDER_KEY:
            _pv_metadata[pv_name] = PVParser.pva_metadata(pv_obj)
        else:
            _pv_metadata[pv_name] = PVParser.ca_metadata(pv_obj)

    pv_name_with_provider = format_pv_name(pv_name, provider)

    base_msg = {
        "type": "update",
        "pv": pv_name_with_provider,
        "value": update["value"],
        "alarm": update["alarm"],
        "timeStamp": update["timeStamp"],
        "b64arr": update["b64arr"],
        "b64dtype": update["b64dtype"],
    }
    if update.get("enumChoices") is not None:
        base_msg["enumChoices"] = update["enumChoices"]

    # Serialize the common payload once and reuse it for all clients that already have metadata
    common_data: Optional[str] = None

    for ws in set(ws_set):
        key = (ws, pv_name)
        if sent_metadata.get(key):
            # Fast path: reuse pre-serialized common payload
            if common_data is None:
                common_data = json.dumps({k: v for k, v in base_msg.items() if v is not None})
            try:
                await ws.send(common_data)
            except Exception:
                print(f"[epicsWS]: Error sending update to {ws}")
        else:
            # First update for this client (or after a disconnect): include metadata + connected flag
            full_msg = dict(base_msg)
            full_msg.update(_pv_metadata[pv_name])
            full_msg["connected"] = True
            sent_metadata[key] = True
            data = json.dumps({k: v for k, v in full_msg.items() if v is not None})
            try:
                await ws.send(data)
            except Exception:
                print(f"[epicsWS]: Error sending update to {ws}")


async def _send_disconnect(pv_name: str, provider: str):
    """Notifies subscribed clients that a PV has disconnected and forces metadata resend on reconnect."""
    ws_set = subscriptions.get(pv_name)
    if not ws_set:
        return

    msg = {"type": "update", "pv": format_pv_name(pv_name, provider), "connected": False}
    data = json.dumps(msg)

    for ws in set(ws_set):
        try:
            await ws.send(data)
        except Exception:
            print(f"[epicsWS]: Error sending disconnect notice to {ws}")
        sent_metadata[(ws, pv_name)] = False

    _pv_metadata.pop(pv_name, None)


async def message_handler(ws: ServerConnection):
    client_id = f"{ws.remote_address[0]}:{ws.remote_address[1]}"
    print(f"New connection from {client_id}")
    ws_subscriptions[ws] = set()

    try:
        async for message in ws:
            msg = json.loads(message)
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
                    client.subscribe(client_id, pv_name)

            elif msg_type == "unsubscribe":
                for pv in msg.get("pvs", []):
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    if pv_name in subscriptions:
                        subscriptions[pv_name].discard(ws)
                        ws_subscriptions[ws].discard(pv_name)
                        if not subscriptions[pv_name]:
                            del subscriptions[pv_name]
                            _pv_metadata.pop(pv_name, None)
                        client.unsubscribe(client_id, pv_name)
                    sent_metadata.pop((ws, pv_name), None)

            elif msg_type == "write":
                pv = msg.get("pv")
                value = msg.get("value")
                if pv and value is not None:
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    client.write_to_pv(pv_name, value)

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
                            snapshot_data[pv_name] = {
                                "value": parsed["value"],
                                "alarm": parsed["alarm"],
                                "timeStamp": parsed["timeStamp"],
                                "b64arr": parsed["b64arr"],
                                "b64dtype": parsed["b64dtype"],
                            }

                await ws.send(
                    json.dumps(
                        {
                            k: v
                            for k, v in {
                                "type": "snapshot",
                                "pvs": snapshot_data,
                                "count": len(snapshot_data),
                            }.items()
                            if v is not None
                        }
                    )
                )

            elif msg_type == "restore":
                # Write saved PV values back to IOC
                pvs_to_restore = msg.get("pvs", {})
                results = []
                for pv_name, pv_data in pvs_to_restore.items():
                    try:
                        protocol, clean_name = parse_protocol(pv_name)
                        client = get_client(protocol)
                        value = pv_data if not isinstance(pv_data, dict) else pv_data.get("value")
                        client.write_to_pv(clean_name, value)
                        results.append({"pv": pv_name, "success": True})
                    except Exception as e:
                        results.append({"pv": pv_name, "success": False, "error": str(e)})

                await ws.send(
                    json.dumps(
                        {
                            "type": "restore_result",
                            "results": results,
                            "total": len(results),
                            "succeeded": sum(1 for r in results if r["success"]),
                        }
                    )
                )

            else:
                await ws.send(json.dumps({"type": "error", "message": "Unknown message type"}))

    except Exception as e:
        print(f"[epicsWS]: Error handling message from {client_id}: {e}")

    finally:
        print(f"[epicsWS]: Client disconnected: {client_id}")
        # Clean up all subscriptions for this client using the inverse index
        pv_names = ws_subscriptions.pop(ws, set())
        for pv_name in pv_names:
            pv_set = subscriptions.get(pv_name)
            if pv_set is not None:
                pv_set.discard(ws)
                if not pv_set:
                    del subscriptions[pv_name]
                    _pv_metadata.pop(pv_name, None)
            sent_metadata.pop((ws, pv_name), None)
        for c in clients.values():
            if c:
                c.unsubscribe_all(client_id)


async def main():
    global _loop
    _loop = asyncio.get_running_loop()

    clients[PVA_PROVIDER_KEY] = PVAClient(pva_callback, pva_disconnect_callback)
    clients[CA_PROVIDER_KEY] = CAClient(ca_callback, ca_disconnect_callback)

    async with websockets.serve(message_handler, "0.0.0.0", 8080):
        print("[epicsWS]: WebSocket server running on ws://localhost:8080")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
