# Quickstart Guide: BDR Messaging

**Feature**: BDR Messaging — Slack-like Communication Platform
**Date**: 2025-12-18

## Overview

This guide covers the setup and development workflow for implementing the BDR Messaging feature.

## Prerequisites

Ensure you have the following installed:
- Node.js 18.x or later
- npm 9.x or later
- Git

Existing project setup should already have:
- Convex CLI configured (`npx convex dev` working)
- Clerk authentication configured
- UploadThing configured (for file attachments)

## Environment Variables

Add the following to your `.env.local`:

```bash
# OpenAI API (for voice transcription)
OPENAI_API_KEY=sk-...

# Existing variables should already be set:
# CONVEX_DEPLOYMENT=...
# NEXT_PUBLIC_CONVEX_URL=...
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
# CLERK_SECRET_KEY=...
```

## Dependencies

Install new dependencies:

```bash
npm install @emoji-mart/data @emoji-mart/react wavesurfer.js openai
```

## Development Workflow

### 1. Start Development Servers

```bash
# Terminal 1: Start Convex backend
npx convex dev

# Terminal 2: Start Next.js frontend
npm run dev
```

### 2. Schema Deployment

After updating `convex/schema.ts` with new messaging tables:

```bash
npx convex deploy
```

### 3. Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck
```

## Project Structure

```
convex/
├── channels.ts          # Channel CRUD, membership
├── directMessages.ts    # DM conversations
├── messages.ts          # Message handling
├── voice.ts             # Voice message + transcription
├── search.ts            # Full-text search
├── presence.ts          # User status
└── lib/
    ├── permissions.ts   # Channel access checks
    └── transcription.ts # Whisper API wrapper

src/
├── app/(dashboard)/messages/
│   ├── page.tsx         # Main messaging view
│   └── [channelId]/     # Channel view
├── components/messaging/
│   ├── channel-list.tsx
│   ├── message-list.tsx
│   ├── message-input.tsx
│   ├── voice-recorder.tsx
│   └── ...
└── hooks/
    ├── use-messages.ts
    ├── use-presence.ts
    └── ...
```

## Key Implementation Notes

### Real-time Messages

Use Convex's reactive queries for real-time updates:

```typescript
// Component subscribes to messages automatically
const messages = useQuery(api.messages.listForChannel, { channelId });

// Mutations trigger re-renders
const sendMessage = useMutation(api.messages.sendToChannel);
```

### Voice Recording

Detect browser support and select appropriate format:

```typescript
const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'
  : 'audio/mp4'; // Safari fallback
```

### Presence Heartbeat

Implement presence tracking in a provider:

```typescript
// In PresenceProvider
useEffect(() => {
  heartbeat();
  const interval = setInterval(heartbeat, 30000);
  return () => clearInterval(interval);
}, []);
```

### Unread Tracking

Use Intersection Observer for viewport detection:

```typescript
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      markAsRead({ messageId: entry.target.dataset.messageId });
    }
  });
}, { threshold: 0.5 });
```

## Testing Voice Transcription

1. Record a voice message in the UI
2. Wait for transcription (should complete within 30s for 1-min audio)
3. Verify transcription appears below the audio player
4. Test edit functionality for corrections

## Troubleshooting

### Convex Connection Issues

```bash
# Reset Convex connection
npx convex dev --once

# Check deployment status
npx convex dashboard
```

### Audio Recording Not Working

- Check browser permissions for microphone
- Verify HTTPS (required for MediaRecorder)
- Test in Chrome first (best MediaRecorder support)

### Transcription Failures

- Verify `OPENAI_API_KEY` is set correctly
- Check Convex logs for API errors
- Ensure audio file is under 25MB (Whisper limit)

## Rate Limits

During development, be aware of rate limits:
- Text messages: 30/minute per user
- Voice messages: 20/hour per user
- Message length: 4000 characters max

## Next Steps

1. Review `plan.md` for implementation phases
2. Review `data-model.md` for schema details
3. Review `contracts/` for API signatures
4. Run `/speckit.tasks` to generate task breakdown
