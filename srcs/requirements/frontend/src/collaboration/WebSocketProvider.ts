import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols/awareness";

const MSG_SYNC = 0x00;
const MSG_AWARENESS = 0x01;

export interface ProviderOptions {
  noteId: string;
  doc: Y.Doc;
  awareness: Awareness;
}

export class WebSocketProvider {
  readonly awareness: Awareness;

  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private noteId: string;
  private _synced = false;
  private _connected = false;
  private shouldReconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;

  get synced(): boolean {
    return this._synced;
  }

  get connected(): boolean {
    return this._connected;
  }

  constructor(options: ProviderOptions) {
    this.doc = options.doc;
    this.awareness = options.awareness;
    this.noteId = options.noteId;

    // Register listeners once in the constructor to avoid duplicates
    // on reconnect. The send() helper guards on ws.readyState === OPEN,
    // making these no-ops when disconnected.
    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  connect(): void {
    if (this.ws) return;

    this.shouldReconnect = true;
    this._synced = false;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/api/notes/${this.noteId}/sync`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectDelay = 1000;
      this.sendLocalAwareness();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const data = new Uint8Array(event.data as ArrayBuffer);
      if (data.length === 0) return;

      // First message: raw Yjs V1 update (no tag byte).
      // Subsequent messages: [tag][payload].
      if (!this._synced) {
        Y.applyUpdate(this.doc, data, "remote");
        this._synced = true;
        // Push offline edits accumulated while disconnected.
        // Safe because CRDT updates are idempotent.
        const localState = Y.encodeStateAsUpdate(this.doc);
        this.send(MSG_SYNC, localState);
        return;
      }

      const tag = data[0];
      const payload = data.slice(1);

      if (tag === MSG_SYNC) {
        Y.applyUpdate(this.doc, payload, "remote");
      } else if (tag === MSG_AWARENESS) {
        applyAwarenessUpdate(this.awareness, payload, this);
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.ws = null;
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this._synced = false;
  }

  destroy(): void {
    this.disconnect();
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === "remote") return;
    this.send(MSG_SYNC, update);
  };

  private handleAwarenessUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void => {
    const changedClients = [...added, ...updated, ...removed];
    const encoded = encodeAwarenessUpdate(this.awareness, changedClients);
    this.send(MSG_AWARENESS, encoded);
  };

  private send(tag: number, payload: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = new Uint8Array(1 + payload.length);
    message[0] = tag;
    message.set(payload, 1);
    this.ws.send(message);
  }

  private sendLocalAwareness(): void {
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const encoded = encodeAwarenessUpdate(
        this.awareness,
        Array.from(states.keys()),
      );
      this.send(MSG_AWARENESS, encoded);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }
}
