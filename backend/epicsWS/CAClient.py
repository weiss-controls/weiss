# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from threading import Lock
from typing import Any, Callable, Dict, Set

import epics


class CAClient:
    """
    PyEpics based CA client.
    Manages per-client subscriptions and forwards raw monitor data to the upper layer.
    """

    def __init__(self, handle_update: Callable[[str, Any], None], handle_disconnect: Callable[[str], None]):
        """
        handle_update: callable(pv_name: str, raw_data: dict)
        handle_disconnect: callable(pv_name: str), called when the channel disconnects
        """
        self._handle_update = handle_update
        self._handle_disconnect = handle_disconnect
        self._channels: Dict[str, Any] = {}  # pv_name -> epics.PV
        self._subscribers: Dict[str, Set[str]] = {}  # pv_name -> set(client_ids)
        self._latest_value: Dict[str, Any] = {}  # pv_name -> last value
        self._lock = Lock()

    def _on_update(self, **kwargs):
        """Monitor callback for all PVs; pyepics passes the update as keyword arguments."""
        pvname = kwargs.get("pvname")
        # pyepics calls back with no value for a PV that has not delivered one yet
        if not pvname or kwargs.get("value") is None:
            return

        with self._lock:
            self._latest_value[pvname] = kwargs

        self._handle_update(pvname, kwargs)

    def _on_connection(self, pvname=None, conn=True, **kwargs):
        """Fires on both connect and disconnect; only disconnect needs forwarding."""
        if not conn and pvname:
            self._handle_disconnect(pvname)

    def subscribe(self, client_id: str, pv_name: str):
        """Subscribe a client to a PV, creating the monitor on the first subscription."""
        with self._lock:
            first_sub = pv_name not in self._channels
            self._subscribers.setdefault(pv_name, set()).add(client_id)
            # Send last value if the monitor already existed (late subscriber)
            if not first_sub and pv_name in self._latest_value:
                self._handle_update(pv_name, self._latest_value[pv_name])

        # Outside the lock, since waiting for the connection blocks
        if first_sub:
            try:
                channel = epics.get_pv(pv_name, connection_callback=self._on_connection)
                if not channel.wait_for_connection():
                    print(f"[CAClient]: {pv_name} not connected after {channel.connection_timeout}s, still waiting")
                # add_callback fetches the control variables once, if connected
                cb = channel.add_callback(self._on_update, with_ctrlvars=True)
                channel.run_callback(cb)
                self._channels[pv_name] = channel
            except Exception as e:
                print(f"[CAClient]: Failed to subscribe to {pv_name}: {e}")

    def unsubscribe(self, client_id: str, pv_name: str):
        """Unsubscribe a client from a PV."""
        with self._lock:
            clients = self._subscribers.get(pv_name)
            if not clients:
                return

            clients.discard(client_id)
            if clients:
                return
            channel = self._channels.pop(pv_name, None)
            self._subscribers.pop(pv_name, None)
            self._latest_value.pop(pv_name, None)

        self._release(pv_name, channel)

    def unsubscribe_all(self, client_id: str):
        """Remove a client from all subscriptions."""
        released = []
        with self._lock:
            empty_pvs = []
            for pv_name, clients in self._subscribers.items():
                clients.discard(client_id)
                if not clients:
                    empty_pvs.append(pv_name)

            for pv_name in empty_pvs:
                released.append((pv_name, self._channels.pop(pv_name, None)))
                self._subscribers.pop(pv_name, None)
                self._latest_value.pop(pv_name, None)

        for pv_name, channel in released:
            self._release(pv_name, channel)

    @staticmethod
    def _release(pv_name: str, channel):
        """Stop the monitor and drop the PV from pyepics' cache, so it stops being decoded."""
        if not channel:
            return
        try:
            # disconnect() looks the PV up in the cache of the calling thread's context
            if epics.ca.current_context() is None:
                epics.ca.use_initial_context()
            channel.disconnect()
        except Exception as e:
            print(f"[CAClient]: Failed to disconnect {pv_name}: {e}")

    def write_to_pv(self, pv: str, value: Any):
        """Write a value to a PV."""
        with self._lock:
            channel = self._channels.get(pv)
        if not channel:
            print(f"[CAClient]: Cannot write: PV {pv} not subscribed.")
            return

        try:
            channel.put(value)
        except Exception as e:
            print(f"[CAClient]: Write to {pv} failed: {e}")

    def close(self):
        """Close all subscriptions."""
        with self._lock:
            channels = list(self._channels.items())
            self._channels.clear()
            self._subscribers.clear()
            self._latest_value.clear()
        for pv_name, channel in channels:
            self._release(pv_name, channel)
        print("[CAClient]: Closed all subscriptions.")
