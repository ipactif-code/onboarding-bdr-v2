#!/usr/bin/env node

/**
 * Script to fix convex-test authentication patterns in test files
 *
 * Pattern to fix:
 * BEFORE:
 *   await t.run(async (ctx) => {
 *     // setup
 *     const userId = await ctx.db.insert(...);
 *     // BAD: calling mutation/query inside t.run
 *     await t.mutation(api.x.y, { ... });
 *     // assert inside t.run
 *   });
 *
 * AFTER:
 *   let userId;
 *   await t.run(async (ctx) => {
 *     userId = await ctx.db.insert(...);
 *   });
 *   const asUser = t.withIdentity({ subject: "clerk-id" });
 *   await asUser.mutation(api.x.y, { ... });
 *   await t.run(async (ctx) => {
 *     // asserts
 *   });
 */

const fs = require('fs');
const path = require('path');

function extractClerkId(content, testBlock) {
  // Find clerkId in the setup section
  const clerkIdMatch = testBlock.match(/clerkId:\s*["']([^"']+)["']/);
  return clerkIdMatch ? clerkIdMatch[1] : 'test-clerk-123';
}

function hasApiCall(block) {
  return /await\s+t\.(query|mutation|action)\(api\./.test(block);
}

function processTestFile(filePath) {
  console.log(`Processing ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check if file already uses withIdentity pattern
  if (content.includes('t.withIdentity')) {
    console.log(`  ✓ Already fixed, skipping`);
    return;
  }

  // Add Id import if missing
  let fixed = content;
  if (!content.includes('import type { Id }') && !content.includes('import { Id }')) {
    fixed = fixed.replace(
      /import schema from/,
      'import type { Id } from "../../../convex/_generated/dataModel";\nimport schema from'
    );
  }

  // Simple marker: tests that need fixing have t.query/t.mutation/t.action inside t.run
  const needsFixing = /await\s+t\.run\(async\s*\(ctx\)\s*=>\s*\{[\s\S]*?await\s+t\.(query|mutation|action)\(/m.test(fixed);

  if (!needsFixing) {
    console.log(`  ✓ No API calls inside t.run() detected`);
    return;
  }

  console.log(`  ⚠ Cannot automatically fix complex patterns`);
  console.log(`  → Manual review required for ${filePath}`);
}

// Process the files
const files = [
  'tests/unit/convex/messages.test.ts',
  'tests/unit/convex/channels.test.ts'
];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    processTestFile(fullPath);
  } else {
    console.log(`File not found: ${fullPath}`);
  }
});

console.log('\nNote: These files are too complex for automatic transformation.');
console.log('They require manual rewriting following the correct pattern.');
