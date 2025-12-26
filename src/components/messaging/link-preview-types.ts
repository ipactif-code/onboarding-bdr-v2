// ============================================================================
// Shared Types for Link Preview Components
// ============================================================================

/**
 * Metadata fetched from a URL for link preview.
 */
export interface LinkMetadata {
  /** The URL that was fetched */
  url: string;
  /** Page title from Open Graph or <title> tag */
  title?: string;
  /** Page description from Open Graph or meta description */
  description?: string;
  /** Thumbnail image URL from Open Graph */
  imageUrl?: string;
  /** Site name from Open Graph */
  siteName?: string;
  /** Favicon URL */
  faviconUrl?: string;
}
