# Research: Praiz Video Processing Pipeline

**Feature**: 008-praiz-pipeline
**Date**: 2026-01-08

## Research Topics

This document consolidates research findings for the Praiz Video Processing Pipeline implementation.

---

## 1. Praiz API Integration

### Decision: Use Praiz REST API with OAuth 2.0

**Rationale**: Praiz provides a documented REST API for accessing call recordings, transcripts, and metadata. The API supports:
- List recordings by date range
- Get transcript (if available) or download video URL
- Metadata including deal outcome, language, participants

**Alternatives Considered**:
- Direct video download + re-transcription (rejected: extra cost, latency, already have transcripts)
- Webhook integration (rejected: out of scope for V1 per spec)

**Integration Pattern**:
```typescript
// Convex action for Praiz API calls
"use node";
import { action } from "./_generated/server";

// API endpoints
const PRAIZ_BASE_URL = process.env.PRAIZ_API_URL;
const PRAIZ_API_KEY = process.env.PRAIZ_API_KEY;

// Fetch recordings in date range
interface PraizRecording {
  id: string;
  url: string;
  transcript?: string;
  language: string;
  dealOutcome: "won" | "lost" | "stalled" | "unknown";
  duration: number;
  metadata: Record<string, unknown>;
}
```

**Required Environment Variables**:
- `PRAIZ_API_URL` - Base URL for Praiz API
- `PRAIZ_API_KEY` - API authentication key

---

## 2. Claude Sonnet Extraction Strategy

### Decision: Use Claude 3.5 Sonnet for pattern extraction

**Rationale**:
- Extraction quality is critical (SC-001: >80% accuracy target)
- Sonnet provides best quality/cost balance for complex analysis
- Temperature 0.1-0.3 for consistency (per Constitution Article XIV)

**Alternatives Considered**:
- Claude Haiku (rejected: lower quality for nuanced sales analysis)
- GPT-4 (rejected: locked to Anthropic per ADR)
- Local LLM (rejected: EU hosting complexity, quality concerns)

**Cost Modeling**:
- Average transcript: ~5,000 tokens
- Extraction prompt + response: ~7,000 tokens total
- Claude Sonnet pricing: ~$0.003/1K input, ~$0.015/1K output
- Estimated cost per video: ~$0.20-0.30 extraction
- With overhead: ~$0.40-0.50/video total (within budget)

**Prompt Structure** (from user input):
```typescript
const EXTRACTION_PROMPT = `
Tu es un expert en analyse de conversations commerciales B2B.
Analyse ce transcript d'un appel de vente DiliTrust et extrais:

1. OBJECTIONS: Toute résistance ou préoccupation exprimée par le prospect
2. WINNING PHRASES: Phrases du commercial qui ont provoqué une réaction positive
3. FAILURE PATTERNS: Erreurs qui ont provoqué une réaction négative

CONTEXTE:
- Module DiliTrust: {module}
- Issue de l'appel: {dealOutcome}
- Langue: {language}

TRANSCRIPT:
{transcript}

OUTPUT FORMAT (JSON):
{
  "objections": [...],
  "winningPhrases": [...],
  "failurePatterns": [...],
  "callSummary": {...}
}
`;
```

---

## 3. Confidence-Based Validation Workflow

### Decision: Three-tier confidence routing

**Rationale**: Balances automation with quality control per FR-020 through FR-022.

| Confidence | Action | Justification |
|------------|--------|---------------|
| > 0.85 | Auto-approve (flagged for review) | High confidence = low risk |
| 0.7 - 0.85 | Manual validation required | Moderate confidence = human check |
| < 0.7 | Auto-reject (logged) | Low confidence = likely noise |

**Alternatives Considered**:
- All manual validation (rejected: doesn't scale, wastes reviewer time)
- Pure auto-approval (rejected: quality concerns, liability)
- Two-tier (rejected: 0.7-0.85 range too wide without middle tier)

**Implementation**:
```typescript
function determineValidationStatus(confidence: number): ObjectionStatus {
  if (confidence >= 0.85) return "approved"; // Auto-approved, flagged
  if (confidence >= 0.70) return "pending";  // Manual validation
  return "rejected"; // Auto-rejected
}
```

---

## 4. PII Anonymization Strategy

### Decision: Pre-storage anonymization with regex + entity detection

**Rationale**:
- FR-017, FR-018 require no PII in patterns
- GDPR compliance (Constitution Article XIV)
- Source attribution maintained separately (video ID + timestamp)

**Anonymization Rules**:
1. Company names → `[COMPANY]`
2. Person names → `[PERSON]`
3. Email addresses → `[EMAIL]`
4. Phone numbers → `[PHONE]`
5. Specific amounts → `[AMOUNT]`
6. Dates (if identifying) → `[DATE]`

**Implementation Pattern**:
```typescript
function anonymizeText(text: string): string {
  let result = text;

  // Email pattern
  result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]");

  // Phone pattern (FR, international)
  result = result.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g, "[PHONE]");

  // Named entities via LLM post-processing
  // (handled in extraction prompt)

  return result;
}
```

**Alternative Considered**:
- Full NER model (rejected: overkill, handled in extraction prompt)

---

## 5. Rate Limiting & Budget Control

### Decision: Token bucket with hourly reset + monthly budget tracking

**Rationale**:
- FR-002: 50 videos/hour limit
- FR-003: Alert at 80% ($400) of $500 monthly budget
- Prevents runaway costs from processing loops

**Implementation**:
```typescript
// Rate limit check
const HOURLY_LIMIT = 50;
const MONTHLY_BUDGET_USD = 500;
const ALERT_THRESHOLD = 0.8; // 80%

interface RateLimitState {
  hourlyCount: number;
  hourlyResetAt: number;
  monthlySpendUsd: number;
  monthlyResetAt: number;
}

function canProcess(state: RateLimitState): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // Check hourly limit
  if (state.hourlyResetAt <= now) {
    // Reset hourly counter
    state.hourlyCount = 0;
    state.hourlyResetAt = now + 3600000; // 1 hour
  }

  if (state.hourlyCount >= HOURLY_LIMIT) {
    return { allowed: false, reason: "hourly_limit_reached" };
  }

  // Check budget
  if (state.monthlySpendUsd >= MONTHLY_BUDGET_USD) {
    return { allowed: false, reason: "budget_exhausted" };
  }

  return { allowed: true };
}
```

---

## 6. Freshness & Retention Strategy

### Decision: 12-month freshness cycle + indefinite pattern retention

**Rationale**:
- FR-026: Flag objections >12 months for freshness review
- FR-029a: Patterns retained indefinitely (business value)
- FR-029b: Logs retained 12 months (compliance + debugging)

**Freshness Calculation**:
```typescript
function calculateFreshnessReviewDate(extractedAt: number): number {
  const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
  return extractedAt + TWELVE_MONTHS_MS;
}

function isFresh(freshnessReviewAt: number): boolean {
  return Date.now() < freshnessReviewAt;
}
```

**Scheduled Jobs**:
1. Daily: Check `freshnessReviewAt` < now, set `isFresh: false`
2. Daily: Delete logs where `expiresAt` < now

---

## 7. Integration with Context Builder (Spec 005)

### Decision: Direct Convex query from Context Builder

**Rationale**:
- FR-030, FR-031, FR-032 require pattern injection into AI conversations
- Context Builder already queries Convex for persona data
- Objections selected by context matching + effectiveness weighting

**Query Interface**:
```typescript
// Context Builder calls this query
export const getRelevantObjections = query({
  args: {
    dilitrustModule: v.string(),
    personaType: v.string(),
    language: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(objectionEntryValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("objectionLibrary")
      .withIndex("by_module_lang", (q) =>
        q.eq("dilitrustModule", args.dilitrustModule)
         .eq("language", args.language)
      )
      .filter((q) =>
        q.eq(q.field("status"), "approved") &&
        q.eq(q.field("isFresh"), true)
      )
      .order("desc") // by effectiveness implicit in index
      .take(args.limit ?? 5);
  },
});
```

---

## 8. Observability Metrics

### Decision: Convex-native metrics tracking

**Rationale**:
- FR-033 through FR-036 require operational metrics
- Keep metrics in Convex for real-time dashboard
- External observability (e.g., Datadog) out of scope for V1

**Metrics Schema**:
```typescript
const PRAIZ_METRICS = {
  // Throughput
  videosProcessedPerHour: "count",
  videosProcessedPerDay: "count",
  videosProcessedPerBatch: "count",

  // Error tracking
  failedJobsCount: "count",
  errorRatePercent: "gauge",

  // Cost tracking
  costPerVideo: "gauge",
  monthlyCostTotal: "counter",
  budgetRemainingUsd: "gauge",

  // Queue health
  queueDepth: "gauge",
  avgProcessingTimeMs: "gauge",

  // Quality
  avgExtractionConfidence: "gauge",
  objectionsExtractedCount: "counter",
};
```

---

## 9. Error Handling & Retry Strategy

### Decision: Exponential backoff with 3 max retries

**Rationale**:
- Praiz API may have transient failures
- Claude API may rate limit
- Per-job retry tracking (FR-004)

**Retry Configuration**:
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

function getRetryDelay(retryCount: number): number {
  const delay = RETRY_CONFIG.initialDelayMs *
    Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}
```

**Error Categories**:
1. **Transient** (retry): Network timeout, API rate limit, 5xx errors
2. **Permanent** (skip): Invalid video, no transcript, 4xx errors
3. **Fatal** (alert): Auth failure, budget exhausted

---

## 10. RACC Response Templates

### Decision: Pre-seeded templates + human completion

**Rationale**:
- Automatic RACC generation out of scope (V1 spec)
- Templates accelerate human validation
- Category-specific patterns provide structure

**Template Structure** (from user input):
```typescript
const RACC_TEMPLATE = {
  reframe: {
    pattern: "Je comprends [validation empathique de l'objection]...",
  },
  address: {
    pattern: "[Valeur + données + case study]",
    requirements: [
      "Doit contenir au moins 1 métrique chiffrée",
      "Doit mentionner un case study si possible",
    ],
  },
  confirm: {
    pattern: "Est-ce que [question de vérification]?",
  },
  close: {
    pattern: "Si [condition], [proposition next step]",
  },
};
```

---

## Summary of Decisions

| # | Topic | Decision | Key Rationale |
|---|-------|----------|---------------|
| 1 | Praiz Integration | REST API + OAuth | Documented API, transcripts available |
| 2 | AI Model | Claude Sonnet | Quality critical, within budget |
| 3 | Validation | Three-tier confidence | Balance automation + quality |
| 4 | PII | Pre-storage anonymization | GDPR compliance |
| 5 | Rate Limiting | Token bucket | 50/hour, $500/month |
| 6 | Retention | 12-month freshness cycle | Business value + compliance |
| 7 | Context Integration | Direct Convex query | Simple, real-time |
| 8 | Observability | Convex-native metrics | Dashboard integration |
| 9 | Retry Strategy | Exponential backoff, 3 max | Resilience |
| 10 | RACC Templates | Pre-seeded + human | V1 simplicity |

---

## Open Questions Resolved

All technical questions have been resolved through this research phase. Proceed to Phase 1 (data model + contracts).
