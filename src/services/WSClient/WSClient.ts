// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PVValue, WSMessage } from "@src/types/epicsWS";
import { decodeBinaryUpdate } from "./binaryArray.ts";

type ConnectionHandler = (connected: boolean) => void;
type MessageHandler = (message: WSMessage) => void;

/**
 * Type guard to check if an object is a WSMessage.
 * @param obj The object to check.
 * @returns True if the object is a WSMessage, false otherwise.
 */
function isWSMessage(obj: unknown): obj is WSMessage {
  return typeof obj === "object" && obj !== null && ("pv" in obj || "value" in obj);
}

/**
 * WebSocket client for connecting to the WebSocket server.
 * Handles subscribing, unsubscribing, writing, and receiving PV updates.
 */
export class WSClient {
  private url: string;
  private connection_handler: ConnectionHandler;
  private message_handler: MessageHandler;

  private connected = false;
  private socket!: WebSocket;
  private values: Record<string, WSMessage> = {};

  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  /**
   * Creates a new WSClient instance.
   * @param url The WebSocket server URL.
   * @param connection_handler Callback for connection status changes.
   * @param message_handler Callback for incoming messages.
   */
  constructor(url: string, connection_handler: ConnectionHandler, message_handler: MessageHandler) {
    this.url = url;
    this.connection_handler = connection_handler;
    this.message_handler = message_handler;
  }

  /**
   * Opens a new WebSocket connection and sets up event handlers.
   */
  open(): void {
    this.intentionallyClosed = false;
    this._connect();
  }

  private _connect(): void {
    this.socket = new WebSocket(this.url);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = (event) => this.handleConnection(event);
    this.socket.onmessage = (event) => this.handleMessage(event.data as string | ArrayBuffer);
    this.socket.onclose = (event) => this.handleClose(event);
    this.socket.onerror = (event) => this.handleError(event);
  }

  /**
   * Handles the WebSocket 'open' event and notifies the connection handler.
   * @param _event The open event.
   */
  private handleConnection(_event: Event): void {
    this.connected = true;
    this.reconnectDelay = 1000;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connection_handler(true);
  }

  /**
   * Handles incoming WebSocket messages and forwards decoded PV updates.
   * @param message The raw WebSocket message.
   */
  private handleMessage(message: string | ArrayBuffer): void {
    let uncheckedMessage: unknown;
    try {
      uncheckedMessage =
        typeof message === "string" ? JSON.parse(message) : decodeBinaryUpdate(message);
    } catch (error) {
      console.error("Invalid WebSocket message:", error);
      return;
    }

    if (!isWSMessage(uncheckedMessage)) {
      console.error("Received invalid message:", message);
      return;
    }

    this.message_handler(uncheckedMessage);
  }

  /**
   * Handles WebSocket errors and closes the connection.
   * @param event The error event.
   */
  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.close();
  }

  /**
   * Handles WebSocket close events and notifies the connection handler.
   * @param event The close event.
   */
  private handleClose(event: CloseEvent): void {
    this.connected = false;
    this.connection_handler(false);
    let message = `Web socket closed (${event.code}`;
    if (event.reason) {
      message += `, ${event.reason}`;
    }
    message += ")";
    if (event.code !== 1000) {
      console.error(message);
      if (!this.intentionallyClosed) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this._connect();
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    }
  }

  /**
   * Returns the current connection status.
   * @returns True if connected, false otherwise.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Subscribes to one or more PVs.
   * @param pvs The PV name or array of PV names to subscribe to.
   */
  subscribe(pvs: string | string[]): void {
    if (!this.connected) return;
    if (!Array.isArray(pvs)) {
      pvs = [pvs];
    }
    this.socket.send(JSON.stringify({ type: "subscribe", pvs }));
  }

  /**
   * Unsubscribes from one or more PVs.
   * @param pvs The PV name or array of PV names to unsubscribe from.
   */
  unsubscribe(pvs: string | string[]): void {
    if (!this.connected) return;
    if (!Array.isArray(pvs)) {
      pvs = [pvs];
    }
    this.socket.send(JSON.stringify({ type: "unsubscribe", pvs }));

    for (const pv of pvs) {
      delete this.values[pv];
    }
  }

  /**
   * Writes a value to a PV.
   * @param pv The PV name.
   * @param value The value to write.
   */
  write(pv: string, value: PVValue): void {
    if (!this.connected) return;
    this.socket.send(JSON.stringify({ type: "write", pv, value }));
  }

  /**
   * Requests a snapshot of all currently subscribed PV values.
   * @returns A promise that resolves with the snapshot data.
   */
  requestSnapshot(): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("Not connected"));
        return;
      }

      const handler = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        if (msg.type === "snapshot") {
          this.socket.removeEventListener("message", handler);
          resolve(msg);
        }
      };
      this.socket.addEventListener("message", handler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket.removeEventListener("message", handler);
        reject(new Error("Snapshot timeout"));
      }, 5000);

      this.socket.send(JSON.stringify({ type: "snapshot" }));
    });
  }

  /**
   * Restores PV values from a saved snapshot.
   * @param pvs Record of PV names to their saved values.
   * @returns A promise that resolves with the restore results.
   */
  restoreSnapshot(pvs: Record<string, { value: PVValue }>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error("Not connected"));
        return;
      }

      const handler = (event: MessageEvent) => {
        if (typeof event.data !== "string") return;
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        if (msg.type === "restore_result") {
          this.socket.removeEventListener("message", handler);
          resolve(msg);
        }
      };
      this.socket.addEventListener("message", handler);

      setTimeout(() => {
        this.socket.removeEventListener("message", handler);
        reject(new Error("Restore timeout"));
      }, 10000);

      this.socket.send(JSON.stringify({ type: "restore", pvs }));
    });
  }

  /**
   * Closes the WebSocket connection.
   */
  close(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.connected) return;
    this.socket.close(1000, "Client closing connection normally");
  }
}
