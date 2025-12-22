# Bundle Optimization

## Table of Contents
1. [Code Splitting with dynamic()](#code-splitting-with-dynamic)
2. [Route-Based Splitting](#route-based-splitting)
3. [Tree Shaking](#tree-shaking)
4. [Analyzing Bundle Size](#analyzing-bundle-size)
5. [Common Heavy Dependencies](#common-heavy-dependencies)

---

## Code Splitting with dynamic()

Use Next.js `dynamic()` for components not needed on initial render:

```tsx
import dynamic from "next/dynamic";

// Heavy editor - load only when needed
const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor"),
  {
    loading: () => <EditorSkeleton />,
    ssr: false,  // Disable SSR for browser-only components
  }
);

// Modal content - load on interaction
const SettingsModal = dynamic(
  () => import("@/components/settings-modal"),
  { loading: () => <ModalSkeleton /> }
);
```

### When to Use dynamic()

| Scenario | Use dynamic()? |
|----------|----------------|
| Heavy libraries (chart.js, monaco) | ✅ Yes with `ssr: false` |
| Modals and dialogs | ✅ Yes |
| Below-the-fold content | ✅ Yes |
| Navigation components | ❌ No |
| Above-the-fold content | ❌ No (hurts LCP) |

---

## Route-Based Splitting

Next.js App Router automatically code-splits by route. Optimize further:

```
app/
├── (dashboard)/
│   ├── layout.tsx      # Shared dashboard layout
│   ├── courses/
│   │   └── page.tsx    # Separate chunk
│   └── analytics/
│       └── page.tsx    # Separate chunk (heavy charts)
└── (marketing)/
    └── page.tsx        # Separate chunk
```

### Parallel Routes for Heavy Features

```tsx
// app/(dashboard)/@analytics/page.tsx
// Loaded in parallel, doesn't block main content
export default function AnalyticsSlot() {
  return <AnalyticsDashboard />;
}

// app/(dashboard)/layout.tsx
export default function Layout({
  children,
  analytics,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <Suspense fallback={<AnalyticsSkeleton />}>
        {analytics}
      </Suspense>
    </div>
  );
}
```

---

## Tree Shaking

### Named Imports (Required)

```tsx
// ✅ GOOD - Only imports what's needed
import { Button } from "@/components/ui/button";
import { formatDate } from "date-fns";

// ❌ BAD - Imports entire library
import * as dateFns from "date-fns";
import UI from "@/components/ui";
```

### Barrel File Optimization

```tsx
// components/ui/index.ts - Avoid re-exporting everything

// ❌ BAD - Forces bundling all components
export * from "./button";
export * from "./card";
export * from "./dialog";
// ... 50 more components

// ✅ GOOD - Direct imports in consuming files
// In your component:
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
```

### next.config.ts Optimization

```typescript
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "lodash-es",
    ],
  },
};

export default config;
```

---

## Analyzing Bundle Size

### Setup Bundle Analyzer

```bash
npm install @next/bundle-analyzer
```

```typescript
// next.config.ts
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(config);
```

```bash
# Run analysis
ANALYZE=true npm run build
```

### Reading the Report

| Section | Target | Action if exceeded |
|---------|--------|-------------------|
| First Load JS | < 100KB | Split with dynamic() |
| Page JS | < 50KB | Check imports |
| Shared chunks | < 80KB | Review common deps |

---

## Common Heavy Dependencies

### Replacements for Heavy Libraries

| Heavy Library | Size | Lightweight Alternative | Size |
|---------------|------|------------------------|------|
| moment.js | 290KB | date-fns | 20KB (tree-shakeable) |
| lodash | 70KB | lodash-es + named imports | 2-5KB |
| chart.js | 180KB | recharts (tree-shakeable) | 40KB |
| react-icons (all) | 500KB+ | lucide-react | 20KB |

### Lazy Loading Heavy Features

```tsx
// Rich text editor - only load when user clicks "Edit"
const [showEditor, setShowEditor] = useState(false);

const Editor = dynamic(
  () => import("@/components/plate-editor"),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

return (
  <div>
    {showEditor ? (
      <Editor />
    ) : (
      <button onClick={() => setShowEditor(true)}>
        Edit Content
      </button>
    )}
  </div>
);
```

### Icons Optimization

```tsx
// ✅ GOOD - Import specific icons
import { ChevronRight, User, Settings } from "lucide-react";

// ❌ BAD - Import all icons
import * as Icons from "lucide-react";
```

---

## Checklist

Before deploying, verify:

- [ ] Bundle size < 150KB gzipped (check with `npm run build`)
- [ ] Heavy components use `dynamic()` with loading states
- [ ] No `import *` statements for tree-shakeable libraries
- [ ] `optimizePackageImports` configured for icon/utility libraries
- [ ] No moment.js (use date-fns instead)
- [ ] Direct imports instead of barrel files for UI components
