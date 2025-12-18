# Technical Research: BDR Messaging

**Feature**: BDR Messaging — Slack-like Communication Platform
**Date**: 2025-12-18
**Status**: Complete

## Overview

This document captures technical research and decisions for implementing the messaging platform. All decisions are locked based on specification clarifications.

## 1. Real-time Messaging Architecture

### Decision: Convex Native Subscriptions

**Choice**: Use Convex's built-in reactive queries (`useQuery`) for real-time message delivery.

**Rationale**:
- Already in use for existing features (courses, progress tracking)
- Zero additional infrastructure required
- Automatic reconnection and state sync
- Optimistic updates supported natively
- Scales with Convex's managed infrastructure

**Implementation Pattern**:
```typescript
// Real-time message subscription
const messages = useQuery(api.messages.list, { channelId });

// Optimistic send with instant UI feedback
const sendMessage = useMutation(api.messages.send);
await sendMessage({ channelId, content });
```

**Alternatives Rejected**:
- WebSocket server: Additional infrastructure, complexity
- Polling: Poor UX, unnecessary load
- Pusher/Ably: External dependency, cost, not needed with Convex

## 2. Voice Message Recording

### Decision: MediaRecorder API with Format Detection

**Choice**: Use browser MediaRecorder API with runtime format detection.

**Rationale**:
- Native browser API, no external library needed
- WebM/Opus provides excellent compression and quality
- Safari requires MP4/AAC fallback (detected at runtime)
- 48kHz sample rate for voice clarity

**Implementation Pattern**:
```typescript
// Detect supported format
const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/mp4'; // Safari fallback

const mediaRecorder = new MediaRecorder(stream, {
  mimeType,
  audioBitsPerSecond: 128000,
});
```

**Constraints (from spec)**:
- Maximum duration: 5 minutes
- Minimum duration: 1 second (reject accidental recordings)
- Sample rate: 48kHz with noise reduction
- Rate limit: 20 voice messages per hour

**Alternatives Rejected**:
- RecordRTC: Extra dependency for same functionality
- Web Audio API manual encoding: Overly complex
- Server-side recording: Latency, bandwidth issues

## 3. Voice Transcription

### Decision: OpenAI Whisper API

**Choice**: OpenAI Whisper API with automatic language detection.

**Rationale**:
- Industry-leading accuracy (>95% for clear speech)
- Automatic language detection (no user selection needed)
- Cost-effective (~$0.006/minute)
- Well-documented, stable API
- Supports all common audio formats

**Implementation Pattern**:
```typescript
// convex/lib/transcription.ts
import OpenAI from 'openai';

export async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.audio.transcriptions.create({
    file: new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }),
    model: 'whisper-1',
    response_format: 'text',
  });

  return response;
}
```

**Performance Target**: <30 seconds for 1-minute audio (per SC-002)

**Clarification (from spec)**: Auto-detect language only, no manual selection, no fallback language.

**Alternatives Rejected**:
- Deepgram: Similar quality, higher cost
- AssemblyAI: Good but less documented
- Self-hosted Whisper: Infrastructure overhead, scaling complexity

## 4. Audio Visualization

### Decision: WaveSurfer.js

**Choice**: WaveSurfer.js v7 for waveform visualization and playback.

**Rationale**:
- Industry standard for web audio visualization
- Supports all required playback speeds (0.5x, 1x, 1.5x, 2x)
- Responsive waveform rendering
- Active maintenance, TypeScript support
- Small bundle size with tree-shaking

**Implementation Pattern**:
```typescript
import WaveSurfer from 'wavesurfer.js';

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(156, 163, 175)',
  progressColor: 'rgb(59, 130, 246)',
  height: 40,
  barWidth: 2,
  barGap: 1,
  cursorWidth: 0,
});

// Playback speed control
wavesurfer.setPlaybackRate(1.5);
```

**Alternatives Rejected**:
- Peaks.js: More features than needed, larger bundle
- Custom Canvas: Development time, maintenance burden
- Audio element only: No visualization

## 5. Emoji Picker

### Decision: @emoji-mart/react

**Choice**: Emoji Mart for emoji selection in reactions and messages.

**Rationale**:
- Feature-complete emoji picker
- Supports emoji search and categories
- Skin tone selection
- Recent emojis tracking
- Small bundle with data lazy loading
- React 19 compatible

**Implementation Pattern**:
```typescript
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

<Picker
  data={data}
  onEmojiSelect={(emoji) => addReaction(messageId, emoji.native)}
  theme="auto"
  previewPosition="none"
/>
```

**Note**: Custom emoji creation is out of scope for v1 (per spec).

**Alternatives Rejected**:
- emoji-picker-react: Less customizable
- Custom picker: Development overhead
- Native emoji input: Poor discoverability

## 6. Rich Text Editing

### Decision: Extend Existing Plate.js Setup

**Choice**: Use existing Plate.js editor with messaging-specific plugins.

**Rationale**:
- Already integrated in the codebase for lesson content
- Familiar patterns for the team
- Supports markdown shortcuts
- Mention plugin available
- Consistent UX across the application

**Message-Specific Configuration**:
```typescript
// Subset of plugins for message input
const messagePlugins = [
  BasicMarksPlugin,      // Bold, italic, code
  LinkPlugin,            // Clickable links
  MentionPlugin,         // @user mentions
  AutoformatPlugin,      // Markdown shortcuts
  SoftBreakPlugin,       // Shift+Enter for line breaks
];
```

**Constraints**:
- Maximum 4000 characters per message
- Link previews for URLs
- Code blocks with syntax highlighting

## 7. File Storage for Voice

### Decision: Convex Storage

**Choice**: Use Convex Storage for voice message files.

**Rationale**:
- Consistent with existing file storage patterns
- No additional service configuration
- Automatic URL generation and access control
- Integrated with Convex database transactions
- Simpler than UploadThing for audio streaming

**Implementation Pattern**:
```typescript
// Upload voice file
const storageId = await ctx.storage.store(audioBlob);
const url = await ctx.storage.getUrl(storageId);

// Store reference in message
await ctx.db.insert('voiceMessages', {
  messageId,
  storageId,
  duration,
  waveformData,
  transcription: null, // Updated async
});
```

**Note**: General file attachments (P4) may still use UploadThing for larger files.

## 8. Search Implementation

### Decision: Convex Text Search with Runtime Filtering

**Choice**: Leverage Convex's built-in text search with access control at query time.

**Rationale**:
- Native Convex feature, no external service
- Automatic indexing on insert
- Supports partial matching
- Access filtering in query logic

**Implementation Pattern**:
```typescript
// Schema with search index
messages: defineTable({
  content: v.string(),
  // ...
}).searchIndex("search_content", {
  searchField: "content",
  filterFields: ["channelId", "conversationId"],
}),

// Query with access control
export const search = query({
  args: { query: v.string(), filters: v.optional(searchFilters) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const accessibleChannels = await getUserChannels(ctx, userId);

    return ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query)
         .filter((q) => q.in("channelId", accessibleChannels))
      )
      .take(50);
  },
});
```

**Clarifications (from spec)**:
- FR-025a: Exclude messages from channels user has left
- FR-025b: Include messages from archived channels user is member of

## 9. Presence System

### Decision: Convex Document with Heartbeat

**Choice**: Store presence in Convex with periodic heartbeat updates.

**Rationale**:
- Real-time updates via Convex subscriptions
- Simple implementation using existing patterns
- Auto-away after 5 minutes of inactivity (per spec)
- Custom status message and emoji support

**Implementation Pattern**:
```typescript
// User presence (extended users table)
users: defineTable({
  // ... existing fields
  status: v.union(v.literal("online"), v.literal("away"), v.literal("offline"), v.literal("dnd")),
  customStatus: v.optional(v.string()),
  customStatusEmoji: v.optional(v.string()),
  lastActiveAt: v.number(),
}),

// Heartbeat mutation (called every 30s while active)
export const heartbeat = mutation({
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    await ctx.db.patch(userId, {
      status: "online",
      lastActiveAt: Date.now(),
    });
  },
});

// Scheduled function to mark inactive users as away
export const checkInactiveUsers = internalMutation({
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const inactiveUsers = await ctx.db
      .query("users")
      .filter((q) => q.and(
        q.eq(q.field("status"), "online"),
        q.lt(q.field("lastActiveAt"), fiveMinutesAgo)
      ))
      .collect();

    for (const user of inactiveUsers) {
      await ctx.db.patch(user._id, { status: "away" });
    }
  },
});
```

## 10. Typing Indicators

### Decision: DM-Only in v1 with Ephemeral State

**Choice**: Implement typing indicators for DMs only, using short-lived database entries.

**Rationale (from spec clarification)**:
- Typing indicators in channels can be noisy at scale
- DMs have limited participants, making it valuable
- Channel typing indicators deferred to v2

**Implementation Pattern**:
```typescript
// Typing state table (ephemeral)
typingIndicators: defineTable({
  conversationId: v.id("conversations"),
  userId: v.id("users"),
  expiresAt: v.number(), // Now + 3 seconds
}).index("by_conversation", ["conversationId"]),

// Set typing (called on keystroke, debounced client-side)
export const setTyping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await requireAuth(ctx);
    const expiresAt = Date.now() + 3000;

    // Upsert typing indicator
    const existing = await ctx.db
      .query("typingIndicators")
      .filter((q) => q.and(
        q.eq(q.field("conversationId"), conversationId),
        q.eq(q.field("userId"), userId)
      ))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { expiresAt });
    } else {
      await ctx.db.insert("typingIndicators", {
        conversationId,
        userId,
        expiresAt,
      });
    }
  },
});
```

## 11. Unread Tracking

### Decision: Hybrid Viewport Detection + Manual Mark-as-Read

**Choice**: Auto-update last-read position on viewport visibility, plus manual "mark all as read" action.

**Rationale (from spec clarification)**:
- Auto-update provides seamless UX for active viewing
- Manual action handles bulk clearing
- Position-based tracking is more accurate than timestamp

**Implementation Pattern**:
```typescript
// Channel membership with read position
channelMembers: defineTable({
  channelId: v.id("channels"),
  userId: v.id("users"),
  lastReadMessageId: v.optional(v.id("messages")),
  lastReadAt: v.number(),
  // ...
}),

// Client-side: Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const messageId = entry.target.dataset.messageId;
      markAsRead({ channelId, messageId });
    }
  });
}, { threshold: 0.5 });

// Debounced mark as read
const markAsRead = useMutation(api.channels.markAsRead);
```

## 12. Rate Limiting

### Decision: Server-Side Sliding Window

**Choice**: Implement rate limiting in Convex mutations with user-specific counters.

**Rationale**:
- Server-side enforcement prevents circumvention
- Sliding window provides fair limiting
- Clear error messages for UX

**Limits (from spec)**:
- FR-044: 30 text messages per minute
- FR-045: 20 voice messages per hour
- FR-046: 4000 character maximum

**Implementation Pattern**:
```typescript
// Rate limit helper
async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: "text" | "voice"
): Promise<void> {
  const window = type === "text" ? 60_000 : 3600_000;
  const limit = type === "text" ? 30 : 20;

  const recentCount = await ctx.db
    .query("messages")
    .withIndex("by_sender_time", (q) =>
      q.eq("senderId", userId)
       .gte("createdAt", Date.now() - window)
    )
    .filter((q) => q.eq(q.field("type"), type))
    .collect()
    .then((msgs) => msgs.length);

  if (recentCount >= limit) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: type === "text"
        ? "You can send up to 30 messages per minute. Please wait."
        : "You can send up to 20 voice messages per hour. Please wait.",
    });
  }
}
```

## 13. Message Delivery Confirmation

### Decision: Sent Indicator Only (✓)

**Choice**: Show single checkmark when message is successfully transmitted to server.

**Rationale (from spec clarification)**:
- Simpler implementation for v1
- No delivered/read receipts to avoid privacy concerns
- Clear visual feedback that message was sent

**Implementation**: Optimistic update shows message immediately, checkmark appears on mutation success.

## 14. Soft Delete and Retention

### Decision: 90-Day Anonymization with Indefinite Retention

**Choice**: Soft-delete hides messages, anonymize after 90 days, retain content indefinitely for AI.

**Rationale (from spec clarification)**:
- Admins can view soft-deleted messages for moderation
- 90-day window for GDPR/compliance
- Anonymized data retained for AI training and analytics

**Implementation Pattern**:
```typescript
messages: defineTable({
  // ...
  deletedAt: v.optional(v.number()),
  deletedBy: v.optional(v.id("users")),
  anonymizedAt: v.optional(v.number()),
  originalSenderId: v.optional(v.id("users")), // Cleared on anonymize
}),

// Scheduled job for anonymization
export const anonymizeOldMessages = internalMutation({
  handler: async (ctx) => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const toAnonymize = await ctx.db
      .query("messages")
      .filter((q) => q.and(
        q.neq(q.field("deletedAt"), undefined),
        q.lt(q.field("deletedAt"), ninetyDaysAgo),
        q.eq(q.field("anonymizedAt"), undefined)
      ))
      .take(100);

    for (const msg of toAnonymize) {
      await ctx.db.patch(msg._id, {
        originalSenderId: msg.senderId,
        senderId: null, // Or system user ID
        anonymizedAt: Date.now(),
      });
    }
  },
});
```

## Summary of Key Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| Real-time | Convex subscriptions | Already integrated, scales automatically |
| Voice format | WebM/Opus + MP4/AAC fallback | Browser compatibility, quality |
| Transcription | OpenAI Whisper | Best accuracy, auto language detection |
| Audio UI | WaveSurfer.js | Industry standard, feature complete |
| Emoji | @emoji-mart/react | Lightweight, customizable |
| Rich text | Plate.js (existing) | Consistency, familiar patterns |
| Voice storage | Convex Storage | Simpler than UploadThing for audio |
| Search | Convex text search | Native feature, integrated access control |
| Presence | Convex heartbeat | Real-time via subscriptions |
| Typing | DMs only, ephemeral docs | Per spec, reduces noise |
| Unread | Viewport + manual | Best UX, accurate tracking |
| Rate limits | Server-side sliding window | Secure, fair |
| Delivery | Sent indicator only | Simple, clear |
| Retention | 90d anonymize, keep forever | GDPR + AI training |
