# Research: AI Coach Module (M7)

**Feature**: 011-ai-coach
**Date**: 2026-01-09
**Status**: Complete

## 1. Technology Decisions

### 1.1 LLM Model Selection

**Decision**: Claude 3.5 Haiku for coaching conversations

**Rationale**:
- Cost target: <$0.05 per interaction
- Claude Haiku pricing: ~$0.25/MTok input, $1.25/MTok output
- Typical coaching interaction: ~1500 input tokens (context), ~200 output tokens
- Cost per interaction: ~$0.0004 input + $0.00025 output = ~$0.0006
- Provides significant headroom below $0.05 target
- Good quality for conversational coaching (not complex analysis)
- Sonnet reserved for Spec 009 scoring (more complex evaluation)

**Alternatives Considered**:
- Claude 3.5 Sonnet: Better quality but ~10x more expensive, overkill for coaching
- GPT-4o-mini: Similar cost, but Constitution mandates Claude for DiliTrust stack

### 1.2 Streaming Architecture

**Decision**: Convex Actions with streaming HTTP responses

**Rationale**:
- NFR-001 requires <5 second response time
- Streaming starts delivering tokens within 500ms
- User perceives immediate response even if full generation takes 3-4s
- Convex Actions allow external API calls (Anthropic API)

**Implementation Pattern**:
```typescript
// convex/actions/coach.ts
export const streamCoachResponse = action({
  args: { conversationId: v.id("coachConversations"), userMessage: v.string() },
  handler: async (ctx, args) => {
    // 1. Build context from recent sessions
    // 2. Call Claude API with streaming
    // 3. Store final response as coachMessage
    // 4. Return streamable response to client
  }
});
```

### 1.3 Real-Time Subscriptions

**Decision**: Convex subscriptions for conversation updates

**Rationale**:
- Messages appear in real-time without polling
- Typing indicators update instantly
- Conversation state syncs across devices
- Built into Convex (no additional infrastructure)

## 2. Integration Points

### 2.1 Session Data (Spec 004)

**Integration**:
- `trainingSessions` table provides session history
- `sessionTranscripts` provides transcript content for debrief
- Coach reads last 10 sessions for context

**Query Pattern**:
```typescript
// Get BDR's recent sessions
const sessions = await ctx.db
  .query("trainingSessions")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .order("desc")
  .take(10);
```

### 2.2 Scoring Data (Spec 009)

**Integration**:
- `sessionScores` table provides overall and dimension scores
- `scoreFeedback` provides strength/weakness analysis
- `keyMoments` provides specific transcript highlights

**Data Shape Used**:
```typescript
interface SessionScore {
  sessionId: Id<"trainingSessions">;
  overallScore: number;
  spinScore: number;
  medddicScore: number;
  bantScore: number;
  raccScore: number;
  behavioralScore: number;
  adaptiveScore: number;
  strengths: string[];
  improvements: string[];
}
```

### 2.3 Certification Data (Spec 010)

**Integration**:
- `bdrCertifications` provides current certification level
- `certificationLevels` provides level requirements
- Used to adjust coaching tone and encouragement

**Coaching Adjustments by Level**:
- Bronze: Foundational encouragement, basic technique focus
- Silver: More nuanced feedback, methodology depth
- Gold: Advanced refinement, edge case handling
- Platinum: Expert-level strategic coaching

## 3. Data Retention Strategy

### 3.1 90-Day Conversation Retention

**Decision**: Auto-delete conversations after 90 days

**Rationale**:
- GDPR compliance (data minimization)
- Storage cost control
- Conversations become less relevant over time
- BDRs can still see overall progress trends

**Implementation**:
- `expiresAt` field on `coachConversations`
- Scheduled function runs daily to clean expired conversations
- Warning notification 7 days before deletion (if unviewed)

### 3.2 Training Plan Retention

**Decision**: Plans retained while active, archived on completion/abandonment

**Rationale**:
- Plans have longer relevance (multi-week)
- Historical plans inform future recommendations
- No auto-deletion (BDR can manually delete)

## 4. Multilingual Implementation

### 4.1 Template-Based Messages

**Decision**: Pre-defined templates for consistent localization

**Rationale**:
- 5 languages (FR, EN, IT, ES, DE) from day 1
- Templates ensure quality across languages
- AI generates free-text in BDR's language

**Template Categories**:
1. Greetings (debrief, check-in, ask-coach)
2. Strength Recognition (SPIN, RACC, listening)
3. Improvement Suggestions (methodology-specific)
4. Weekly Progress (sessions, scores, trends)
5. Training Plan (intro, gaps, recommendations)
6. Encouragement (certification, persona unlocks)
7. Closing (session-specific, weekly, general)

### 4.2 Dynamic Content Generation

**Decision**: Claude generates personalized content in BDR's language

**Implementation**:
- System prompt includes language instruction
- Templates injected as examples
- Free-text response follows language/tone guidelines

## 5. Cost Control Mechanisms

### 5.1 Token Limits

**Configuration**:
```typescript
const COACH_COST_CONFIG = {
  model: "claude-3-haiku-20240307",
  maxInputTokens: 2000,   // Context from sessions
  maxOutputTokens: 500,    // Short, focused responses
  temperature: 0.5,        // Balance creativity/consistency
};
```

### 5.2 Context Window Management

**Strategy**:
- Last 10 sessions summary (not full transcripts)
- Current conversation history (last 5 messages)
- Relevant key moments only
- Compact JSON format for session data

### 5.3 Rate Limiting

**Limits**:
- 30 coach interactions per BDR per day
- 5 training plan generations per BDR per month
- Prevents cost runaway from heavy users

## 6. Weekly Check-In Scheduling

### 6.1 Trigger Logic

**Decision**: Monday 9 AM in BDR's local timezone

**Implementation**:
- Store timezone preference from LMS profile
- Scheduled function runs hourly
- Checks: (current_time >= Monday 9 AM local) AND (no check-in this week)
- Creates notification record, marks pending

### 6.2 Notification System

**Integration**:
- Uses existing LMS notification infrastructure
- In-app badge + optional push (if enabled)
- Can be dismissed without engagement

## 7. Privacy Architecture

### 7.1 Data Isolation

**Constraints**:
- BDR sees only own coaching conversations
- Team Leads CANNOT see coaching conversations (private)
- Transcripts used for coaching context only (not stored in coach tables)

### 7.2 Query Authorization

**Pattern**:
```typescript
// Every coach query starts with auth check
const identity = await requireAuth(ctx);

// Verify ownership
const conversation = await ctx.db.get(args.conversationId);
if (conversation.userId !== identity.userId) {
  throw new Error("Unauthorized access to coaching conversation");
}
```

## 8. Error Handling

### 8.1 AI Service Unavailable

**Strategy**:
1. Retry with exponential backoff (3 attempts)
2. If failed: Show "Coach temporarily unavailable" message
3. Queue for retry when service recovers
4. No partial messages saved

### 8.2 Session Data Missing

**Strategy**:
- Check transcript availability before debrief
- If missing: Coach provides general guidance
- Log incident for ops investigation

## 9. Performance Considerations

### 9.1 Cold Start Optimization

**Challenge**: First message may have higher latency (context building)

**Mitigation**:
- Pre-warm context on conversation start
- Cache recent session summaries
- Use Convex's query caching

### 9.2 Conversation Message Loading

**Strategy**:
- Load messages on demand (not full history)
- Recent 20 messages initially
- Lazy load older messages on scroll

## 10. System Prompt Design

### 10.1 Persona Definition

```text
Tu es Alex, un coach de vente senior chez DiliTrust.

PERSONNALITÉ:
- Ton: Encourageant mais direct, comme un mentor expérimenté
- Style: Tu poses des questions pour guider la réflexion, tu ne fais pas la leçon
- Approche: Toujours spécifique (cite des moments précis), jamais générique

RÈGLES:
1. Commence toujours par quelque chose de positif
2. Sois spécifique (cite des moments, des chiffres)
3. Limite-toi à 2-3 points d'amélioration max par échange
4. Pose des questions pour engager la réflexion
5. Termine par une action concrète
6. Réponds UNIQUEMENT dans la langue: {language}
```

### 10.2 Context Injection

**Template Variables**:
- `{bdr_name}`: BDR's display name
- `{certification_level}`: Current level (Bronze/Silver/Gold/Platinum)
- `{recent_sessions_count}`: Number of sessions in context
- `{average_score}`: Average score across sessions
- `{strengths}`: Top 2-3 identified strengths
- `{weaknesses}`: Top 2-3 improvement areas
- `{language}`: Response language code

### 10.3 Session Context (for Debrief)

**Additional Variables**:
- `{session_score}`: This session's overall score
- `{persona_name}`: Prospect persona used
- `{scenario_name}`: Scenario type
- `{key_moments}`: 3-5 notable transcript excerpts
- `{metrics}`: Behavioral metrics (talk ratio, pace, etc.)
