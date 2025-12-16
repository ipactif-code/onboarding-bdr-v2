# Multi-Project Workflow Guide

This document describes the complete workflow for using the multi-project Claude system to develop features, fix bugs, and maintain the BDR LMS application.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEW REQUEST FROM USER                              │
│                                                                              │
│  Examples:                                                                   │
│  • "Add a new quiz type with image-based questions"                         │
│  • "Fix the bug where progress isn't saved after quiz completion"           │
│  • "Optimize the course list page loading time"                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CHIEF ARCHITECT - Analysis & Routing                               │
│                                                                              │
│  Input: User request                                                         │
│  Output: Routing plan with specific questions for each project              │
│                                                                              │
│  Actions:                                                                    │
│  1. Analyze the request scope and complexity                                │
│  2. Identify which specialized projects need to be involved                 │
│  3. Determine execution order based on dependencies                         │
│  4. Create specific questions/tasks for each project                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: SPECIALIZED PROJECTS - Domain Analysis                             │
│                                                                              │
│  Input: Routing plan + specific questions from Chief Architect              │
│  Output: Domain-specific recommendations with confidence levels             │
│                                                                              │
│  Actions per project:                                                        │
│  1. Analyze the request within domain expertise                             │
│  2. Request code/console/HTML from user if needed                           │
│  3. Provide recommendations with confidence levels                          │
│  4. Flag any impacts on other projects                                      │
│  5. Identify risks and alternatives                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: CHIEF ARCHITECT - Consolidation                                    │
│                                                                              │
│  Input: Outputs from all specialized projects                               │
│  Output: Final implementation instructions for Claude Code                  │
│                                                                              │
│  Actions:                                                                    │
│  1. Review all project outputs                                              │
│  2. Identify and resolve any conflicts                                      │
│  3. Merge recommendations into coherent plan                                │
│  4. Produce step-by-step implementation instructions                        │
│  5. Include verification steps                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: CLAUDE CODE - Implementation                                       │
│                                                                              │
│  Input: Consolidated instructions from Chief Architect                      │
│  Output: Code changes committed to repository                               │
│                                                                              │
│  Actions:                                                                    │
│  1. Follow implementation instructions exactly                              │
│  2. Run verification steps                                                  │
│  3. Commit with conventional commit message                                 │
│  4. Push to feature branch                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: USER - Validation & Refresh                                        │
│                                                                              │
│  Actions:                                                                    │
│  1. Test the implementation                                                 │
│  2. Refresh GitHub files in all Claude projects                             │
│  3. Report any issues back to Chief Architect                               │
│  4. Approve or request changes                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Step-by-Step Process

### Step 1: Starting with Chief Architect

Always begin by presenting your request to the **Chief Architect** project.

**What to provide:**
- Clear description of what you want to achieve
- Context about why this is needed
- Any constraints or preferences
- Links to related specs or issues (if applicable)

**Example prompt to Chief Architect:**

```
I need to add a feature that allows admins to duplicate existing courses.

Context:
- Admins often create similar courses and want to use existing ones as templates
- The duplicate should include all sections, lessons, and quiz questions
- Progress data should NOT be copied
- The duplicate should start as a draft

Related: This was requested by the training team for Q1 2025.
```

**Chief Architect will respond with:**

```
## Routing Plan for: Course Duplication Feature

### Analysis
This feature requires backend logic for deep copying course structure,
frontend UI for triggering duplication, and security verification for admin-only access.

### Projects Involved
1. **Back-end/Convex** - First
   - Design the duplication mutation
   - Handle deep copy of sections, lessons, quiz configs, questions
   - Ensure file references are handled correctly (copy or reference?)

2. **Security & Auth** - Second
   - Verify admin-only authorization pattern
   - Audit the new mutation

3. **Front-end** - Third
   - Add duplicate button to course actions
   - Show loading state during duplication
   - Navigate to new course after success

4. **Design System** - Only if needed
   - Confirm existing button/menu components are sufficient

### Execution Order
Back-end → Security → Front-end

### Questions I need answered:
1. Back-end: Should file attachments be copied or just referenced?
2. Security: Any special audit logging needed for duplication?
3. Front-end: Where should the duplicate button appear (card menu, detail page, both)?
```

### Step 2: Consulting Specialized Projects

Take the routing plan and consult each specialized project in order.

**For each project:**

1. Open the corresponding Claude project
2. Paste the relevant portion of the routing plan
3. Provide any additional context or code they request
4. Collect their output

**Example prompt to Back-end/Convex:**

```
The Chief Architect has routed a course duplication feature to you.

Your task:
- Design the duplication mutation
- Handle deep copy of sections, lessons, quiz configs, questions
- Ensure file references are handled correctly

Question from Chief Architect:
Should file attachments be copied or just referenced?

Current course schema for reference:
[paste convex/schema.ts relevant parts]
```

**Back-end will respond with:**

```
## Course Duplication Analysis

### Recommendation
File attachments should be REFERENCED, not copied, for these reasons:
- Avoids storage duplication costs
- Files are immutable once uploaded
- Maintains single source of truth
- Confidence: HIGH (industry standard pattern)

### API Contract
```typescript
export const duplicate = mutation({
  args: {
    courseId: v.id("courses"),
    newTitle: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Implementation details...
  },
});
```

### Implementation Notes
1. Use transaction-like pattern (create all or nothing)
2. Generate new IDs for all nested entities
3. Reset viewCount and publishedAt
4. Keep file storageIds unchanged (reference)

### Impact on Other Projects
- Front-end: Will need to call api.courses.duplicate
- Security: Standard requireAdmin check sufficient
```

### Step 3: Returning to Chief Architect

After consulting all relevant projects, return to Chief Architect with all outputs.

**Example prompt:**

```
I've collected responses from all projects:

## Back-end/Convex Response:
[paste full response]

## Security & Auth Response:
[paste full response]

## Front-end Response:
[paste full response]

Please consolidate these into final implementation instructions for Claude Code.
```

**Chief Architect will produce:**

```
## Implementation Instructions: Course Duplication Feature

### Context
Adding ability for admins to duplicate courses as templates.
Files will be referenced (not copied) per Back-end recommendation.

### Files to Create/Modify

#### 1. convex/courses.ts - Add duplicate mutation
```typescript
// Add after the existing mutations

export const duplicate = mutation({
  args: {
    courseId: v.id("courses"),
    newTitle: v.optional(v.string()),
  },
  returns: v.id("courses"),
  handler: async (ctx, args) => {
    // Full implementation code here...
  },
});
```

#### 2. src/components/courses/course-actions.tsx - Add duplicate button
```typescript
// Modify the dropdown menu to include duplicate option
// Full implementation code here...
```

### Verification Steps
- [ ] Run `npx convex dev` - no type errors
- [ ] Test duplicate from course card menu
- [ ] Verify new course is created as draft
- [ ] Verify all sections/lessons are copied
- [ ] Verify original course is unchanged
- [ ] Verify admin-only access (test with user account)

### Commit Message
feat(courses): add course duplication for admins

### Rollback Plan
If issues occur:
1. Remove the duplicate mutation from convex/courses.ts
2. Remove the duplicate button from course-actions.tsx
3. Redeploy
```

### Step 4: Executing with Claude Code

Take the consolidated instructions to Claude Code (or implement manually).

**Important:** Follow the instructions exactly as provided. The Chief Architect has already resolved any conflicts and optimized the implementation order.

### Step 5: Validation and Refresh

After implementation:

1. **Test the feature** in your browser
2. **Refresh GitHub files** in ALL Claude projects
3. **Report results** to Chief Architect if issues found

## Common Scenarios

### Scenario: Bug Fix

```
User → Chief Architect:
"There's a bug where quiz progress shows 0% even after completing questions"

Chief Architect routes to:
1. Back-end (check progress mutation logic)
2. Front-end (check if mutation is called correctly)

Usually only 1-2 projects needed for bugs.
```

### Scenario: Performance Issue

```
User → Chief Architect:
"The course list page takes 5 seconds to load"

Chief Architect routes to:
1. Architecture & Performance (analysis)
2. Back-end (query optimization)
3. Front-end (rendering optimization)

Architecture leads the investigation.
```

### Scenario: New UI Component

```
User → Chief Architect:
"I need a new card component for displaying user achievements"

Chief Architect routes to:
1. Design System (create base component)
2. Front-end (implement feature using component)

Design System creates reusable component first.
```

### Scenario: Security Concern

```
User → Chief Architect:
"I think users might be able to access other users' progress data"

Chief Architect routes to:
1. Security & Auth (audit and fix)
2. Back-end (implement fixes if needed)

Security leads with IMMEDIATE priority.
```

### Scenario: AI Feature

```
User → Chief Architect:
"Add AI-powered quiz generation from course content"

Chief Architect routes to:
1. IA & Automatisation (design AI integration)
2. Back-end (implement Convex action)
3. Front-end (add UI for generation)
4. Security (review API key handling)

IA leads the design, coordinates with others.
```

## Requesting Information from User

Projects can request additional information at any time:

### Code Files
```
Could you run the following command and share the output?
cat src/components/courses/course-card.tsx
```

### Console Output
```
Could you open your browser console, perform [action], and share any errors you see?
```

### HTML Inspection
```
Could you right-click on [element], select "Inspect", and share the HTML structure?
```

### Terminal Commands
```
Could you run `npm run build` and share any errors?
```

### Convex Dashboard
```
Could you check the Convex dashboard for the 'courses' table and share a sample document?
```

## Conflict Resolution

When projects disagree, Chief Architect resolves by:

1. **Understanding both positions** - Document the rationale from each side
2. **Evaluating against constitution** - Which approach better follows project principles?
3. **Considering long-term impact** - Maintainability over convenience
4. **Making a decision** - Document in DECISIONS.md
5. **Communicating clearly** - Explain the decision to all parties

## Tips for Efficiency

1. **Be specific in requests** - More context = better routing
2. **Provide code when asked** - Projects can't hallucinate if they see real code
3. **Follow the order** - Execution order matters for dependencies
4. **Refresh promptly** - Stale code leads to conflicts
5. **Trust the experts** - Each project knows its domain best
6. **Document decisions** - Future you will thank present you
