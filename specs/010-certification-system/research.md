# Research: BDR Certification System

**Feature**: 010-certification-system
**Date**: 2026-01-09
**Status**: Complete

## Overview

This document captures research findings and design decisions for the BDR Certification System. All technical unknowns from the planning phase have been resolved.

---

## 1. Certification Level Progression

### Decision
Four-tier progressive certification: Bronze → Silver → Gold → Platinum with explicit requirements per level.

### Rationale
- Matches DiliTrust's existing competency framework
- Provides clear milestones for BDR motivation
- Maps naturally to persona difficulty gating
- Aligns with user story US1 (Progress Tracking)

### Alternatives Considered
| Alternative | Rejected Because |
|-------------|------------------|
| Points-based system | Less clear progression path, harder to communicate |
| Time-based unlocks | Doesn't reflect actual competency |
| Manager-assigned levels | Removes gamification motivation |

### Implementation Notes
- Store level definitions in `certificationLevels` table (seed data)
- Current level stored in `bdrCertifications` per user
- Level history as array in same document (Convex pattern)

---

## 2. Evaluation Cooldown Enforcement

### Decision
24-hour cooldown per scenario (not global), enforced server-side only.

### Rationale
- Per-scenario allows diverse practice without gaming
- Server-side prevents browser/client bypass
- 24h balances practice opportunity with evaluation integrity
- Aligns with BR-001 (Evaluation Cooldown)

### Implementation Pattern
```typescript
// In bdrCertifications document
evaluationCooldowns: v.array(v.object({
  scenarioSlug: v.string(),
  cooldownUntil: v.number(),  // Unix timestamp
}))

// Mutation check (before starting evaluation)
const cooldown = cert.evaluationCooldowns.find(c => c.scenarioSlug === scenario);
if (cooldown && cooldown.cooldownUntil > Date.now()) {
  throw new ConvexError("Cooldown active");
}
```

### Edge Cases
- Clock skew: Use server time only (Convex `Date.now()`)
- Concurrent attempts: Convex transactions prevent race
- Admin reset: Separate mutation with audit log

---

## 3. Persona Access Gating

### Decision
Static mapping of personas to certification levels, checked at session start.

### Rationale
- Simple lookup pattern (no complex permission system)
- Personas are predefined in Spec 004
- Clear unlock requirements for UI display
- Aligns with FR-010 through FR-012

### Persona Unlock Map
```typescript
const PERSONA_REQUIREMENTS = {
  // Bronze (default after onboarding)
  "enthusiastic-champion": "bronze",
  "political-cautious": "bronze",
  "pressured-executive": "bronze",
  "technical-detailist": "bronze",

  // Silver
  "skeptical-analyst": "silver",
  "aggressive-negotiator": "silver",

  // Gold
  "risk-averse-legal": "gold",

  // Platinum
  "ceo-roi-focused": "platinum",
};
```

### Integration Point
- Hook into Spec 004's session creation mutation
- Check `bdrCertifications.currentLevel` against persona requirement
- Return clear error with unlock requirement for UI

---

## 4. Badge Criteria Evaluation

### Decision
Modular evaluator pattern with badge-specific criteria handlers.

### Rationale
- Different badge types need different logic
- Easy to add new badges without code changes
- Testable individual evaluators
- Aligns with FR-013 through FR-016

### Badge Categories & Evaluation
| Category | Criteria Type | Evaluation Trigger |
|----------|---------------|-------------------|
| milestone | sessions_completed | After session ends |
| skill | dimension_score | After scoring completes |
| certification | certification_level | After level upgrade |
| streak | consecutive_sessions | After session ends |

### Implementation Pattern
```typescript
// Badge evaluator interface
type BadgeEvaluator = (
  ctx: MutationCtx,
  userId: Id<"users">,
  trigger: BadgeTrigger
) => Promise<string[]>;  // Returns badge slugs to award

// Dispatcher
async function evaluateBadges(ctx, userId, trigger) {
  const evaluators = [
    evaluateMilestones,
    evaluateSkills,
    evaluateCertifications,
    evaluateStreaks,
  ];

  const badges = await Promise.all(
    evaluators.map(e => e(ctx, userId, trigger))
  );

  return badges.flat();
}
```

### Idempotency
- Check `bdrBadges` before awarding
- Each badge awarded once per user (unique constraint)
- Progress counters stored separately, reset after award

---

## 5. LMS Synchronization

### Decision
Queue-based async sync with retry and idempotency.

### Rationale
- LMS API may be unavailable (external dependency)
- Sync must not block user flow
- Idempotency handles network retries
- Aligns with FR-017 through FR-021, SC-002

### Queue Pattern
```typescript
// lmsSyncQueue table
{
  userId: Id<"users">,
  eventType: "session_completed" | "certification_earned" | "badge_awarded",
  payload: { ... },  // Event-specific data
  status: "pending" | "processing" | "completed" | "failed",
  attempts: number,
  lastAttemptAt: number | null,
  lastError: string | null,
  createdAt: number,
}
```

### Sync Flow
1. Event occurs (session end, level up, badge award)
2. Insert into `lmsSyncQueue` with status="pending"
3. Scheduled action processes queue every 30s
4. On success: status="completed"
5. On failure: increment attempts, exponential backoff
6. After 5 failures: status="failed", alert ops

### Idempotency Key
- Combination of `userId` + `eventType` + `createdAt`
- LMS API must handle duplicate requests gracefully

---

## 6. Team Lead Dashboard

### Decision
Real-time dashboard with Convex subscriptions, team-scoped queries.

### Rationale
- Team Leads need current visibility (SC-005: <30s)
- Convex subscriptions provide instant updates
- Team membership from existing auth system
- Aligns with US6 (Team Certification Dashboard)

### Query Patterns
```typescript
// Team certification distribution
export const getTeamCertifications = query({
  args: {},
  returns: v.array(v.object({
    userId: v.id("users"),
    userName: v.string(),
    currentLevel: v.string(),
    lastProgressAt: v.number(),
    isStalled: v.boolean(),
  })),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const teamMembers = await getTeamMembers(ctx, identity);

    return ctx.db
      .query("bdrCertifications")
      .withIndex("by_user")
      .filter(q =>
        q.or(...teamMembers.map(m => q.eq(q.field("userId"), m)))
      )
      .collect();
  },
});
```

### Stalled Detection
- Definition: No progress in 2+ weeks (FR-023)
- Calculate from `updatedAt` field
- Pre-compute flag in query response

---

## 7. Admin Cooldown Reset

### Decision
Team Leads can reset for their team, System Admins can reset for anyone, with mandatory reason.

### Rationale
- Flexibility for legitimate cases (tech issues, exceptions)
- Scoped access prevents abuse
- Audit trail ensures accountability
- Aligns with FR-009, BR-001

### Authorization Check
```typescript
// In cooldowns.ts
export const resetCooldown = mutation({
  args: {
    targetUserId: v.id("users"),
    scenarioSlug: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Admin can reset anyone
    if (identity.role === "admin") {
      // proceed
    }
    // Team Lead can only reset team members
    else if (identity.role === "team_lead") {
      const isTeamMember = await checkTeamMembership(ctx, identity, args.targetUserId);
      if (!isTeamMember) {
        throw new ConvexError("Can only reset cooldowns for your team members");
      }
    }
    else {
      throw new ConvexError("Unauthorized");
    }

    // Log to audit table
    await ctx.db.insert("cooldownResets", {
      userId: args.targetUserId,
      resetBy: identity.userId,
      resetByRole: identity.role,
      scenarioSlug: args.scenarioSlug,
      reason: args.reason,
      resetAt: Date.now(),
    });

    // Perform reset
    // ...
  },
});
```

---

## 8. Observability & Metrics

### Decision
Business metrics via Convex aggregation queries, sync health via queue status.

### Rationale
- Constitution Article XIV requires observability
- Key metrics identified in clarification session
- Real-time dashboard for ops team
- Aligns with FR-029 through FR-032

### Metrics to Track
| Metric | Calculation | Alert Threshold |
|--------|-------------|-----------------|
| Certification rate by level | Count by level / total BDRs | N/A (reporting) |
| LMS sync failure rate | Failed syncs / total syncs (24h) | >5% |
| Badge engagement | Viewed badges / earned badges | <50% (informational) |
| Evaluation pass rate | Passed / total attempts | N/A (reporting) |
| Avg time to certification | Days from signup to level | N/A (reporting) |

### Implementation
- Scheduled function to compute daily metrics
- Store in `metrics` table for historical trend
- Expose via admin dashboard query
- Alert via Convex action to ops channel (Slack/email)

---

## 9. Multilingual Support

### Decision
All user-facing text localized in 5 languages using localized name objects.

### Rationale
- Constitution Article XIV mandates 5 languages
- Certification names, badge names/descriptions need translation
- Consistent with existing LMS localization patterns

### Schema Pattern
```typescript
name: v.object({
  fr: v.string(),
  en: v.string(),
  it: v.string(),
  es: v.string(),
  de: v.string(),
}),
```

### Seed Data Example
```typescript
{
  slug: "bronze",
  name: {
    fr: "Bronze",
    en: "Bronze",
    it: "Bronzo",
    es: "Bronce",
    de: "Bronze",
  },
  // ...
}
```

---

## 10. Integration with Spec 004 & 009

### Decision
Event-driven integration via Convex internal functions.

### Rationale
- Clean separation of concerns
- Spec 004 handles sessions, triggers certification check
- Spec 009 handles scoring, triggers badge evaluation
- No circular dependencies

### Integration Points

**From Spec 004 (Sessions):**
```typescript
// After session completes in trainingSessions mutation
await ctx.runMutation(internal.certifications.onSessionComplete, {
  userId: args.userId,
  sessionId: newSessionId,
  sessionType: args.sessionType,  // "practice" | "evaluation"
});
```

**From Spec 009 (Scoring):**
```typescript
// After scoring completes in scoringJobs
await ctx.runMutation(internal.certifications.onScoringComplete, {
  userId: args.userId,
  sessionId: args.sessionId,
  scores: result.scores,
  passed: result.passed,
  isDistinction: result.overallScore >= 85,
});
```

---

## Summary

All technical unknowns resolved. Ready to proceed to Phase 1 (data model and contracts).

| Topic | Decision | Confidence |
|-------|----------|------------|
| Certification levels | 4-tier progressive | High |
| Cooldown enforcement | Server-side, per-scenario | High |
| Persona gating | Static map, check at session start | High |
| Badge evaluation | Modular evaluators | High |
| LMS sync | Queue-based, async, idempotent | High |
| Team dashboard | Real-time Convex subscriptions | High |
| Admin reset | Role-scoped with audit | High |
| Observability | Aggregation queries + alerts | High |
| Multilingual | Localized name objects | High |
| Spec integration | Internal function triggers | High |
