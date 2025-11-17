/**
 * WebSocket connection manager for Twitch EventSub
 */

import WebSocket from 'ws';
import { Logger } from '../lib/logger.js';
import { WebSocketError } from '../lib/errors.js';
import { TWITCH_URLS } from '../config/constants.js';

/**
 * WebSocket event handlers
 * @typedef {Object} WebSocketHandlers
 * @property {Function} [onOpen] - Called when connection opens
 * @property {Function} onMessage - Called when message is received
 * @property {Function} [onError] - Called when error occurs
 * @property {Function} [onClose] - Called when connection closes
 */

/**
 * Manages WebSocket connections to Twitch EventSub
 */
export class WebSocketManager {
  /**
   * Create a new WebSocketManager
   * @param {WebSocketHandlers} handlers - Event handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.ws = null;
    this.reconnectUrl = null;
    this.isConnecting = false;
    this.isConnected = false;
  }

  /**
   * Connect to EventSub WebSocket
   * @param {string} [url] - Custom URL to connect to (defaults to EventSub URL)
   * @returns {Promise<void>}
   */
  async connect(url = null) {
    if (this.isConnecting) {
      Logger.warn('Connection already in progress');
      return;
    }

    if (this.isConnected) {
      Logger.warn('Already connected');
      return;
    }

    const wsUrl = url || this.reconnectUrl || TWITCH_URLS.EVENTSUB_WS;
    Logger.info(`Connecting to ${wsUrl}...`);

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.isConnecting = false;
          this.isConnected = true;
          Logger.info('WebSocket connection established');

          if (this.handlers.onOpen) {
            this.handlers.onOpen();
          }

          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handlers.onMessage(message);
          } catch (error) {
            Logger.error('Failed to parse WebSocket message:', error);
          }
        });

        this.ws.on('error', (error) => {
          this.isConnecting = false;
          Logger.error('WebSocket error:', error);

          if (this.handlers.onError) {
            this.handlers.onError(new WebSocketError('WebSocket connection error', error));
          }

          reject(new WebSocketError('WebSocket connection error', error));
        });

        this.ws.on('close', () => {
          this.isConnecting = false;
          this.isConnected = false;
          Logger.info('WebSocket connection closed');

          if (this.handlers.onClose) {
            this.handlers.onClose();
          }
        });
      } catch (error) {
        this.isConnecting = false;
        reject(new WebSocketError('Failed to create WebSocket connection', error));
      }
    });
  }

  /**
   * Reconnect to a new WebSocket URL
   * @param {string} url - Reconnect URL from EventSub
   * @returns {Promise<void>}
   */
  async reconnect(url) {
    Logger.info('Reconnect requested');
    this.reconnectUrl = url;
    Logger.info(`New reconnect URL: ${url}`);

    // Close current connection
    this.disconnect();

    // Reconnect will be handled by onClose handler
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message through WebSocket
   * @param {Object} message - Message to send
   * @throws {WebSocketError} If not connected
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      throw new WebSocketError('Cannot send message: Not connected');
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      throw new WebSocketError('Failed to send message', error);
    }
  }

  /**
   * Get current connection state
   * @returns {Object} Connection state
   */
  getState() {
    return {
      isConnecting: this.isConnecting,
      isConnected: this.isConnected,
      hasReconnectUrl: !!this.reconnectUrl,
      readyState: this.ws ? this.ws.readyState : null
    };
  }

  /**
   * Check if WebSocket is ready
   * @returns {boolean} True if ready to send messages
   */
  isReady() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
