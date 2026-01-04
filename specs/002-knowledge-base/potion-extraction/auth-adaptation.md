# Auth Adaptation Guide: better-auth → Clerk

**Document Purpose**: Map Potion template's better-auth patterns to our Clerk + Convex implementation

**Status**: Complete inventory of patterns with migration paths

---

## Executive Summary

### Authentication System Comparison

| Aspect | Potion (better-auth) | Our Project (Clerk) |
|--------|---------------------|---------------------|
| **Auth Provider** | better-auth (self-hosted) | Clerk (managed service) |
| **Database** | Prisma + PostgreSQL | Convex (serverless) |
| **Session Management** | Cookie-based sessions | JWT tokens via Clerk |
| **Social Auth** | GitHub OAuth (better-auth) | Multiple providers via Clerk |
| **User Creation** | Database hooks in auth config | Webhook + auto-creation fallback |
| **Role Management** | Custom fields in User table | Convex `users.role` field |
| **Middleware** | Custom Hono middleware | Clerk middleware for Next.js |

### Migration Complexity: MEDIUM

- Server-side patterns: HIGH COMPATIBILITY (both use React Server Components)
- Client-side patterns: REQUIRES ADAPTATION (different hooks API)
- Middleware: ARCHITECTURE CHANGE (Hono → Next.js middleware)
- Session management: SIMPLIFIED (Clerk handles complexity)

---

## Part 1: Pattern Inventory

### 1.1 Server-Side Auth (RSC)

#### better-auth Pattern

**File**: `/src/components/auth/rsc/auth.ts`

```typescript
import { cache } from 'react';
import { type AuthSession, getSession } from '@/server/auth/auth';
import type { AuthUser } from '@/server/auth/getAuthUser';

export const auth = cache(
  async (): Promise<{
    session: AuthSession | null;
    user: AuthUser | null;
  }> => {
    const response = await getSession();
    return {
      session: response?.session ?? null,
      user: response?.user ?? null,
    };
  }
);

export const isAuth = async () => {
  const { session } = await auth();
  return !!session;
};

export const isNotAuth = async () => {
  const { session } = await auth();
  return !session;
};

export const authOnly = async <T extends (...args: any) => any>(
  callback: T
) => {
  if (await isAuth()) {
    return callback();
  }
};
```

**Usage in Pages**:
```typescript
// Protected page
const session = await isAuth();
if (!session) return redirect('/login');

// Conditional behavior
const session = await isAuth();
if (session) {
  // prefetch data for authenticated users
}
```

**Session Data Structure**:
```typescript
type AuthSession = {
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  // ... other fields
};

type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole; // "USER" | "ADMIN" | "SUPERADMIN"
  isAdmin: boolean;
  isSuperAdmin: boolean;
};
```

---

### 1.2 Client-Side Auth Hooks

#### better-auth Pattern

**Files**: `/src/components/auth/useSession.ts`, `/src/components/auth/useAuthUser.ts`

```typescript
// useSession.ts
import { useAuthStore } from '@/components/auth/auth-provider-client';

export function useSession() {
  const session = useAuthStore().useSessionValue();
  if (!session) return null;
  return session;
}

export const useIsAuth = () => !!useSession();

// useAuthUser.ts
import { useSession } from '@/components/auth/useSession';

export const useAuthUser = () => {
  const session = useSession();
  return session?.user ?? null;
};

// useCurrentUser.ts - fetches full user data with tRPC
'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/auth/useSession';
import { useTRPC } from '@/trpc/react';

export const useCurrentUser = () => {
  const session = useSession();
  const { data, ...rest } = useQuery({
    ...useTRPC().layout.app.queryOptions(),
    enabled: !!session,
  });

  return { ...data?.currentUser, ...rest };
};
```

**Session State Management**:
```typescript
// auth-provider-client.tsx
'use client';

import { createAtomStore } from 'jotai-x';

export type AuthStore = {
  session: {
    session: AuthSession;
    user: AuthUser;
  } | null;
};

export const { AuthProvider, useAuthStore } = createAtomStore(
  initialState as AuthStore,
  { name: 'auth' }
);
```

---

### 1.3 Auth Client Actions

#### better-auth Pattern

**File**: `/src/server/auth/auth-client.ts`

```typescript
import { createAuthClient } from 'better-auth/react';
import { env } from '@/env';

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SITE_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
```

**Usage**:

```typescript
// Sign In
import { signIn } from '@/server/auth/auth-client';

signIn.social({
  provider: 'github',
  callbackURL: '/dashboard',
});

// Sign Out
import { signOut } from '@/server/auth/auth-client';

await signOut({
  fetchOptions: {
    onSuccess: () => {
      window.location.href = `/`;
    },
  },
});
```

---

### 1.4 Middleware & Protected Routes

#### better-auth Pattern (Hono)

**File**: `/src/server/hono/middlewares/auth-middleware.ts`

```typescript
import { createMiddleware } from 'hono/factory';
import { type AuthSession, auth } from '@/server/auth/auth';
import { type AuthUser, getAuthUser } from '@/server/auth/getAuthUser';

export type ProtectedContext = {
  Variables: {
    session: AuthSession;
    user: AuthUser;
    userId: string;
  };
};

const authMiddleware = createMiddleware<PublicContext>(async (c, next) => {
  const sessionData = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (sessionData) {
    c.set('session', sessionData.session);
    c.set('user', getAuthUser(sessionData.user));
    c.set('userId', sessionData.user.id);
  }

  await next();
});

export const protectedMiddlewares = () => [
  authMiddleware,
  createMiddleware<ProtectedContext>(async (c, next) => {
    const session = c.get('session');
    const user = c.get('user');

    if (!session || !user) {
      return c.redirect('/login');
    }

    // CSRF protection for non-GET requests
    if (c.req.method !== 'GET') {
      const originHeader = c.req.header('Origin');
      const hostHeader = c.req.header('Host');

      if (!originHeader || !hostHeader) {
        return c.redirect('/login');
      }

      let origin: URL;
      try {
        origin = new URL(originHeader);
      } catch {
        return c.redirect('/login');
      }

      if (origin.host !== hostHeader) {
        return c.redirect('/login');
      }
    }

    await next();
  }),
];
```

**Usage**:
```typescript
// Hono route with auth
app.get('/api/export', ...protectedMiddlewares(), async (c) => {
  const user = c.get('user');
  // user is guaranteed to exist
});
```

---

### 1.5 Role-Based Access Control (RBAC)

#### better-auth Pattern

**File**: `/src/server/auth/getAuthUser.ts`

```typescript
export type AuthUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: UserRole; // "USER" | "ADMIN" | "SUPERADMIN"
  username: string;
};

export const getAuthUser = (user: User, devUser?: string): AuthUser => {
  const role = user.role as UserRole;

  return {
    id: user.id,
    email: user.email,
    isAdmin: isAdmin(role),
    isSuperAdmin: isSuperAdmin(role) || env.SUPERADMIN.includes(user.email),
    role,
    username: user.username,
  };
};
```

**Role Helpers**:
```typescript
// lib/isAdmin.ts
export const isAdmin = (role: UserRole) =>
  role === 'ADMIN' || role === 'SUPERADMIN';

export const isSuperAdmin = (role: UserRole) =>
  role === 'SUPERADMIN';
```

**Middleware Usage**:
```typescript
import { roleMiddleware } from './role-middleware';

export const protectedMiddlewares = ({ role }: { role?: UserRole }) => [
  authMiddleware,
  roleMiddleware(role), // Checks user.role
];
```

---

### 1.6 WebSocket/Hocuspocus Auth

#### better-auth Pattern

**File**: `/src/server/yjs/auth.ts`

```typescript
import { type AuthSession, auth } from '@/server/auth/auth';
import { type AuthUser, getAuthUser } from '@/server/auth/getAuthUser';

export const authenticateFromHeaders = async (
  headers: IncomingHttpHeaders
): Promise<{
  session: AuthSession | null;
  user: AuthUser | null;
}> => {
  const cookies = parseCookies(headers.cookie);

  const fetchHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      fetchHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const sessionData = await auth.api.getSession({
    headers: fetchHeaders,
  });

  if (!sessionData) {
    return { session: null, user: null };
  }

  return {
    session: sessionData.session,
    user: getAuthUser(sessionData.user),
  };
};
```

---

### 1.7 tRPC Context

#### better-auth Pattern

**File**: `/src/server/api/trpc.ts`

```typescript
export const createTRPCContext = (opts: {
  headers: Headers;
  session: AuthSession | null;
  user: AuthUser | null;
}) => {
  return {
    headers: opts.headers,
    session: opts.session,
    user: opts.user,
    userId: opts.session?.userId ?? '',
  };
};

export const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});
```

**Protected Procedures** (inferred pattern):
```typescript
const protectedProcedure = t.procedure.use((opts) => {
  if (!opts.ctx.session || !opts.ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return opts.next({
    ctx: {
      session: opts.ctx.session,
      user: opts.ctx.user,
    },
  });
});
```

---

## Part 2: Clerk Equivalents

### 2.1 Server-Side Auth (RSC)

#### Clerk Equivalent

```typescript
import { auth } from '@clerk/nextjs/server';

// Get current user authentication
export async function getAuth() {
  const { userId } = await auth();
  return userId;
}

// Check if authenticated
export async function isAuth() {
  const { userId } = await auth();
  return !!userId;
}

// Protect page
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  return userId;
}
```

**Usage in Server Components**:
```typescript
import { auth } from '@clerk/nextjs/server';

export default async function ProtectedPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // User is authenticated, fetch data
  return <PageContent />;
}
```

**Note**: Clerk's `auth()` returns:
```typescript
{
  userId: string | null;           // Clerk user ID
  sessionId: string | null;        // Session ID
  orgId: string | null;            // Organization ID (if using orgs)
  orgRole: string | null;          // User's role in org
  orgSlug: string | null;          // Organization slug
}
```

---

### 2.2 Client-Side Auth Hooks

#### Clerk Equivalent

```typescript
'use client';

import { useUser, useAuth } from '@clerk/nextjs';

export function useAuthUser() {
  const { user, isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded) return { user: null, isLoading: true };
  if (!isSignedIn) return { user: null, isLoading: false };
  
  return {
    user: {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: user.fullName,
      avatarUrl: user.imageUrl,
    },
    isLoading: false,
  };
}

export function useIsAuth() {
  const { isSignedIn, isLoaded } = useAuth();
  return isLoaded && isSignedIn;
}

export function useSession() {
  const { session, isLoaded } = useAuth();
  if (!isLoaded) return null;
  return session;
}
```

**Our Project Implementation** (with Convex):

```typescript
// src/contexts/user-context.tsx
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useUserContext() {
  const data = useQuery(api.users.me);
  const isLoading = data === undefined;

  const user = data ? {
    id: data._id,
    clerkId: data.clerkId,
    name: data.name,
    email: data.email,
    role: data.role,
    avatarUrl: data.avatarUrl,
  } : null;

  return {
    user,
    isLoading,
    isAdmin: data?.role === "admin",
  };
}
```

**Key Difference**: Our project fetches user data from Convex, not directly from Clerk. Clerk provides identity, Convex provides user profile.

---

### 2.3 Auth Client Actions

#### Clerk Equivalent

```typescript
'use client';

import { useSignIn, useClerk } from '@clerk/nextjs';

// Sign In
export function SignInButton() {
  const { signIn } = useSignIn();

  const handleGitHubSignIn = () => {
    signIn?.authenticateWithRedirect({
      strategy: 'oauth_github',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    });
  };

  return <button onClick={handleGitHubSignIn}>Sign in with GitHub</button>;
}

// Sign Out
export function SignOutButton() {
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut({ redirectUrl: '/' });
  };

  return <button onClick={handleSignOut}>Sign out</button>;
}
```

**Simpler with Clerk Components**:
```typescript
import { SignInButton, SignOutButton } from '@clerk/nextjs';

<SignInButton mode="modal" />
<SignOutButton redirectUrl="/" />
```

---

### 2.4 Middleware & Protected Routes

#### Clerk Equivalent

**File**: `src/middleware.ts` (Next.js App Router)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/admin(.*)',
  '/courses(.*)',
  '/messages(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Key Differences**:
- No manual session extraction (Clerk handles it)
- No CSRF checks in middleware (Clerk manages this)
- Route-based protection instead of Hono middleware chains
- Automatic redirects to sign-in page

---

### 2.5 Role-Based Access Control (RBAC)

#### Clerk Equivalent (Our Implementation)

**Convex Backend**:

```typescript
// convex/lib/auth.ts
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
```

**Client-Side**:

```typescript
import { useUserContext } from '@/contexts/user-context';

export function useIsAdmin() {
  const { isAdmin } = useUserContext();
  return isAdmin;
}

export function AdminOnlyComponent() {
  const { isAdmin } = useUserContext();
  
  if (!isAdmin) return null;
  
  return <AdminPanel />;
}
```

**Middleware (Server-Side)**:

```typescript
import { auth } from '@clerk/nextjs/server';
import { api } from '@/convex/_generated/api';
import { fetchQuery } from 'convex/nextjs';

export async function requireAdminInRSC() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const user = await fetchQuery(api.users.getByClerkId, { clerkId: userId });
  if (!user || user.role !== 'admin') {
    redirect('/dashboard'); // or throw error
  }

  return user;
}
```

**Key Differences**:
- better-auth stores role in auth session
- Clerk + Convex: role stored in Convex database
- Our system requires database query to check role
- better-auth can check role in middleware without DB query

---

### 2.6 WebSocket/Hocuspocus Auth

#### Clerk Equivalent

**Hocuspocus Server** (for Plate.js collaboration):

```typescript
import { verifyToken } from '@clerk/backend';

const authenticateFromHeaders = async (
  headers: IncomingHttpHeaders
): Promise<{ userId: string | null }> => {
  const authHeader = headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { userId: null };
  }

  const token = authHeader.substring(7);

  try {
    const sessionClaims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    return { userId: sessionClaims.sub };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { userId: null };
  }
};
```

**Client-Side** (send token to Hocuspocus):

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

export function useCollaborationProvider(documentId: string) {
  const { getToken } = useAuth();

  const provider = new HocuspocusProvider({
    url: 'ws://localhost:1234',
    name: documentId,
    token: async () => {
      const token = await getToken();
      return token ?? '';
    },
  });

  return provider;
}
```

**Key Differences**:
- better-auth uses cookies
- Clerk uses JWT tokens in Authorization header
- Clerk tokens are stateless (no DB lookup needed for verification)
- Must use `@clerk/backend` for server-side token verification

---

### 2.7 API Route Protection

#### Clerk Equivalent

**Next.js API Route**:

```typescript
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // User is authenticated
  const body = await request.json();
  // ... handle request
}
```

**With Convex for RBAC**:

```typescript
import { auth } from '@clerk/nextjs/server';
import { api } from '@/convex/_generated/api';
import { fetchQuery } from 'convex/nextjs';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user from Convex to check role
  const user = await fetchQuery(api.users.getByClerkId, { clerkId: userId });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // User is authenticated AND admin
  // ... handle request
}
```

---

## Part 3: Migration Code Examples

### 3.1 Protected Page Migration

#### BEFORE (better-auth)

```typescript
// app/(protected)/dashboard/page.tsx
import { isAuth } from '@/components/auth/rsc/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await isAuth();
  
  if (!session) {
    redirect('/login');
  }

  return <DashboardContent />;
}
```

#### AFTER (Clerk)

```typescript
// app/(dashboard)/dashboard/page.tsx
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  return <DashboardContent />;
}
```

**OR** (use middleware protection):

```typescript
// No auth check needed - middleware handles it
export default async function DashboardPage() {
  return <DashboardContent />;
}
```

---

### 3.2 User Data Hook Migration

#### BEFORE (better-auth)

```typescript
'use client';

import { useAuthUser } from '@/components/auth/useAuthUser';

export function UserProfile() {
  const user = useAuthUser();

  if (!user) return <div>Not signed in</div>;

  return (
    <div>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p>Admin: {user.isAdmin ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

#### AFTER (Clerk + Convex)

```typescript
'use client';

import { useUserContext } from '@/contexts/user-context';

export function UserProfile() {
  const { user, isLoading, isAdmin } = useUserContext();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not signed in</div>;

  return (
    <div>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p>Admin: {isAdmin ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

**Alternative** (use Clerk directly, no database role):

```typescript
'use client';

import { useUser } from '@clerk/nextjs';

export function UserProfile() {
  const { user, isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Not signed in</div>;

  return (
    <div>
      <p>Email: {user.emailAddresses[0]?.emailAddress}</p>
      <p>Name: {user.fullName}</p>
      <img src={user.imageUrl} alt="Avatar" />
    </div>
  );
}
```

---

### 3.3 Sign In/Out Migration

#### BEFORE (better-auth)

```typescript
'use client';

import { signIn, signOut } from '@/server/auth/auth-client';

export function AuthButtons() {
  const handleSignIn = () => {
    signIn.social({
      provider: 'github',
      callbackURL: '/dashboard',
    });
  };

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/';
        },
      },
    });
  };

  return (
    <>
      <button onClick={handleSignIn}>Sign in with GitHub</button>
      <button onClick={handleSignOut}>Sign out</button>
    </>
  );
}
```

#### AFTER (Clerk)

**Option 1: Use Clerk Components** (Recommended)

```typescript
import { SignInButton, SignOutButton } from '@clerk/nextjs';

export function AuthButtons() {
  return (
    <>
      <SignInButton mode="modal">
        <button>Sign in</button>
      </SignInButton>
      
      <SignOutButton redirectUrl="/">
        <button>Sign out</button>
      </SignOutButton>
    </>
  );
}
```

**Option 2: Custom Implementation**

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export function AuthButtons() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      <button onClick={() => router.push('/sign-in')}>Sign in</button>
      <button onClick={handleSignOut}>Sign out</button>
    </>
  );
}
```

---

### 3.4 Admin-Only Component Migration

#### BEFORE (better-auth)

```typescript
'use client';

import { useAuthUser } from '@/components/auth/useAuthUser';

export function AdminPanel() {
  const user = useAuthUser();

  if (!user?.isAdmin) {
    return null;
  }

  return <AdminContent />;
}
```

#### AFTER (Clerk + Convex)

```typescript
'use client';

import { useUserContext } from '@/contexts/user-context';

export function AdminPanel() {
  const { isAdmin, isLoading } = useUserContext();

  if (isLoading) return <Skeleton />;
  if (!isAdmin) return null;

  return <AdminContent />;
}
```

---

### 3.5 Convex Mutation with Auth Migration

#### BEFORE (better-auth + Prisma)

```typescript
// tRPC mutation
export const updateProfile = protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // ctx.userId is available from session
    return await prisma.user.update({
      where: { id: ctx.userId },
      data: { name: input.name },
    });
  });
```

#### AFTER (Clerk + Convex)

```typescript
// convex/users.ts
import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth } from './lib/auth';

export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    await ctx.db.patch(user._id, {
      name: args.name,
    });

    return { success: true };
  },
});
```

---

## Part 4: Security Considerations

### 4.1 Session Management

#### better-auth
- Cookie-based sessions stored in database
- Session duration: 30 days
- Session refresh: every 15 days
- Manual CSRF protection required
- Cookie attributes: httpOnly, sameSite, secure

#### Clerk
- JWT-based sessions (stateless)
- Session duration: configurable in Clerk dashboard
- Automatic token refresh
- Built-in CSRF protection
- No session storage needed

**Migration Impact**: SIMPLIFIED - Clerk handles session security automatically.

---

### 4.2 CSRF Protection

#### better-auth
Manual CSRF checks in middleware:

```typescript
if (c.req.method !== 'GET') {
  const originHeader = c.req.header('Origin');
  const hostHeader = c.req.header('Host');

  if (!originHeader || !hostHeader) {
    return c.redirect('/login');
  }

  const origin = new URL(originHeader);
  if (origin.host !== hostHeader) {
    return c.redirect('/login');
  }
}
```

#### Clerk
Automatic CSRF protection via:
- Same-site cookies
- Origin validation
- Token-based requests

**Migration Impact**: REMOVE manual CSRF checks - Clerk handles this.

---

### 4.3 Token Verification

#### better-auth
Session tokens verified via database lookup:

```typescript
const sessionData = await auth.api.getSession({
  headers: fetchHeaders,
});
```

#### Clerk
JWT verification without database:

```typescript
import { verifyToken } from '@clerk/backend';

const sessionClaims = await verifyToken(token, {
  secretKey: process.env.CLERK_SECRET_KEY,
});
```

**Migration Impact**: FASTER - no database roundtrip for auth verification.

---

### 4.4 User Creation & Webhooks

#### better-auth
User created automatically on first sign-in via database hooks:

```typescript
databaseHooks: {
  user: {
    create: {
      before: async (user) => ({
        data: {
          ...user,
          role: user.email && env.SUPERADMIN.includes(user.email)
            ? 'SUPERADMIN'
            : 'USER',
        },
      }),
      after: async (user) => {
        // Create default documents for user
      },
    },
  },
},
```

#### Clerk
User created via webhook + fallback:

```typescript
// Webhook handler (preferred)
export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { type, data } = payload;

  if (type === 'user.created') {
    await createUserInConvex(data);
  }
}

// Fallback: auto-create on first query (our implementation)
export async function ensureUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const existingUser = await ctx.db.query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
    .unique();

  if (existingUser) return existingUser;

  // Auto-create user if webhook hasn't fired
  const userId = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email: identity.email,
    name: identity.name,
    role: "user",
  });

  return await ctx.db.get(userId);
}
```

**Migration Impact**: WEBHOOK REQUIRED - set up Clerk webhook for user.created event.

---

### 4.5 Role Management

#### better-auth
Roles stored in auth system (user table):

```typescript
// Checked in session
const user = ctx.user; // { role: "ADMIN", isAdmin: true }

// No database query needed
if (user.isAdmin) {
  // ...
}
```

#### Clerk + Convex
Roles stored in Convex database:

```typescript
// Requires database query
const user = await requireAuth(ctx);

if (user.role === 'admin') {
  // ...
}
```

**Migration Impact**: EXTRA QUERY - role checks require database lookup.

**Optimization**: Cache user data in client context to avoid repeated queries.

---

## Part 5: Migration Checklist

### Step 1: Setup Clerk

- [ ] Create Clerk account
- [ ] Configure OAuth providers (GitHub, Google, etc.)
- [ ] Set up Clerk webhook endpoint
- [ ] Add environment variables:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

### Step 2: Install Dependencies

```bash
npm install @clerk/nextjs
npm uninstall better-auth better-auth/react better-auth/adapters/prisma
```

### Step 3: Replace Auth Files

- [ ] Delete `src/server/auth/auth.ts`
- [ ] Delete `src/server/auth/auth-client.ts`
- [ ] Delete `src/server/auth/getAuthUser.ts`
- [ ] Delete `src/components/auth/` directory
- [ ] Create `src/middleware.ts` with Clerk middleware
- [ ] Update Convex `lib/auth.ts` with `requireAuth`, `requireAdmin`

### Step 4: Update Middleware

- [ ] Remove Hono auth middleware
- [ ] Add Next.js Clerk middleware
- [ ] Configure protected routes in `createRouteMatcher`
- [ ] Remove manual CSRF checks

### Step 5: Update Components

- [ ] Replace `useSession()` with `useUser()` or `useUserContext()`
- [ ] Replace `useAuthUser()` with `useUserContext()`
- [ ] Replace `signIn.social()` with `<SignInButton />` or custom flow
- [ ] Replace `signOut()` with `<SignOutButton />` or custom flow
- [ ] Update all auth state checks

### Step 6: Update Server Components

- [ ] Replace `isAuth()` from better-auth with `auth()` from Clerk
- [ ] Update protected page checks
- [ ] Remove `auth()` helper (replaced by Clerk's `auth()`)

### Step 7: Update Convex Functions

- [ ] Implement `getCurrentUser()` using `ctx.auth.getUserIdentity()`
- [ ] Implement `requireAuth()`, `requireAdmin()`, etc.
- [ ] Update all mutations/queries to use new auth helpers
- [ ] Add user auto-creation in `ensureUser()`

### Step 8: Setup Webhooks

- [ ] Create webhook handler at `/api/webhooks/clerk`
- [ ] Verify webhook signatures with Svix
- [ ] Handle `user.created`, `user.updated`, `user.deleted` events
- [ ] Test webhook locally with Clerk webhook tester

### Step 9: Update User Schema

- [ ] Add `clerkId` field to Convex users table
- [ ] Add index on `clerkId`
- [ ] Migrate existing users (if any) to include Clerk IDs
- [ ] Update user role management

### Step 10: Test Auth Flow

- [ ] Test sign-in flow
- [ ] Test sign-out flow
- [ ] Test protected routes
- [ ] Test admin-only features
- [ ] Test webhook user creation
- [ ] Test fallback user auto-creation
- [ ] Test WebSocket auth (if using Hocuspocus)

---

## Part 6: Breaking Changes & Gotchas

### 6.1 Session Data Structure

#### better-auth
```typescript
const { session, user } = await getSession();
// session: { sessionToken, userId, expiresAt }
// user: { id, email, username, role, isAdmin, isSuperAdmin }
```

#### Clerk
```typescript
const { userId, sessionId } = await auth();
// Only IDs available, must fetch user data separately
```

**Impact**: Must query Convex to get user profile data.

---

### 6.2 Client-Side Loading States

#### better-auth
Session state is synced via jotai store:

```typescript
const session = useSession(); // null or session object
```

#### Clerk
Must handle loading state explicitly:

```typescript
const { user, isLoaded, isSignedIn } = useUser();

if (!isLoaded) return <Skeleton />;
if (!isSignedIn) return <SignInPrompt />;
```

**Impact**: Add loading state checks to all auth-dependent components.

---

### 6.3 Role Checks

#### better-auth
Role available in session immediately:

```typescript
const user = useAuthUser();
if (user.isAdmin) { /* ... */ }
```

#### Clerk + Convex
Role requires database query:

```typescript
const { isAdmin, isLoading } = useUserContext();

if (isLoading) return <Skeleton />;
if (isAdmin) { /* ... */ }
```

**Impact**: Add loading state for role-dependent UI.

---

### 6.4 Middleware Architecture

#### better-auth
Hono middleware with context injection:

```typescript
app.get('/api/data', ...protectedMiddlewares(), async (c) => {
  const user = c.get('user'); // user object available
});
```

#### Clerk
Next.js middleware (route-based):

```typescript
// Middleware just protects routes
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// API route fetches user separately
export async function GET() {
  const { userId } = await auth();
  // No user object, must query database
}
```

**Impact**: Change from middleware context injection to explicit auth checks in each route.

---

### 6.5 Webhook Timing

#### better-auth
User created synchronously during sign-in:

```typescript
// User exists immediately after sign-in
```

#### Clerk
User created asynchronously via webhook:

```typescript
// Webhook may fire AFTER user lands on protected page
// Must implement fallback auto-creation
```

**Impact**: CRITICAL - implement fallback user creation to avoid race conditions.

**Our Solution**:

```typescript
export async function ensureUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  let user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    // Auto-create if webhook hasn't fired
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      role: "user",
    });
    user = await ctx.db.get(userId);
  }

  return user;
}
```

---

## Part 7: Recommended Migration Strategy

### Phase 1: Parallel Implementation (Low Risk)

1. Install Clerk alongside better-auth
2. Set up Clerk middleware (disabled for now)
3. Create Convex auth helpers (`getCurrentUser`, `requireAuth`)
4. Set up webhook handler
5. Test Clerk sign-in flow in development

**Duration**: 1-2 days

---

### Phase 2: Component Migration (Medium Risk)

1. Create new auth context using Clerk + Convex
2. Migrate one component at a time
3. Keep better-auth components as fallback
4. Test each component thoroughly

**Duration**: 3-5 days

---

### Phase 3: Middleware Cutover (High Risk)

1. Enable Clerk middleware
2. Disable better-auth middleware
3. Update all API routes to use Clerk auth
4. Test all protected routes

**Duration**: 1-2 days

---

### Phase 4: Cleanup (Low Risk)

1. Remove better-auth dependencies
2. Delete unused auth files
3. Remove better-auth database tables
4. Update documentation

**Duration**: 1 day

---

**Total Estimated Time**: 6-10 days

---

## Part 8: Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Webhook race condition** | HIGH | Implement fallback user auto-creation |
| **Session timing out during migration** | MEDIUM | Run migration during low-traffic period |
| **Role checks breaking** | MEDIUM | Test all admin-only features thoroughly |
| **WebSocket auth failure** | MEDIUM | Update Hocuspocus auth before cutover |
| **API route access denied** | MEDIUM | Update all routes before enabling Clerk middleware |
| **Client-side infinite loading** | LOW | Add proper loading state checks |

---

## Summary

### Key Takeaways

1. **Architecture Change**: better-auth (cookie + DB sessions) → Clerk (JWT + stateless)
2. **Middleware Change**: Hono context injection → Next.js route protection
3. **User Data**: Session includes user → Must query Convex for user data
4. **Webhook Required**: Set up Clerk webhook + fallback auto-creation
5. **Role Checks**: Immediate (session) → Requires DB query (Convex)

### Migration Complexity

- **Server-side**: LOW (similar RSC patterns)
- **Client-side**: MEDIUM (different hooks API)
- **Middleware**: HIGH (different architecture)
- **Overall**: MEDIUM complexity, 6-10 days effort

### Security Improvements with Clerk

- Automatic CSRF protection
- Stateless JWT sessions (faster)
- Built-in rate limiting
- MFA support out-of-box
- Better audit logging
- SOC 2 compliant infrastructure

---

**Document Version**: 1.0
**Last Updated**: 2026-01-03
**Author**: Security Auditor
