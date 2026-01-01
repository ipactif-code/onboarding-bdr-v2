# Research: Onboarding BDR Team v2 LMS

**Date**: 2025-12-06
**Branch**: `001-bdr-lms`

## Technology Decisions

### 1. Framework: Next.js 15 with App Router

**Decision**: Next.js 15.5.7 with React 19.2.1 (patched for CVE-2025-66478 and CVE-2025-55182), App Router, Turbopack

**Rationale**:
- Latest stable version with critical security patches (15.5.7)
- React 19.2.1 patched for known vulnerabilities
- React 19 support with Server Components and Actions
- Turbopack for faster development builds
- Built-in TypeScript support with strict mode
- Excellent Vercel deployment integration
- Server Components reduce client bundle size (constitution: <150KB gzipped)

**Key Features Used**:
- App Router for file-based routing
- Server Components for initial page loads
- Client Components for interactive features
- Route groups for layout organization `(auth)`, `(dashboard)`

### 2. Backend: Convex

**Decision**: Convex as the complete backend solution

**Rationale**:
- **Real-time by default**: All queries automatically subscribe to updates - perfect for messaging, comments, presence status
- **TypeScript-native**: End-to-end type safety from database schema to React hooks
- **Built-in file storage**: No separate S3 configuration needed for file uploads
- **Serverless functions**: Queries (read), mutations (write), actions (external calls)
- **ACID transactions**: Automatic consistency guarantees
- **No infrastructure management**: Managed service with automatic scaling

**Architecture Pattern**:
```
React Component
    │
    ├── useQuery(api.courses.list)     ← Real-time subscription
    ├── useMutation(api.courses.create) ← Optimistic updates
    │
    └── Convex Cloud
        ├── Query functions (cached, reactive)
        ├── Mutation functions (transactional)
        ├── Action functions (external APIs)
        └── Built-in file storage
```

**Why Not Traditional Backend**:
- No need for separate REST/GraphQL API layer
- Real-time comes free (vs. maintaining WebSocket infrastructure)
- Type generation eliminates API contract drift
- Built-in file storage vs. S3 configuration

### 3. Authentication: Clerk

**Decision**: Clerk for enterprise authentication

**Rationale**:
- **MFA built-in**: Constitution requires MFA support - Clerk provides TOTP, SMS, email
- **SSO ready**: Enterprise SSO (SAML, OIDC) for future growth
- **Organizations**: Built-in concept maps to Teams
- **Webhook sync**: Real-time user sync to Convex via webhooks
- **Prebuilt components**: `<SignIn>`, `<SignUp>`, `<UserButton>` reduce UI work
- **Session management**: Handles token refresh, session invalidation

**Integration with Convex**:
```typescript
// Clerk webhook syncs users to Convex
export const syncClerkUser = internalMutation({
  args: { clerkId: v.string(), email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    // Upsert user in Convex when Clerk user created/updated
  }
});
```

**Why Not NextAuth**:
- Clerk handles MFA out of the box (NextAuth requires custom implementation)
- Organizations feature maps directly to Teams requirement
- Less code to maintain for auth flows
- Enterprise SSO without additional configuration

### 4. Rich Text Editor: Plate.js v52+

**Decision**: Plate.js from platejs.org CLI (specified in requirements)

**Rationale**:
- Explicitly required by specification
- Plugin-based architecture for all required features
- TypeScript-first design
- Active development and documentation
- CLI installation for easy setup

**Required Plugins**:
- `@udecode/plate-basic-marks` - Bold, italic, underline
- `@udecode/plate-heading` - Headings
- `@udecode/plate-list` - Lists
- `@udecode/plate-table` - Tables
- `@udecode/plate-code-block` - Code blocks
- `@udecode/plate-media` - Images
- `@udecode/plate-mention` - @mentions
- `@udecode/plate-toggle` - Toggle blocks
- `@udecode/plate-column` - Multi-column layouts
- `@udecode/plate-callout` - Callout blocks

**Content Storage**:
- Store as JSON in Convex document field
- Serialize/deserialize via Plate's built-in methods
- Sanitize on render (DOMPurify) for XSS prevention per constitution

### 5. UI Components: shadcn/ui + Tailwind CSS 4.x

**Decision**: shadcn/ui component library with Tailwind CSS 4.x

**Rationale**:
- shadcn/ui components are copy-paste (not a dependency)
- Built on Radix UI primitives for accessibility (WCAG 2.1 AA)
- Tailwind 4.x for mobile-first responsive design
- New CSS-first configuration in Tailwind 4
- Easy theming and customization

**Accessibility Features**:
- Keyboard navigation built into Radix primitives
- Focus management and indicators
- ARIA attributes handled by primitives
- Color contrast utilities

### 6. State Management: Convex + React Hook Form

**Decision**:
- Convex queries/mutations for server state
- React Hook Form + Zod for form state and validation

**Rationale**:
- **Convex replaces React Query**: `useQuery` and `useMutation` hooks provide:
  - Automatic caching
  - Real-time updates
  - Optimistic updates
  - Loading/error states
- **React Hook Form**: Performant form handling with minimal re-renders
- **Zod**: Schema validation that integrates with both RHF and TypeScript

**Pattern**:
```typescript
// Server state - Convex
const courses = useQuery(api.courses.list);

// Form state - React Hook Form + Zod
const form = useForm<CourseFormData>({
  resolver: zodResolver(courseSchema),
});
```

### 7. Data Tables: TanStack Table v8

**Decision**: TanStack Table v8 for analytics and list views

**Rationale**:
- Headless - full control over UI
- TypeScript-first
- Built-in sorting, filtering, pagination
- Works well with Convex data
- Server-side pagination support

### 8. Drag and Drop: @dnd-kit

**Decision**: @dnd-kit for section/lesson reordering

**Rationale**:
- Modern, accessible drag and drop
- Keyboard support (accessibility requirement)
- Works with React 19
- Smooth animations
- Sortable preset for reordering use case

### 9. Charts: Recharts

**Decision**: Recharts for analytics visualizations

**Rationale**:
- React-based, TypeScript support
- Responsive by default
- Supports required chart types: line, bar, pie
- Reasonable bundle size with tree-shaking

### 10. File Storage: Convex Built-in

**Decision**: Use Convex's built-in file storage

**Rationale**:
- No S3 configuration needed
- Integrated with Convex authentication
- Automatic URL generation
- 50MB file limit supported
- Direct upload from client with progress

**Upload Pattern**:
```typescript
// Generate upload URL
const uploadUrl = await generateUploadUrl();

// Client uploads directly
await fetch(uploadUrl, { method: 'POST', body: file });

// Store file reference in document
await createFileAttachment({ storageId, lessonId });
```

### 11. Real-time Features

**Decision**: Convex reactive queries (built-in)

**Rationale**:
- **No WebSocket setup**: Convex handles real-time subscriptions automatically
- **Presence**: Track user online/offline/away via Convex
- **Messages**: Real-time delivery via query subscriptions
- **Comments**: Live updates when new comments appear
- **Progress**: Dashboard updates as users complete lessons

**Implementation**:
```typescript
// This automatically subscribes to real-time updates
const messages = useQuery(api.messages.list, { conversationId });

// When any client calls this mutation, all subscribers update
const sendMessage = useMutation(api.messages.send);
```

### 12. Testing Strategy

**Decision**: Vitest (unit) + Playwright (E2E)

**Rationale**:
- **Vitest**: Fast, Vite-native, great TypeScript support
- **Playwright**: Cross-browser E2E testing
- **Convex testing**: Use Convex's test utilities for backend logic

**Test Structure**:
```
tests/
├── unit/           # Vitest - utilities, hooks, components
└── e2e/           # Playwright - critical user flows
```

### 13. Deployment

**Decision**: Vercel (frontend) + Convex Cloud (backend)

**Rationale**:
- Vercel optimized for Next.js
- Convex Cloud is managed, no infrastructure
- Automatic deployments from Git
- Preview deployments for PRs

## Resolved Clarifications

All technical decisions made:
- Framework: Next.js 15.5.7 + React 19.2.1 + Turbopack (patched for CVE-2025-66478)
- Backend: Convex (reactive database)
- Auth: Clerk (MFA, SSO, Organizations)
- File Storage: Convex built-in
- Real-time: Convex reactive queries
- Testing: Vitest + Playwright
- Deployment: Vercel + Convex Cloud
