/**
 * Knowledge Base Library
 *
 * This module exports all configuration and utilities for the Knowledge Base
 * collaborative editor feature.
 *
 * @module lib/knowledge
 */

// Plate.js editor configuration
export {
  // Types
  type KnowledgeEditorPluginConfig,
  type PluginKitName,
  // Constants
  DEFAULT_EDITOR_VALUE,
  DEFAULT_PLUGIN_CONFIG,
  PLUGIN_KITS,
  // Functions
  createDefaultPlugins,
  createReadOnlyPlugins,
  createEditorValue,
  isEditorValueEmpty,
} from './plate-config';

// Hocuspocus collaboration configuration
export {
  // Types
  type HocuspocusProviderConfig,
  type YjsConfig,
  type CursorData,
  type YjsProviderOptions,
  type ConnectionState,
  // Constants
  HOCUSPOCUS_DEFAULTS,
  YJS_SHARED_ROOT_KEY,
  // Functions
  getHocuspocusUrl,
  generateCursorColor,
  generateCursorData,
  createHocuspocusProvider,
  createYjsProviderOptions,
  createYjsConfig,
  getConnectionState,
} from './hocuspocus-config';
