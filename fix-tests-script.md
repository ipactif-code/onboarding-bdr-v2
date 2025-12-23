# Test Fix Pattern

## Problem
Tests are calling queries/mutations inside `t.run()` blocks, which breaks authentication.

## Pattern to Fix

### WRONG ❌
```typescript
await t.run(async (ctx) => {
  // ... setup data ...
  const result = await t.query(api.module.function, { args });
  // ... assertions ...
});
```

### CORRECT ✅
```typescript
let someId: Id<"table">;

await t.run(async (ctx) => {
  // ... setup data ONLY ...
  someId = await ctx.db.insert("table", { ... });
});

const asUser = t.withIdentity({ subject: "clerk-id" });
const result = await asUser.query(api.module.function, { args });

// assertions outside
expect(result).toBeDefined();
```

## Files to Fix
1. tests/unit/convex/messages.test.ts
2. tests/unit/convex/channels.test.ts
