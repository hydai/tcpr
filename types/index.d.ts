/**
 * TypeScript type definitions for TCPR (Twitch Channel Points Monitor)
 */

// Configuration Types
export interface TwitchConfig {
  clientId: string;
  clientSecret?: string;
  accessToken: string;
  refreshToken?: string;
  broadcasterId: string;
  redirectUri?: string;
  port?: number;
}

export interface ConfigLoadOptions {
  requireClientSecret?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  missing?: string[];
  config?: TwitchConfig;
}

export interface ConfigCheckResult {
  isComplete: boolean;
  missing: string[];
  error?: string;
}

// Token Types
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  tokenType: string;
}

export interface TokenValidationData {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
}

export interface UserInfo {
  userId: string;
  login: string;
  clientId: string;
  scopes: string[];
}

// OAuth Types
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
  tokenType: string;
}

// EventSub Types
export interface SubscriptionConfig {
  type: string;
  version: string;
  condition: Record<string, string>;
}

export interface SubscriptionData {
  id: string;
  type: string;
  version: string;
  status: string;
  condition: Record<string, string>;
  transport: {
    method: string;
    session_id: string;
  };
  created_at: string;
  cost: number;
}

export interface EventSubMessage {
  metadata: {
    message_id: string;
    message_type: string;
    message_timestamp: string;
    subscription_type?: string;
    subscription_version?: string;
  };
  payload: Record<string, unknown>;
}

export interface WebSocketSession {
  id: string;
  status: string;
  keepalive_timeout_seconds: number;
  reconnect_url?: string;
  connected_at: string;
}

// Retry Types
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void | Promise<void>;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry?: (error: Error) => boolean;
}

// Error Types
export interface TokenRefreshErrorDetails {
  suggestion?: string;
  originalError?: string;
  statusCode?: number;
  data?: unknown;
}

// Logger Types
export interface LoggerInterface {
  info(message: string, data?: unknown): void;
  error(message: string, error?: Error | unknown): void;
  warn(message: string, data?: unknown): void;
  success(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
  log(message: string): void;
  divider(char?: string, length?: number): void;
  header(title: string, char?: string, length?: number): void;
}

// IPC Types (Electron)
export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionInfo {
  sessionId: string;
  path?: string;
}

export interface EventLogEntry {
  timestamp: string;
  type: 'info' | 'error' | 'warning';
  message: string;
  internal?: boolean;
}

// Filter Types
export interface FilterOptions {
  showKeepalive?: boolean;
  showRewardAdd?: boolean;
  showRewardUpdate?: boolean;
  showRedemptionAdd?: boolean;
  showRedemptionUpdate?: boolean;
}

// WebSocket Manager Types
export interface WebSocketHandlers {
  onOpen?: () => void;
  onMessage: (message: EventSubMessage) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export interface WebSocketState {
  isConnecting: boolean;
  isConnected: boolean;
  hasReconnectUrl: boolean;
  readyState: number | null;
}

// Constants
export interface TwitchUrls {
  EVENTSUB_WS: string;
  API: string;
  OAUTH_AUTHORIZE: string;
  OAUTH_TOKEN: string;
  OAUTH_VALIDATE: string;
}

export interface EventTypes {
  REWARD_ADD: string;
  REWARD_UPDATE: string;
  REDEMPTION_ADD: string;
  REDEMPTION_UPDATE: string;
}

export interface MessageTypes {
  SESSION_WELCOME: string;
  SESSION_KEEPALIVE: string;
  NOTIFICATION: string;
  SESSION_RECONNECT: string;
  REVOCATION: string;
}

export interface Timeouts {
  API_REQUEST: number;
  OAUTH_REQUEST: number;
  WEBSOCKET: number;
}

export interface TokenRefreshConfig {
  INTERVAL_MS: number;
  MAX_ATTEMPTS: number;
  INITIAL_BACKOFF_MS: number;
  MAX_CONSECUTIVE_FAILURES: number;
}
