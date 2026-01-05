# Phase 0: Potion Template Extraction - Detailed Decomposition

**Status**: Ready for execution
**Priority**: CRITICAL - Blocks all other phases
**Estimated Duration**: 16-20 hours
**Agent Coordination**: system-architect → security-auditor → backend-engineer → frontend-engineer → design-system-expert

---

## Overview

This phase extracts and adapts the purchased Plate Pro Potion template from its original stack (better-auth, Prisma, tRPC) to our LMS stack (Clerk, Convex). This adaptation saves ~40 hours of development time and provides production-ready collaboration components.

**Critical Success Factors**:
- Complete understanding of Potion's architecture before extraction
- Clean separation between extracted code and stack-specific dependencies
- Documentation of ALL adaptation patterns for future reference
- Validation that extracted components integrate with our design system

---

## T000a: Clone Potion Template for Reference Extraction

**Original**: Clone Potion template to `/potion-source/` for reference extraction (DO NOT commit - add to .gitignore)

**Agent**: system-architect

### Sub-tasks:

1. Clone Potion template repository to `/Users/alexisdupre/potion-source/`
   - Use the purchased template repository URL
   - Ensure clean clone (no modifications)

2. Add `/potion-source/` to `.gitignore` in project root
   - Prevent accidental commits of proprietary code
   - Add comment explaining why it's ignored

3. Create README in `/potion-source/` documenting:
   - Template version/purchase date
   - Original repository URL
   - License information
   - Warning: "DO NOT MODIFY - Reference only"

4. Verify Potion template structure:
   - Run `npm install` or `pnpm install` to verify dependencies
   - Run `npm run dev` to confirm template works
   - Take screenshots of running template for reference

5. Create initial inventory checklist:
   - List all directories in Potion template
   - Identify key configuration files
   - Note Next.js version and structure differences

### Dependencies:
- Depends on: None (first task)
- Blocks: All other T000* tasks

### Deliverable:
- `/potion-source/` directory cloned and documented
- `/potion-source/.gitignore` entry added to project root
- `/potion-source/README.md` with template metadata
- Screenshots in `/potion-source/docs/reference-screenshots/`

---

## T000b: Audit Potion Component Inventory

**Original**: Audit Potion component inventory: document all editor components, sidebar components, collaboration hooks, and utilities

**Agent**: system-architect

### Sub-tasks:

1. Map directory structure to inventory categories:
   - Create `/specs/002-knowledge-base/potion-extraction/component-inventory.md`
   - Document each component category with file paths

2. **Editor Components Inventory**:
   - List all Plate.js plugin components in Potion
   - Document toolbar components and their props
   - Identify slash command implementations
   - List all custom block components (headings, lists, tables, callouts, etc.)
   - Note any custom Plate.js plugins

3. **Sidebar Components Inventory**:
   - Document sidebar layout structure
   - List navigation components (tree, breadcrumbs, etc.)
   - Identify favorites/recents sections
   - Note drag-and-drop implementations

4. **Collaboration Hooks Inventory**:
   - List all Hocuspocus-related hooks
   - Document YJS integration patterns
   - Identify cursor presence implementations
   - Note awareness/typing indicators

5. **Utilities Inventory**:
   - List utility functions related to editor
   - Document serialization/deserialization helpers
   - Identify validation utilities
   - Note any custom Plate.js utilities

6. Create component dependency graph:
   - Map which components depend on which
   - Identify shared utilities
   - Note any circular dependencies

7. Document component complexity scores:
   - XS: Simple presentational components
   - S: Components with local state
   - M: Components with external dependencies
   - L: Complex components with multiple integrations
   - XL: High-complexity components needing major refactoring

### Dependencies:
- Depends on: T000a (clone complete)
- Blocks: T000c (dependency mapping), T000k-T000q (extraction tasks)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/component-inventory.md`
  - Categorized component list with file paths
  - Component dependency graph
  - Complexity scores for each component
  - Total component count: ~50-100 components expected

---

## T000c: Map Potion Dependencies to Project Dependencies

**Original**: Map Potion dependencies to project dependencies: identify conflicts and version mismatches

**Agent**: system-architect

### Sub-tasks:

1. Extract Potion's `package.json` dependencies:
   - Copy Potion's `package.json` to `/specs/002-knowledge-base/potion-extraction/potion-package.json`
   - Create dependency comparison spreadsheet

2. Compare with project's current `package.json`:
   - Identify shared dependencies with version differences
   - Flag major version conflicts (e.g., React 18 vs 19)
   - Note dependencies that need upgrading

3. **Critical Dependency Analysis**:
   - **Plate.js**: Compare versions - project vs Potion
   - **React**: Verify compatibility (project uses React 19)
   - **Next.js**: Compare versions (project uses Next.js 15)
   - **Tailwind CSS**: Compare versions (project uses Tailwind 4)
   - **Radix UI**: Check for version differences
   - **YJS**: Verify YJS and Hocuspocus versions
   - **TypeScript**: Check TypeScript version compatibility

4. Identify Potion-specific dependencies to EXCLUDE:
   - `better-auth` - will be replaced with Clerk
   - `prisma` / `@prisma/client` - will be replaced with Convex
   - Any tRPC-related packages - will be replaced with Convex
   - Document why each is excluded

5. Identify dependencies to ADD to project:
   - Plate.js plugins Potion uses that we don't have
   - Hocuspocus packages
   - YJS packages
   - Any editor-specific utilities

6. Create migration plan:
   - Document which versions to use (prefer project's existing versions)
   - Identify compatibility risks
   - Note any breaking changes between versions
   - Plan for peer dependency conflicts

7. Generate dependency resolution table:
   ```markdown
   | Package | Potion Ver | Project Ver | Action | Risk |
   |---------|-----------|-------------|--------|------|
   | @platejs/core | x.x.x | y.y.y | Upgrade | Low |
   ```

### Dependencies:
- Depends on: T000b (component inventory complete)
- Blocks: T000d-T000q (all extraction tasks need dependency clarity)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/dependency-mapping.md`
  - Dependency comparison table
  - List of dependencies to add
  - List of dependencies to exclude
  - Version conflict resolution plan
  - Risk assessment for each major dependency change

---

## T000d: Extract and Adapt Auth Patterns (better-auth → Clerk)

**Original**: Extract and adapt auth patterns: replace better-auth session checks with Clerk `useAuth()` / `getAuth()`

**Agent**: security-auditor

### Sub-tasks:

1. Identify all better-auth usage in Potion:
   - Search for `better-auth` imports
   - Search for `useSession()` hooks
   - Search for `getSession()` server calls
   - Document file paths and usage contexts

2. Create auth pattern mapping document:
   - Map `useSession()` → `useAuth()` from Clerk
   - Map `getSession()` → `getAuth()` from Clerk
   - Map user object structure: better-auth user → Clerk user
   - Document session token patterns

3. **Client-side Auth Patterns**:
   - Replace `useSession()` with `useAuth()` and `useUser()`
   - Map Potion's session state to Clerk's auth state
   - Document loading states: `isLoaded`, `isSignedIn`
   - Note any custom session hooks to adapt

4. **Server-side Auth Patterns**:
   - Replace `getSession()` with `getAuth()` in Server Components
   - Map Potion's server auth checks to Clerk patterns
   - Document middleware usage if any
   - Note API route protection patterns

5. **User Object Mapping**:
   - Map better-auth user fields to Clerk user fields
   - Document ID format differences
   - Note any custom user metadata patterns
   - Identify fields that don't exist in Clerk (need custom storage)

6. Extract reusable auth utilities:
   - Identify auth helper functions worth keeping
   - Adapt to use Clerk instead of better-auth
   - Document any auth-related validation logic

7. Create code transformation examples:
   ```typescript
   // BEFORE (Potion with better-auth)
   const { user, session } = useSession();

   // AFTER (Our project with Clerk)
   const { userId, isLoaded, isSignedIn } = useAuth();
   const { user } = useUser();
   ```

### Dependencies:
- Depends on: T000c (dependency mapping complete)
- Blocks: T000k-T000q (components need auth patterns)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/auth-adaptation.md`
  - better-auth → Clerk mapping table
  - Code transformation examples (before/after)
  - List of files that need auth adaptation
  - User object field mapping
  - Custom auth utilities adapted for Clerk

---

## T000e: Update User Context Patterns

**Original**: Update user context patterns: replace Potion's `useSession()` with project's existing Clerk patterns

**Agent**: security-auditor

### Sub-tasks:

1. Audit existing Clerk patterns in project:
   - Read `/src/contexts/` for any existing auth contexts
   - Review how project currently uses Clerk
   - Document project's auth conventions

2. Identify Potion's context providers:
   - Find all React Context providers in Potion
   - Document SessionProvider or AuthProvider usage
   - Note any user preference contexts

3. Map Potion contexts to project patterns:
   - Determine which contexts to keep
   - Identify contexts that duplicate Clerk functionality
   - Document contexts that provide non-auth features

4. **Consolidation Strategy**:
   - Keep: Contexts for editor state, collaboration state
   - Remove: Contexts that duplicate Clerk (auth, user)
   - Adapt: Contexts that mix auth with other concerns

5. Create context provider hierarchy:
   - Document where to mount Potion-extracted providers
   - Ensure compatibility with existing `<ConvexProviderWithClerk>`
   - Note any provider ordering requirements

6. Extract non-auth user context utilities:
   - User preferences (theme, editor settings)
   - User presence data (for collaboration)
   - Any custom user state management

7. Document integration points:
   ```typescript
   // Project's existing pattern
   <ConvexProviderWithClerk>
     {/* Potion-extracted providers here */}
     <EditorProvider>
       <CollaborationProvider>
         {children}
       </CollaborationProvider>
     </EditorProvider>
   </ConvexProviderWithClerk>
   ```

### Dependencies:
- Depends on: T000d (auth patterns mapped)
- Blocks: T000k (editor wrapper needs context clarity)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/context-adaptation.md`
  - Context provider hierarchy diagram
  - List of contexts to keep/remove/adapt
  - Integration guide with existing project providers
  - User context patterns adapted for Clerk + Convex

---

## T000f: Map Prisma Models to Convex Schema

**Original**: Map Prisma models to Convex schema: document equivalent table structures

**Agent**: backend-engineer

### Sub-tasks:

1. Extract Prisma schema from Potion:
   - Copy `prisma/schema.prisma` to `/specs/002-knowledge-base/potion-extraction/prisma-schema.prisma`
   - Document all models related to documents/editor

2. Identify Potion's data models:
   - Document model: User (note: we use Clerk for auth)
   - Document model: Document
   - Document model: Folder/Workspace (if exists)
   - Document model: Version (if exists)
   - Document model: Comment (if exists)
   - Document model: Collaboration session (if exists)

3. **Field-by-Field Mapping**:
   For each Prisma model, create Convex table equivalent:
   - Map `@id String @default(uuid())` → Convex `Id<"table">`
   - Map `@db.Text` → Convex `v.string()`
   - Map `DateTime @default(now())` → Convex `v.number()` (timestamp)
   - Map relations → Convex IDs with indexes
   - Map enums → Convex unions or strings with validation

4. **Index Mapping**:
   - Document Prisma `@@index` declarations
   - Map to Convex `.index()` calls
   - Note compound indexes (multi-field)
   - Identify unique constraints

5. Create schema migration guide:
   ```typescript
   // BEFORE (Prisma)
   model Document {
     id        String   @id @default(uuid())
     title     String
     content   String   @db.Text
     createdAt DateTime @default(now())
     author    User     @relation(...)
   }

   // AFTER (Convex)
   kbDocuments: defineTable({
     title: v.string(),
     content: v.string(), // Large text in Convex
     createdAt: v.number(), // Date.now()
     authorId: v.id("users"),
   }).index("by_author", ["authorId"]),
   ```

6. Identify data model gaps:
   - Fields in Prisma that don't map cleanly to Convex
   - Relations that need restructuring
   - Cascade delete patterns to implement manually

7. Document validation patterns:
   - Note Prisma validators that need Zod equivalents
   - Identify length limits on fields
   - Document required vs optional fields

### Dependencies:
- Depends on: T000c (dependency mapping complete)
- Blocks: T000g, T000h (query/mutation patterns need schema clarity)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/schema-mapping.md`
  - Prisma → Convex table mapping for each model
  - Field type conversion guide
  - Index migration checklist
  - Validation pattern adaptations
  - Data model gap analysis

---

## T000g: Extract Query Patterns (Prisma → Convex)

**Original**: Extract query patterns: convert Prisma queries to Convex query syntax

**Agent**: backend-engineer

### Sub-tasks:

1. Identify all Prisma query patterns in Potion:
   - Search for `prisma.findUnique()`
   - Search for `prisma.findMany()`
   - Search for `prisma.findFirst()`
   - Document usage contexts and file paths

2. **Single Record Queries**:
   - Map `findUnique({ where: { id } })` → Convex `ctx.db.get(id)`
   - Map `findFirst({ where: { slug } })` → Convex `.withIndex("by_slug", q => q.eq("slug", slug)).first()`
   - Document error handling patterns

3. **List Queries**:
   - Map `findMany({ where, orderBy, take })` → Convex query patterns
   - Document pagination: Prisma `skip/take` → Convex `paginate()`
   - Map filtering: Prisma `where` → Convex `.filter()`
   - Map sorting: Prisma `orderBy` → Convex `.order()`

4. **Relation Queries**:
   - Map `include: { author: true }` → Convex manual joins via `ctx.db.get()`
   - Document nested includes that need multiple queries
   - Identify N+1 query patterns to optimize

5. **Aggregation Queries**:
   - Map `count()` operations
   - Document any `groupBy` patterns
   - Note aggregations that need custom logic

6. Create query conversion examples:
   ```typescript
   // BEFORE (Prisma in tRPC)
   const documents = await prisma.document.findMany({
     where: { folderId, published: true },
     include: { author: true },
     orderBy: { createdAt: 'desc' },
     take: 20,
   });

   // AFTER (Convex)
   const documents = await ctx.db
     .query("kbDocuments")
     .withIndex("by_folder", q => q.eq("folderId", folderId))
     .filter(q => q.eq(q.field("published"), true))
     .order("desc")
     .take(20)
     .collect();

   // Manual join for author
   const documentsWithAuthor = await Promise.all(
     documents.map(async doc => ({
       ...doc,
       author: await ctx.db.get(doc.authorId),
     }))
   );
   ```

7. Document Convex-specific optimizations:
   - Use indexes instead of filters where possible
   - Batch gets for relations
   - Real-time subscription patterns

### Dependencies:
- Depends on: T000f (schema mapping complete)
- Blocks: T000k-T000q (components need query patterns)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/query-patterns.md`
  - Prisma → Convex query conversion guide
  - Code examples for each query type
  - Relation handling patterns
  - Pagination/filtering/sorting guide
  - Performance optimization notes

---

## T000h: Extract Mutation Patterns (Prisma → Convex)

**Original**: Extract mutation patterns: convert Prisma mutations to Convex mutation syntax

**Agent**: backend-engineer

### Sub-tasks:

1. Identify all Prisma mutation patterns in Potion:
   - Search for `prisma.create()`
   - Search for `prisma.update()`
   - Search for `prisma.delete()`
   - Search for `prisma.upsert()`
   - Document usage contexts

2. **Create Mutations**:
   - Map `create({ data })` → Convex `ctx.db.insert("table", data)`
   - Document ID generation: Prisma UUID → Convex auto-generated ID
   - Note any `createMany` bulk operations

3. **Update Mutations**:
   - Map `update({ where: { id }, data })` → Convex `ctx.db.patch(id, data)`
   - Document partial updates
   - Note conditional updates (`updateMany`)

4. **Delete Mutations**:
   - Map `delete({ where: { id } })` → Convex `ctx.db.delete(id)`
   - Document cascade delete patterns (manual implementation needed)
   - Note soft deletes (archive instead of delete)

5. **Transaction Patterns**:
   - Identify Prisma transactions (`prisma.$transaction`)
   - Document how to handle in Convex (mutations are atomic by default)
   - Note any multi-step operations needing careful ordering

6. Create mutation conversion examples:
   ```typescript
   // BEFORE (Prisma in tRPC)
   const document = await prisma.document.create({
     data: {
       title,
       content,
       authorId: session.userId,
       folderId,
     },
   });

   // AFTER (Convex)
   const documentId = await ctx.db.insert("kbDocuments", {
     title,
     content,
     authorId: userId,
     folderId,
     createdAt: Date.now(),
   });
   ```

7. **Validation Patterns**:
   - Extract validation logic from Prisma mutations
   - Map to Zod schemas for Convex
   - Document error handling patterns

8. Document Convex-specific patterns:
   - Use `requireAuth()` at start of mutations
   - Validate permissions before mutations
   - Return IDs vs full objects

### Dependencies:
- Depends on: T000f (schema mapping complete)
- Blocks: T000k-T000q (components need mutation patterns)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/mutation-patterns.md`
  - Prisma → Convex mutation conversion guide
  - Code examples for create/update/delete
  - Transaction handling guide
  - Validation pattern adaptations
  - Error handling patterns

---

## T000i: Map tRPC Router Structure to Convex Function Organization

**Original**: Map tRPC router structure to Convex function organization

**Agent**: backend-engineer

### Sub-tasks:

1. Document Potion's tRPC router structure:
   - List all router files
   - Document router nesting (if any)
   - Note procedure naming conventions

2. **Router → File Mapping**:
   - Map tRPC router: `document` → Convex file: `convex/knowledge/documents.ts`
   - Map tRPC router: `folder` → Convex file: `convex/knowledge/folders.ts`
   - Map tRPC router: `workspace` → Convex file: `convex/knowledge/workspaces.ts`
   - Document any other routers

3. **Procedure Organization**:
   - Map tRPC procedures to Convex function exports
   - Document which procedures are queries vs mutations
   - Note any procedures that should be actions (external APIs)

4. Create file structure mapping:
   ```
   Potion tRPC:
   src/server/routers/
     ├── document.ts  (create, update, delete, list, get)
     ├── folder.ts    (create, update, list)
     └── index.ts     (merges routers)

   Our Convex:
   convex/knowledge/
     ├── documents.ts (queries + mutations)
     ├── folders.ts   (queries + mutations)
     └── workspaces.ts
   ```

5. **Naming Convention Mapping**:
   - Map tRPC procedure names to Convex function names
   - Document conventions: `document.create` → `export const create = mutation(...)`
   - Note any naming conflicts to resolve

6. Identify shared utilities:
   - Extract helper functions from tRPC routers
   - Determine if they should be in `convex/lib/` or inline
   - Document any router middleware to adapt

7. Document calling patterns:
   ```typescript
   // BEFORE (tRPC client)
   const { data } = trpc.document.create.useMutation();

   // AFTER (Convex client)
   const createDocument = useMutation(api.knowledge.documents.create);
   ```

### Dependencies:
- Depends on: T000g, T000h (query/mutation patterns extracted)
- Blocks: T000j (procedure patterns need structure clarity)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/api-organization.md`
  - tRPC router → Convex file mapping
  - Procedure naming conventions
  - File structure comparison diagram
  - Shared utility extraction list
  - Client-side calling pattern guide

---

## T000j: Convert tRPC Procedure Patterns to Convex Patterns

**Original**: Convert tRPC procedure patterns to Convex query/mutation/action patterns

**Agent**: backend-engineer

### Sub-tasks:

1. Identify tRPC procedure types in Potion:
   - List all `.query()` procedures
   - List all `.mutation()` procedures
   - Document any middleware usage

2. **Query Procedure Conversion**:
   - Map tRPC `.query()` → Convex `query({ ... })`
   - Extract input validation: Zod schema → Convex `args:` validator
   - Document resolver logic to adapt

3. **Mutation Procedure Conversion**:
   - Map tRPC `.mutation()` → Convex `mutation({ ... })`
   - Extract input validation
   - Document side effects and return values

4. **Action Identification**:
   - Identify procedures that call external APIs
   - Map to Convex `action({ ... })`
   - Document which procedures need to be actions

5. **Middleware Adaptation**:
   - Extract tRPC middleware: auth checks
   - Map to Convex: `requireAuth()` / `requireAdmin()` at start of handler
   - Document any custom middleware logic

6. Create procedure conversion template:
   ```typescript
   // BEFORE (tRPC)
   export const documentRouter = router({
     create: protectedProcedure
       .input(z.object({
         title: z.string(),
         folderId: z.string().optional(),
       }))
       .mutation(async ({ ctx, input }) => {
         return await ctx.prisma.document.create({
           data: {
             ...input,
             authorId: ctx.session.userId,
           },
         });
       }),
   });

   // AFTER (Convex)
   export const create = mutation({
     args: {
       title: v.string(),
       folderId: v.optional(v.id("kbFolders")),
     },
     handler: async (ctx, args) => {
       const userId = await requireAuth(ctx);

       return await ctx.db.insert("kbDocuments", {
         ...args,
         authorId: userId,
         createdAt: Date.now(),
       });
     },
   });
   ```

7. **Error Handling Adaptation**:
   - Map tRPC error types (`TRPCError`) → Convex `ConvexError`
   - Document error code mappings
   - Note any custom error handling

8. Document real-time patterns:
   - Identify queries that should use Convex subscriptions
   - Note optimistic update patterns
   - Document any polling that can become reactive

### Dependencies:
- Depends on: T000i (router structure mapped)
- Blocks: T000k-T000q (components need API patterns)

### Deliverable:
- `/specs/002-knowledge-base/potion-extraction/procedure-patterns.md`
  - tRPC procedure → Convex function conversion guide
  - Code templates for each pattern
  - Input validation (Zod) mapping
  - Middleware → auth helper guide
  - Error handling adaptations
  - Real-time subscription opportunities

---

## T000k: Extract Core Editor Wrapper Component

**Original**: Extract core editor wrapper component (adapt styles to project design system)

**Agent**: frontend-engineer

### Sub-tasks:

1. Locate Potion's main editor component:
   - Identify the root editor wrapper (likely `<Editor>` or `<PlateEditor>`)
   - Document file path in Potion template
   - Note all props and configuration

2. **Extract Plate.js Configuration**:
   - Copy Plate.js plugin configuration
   - Document which plugins are used
   - Note plugin ordering (critical for Plate.js)

3. **Extract Editor State Management**:
   - Document how Potion initializes editor state
   - Note value/onChange patterns
   - Identify any custom editor store/context

4. **Style Extraction and Adaptation**:
   - Extract editor container styles
   - Map Potion's design tokens to our Tailwind config
   - Adapt to use our design system colors/spacing
   - Document any custom CSS needed

5. Create adapted component:
   ```typescript
   // File: src/components/knowledge/document-editor/index.tsx

   "use client";

   import { Plate } from '@platejs/core';
   import { plugins } from './plugins'; // From Potion

   export function DocumentEditor({ ... }) {
     // Adapted from Potion's editor wrapper
     // Using our design system styles
   }
   ```

6. **Integration Points**:
   - Add auto-save hook integration point
   - Add collaboration provider integration point (YJS)
   - Add props for document ID, initial content

7. Document component API:
   - List all required props
   - Document optional props
   - Note callback functions (onChange, onSave, etc.)
   - Provide usage examples

8. Test editor wrapper in isolation:
   - Create test page: `src/app/(dashboard)/knowledge/__test__/editor.tsx`
   - Verify basic editing works
   - Verify styles match design system

### Dependencies:
- Depends on: T000b (component inventory), T000e (context patterns), T000j (API patterns)
- Blocks: T020 (editor integration in Phase 3)

### Deliverable:
- `/src/components/knowledge/document-editor/index.tsx` (adapted editor wrapper)
- `/src/components/knowledge/document-editor/plugins.ts` (Plate.js config from Potion)
- `/specs/002-knowledge-base/potion-extraction/editor-wrapper-adaptation.md`
  - Component API documentation
  - Style adaptation notes
  - Integration guide
  - Test results

---

## T000l: Extract Toolbar Components

**Original**: Extract toolbar components (adapt to shadcn/ui patterns)

**Agent**: design-system-expert

### Sub-tasks:

1. Locate Potion's toolbar components:
   - Find main toolbar container
   - List all toolbar button components
   - Document toolbar sections (formatting, blocks, etc.)

2. **Toolbar Structure Analysis**:
   - Document toolbar layout (fixed, floating, inline)
   - Note responsive behavior
   - Identify toolbar groups/sections

3. **Button Component Extraction**:
   - Extract individual toolbar buttons (Bold, Italic, Heading, etc.)
   - Document button states (active, disabled, hover)
   - Note icon usage patterns

4. **Adapt to shadcn/ui**:
   - Replace Potion's button components with our shadcn Button
   - Use our Toggle component for format buttons
   - Apply our design system to toolbar styling

5. Create toolbar components:
   ```
   src/components/knowledge/document-editor/
     ├── toolbar.tsx           (main toolbar container)
     ├── toolbar-group.tsx     (section grouping)
     ├── toolbar-button.tsx    (reusable button - shadcn)
     └── toolbar-separator.tsx (visual separator)
   ```

6. **Extract Toolbar Buttons**:
   - Format buttons: Bold, Italic, Underline, Strikethrough, Code
   - Heading buttons: H1, H2, H3
   - List buttons: Bullet List, Numbered List, Task List
   - Block buttons: Quote, Code Block, Divider
   - Insert buttons: Link, Image, Table

7. Document toolbar customization:
   - How to add/remove buttons
   - How to create custom toolbar buttons
   - Keyboard shortcut integration

8. Test toolbar in isolation:
   - Verify all buttons trigger correct Plate.js commands
   - Test active states reflect editor selection
   - Verify responsive behavior

### Dependencies:
- Depends on: T000b (component inventory), T000k (editor wrapper)
- Blocks: T021 (toolbar integration in Phase 3)

### Deliverable:
- `/src/components/knowledge/document-editor/toolbar.tsx`
- `/src/components/knowledge/document-editor/toolbar-*.tsx` (sub-components)
- `/specs/002-knowledge-base/potion-extraction/toolbar-adaptation.md`
  - Toolbar structure documentation
  - shadcn/ui component mappings
  - Customization guide
  - Test results

---

## T000m: Extract Slash Command Menu

**Original**: Extract slash command menu (adapt to existing command patterns)

**Agent**: frontend-engineer

### Sub-tasks:

1. Locate Potion's slash command implementation:
   - Find slash command trigger logic
   - Document command menu component
   - Note command definitions

2. **Slash Command Structure**:
   - Extract command registry/definition pattern
   - Document command categories (Blocks, AI, Media, etc.)
   - Note search/filter logic

3. **Menu Component Extraction**:
   - Extract popover/dropdown component
   - Document positioning logic (cursor position)
   - Note keyboard navigation (arrow keys, enter)

4. **Command Definitions**:
   - List all built-in commands from Potion:
     - Block commands: Heading, List, Quote, Code, etc.
     - AI commands: /ai, /summarize, /translate, etc.
     - Media commands: /image, /video, /embed, etc.
   - Document command handler patterns

5. Adapt to project patterns:
   - Use shadcn Command component if available
   - Integrate with our existing command palette patterns
   - Apply design system styling

6. Create slash command components:
   ```
   src/components/knowledge/document-editor/
     ├── slash-commands.tsx       (main slash command logic)
     ├── slash-menu.tsx           (command menu UI)
     └── commands/
         ├── block-commands.ts    (heading, list, quote, etc.)
         ├── ai-commands.ts       (AI-powered commands)
         └── media-commands.ts    (image, video, embed)
   ```

7. **Integration with Plate.js**:
   - Extract slash command plugin configuration
   - Document how commands insert blocks
   - Note any custom slash command logic

8. Document command extension API:
   - How to add custom commands
   - Command definition schema
   - Icon/label patterns

### Dependencies:
- Depends on: T000b (component inventory), T000k (editor wrapper)
- Blocks: T022 (slash command integration in Phase 3)

### Deliverable:
- `/src/components/knowledge/document-editor/slash-commands.tsx`
- `/src/components/knowledge/document-editor/slash-menu.tsx`
- `/src/components/knowledge/document-editor/commands/*.ts`
- `/specs/002-knowledge-base/potion-extraction/slash-commands-adaptation.md`
  - Command structure documentation
  - Extension API guide
  - Plate.js integration notes

---

## T000n: Extract Block Components

**Original**: Extract block components (headings, lists, tables, callouts, etc.)

**Agent**: design-system-expert

### Sub-tasks:

1. Identify all Plate.js block components in Potion:
   - Heading blocks (H1, H2, H3)
   - Paragraph
   - Lists (bullet, numbered, task/checkbox)
   - Quote/Blockquote
   - Code block with syntax highlighting
   - Callout/Alert blocks
   - Table
   - Divider/Separator
   - Image block
   - Any custom blocks

2. **For Each Block Component**:

   a. Extract component implementation
   b. Document props and behavior
   c. Extract styles → adapt to our Tailwind config
   d. Note any custom Plate.js plugin logic
   e. Test in isolation

3. **Priority Block Extraction Order**:
   - **Critical** (needed for MVP):
     - Heading (h1, h2, h3)
     - Paragraph
     - Bullet List, Numbered List
     - Quote
     - Code Block
   - **Important** (nice to have):
     - Task List
     - Callout
     - Table
     - Divider
   - **Optional** (can implement later):
     - Custom blocks specific to Potion

4. Style Adaptation Strategy:
   - Map Potion's typography to our design system
   - Use our Tailwind prose classes where applicable
   - Ensure consistent spacing/sizing
   - Maintain accessibility (headings, lists, etc.)

5. Create block component structure:
   ```
   src/components/knowledge/document-editor/blocks/
     ├── heading-block.tsx
     ├── paragraph-block.tsx
     ├── list-block.tsx
     ├── quote-block.tsx
     ├── code-block.tsx
     ├── callout-block.tsx
     ├── table-block.tsx
     ├── divider-block.tsx
     ├── image-block.tsx
     └── index.ts (exports all blocks)
   ```

6. **Code Block Syntax Highlighting**:
   - Extract syntax highlighting implementation
   - Document language support
   - Note any Prism.js or highlight.js usage

7. **Table Block**:
   - Extract table implementation (likely complex)
   - Document row/column operations
   - Note any table editing plugins

8. Document block component API:
   - Props for each block type
   - Customization options
   - Plate.js plugin requirements

### Dependencies:
- Depends on: T000b (component inventory), T000k (editor wrapper)
- Blocks: T023 (block integration in Phase 3)

### Deliverable:
- `/src/components/knowledge/document-editor/blocks/*.tsx` (all block components)
- `/specs/002-knowledge-base/potion-extraction/blocks-adaptation.md`
  - Block component catalog
  - Style adaptation notes
  - Plate.js plugin requirements
  - Customization guide

---

## T000o: Extract Hocuspocus Client Configuration

**Original**: Extract Hocuspocus client configuration (adapt connection settings for self-hosted)

**Agent**: backend-engineer

### Sub-tasks:

1. Locate Hocuspocus client setup in Potion:
   - Find HocuspocusProvider initialization
   - Document connection configuration
   - Note authentication patterns

2. **Client Configuration Extraction**:
   - Extract provider initialization code
   - Document connection URL patterns
   - Note WebSocket configuration
   - Identify reconnection logic

3. **Authentication Adaptation**:
   - Extract token-based auth pattern
   - Map Potion's auth to Clerk tokens
   - Document token refresh logic
   - Note any permission checks on connection

4. Create Hocuspocus configuration:
   ```typescript
   // File: src/lib/knowledge/hocuspocus-config.ts

   import { HocuspocusProvider } from '@hocuspocus/provider';
   import * as Y from 'yjs';

   export function createHocuspocusProvider(documentId: string, token: string) {
     const ydoc = new Y.Doc();

     const provider = new HocuspocusProvider({
       url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!,
       name: documentId,
       document: ydoc,
       token, // From Convex action: getHocuspocusToken
       // ... other config from Potion
     });

     return { ydoc, provider };
   }
   ```

5. **YJS Document Setup**:
   - Extract YJS document initialization
   - Document how content is bound to YJS
   - Note any custom YJS types used

6. **Connection Lifecycle**:
   - Extract connect/disconnect patterns
   - Document cleanup logic
   - Note any connection state management

7. Environment variable setup:
   - Document required env vars:
     - `NEXT_PUBLIC_HOCUSPOCUS_URL` (WebSocket URL)
     - `HOCUSPOCUS_SECRET` (server-side only)
   - Note development vs production URLs

8. Document self-hosting considerations:
   - Connection URL format for Railway/Render/Fly.io
   - WebSocket proxy requirements (if any)
   - CORS configuration notes

### Dependencies:
- Depends on: T000b (component inventory), T000d (auth patterns)
- Blocks: T046 (YJS integration in Phase 5)

### Deliverable:
- `/src/lib/knowledge/hocuspocus-config.ts`
- `/specs/002-knowledge-base/potion-extraction/hocuspocus-client.md`
  - Client configuration guide
  - Authentication integration
  - Environment variable documentation
  - Self-hosting setup notes

---

## T000p: Extract Cursor Presence Components

**Original**: Extract cursor presence components (adapt user color/avatar display)

**Agent**: frontend-engineer

### Sub-tasks:

1. Locate cursor/presence components in Potion:
   - Find cursor overlay component
   - Document user presence indicator
   - Note color assignment logic

2. **Cursor Component Extraction**:
   - Extract cursor SVG/component
   - Document cursor positioning logic
   - Note animation patterns (smooth movement)

3. **User Color Assignment**:
   - Extract color palette for users
   - Document color assignment algorithm
   - Note how colors are persisted/shared

4. **Avatar Integration**:
   - Extract user avatar display in cursor
   - Map to Clerk user avatar URL
   - Document fallback patterns (initials)

5. Create presence components:
   ```
   src/components/knowledge/collaboration/
     ├── cursors.tsx           (cursor overlay manager)
     ├── cursor.tsx            (single user cursor)
     ├── user-avatar.tsx       (cursor avatar display)
     └── presence-indicator.tsx (user list)
   ```

6. **Awareness Protocol**:
   - Extract YJS awareness state management
   - Document cursor position updates
   - Note selection range sharing

7. Adapt to project patterns:
   - Use Clerk user data for names/avatars
   - Apply our design system colors
   - Ensure responsive cursor display

8. **Performance Considerations**:
   - Note cursor update throttling
   - Document max concurrent cursors display
   - Extract any virtualization logic

### Dependencies:
- Depends on: T000b (component inventory), T000o (Hocuspocus config)
- Blocks: T047, T048 (cursor/presence integration in Phase 5)

### Deliverable:
- `/src/components/knowledge/collaboration/cursors.tsx`
- `/src/components/knowledge/collaboration/cursor.tsx`
- `/src/components/knowledge/collaboration/user-avatar.tsx`
- `/specs/002-knowledge-base/potion-extraction/cursor-presence.md`
  - Cursor component architecture
  - Color assignment algorithm
  - Clerk integration guide
  - Performance notes

---

## T000q: Extract Awareness/Typing Indicator Components

**Original**: Extract awareness/typing indicator components

**Agent**: frontend-engineer

### Sub-tasks:

1. Locate awareness components in Potion:
   - Find typing indicator UI
   - Document "who's editing" list component
   - Note real-time status updates

2. **Typing Indicator Extraction**:
   - Extract typing animation component
   - Document when typing state is shown
   - Note typing timeout logic (user stops typing)

3. **Active Users List**:
   - Extract user presence list component
   - Document how users are displayed
   - Note sorting/ordering logic

4. **Awareness State Management**:
   - Extract YJS awareness state structure:
     ```typescript
     {
       user: { id, name, avatar, color },
       cursor: { x, y, selection },
       typing: boolean,
       lastSeen: timestamp,
     }
     ```
   - Document state update patterns
   - Note cleanup on user disconnect

5. Create awareness components:
   ```
   src/components/knowledge/collaboration/
     ├── awareness.tsx          (awareness state manager)
     ├── typing-indicator.tsx   (typing animation)
     ├── active-users.tsx       (user list)
     └── user-badge.tsx         (user chip with color)
   ```

6. **Integration with Editor**:
   - Document how typing state is detected
   - Note integration with editor onChange
   - Extract debounce/throttle logic

7. Adapt to project patterns:
   - Use Clerk user data
   - Apply our Badge/Avatar components
   - Use our design system for colors

8. **Real-time Updates**:
   - Document awareness subscription pattern
   - Note update frequency
   - Extract any rate limiting

### Dependencies:
- Depends on: T000b (component inventory), T000o (Hocuspocus config), T000p (cursor presence)
- Blocks: T049 (awareness integration in Phase 5)

### Deliverable:
- `/src/components/knowledge/collaboration/awareness.tsx`
- `/src/components/knowledge/collaboration/typing-indicator.tsx`
- `/src/components/knowledge/collaboration/active-users.tsx`
- `/specs/002-knowledge-base/potion-extraction/awareness-adaptation.md`
  - Awareness state structure
  - Typing detection logic
  - Real-time update patterns
  - Clerk integration guide

---

## Phase 0 Checkpoint Criteria

**Before proceeding to Phase 1, verify:**

- [ ] All T000a-T000q tasks completed
- [ ] Component inventory documented with 50+ components cataloged
- [ ] Dependency mapping complete with version conflict resolutions
- [ ] Auth patterns documented (better-auth → Clerk mapping)
- [ ] Database patterns documented (Prisma → Convex mapping)
- [ ] API patterns documented (tRPC → Convex mapping)
- [ ] Editor components extracted and adapted to design system
- [ ] Collaboration components extracted with Hocuspocus config
- [ ] All extraction artifacts in `/specs/002-knowledge-base/potion-extraction/`
- [ ] Test page created demonstrating extracted editor works
- [ ] No Potion source code committed to project (verify `.gitignore`)

**Estimated Time Savings**: ~40 hours of development time by adapting Potion vs building from scratch

**Cost Savings**: ~$130/month by using self-hosted Hocuspocus vs Liveblocks Cloud

**Risk Assessment**:
- **Low Risk**: Standard components (headings, lists, quotes)
- **Medium Risk**: Complex components (tables, collaboration)
- **High Risk**: Stack-specific code requiring heavy adaptation (auth, database)

**Next Phase**: Phase 1 - Setup (install dependencies, configure based on Phase 0 extractions)

---

## Agent Coordination Summary

### Sequential Dependencies:

```
T000a (clone)
  → T000b (inventory)
    → T000c (dependencies)
      → T000d (auth) → T000e (context)
      → T000f (schema) → T000g (queries) → T000h (mutations)
      → T000i (API org) → T000j (procedures)
      → T000k (editor wrapper)
        → T000l (toolbar)
        → T000m (slash commands)
        → T000n (blocks)
      → T000o (Hocuspocus)
        → T000p (cursors)
        → T000q (awareness)
```

### Parallel Opportunities:

After T000c completes, these can run in parallel:
- **Auth track**: T000d → T000e
- **Database track**: T000f → T000g + T000h (g and h parallel)
- **API track**: T000i → T000j

After T000k completes, these can run in parallel:
- T000l (toolbar)
- T000m (slash commands)
- T000n (blocks)

After T000o completes, these can run in parallel:
- T000p (cursors)
- T000q (awareness)

### Critical Path:
T000a → T000b → T000c → T000k → (all others)

Total estimated time: **16-20 hours** (with parallelization)
Without parallelization: **25-30 hours**

---

**End of Phase 0 Decomposition**
