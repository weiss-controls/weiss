# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 André Favoto

from threading import Lock
from typing import Any, Callable, Dict, Set

from p4p.client.thread import Cancelled, Context, Disconnected, RemoteError, Subscription
from p4p.util import ThreadedWorkQueue


class PVAClient:
    """
    p4p based PVA client.
    Manages per-client subscriptions and forwards raw monitor data to the upper layer.
    """

    def __init__(self, handle_update: Callable[[str, Any], None], handle_disconnect: Callable[[str], None]):
        """
        handle_update: callable(pv_name: str, raw_data: Value)
        handle_disconnect: callable(pv_name: str), called when the channel disconnects
        """
        self._handle_update = handle_update
        self._handle_disconnect = handle_disconnect
        self._channels: Dict[str, Subscription] = {}  # pv_name -> p4p subscription
        self._subscribers: Dict[str, Set[str]] = {}  # pv_name -> set(client_ids)
        self._latest_value: Dict[str, Any] = {}  # pv_name -> last value
        self._lock = Lock()
        self._ctxt = Context("pva", nt=False)  # nt=False to get unpacked data
        # Use one worker instead of p4p's default four to reduce GIL contention with the event loop.
        # Due to this, callbacks must never block to avoid stalling the single worker thread.
        # In the future we may want to use free-threaded python here (no GIL), depending on support
        # of dependencies. When that happens we may revisit this change.
        # Set maxsize=0 (unbounded) to avoid ever dropping updates if they queue up.
        self._queue = ThreadedWorkQueue(name="p4p-callbacks", workers=1, daemon=True, maxsize=0).start()

    def _on_update(self, pv_name: str) -> Callable[[Any], None]:
        """Return the monitor callback for a PV; it also reports disconnects."""

        def callback(value: Any):
            # Cancelled fires on our own unsubscribe/close; not a real disconnect
            if isinstance(value, Cancelled):
                return
            if isinstance(value, (Disconnected, RemoteError)):
                self._handle_disconnect(pv_name)
                return
            with self._lock:
                self._latest_value[pv_name] = value
            self._handle_update(pv_name, value)

        return callback

    def subscribe(self, client_id: str, pv_name: str):
        """Subscribe a client to a PV, creating the monitor on the first subscription."""
        with self._lock:
            first_sub = pv_name not in self._channels
            if first_sub:
                self._channels[pv_name] = self._ctxt.monitor(
                    pv_name, self._on_update(pv_name), notify_disconnect=True, queue=self._queue
                )
            self._subscribers.setdefault(pv_name, set()).add(client_id)
            # Send last value if the monitor already existed (late subscriber)
            if not first_sub and pv_name in self._latest_value:
                self._handle_update(pv_name, self._latest_value[pv_name])

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
        """Close the monitor."""
        if not channel:
            return
        try:
            channel.close()
        except Exception as e:
            print(f"[PVAClient]: Failed to close {pv_name}: {e}")

    def write_to_pv(self, pv: str, value: Any):
        """Write a value to a PV."""
        with self._lock:
            channel = self._channels.get(pv)
        if not channel:
            print(f"[PVAClient]: Cannot write: PV {pv} not subscribed.")
            return

        try:
            self._ctxt.put(pv, value)
        except Exception as e:
            print(f"[PVAClient]: Write to {pv} failed: {e}")

    def close(self):
        """Close all subscriptions and the context."""
        with self._lock:
            channels = list(self._channels.items())
            self._channels.clear()
            self._subscribers.clear()
            self._latest_value.clear()
        for pv_name, channel in channels:
            self._release(pv_name, channel)
        # Outside the lock: the worker may be waiting for it inside a callback, and stop() joins it
        self._ctxt.close()
        self._queue.stop()
        print("[PVAClient]: Closed all subscriptions.")
