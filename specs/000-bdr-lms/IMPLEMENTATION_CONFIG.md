# 🎯 SPEC-KIT IMPLEMENTATION CONFIG
**Project:** Onboarding BDR Team v2 LMS  
**Date:** 2025-12-08  
**Command:** `/speckit.implement`

---

## ⚠️ CRITICAL RULE - READ FIRST

**This project uses a hybrid workflow:**

```
SPEC-KIT (you) → Backend, Config, Logic
FIGMA MAKE    → UI Components, Pages, Layouts
```

**You must NOT implement UI tasks.** These tasks will be done after Figma Make generates UI code from Figma mockups.

---

## ✅ TASKS TO EXECUTE (Claude Code only)

### Phase 1: Setup (T001-T013) - DO ALL
```
T001 ✅ Create Next.js 15.5.7 project
T002 ✅ Initialize Convex project
T003 ✅ Configure TypeScript strict mode
T004 ✅ Configure ESLint and Prettier
T005 ✅ Setup environment variables
T006 ✅ Initialize shadcn/ui
T007 ✅ Install shadcn/ui components
T008 ✅ Install shadcn/ui blocks
T009 ✅ Install third-party integrations (Clerk, etc.)
T010 ✅ Install Plate.js editor kits
T011 ✅ Install Plate.js toolbar components
T012 ✅ Install Plate.js node components
T013 ✅ Install dependencies (TanStack, dnd-kit, etc.)
```

### Phase 2: Foundational - PARTIAL
```
T014 ✅ Create Convex schema (convex/schema.ts)
T015 ✅ Setup Clerk authentication provider
T016 ✅ Create Clerk webhook handler (convex/http.ts)
T017 ✅ Implement user sync mutation (convex/auth.ts)
T018 ✅ Create auth utility functions (convex/lib/auth.ts)
T019 ✅ Setup ConvexProvider (src/components/providers/convex-provider.tsx)
T020 ✅ Create ThemeProvider (src/components/providers/theme-provider.tsx)
T021 ✅ Create root layout with providers (src/app/layout.tsx) - STRUCTURE ONLY
T022 ✅ Setup Clerk middleware (src/middleware.ts)
T023 ✅ Create base user queries (convex/users.ts)
T024 ✅ Create base user mutations (convex/users.ts)
T024a ✅ Implement users.invite mutation (convex/users.ts)
T024c ✅ Handle invitation webhook (convex/auth.ts)
T032 ✅ Create Zod validation schemas (src/lib/validators/)
```

### Phase 3: User Story 1 - BACKEND ONLY
```
T033 ✅ courses.listForUser query
T034 ✅ courses.get query
T035 ✅ courses.getWithProgress query
T036 ✅ courses.incrementViewCount mutation
T037 ✅ lessons.get query
T038 ✅ lessons.listBySection query
T039 ✅ progress.getForLesson query
T040 ✅ progress.getForCourse query
T041 ✅ progress.getContinueWatching query
T042 ✅ progress.markStarted mutation
T043 ✅ progress.markCompleted mutation
T044 ✅ progress.updateTimeSpent mutation
T045 ✅ quizzes.getQuizStatus query
T046 ✅ quizzes.getLatestAttempt query
T047 ✅ quizzes.submit mutation
T048 ✅ files.listForLesson query
T049 ✅ files.getUrl query
T068 ✅ use-lesson-progress hook (logic only)
```

### Phase 4: User Story 2 - BACKEND ONLY
```
T069 ✅ courses.list query (admin)
T070 ✅ courses.create mutation
T071 ✅ courses.update mutation
T072 ✅ courses.setCoverImage mutation
T073 ✅ courses.publish mutation
T074 ✅ courses.unpublish mutation
T075 ✅ courses.remove mutation
T076 ✅ courses.reorder mutation
T077 ✅ courses.addTag/removeTag mutations
T078 ✅ courses.assign/unassign mutations
T079 ✅ sections.create mutation
T080 ✅ sections.update mutation
T081 ✅ sections.remove mutation
T082 ✅ sections.reorder mutation
T083 ✅ lessons.create mutation
T084 ✅ lessons.update mutation
T085 ✅ lessons.updateContent mutation
T086 ✅ lessons.remove mutation
T087 ✅ lessons.reorder mutation
T088 ✅ lessons.setEmbed mutation
T089 ✅ lessons.updateQuizConfig mutation
T090 ✅ lessons.addQuestion mutation
T091 ✅ lessons.updateQuestion mutation
T092 ✅ lessons.removeQuestion mutation
T093 ✅ lessons.reorderQuestions mutation
T094 ✅ files.getUploadUrl mutation
T095 ✅ files.saveAttachment mutation
T096 ✅ files.removeAttachment mutation
T097 ✅ files.saveCoverImage mutation
T098 ✅ tags.list query
T110-T110h ✅ Plate.js editor configuration (code config, not UI)
```

### Phase 5: User Story 3 - BACKEND ONLY
```
T118 ✅ teams.list query
T119 ✅ teams.get query
T120 ✅ teams.getForUser query
T121 ✅ teams.getMembers query
T122 ✅ teams.create mutation
T123 ✅ teams.update mutation
T124 ✅ teams.remove mutation
T125 ✅ teams.addMember mutation
T126 ✅ teams.removeMember mutation
T127 ✅ teams.addMembers mutation
T128 ✅ teams.setLead mutation
```

### Phase 6: User Story 4 - BACKEND ONLY
```
T138 ✅ analytics.getOverview query
T139 ✅ analytics.getUserActivity query
T140 ✅ analytics.getQuizMetrics query
T141 ✅ analytics.getCourseMetrics query
T142 ✅ analytics.getActivityLog query
T143 ✅ analytics.getSessionStats query
T144 ✅ analytics.logActivity mutation
T145 ✅ analytics.startSession mutation
T146 ✅ analytics.endSession mutation
T147 ✅ analytics.heartbeat mutation
T148 ✅ Activity logging integration
T158 ✅ SessionTracker hook (logic only)
T159 ✅ Activity logging integration
T160 ✅ Export CSV functionality (logic only)
```

### Phase 7: User Story 5 - BACKEND ONLY
```
T161 ✅ messages.listConversations query
T162 ✅ messages.getConversation query
T163 ✅ messages.getOrCreateDirect query
T164 ✅ messages.getUnreadCount query
T165 ✅ messages.search query
T166 ✅ messages.send mutation
T167 ✅ messages.sendDirect mutation
T168 ✅ messages.broadcast mutation
T169 ✅ messages.markRead mutation
```

### Phase 8: User Story 6 - BACKEND ONLY
```
T180 ✅ comments.listForCourse query
T181 ✅ comments.listForLesson query
T182 ✅ comments.getReplies query
T183 ✅ comments.create mutation
T184 ✅ comments.reply mutation
T185 ✅ comments.update mutation
T186 ✅ comments.remove mutation
T187 ✅ comments.pin mutation
T188 ✅ comments.unpin mutation
```

### Phase 10: Polish - PARTIAL
```
T206 ✅ Search indexing (convex/search.ts)
T208 ✅ Error boundaries (logic only)
T209 ✅ Sonner toast config
T210 ✅ Optimistic updates (logic only)
T217 ✅ Seed script (convex/seed.ts)
```

### Phase 11: Tests
```
T219-T249 ✅ ALL test tasks (Vitest, Playwright, etc.)
```

### Phase 12: Accessibility
```
T250-T257 ✅ ALL accessibility tasks
```

---

## 🚫 TASKS TO SKIP (Reserved for Figma Make)

**These tasks will be implemented AFTER Figma Make generates UI code.**

### Phase 2: UI Components
```
T024b ❌ InviteUserDialog component → FIGMA MAKE
T025 ❌ Sign-in page → CLERK + FIGMA MAKE
T026 ❌ Sign-up page → CLERK + FIGMA MAKE
T027 ❌ Auth layout → FIGMA MAKE
T028 ❌ Dashboard layout → FIGMA MAKE
T029 ❌ Sidebar component → FIGMA MAKE
T030 ❌ Breadcrumb component → FIGMA MAKE
T031 ❌ UserButton component → FIGMA MAKE
```

### Phase 3: User Story 1 - Frontend
```
T050 ❌ User dashboard page → FIGMA MAKE
T051 ❌ CourseCard component → FIGMA MAKE
T052 ❌ CourseGrid component → FIGMA MAKE
T053 ❌ ContinueWatching component → FIGMA MAKE
T054 ❌ ProgressBar component → FIGMA MAKE
T055 ❌ Course detail page → FIGMA MAKE
T056 ❌ CourseHeader component → FIGMA MAKE
T057 ❌ SectionList component → FIGMA MAKE
T058 ❌ LessonItem component → FIGMA MAKE
T059 ❌ Lesson viewer page → FIGMA MAKE
T060 ❌ TextLesson component → FIGMA MAKE
T061 ❌ EmbedLesson component → FIGMA MAKE
T062 ❌ FilesLesson component → FIGMA MAKE
T063 ❌ QuizLesson component → FIGMA MAKE
T064 ❌ QuizQuestion component → FIGMA MAKE
T065 ❌ QuizResults component → FIGMA MAKE
T066 ❌ LessonNavigation component → FIGMA MAKE
T067 ❌ MarkCompleteButton component → FIGMA MAKE
```

### Phase 4: User Story 2 - Frontend
```
T099 ❌ Admin courses list page → FIGMA MAKE
T100 ❌ AdminCourseCard component → FIGMA MAKE
T101 ❌ AdminCourseTable component → FIGMA MAKE
T102 ❌ Course editor page → FIGMA MAKE
T103 ❌ CourseForm component → FIGMA MAKE
T104 ❌ CoverImageUpload component → FIGMA MAKE
T105 ❌ TagSelector component → FIGMA MAKE
T106 ❌ VisibilitySelector component → FIGMA MAKE
T107 ❌ SectionEditor component → FIGMA MAKE
T108 ❌ LessonEditor component → FIGMA MAKE
T109 ❌ Lesson type editor page → FIGMA MAKE
T111 ❌ EditorToolbar component → FIGMA MAKE
T112 ❌ EmbedConfigForm component → FIGMA MAKE
T113 ❌ QuizConfigForm component → FIGMA MAKE
T114 ❌ QuestionEditor component → FIGMA MAKE
T115 ❌ FileUploader component → FIGMA MAKE
T116 ❌ PublishButton component → FIGMA MAKE
T117 ❌ Assignment dialog → FIGMA MAKE
```

### Phase 5: User Story 3 - Frontend
```
T129 ❌ Admin teams page → FIGMA MAKE
T130 ❌ TeamCard component → FIGMA MAKE
T131 ❌ TeamTable component → FIGMA MAKE
T132 ❌ Team detail page → FIGMA MAKE
T133 ❌ TeamForm component → FIGMA MAKE
T134 ❌ MemberList component → FIGMA MAKE
T135 ❌ AddMemberDialog component → FIGMA MAKE
T136 ❌ TeamLeadSelector component → FIGMA MAKE
T137 ❌ Team courses section → FIGMA MAKE
```

### Phase 6: User Story 4 - Frontend
```
T149 ❌ Admin analytics page → FIGMA MAKE
T150 ❌ OverviewCards component → FIGMA MAKE
T151 ❌ UserActivityTable component → FIGMA MAKE
T152 ❌ QuizMetricsChart component → FIGMA MAKE
T153 ❌ CourseMetricsChart component → FIGMA MAKE
T154 ❌ ActivityLogTable component → FIGMA MAKE
T155 ❌ DateRangePicker component → FIGMA MAKE
T156 ❌ MetricCard component → FIGMA MAKE
T157 ❌ ProgressDistributionChart → FIGMA MAKE
```

### Phase 7: User Story 5 - Frontend
```
T170 ❌ Messages page → FIGMA MAKE
T171 ❌ ConversationList component → FIGMA MAKE
T172 ❌ ConversationItem component → FIGMA MAKE
T173 ❌ ChatView component → FIGMA MAKE
T174 ❌ MessageBubble component → FIGMA MAKE
T175 ❌ MessageInput component → FIGMA MAKE
T176 ❌ NewMessageDialog component → FIGMA MAKE
T177 ❌ BroadcastDialog component → FIGMA MAKE
T178 ❌ UnreadBadge component → FIGMA MAKE
T179 ❌ MessageSearch component → FIGMA MAKE
```

### Phase 8: User Story 6 - Frontend
```
T189 ❌ CommentSection component → FIGMA MAKE
T190 ❌ CommentThread component → FIGMA MAKE
T191 ❌ CommentItem component → FIGMA MAKE
T192 ❌ CommentForm component → FIGMA MAKE
T193 ❌ ReplyForm component → FIGMA MAKE
T194 ❌ CommentActions component → FIGMA MAKE
T195 ❌ Integration into pages → FIGMA MAKE
```

### Phase 9: Responsive - Frontend
```
T196 ❌ MobileNavigation component → FIGMA MAKE
T197 ❌ BottomNav component → FIGMA MAKE
T198 ❌ Sidebar responsive update → FIGMA MAKE
T199 ❌ CourseGrid responsive update → FIGMA MAKE
T200 ❌ Lesson viewer mobile → FIGMA MAKE
T201 ❌ Chat view mobile → FIGMA MAKE
T202 ❌ Touch-friendly sizing → FIGMA MAKE
T203 ❌ Admin pages tablet → FIGMA MAKE
T204 ❌ use-responsive hook → OK after UI
```

### Phase 10: Polish - Frontend
```
T205 ❌ Global search component → FIGMA MAKE
T207 ❌ Loading states (skeletons) → FIGMA MAKE
T211 ❌ Admin users page → FIGMA MAKE
T212 ❌ User profile page → FIGMA MAKE
```

---

## 📊 SUMMARY

| Category | Tasks | Action |
|----------|-------|--------|
| ⚙️ Setup/Config | 13 | ✅ DO |
| 🗄️ Backend Convex | ~98 | ✅ DO |
| 🧪 Tests | 31 | ✅ DO |
| ♿ Accessibility | 8 | ✅ DO |
| 🎨 UI Pages | ~18 | ❌ SKIP |
| 🧩 UI Components | ~70 | ❌ SKIP |

**Total to execute now: ~150 tasks**  
**Total reserved for Figma Make: ~88 tasks**

---

## 🔄 EXECUTION ORDER

```
1. Phase 1: Setup (T001-T013) - ALL
2. Phase 2: Foundational Backend (T014-T024a, T024c, T032)
3. Phase 3: US1 Backend (T033-T049, T068)
4. Phase 4: US2 Backend (T069-T098, T110)
5. Phase 5: US3 Backend (T118-T128)
6. Phase 6: US4 Backend (T138-T148, T158-T160)
7. Phase 7: US5 Backend (T161-T169)
8. Phase 8: US6 Backend (T180-T188)
9. Phase 10: Polish Backend (T206, T208-T210, T217)
10. Phase 11: Tests (T219-T249)
11. Phase 12: Accessibility setup (T250-T257)

⏸️ PAUSE - Backend complete

Then: Figma Make for UI → Claude Code integrates
```

---

## 📁 REFERENCE FILES

Read these files for implementation:

```
specs/001-bdr-lms/
├── spec.md           → Functional specifications
├── plan.md           → Implementation plan
├── tasks.md          → Task list
├── data-model.md     → Convex data schema
├── design-system.md  → CSS/Tailwind tokens
├── contracts/        → TypeScript API signatures
│   ├── analytics.ts
│   ├── auth.ts
│   ├── comments.ts
│   ├── courses.ts
│   ├── files.ts
│   ├── lessons.ts
│   ├── messages.ts
│   ├── progress.ts
│   ├── quizzes.ts
│   ├── teams.ts
│   └── users.ts
└── quickstart.md     → Getting started guide
```

---

## ⚠️ IMPORTANT RULES

1. **DO NOT create files in `src/app/`** except root layout.tsx
2. **DO NOT create React UI components** (pages, cards, forms, etc.)
3. **ONLY CREATE**:
   - `convex/*.ts` (schema, queries, mutations)
   - `src/lib/*.ts` (utils, validators)
   - `src/hooks/*.ts` (logic only, no UI)
   - `src/components/providers/*.tsx` (providers only)
   - Config files (tsconfig, eslint, etc.)

4. **For each Convex function**, follow the signature in `contracts/`

5. **Tests**: Create test files even if UI doesn't exist yet

---

## 🎯 CHECKPOINT VALIDATION

After completing backend tasks, verify:

```bash
# 1. Convex schema deployed
npx convex dev
# Should show all tables created

# 2. All queries/mutations exist
# Check convex/_generated/api.d.ts for type definitions

# 3. TypeScript compiles
npx tsc --noEmit

# 4. Tests pass
npm run test

# 5. Lint passes
npm run lint
```

---

**Copy this file to `specs/001-bdr-lms/IMPLEMENTATION_CONFIG.md` before running `/speckit.implement`**
