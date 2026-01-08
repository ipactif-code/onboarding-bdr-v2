# Research: Adaptive Behavior Modules (M1 & M3)

**Feature**: 006-adaptive-behavior
**Date**: 2026-01-08
**Status**: Complete

## Executive Summary

This research document examines the technical approach for implementing the Adaptive Difficulty Engine (M1) and Emotional State Machine (M3) modules. The modules work together to create a dynamic, personalized training experience that adapts to BDR performance in real-time.

**Key Findings**:
- M1 implements Vygotsky's ZPD through weighted metric scoring with proven threshold-based adjustment
- M3 uses action-weighted probabilistic state transitions for realistic emotional responses
- Both modules integrate with existing Spec 005 Context Builder and Cartesia TTS
- Performance target of <10ms is achievable with pure functions and efficient state management

---

## M1: Adaptive Difficulty Engine

### Theoretical Foundation

**Vygotsky's Zone of Proximal Development (ZPD)**: Training is most effective when challenges are just beyond current ability but achievable with effort. M1 maintains this "sweet spot" by:
- Increasing difficulty when performance consistently exceeds threshold (>70)
- Decreasing difficulty when performance falls below threshold (<55)
- Respecting cooldown periods to prevent oscillation

### Performance Metrics

M1 tracks 7 weighted metrics that together represent comprehensive BDR competency:

| Metric | Weight | Description | Calculation Source |
|--------|--------|-------------|-------------------|
| spinQuality | 25% | Quality of SPIN selling questions | LLM evaluation |
| objectionHandling | 25% | Response to prospect objections | LLM evaluation |
| talkRatio | 10% | BDR vs prospect speaking time | Audio duration |
| responseTiming | 10% | Response speed (ideal ~2s) | Timestamp delta |
| questionDepth | 10% | Follow-up question quality | LLM evaluation |
| valueArticulation | 10% | Value proposition clarity | LLM evaluation |
| closingSignals | 10% | Recognition of buying signals | LLM evaluation |

### Composite Score Calculation

```typescript
const PERFORMANCE_WEIGHTS = {
  spinQuality: 0.25,
  objectionHandling: 0.25,
  talkRatio: 0.10,
  responseTiming: 0.10,
  questionDepth: 0.10,
  valueArticulation: 0.10,
  closingSignals: 0.10,
} as const;

// Composite score = weighted sum (0-100 scale)
function calculateCompositeScore(metrics: PerformanceMetrics): number {
  return Object.entries(PERFORMANCE_WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + (metrics[key] ?? 0) * weight;
  }, 0);
}
```

### Difficulty Adjustment Algorithm

```typescript
interface DifficultyAdjustmentResult {
  newDifficulty: number;
  adjusted: boolean;
  reason?: 'sustained_high' | 'sustained_low' | 'cooldown' | 'bounds';
}

function adjustDifficulty(
  currentDifficulty: number,
  compositeScore: number,
  lastAdjustmentTime: number,
  sustainedDuration: number,  // ms performing at this level
  personaBounds: { min: number; max: number }
): DifficultyAdjustmentResult {
  const now = Date.now();

  // Cooldown check (60 seconds)
  if (now - lastAdjustmentTime < 60_000) {
    return { newDifficulty: currentDifficulty, adjusted: false, reason: 'cooldown' };
  }

  // Sustained performance check (2 minutes = 120,000 ms)
  if (sustainedDuration < 120_000) {
    return { newDifficulty: currentDifficulty, adjusted: false };
  }

  let newDifficulty = currentDifficulty;
  let reason: 'sustained_high' | 'sustained_low' | 'bounds' | undefined;

  // Adjust based on thresholds
  if (compositeScore > 70) {
    // Performing well - increase difficulty
    newDifficulty = Math.min(currentDifficulty + 0.075, personaBounds.max);
    reason = 'sustained_high';
  } else if (compositeScore < 55) {
    // Struggling - decrease difficulty
    newDifficulty = Math.max(currentDifficulty - 0.075, personaBounds.min);
    reason = 'sustained_low';
  }

  // Bounds check
  if (newDifficulty === personaBounds.min || newDifficulty === personaBounds.max) {
    reason = 'bounds';
  }

  return {
    newDifficulty,
    adjusted: newDifficulty !== currentDifficulty,
    reason,
  };
}
```

### Behavior Modifiers

Difficulty level translates to 6 behavior modifiers that affect prospect behavior:

| Modifier | Low Difficulty (0.3) | High Difficulty (0.85) |
|----------|---------------------|------------------------|
| objectionFrequency | 20% | 80% |
| objectionIntensity | 1 (mild) | 4 (aggressive) |
| interruptionRate | 5% | 35% |
| infoRevealLevel | 4 (open) | 1 (guarded) |
| timePressure | 1 (relaxed) | 4 (rushed) |
| competitorMentions | 10% | 60% |

```typescript
function calculateBehaviorModifiers(difficulty: number): BehaviorModifiers {
  // Linear interpolation between min/max values based on difficulty
  const t = (difficulty - 0.1) / 0.85; // normalize to 0-1

  return {
    objectionFrequency: lerp(0.2, 0.8, t),
    objectionIntensity: Math.round(lerp(1, 4, t)),
    interruptionRate: lerp(0.05, 0.35, t),
    infoRevealLevel: Math.round(lerp(4, 1, t)),
    timePressure: Math.round(lerp(1, 4, t)),
    competitorMentions: lerp(0.1, 0.6, t),
  };
}
```

---

## M3: Emotional State Machine

### State Definitions

M3 manages 6 emotional states that affect prospect behavior and voice:

| State | Description | Voice Effect | Behavior |
|-------|-------------|--------------|----------|
| skeptical | Doubtful, guarded | Flat, measured | Short responses, questions claims |
| neutral | Open but uncommitted | Normal | Standard engagement |
| interested | Sees potential value | Warmer, engaged | Asks follow-ups, shares context |
| impressed | Seriously considering | Enthusiastic | Discusses next steps |
| defensive | Feels pushed/pressured | Colder, guarded | Raises objections, pulls back |
| frustrated | Wants to end call | Curt, dismissive | Mentions being busy, seeks exit |

### State Transition Model

M3 uses an **action-weighted probabilistic model**:

1. BDR action quality determines **base transition probability**
2. Persona configuration applies **modifier multiplier**
3. Random roll determines if transition occurs

```typescript
// Transition triggers and their base probabilities
const TRANSITION_TRIGGERS: Record<string, StateTransition[]> = {
  good_spin_question: [
    { from: 'neutral', to: 'interested', baseProbability: 0.4 },
    { from: 'skeptical', to: 'neutral', baseProbability: 0.3 },
    { from: 'defensive', to: 'neutral', baseProbability: 0.2 },
  ],
  poor_listening: [
    { from: 'neutral', to: 'defensive', baseProbability: 0.35 },
    { from: 'interested', to: 'neutral', baseProbability: 0.3 },
  ],
  premature_pitch: [
    { from: 'neutral', to: 'skeptical', baseProbability: 0.5 },
    { from: 'interested', to: 'defensive', baseProbability: 0.4 },
  ],
  excellent_objection_handling: [
    { from: 'skeptical', to: 'interested', baseProbability: 0.35 },
    { from: 'defensive', to: 'neutral', baseProbability: 0.4 },
    { from: 'interested', to: 'impressed', baseProbability: 0.15 },
  ],
  ignored_objection: [
    { from: 'neutral', to: 'defensive', baseProbability: 0.5 },
    { from: 'defensive', to: 'frustrated', baseProbability: 0.4 },
  ],
  // ... more triggers
};

// Persona modifiers affect transition sensitivity
const PERSONA_MODIFIERS: Record<string, Record<EmotionalState, number>> = {
  skeptical_analyst: {
    skeptical: 1.2,    // Harder to move out of skeptical
    neutral: 1.0,
    interested: 0.8,   // Harder to reach
    impressed: 0.5,    // Much harder to reach
    defensive: 1.1,
    frustrated: 0.9,
  },
  friendly_champion: {
    skeptical: 0.7,    // Easier to move out of skeptical
    neutral: 1.0,
    interested: 1.3,   // Easier to reach
    impressed: 1.0,
    defensive: 0.8,
    frustrated: 0.7,
  },
  // ... more personas
};
```

### Transition Algorithm

```typescript
interface TransitionResult {
  newState: EmotionalState;
  transitioned: boolean;
  reason?: 'action_triggered' | 'rate_limited' | 'probability_miss';
}

function evaluateTransition(
  currentState: EmotionalState,
  actionType: string,
  actionQuality: number,  // 0-100
  personaType: string,
  transitionsLastMinute: number,
  turnsSinceFrustrated: number,
): TransitionResult {
  // Rate limiting (max 2 per minute)
  if (transitionsLastMinute >= 2) {
    return { newState: currentState, transitioned: false, reason: 'rate_limited' };
  }

  // Get possible transitions for this action
  const triggers = TRANSITION_TRIGGERS[actionType] ?? [];
  const applicable = triggers.filter(t => t.from === currentState);

  if (applicable.length === 0) {
    return { newState: currentState, transitioned: false };
  }

  // Calculate adjusted probability
  for (const trigger of applicable) {
    const personaMod = PERSONA_MODIFIERS[personaType]?.[trigger.to] ?? 1.0;
    const qualityMod = actionQuality / 100;  // Scale by action quality
    const adjustedProb = trigger.baseProbability * personaMod * qualityMod;

    // Roll for transition
    if (Math.random() < adjustedProb) {
      return {
        newState: trigger.to,
        transitioned: true,
        reason: 'action_triggered'
      };
    }
  }

  return { newState: currentState, transitioned: false, reason: 'probability_miss' };
}
```

### Frustrated State Handling

When prospect reaches `frustrated` state, special rules apply:

```typescript
const FRUSTRATED_TERMINATION = {
  warningAfterTurns: 2,       // Warn after 2 turns in frustrated
  exitAfterTurns: 4,          // Exit after 4 turns total (2 after warning)
  gracePeriodMs: 30_000,      // 30 seconds before frustrated can be entered
};

// Warning messages (localized)
const FRUSTRATED_WARNING: Record<SupportedLanguage, string> = {
  fr: "Écoutez, je vais être honnête avec vous - je ne suis pas sûr que ce soit le bon moment pour nous. Si vous n'avez pas quelque chose de concret à me proposer, je vais devoir raccrocher.",
  en: "Look, I'm going to be honest with you - I'm not sure this is the right time for us. If you don't have something concrete to offer, I'm going to have to end this call.",
  de: "Hören Sie, ich bin ehrlich zu Ihnen - ich bin mir nicht sicher, ob das der richtige Zeitpunkt ist. Wenn Sie mir nichts Konkretes anbieten können, muss ich das Gespräch beenden.",
  it: "Guardi, sarò onesto con lei - non sono sicuro che questo sia il momento giusto. Se non ha qualcosa di concreto da propormi, dovrò interrompere la chiamata.",
  es: "Mire, voy a ser honesto con usted - no estoy seguro de que este sea el momento adecuado. Si no tiene algo concreto que ofrecerme, voy a tener que terminar esta llamada.",
};
```

### State Persistence

Emotional state history is tracked for analysis:

```typescript
interface EmotionalStateEvent {
  sessionId: Id<"trainingSessions">;
  timestamp: number;
  previousState: EmotionalState;
  newState: EmotionalState;
  triggerAction: string;
  triggerQuality: number;
}
```

---

## Integration Points

### Context Builder V7 Integration

M1 and M3 inject state into the Context Builder:

```typescript
// From Spec 005 context-builder.ts - extends existing interface
interface EnhancedContextInput {
  // Existing fields...
  persona: PersonaContext;
  scenario: ScenarioContext;

  // M1 fields
  difficulty: DifficultyLevel;  // Already exists: "easy" | "medium" | "hard"
  behaviorModifiers: BehaviorModifiers;  // NEW: detailed modifiers

  // M3 fields
  currentEmotionalState: EmotionalState;  // Already exists
  stateHistory: EmotionalState[];  // NEW: recent states for context
  turnsSinceLastTransition: number;  // NEW: for natural pacing
}
```

### Cartesia TTS Integration

Emotional state drives voice modulation via existing Spec 005 interface:

```typescript
// From Spec 005 cartesia.ts - already defined
const EMOTIONAL_MODULATION: Record<EmotionalState, VoiceModulation> = {
  skeptical: { speedMod: 1.0, pitchMod: 1.0, emotion: "neutral" },
  neutral: { speedMod: 1.0, pitchMod: 1.0, emotion: "neutral" },
  interested: { speedMod: 1.05, pitchMod: 1.02, emotion: "curious" },
  impressed: { speedMod: 1.08, pitchMod: 1.05, emotion: "enthusiastic" },
  defensive: { speedMod: 0.95, pitchMod: 0.98, emotion: "defensive" },
  frustrated: { speedMod: 1.15, pitchMod: 1.08, emotion: "frustrated" },
};
```

### Persona Configuration

Personas from Spec 004 are extended with M1/M3 config:

```typescript
// Extension to aiTrainerPersonas table
interface PersonaAdaptiveConfig {
  // M1 config
  difficultyBounds: {
    min: number;  // e.g., 0.3 for easy personas
    max: number;  // e.g., 0.85 for hard personas
  };

  // M3 config
  defaultEmotionalState: EmotionalState;  // Starting state
  personalityModifiers: Record<EmotionalState, number>;  // Transition modifiers
}
```

---

## Performance Considerations

### Target: <10ms Per Turn

Both M1 and M3 calculations are simple arithmetic operations:
- M1 composite score: 7 multiplications + 6 additions = O(1)
- M1 adjustment check: 3-4 comparisons = O(1)
- M3 transition check: Array scan + probability roll = O(n) where n ≈ 3-4

**Expected performance**: <1ms for both modules combined

### Optimization Strategies

1. **Pure functions**: All calculations are side-effect free, enabling memoization
2. **No database reads in hot path**: State passed in, not fetched
3. **Precomputed lookup tables**: Behavior modifiers can be cached
4. **Batch updates**: Log events asynchronously, don't block response

---

## Testing Strategy

### Unit Tests (convex-test)

```typescript
// M1 tests
describe('DifficultyEngine', () => {
  test('increases difficulty on sustained high performance', () => {
    const result = adjustDifficulty(0.5, 75, Date.now() - 70000, 130000, { min: 0.3, max: 0.85 });
    expect(result.adjusted).toBe(true);
    expect(result.newDifficulty).toBeGreaterThan(0.5);
  });

  test('respects cooldown period', () => {
    const result = adjustDifficulty(0.5, 75, Date.now() - 30000, 130000, { min: 0.3, max: 0.85 });
    expect(result.adjusted).toBe(false);
    expect(result.reason).toBe('cooldown');
  });

  test('clamps to persona bounds', () => {
    const result = adjustDifficulty(0.82, 80, Date.now() - 70000, 130000, { min: 0.3, max: 0.85 });
    expect(result.newDifficulty).toBe(0.85);
  });
});

// M3 tests
describe('EmotionalStateMachine', () => {
  test('rate limits transitions', () => {
    const result = evaluateTransition('neutral', 'good_spin_question', 90, 'skeptical_analyst', 2, 0);
    expect(result.transitioned).toBe(false);
    expect(result.reason).toBe('rate_limited');
  });

  test('applies persona modifiers', () => {
    // Run 100 times to verify probability distribution
    let transitions = 0;
    for (let i = 0; i < 100; i++) {
      const result = evaluateTransition('neutral', 'good_spin_question', 100, 'friendly_champion', 0, 0);
      if (result.transitioned) transitions++;
    }
    // Friendly champion has 1.3x modifier, should have higher transition rate
    expect(transitions).toBeGreaterThan(30); // ~52% expected
  });
});
```

### Integration Tests

- Full session flow with M1/M3 state changes
- Context Builder receives correct modifiers
- Voice synthesis receives correct emotional state

---

## Alternatives Considered

### M1 Alternatives

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Threshold-based (chosen) | Simple, predictable | May feel mechanical | ✅ Chosen - predictable is good for training |
| Machine learning model | Personalized | Complex, needs data | ❌ Over-engineering for V1 |
| Pure random | Easy to implement | Doesn't adapt | ❌ Defeats purpose |

### M3 Alternatives

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Action-weighted (chosen) | Cause-effect clarity | More complex | ✅ Chosen - BDRs learn from feedback |
| Deterministic transitions | Predictable | Robotic feel | ❌ Not realistic |
| Fully random | Varied | No skill feedback | ❌ No learning value |

---

## Open Questions (Resolved)

1. ✅ **Transition model**: Action-weighted with persona modifiers
2. ✅ **Performance thresholds**: 70/55 on 0-100 scale
3. ✅ **Call termination**: Warning + 2 turns then prospect exits
4. ✅ **Metric weights**: Added closingSignals at 10%
5. ✅ **Session outcome**: "ended_by_prospect" distinct type

---

## References

- [Vygotsky's Zone of Proximal Development](https://en.wikipedia.org/wiki/Zone_of_proximal_development)
- [SPIN Selling Methodology](https://www.spinsellingbook.com/)
- [Spec 004: AI Trainer Sessions](../004-ai-trainer-sessions/)
- [Spec 005: Voice Pipeline](../005-voice-pipeline/)
- [Constitution Article XIV: AI Services](../../.specify/memory/constitution.md#article-xiv-ai--external-services)
