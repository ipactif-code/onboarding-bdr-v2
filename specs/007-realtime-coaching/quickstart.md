# Quickstart: Real-Time Coaching Modules (M2, M4, M6)

**Feature**: 007-realtime-coaching
**Date**: 2026-01-08

## Module Overview

This feature adds three real-time coaching capabilities to the AI Sales Trainer:

| Module | Purpose | Key Capability |
|--------|---------|----------------|
| **M2 (Whispers)** | Real-time coaching hints | 15 contextual whispers with i18n |
| **M4 (Branching)** | Dynamic conversation paths | Consequences based on BDR decisions |
| **M6 (Voice)** | Voice sentiment analysis | Client-side pace/confidence feedback |

## Dependencies

Before implementing, ensure these specs are complete:
- **Spec 004**: Training session infrastructure
- **Spec 005**: Voice pipeline and transcripts
- **Spec 006**: M1 difficulty metrics, M3 emotional state

## Quick Implementation Path

### Step 1: Schema Updates

Add to `convex/schema.ts`:

```typescript
// M2: Whisper Events
whisperEvents: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  ruleId: v.union(
    v.literal("talk_ratio_high"),
    v.literal("spin_stuck_situation"),
    // ... 13 more rules
  ),
  messageLanguage: v.union(v.literal("fr"), v.literal("en"), v.literal("it"), v.literal("de"), v.literal("es")),
  messageContent: v.string(),
  priority: v.union(v.literal("racc"), v.literal("normal"), v.literal("positive")),
  ruleCooldownMs: v.number(),
  triggerToDisplayLatencyMs: v.number(),
  triggerContext: v.optional(v.any()),
  wasSuperseded: v.boolean(),
  supersededBy: v.optional(v.string()),
})
.index("by_session", ["sessionId"])
.index("by_rule", ["ruleId"])

// M4: Branch Decisions
branchDecisions: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  turnNumber: v.number(),
  decisionPointId: v.string(),
  triggerType: v.union(
    v.literal("objection_handled"),
    v.literal("buying_signal_response"),
    v.literal("discovery_depth"),
    v.literal("value_proposition"),
    v.literal("closing_attempt")
  ),
  transcriptBefore: v.string(),
  bdrResponse: v.string(),
  branchType: v.union(v.literal("positive"), v.literal("negative"), v.literal("neutral")),
  branchOutcome: v.string(),
  prospectBehaviorShift: v.optional(v.any()),
  loggingLatencyMs: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_branch_type", ["branchType"])

// M6: Voice Metrics
voiceMetrics: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  sessionElapsedMs: v.number(),
  confidence: v.number(),
  paceWpm: v.number(),
  energy: v.number(),
  hesitationRate: v.number(),
  paceStatus: v.union(v.literal("too_slow"), v.literal("good"), v.literal("too_fast")),
  fillerWordsDetected: v.optional(v.number()),
  processingTimeMs: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_session_timestamp", ["sessionId", "timestamp"])
```

### Step 2: Core Whisper Engine

```typescript
// convex/coaching/whispers.ts
import { WHISPER_CONFIG, WHISPER_PRIORITIES, WHISPER_MESSAGES } from "./contracts/whisper-engine";

export function evaluateWhispers(
  metrics: WhisperEvaluationInput,
  state: WhisperState
): WhisperEvaluationResult {
  const startTime = Date.now();

  // Check mode (FR-005)
  if (metrics.sessionMode === "evaluation") {
    return { shouldDisplay: false, reason: "evaluation_mode", evaluationLatencyMs: 0 };
  }

  // Check global cooldown (FR-003)
  if (isGlobalCooldownActive(state.lastWhisperAt, metrics.currentTime)) {
    return { shouldDisplay: false, reason: "global_cooldown", evaluationLatencyMs: Date.now() - startTime };
  }

  // Check rate limit (FR-002)
  if (isRateLimitReached(state.whispersInLastMinute, metrics.currentTime)) {
    return { shouldDisplay: false, reason: "rate_limit", evaluationLatencyMs: Date.now() - startTime };
  }

  // Evaluate all triggers, collect matches
  const triggeredRules = evaluateAllTriggers(metrics);

  if (triggeredRules.length === 0) {
    return { shouldDisplay: false, reason: "no_trigger_met", evaluationLatencyMs: Date.now() - startTime };
  }

  // Sort by priority and select highest
  const sorted = sortByPriority(triggeredRules);
  const winner = sorted[0];

  return {
    shouldDisplay: true,
    whisper: {
      ruleId: winner,
      message: WHISPER_MESSAGES[winner][metrics.language],
      priority: getWhisperPriority(winner),
      displayDurationMs: WHISPER_CONFIG.displayDurationMs,
    },
    suppressedWhispers: sorted.slice(1),
    evaluationLatencyMs: Date.now() - startTime,
  };
}
```

### Step 3: Whisper UI Component

```tsx
// src/components/coaching/whisper-overlay.tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WhisperOverlayProps {
  whisper: { message: string; priority: "racc" | "normal" | "positive" } | null;
  displayDurationMs?: number;
}

export function WhisperOverlay({ whisper, displayDurationMs = 5000 }: WhisperOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (whisper) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), displayDurationMs);
      return () => clearTimeout(timer);
    }
  }, [whisper, displayDurationMs]);

  const bgColor = whisper?.priority === "racc" ? "bg-orange-500/90"
    : whisper?.priority === "positive" ? "bg-green-500/90"
    : "bg-blue-500/90";

  return (
    <AnimatePresence>
      {visible && whisper && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-20 right-4 max-w-sm p-4 rounded-lg shadow-lg ${bgColor} text-white z-50`}
        >
          {whisper.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Step 4: Voice Analysis Hook

```tsx
// src/hooks/use-voice-analysis.ts
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { M6_CONFIG, determinePaceStatus, calculateConfidence } from "@/specs/007-realtime-coaching/contracts/voice-sentiment";

export function useVoiceAnalysis(sessionId: string, enabled: boolean) {
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const [metrics, setMetrics] = useState<VoiceMetrics | null>(null);
  const [paceStatus, setPaceStatus] = useState<PaceStatus>("good");

  const initializeAnalyzer = useCallback(async (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();

    analyzer.fftSize = 2048;
    analyzer.smoothingTimeConstant = 0.8;

    source.connect(analyzer);
    analyzerRef.current = analyzer;

    // Start analysis loop
    const interval = setInterval(() => {
      const metrics = analyzeCurrentFrame(analyzer);
      setMetrics(metrics);
      setPaceStatus(determinePaceStatus(metrics.paceWpm));
    }, M6_CONFIG.sampleIntervalMs);

    return () => {
      clearInterval(interval);
      audioContext.close();
    };
  }, []);

  return { metrics, paceStatus, initializeAnalyzer };
}
```

### Step 5: Branch Detection Integration

```typescript
// convex/coaching/branching.ts
export function detectBranchPoint(
  input: BranchDetectionInput,
  currentBranchCount: number
): BranchDetectionResult {
  // Check limit (FR-012)
  if (currentBranchCount >= BRANCHING_CONFIG.maxBranchesPerSession) {
    return { shouldCreateBranch: false, reason: "max_branches_reached" };
  }

  // Determine branch type from indicators
  const branchType = determineBranchType(
    input.analysisResults.indicators,
    input.detectedTrigger
  );

  // Calculate emotional shift
  const emotionalShift = calculateEmotionalShift(
    input.currentEmotionalState,
    branchType
  );

  return {
    shouldCreateBranch: true,
    branchDecision: {
      sessionId: input.sessionId,
      userId: input.userId,
      timestamp: Date.now(),
      turnNumber: input.turnNumber,
      decisionPointId: generateDecisionPointId(input.detectedTrigger, input.turnNumber),
      triggerType: input.detectedTrigger,
      transcriptBefore: input.transcriptContext,
      bdrResponse: input.bdrResponse,
      branchType,
      branchOutcome: generateBranchOutcome(branchType, input.detectedTrigger),
      prospectBehaviorShift: emotionalShift,
    },
    prospectResponse: {
      emotionalShift,
      behaviorHint: generateBehaviorHint(branchType, emotionalShift.newState),
    },
  };
}
```

## Key Integration Points

### With Spec 006 (Adaptive Behavior)

```typescript
// In voice pipeline per-turn handler
const m1Metrics = await evaluatePerformance(transcript);
const m3Result = await evaluateEmotionalTransition(context, action);

// Feed to M2 whisper evaluation
const whisperInput = {
  talkRatio: m1Metrics.talkRatio,
  spinProgression: m1Metrics.spinQuality / 100,
  // ... plus voice metrics from M6
  voiceConfidence: voiceMetrics.confidence,
  paceWpm: voiceMetrics.paceWpm,
};

// Feed to M4 branch detection
if (branchTriggerDetected) {
  const branchResult = detectBranchPoint({
    currentEmotionalState: m3Result.newState,
    // ...
  });

  // Update M3 emotional state from branch outcome
  if (branchResult.prospectResponse) {
    await updateEmotionalState(
      sessionId,
      branchResult.prospectResponse.emotionalShift
    );
  }
}
```

### With Context Builder (Spec 005)

```typescript
// Add branch outcome to LLM context
function buildPromptWithBranching(
  baseContext: ContextBuilderInput,
  lastBranch: BranchDecision | null
): string {
  let prompt = baseContext.systemPrompt;

  if (lastBranch) {
    prompt += `\n\n${generateBehaviorHint(
      lastBranch.branchType,
      lastBranch.prospectBehaviorShift?.newState ?? "neutral"
    )}`;
  }

  return prompt;
}
```

## Testing Checklist

### M2 Whispers
- [ ] Whispers appear within 200ms of trigger (SC-001)
- [ ] Max 4 whispers per 60-second window
- [ ] 15-second global cooldown enforced
- [ ] Rule-specific cooldowns work correctly
- [ ] RACC priority over normal over positive
- [ ] Messages display in correct language
- [ ] Whispers disabled in evaluation mode

### M4 Branching
- [ ] Max 5 branch points per session
- [ ] Branch logged within 100ms (SC-006)
- [ ] Positive branch increases prospect openness
- [ ] Negative branch decreases engagement
- [ ] Branch history shown in session summary
- [ ] What-If limited to 3 per session
- [ ] What-If only available after session complete

### M6 Voice
- [ ] Metrics update every 5 seconds (SC-007)
- [ ] CPU usage < 5% (SC-003)
- [ ] No raw audio leaves browser (FR-025)
- [ ] Pace indicator shows correct status
- [ ] Voice feedback hidden in evaluation mode
- [ ] Session summary includes voice timeline

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Whisper latency | <200ms | SC-001: Time from trigger to display |
| Branch logging | <100ms | SC-006: Time from response to log |
| Voice updates | Every 5s | SC-007: 95% reliability |
| CPU usage | <5% | SC-003: Client performance monitoring |

## Files to Create

```
convex/
  coaching/
    whispers.ts          # Whisper engine
    branching.ts         # Branch detection
    what-if.ts           # What-If replay
    voice.ts             # Voice metrics storage

src/
  components/
    coaching/
      whisper-overlay.tsx    # Whisper UI
      pace-indicator.tsx     # Voice feedback
      branch-summary.tsx     # Session review
      what-if-explorer.tsx   # What-If UI

  hooks/
    coaching/
      use-whispers.ts        # Whisper state management
      use-voice-analysis.ts  # Client-side audio analysis
      use-branch-history.ts  # Branch state

tests/
  unit/
    convex/
      coaching/
        whispers.test.ts
        branching.test.ts
        voice.test.ts
```

## Common Pitfalls

1. **Don't forget graceful degradation** (FR-010a): If M1 metrics are unavailable, skip dependent whispers but continue with available triggers.

2. **Browser audio permissions**: Handle `getUserMedia` rejection gracefully - voice analysis should be optional.

3. **Memory leaks in audio**: Always cleanup AudioContext when component unmounts.

4. **Rate limiting race conditions**: Use atomic operations for cooldown tracking to prevent duplicate whispers.

5. **What-If persona consistency**: Use low temperature (0.3) and full persona context for AI generation.
