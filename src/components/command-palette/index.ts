/**
 * Command Palette module exports.
 *
 * Provides a Raycast/Linear-style command palette for searching
 * channels and messages with keyboard shortcuts (Ctrl+K / Cmd+K).
 *
 * Usage:
 * 1. Add CommandPaletteProvider to your app layout
 * 2. Use Ctrl+K / Cmd+K to open the palette
 * 3. Use useCommandPalette() hook to control programmatically
 */

export { CommandPalette } from "./command-palette";
export {
  CommandPaletteProvider,
  useCommandPalette,
} from "./command-palette-provider";
