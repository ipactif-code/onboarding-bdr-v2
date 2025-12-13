"use client";

import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

interface EmbedViewerProps {
  url: string;
  provider: "youtube" | "vimeo" | "loom" | "figma" | "other";
  title?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract Vimeo video ID from URL
 * Supports: vimeo.com/123456789, player.vimeo.com/video/123456789
 */
function extractVimeoId(url: string): string | null {
  const match = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  return match?.[1] || null;
}

/**
 * Extract Loom video ID from URL
 * Supports: loom.com/share/abc123, loom.com/embed/abc123
 */
function extractLoomId(url: string): string | null {
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  return match?.[1] || null;
}

export function EmbedViewer({ url, provider, title = "Embedded content" }: EmbedViewerProps) {
  switch (provider) {
    case "youtube": {
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return <EmbedError message="Invalid YouTube URL" url={url} />;
      }
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <LiteYouTubeEmbed
            id={videoId}
            title={title}
            poster="hqdefault"
            webp
          />
        </div>
      );
    }

    case "vimeo": {
      const videoId = extractVimeoId(url);
      if (!videoId) {
        return <EmbedError message="Invalid Vimeo URL" url={url} />;
      }
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://player.vimeo.com/video/${videoId}?h=0&title=0&byline=0&portrait=0`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={title}
          />
        </div>
      );
    }

    case "loom": {
      const videoId = extractLoomId(url);
      if (!videoId) {
        return <EmbedError message="Invalid Loom URL" url={url} />;
      }
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={`https://www.loom.com/embed/${videoId}`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={title}
          />
        </div>
      );
    }

    case "figma": {
      // Figma embeds use the full URL encoded
      const encodedUrl = encodeURIComponent(url);
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={`https://www.figma.com/embed?embed_host=share&url=${encodedUrl}`}
            className="h-full w-full"
            allow="fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={title}
          />
        </div>
      );
    }

    case "other":
    default: {
      // Generic iframe for other providers
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg border">
          <iframe
            src={url}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={title}
          />
        </div>
      );
    }
  }
}

function EmbedError({ message, url }: { message: string; url: string }) {
  return (
    <div className="aspect-video w-full rounded-lg border border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center p-6">
      <p className="text-destructive font-medium">{message}</p>
      <p className="text-sm text-muted-foreground mt-2 break-all max-w-md text-center">
        {url}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-sm text-primary hover:underline"
      >
        Open in new tab →
      </a>
    </div>
  );
}
