// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { PVValue, WSMessage } from "@src/types/epicsWS";

type ConnectionHandler = (connected: boolean) => void;
type MessageHandler = (message: WSMessage) => void;

/**
 * Normalizes a base64 string to standard Base64 format by replacing URL-safe
 * characters with standard characters.
 * @param b64 The base64 string to normalize.
 * @returns The normalized base64 string.
 */
function normalizeBase64(b64: string): string {
  return b64.replace(/-/g, "+").replace(/_/g, "/");
}

/**
 * Converts a base64-encoded string into an ArrayBuffer.
 * @param b64 The base64 string to decode.
 * @returns The decoded ArrayBuffer.
 */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(normalizeBase64(b64));
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

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
    this.socket.onopen = (event) => this.handleConnection(event);
    this.socket.onmessage = (event) => this.handleMessage(event.data as string);
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
   * Handles incoming WebSocket messages, decodes base64 arrays, and forwards them.
   * @param message The raw WebSocket message string.
   */
  private handleMessage(message: string): void {
    const uncheckedMessage: unknown = JSON.parse(message);

    if (!isWSMessage(uncheckedMessage)) {
      console.error("Received invalid message:", message);
      return;
    }

    const msg = uncheckedMessage;

    if (msg.type === "update" && msg.b64arr && msg.b64dtype) {
      const buffer = base64ToArrayBuffer(msg.b64arr);
      switch (msg.b64dtype) {
        case "float64":
          msg.value = Array.from(new Float64Array(buffer));
          break;
        case "int8":
          msg.value = Array.from(new Int8Array(buffer));
          break;
        case "int16":
          msg.value = Array.from(new Int16Array(buffer));
          break;
        case "int32":
          msg.value = Array.from(new Int32Array(buffer));
          break;
        default:
          console.error("Unsupported b64dtype:", msg.b64dtype);
          msg.value = [];
      }

      delete msg.b64arr;
      delete msg.b64dtype;
    }
    this.message_handler(msg);
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
        const msg = JSON.parse(event.data as string);
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
        const msg = JSON.parse(event.data as string);
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
