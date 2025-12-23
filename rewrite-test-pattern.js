#!/usr/bin/env node

const fs = require('fs');

/**
 * Rewrites convex-test files from incorrect to correct pattern
 *
 * Input pattern (WRONG):
 *   const t = convexTest(schema);
 *   await t.run(async (ctx) => {
 *     const id = await ctx.db.insert(...);
 *     const result = await t.query/mutation(...);  // WRONG: inside t.run
 *     expect(result)...;  // WRONG: asserts inside t.run
 *   });
 *
 * Output pattern (CORRECT):
 *   const t = convexTest(schema);
 *   let id;
 *   await t.run(async (ctx) => {
 *     id = await ctx.db.insert(...);
 *   });
 *   const asUser = t.withIdentity({ subject: "clerk-id" });
 *   const result = await asUser.query/mutation(...);
 *   expect(result)...;
 */

function rewriteTest(testContent) {
  // Extract clerkId from the test
  const clerkIdMatch = testContent.match(/clerkId:\s*["']([^"']+)["']/);
  const clerkId = clerkIdMatch ? clerkIdMatch[1] : 'test-clerk-123';

  // Find all variables that need to be hoisted
  const varMatches = [...testContent.matchAll(/const\s+(\w+)\s*=\s*await\s+ctx\.db\.(insert|get)\(/g)];
  const variables = varMatches.map(m => m[1]);

  // Extract the setup section (before the API call)
  const setupMatch = testContent.match(/await t\.run\(async \(ctx\) => \{([\s\S]*?)(?:\/\/ Act|const result =|await t\.(query|mutation|action))/);
  if (!setupMatch) return testContent; // Can't parse, return as-is

  const setupSection = setupMatch[1];

  // Extract the API call
  const apiCallMatch = testContent.match(/(?:const result = )?await t\.(query|mutation|action)\((api\.[^,]+),\s*(\{[^}]*\}|\w+)\)/);
  if (!apiCallMatch) return testContent;

  const [, callType, apiPath, args] = apiCallMatch;

  // Extract assertions
  const assertMatch = testContent.match(/(?:\/\/ Assert|expect\()([\s\S]*?)\}\);[\s\S]*?\}\);/);
  const assertions = assertMatch ? assertMatch[1] : '';

  // Determine if we need to check database state after the call
  const needsDbCheck = /await ctx\.db\.(get|query)/.test(assertions);

  // Build the rewritten test
  let rewritten = `const t = convexTest(schema);\n\n`;

  // Hoist variables
  if (variables.length > 0) {
    rewritten += variables.map(v => `let ${v}: Id<any>;`).join('\n') + '\n\n';
  }

  // Setup block
  rewritten += `await t.run(async (ctx) => {\n`;
  rewritten += setupSection.replace(/const\s+(\w+)\s*=/g, '$1 =');
  rewritten += `});\n\n`;

  // Create authenticated identity
  rewritten += `const asUser = t.withIdentity({ subject: "${clerkId}" });\n\n`;

  // API call
  if (callType === 'query' || callType === 'mutation') {
    if (assertions.includes('result')) {
      rewritten += `const result = await asUser.${callType}(${apiPath}, ${args});\n\n`;
    } else {
      rewritten += `await asUser.${callType}(${apiPath}, ${args});\n\n`;
    }
  }

  // Assertions
  if (needsDbCheck) {
    rewritten += `await t.run(async (ctx) => {\n`;
    rewritten += assertions;
    rewritten += `});\n`;
  } else {
    rewritten += assertions;
  }

  return rewritten;
}

console.log('This is a template script. Full implementation would be complex.');
console.log('Manual rewriting is recommended for these large files.');
console.log('\nPattern to follow:');
console.log('1. Hoist IDs: let userId: Id<"users">;');
console.log('2. Setup in t.run(): userId = await ctx.db.insert(...)');
console.log('3. Create identity: const asUser = t.withIdentity({ subject: "clerk-id" })');
console.log('4. Call API: await asUser.mutation/query(...)');
console.log('5. Assert outside or in new t.run()');
