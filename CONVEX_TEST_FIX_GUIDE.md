# Convex Test Authentication Pattern Fix Guide

## Problem
Tests calling `t.query()` or `t.mutation()` inside `t.run()` blocks cause "transaction still open" errors.

## Solution Pattern

### ❌ WRONG (causes failures)
```typescript
await t.run(async (ctx) => {
  const userId = await ctx.db.insert("users", { ... });
  const result = await t.query(api.xxx, { ... }); // ← PROBLEM
  expect(result)...
});
```

### ✅ CORRECT  
```typescript
let userId: Id<"users">;

await t.run(async (ctx) => {
  userId = await ctx.db.insert("users", { ... }); // Setup ONLY
});

const asUser = t.withIdentity({ subject: "clerk-id" });
const result = await asUser.query(api.xxx, { ... }); // ← Outside t.run()
expect(result)...
```

## Files to Fix

### messages.test.ts
Lines with `await t.(query|mutation)` inside `t.run()`:
- Line 188-225: "should respect limit parameter"
- Line 233-300: "should support pagination with before cursor"  
- Line 303-345: "should throw error for non-member"
- Line 352-404: "should send a text message to a channel"
- Line 410-457: "should enforce rate limit"
- Line 463-498: "should validate message content length"
- Line 504-540: "should prevent empty messages"
- Line 546-583: "should prevent sending to archived channel"
- Line 589-626: "should prevent muted users from sending"
- Line 632-683: "should update thread reply count"
- Line 690-716: "should allow sender to edit"
- Line 723-751: "should store edit history"
- Line 858-881: "should allow sender to delete"
- Line 888-920: "should allow global admin to delete"
- Line 953-977: "should allow channel moderator to delete"
- Line 1047-1085: "should mark channel as read"
- Line 1092-1132: "should allow specifying custom readAt timestamp"

###channels.test.ts  
Lines with `await t.(query|mutation)` inside `t.run()`:
- Line 12-28: "should return empty array when no channels exist"
- Line 34-72: "should return public channels"
- Line 78-132: "should filter channels by type"
- Line 138-174: "should exclude archived channels"
- Line 180-217: "should include archived channels when requested"
- Line 223-275: "should calculate unread count correctly"
- Line 281-334: "should not count deleted messages in unread count"
- Line 340-397: "should sort channels by lastMessageAt descending"
- Line 404-421: "should return null for non-existent channel"
- Line 427-467: "should return channel with membership for member"
- Line 473-515: "should return null for private channel without access"
- Line 521-546: "should create a public channel as admin"
- Line 605-623: "should prevent duplicate channel names"
- Line 631-685: "should allow joining a public channel"
- Line 801-838: "should allow rejoining after leaving"

## Automated Fix Command

Due to the complexity (31 instances), manual fixing is recommended.
Follow the pattern from working tests:
- tests/unit/convex/dm/searchQueries.test.ts
- tests/unit/convex/typing.test.ts

Key steps for each test:
1. Add `let variableId: Id<"table">;` before t.run()
2. Change `const` to assignment in t.run(): `variableId = await ctx.db.insert(...)`
3. Move query/mutation call OUTSIDE t.run()
4. Add `const asUser = t.withIdentity({ subject: "clerk-id" });`
5. Use `asUser.query()` or `asUser.mutation()` instead of `t.query()`
