# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from typing import Callable, Dict, Set, Any
from p4p.client.thread import Context
from p4p.client.thread import Subscription
import threading


class PVAClient:
    """
    Manages PV subscriptions per client_id using p4p.
    """

    def __init__(self, handle_update: Callable[[str, Any], None]):
        """
        handle_update: callable(pv_name: str, value: object)
        """
        self._channels: Dict[str, Subscription] = {}
        self._subscribers: Dict[str, Set[str]] = {}  # pv_name -> set(client_ids)
        self._handle_update = handle_update
        self._ctxt = Context("pva", nt=False)  # nt=False to get unpacked data
        self._lock = threading.Lock()
        self._latest_value: Dict[str, Any] = {}  # pv_name -> last value

    def _on_update(self, pv_name: str) -> Callable[[Any], None]:
        """Return a callback for monitor updates."""

        def callback(value: Any):
            with self._lock:
                self._latest_value[pv_name] = value
            self._handle_update(pv_name, value)

        return callback

    def subscribe(self, client_id: str, pv_name: str):
        """Subscribe a single client to a PV."""
        with self._lock:
            if pv_name not in self._channels:
                mon = self._ctxt.monitor(pv_name, self._on_update(pv_name))
                self._channels[pv_name] = mon
                self._subscribers[pv_name] = set()
            # Send last value if monitor already existed (late subscriber)
            else:
                if pv_name in self._latest_value:
                    self._handle_update(pv_name, self._latest_value[pv_name])
            self._subscribers[pv_name].add(client_id)

    def unsubscribe(self, client_id: str, pv_name: str):
        """Unsubscribe a single client from a PV."""
        with self._lock:
            if pv_name not in self._subscribers:
                return
            self._subscribers[pv_name].discard(client_id)

            if not self._subscribers[pv_name]:
                mon = self._channels.pop(pv_name, None)
                self._latest_value.pop(pv_name, None)
                if mon:
                    mon.close()
                del self._subscribers[pv_name]

    def unsubscribe_all(self, client_id: str):
        """Remove client_id from all PV subscriptions."""
        with self._lock:
            empty_pvs = []
            for pv, clients in self._subscribers.items():
                clients.discard(client_id)
                if not clients:
                    empty_pvs.append(pv)

            for pv in empty_pvs:
                mon = self._channels.pop(pv, None)
                self._latest_value.pop(pv, None)
                if mon:
                    mon.close()
                del self._subscribers[pv]

    def write_to_pv(self, pv: str, value: Any):
        """Write a value to a PV (async)."""
        mon = self._channels.get(pv)
        if not mon:
            print(f"[PVAClient]: Trying to write to not subscribed PV {pv}. Ignoring.")
            return

        try:
            self._ctxt.put(pv, value)
        except Exception as e:
            print(f"[PVAClient]: Write to PV {pv} failed: {e}")

    def close(self):
        """Close all subscriptions and context."""
        with self._lock:
            for mon in self._channels.values():
                mon.close()
            self._channels.clear()
            self._subscribers.clear()
            self._latest_value.clear()
            self._ctxt.close()
