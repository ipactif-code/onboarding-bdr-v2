# Quickstart Guide: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09

## Prerequisites

Before implementing this feature, ensure:

- [ ] Spec 004 (Sessions) is deployed - provides `trainingSessions` table
- [ ] Spec 009 (Scoring) is deployed - provides `sessionScores`, `scoreFeedback`, `keyMoments`
- [ ] Spec 010 (Certification) is deployed - provides `bdrCertifications`
- [ ] Anthropic API key configured in Convex environment
- [ ] User language preference available in users table

## Environment Setup

### 1. Add Anthropic API Key

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

### 2. Verify Dependencies

```bash
pnpm add @anthropic-ai/sdk
```

## Implementation Order

### Phase 1: Data Layer

1. **Add schema tables** (`convex/schema.ts`)
   - `coachConversations`
   - `coachMessages`
   - `trainingPlans`
   - `weeklyCheckins`

2. **Run Convex push**
   ```bash
   npx convex push
   ```

### Phase 2: Core Queries & Mutations

1. **Create coach directory**
   ```
   convex/coach/
   ├── queries.ts
   ├── mutations.ts
   ├── actions.ts
   ├── scheduled.ts
   └── lib/
       ├── prompts.ts
       ├── helpers.ts
       └── types.ts
   ```

2. **Implement in order**:
   - Internal queries (getCoachingContext)
   - Public queries (getActiveConversation, getConversationMessages)
   - Mutations (startConversation, sendMessage, endConversation)
   - Internal mutations (storeCoachMessage, createWeeklyCheckin)
   - Actions (generateResponse)

### Phase 3: Scheduled Functions

1. **Add cron jobs** (`convex/crons.ts`)
   - Weekly check-in trigger
   - Conversation cleanup
   - Expiration warnings

### Phase 4: UI Components

1. **Coach Chat Interface**
   ```
   src/components/coach/
   ├── coach-chat.tsx          # Main chat container
   ├── message-list.tsx        # Message display
   ├── message-input.tsx       # User input
   ├── coach-header.tsx        # Mode indicator
   └── transcript-reference.tsx # Debrief excerpts
   ```

2. **Training Plan Components**
   ```
   src/components/coach/
   ├── training-plan-card.tsx
   ├── week-progress.tsx
   └── plan-generation-dialog.tsx
   ```

3. **Integration Points**
   ```
   src/app/(dashboard)/
   ├── coach/page.tsx          # Main coach page
   ├── sessions/[id]/
   │   └── debrief-button.tsx  # Post-session entry point
   └── components/
       └── coach-fab.tsx       # Floating "Ask Coach" button
   ```

## Quick Validation

### Test Conversation Flow

```typescript
// In browser console or test file
const { startConversation, sendMessage, getConversationMessages } =
  await import("convex/coach/mutations");

// 1. Start a conversation
const { conversationId } = await mutation(startConversation, {
  type: "ask_coach"
});

// 2. Send a message
await mutation(sendMessage, {
  conversationId,
  content: "How do I improve my SPIN questions?"
});

// 3. Check for coach response (after ~3-5 seconds)
const messages = await query(getConversationMessages, { conversationId });
console.log(messages);
```

### Test Training Plan Generation

```typescript
// Requires user with >= 5 sessions
const { planId, conversationId } = await mutation(generatePlan, {});
console.log("Plan created:", planId);

// Check plan content (after ~10-15 seconds)
const plan = await query(getActivePlan, {});
console.log(plan.skillGaps, plan.weeks);
```

## Key Files Reference

| Purpose | File |
|---------|------|
| **Schema** | `convex/schema.ts` |
| **Queries** | `convex/coach/queries.ts` |
| **Mutations** | `convex/coach/mutations.ts` |
| **AI Actions** | `convex/coach/actions.ts` |
| **Cron Jobs** | `convex/crons.ts` |
| **System Prompts** | `convex/coach/lib/prompts.ts` |
| **Chat UI** | `src/components/coach/coach-chat.tsx` |
| **Coach Page** | `src/app/(dashboard)/coach/page.tsx` |

## Configuration Constants

```typescript
// convex/coach/lib/config.ts

export const COACH_CONFIG = {
  // AI Model
  model: "claude-3-haiku-20240307",
  maxInputTokens: 2000,
  maxOutputTokens: 500,
  temperature: 0.5,

  // Conversation Limits
  limits: {
    debrief: 10,
    weekly_checkin: 5,
    ask_coach: 20,
    training_plan: 1,
  },

  // Rate Limits
  dailyInteractionLimit: 30,
  monthlyPlanGenerationLimit: 5,

  // Data Retention
  conversationRetentionDays: 90,
  expirationWarningDays: 7,

  // Supported Languages
  languages: ["fr", "en", "it", "es", "de"] as const,
};
```

## Common Patterns

### Authentication Check

```typescript
// Every public query/mutation starts with:
const identity = await requireAuth(ctx);
```

### Ownership Validation

```typescript
const conversation = await ctx.db.get(args.conversationId);
if (!conversation || conversation.userId !== identity.userId) {
  throw new Error("Conversation not found");
}
```

### Rate Limit Check

```typescript
const todayStart = getStartOfDay(Date.now());
const todayMessages = await countUserMessages(ctx, identity.userId, todayStart);
if (todayMessages >= COACH_CONFIG.dailyInteractionLimit) {
  throw new Error("Daily interaction limit reached");
}
```

### Language Detection

```typescript
const user = await ctx.db.get(identity.userId);
const language = user?.preferredLang ?? "en";
```

## Testing Checklist

- [ ] Start conversation (all 4 types)
- [ ] Send message and receive AI response
- [ ] Verify conversation limits enforced
- [ ] Test rate limits (30/day)
- [ ] Generate training plan (with 5+ sessions)
- [ ] Verify plan generation limits (5/month)
- [ ] Create weekly check-in (manually trigger)
- [ ] Test conversation expiration (modify expiresAt)
- [ ] Verify BDR can only see own conversations
- [ ] Test in all 5 languages

## Troubleshooting

### AI Response Not Appearing

1. Check Anthropic API key is set: `npx convex env get ANTHROPIC_API_KEY`
2. Check Convex logs for action errors
3. Verify conversation is still "active"

### Weekly Check-In Not Triggering

1. Verify cron job is registered in Convex dashboard
2. Check if user has sessions from previous week
3. Verify it's Monday between 8-10 AM UTC

### Training Plan Empty

1. Check user has >= 5 completed sessions
2. Verify session scores exist (Spec 009)
3. Check action logs for AI generation errors

## Next Steps After Implementation

1. **Add E2E tests** for conversation flows
2. **Configure monitoring** for AI API costs
3. **Add analytics events** for coach engagement
4. **Implement push notifications** for weekly check-ins (optional)
