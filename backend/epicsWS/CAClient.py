# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from threading import Lock
from typing import Any, Callable, Dict, Set

import epics


class CAClient:
    """
    PyEpics based CA Client.
    Handles per-client subscriptions and forwards raw callback data to the upper layer.
    """

    def __init__(self, handle_update: Callable[[str, Any], None], handle_disconnect: Callable[[str], None]):
        """
        handle_update: callable(pv_name: str, raw_data: dict)
        handle_disconnect: callable(pv_name: str), called when the PV disconnects
        """
        self._handle_update = handle_update
        self._handle_disconnect = handle_disconnect
        self._pvs: Dict[str, Any] = {}
        self._subscribers: Dict[str, Set[str]] = {}
        self._lock = Lock()
        self._latest_value: Dict[str, Any] = {}

    def _callback(self, value, **kwargs):
        """Generic callback for all PVs — passes raw data upstream."""
        pvname = kwargs.get("pvname")
        if not pvname:
            return
        val = {"value": value, **kwargs}

        with self._lock:
            self._latest_value[pvname] = val

        self._handle_update(pvname, val)

    def _connection_callback(self, pvname=None, conn=True, **kwargs):
        """Fires on both connect and disconnect; only disconnect needs forwarding."""
        if not conn and pvname:
            self._handle_disconnect(pvname)

    def subscribe(self, client_id: str, pv_name: str):
        """
        Subscribe a client to a PV.
        On first subscription, creates the PV and attaches a callback.
        """
        with self._lock:
            first_sub = pv_name not in self._pvs
            self._subscribers.setdefault(pv_name, set()).add(client_id)
            if not first_sub and pv_name in self._latest_value:
                self._handle_update(pv_name, self._latest_value[pv_name])

        if first_sub:
            try:
                pv = epics.get_pv(pv_name, connection_callback=self._connection_callback)
                pv.get_ctrlvars()
                cb = pv.add_callback(self._callback, with_ctrlvars=True)
                pv.run_callback(cb)
                self._pvs[pv_name] = pv
            except Exception as e:
                print(f"[CAClient]: Failed to subscribe to {pv_name}: {e}")

    def unsubscribe(self, client_id: str, pv_name: str):
        """Unsubscribe a client from a PV."""
        with self._lock:
            clients = self._subscribers.get(pv_name)
            if not clients:
                return

            clients.discard(client_id)
            if not clients:
                pv = self._pvs.pop(pv_name, None)
                self._subscribers.pop(pv_name, None)
                self._latest_value.pop(pv_name, None)
                if pv:
                    try:
                        pv.clear_callbacks()
                    except Exception as e:
                        print(f"[CAClient]: Failed to clear callbacks for {pv_name}: {e}")

    def unsubscribe_all(self, client_id: str):
        """Remove a client from all subscriptions."""
        with self._lock:
            empty_pvs = []
            for pv_name, clients in self._subscribers.items():
                clients.discard(client_id)
                if not clients:
                    empty_pvs.append(pv_name)

            for pv_name in empty_pvs:
                pv = self._pvs.pop(pv_name, None)
                self._subscribers.pop(pv_name, None)
                self._latest_value.pop(pv_name, None)
                if pv:
                    try:
                        pv.clear_callbacks()
                    except Exception as e:
                        print(f"[CAClient]: Failed to clear callbacks for {pv_name}: {e}")

    def write_to_pv(self, pv: str, value: Any):
        """Write synchronously to a PV."""
        with self._lock:
            pv_obj = self._pvs.get(pv)
        if not pv_obj:
            print(f"[CAClient]: Cannot write: PV {pv} not subscribed.")
            return

        try:
            pv_obj.put(value)
        except Exception as e:
            print(f"[CAClient]: Write to {pv} failed: {e}")

    def close(self):
        """Stop all subscriptions and clear resources."""
        with self._lock:
            for pv_name, pv in self._pvs.items():
                try:
                    pv.clear_callbacks()
                except Exception as e:
                    print(f"[CAClient]: Failed to clear callbacks for {pv_name}: {e}")
            self._pvs.clear()
            self._subscribers.clear()
            self._latest_value.clear()
        print("[CAClient]: Closed all subscriptions.")
