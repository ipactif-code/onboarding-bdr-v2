# Cross-Project Interfaces

This document defines the interfaces between specialized projects. When a project needs something from another project, this is the contract they follow.

## Purpose

Clear interfaces prevent miscommunication, reduce hallucination, and ensure each project knows exactly what to expect from others. This document serves as the "API documentation" between Claude projects.

---

## Back-end/Convex → Front-end

### What Back-end Provides

The Back-end project is responsible for providing Convex function contracts that define query and mutation signatures, return types, and error cases. It also provides TypeScript types in `src/types/` that mirror database entities and API responses. Additionally, Back-end documents authorization requirements specifying who can call each function.

### Contract Format

When Back-end creates or modifies a Convex function, it documents it as follows:

```typescript
/**
 * @function api.courses.duplicate
 * @description Creates a copy of a course with all sections and lessons
 * @authorization Admin only
 * @params courseId: Id<"courses"> - The course to duplicate
 * @params newTitle?: string - Optional new title (defaults to "Copy of {original}")
 * @returns Id<"courses"> - The new course ID
 * @errors "Course not found" - If courseId doesn't exist
 * @errors "Admin access required" - If caller is not admin
 * @realtime No - One-time mutation
 */
```

### How Front-end Consumes

Front-end uses these contracts to implement UI without guessing the API:

```typescript
// Front-end knows exactly what to expect
const duplicateCourse = useMutation(api.courses.duplicate);

const handleDuplicate = async () => {
  try {
    const newId = await duplicateCourse({ courseId, newTitle: `Copy of ${title}` });
    router.push(`/admin/courses/${newId}`);
  } catch (error) {
    // Error messages are documented, can show appropriate UI
    toast.error(error.message);
  }
};
```

---

## Design System → Front-end

### What Design System Provides

Design System provides UI components in `src/components/ui/` with documented props, variants, and accessibility features. It also provides design tokens in `globals.css` for colors, spacing, and typography. Design System documents component APIs including all props, their types, and usage examples.

### Component Documentation Format

When Design System creates or modifies a component:

```typescript
/**
 * @component Button
 * @description Primary interactive element for user actions
 * @accessibility Full keyboard support, focus visible, ARIA compliant
 * 
 * @prop variant: "default" | "destructive" | "outline" | "ghost" | "link"
 *   - default: Primary action, filled background
 *   - destructive: Dangerous action, red styling
 *   - outline: Secondary action, bordered
 *   - ghost: Tertiary action, no background
 *   - link: Text-only, underlined on hover
 * 
 * @prop size: "default" | "sm" | "lg" | "icon"
 *   - default: Standard 40px height
 *   - sm: Compact 36px height
 *   - lg: Large 44px height (meets touch target requirements)
 *   - icon: Square 40x40px for icon-only buttons
 * 
 * @prop disabled: boolean - Disables interaction and applies muted styling
 * @prop asChild: boolean - Merges props onto child element (for custom elements)
 * 
 * @example Basic usage
 * <Button variant="default">Save Changes</Button>
 * 
 * @example Icon button with accessibility
 * <Button variant="ghost" size="icon" aria-label="Close dialog">
 *   <X className="h-4 w-4" />
 * </Button>
 */
```

### How Front-end Consumes

Front-end imports and uses components without modification:

```typescript
import { Button } from "@/components/ui/button";

// Front-end knows all available variants and props
<Button variant="destructive" size="sm" onClick={handleDelete}>
  Delete Course
</Button>
```

### Requesting New Components

When Front-end needs a component that doesn't exist, they provide these requirements to Design System:

```markdown
## Component Request: Badge

### Use Case
Display status labels on courses (Draft, Published) and users (Admin, User)

### Required Variants
- default: Neutral gray for general labels
- success: Green for positive states (Published, Online)
- warning: Yellow for attention states (Pending)
- destructive: Red for negative states (Error, Offline)

### Required Props
- children: ReactNode - The label text
- variant: As above

### Accessibility Needs
- Should be readable by screen readers as part of surrounding context
- No interactive states needed (purely visual)

### Example Usage
<Badge variant="success">Published</Badge>
<Badge variant="destructive">Offline</Badge>
```

---

## Security & Auth → Back-end

### What Security Provides

Security provides authorization helper functions in `convex/lib/auth.ts` including `requireAuth`, `requireAdmin`, and `requireSelfOrAdmin`. It also provides route protection rules for middleware and documents the access control matrix for all operations.

### Authorization Helper Contract

```typescript
/**
 * @function requireAuth
 * @description Ensures the current request is from an authenticated user
 * @returns User document from database
 * @throws ConvexError("Authentication required") if not logged in
 * @throws ConvexError("User not found") if Clerk user not synced to Convex
 * @usage Always call as first line in mutation/query handler
 */

/**
 * @function requireAdmin  
 * @description Ensures the current user has admin role
 * @returns User document with role="admin"
 * @throws ConvexError("Authentication required") if not logged in
 * @throws ConvexError("Admin access required") if user.role !== "admin"
 * @usage For admin-only operations (course creation, team management)
 */

/**
 * @function requireSelfOrAdmin
 * @param targetUserId: Id<"users"> - The user being accessed
 * @description Allows access if current user is the target OR is admin
 * @returns Current user document
 * @throws ConvexError("Access denied") if neither self nor admin
 * @usage For user profile operations, progress viewing
 */
```

### How Back-end Consumes

Back-end uses these helpers as the first line in every protected function:

```typescript
export const updateProfile = mutation({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, args) => {
    // Security contract: throws if not self or admin
    await requireSelfOrAdmin(ctx, args.userId);
    
    // Safe to proceed with update
    await ctx.db.patch(args.userId, { name: args.name });
  },
});
```

### Access Control Matrix

Security maintains this matrix that Back-end must follow:

| Operation | Admin | User (Self) | User (Other) | Unauthenticated |
|-----------|-------|-------------|--------------|-----------------|
| courses.create | ✅ requireAdmin | ❌ | ❌ | ❌ |
| courses.get (published) | ✅ requireAuth | ✅ requireAuth | ✅ requireAuth | ❌ |
| courses.get (draft) | ✅ requireAdmin | ❌ | ❌ | ❌ |
| progress.update | ✅ | ✅ requireAuth (own) | ❌ | ❌ |
| users.get | ✅ requireAuth | ✅ requireSelfOrAdmin | ✅ requireAdmin | ❌ |
| messages.send | ✅ requireAuth | ✅ requireAuth | ✅ requireAuth | ❌ |
| messages.broadcast | ✅ requireAdmin | ❌ | ❌ | ❌ |

---

## Architecture & Performance → All Projects

### What Architecture Provides

Architecture provides folder structure guidelines and file organization patterns. It defines performance budgets and targets including LCP, bundle sizes, and query optimization patterns. Architecture reviews and approves significant architectural changes.

### Performance Budget Contract

All projects must respect these budgets:

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse, Web Vitals |
| FID (First Input Delay) | < 100ms | Lighthouse, Web Vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse, Web Vitals |
| Initial JS Bundle | < 150KB gzipped | `npm run build` output |
| Time to Interactive | < 3.5s on 3G | Lighthouse |
| Convex Query Response | < 100ms p95 | Convex Dashboard |

### How Other Projects Comply

Before submitting significant changes, projects should self-assess:

```markdown
## Performance Impact Assessment

### Bundle Size
- [ ] No new large dependencies added (or justified)
- [ ] Using dynamic imports for heavy components
- [ ] Tree-shaking friendly imports

### Runtime Performance
- [ ] Convex queries use appropriate indexes
- [ ] No N+1 query patterns
- [ ] React components memoized where beneficial
- [ ] No unnecessary re-renders

### Loading Experience
- [ ] Loading states for async operations
- [ ] Skeleton screens for layout stability
- [ ] Progressive loading for large content
```

---

## IA & Automatisation → Back-end

### What IA Provides

IA defines prompts and LLM interaction patterns and specifies input/output contracts for AI operations. It handles AI safety, validation, and content moderation and documents cost implications and model selection.

### AI Action Contract

When IA designs an AI feature, it provides this contract to Back-end:

```typescript
/**
 * @action ai.generateQuizQuestions
 * @description Generates quiz questions from topic using LLM
 * @model gpt-4-turbo-preview (complex reasoning needed)
 * @estimatedCost ~$0.02 per call (500 input + 1000 output tokens)
 * 
 * @input topic: string - The subject matter for questions
 * @input difficulty: "easy" | "medium" | "hard"
 * @input count: number - Number of questions (1-10)
 * 
 * @output Array<{
 *   question: string,
 *   options: string[4],
 *   correctIndex: number (0-3),
 *   explanation: string
 * }>
 * 
 * @validation
 * - All outputs must pass validateQuizQuestion()
 * - Retry up to 3 times if validation fails
 * - Return partial results if some questions valid
 * 
 * @errors
 * - "AI service unavailable" - OpenAI API down
 * - "Invalid response format" - LLM returned unexpected format
 * - "Rate limit exceeded" - Too many requests
 * 
 * @prompt See src/lib/ai/prompts.ts QUIZ_GENERATOR
 */
```

### How Back-end Implements

Back-end implements the Convex action following IA's contract:

```typescript
// convex/actions/ai.ts
import { PROMPTS, renderPrompt } from "@/lib/ai/prompts";
import { validateQuizQuestion } from "@/lib/ai/validators";

export const generateQuizQuestions = action({
  args: {
    topic: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    // IA provided the prompt template
    const prompt = renderPrompt("QUIZ_GENERATOR", {
      topic: args.topic,
      difficulty: args.difficulty,
      count: String(args.count),
    });
    
    // Implementation using IA's specified model
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    
    // Validation per IA's contract
    const questions = JSON.parse(response.choices[0].message.content);
    return questions.filter(validateQuizQuestion);
  },
});
```

---

## Chief Architect → All Projects

### What Chief Architect Provides

Chief Architect provides routing decisions determining which projects handle each request. It conducts conflict resolution when projects disagree and produces consolidated instructions for Claude Code. Chief Architect maintains the DECISIONS.md log of architectural choices.

### Routing Contract

When Chief Architect routes a request, each project receives:

```markdown
## Routed Task: [Task Name]

### Context
[Why this task exists, business context]

### Your Responsibility
[Specific aspect this project should address]

### Questions to Answer
1. [Specific question for this project]
2. [Specific question for this project]

### Dependencies
- Waiting on: [Other project, if any]
- Blocking: [Projects waiting on this output]

### Expected Output Format
[What Chief Architect needs back]

### Deadline Context
[Urgency level: IMMEDIATE / HIGH / NORMAL / LOW]
```

### How Projects Respond

Each project responds in a consistent format:

```markdown
## Response: [Task Name]

### Summary
[One paragraph summary of recommendation]

### Detailed Analysis
[Full analysis with code examples if relevant]

### Confidence Level
[HIGH / MEDIUM / LOW] - [Justification]

### Impact on Other Projects
- [Project X]: [What they need to know]
- [Project Y]: [What they need to know]

### Risks & Alternatives
- Risk: [Potential issue]
  - Mitigation: [How to address]
- Alternative: [Other approach considered]
  - Why not: [Reason for rejection]

### Questions for Chief Architect
[Any clarifications needed before implementing]
```

---

## Interface Change Protocol

When any project needs to change an interface:

### Step 1: Propose Change

The proposing project documents:
- What interface is changing
- Why the change is needed
- Impact on consuming projects
- Migration path for existing code

### Step 2: Review

Chief Architect routes the proposal to affected projects for review:
- Does this break existing usage?
- Is the migration path acceptable?
- Are there better alternatives?

### Step 3: Decision

Chief Architect decides:
- APPROVE: Proceed with change
- MODIFY: Adjust proposal based on feedback
- REJECT: Keep existing interface, find alternative

### Step 4: Implementation

If approved:
- Provider implements new interface
- Provider documents the change
- Consumer projects migrate
- Old interface deprecated (if applicable)

### Step 5: Documentation

Update this INTERFACES.md document with:
- New interface contract
- Migration notes
- Deprecation timeline (if applicable)
