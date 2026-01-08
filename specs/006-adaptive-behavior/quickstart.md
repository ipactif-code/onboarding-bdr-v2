# Quickstart: Adaptive Behavior Modules (M1 & M3)

**Feature**: 006-adaptive-behavior
**Date**: 2026-01-08

This guide provides a rapid implementation path for M1 (Adaptive Difficulty Engine) and M3 (Emotional State Machine).

---

## Prerequisites

- [ ] Spec 004 implemented (trainingSessions, aiTrainerPersonas tables)
- [ ] Spec 005 implemented (Context Builder V7, Cartesia TTS integration)
- [ ] Convex development environment running
- [ ] TypeScript strict mode enabled

---

## 1. Schema Extensions (15 min)

### Update `convex/schema.ts`

Add M1/M3 fields to existing tables and create new event tables:

```typescript
// Add to trainingSessions table
trainingSessions: defineTable({
  // ... existing fields ...

  // M1: Difficulty State
  currentDifficulty: v.optional(v.number()),
  lastDifficultyAdjustmentAt: v.optional(v.number()),
  difficultyAdjustmentCount: v.optional(v.number()),

  // M3: Emotional State
  currentEmotionalState: v.optional(v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  )),
  emotionalStateTransitionCount: v.optional(v.number()),
  lastStateTransitionAt: v.optional(v.number()),
  turnsInFrustrated: v.optional(v.number()),
  frustratedWarningGivenAt: v.optional(v.number()),

  // Session outcome
  endedBy: v.optional(v.union(
    v.literal("user"),
    v.literal("timeout"),
    v.literal("prospect")
  )),
}),

// Add to aiTrainerPersonas table
aiTrainerPersonas: defineTable({
  // ... existing fields ...

  // M1 config
  difficultyMin: v.number(),
  difficultyMax: v.number(),
  difficultyDefault: v.number(),

  // M3 config
  defaultEmotionalState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  emotionalModifiers: v.optional(v.any()),
}),

// NEW: M1 difficulty events
m1DifficultyEvents: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  previousDifficulty: v.number(),
  newDifficulty: v.number(),
  adjustmentReason: v.union(
    v.literal("sustained_high"),
    v.literal("sustained_low"),
    v.literal("session_start"),
    v.literal("manual_override")
  ),
  compositeScore: v.number(),
  metricsSnapshot: v.object({
    spinQuality: v.number(),
    objectionHandling: v.number(),
    talkRatio: v.number(),
    responseTiming: v.number(),
    questionDepth: v.number(),
    valueArticulation: v.number(),
    closingSignals: v.number(),
  }),
  sustainedDurationMs: v.number(),
  personaDifficultyBounds: v.object({
    min: v.number(),
    max: v.number(),
  }),
})
.index("by_session", ["sessionId"]),

// NEW: M3 emotional events
m3EmotionalEvents: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  previousState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  newState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  triggerAction: v.string(),
  triggerQuality: v.number(),
  transitionProbability: v.number(),
  transitionsInLastMinute: v.number(),
  turnNumber: v.number(),
  isWarning: v.optional(v.boolean()),
  isCallTermination: v.optional(v.boolean()),
})
.index("by_session", ["sessionId"]),

// NEW: Performance snapshots
performanceSnapshots: defineTable({
  sessionId: v.id("trainingSessions"),
  userId: v.id("users"),
  timestamp: v.number(),
  sessionElapsedMs: v.number(),
  spinQuality: v.number(),
  objectionHandling: v.number(),
  talkRatio: v.number(),
  responseTiming: v.number(),
  questionDepth: v.number(),
  valueArticulation: v.number(),
  closingSignals: v.number(),
  compositeScore: v.number(),
  currentDifficulty: v.number(),
  currentEmotionalState: v.union(
    v.literal("skeptical"),
    v.literal("neutral"),
    v.literal("interested"),
    v.literal("impressed"),
    v.literal("defensive"),
    v.literal("frustrated")
  ),
  compositeScoreTrend: v.union(
    v.literal("improving"),
    v.literal("stable"),
    v.literal("declining")
  ),
  turnsSinceLastSnapshot: v.number(),
})
.index("by_session", ["sessionId"])
.index("by_session_timestamp", ["sessionId", "timestamp"]),
```

---

## 2. M1 Difficulty Engine (30 min)

### Create `convex/lib/m1-difficulty-engine.ts`

```typescript
import { PERFORMANCE_WEIGHTS, DIFFICULTY_THRESHOLDS } from "../../specs/006-adaptive-behavior/contracts/difficulty-engine";
import type { PerformanceMetrics, BehaviorModifiers, DifficultyState, DifficultyAdjustmentResult } from "../../specs/006-adaptive-behavior/contracts/difficulty-engine";

export function calculateCompositeScore(metrics: PerformanceMetrics): number {
  return Object.entries(PERFORMANCE_WEIGHTS).reduce((sum, [key, weight]) => {
    const value = metrics[key as keyof PerformanceMetrics] ?? 0;
    return sum + value * weight;
  }, 0);
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
}

export function calculateBehaviorModifiers(difficulty: number): BehaviorModifiers {
  const t = (difficulty - 0.1) / 0.85;
  return {
    objectionFrequency: lerp(0.2, 0.8, t),
    objectionIntensity: Math.round(lerp(1, 4, t)),
    interruptionRate: lerp(0.05, 0.35, t),
    infoRevealLevel: Math.round(lerp(4, 1, t)),
    timePressure: Math.round(lerp(1, 4, t)),
    competitorMentions: lerp(0.1, 0.6, t),
  };
}

export function evaluateAdjustment(
  state: DifficultyState,
  compositeScore: number,
  sustainedDurationMs: number,
  isEvaluationMode: boolean,
  currentTime: number = Date.now()
): DifficultyAdjustmentResult {
  const { currentDifficulty, lastAdjustmentAt, personaBounds } = state;

  if (isEvaluationMode) {
    return {
      newDifficulty: currentDifficulty,
      adjusted: false,
      reason: "evaluation_mode",
      behaviorModifiers: calculateBehaviorModifiers(currentDifficulty),
    };
  }

  if (lastAdjustmentAt && currentTime - lastAdjustmentAt < DIFFICULTY_THRESHOLDS.cooldownMs) {
    return {
      newDifficulty: currentDifficulty,
      adjusted: false,
      reason: "cooldown",
      behaviorModifiers: calculateBehaviorModifiers(currentDifficulty),
    };
  }

  if (sustainedDurationMs < DIFFICULTY_THRESHOLDS.sustainedDurationMs) {
    return {
      newDifficulty: currentDifficulty,
      adjusted: false,
      reason: "insufficient_duration",
      behaviorModifiers: calculateBehaviorModifiers(currentDifficulty),
    };
  }

  let newDifficulty = currentDifficulty;
  const adjustment = 0.075;

  if (compositeScore > DIFFICULTY_THRESHOLDS.increaseThreshold) {
    newDifficulty = Math.min(currentDifficulty + adjustment, personaBounds.max);
  } else if (compositeScore < DIFFICULTY_THRESHOLDS.decreaseThreshold) {
    newDifficulty = Math.max(currentDifficulty - adjustment, personaBounds.min);
  }

  return {
    newDifficulty,
    adjusted: newDifficulty !== currentDifficulty,
    reason: newDifficulty !== currentDifficulty
      ? compositeScore > 70 ? "sustained_high" : "sustained_low"
      : undefined,
    behaviorModifiers: calculateBehaviorModifiers(newDifficulty),
  };
}
```

---

## 3. M3 Emotional State Machine (30 min)

### Create `convex/lib/m3-emotional-state.ts`

```typescript
import {
  TRANSITION_TRIGGERS,
  STATE_MACHINE_CONFIG,
  DEFAULT_PERSONA_MODIFIERS,
  FRUSTRATED_WARNING_MESSAGES,
  CALL_TERMINATION_MESSAGES,
} from "../../specs/006-adaptive-behavior/contracts/emotional-state-machine";
import type {
  EmotionalState,
  EmotionalStateContext,
  TransitionResult,
  TransitionTrigger,
  SupportedLanguage,
} from "../../specs/006-adaptive-behavior/contracts/emotional-state-machine";

export function initializeEmotionalState(
  defaultState: EmotionalState,
  sessionStartedAt: number = Date.now()
): EmotionalStateContext {
  return {
    currentState: defaultState,
    stateHistory: [defaultState],
    transitionsLastMinute: 0,
    lastTransitionAt: null,
    turnsSinceStateChange: 0,
    turnsInFrustrated: 0,
    warningGivenAt: null,
    sessionStartedAt,
  };
}

export function evaluateTransition(
  context: EmotionalStateContext,
  triggerAction: TransitionTrigger,
  actionQuality: number,
  personaModifiers: Record<EmotionalState, number> = DEFAULT_PERSONA_MODIFIERS,
  language: SupportedLanguage = "en",
  currentTime: number = Date.now()
): TransitionResult {
  const { currentState, transitionsLastMinute, sessionStartedAt, turnsInFrustrated, warningGivenAt } = context;

  // Handle frustrated state warning/termination
  if (currentState === "frustrated") {
    const totalTurns = turnsInFrustrated + 1;

    if (warningGivenAt && totalTurns >= 4) {
      return {
        newState: "frustrated",
        transitioned: false,
        callShouldEnd: true,
        warningRequired: false,
        warningMessage: CALL_TERMINATION_MESSAGES[language],
      };
    }

    if (!warningGivenAt && totalTurns >= 2) {
      return {
        newState: "frustrated",
        transitioned: false,
        callShouldEnd: false,
        warningRequired: true,
        warningMessage: FRUSTRATED_WARNING_MESSAGES[language],
      };
    }
  }

  // Rate limiting
  if (transitionsLastMinute >= STATE_MACHINE_CONFIG.maxTransitionsPerMinute) {
    return { newState: currentState, transitioned: false, reason: "rate_limited", warningRequired: false, callShouldEnd: false };
  }

  // Get applicable transitions
  const triggers = TRANSITION_TRIGGERS[triggerAction] ?? [];
  const applicable = triggers.filter((t) => t.from === currentState);

  if (applicable.length === 0) {
    return { newState: currentState, transitioned: false, reason: "no_applicable_transition", warningRequired: false, callShouldEnd: false };
  }

  // Grace period for frustrated
  const sessionDuration = currentTime - sessionStartedAt;

  for (const trigger of applicable) {
    if (trigger.to === "frustrated" && sessionDuration < STATE_MACHINE_CONFIG.frustratedGracePeriodMs) {
      continue;
    }

    const personaMod = personaModifiers[trigger.to] ?? 1.0;
    const qualityMod = actionQuality / 100;
    const adjustedProb = trigger.baseProbability * personaMod * qualityMod;

    if (Math.random() < adjustedProb) {
      return { newState: trigger.to, transitioned: true, reason: "action_triggered", warningRequired: false, callShouldEnd: false };
    }
  }

  return { newState: currentState, transitioned: false, reason: "probability_miss", warningRequired: false, callShouldEnd: false };
}

export function updateContextAfterTransition(
  context: EmotionalStateContext,
  newState: EmotionalState,
  transitioned: boolean,
  warningGiven: boolean,
  currentTime: number = Date.now()
): EmotionalStateContext {
  return {
    ...context,
    currentState: newState,
    stateHistory: transitioned ? [...context.stateHistory.slice(-19), newState] : context.stateHistory,
    transitionsLastMinute: transitioned ? context.transitionsLastMinute + 1 : context.transitionsLastMinute,
    lastTransitionAt: transitioned ? currentTime : context.lastTransitionAt,
    turnsSinceStateChange: transitioned ? 0 : context.turnsSinceStateChange + 1,
    turnsInFrustrated: newState === "frustrated" ? context.turnsInFrustrated + 1 : 0,
    warningGivenAt: warningGiven ? currentTime : context.warningGivenAt,
  };
}
```

---

## 4. Integration with Voice Pipeline (20 min)

### Update Context Builder call

In your voice pipeline action, integrate M1/M3 state:

```typescript
// convex/actions/voice-pipeline.ts
import { calculateBehaviorModifiers, mapDifficultyToLevel } from "../lib/m1-difficulty-engine";
import { getVoiceModulation, formatEmotionalStateForPrompt } from "../lib/m3-emotional-state";

// When building context for LLM:
const behaviorModifiers = calculateBehaviorModifiers(session.currentDifficulty);
const difficultyLevel = mapDifficultyToLevel(session.currentDifficulty);
const voiceModulation = getVoiceModulation(session.currentEmotionalState);

// Pass to Context Builder
const context = buildContext(
  persona,
  scenario,
  product,
  history,
  session.currentEmotionalState,
  difficultyLevel,
  language,
  currentUserMessage
);

// Include behavior modifiers in system prompt
const enhancedPrompt = context.systemPrompt + "\n\n" + formatBehaviorModifiersForPrompt(behaviorModifiers);
```

---

## 5. Convex Functions (30 min)

### Create `convex/training/difficulty.ts`

```typescript
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/auth";
import { evaluateAdjustment, calculateCompositeScore, calculateBehaviorModifiers } from "../lib/m1-difficulty-engine";

export const getDifficultyState = query({
  args: { sessionId: v.id("trainingSessions") },
  returns: v.union(v.object({
    currentDifficulty: v.number(),
    behaviorModifiers: v.object({
      objectionFrequency: v.number(),
      objectionIntensity: v.number(),
      interruptionRate: v.number(),
      infoRevealLevel: v.number(),
      timePressure: v.number(),
      competitorMentions: v.number(),
    }),
    lastAdjustmentAt: v.union(v.number(), v.null()),
  }), v.null()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.currentDifficulty) return null;

    return {
      currentDifficulty: session.currentDifficulty,
      behaviorModifiers: calculateBehaviorModifiers(session.currentDifficulty),
      lastAdjustmentAt: session.lastDifficultyAdjustmentAt ?? null,
    };
  },
});

export const updateDifficulty = mutation({
  args: {
    sessionId: v.id("trainingSessions"),
    metrics: v.object({
      spinQuality: v.number(),
      objectionHandling: v.number(),
      talkRatio: v.number(),
      responseTiming: v.number(),
      questionDepth: v.number(),
      valueArticulation: v.number(),
      closingSignals: v.number(),
    }),
    sustainedDurationMs: v.number(),
  },
  returns: v.object({
    adjusted: v.boolean(),
    newDifficulty: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const persona = await ctx.db.get(session.personaId);
    if (!persona) throw new Error("Persona not found");

    const compositeScore = calculateCompositeScore(args.metrics);
    const isEvaluationMode = session.mode === "evaluation";

    const result = evaluateAdjustment(
      {
        currentDifficulty: session.currentDifficulty ?? persona.difficultyDefault,
        lastAdjustmentAt: session.lastDifficultyAdjustmentAt ?? null,
        adjustmentCount: session.difficultyAdjustmentCount ?? 0,
        personaBounds: {
          min: persona.difficultyMin,
          max: persona.difficultyMax,
          default: persona.difficultyDefault,
        },
      },
      compositeScore,
      args.sustainedDurationMs,
      isEvaluationMode
    );

    if (result.adjusted) {
      await ctx.db.patch(args.sessionId, {
        currentDifficulty: result.newDifficulty,
        lastDifficultyAdjustmentAt: Date.now(),
        difficultyAdjustmentCount: (session.difficultyAdjustmentCount ?? 0) + 1,
      });

      await ctx.db.insert("m1DifficultyEvents", {
        sessionId: args.sessionId,
        userId: session.userId,
        timestamp: Date.now(),
        previousDifficulty: session.currentDifficulty ?? persona.difficultyDefault,
        newDifficulty: result.newDifficulty,
        adjustmentReason: result.reason === "sustained_high" ? "sustained_high" : "sustained_low",
        compositeScore,
        metricsSnapshot: args.metrics,
        sustainedDurationMs: args.sustainedDurationMs,
        personaDifficultyBounds: { min: persona.difficultyMin, max: persona.difficultyMax },
      });
    }

    return {
      adjusted: result.adjusted,
      newDifficulty: result.newDifficulty,
      reason: result.reason,
    };
  },
});
```

---

## 6. Update Persona Seed Data (10 min)

Update your persona seeding script to include M1/M3 configuration:

```typescript
const personas = [
  {
    identifier: "marc_dubois",
    // ... existing fields ...
    difficultyMin: 0.35,
    difficultyMax: 0.75,
    difficultyDefault: 0.50,
    defaultEmotionalState: "neutral",
    emotionalModifiers: null, // Uses defaults
  },
  {
    identifier: "philippe_renault",
    // ... existing fields ...
    difficultyMin: 0.55,
    difficultyMax: 0.90,
    difficultyDefault: 0.70,
    defaultEmotionalState: "skeptical",
    emotionalModifiers: {
      skeptical: 1.2,
      neutral: 1.0,
      interested: 0.8,
      impressed: 0.5,
      defensive: 1.1,
      frustrated: 0.9,
    },
  },
  // ... other personas
];
```

---

## 7. Testing (15 min)

### Create basic tests

```typescript
// tests/unit/convex/m1-difficulty-engine.test.ts
import { describe, test, expect } from "vitest";
import { calculateCompositeScore, evaluateAdjustment } from "../../../convex/lib/m1-difficulty-engine";

describe("M1 Difficulty Engine", () => {
  test("calculates composite score correctly", () => {
    const metrics = {
      spinQuality: 80,
      objectionHandling: 70,
      talkRatio: 35,
      responseTiming: 75,
      questionDepth: 65,
      valueArticulation: 70,
      closingSignals: 60,
    };
    const score = calculateCompositeScore(metrics);
    expect(score).toBeCloseTo(71.0, 1); // Weighted sum
  });

  test("respects cooldown period", () => {
    const result = evaluateAdjustment(
      {
        currentDifficulty: 0.5,
        lastAdjustmentAt: Date.now() - 30_000, // 30 seconds ago
        adjustmentCount: 1,
        personaBounds: { min: 0.3, max: 0.85, default: 0.5 },
      },
      75,
      130_000,
      false
    );
    expect(result.adjusted).toBe(false);
    expect(result.reason).toBe("cooldown");
  });

  test("increases difficulty on sustained high performance", () => {
    const result = evaluateAdjustment(
      {
        currentDifficulty: 0.5,
        lastAdjustmentAt: Date.now() - 70_000, // 70 seconds ago
        adjustmentCount: 0,
        personaBounds: { min: 0.3, max: 0.85, default: 0.5 },
      },
      75, // > 70 threshold
      130_000, // > 2 min sustained
      false
    );
    expect(result.adjusted).toBe(true);
    expect(result.newDifficulty).toBeGreaterThan(0.5);
  });
});
```

---

## Verification Checklist

- [ ] Schema updates deployed successfully
- [ ] M1 difficulty adjustments work with cooldown
- [ ] M3 state transitions are rate-limited
- [ ] Frustrated state triggers warning then exit
- [ ] Context Builder receives behavior modifiers
- [ ] Voice synthesis receives emotional state
- [ ] Performance overlay shows in free practice only
- [ ] All unit tests pass

---

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement performance overlay UI component
3. Add comprehensive integration tests
4. Deploy and verify with real sessions
