# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

import asyncio
import json
import os
import websockets
from websockets.legacy.server import WebSocketServerProtocol
from typing import Dict, Set, Tuple, Optional, Union

from pvParser import PVParser, PVData
from PVAClient import PVAClient
from CAClient import CAClient

CA_PROVIDER_KEY = "ca"
PVA_PROVIDER_KEY = "pva"

# map PV -> set of websocket clients
subscriptions: Dict[str, Set[WebSocketServerProtocol]] = {}

# track if metadata has been sent per (ws, pv_name)
sent_metadata: Dict[Tuple[WebSocketServerProtocol, str], bool] = {}

# holds one client per backend
clients: Dict[str, Optional[Union[PVAClient, CAClient]]] = {
    PVA_PROVIDER_KEY: None,
    CA_PROVIDER_KEY: None,
}

# environment variable fallback
DEFAULT_PROTOCOL = os.getenv("EPICS_DEFAULT_PROTOCOL", PVA_PROVIDER_KEY).lower()


def parse_protocol(pv_name: str) -> Tuple[str, str]:
    """Decide protocol from PV prefix or default env var.
    Returns PV without protocol prefix"""
    if pv_name.startswith("pva://"):
        return PVA_PROVIDER_KEY, pv_name[6:]
    elif pv_name.startswith("ca://"):
        return CA_PROVIDER_KEY, pv_name[5:]
    return DEFAULT_PROTOCOL, pv_name


async def send_update(pv_name: str, pv_obj, provider: str):
    pv_data: PVData = (
        PVParser.from_pva(pv_obj, pv_name)
        if provider == PVA_PROVIDER_KEY
        else PVParser.from_ca(pv_obj, pv_name)
    )

    if provider != DEFAULT_PROTOCOL:
        pv_name_with_provider = f"{provider}://{pv_name}"
    else:
        pv_name_with_provider = pv_name

    base_message = {
        "type": "update",
        "pv": pv_name_with_provider,
        "value": pv_data.value,
        "alarm": pv_data.alarm.__dict__ if pv_data.alarm else None,
        "timeStamp": pv_data.timeStamp.__dict__ if pv_data.timeStamp else None,
        "b64arr": pv_data.b64arr,
        "b64dtype": pv_data.b64dtype,
    }

    for ws in set(subscriptions.get(pv_name, set())):
        key = (ws, pv_name)
        message = dict(base_message)
        if not sent_metadata.get(key):
            message.update(
                {
                    "enumChoices": pv_data.enumChoices,
                    "display": pv_data.display.__dict__ if pv_data.display else None,
                    "control": pv_data.control.__dict__ if pv_data.control else None,
                    "valueAlarm": pv_data.valueAlarm.__dict__ if pv_data.valueAlarm else None,
                }
            )
            sent_metadata[key] = True

        data = json.dumps({k: v for k, v in message.items() if v is not None})

        try:
            await ws.send(data)
        except Exception:
            print(f"[epicsWS]: Error sending update to {ws}")


async def message_handler(ws: WebSocketServerProtocol):
    client_id = f"{ws.remote_address[0]}:{ws.remote_address[1]}"
    print(f"New connection from {client_id}")
    loop = asyncio.get_running_loop()

    def ca_callback(pv_name, pv_obj):
        asyncio.run_coroutine_threadsafe(send_update(pv_name, pv_obj, CA_PROVIDER_KEY), loop)

    def pva_callback(pv_name, pv_obj):
        asyncio.run_coroutine_threadsafe(send_update(pv_name, pv_obj, PVA_PROVIDER_KEY), loop)

    def get_client(protocol: str):
        if protocol == PVA_PROVIDER_KEY:
            if clients[PVA_PROVIDER_KEY] is None:
                clients[PVA_PROVIDER_KEY] = PVAClient(pva_callback)
            return clients[PVA_PROVIDER_KEY]
        elif protocol == CA_PROVIDER_KEY:
            if clients[CA_PROVIDER_KEY] is None:
                clients[CA_PROVIDER_KEY] = CAClient(ca_callback)
            return clients[CA_PROVIDER_KEY]
        raise ValueError(f"[epicsWS]: Unsupported protocol: {protocol}")

    try:
        async for message in ws:
            msg = json.loads(message)
            msg_type = msg.get("type")

            if msg_type == "subscribe":
                for pv in msg.get("pvs", []):
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    if not client:
                        raise ValueError(f"Client not initialized for {protocol}")
                    if pv_name not in subscriptions:
                        subscriptions[pv_name] = set()
                    subscriptions[pv_name].add(ws)
                    client.subscribe(client_id, pv_name)

            elif msg_type == "unsubscribe":
                for pv in msg.get("pvs", []):
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    if not client:
                        raise ValueError(f"Client not initialized for {protocol}")
                    if pv_name in subscriptions:
                        subscriptions[pv_name].discard(ws)
                        if not subscriptions[pv_name]:
                            del subscriptions[pv_name]
                        client.unsubscribe(client_id, pv_name)
                    sent_metadata.pop((ws, pv_name), None)

            elif msg_type == "write":
                pv = msg.get("pv")
                value = msg.get("value")
                if pv and value is not None:
                    protocol, pv_name = parse_protocol(pv)
                    client = get_client(protocol)
                    if not client:
                        raise ValueError(f"Client not initialized for {protocol}")
                    client.write_to_pv(pv_name, value)

            else:
                await ws.send(json.dumps({"type": "error", "message": "Unknown message type"}))

    except Exception as e:
        print(f"[epicsWS]: Error handling message from {client_id}: {e}")

    finally:
        print(f"[epicsWS]: Client disconnected: {client_id}")
        for pv, clients_set in list(subscriptions.items()):
            clients_set.discard(ws)
            if not clients_set:
                del subscriptions[pv]
            sent_metadata.pop((ws, pv), None)
        for c in clients.values():
            if c:
                c.unsubscribe_all(client_id)


async def main():
    async with websockets.serve(message_handler, "0.0.0.0", 8080):
        print("[epicsWS]: WebSocket server running on ws://localhost:8080")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
