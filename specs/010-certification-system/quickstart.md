# Quickstart Guide: BDR Certification System

**Feature**: 010-certification-system
**Date**: 2026-01-09

## Overview

This guide provides a fast path to understanding and implementing the BDR Certification System. Use it to get oriented before diving into the detailed spec and data model.

---

## What We're Building

A progressive certification system for BDR training:

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│  BRONZE │───▶│ SILVER  │───▶│  GOLD   │───▶│ PLATINUM │
│   🥉    │    │   🥈    │    │   🥇    │    │    💎    │
└─────────┘    └─────────┘    └─────────┘    └──────────┘
     │              │              │               │
     ▼              ▼              ▼               ▼
  4 Basic       +2 Hard       +1 Expert       +CEO Persona
  Personas      Personas       Persona         + Mentor
```

---

## Key Files to Create

### Backend (Convex)

| File | Purpose | Priority |
|------|---------|----------|
| `convex/schema.ts` | Add 6 new tables | P0 |
| `convex/certifications.ts` | Core certification logic | P1 |
| `convex/badges.ts` | Badge award system | P1 |
| `convex/evaluations.ts` | Evaluation flow | P1 |
| `convex/cooldowns.ts` | Cooldown management | P1 |
| `convex/lmsSync.ts` | LMS integration action | P2 |
| `convex/lib/certificationRules.ts` | Business rule helpers | P1 |

### Frontend (Next.js)

| File | Purpose | Priority |
|------|---------|----------|
| `src/app/(dashboard)/certification/page.tsx` | BDR dashboard | P1 |
| `src/app/(dashboard)/badges/page.tsx` | Badge collection | P2 |
| `src/app/(dashboard)/admin/team-certifications/page.tsx` | Team Lead view | P3 |
| `src/components/certification/` | Shared components | P1-P2 |
| `src/hooks/useCertification.ts` | Data hooks | P1 |

---

## Schema Quick Reference

```typescript
// Add to convex/schema.ts

// 1. Certification level definitions (seed data)
certificationLevels: defineTable({...})
  .index("by_slug", ["slug"])
  .index("by_order", ["order"]),

// 2. User certification progress
bdrCertifications: defineTable({...})
  .index("by_user", ["userId"])
  .index("by_level", ["currentLevel"])
  .index("by_lms_sync", ["lmsSyncStatus"]),

// 3. Badge definitions (seed data)
badges: defineTable({...})
  .index("by_slug", ["slug"])
  .index("by_category", ["category"]),

// 4. User earned badges
bdrBadges: defineTable({...})
  .index("by_user", ["userId"])
  .index("by_user_badge", ["userId", "badgeId"]),

// 5. Cooldown reset audit log
cooldownResets: defineTable({...})
  .index("by_user", ["userId"]),

// 6. LMS sync queue
lmsSyncQueue: defineTable({...})
  .index("by_status", ["status"]),
```

---

## Core Flows

### 1. Check Certification Progress (BDR Dashboard)

```typescript
// Frontend: src/app/(dashboard)/certification/page.tsx
const certification = useQuery(api.certifications.getCurrent);
const personas = useQuery(api.certifications.getUnlockedPersonas);

// Shows:
// - Current level badge
// - Progress to next level
// - Unlocked vs locked personas
```

### 2. Start Evaluation

```typescript
// Frontend check before starting
const canStart = useQuery(api.certifications.checkCanStartEvaluation, {
  scenarioSlug: selectedScenario,
  targetLevel: "silver",
});

if (!canStart.canStart) {
  toast.error(canStart.reason);
  return;
}

// If OK, proceed to session creation (Spec 004)
```

### 3. Process Evaluation Result (Internal)

```typescript
// Called by Spec 009 after scoring completes
await ctx.runMutation(internal.certifications.recordEvaluationResult, {
  userId,
  sessionId,
  scenarioSlug,
  score: 75,
  passed: true,
  isDistinction: false,
});

// This mutation:
// 1. Updates progress counters
// 2. Sets 24h cooldown
// 3. Checks for level-up
// 4. Awards badges if earned
// 5. Queues LMS sync
```

### 4. Award Badge

```typescript
// Internal: convex/badges.ts
async function evaluateAndAwardBadges(ctx, userId, trigger) {
  const earnedBadges = await evaluateBadgeCriteria(ctx, userId, trigger);

  for (const badge of earnedBadges) {
    // Check not already earned (idempotency)
    const existing = await ctx.db
      .query("bdrBadges")
      .withIndex("by_user_badge", q =>
        q.eq("userId", userId).eq("badgeId", badge._id)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("bdrBadges", {
        userId,
        badgeId: badge._id,
        earnedAt: Date.now(),
        viewed: false,
      });

      // Queue LMS sync
      await queueLmsEvent(ctx, userId, "badge_awarded", { badgeId: badge.slug });
    }
  }
}
```

### 5. Reset Cooldown (Admin)

```typescript
// Frontend: Admin panel
const resetCooldown = useMutation(api.cooldowns.reset);

await resetCooldown({
  targetUserId: selectedUser,
  scenarioSlug: "discovery-call",
  reason: "Technical issue during evaluation - user disconnected",
});

// Backend validates:
// 1. Caller is admin OR team lead for this user
// 2. Reason is at least 10 characters
// 3. Creates audit record
// 4. Removes cooldown entry
```

---

## Integration Points

### With Spec 004 (Sessions)

```typescript
// In trainingSessions.complete mutation (Spec 004)
// After session completes:
await ctx.runMutation(internal.certifications.recordSessionComplete, {
  userId: session.userId,
  sessionId: session._id,
  sessionType: session.type,  // "practice" | "evaluation"
});
```

### With Spec 009 (Scoring)

```typescript
// In scoring completion (Spec 009)
// After scoring job finishes:
await ctx.runMutation(internal.certifications.recordEvaluationResult, {
  userId: job.userId,
  sessionId: job.sessionId,
  scenarioSlug: job.scenarioSlug,
  score: result.overallScore,
  passed: result.overallScore >= levelRequirements.minScore,
  isDistinction: result.overallScore >= 85,
});
```

### With LMS (External API)

```typescript
// Convex action: convex/lmsSync.ts
export const processQueue = internalAction({
  handler: async (ctx) => {
    const pending = await ctx.runQuery(internal.lmsSync.getPendingEvents);

    for (const event of pending) {
      try {
        // Call LMS API
        const response = await fetch(`${LMS_API_BASE}/api/lms/${event.eventType}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.payload),
        });

        if (response.ok) {
          await ctx.runMutation(internal.lmsSync.markCompleted, { id: event._id });
        } else {
          throw new Error(await response.text());
        }
      } catch (error) {
        await ctx.runMutation(internal.lmsSync.markFailed, {
          id: event._id,
          error: error.message,
        });
      }
    }
  },
});
```

---

## Seed Data

### Certification Levels

```typescript
const CERTIFICATION_LEVELS = [
  {
    slug: "bronze",
    name: { fr: "Bronze", en: "Bronze", it: "Bronzo", es: "Bronce", de: "Bronze" },
    order: 1,
    requirements: { minSessions: 3, minEvaluations: 0, minScore: 0, distinctionRequired: false },
    unlockedPersonas: ["enthusiastic-champion", "political-cautious", "pressured-executive", "technical-detailist"],
    badge: { emoji: "🥉", color: "amber" },
  },
  {
    slug: "silver",
    name: { fr: "Argent", en: "Silver", it: "Argento", es: "Plata", de: "Silber" },
    order: 2,
    requirements: { minSessions: 0, minEvaluations: 2, minScore: 70, distinctionRequired: false, prerequisiteLevel: "bronze" },
    unlockedPersonas: ["skeptical-analyst", "aggressive-negotiator"],
    badge: { emoji: "🥈", color: "gray" },
  },
  // ... gold, platinum
];
```

### Badges

```typescript
const BADGES = [
  { slug: "first-session", emoji: "🎯", category: "milestone", criteria: { type: "sessions_completed", threshold: 1 } },
  { slug: "spin-master", emoji: "🔄", category: "skill", criteria: { type: "dimension_score", dimension: "spin", threshold: 85, count: 3 } },
  { slug: "bronze-certified", emoji: "🥉", category: "certification", criteria: { type: "certification_level", level: "bronze" } },
  // ... others
];
```

---

## Testing Checklist

### Unit Tests (convex-test)

- [ ] `certifications.recordSessionComplete` increments counter correctly
- [ ] `certifications.recordEvaluationResult` sets cooldown
- [ ] Level-up triggers at correct thresholds
- [ ] Cooldown reset validates permissions
- [ ] Badge idempotency (no duplicates)

### Integration Tests

- [ ] Full evaluation flow: start → complete → score → result
- [ ] LMS sync queue processes correctly
- [ ] Team dashboard shows correct aggregations

### E2E Tests (Playwright)

- [ ] BDR can view certification progress
- [ ] Locked personas show unlock requirements
- [ ] Badge notification appears on award
- [ ] Team Lead can view team dashboard

---

## Common Pitfalls

1. **Forgetting `requireAuth`** - Every query/mutation needs auth on line 1
2. **Using `.filter()` instead of `.withIndex()`** - Performance issue
3. **Not handling cooldown edge cases** - Check for expired cooldowns
4. **Badge duplicates** - Always check `by_user_badge` index before inserting
5. **LMS sync failures** - Must handle gracefully, don't block user flow

---

## Related Documents

- [Specification](./spec.md) - Full feature requirements
- [Data Model](./data-model.md) - Complete schema definitions
- [API Contracts](./contracts/certification-api.yaml) - All endpoints
- [Research](./research.md) - Design decisions

---

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Start with P1 tasks (schema, core mutations)
3. Add P2 tasks (badges, LMS sync)
4. Finish with P3 tasks (team dashboard, metrics)
