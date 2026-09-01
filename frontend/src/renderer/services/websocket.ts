import type { WSMessage } from '../types';
import { WSOpCode } from '../types';
import { api } from './api';

type MessageHandler = (message: WSMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: WSMessage[] = [];
  private handlers: Set<MessageHandler> = new Set();
  private connecting = false;
  private currentChannelId: string | null = null;
  private currentServerId: string | null = null;
  private currentDMId: string | null = null;

  connect(token: string): Promise<void> {
    this.token = token;
    this.url = `${api.getWsUrl()}/api/v1/ws?token=${token}`;

    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.connecting) {
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.connecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushQueue();
          this.send(WSOpCode.IDENTIFY, { token });
          this.resubscribe();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('[WS] Failed to parse message', e);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Disconnected', event.code, event.reason);
          this.connecting = false;
          this.stopHeartbeat();
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error', error);
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        };
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  send(op: number, data: Record<string, unknown>) {
    const message: WSMessage = { op, d: data };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private handleMessage(message: WSMessage) {
    switch (message.op) {
      case WSOpCode.HEARTBEAT_ACK:
        break;
      case WSOpCode.ERROR:
        console.error('[WS] Server error', message.d);
        break;
      default:
        this.handlers.forEach(handler => {
          try {
            handler(message);
          } catch (e) {
            console.error('[WS] Handler error', e);
          }
        });
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send(WSOpCode.HEARTBEAT, {});
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      this.ws?.send(JSON.stringify(msg));
    }
  }

  private resubscribe() {
    if (this.currentChannelId) {
      this.send(WSOpCode.CHANNEL_SELECT, {
        channel_id: this.currentChannelId,
        server_id: this.currentServerId ?? '',
      });
    }
    if (this.currentDMId) {
      this.send(WSOpCode.DM_SELECT, { dm_channel_id: this.currentDMId });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect(this.token).catch(() => {});
    }, delay);
  }

  sendMessage(channelId: string, content: string, replyTo?: string) {
    this.send(WSOpCode.MESSAGE_CREATE, {
      channel_id: channelId,
      content,
      reference_message_id: replyTo,
    });
  }

  sendTyping(channelId: string) {
    this.send(WSOpCode.TYPING_START, { channel_id: channelId });
  }

  acknowledgeMessage(messageId: string, channelId: string) {
    this.send(WSOpCode.MESSAGE_ACK, { message_id: messageId, channel_id: channelId });
  }

  updateVoiceState(channelId: string | null, serverId?: string) {
    this.send(WSOpCode.VOICE_STATE_UPDATE, {
      channel_id: channelId,
      server_id: serverId ?? null,
    });
  }

  selectChannel(channelId: string, serverId: string) {
    this.currentChannelId = channelId;
    this.currentServerId = serverId;
    this.currentDMId = null;
    this.send(WSOpCode.CHANNEL_SELECT, { channel_id: channelId, server_id: serverId });
  }

  selectDM(dmChannelId: string) {
    this.currentDMId = dmChannelId;
    this.currentChannelId = null;
    this.currentServerId = null;
    this.send(WSOpCode.DM_SELECT, { dm_channel_id: dmChannelId });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const ws = new WebSocketService();
export default ws;