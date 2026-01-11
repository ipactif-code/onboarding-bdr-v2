# Debug Logging Guide: Discussion Mark Injection

## Purpose

This debug logging was added to `src/components/editor/plugins/discussion-kit.tsx` to diagnose why comment marks appear to be "injected" successfully (according to logs) but don't actually show up as yellow highlights in the editor.

## What Was Added

### Phase 1: Pre-Injection Analysis

```
[Discussion DEBUG] Starting mark injection...
[Discussion DEBUG] Document structure:
  - Children count: [number]
  - Total characters in document: [number]
  - Number of discussions to inject: [number]
  - Discussion [id]: range [start, end]
  - Discussion [id]: range [start, end]
  ...
```

**What to look for:**
- Is the total character count reasonable for your document?
- Do the discussion ranges fall within the total character count?
- Are the ranges valid (start < end)?

### Phase 2: Per-Discussion Processing

For each discussion being injected:

```
[Discussion DEBUG] Processing discussion [id]:
  - selectionStart: [number]
  - selectionEnd: [number]
```

**What to look for:**
- Are these the correct character offsets from Convex?
- Do they match the text you originally highlighted?

### Phase 3: Slate Point Conversion

```
[Discussion DEBUG] Converted to Slate points:
  - startPoint: { path: [...], offset: number }
  - endPoint: { path: [...], offset: number }
  - range: { anchor: {...}, focus: {...} }
  - commentKey: comment_[discussion-id]
```

**What to look for:**
- Are the Slate points valid (not null)?
- Do the paths exist in the current document structure?
- Do the offsets make sense for those paths?

**If you see this instead:**
```
[Discussion DEBUG] SKIPPED - Could not convert offsets to points
  - startPoint: null
  - endPoint: null
```

**ROOT CAUSE IDENTIFIED:** The character offsets from Convex don't match the current document. This happens when:
1. Document content changed since the comment was created
2. Character counting logic is different from when comment was saved
3. Document hasn't fully loaded yet (timing issue)

### Phase 4: setNodes Execution

```
[Discussion DEBUG] setNodes completed without error
```

**What to look for:**
- If you DON'T see this, there was an exception (check for error logs below)

### Phase 5: Mark Verification (CRITICAL)

This is the smoking gun:

**SUCCESS CASE:**
```
[Discussion DEBUG] ✅ Mark FOUND in 3 node(s)
  - Node at path [0,0]: { text: "some text", comment_[id]: true }
  - Node at path [0,1]: { text: "highlighted", comment_[id]: true }
  - Node at path [0,2]: { text: " text", comment_[id]: true }
```

**FAILURE CASE:**
```
[Discussion DEBUG] ❌ Mark NOT FOUND in editor after setNodes
```

**What this means:**
- SUCCESS: The mark was applied correctly, so the problem is elsewhere (rendering, CSS, etc.)
- FAILURE: `setNodes()` ran without error but didn't actually modify the editor state

### Phase 6: Exception Handling

If `setNodes()` throws an error:

```
[Discussion DEBUG] Exception during setNodes: [error details]
[Discussion] Failed to inject mark for [id]: [error]
```

**What to look for:**
- Error type (TypeError, RangeError, etc.)
- Stack trace
- Slate-specific errors

## How to Use This Debug Output

### Scenario 1: Points are null
```
[Discussion DEBUG] SKIPPED - Could not convert offsets to points
```

**Diagnosis:** Character offset mismatch
**Next steps:**
1. Check if document content matches when comment was created
2. Verify `getPointFromCharacterOffset()` logic
3. Check if Yjs content is fully synced before injection

### Scenario 2: setNodes completes but mark NOT FOUND
```
[Discussion DEBUG] setNodes completed without error
[Discussion DEBUG] ❌ Mark NOT FOUND in editor after setNodes
```

**Diagnosis:** `setNodes()` is failing silently or the range is invalid
**Next steps:**
1. Verify the range is valid (anchor/focus point to actual text nodes)
2. Check if the `match` function is correctly identifying text nodes
3. Check if `split: true` is causing issues
4. Verify the range is not collapsed (start === end)

### Scenario 3: Mark IS FOUND but not visible
```
[Discussion DEBUG] ✅ Mark FOUND in 3 node(s)
  - Node at path [0,1]: { text: "highlighted", comment_[id]: true }
```

**Diagnosis:** Mark injection is working, but rendering/styling is broken
**Next steps:**
1. Check `CommentLeaf` component rendering logic
2. Verify CSS classes for `.slate-comment-...` are loaded
3. Check if the comment mark is being stripped by another plugin
4. Verify `BlockDiscussion` component is rendering

### Scenario 4: Exception during setNodes
```
[Discussion DEBUG] Exception during setNodes: TypeError: ...
```

**Diagnosis:** Invalid range or editor state
**Next steps:**
1. Read the full error message and stack trace
2. Check Plate.js/Slate version compatibility
3. Verify the range format matches Plate.js expectations

## Example Complete Output

### Healthy Injection (Expected)

```
[Discussion DEBUG] Starting mark injection...
[Discussion DEBUG] Document structure:
  - Children count: 5
  - Total characters in document: 1247
  - Number of discussions to inject: 2
  - Discussion q97bc8r3...: range [100, 150]
  - Discussion q97bc8r4...: range [200, 230]

[Discussion DEBUG] Processing discussion q97bc8r3...:
  - selectionStart: 100
  - selectionEnd: 150
[Discussion DEBUG] Converted to Slate points:
  - startPoint: { path: [1, 0], offset: 45 }
  - endPoint: { path: [1, 0], offset: 95 }
  - range: { anchor: { path: [1, 0], offset: 45 }, focus: { path: [1, 0], offset: 95 } }
  - commentKey: comment_q97bc8r3...
[Discussion DEBUG] setNodes completed without error
[Discussion DEBUG] ✅ Mark FOUND in 1 node(s)
  - Node at path [1,0]: { text: "This is the highlighted text for discussion", comment_q97bc8r3...: true }
[Discussion] Injected comment mark for discussion q97bc8r3...
```

### Problematic Injection (Diagnosis Needed)

```
[Discussion DEBUG] Starting mark injection...
[Discussion DEBUG] Document structure:
  - Children count: 1
  - Total characters in document: 0
  - Number of discussions to inject: 12
  - Discussion q97bc8r3...: range [100, 150]
  ...

[Discussion DEBUG] Processing discussion q97bc8r3...:
  - selectionStart: 100
  - selectionEnd: 150
[Discussion DEBUG] SKIPPED - Could not convert offsets to points
  - startPoint: null
  - endPoint: null
```

**PROBLEM:** Document has 0 characters but discussions expect character offsets 100-150. Document content hasn't loaded yet or is empty.

## Expected Next Steps After Review

Once you run the editor and see the debug output:

1. **Copy the FULL console output** to the bug report
2. **Identify which scenario** matches your output (1-4 above)
3. **Follow the "Next steps"** for that scenario
4. **Report findings** to the implementer with specific diagnosis

## Cleanup

Once the bug is fixed, remove all `[Discussion DEBUG]` logs but keep the original `[Discussion]` logs for production debugging.
