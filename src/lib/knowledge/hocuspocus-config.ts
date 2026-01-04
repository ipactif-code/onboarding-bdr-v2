/**
 * Hocuspocus Client Configuration for Knowledge Base
 *
 * This module provides configuration and factory functions for creating
 * Hocuspocus providers for real-time collaborative editing via YJS.
 *
 * @module lib/knowledge/hocuspocus-config
 */

import { HocuspocusProvider } from '@hocuspocus/provider';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/**
 * Configuration options for creating a Hocuspocus provider.
 */
export interface HocuspocusProviderConfig {
  /** The WebSocket URL for the Hocuspocus server */
  url: string;
  /** The document name/ID to connect to */
  documentName: string;
  /** Authentication token for the connection */
  token: string;
  /** Optional callback when connection is established */
  onConnect?: () => void;
  /** Optional callback when connection is closed */
  onDisconnect?: () => void;
  /** Optional callback for sync status changes */
  onSynced?: (synced: boolean) => void;
  /** Optional callback for authentication errors */
  onAuthenticationFailed?: (reason: string) => void;
  /** Optional callback for general errors */
  onError?: (error: Error) => void;
}

/**
 * Configuration for YJS collaboration in the editor.
 */
export interface YjsConfig {
  /** The Hocuspocus provider instance */
  provider: HocuspocusProvider;
  /** Cursor display data for this user */
  cursorData: CursorData;
}

/**
 * Cursor appearance data for collaborative editing.
 */
export interface CursorData {
  /** The user's display name shown on the cursor */
  name: string;
  /** The HSL color for the cursor */
  color: string;
}

/**
 * Minimal provider configuration required for YJS plugin.
 */
export interface YjsProviderOptions {
  /** Provider type (always 'hocuspocus' for this config) */
  type: 'hocuspocus';
  /** WebSocket URL */
  url: string;
  /** Document name */
  name: string;
}

// --------------------------------------------------------------------------
// Environment Configuration
// --------------------------------------------------------------------------

/**
 * Get the Hocuspocus WebSocket URL from environment variables.
 * Falls back to a default local development URL.
 *
 * @returns The Hocuspocus server WebSocket URL
 */
export function getHocuspocusUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side rendering - return placeholder
    return '';
  }

  return (
    process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ??
    process.env.HOCUSPOCUS_URL ??
    'ws://localhost:4444/yjs'
  );
}

// --------------------------------------------------------------------------
// Cursor Color Generation
// --------------------------------------------------------------------------

/**
 * Generates a consistent HSL cursor color based on a username or user ID.
 *
 * This function creates a deterministic color by hashing the input string,
 * ensuring that the same user always gets the same color across sessions.
 * The color uses fixed saturation and lightness for good visibility.
 *
 * @param identifier - The username, email, or user ID to generate color from
 * @returns An HSL color string (e.g., "hsl(240, 70%, 50%)")
 *
 * @example
 * ```typescript
 * const color = generateCursorColor('john.doe@example.com');
 * // Returns something like "hsl(127, 70%, 50%)"
 * ```
 */
export function generateCursorColor(identifier: string): string {
  if (!identifier || identifier.trim() === '') {
    // Default to a neutral blue for empty identifiers
    return 'hsl(210, 70%, 50%)';
  }

  // Simple hash function to generate a number from a string
  const hash = identifier
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Map to hue (0-360) using modulo
  const hue = hash % 360;

  // Fixed saturation and lightness for consistent visibility
  // 70% saturation provides vibrant but not overwhelming colors
  // 50% lightness ensures good contrast in both light and dark modes
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Generates cursor data for a user in collaborative editing.
 *
 * @param name - The display name for the cursor
 * @param identifier - The identifier to generate color from (defaults to name)
 * @returns CursorData object with name and color
 */
export function generateCursorData(
  name: string,
  identifier?: string
): CursorData {
  return {
    name: name || 'Anonymous',
    color: generateCursorColor(identifier ?? name),
  };
}

// --------------------------------------------------------------------------
// Provider Factory
// --------------------------------------------------------------------------

/**
 * Creates a Hocuspocus provider for collaborative document editing.
 *
 * This factory function creates a configured HocuspocusProvider instance
 * that can be used with Plate.js YJS plugin for real-time collaboration.
 *
 * @param documentId - The unique identifier for the document
 * @param token - Authentication token for the connection
 * @param options - Optional configuration overrides
 * @returns A configured HocuspocusProvider instance
 *
 * @example
 * ```typescript
 * const provider = createHocuspocusProvider(
 *   'doc_123',
 *   'user_auth_token',
 *   {
 *     onConnect: () => console.log('Connected!'),
 *     onAuthenticationFailed: (reason) => console.error('Auth failed:', reason),
 *   }
 * );
 * ```
 */
export function createHocuspocusProvider(
  documentId: string,
  token: string,
  options?: Partial<HocuspocusProviderConfig>
): HocuspocusProvider {
  const url = options?.url ?? getHocuspocusUrl();

  if (!url) {
    throw new Error(
      'Hocuspocus URL not configured. Set NEXT_PUBLIC_HOCUSPOCUS_URL environment variable.'
    );
  }

  return new HocuspocusProvider({
    url,
    name: documentId,
    token,
    // Connection event handlers
    onConnect: options?.onConnect,
    onClose: () => options?.onDisconnect?.(),
    onSynced: ({ state }) => options?.onSynced?.(state),
    onAuthenticationFailed: ({ reason }) =>
      options?.onAuthenticationFailed?.(reason),
  });
}

// --------------------------------------------------------------------------
// YJS Plugin Configuration Helpers
// --------------------------------------------------------------------------

/**
 * Creates YJS provider options for the Plate.js YJS plugin.
 *
 * This is a simpler configuration method that returns options compatible
 * with the YjsPlugin.configure() method.
 *
 * @param documentId - The document identifier
 * @param url - Optional custom Hocuspocus URL
 * @returns YjsProviderOptions for plugin configuration
 *
 * @example
 * ```typescript
 * YjsPlugin.configure({
 *   options: {
 *     providers: [createYjsProviderOptions('doc_123')],
 *     cursors: { data: cursorData },
 *   },
 * })
 * ```
 */
export function createYjsProviderOptions(
  documentId: string,
  url?: string
): YjsProviderOptions {
  return {
    type: 'hocuspocus' as const,
    url: url ?? getHocuspocusUrl(),
    name: documentId,
  };
}

/**
 * Creates a complete YJS configuration for the editor.
 *
 * This is a convenience function that assembles all YJS configuration
 * including provider and cursor settings.
 *
 * @param documentId - The document identifier
 * @param user - User information for cursor display
 * @param user.name - Display name for the cursor
 * @param user.identifier - Identifier for color generation (usually email or ID)
 * @param token - Authentication token
 * @param callbacks - Optional callbacks for connection events
 * @returns Complete YjsConfig object
 *
 * @example
 * ```typescript
 * const yjsConfig = createYjsConfig(
 *   'doc_123',
 *   { name: 'John Doe', identifier: 'john@example.com' },
 *   'auth_token',
 *   { onSynced: (synced) => setIsSynced(synced) }
 * );
 *
 * YjsPlugin.configure({
 *   options: {
 *     provider: yjsConfig.provider,
 *     cursors: { data: yjsConfig.cursorData },
 *   },
 * })
 * ```
 */
export function createYjsConfig(
  documentId: string,
  user: { name: string; identifier?: string },
  token: string,
  callbacks?: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onSynced?: (synced: boolean) => void;
    onAuthenticationFailed?: (reason: string) => void;
  }
): YjsConfig {
  return {
    provider: createHocuspocusProvider(documentId, token, callbacks),
    cursorData: generateCursorData(user.name, user.identifier),
  };
}

// --------------------------------------------------------------------------
// Connection State Utilities
// --------------------------------------------------------------------------

/**
 * Possible connection states for the Hocuspocus provider.
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'syncing'
  | 'synced';

/**
 * Determines the connection state from provider status.
 *
 * @param isConnected - Whether the WebSocket is connected
 * @param isSynced - Whether the document is synced
 * @returns The current connection state
 */
export function getConnectionState(
  isConnected: boolean,
  isSynced: boolean
): ConnectionState {
  if (!isConnected) {
    return 'disconnected';
  }
  if (!isSynced) {
    return 'syncing';
  }
  return 'synced';
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

/**
 * Default Hocuspocus connection settings.
 */
export const HOCUSPOCUS_DEFAULTS = {
  /** Initial reconnection delay in milliseconds */
  INITIAL_DELAY: 1000,
  /** Maximum reconnection delay in milliseconds */
  MAX_DELAY: 30000,
  /** Delay multiplier for exponential backoff */
  BACKOFF_FACTOR: 2,
  /** Maximum number of reconnection attempts */
  MAX_ATTEMPTS: 10,
  /** Debounce time for document saves in milliseconds */
  SAVE_DEBOUNCE: 2000,
} as const;

/**
 * YJS shared document key for editor content.
 * This is the key used to access the shared XML text in the Y.Doc.
 */
export const YJS_SHARED_ROOT_KEY = 'content';
