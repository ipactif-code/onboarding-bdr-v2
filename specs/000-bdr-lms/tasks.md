# Tasks: Onboarding BDR Team v2 LMS

**Input**: Design documents from `/specs/001-bdr-lms/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Testing Strategy**: All phases include corresponding test tasks to meet constitution requirements (80% coverage, TDD approach, E2E acceptance tests). Unit tests use Vitest + convex-test, E2E tests use Playwright.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (Next.js App Router)
- **Backend**: `convex/` (Convex functions)
- **Components**: `src/components/`

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create Next.js project and install all dependencies

- [x] T001 Create Next.js 15.5.7 project with React 19.2.1, TypeScript, App Router, Turbopack, and Tailwind CSS 4.x (patched for CVE-2025-66478)
- [x] T002 Initialize Convex project and link to Convex Cloud in convex/
- [x] T003 [P] Configure TypeScript strict mode in tsconfig.json
- [x] T004 [P] Configure ESLint and Prettier in .eslintrc.json and .prettierrc
- [x] T005 [P] Setup environment variables template in .env.example
- [x] T006 Initialize shadcn/ui with design system theme from specs/001-bdr-lms/design-system.md in src/app/globals.css
- [x] T007 Install shadcn/ui components per plan.md Phase 2 (accordion through tooltip)
- [x] T008 [P] Install shadcn/ui blocks per plan.md Phase 3 (sidebar-07, login-04, otp-04, calendar blocks)
- [x] T009 Install third-party integrations per plan.md Phase 4 (ai-elements, assistant-ui, Clerk, uitripled)
- [x] T010 Install Plate.js editor kits per plan.md Phase 5 (all editor kits)
- [x] T011 [P] Install Plate.js toolbar components per plan.md Phase 6
- [x] T012 [P] Install Plate.js node components per plan.md Phase 7
- [x] T013 Install dependencies with pnpm: @tanstack/react-table, next-themes, @better-upload/server, @better-upload/client, recharts, @dnd-kit/core, @dnd-kit/sortable, react-hook-form, @hookform/resolvers, zod

**⚠️ DEPENDENCY NOTE**: Tasks T010, T011, and T012 (Plate.js component installations) MUST complete before T110 (Plate.js editor configuration) can begin in Phase 4.

**Checkpoint**: Project structure ready with all dependencies installed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T014 Create Convex schema with all tables per data-model.md in convex/schema.ts
- [x] T015 [P] Setup Clerk authentication provider in src/app/layout.tsx
- [x] T016 [P] Create Clerk webhook handler for user sync in convex/http.ts
- [x] T017 Implement user sync mutation from Clerk in convex/auth.ts
- [x] T018 [P] Create auth utility functions (getCurrentUser, requireAuth, requireAdmin) in convex/lib/auth.ts
- [x] T019 [P] Setup ConvexProvider with Clerk integration in src/components/providers/convex-provider.tsx
- [x] T020 [P] Create ThemeProvider with next-themes in src/components/providers/theme-provider.tsx
- [x] T021 Create root layout with all providers in src/app/layout.tsx
- [x] T022 [P] Setup Clerk middleware for route protection in src/middleware.ts
- [x] T023 [P] Create base user queries (list, get, getByClerkId, search) in convex/users.ts
- [x] T024 [P] Create base user mutations (update, updateRole, updateStatus, remove) in convex/users.ts
- [x] T024a [P] Implement users.invite mutation using Clerk Organizations API in convex/users.ts
- [ ] T024b [P] Create InviteUserDialog component with email input and role selection in src/components/admin/users/invite-user-dialog.tsx ❌ SKIP (Figma Make)
- [x] T024c Handle invitation acceptance webhook from Clerk in convex/auth.ts
- [ ] T025 Create sign-in page with Clerk components in src/app/(auth)/sign-in/[[...sign-in]]/page.tsx ❌ SKIP (Figma Make)
- [ ] T026 [P] Create sign-up page with Clerk components in src/app/(auth)/sign-up/[[...sign-up]]/page.tsx ❌ SKIP (Figma Make)
- [ ] T027 Create auth layout in src/app/(auth)/layout.tsx ❌ SKIP (Figma Make)
- [x] T028 Create dashboard layout with sidebar navigation in src/app/(dashboard)/layout.tsx
- [ ] T029 [P] Create Sidebar component with navigation items in src/components/layout/sidebar.tsx ❌ SKIP (Figma Make)
- [ ] T030 [P] Create Breadcrumb component in src/components/layout/breadcrumb.tsx ❌ SKIP (Figma Make)
- [ ] T031 [P] Create UserButton component for profile/logout in src/components/layout/user-button.tsx ❌ SKIP (Figma Make)
- [x] T032 Create Zod validation schemas for all entities in src/lib/validators/

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - User Completes Assigned Course (Priority: P1) 🎯 MVP

**Goal**: BDR team members can view assigned courses, navigate lessons, complete quizzes, and track progress to 100%

**Independent Test**: Assign a course with multiple lesson types to a user, verify they can view content, complete lessons, take quizzes, and see progress reach 100%

### Convex Backend for User Story 1

- [x] T033 [P] [US1] Implement courses.listForUser query (assigned courses with progress) in convex/courses.ts
- [x] T034 [P] [US1] Implement courses.get query (course details with sections/lessons) in convex/courses.ts
- [x] T035 [P] [US1] Implement courses.getWithProgress query in convex/courses.ts
- [x] T036 [P] [US1] Implement courses.incrementViewCount mutation in convex/courses.ts
- [x] T037 [P] [US1] Implement lessons.get query (lesson with type-specific content) in convex/lessons.ts
- [x] T038 [P] [US1] Implement lessons.listBySection query in convex/lessons.ts
- [x] T039 [P] [US1] Implement progress.getForLesson query in convex/progress.ts
- [x] T040 [P] [US1] Implement progress.getForCourse query in convex/progress.ts
- [x] T041 [P] [US1] Implement progress.getContinueWatching query in convex/progress.ts
- [x] T042 [US1] Implement progress.markStarted mutation in convex/progress.ts
- [x] T043 [US1] Implement progress.markCompleted mutation in convex/progress.ts
- [x] T044 [US1] Implement progress.updateTimeSpent mutation in convex/progress.ts
- [x] T045 [P] [US1] Implement quizzes.getQuizStatus query in convex/quizzes.ts
- [x] T046 [P] [US1] Implement quizzes.getLatestAttempt query in convex/quizzes.ts
- [x] T047 [US1] Implement quizzes.submit mutation with scoring logic in convex/quizzes.ts
- [x] T048 [P] [US1] Implement files.listForLesson query in convex/files.ts
- [x] T049 [P] [US1] Implement files.getUrl query in convex/files.ts

### Frontend Components for User Story 1

- [x] T050 [P] [US1] Create user dashboard page in src/app/(dashboard)/page.tsx
- [x] T051 [P] [US1] Create CourseCard component in src/components/dashboard/course-card.tsx
- [x] T051a [P] [US1] Create user courses list page in src/app/(dashboard)/courses/page.tsx (Figma Make)
- [x] T051b [P] [US1] Create CourseSection component in src/components/courses/course-section.tsx (Figma Make)
- [x] T051c [P] [US1] Create CourseCarousel component in src/components/courses/course-carousel.tsx (Figma Make)
- [x] T051d [P] [US1] Create CourseCard component in src/components/courses/course-card.tsx (Figma Make)
- [x] T051e [P] [US1] Create CourseFilters component in src/components/courses/course-filters.tsx (Figma Make)
- [ ] T052 [P] [US1] Create CourseGrid component in src/components/courses/course-grid.tsx ❌ SKIP (replaced by T051b-c)
- [ ] T053 [P] [US1] Create ContinueWatching component in src/components/courses/continue-watching.tsx ❌ SKIP (integrated in T051a)
- [ ] T054 [P] [US1] Create ProgressBar component in src/components/courses/progress-bar.tsx ❌ SKIP (integrated in T051d)
- [x] T055 [US1] Create course detail page in src/app/(dashboard)/courses/[courseId]/page.tsx
- [ ] T056 [P] [US1] Create CourseHeader component in src/components/courses/course-header.tsx ❌ SKIP (Figma Make)
- [ ] T057 [P] [US1] Create SectionList component (collapsible sections) in src/components/courses/section-list.tsx ❌ SKIP (Figma Make)
- [ ] T058 [P] [US1] Create LessonItem component in src/components/courses/lesson-item.tsx ❌ SKIP (Figma Make)
- [ ] T059 [US1] Create lesson viewer page in src/app/(dashboard)/courses/[courseId]/lessons/[lessonId]/page.tsx ❌ SKIP (Figma Make)
- [ ] T060 [P] [US1] Create TextLesson component (render Plate.js content) in src/components/lessons/text-lesson.tsx ❌ SKIP (Figma Make)
- [ ] T061 [P] [US1] Create EmbedLesson component (YouTube, Vimeo, Loom, Figma) in src/components/lessons/embed-lesson.tsx ❌ SKIP (Figma Make)
- [ ] T062 [P] [US1] Create FilesLesson component (file download list) in src/components/lessons/files-lesson.tsx ❌ SKIP (Figma Make)
- [ ] T063 [US1] Create QuizLesson component with question display in src/components/lessons/quiz-lesson.tsx ❌ SKIP (Figma Make)
- [ ] T064 [US1] Create QuizQuestion component in src/components/lessons/quiz-question.tsx ❌ SKIP (Figma Make)
- [ ] T065 [US1] Create QuizResults component (score, pass/fail, retry) in src/components/lessons/quiz-results.tsx ❌ SKIP (Figma Make)
- [ ] T066 [P] [US1] Create LessonNavigation component (prev/next) in src/components/lessons/lesson-navigation.tsx ❌ SKIP (Figma Make)
- [ ] T067 [P] [US1] Create MarkCompleteButton component in src/components/lessons/mark-complete-button.tsx ❌ SKIP (Figma Make)
- [x] T068 [US1] Implement lesson progress tracking (time spent, completion) in src/hooks/use-lesson-progress.ts

**Checkpoint**: User Story 1 complete - users can view courses, complete lessons, take quizzes, track progress

---

## Phase 4: User Story 2 - Admin Creates and Publishes Course (Priority: P1)

**Goal**: Admins can create courses with all lesson types, configure visibility, and publish

**Independent Test**: Admin creates a course from scratch, adds all four lesson types, sets team visibility, publishes it

### Convex Backend for User Story 2

- [x] T069 [P] [US2] Implement courses.list query (admin view with drafts) in convex/courses.ts
- [x] T070 [P] [US2] Implement courses.create mutation in convex/courses.ts
- [x] T071 [P] [US2] Implement courses.update mutation in convex/courses.ts
- [x] T072 [P] [US2] Implement courses.setCoverImage mutation in convex/courses.ts
- [x] T073 [P] [US2] Implement courses.publish mutation with validation in convex/courses.ts
- [x] T074 [P] [US2] Implement courses.unpublish mutation in convex/courses.ts
- [x] T075 [P] [US2] Implement courses.remove mutation in convex/courses.ts
- [x] T076 [P] [US2] Implement courses.reorder mutation in convex/courses.ts
- [x] T077 [P] [US2] Implement courses.addTag and removeTag mutations in convex/courses.ts
- [x] T078 [P] [US2] Implement courses.assign and unassign mutations in convex/courses.ts
- [x] T079 [P] [US2] Implement sections.create mutation in convex/sections.ts
- [x] T080 [P] [US2] Implement sections.update mutation in convex/sections.ts
- [x] T081 [P] [US2] Implement sections.remove mutation in convex/sections.ts
- [x] T082 [P] [US2] Implement sections.reorder mutation in convex/sections.ts
- [x] T083 [P] [US2] Implement lessons.create mutation in convex/lessons.ts
- [x] T084 [P] [US2] Implement lessons.update mutation in convex/lessons.ts
- [x] T085 [P] [US2] Implement lessons.updateContent mutation (Plate.js JSON) in convex/lessons.ts
- [x] T086 [P] [US2] Implement lessons.remove mutation in convex/lessons.ts
- [x] T087 [P] [US2] Implement lessons.reorder mutation in convex/lessons.ts
- [x] T088 [P] [US2] Implement lessons.setEmbed mutation (auto-detect provider) in convex/lessons.ts
- [x] T089 [P] [US2] Implement lessons.updateQuizConfig mutation in convex/lessons.ts
- [x] T090 [P] [US2] Implement lessons.addQuestion mutation in convex/lessons.ts
- [x] T091 [P] [US2] Implement lessons.updateQuestion mutation in convex/lessons.ts
- [x] T092 [P] [US2] Implement lessons.removeQuestion mutation in convex/lessons.ts
- [x] T093 [P] [US2] Implement lessons.reorderQuestions mutation in convex/lessons.ts
- [x] T094 [P] [US2] Implement files.getUploadUrl mutation in convex/files.ts
- [x] T095 [P] [US2] Implement files.saveAttachment mutation in convex/files.ts
- [x] T096 [P] [US2] Implement files.removeAttachment mutation in convex/files.ts
- [x] T097 [P] [US2] Implement files.saveCoverImage mutation in convex/files.ts
- [x] T098 [P] [US2] Implement tags.list query in convex/tags.ts

### Frontend Components for User Story 2

- [x] T099 [P] [US2] Create admin courses list page in src/app/(dashboard)/admin/courses/page.tsx
- [ ] T100 [P] [US2] Create AdminCourseCard component in src/components/admin/courses/admin-course-card.tsx
- [ ] T101 [P] [US2] Create AdminCourseTable component with TanStack Table in src/components/admin/courses/admin-course-table.tsx
- [x] T102 [US2] Create course editor page in src/app/(dashboard)/admin/courses/[courseId]/page.tsx
- [ ] T103 [P] [US2] Create CourseForm component (title, description, visibility) in src/components/admin/courses/course-form.tsx
- [ ] T104 [P] [US2] Create CoverImageUpload component in src/components/admin/courses/cover-image-upload.tsx
- [ ] T105 [P] [US2] Create TagSelector component in src/components/admin/courses/tag-selector.tsx
- [ ] T106 [P] [US2] Create VisibilitySelector component in src/components/admin/courses/visibility-selector.tsx
- [x] T107 [US2] Create SectionEditor component with drag-and-drop in src/components/admin/courses/section-editor.tsx
- [x] T108 [US2] Create LessonEditor component with drag-and-drop in src/components/admin/courses/lesson-editor.tsx
- [ ] T109 [US2] Create lesson type editor page in src/app/(dashboard)/admin/courses/[courseId]/lessons/[lessonId]/page.tsx

**Prerequisites**: T010-T012 must be complete (all Plate.js components installed)

- [x] T110 [US2] Configure Plate.js editor - PARENT TASK (depends on T010-T012 completion)
- [x] T110a [P] [US2] Configure Plate.js base editor with editor-base-kit in src/components/editor/plate-editor.tsx
- [x] T110b [P] [US2] Add basic-blocks-kit and basic-marks-kit plugins to Plate.js editor
- [x] T110c [P] [US2] Add table-kit plugin with table toolbar integration
- [x] T110d [P] [US2] Add media-kit plugin for images, videos, and embeds
- [x] T110e [US2] Add mention-kit plugin with Convex user search integration
- [x] T110f [P] [US2] Add comment-kit plugin for admin annotations
- [x] T110g [P] [US2] Add ai-kit and copilot-demo plugins (optional AI features)
- [x] T110h [US2] Configure fixed-toolbar-kit with all toolbar buttons from Phase 6 installations
- [ ] T111 [P] [US2] Create EditorToolbar component in src/components/editor/editor-toolbar.tsx
- [ ] T112 [P] [US2] Create EmbedConfigForm component in src/components/admin/lessons/embed-config-form.tsx
- [ ] T113 [US2] Create QuizConfigForm component in src/components/admin/lessons/quiz-config-form.tsx
- [ ] T114 [US2] Create QuestionEditor component in src/components/admin/lessons/question-editor.tsx
- [ ] T115 [P] [US2] Create FileUploader component with drag-and-drop in src/components/admin/lessons/file-uploader.tsx
- [ ] T116 [P] [US2] Create PublishButton component with validation in src/components/admin/courses/publish-button.tsx
- [ ] T117 [US2] Create course assignment dialog in src/components/admin/courses/assignment-dialog.tsx

**Checkpoint**: User Story 2 complete - admins can create full courses with all lesson types

---

## Phase 5: User Story 3 - Admin Manages Teams (Priority: P2)

**Goal**: Admins can create teams, manage members, assign courses to teams

**Independent Test**: Create team, add members, assign course, verify team members see the course

### Convex Backend for User Story 3

- [x] T118 [P] [US3] Implement teams.list query in convex/teams.ts
- [x] T119 [P] [US3] Implement teams.get query in convex/teams.ts
- [x] T120 [P] [US3] Implement teams.getForUser query in convex/teams.ts
- [x] T121 [P] [US3] Implement teams.getMembers query in convex/teams.ts
- [x] T122 [P] [US3] Implement teams.create mutation in convex/teams.ts
- [x] T123 [P] [US3] Implement teams.update mutation in convex/teams.ts
- [x] T124 [P] [US3] Implement teams.remove mutation in convex/teams.ts
- [x] T125 [P] [US3] Implement teams.addMember mutation in convex/teams.ts
- [x] T126 [P] [US3] Implement teams.removeMember mutation in convex/teams.ts
- [x] T127 [P] [US3] Implement teams.addMembers (bulk) mutation in convex/teams.ts
- [x] T128 [P] [US3] Implement teams.setLead mutation in convex/teams.ts

### Frontend Components for User Story 3

- [x] T129 [P] [US3] Create admin teams page in src/app/(dashboard)/admin/teams/page.tsx
- [ ] T130 [P] [US3] Create TeamCard component in src/components/admin/teams/team-card.tsx ❌ SKIP (Figma Make)
- [x] T131 [P] [US3] Create TeamTable component with TanStack Table in src/components/admin/teams/teams-table.tsx
- [x] T132 [US3] Create team detail page in src/app/(dashboard)/admin/teams/[teamId]/page.tsx
- [ ] T133 [P] [US3] Create TeamForm component in src/components/admin/teams/team-form.tsx ❌ SKIP (inline editing)
- [x] T134 [P] [US3] Create MemberList component in src/components/admin/teams/members-table.tsx
- [x] T135 [P] [US3] Create AddMemberDialog component with user search in src/components/admin/teams/add-member-dialog.tsx
- [ ] T136 [P] [US3] Create TeamLeadSelector component in src/components/admin/teams/team-lead-selector.tsx ❌ SKIP (integrated in members table)
- [ ] T137 [US3] Create team course assignment section in src/components/admin/teams/team-courses.tsx ❌ SKIP (Figma Make)

**Checkpoint**: User Story 3 complete - team management functional

---

## Phase 6: User Story 4 - Admin Views Analytics Dashboard (Priority: P2)

**Goal**: Admins see user activity, quiz performance, course metrics, and filterable activity log

**Independent Test**: Multiple users complete courses/quizzes, verify admin dashboard shows accurate metrics

### Convex Backend for User Story 4

- [x] T138 [P] [US4] Implement analytics.getOverview query in convex/analytics.ts
- [x] T139 [P] [US4] Implement analytics.getUserActivity query in convex/analytics.ts
- [x] T140 [P] [US4] Implement analytics.getQuizMetrics query in convex/analytics.ts
- [x] T141 [P] [US4] Implement analytics.getCourseMetrics query in convex/analytics.ts
- [x] T142 [P] [US4] Implement analytics.getActivityLog query (paginated, filterable) in convex/analytics.ts
- [x] T143 [P] [US4] Implement analytics.getSessionStats query in convex/analytics.ts
- [x] T144 [P] [US4] Implement analytics.logActivity internal mutation in convex/analytics.ts
- [x] T145 [P] [US4] Implement analytics.startSession mutation in convex/analytics.ts
- [x] T146 [P] [US4] Implement analytics.endSession mutation in convex/analytics.ts
- [x] T147 [P] [US4] Implement analytics.heartbeat mutation in convex/analytics.ts
- [x] T148 [US4] Integrate activity logging into existing mutations (progress, quizzes, etc.)

### Frontend Components for User Story 4

- [ ] T149 [P] [US4] Create admin analytics page in src/app/(dashboard)/admin/analytics/page.tsx
- [ ] T150 [P] [US4] Create OverviewCards component (stats cards) in src/components/analytics/overview-cards.tsx
- [ ] T151 [P] [US4] Create UserActivityTable component in src/components/analytics/user-activity-table.tsx
- [ ] T152 [P] [US4] Create QuizMetricsPanel component in src/components/analytics/quiz-metrics-panel.tsx
- [ ] T153 [P] [US4] Create ScoreDistributionChart component (Recharts) in src/components/analytics/score-distribution-chart.tsx
- [ ] T154 [P] [US4] Create CourseMetricsPanel component in src/components/analytics/course-metrics-panel.tsx
- [ ] T155 [P] [US4] Create PopularCoursesChart component (Recharts) in src/components/analytics/popular-courses-chart.tsx
- [ ] T156 [P] [US4] Create ProgressBreakdownChart component (Recharts) in src/components/analytics/progress-breakdown-chart.tsx
- [ ] T157 [US4] Create ActivityLogTable component with filters in src/components/analytics/activity-log-table.tsx
- [ ] T158 [P] [US4] Create TeamFilter component for all analytics in src/components/analytics/team-filter.tsx
- [ ] T159 [P] [US4] Create DateRangeFilter component in src/components/analytics/date-range-filter.tsx
- [x] T160 [US4] Implement session tracking hook in src/hooks/use-session-tracking.ts

**Checkpoint**: User Story 4 complete - analytics dashboard fully functional

---

## Phase 7: User Story 5 - Users Exchange Private Messages (Priority: P3)

**Goal**: Real-time direct messaging between users with read receipts and admin broadcasts

**Independent Test**: Two users exchange messages, verify real-time delivery and read receipts

### Convex Backend for User Story 5

- [x] T161 [P] [US5] Implement messages.listConversations query in convex/messages.ts
- [x] T162 [P] [US5] Implement messages.getConversation query in convex/messages.ts
- [x] T163 [P] [US5] Implement messages.getOrCreateDirect query in convex/messages.ts
- [x] T164 [P] [US5] Implement messages.getUnreadCount query in convex/messages.ts
- [x] T165 [P] [US5] Implement messages.search query in convex/messages.ts
- [x] T166 [P] [US5] Implement messages.send mutation in convex/messages.ts
- [x] T167 [P] [US5] Implement messages.sendDirect mutation in convex/messages.ts
- [x] T168 [P] [US5] Implement messages.broadcast mutation (admin) in convex/messages.ts
- [x] T169 [P] [US5] Implement messages.markRead mutation in convex/messages.ts

### Frontend Components for User Story 5

- [x] T170 [P] [US5] Create messages page in src/app/(dashboard)/messages/page.tsx
- [x] T171 [P] [US5] Create ConversationList component in src/components/messaging/conversation-list.tsx
- [x] T172 [P] [US5] Create ConversationItem component in src/components/messaging/conversation-item.tsx
- [x] T173 [US5] Create ChatView component in src/components/messaging/chat-view.tsx
- [x] T174 [P] [US5] Create MessageBubble component in src/components/messaging/message-bubble.tsx
- [x] T175 [P] [US5] Create MessageInput component in src/components/messaging/message-input.tsx
- [ ] T176 [P] [US5] Create NewMessageDialog component with user search in src/components/messaging/new-message-dialog.tsx
- [ ] T177 [P] [US5] Create BroadcastDialog component (admin) in src/components/messaging/broadcast-dialog.tsx
- [ ] T178 [P] [US5] Create UnreadBadge component for sidebar in src/components/messaging/unread-badge.tsx
- [ ] T179 [P] [US5] Create MessageSearch component in src/components/messaging/message-search.tsx

**Checkpoint**: User Story 5 complete - messaging system functional

---

## Phase 8: User Story 6 - Users Post and Reply to Comments (Priority: P3)

**Goal**: Users comment on courses/lessons with threaded replies, admins moderate

**Independent Test**: User posts comment, another replies, admin pins and deletes

### Convex Backend for User Story 6

- [x] T180 [P] [US6] Implement comments.listForCourse query in convex/comments.ts
- [x] T181 [P] [US6] Implement comments.listForLesson query in convex/comments.ts
- [x] T182 [P] [US6] Implement comments.getReplies query in convex/comments.ts
- [x] T183 [P] [US6] Implement comments.create mutation in convex/comments.ts
- [x] T184 [P] [US6] Implement comments.reply mutation in convex/comments.ts
- [x] T185 [P] [US6] Implement comments.update mutation in convex/comments.ts
- [x] T186 [P] [US6] Implement comments.remove mutation in convex/comments.ts
- [x] T187 [P] [US6] Implement comments.pin mutation in convex/comments.ts
- [x] T188 [P] [US6] Implement comments.unpin mutation in convex/comments.ts

### Frontend Components for User Story 6

- [ ] T189 [P] [US6] Create CommentSection component in src/components/comments/comment-section.tsx
- [ ] T190 [P] [US6] Create CommentThread component in src/components/comments/comment-thread.tsx
- [ ] T191 [P] [US6] Create CommentItem component in src/components/comments/comment-item.tsx
- [ ] T192 [P] [US6] Create CommentForm component in src/components/comments/comment-form.tsx
- [ ] T193 [P] [US6] Create ReplyForm component in src/components/comments/reply-form.tsx
- [ ] T194 [P] [US6] Create CommentActions component (edit, delete, pin) in src/components/comments/comment-actions.tsx
- [ ] T195 [US6] Integrate CommentSection into course and lesson pages

**Checkpoint**: User Story 6 complete - commenting system functional

---

## Phase 9: User Story 7 - Responsive Multi-Device Experience (Priority: P3)

**Goal**: Platform adapts to desktop, tablet, and mobile viewports

**Independent Test**: Access all major flows on 320px, 768px, and 1440px viewports

### Frontend Components for User Story 7

- [ ] T196 [P] [US7] Create responsive MobileNavigation component in src/components/layout/mobile-navigation.tsx
- [ ] T197 [P] [US7] Create responsive BottomNav component for mobile in src/components/layout/bottom-nav.tsx
- [ ] T198 [P] [US7] Update Sidebar with responsive collapse behavior in src/components/layout/sidebar.tsx
- [ ] T199 [P] [US7] Create responsive CourseGrid with breakpoint columns in src/components/courses/course-grid.tsx
- [ ] T200 [P] [US7] Update lesson viewer for mobile-friendly layout in src/components/lessons/
- [ ] T201 [P] [US7] Update chat view for mobile-friendly layout in src/components/messaging/chat-view.tsx
- [ ] T202 [P] [US7] Add touch-friendly sizing to all interactive elements
- [ ] T203 [P] [US7] Test and fix all admin pages for tablet responsiveness
- [ ] T204 [US7] Add viewport-aware navigation logic in src/hooks/use-responsive.ts

**Checkpoint**: User Story 7 complete - fully responsive across devices

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T205 [P] Create global search component in src/components/layout/global-search.tsx
- [x] T206 [P] Implement search indexing for courses, lessons, users in convex/search.ts
- [ ] T207 [P] Add loading states (skeletons) to all data-fetching components
- [ ] T208 [P] Add error boundaries and error states to all pages
- [ ] T209 [P] Configure Sonner toast notifications in src/components/providers/
- [ ] T210 [P] Add optimistic updates to all mutations
- [ ] T211 Create admin users management page in src/app/(dashboard)/admin/users/page.tsx
- [ ] T212 [P] Create user profile page in src/app/(dashboard)/profile/page.tsx
- [ ] T213 Add keyboard navigation to all interactive components
- [ ] T214 [P] Add ARIA labels and roles for accessibility
- [ ] T215 [P] Verify color contrast meets WCAG 2.1 AA (4.5:1 ratio)
- [ ] T216 Run performance audit and optimize bundle size (<150KB gzipped)
- [x] T217 [P] Create seed script for development data in convex/seed.ts
- [ ] T218 Run quickstart.md validation to verify setup works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3-9 (User Stories)**: All depend on Phase 2 completion
- **Phase 10 (Polish)**: Depends on core user stories (Phase 3-6 minimum)

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 - Creates courses that US1 consumes
- **US3 (P2)**: Can start after Phase 2 - Integrates with course assignment
- **US4 (P2)**: Can start after Phase 2 - Requires activity data from US1/US2
- **US5 (P3)**: Can start after Phase 2 - Independent messaging system
- **US6 (P3)**: Can start after Phase 2 - Integrates with course/lesson pages
- **US7 (P3)**: Should start after US1/US2 - Responsive refinement of existing UI

### Within Each User Story

- Backend queries/mutations before frontend components
- Core components before integration
- Data display before data mutation

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel
- US1 and US2 can be developed in parallel (different teams)
- US3-US6 can start in parallel after Foundational
- All backend queries marked [P] can be implemented simultaneously
- All frontend components marked [P] can be built simultaneously

---

## Parallel Example: User Story 1 Backend

```bash
# Launch all US1 queries in parallel:
Task: "Implement courses.listForUser query in convex/courses.ts"
Task: "Implement courses.get query in convex/courses.ts"
Task: "Implement courses.getWithProgress query in convex/courses.ts"
Task: "Implement lessons.get query in convex/lessons.ts"
Task: "Implement progress.getForLesson query in convex/progress.ts"
Task: "Implement quizzes.getQuizStatus query in convex/quizzes.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 - User can complete courses
4. Complete Phase 4: US2 - Admin can create courses
5. **STOP and VALIDATE**: Full course creation and consumption flow works
6. Deploy as MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Core LMS functional (MVP!)
3. Add US3 → Team management
4. Add US4 → Analytics dashboard
5. Add US5 → Messaging
6. Add US6 → Comments
7. Add US7 → Mobile polish

### Parallel Team Strategy (2 developers)

1. Team completes Setup + Foundational together
2. Developer A: US1 (course consumption)
3. Developer B: US2 (course creation)
4. Merge and test → MVP ready
5. Continue with remaining stories

---

## Phase 11: Testing & Quality Assurance

**Purpose**: Ensure constitution compliance with 80% coverage, TDD, integration tests, and E2E tests

> **Constitution Compliance**: II. Testing Standards - 80% coverage, TDD, integration tests, E2E tests

### Test Infrastructure

- [ ] T219 [P] Setup Vitest configuration with convex-test in vitest.config.ts
- [ ] T220 [P] Setup Playwright configuration with test fixtures in playwright.config.ts
- [ ] T221 Configure CI pipeline for test execution (GitHub Actions) in .github/workflows/test.yml
- [ ] T222 [P] Setup code coverage reporting with target 80% minimum
- [ ] T223 [P] Create test seed data for Convex (users, teams, courses) in convex/test/seed.ts
- [ ] T224 [P] Create Playwright fixtures (authenticated user, admin user) in tests/e2e/fixtures/
- [ ] T225 [P] Create mock data generators for all entity types in tests/utils/generators.ts

### Unit Tests - Convex Functions

- [ ] T226 [P] Unit tests for convex/auth.ts - webhook handlers, user sync
- [ ] T227 [P] Unit tests for convex/users.ts - CRUD, search, status updates
- [ ] T228 [P] Unit tests for convex/teams.ts - CRUD, membership management
- [ ] T229 [P] Unit tests for convex/courses.ts - CRUD, publish/unpublish, assignments
- [ ] T230 [P] Unit tests for convex/sections.ts - CRUD, reordering
- [ ] T231 [P] Unit tests for convex/lessons.ts - CRUD, type-specific operations
- [ ] T232 [P] Unit tests for convex/quizzes.ts - submit, scoring, retry logic
- [ ] T233 [P] Unit tests for convex/progress.ts - tracking, completion, time spent
- [ ] T234 [P] Unit tests for convex/analytics.ts - overview, metrics, activity logs
- [ ] T235 [P] Unit tests for convex/messages.ts - conversations, send, broadcast
- [ ] T236 [P] Unit tests for convex/comments.ts - CRUD, threading, moderation
- [ ] T237 [P] Unit tests for convex/files.ts - upload, attachments, storage

### Integration Tests

- [ ] T238 Integration test: User signup → Clerk webhook → Convex user created
- [ ] T239 Integration test: Course publish workflow (draft → sections → lessons → publish)
- [ ] T240 Integration test: Quiz attempt flow (start → answer → submit → score → progress)
- [ ] T241 Integration test: Real-time messaging (send → receive → read receipts)

### E2E Tests - User Story Acceptance

- [ ] T242 [US2] E2E: Admin creates and publishes a course with all lesson types
- [ ] T243 [US1] E2E: User completes a course with quiz (progress tracked to 100%)
- [ ] T244 [US3] E2E: Admin manages teams and assigns courses to team members
- [ ] T245 [US5] E2E: User sends messages and receives real-time updates
- [ ] T246 [US4] E2E: Admin views analytics dashboard with accurate metrics
- [ ] T247 [US6] E2E: User posts comments, admin moderates (pin/delete)
- [ ] T248 [US7] E2E: Responsive layout works on mobile (320px) and desktop (1440px)
- [ ] T249 E2E: Keyboard navigation works for all interactive elements

**Checkpoint**: All tests passing with 80%+ coverage

---

## Phase 12: Accessibility Compliance (WCAG 2.1 AA)

**Purpose**: Meet constitution requirement IV. Accessibility - WCAG 2.1 AA compliance

- [ ] T250 [P] Integrate axe-core into development workflow in src/lib/axe-setup.ts
- [ ] T251 [P] Add axe-core to CI pipeline for automated accessibility testing
- [ ] T252 Run axe-core audit on all pages, fix all critical/serious issues
- [ ] T253 [P] Verify keyboard navigation for all interactive components
- [ ] T254 [P] Verify color contrast ratios (4.5:1 text, 3:1 UI components) using design-system.md
- [ ] T255 [P] Add skip-to-content link and landmark regions to src/app/(dashboard)/layout.tsx
- [ ] T256 Verify screen reader compatibility (VoiceOver, NVDA) for critical flows
- [ ] T257 [P] Document WCAG 2.1 AA compliance checklist with evidence in specs/001-bdr-lms/accessibility-report.md

**Checkpoint**: WCAG 2.1 AA compliance verified

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Convex provides real-time by default - no additional WebSocket setup
- Clerk handles all auth - no custom auth implementation
- Plate.js components installed via CLI - configure plugins as needed
- All file uploads go through Convex storage (50MB limit)
- Tests should be written alongside implementation (TDD approach per constitution)
