# Tasks: BDR Messaging — Slack-like Communication Platform

**Input**: Design documents from `/specs/001-slack-messaging/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `convex/` (Convex functions and schema)
- **Frontend**: `src/` (Next.js app and components)
- **Types/Contracts**: Follow existing project patterns

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and foundational schema

- [ ] T001 Install messaging dependencies: @emoji-mart/data, @emoji-mart/react, wavesurfer.js, openai in package.json
- [ ] T002 Add OPENAI_API_KEY to environment variables documentation in specs/001-slack-messaging/quickstart.md
- [ ] T003 [P] Create messaging directory structure: src/components/messaging/, src/hooks/, src/app/(dashboard)/messages/
- [ ] T004 [P] Create presence directory structure: src/components/presence/
- [ ] T005 Extend convex/schema.ts with all new messaging tables (channels, channelMembers, channelAdmins, conversations, conversationParticipants, messages, voiceMessages, reactions, mentions, pins, bookmarks, typingIndicators, notificationPreferences, messageAttachments, rateLimits, transcriptionUsage, transcriptionBudget, aiTrainingCorpus, messageRetention, gdprRequests)
- [ ] T006 Add search index to messages table: searchIndex("search_content", { searchField: "content", filterFields: ["channelId", "conversationId", "senderId", "contentType"] }) in convex/schema.ts
- [ ] T007 [P] Extend users table with presence fields (status, lastActiveAt, customStatus, customStatusEmoji, customStatusExpiresAt) in convex/schema.ts
- [ ] T008 Deploy schema changes with npx convex deploy

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create convex/lib/permissions.ts with channel access check helpers (isChannelMember, canAccessChannel, hasChannelRole)
- [ ] T010 [P] Create convex/lib/rateLimits.ts with checkRateLimit helper for text (30/min) and voice (20/hr) limits
- [ ] T011 [P] Create src/lib/mention-parser.ts for parsing @mentions from message content
- [ ] T012 [P] Create src/lib/audio-utils.ts with MediaRecorder format detection (WebM/Opus vs MP4/AAC)
- [ ] T013 Create convex/lib/auth.ts extensions: requireChannelMember, requireChannelAdmin helper functions
- [ ] T014 Create base message input component src/components/messaging/message-input.tsx with rich text support using Plate.js
- [ ] T015 [P] Create base message item component src/components/messaging/message-item.tsx for rendering messages
- [ ] T016 [P] Create unread badge component src/components/messaging/unread-badge.tsx
- [ ] T017 Create messages layout src/app/(dashboard)/messages/layout.tsx with sidebar for channels/DMs

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Channel Messaging (Priority: P1) MVP

**Goal**: Users can communicate in organized topic-based channel spaces with real-time message delivery

**Independent Test**: Create a channel, send a message, verify another user sees it instantly

### Implementation for User Story 1

- [ ] T018 [P] [US1] Create convex/channels.ts with create mutation (FR-001, FR-002, FR-036)
- [ ] T019 [P] [US1] Implement list query in convex/channels.ts returning ChannelWithMembership[]
- [ ] T020 [US1] Implement get query in convex/channels.ts with membership info and pinned messages
- [ ] T021 [US1] Implement join mutation for public channels in convex/channels.ts (FR-001)
- [ ] T022 [US1] Implement leave mutation in convex/channels.ts with ownership transfer check
- [ ] T023 [P] [US1] Create convex/messages.ts with sendToChannel mutation (FR-010, FR-044, FR-046)
- [ ] T024 [US1] Implement listForChannel query with cursor pagination in convex/messages.ts
- [ ] T025 [US1] Implement edit mutation with history tracking in convex/messages.ts (FR-013)
- [ ] T026 [US1] Implement delete (soft-delete) mutation in convex/messages.ts (FR-014)
- [ ] T027 [P] [US1] Create src/components/messaging/channel-list.tsx displaying user's channels
- [ ] T028 [P] [US1] Create src/components/messaging/channel-header.tsx with name, topic, member count
- [ ] T029 [US1] Create src/components/messaging/message-list.tsx with real-time subscription and infinite scroll
- [ ] T030 [US1] Create src/hooks/use-channel.ts hook for channel data subscription
- [ ] T031 [US1] Create src/hooks/use-messages.ts hook for message list subscription
- [ ] T032 [US1] Create src/app/(dashboard)/messages/[channelId]/page.tsx channel view page
- [ ] T033 [US1] Implement markAsRead mutation in convex/channels.ts (FR-031a)
- [ ] T034 [US1] Implement markAllAsRead mutation in convex/channels.ts (FR-031b)
- [ ] T035 [US1] Add viewport intersection observer for auto-marking messages read in src/components/messaging/message-list.tsx
- [ ] T036 [US1] Implement unread count calculation in list query convex/channels.ts (FR-031)
- [ ] T037 [US1] Add sent indicator (checkmark) to message-item.tsx (FR-015a)

**Checkpoint**: User Story 1 - Channel messaging with real-time updates and unread tracking complete

---

## Phase 4: User Story 2 - Direct Messages (Priority: P1)

**Goal**: Users can have private 1:1 and group conversations with real-time delivery

**Independent Test**: Initiate a DM with another user, send messages back and forth

### Implementation for User Story 2

- [ ] T038 [P] [US2] Create convex/directMessages.ts with startDirect mutation (FR-007)
- [ ] T039 [P] [US2] Implement createGroup mutation with 2-8 participant validation (FR-008)
- [ ] T040 [US2] Implement list query returning ConversationWithDetails[] sorted by lastMessageAt
- [ ] T041 [US2] Implement get query for single conversation in convex/directMessages.ts
- [ ] T042 [US2] Implement findWithUser query to find existing DM in convex/directMessages.ts
- [ ] T043 [US2] Implement searchUsers query for finding users to DM in convex/directMessages.ts
- [ ] T044 [US2] Add sendToConversation mutation in convex/messages.ts
- [ ] T045 [US2] Add listForConversation query in convex/messages.ts
- [ ] T046 [P] [US2] Create src/components/messaging/dm-list.tsx displaying conversations
- [ ] T047 [US2] Create src/app/(dashboard)/messages/dm/[conversationId]/page.tsx DM view page
- [ ] T048 [US2] Implement setTyping mutation in convex/directMessages.ts (FR-009a)
- [ ] T049 [US2] Implement clearTyping mutation in convex/directMessages.ts
- [ ] T050 [US2] Implement getTypingIndicators query in convex/directMessages.ts
- [ ] T051 [P] [US2] Create src/components/messaging/typing-indicator.tsx for DMs
- [ ] T052 [US2] Create src/hooks/use-typing-indicator.ts with debounced keystroke handling
- [ ] T053 [US2] Implement markAsRead and markAllAsRead mutations in convex/directMessages.ts
- [ ] T054 [US2] Implement getTotalUnreadCount query in convex/directMessages.ts
- [ ] T055 [US2] Add addParticipant mutation for group DMs in convex/directMessages.ts
- [ ] T056 [US2] Add leaveGroup mutation in convex/directMessages.ts
- [ ] T057 [US2] Add updateGroupName mutation in convex/directMessages.ts
- [ ] T058 [US2] Add hide mutation for hiding conversations in convex/directMessages.ts

**Checkpoint**: User Story 2 - Direct messaging with typing indicators complete

---

## Phase 5: User Story 3 - Course-Linked Discussions (Priority: P2)

**Goal**: Learners can ask questions and discuss specific lessons within course channels

**Independent Test**: Navigate to a lesson, open discussion, post a question, have another user reply

### Implementation for User Story 3

- [ ] T059 [P] [US3] Create internal mutation createCourseChannel in convex/channels.ts (FR-003)
- [ ] T060 [US3] Create internal mutation addCourseEnrollee in convex/channels.ts (FR-041)
- [ ] T061 [US3] Create internal mutation removeCourseEnrollee in convex/channels.ts (FR-043)
- [ ] T062 [US3] Implement getLessonDiscussion query in convex/messages.ts returning threads linked to lessonId (FR-004)
- [ ] T063 [US3] Add lessonId field support to sendToChannel mutation for lesson-linked messages
- [ ] T064 [US3] Grant channel admin rights to course instructors via channelAdmins table (FR-003a)
- [ ] T065 [US3] Hook course publish flow to trigger createCourseChannel
- [ ] T066 [US3] Hook enrollment flow to trigger addCourseEnrollee
- [ ] T067 [US3] Hook enrollment revocation to trigger removeCourseEnrollee
- [ ] T068 [US3] Create course discussion panel component (integrate with existing lesson view)
- [ ] T069 [US3] Implement notification to instructors when questions posted (FR-042)

**Checkpoint**: User Story 3 - Course-linked discussions with auto-enrollment complete

---

## Phase 6: User Story 4 - Public and Private Channels (Priority: P2)

**Goal**: Admins can create public/private channels with proper access control

**Independent Test**: Create a private channel, invite members, verify non-members cannot see it

### Implementation for User Story 4

- [ ] T070 [P] [US4] Implement inviteMembers mutation in convex/channels.ts for private channels
- [ ] T071 [US4] Implement removeMember mutation in convex/channels.ts
- [ ] T072 [US4] Implement update mutation for name/description/topic in convex/channels.ts (FR-005)
- [ ] T073 [US4] Implement archive mutation making channel read-only in convex/channels.ts (FR-006)
- [ ] T074 [US4] Implement unarchive mutation (admin only) in convex/channels.ts
- [ ] T075 [US4] Implement search query for finding channels by name in convex/channels.ts
- [ ] T076 [US4] Add private channel visibility filtering to list query (FR-002)
- [ ] T077 [P] [US4] Create src/components/messaging/channel-settings.tsx for editing channel details
- [ ] T078 [US4] Create channel creation modal/form component
- [ ] T079 [US4] Create member management UI for inviting/removing members

**Checkpoint**: User Story 4 - Public and private channels with admin controls complete

---

## Phase 7: User Story 5 - Threaded Replies (Priority: P2)

**Goal**: Users can reply in threads to keep conversations organized

**Independent Test**: Send a message, reply in thread, verify thread appears attached to parent

### Implementation for User Story 5

- [ ] T080 [P] [US5] Implement getThread query in convex/messages.ts returning parent + replies
- [ ] T081 [US5] Add parentId support to sendToChannel mutation for thread replies (FR-015)
- [ ] T082 [US5] Update threadReplyCount and threadLastReplyAt on parent when reply added
- [ ] T083 [P] [US5] Create src/components/messaging/thread-panel.tsx for viewing threads in sidebar
- [ ] T084 [P] [US5] Create src/components/messaging/thread-view.tsx for thread conversation display
- [ ] T085 [US5] Add "X replies" indicator to message-item.tsx for messages with threads
- [ ] T086 [US5] Create src/hooks/use-threads.ts hook for thread subscription
- [ ] T087 [US5] Add thread reply input to thread-panel.tsx

**Checkpoint**: User Story 5 - Threaded replies with panel view complete

---

## Phase 8: User Story 6 - Rich Text Messages (Priority: P2)

**Goal**: Users can format messages with bold, italic, code, links, and lists

**Independent Test**: Compose a message with formatting, verify it renders correctly for recipients

### Implementation for User Story 6

- [ ] T088 [P] [US6] Configure Plate.js plugins for messaging in message-input.tsx (BasicMarks, Link, Mention, Autoformat, SoftBreak)
- [ ] T089 [US6] Add markdown shortcuts support to message-input.tsx
- [ ] T090 [US6] Create rich text renderer in message-item.tsx for displaying formatted content
- [ ] T091 [US6] Add link preview support for URLs in messages (FR-010)
- [ ] T092 [US6] Add code block syntax highlighting to message-item.tsx (FR-010)
- [ ] T093 [US6] Add bulleted/numbered list rendering in message-item.tsx (FR-010)
- [ ] T094 [US6] Implement 4000 character limit validation in message-input.tsx (FR-046)

**Checkpoint**: User Story 6 - Rich text messaging with formatting complete

---

## Phase 9: User Story 7 - Reactions and Mentions (Priority: P3)

**Goal**: Users can react with emojis and @mention others for notifications

**Independent Test**: Add reaction to message, @mention user, verify notification received

### Implementation for User Story 7

- [ ] T095 [P] [US7] Create convex/reactions.ts with addReaction mutation (FR-016)
- [ ] T096 [US7] Implement removeReaction mutation in convex/reactions.ts
- [ ] T097 [US7] Add reactions aggregation to message queries (grouped by emoji with counts)
- [ ] T098 [P] [US7] Create convex/mentions.ts with extractMentions helper
- [ ] T099 [US7] Create mention notification records when @user mentioned (FR-017)
- [ ] T100 [US7] Implement @here and @everyone mention handling (FR-017)
- [ ] T101 [P] [US7] Create src/components/messaging/emoji-picker.tsx using @emoji-mart/react (FR-016)
- [ ] T102 [P] [US7] Create src/components/messaging/reaction-bar.tsx showing reactions on messages
- [ ] T103 [P] [US7] Create src/components/messaging/mention-autocomplete.tsx for @mention suggestions
- [ ] T104 [US7] Add mention highlighting in message-item.tsx (FR-032)
- [ ] T105 [US7] Integrate mention autocomplete into message-input.tsx

**Checkpoint**: User Story 7 - Reactions and mentions with notifications complete

---

## Phase 10: User Story 8 - Voice Messages with Transcription (Priority: P3)

**Goal**: Users can record and send voice messages with automatic transcription

**Independent Test**: Record voice message, send it, verify playback and transcription appear

### Implementation for User Story 8

- [ ] T106 [P] [US8] Create convex/voiceMessages.ts with generateUploadUrl mutation
- [ ] T107 [US8] Implement sendVoiceToChannel mutation with rate limit check (FR-045) in convex/voiceMessages.ts
- [ ] T108 [US8] Implement sendVoiceToConversation mutation in convex/voiceMessages.ts
- [ ] T109 [US8] Create convex/lib/transcription.ts with OpenAI Whisper integration (FR-021)
- [ ] T110 [US8] Implement processTranscription internal action in convex/voiceMessages.ts
- [ ] T111 [US8] Implement getVoiceMessage query with audio URL in convex/voiceMessages.ts
- [ ] T112 [US8] Implement editTranscription mutation for user corrections in convex/voiceMessages.ts (FR-024)
- [ ] T113 [US8] Implement retryTranscription mutation for failed transcriptions in convex/voiceMessages.ts
- [ ] T114 [P] [US8] Create src/hooks/use-voice-recorder.ts with MediaRecorder and format detection (FR-020, FR-020a)
- [ ] T115 [US8] Add duration validation (1-300 seconds) to use-voice-recorder.ts (FR-020, FR-020b)
- [ ] T116 [P] [US8] Create src/lib/waveform.ts for generating waveform data from audio
- [ ] T117 [P] [US8] Create src/components/messaging/voice-recorder.tsx with recording UI
- [ ] T118 [US8] Create src/components/messaging/voice-player.tsx with WaveSurfer.js integration (FR-023)
- [ ] T119 [US8] Add playback speed controls (0.5x, 1x, 1.5x, 2x) to voice-player.tsx (FR-022)
- [ ] T120 [P] [US8] Create src/components/messaging/waveform-display.tsx for audio visualization
- [ ] T121 [US8] Integrate voice recorder into message-input.tsx
- [ ] T122 [US8] Display transcription with loading state in voice-player.tsx

**Checkpoint**: User Story 8 - Voice messages with transcription complete

---

## Phase 11: User Story 9 - Message Search and Filtering (Priority: P3)

**Goal**: Users can search for past messages across channels and DMs

**Independent Test**: Send messages with distinct terms, search for them, verify results navigate to context

### Implementation for User Story 9

- [ ] T123 [P] [US9] Create convex/search.ts with messages query using Convex text search (FR-025, FR-027)
- [ ] T124 [US9] Implement access control filtering in search (exclude left channels FR-025a, include archived FR-025b)
- [ ] T125 [US9] Implement search filters: channel, sender, date range, message type (FR-026)
- [ ] T126 [US9] Implement getSuggestions query for search autocomplete in convex/search.ts
- [ ] T127 [US9] Implement getRecent query for recent searches in convex/search.ts
- [ ] T128 [US9] Implement saveToHistory mutation in convex/search.ts
- [ ] T129 [US9] Implement getMessageContext query for showing message in context in convex/messages.ts
- [ ] T130 [P] [US9] Create src/components/messaging/search-bar.tsx with input and filters
- [ ] T131 [US9] Create src/components/messaging/search-results.tsx with highlighted matches
- [ ] T132 [US9] Create src/hooks/use-message-search.ts for search state management
- [ ] T133 [US9] Implement navigation to message context from search results

**Checkpoint**: User Story 9 - Full-text search with filters complete

---

## Phase 12: User Story 10 - Presence and Status (Priority: P3)

**Goal**: Users can see who is online and set custom status messages

**Independent Test**: Set a status, go idle for 5 minutes, verify status changes to away

### Implementation for User Story 10

- [ ] T134 [P] [US10] Create convex/presence.ts with heartbeat mutation (30s interval)
- [ ] T135 [US10] Implement setStatus mutation in convex/presence.ts (FR-033)
- [ ] T136 [US10] Implement setCustomStatus mutation in convex/presence.ts (FR-034)
- [ ] T137 [US10] Implement clearCustomStatus mutation in convex/presence.ts
- [ ] T138 [US10] Implement goOffline mutation for beforeunload in convex/presence.ts
- [ ] T139 [US10] Implement getMultiple query for batch presence lookup in convex/presence.ts
- [ ] T140 [US10] Implement getOnlineUsers query for @here mentions in convex/presence.ts
- [ ] T141 [US10] Create internal mutation checkInactiveUsers for 5-min auto-away (FR-035) in convex/presence.ts
- [ ] T142 [P] [US10] Create src/components/presence/status-indicator.tsx (green/yellow/gray/red dots)
- [ ] T143 [P] [US10] Create src/components/presence/status-selector.tsx for setting status
- [ ] T144 [US10] Create src/components/presence/presence-provider.tsx with heartbeat interval
- [ ] T145 [US10] Create src/hooks/use-presence.ts for presence state management
- [ ] T146 [US10] Integrate status indicators into channel-header.tsx and dm-list.tsx
- [ ] T147 [P] [US10] Implement notification preferences queries/mutations in convex/presence.ts (FR-029, FR-030)
- [ ] T148 [US10] Create src/app/(dashboard)/settings/notifications/page.tsx for notification settings

**Checkpoint**: User Story 10 - Presence system with custom status complete

---

## Phase 13: User Story 11 - Message Pinning and Bookmarking (Priority: P4)

**Goal**: Important messages can be pinned to channels or bookmarked for personal reference

**Independent Test**: Pin a message, verify it appears in pinned messages; bookmark a message, verify in bookmarks

### Implementation for User Story 11

- [ ] T149 [P] [US11] Create convex/pins.ts with pin mutation (admin/creator only) (FR-018)
- [ ] T150 [US11] Implement unpin mutation in convex/pins.ts
- [ ] T151 [US11] Implement listPinned query in convex/pins.ts
- [ ] T152 [P] [US11] Create convex/bookmarks.ts with bookmark mutation (FR-019)
- [ ] T153 [US11] Implement removeBookmark mutation in convex/bookmarks.ts
- [ ] T154 [US11] Implement listBookmarks query with message context in convex/bookmarks.ts
- [ ] T155 [P] [US11] Create src/components/messaging/pinned-messages.tsx panel
- [ ] T156 [P] [US11] Create src/components/messaging/bookmarks-list.tsx panel
- [ ] T157 [US11] Add pin/bookmark actions to message-item.tsx context menu

**Checkpoint**: User Story 11 - Pinning and bookmarking complete

---

## Phase 14: User Story 12 - File Attachments (Priority: P4)

**Goal**: Users can share files up to 50MB in conversations

**Independent Test**: Attach and send a file, verify recipient can download it

### Implementation for User Story 12

- [ ] T158 [P] [US12] Create convex/attachments.ts with generateUploadUrl mutation (FR-012)
- [ ] T159 [US12] Implement 50MB size validation in upload flow
- [ ] T160 [US12] Add attachment support to sendToChannel mutation
- [ ] T161 [US12] Add attachment support to sendToConversation mutation
- [ ] T162 [US12] Create file attachment UI in message-input.tsx
- [ ] T163 [US12] Add image preview and download link rendering in message-item.tsx
- [ ] T164 [US12] Add file type icon mapping for non-image attachments

**Checkpoint**: User Story 12 - File attachments complete

---

## Phase 15: User Story 13 - Channel Administration (Priority: P4)

**Goal**: Admins can moderate content, manage users, and export history

**Independent Test**: Archive a channel, hide a message, export history

### Implementation for User Story 13

- [ ] T165 [P] [US13] Implement updateMemberRole mutation in convex/channels.ts
- [ ] T166 [US13] Implement muteMember and unmuteMember mutations in convex/channels.ts (FR-038)
- [ ] T167 [US13] Implement banMember and unbanMember mutations in convex/channels.ts (FR-038)
- [ ] T168 [US13] Implement getMembers query with pagination in convex/channels.ts
- [ ] T169 [US13] Add admin message deletion capability (visible to admins) in convex/messages.ts (FR-037)
- [ ] T170 [US13] Implement restore mutation for deleted messages (admin, within 90 days) in convex/messages.ts
- [ ] T171 [US13] Implement exportChannelHistory mutation (JSON/CSV) in convex/messages.ts (FR-039)
- [ ] T172 [US13] Create admin channel management UI (member list, roles, moderation)
- [ ] T173 [US13] Create export history UI with format selection

**Checkpoint**: User Story 13 - Channel administration complete

---

## Phase 16: Cost Control & Retention (Cross-cutting)

**Purpose**: Transcription budget management and GDPR compliance

- [ ] T174 [P] Create convex/lib/costControl.ts with checkTranscriptionBudget helper
- [ ] T175 Implement daily limit check (30 min/user/day) in costControl.ts
- [ ] T176 Implement monthly budget check ($2000/month global) in costControl.ts
- [ ] T177 Add checkBudget query in convex/voiceMessages.ts for pre-recording validation
- [ ] T178 [P] Create convex/retention.ts with anonymizeExpiredMessages internal mutation (FR-014a)
- [ ] T179 Implement addToCorpus helper for anonymized messages (FR-014b)
- [ ] T180 Create convex/aiCorpus.ts with getStats, browse, export queries/mutations
- [ ] T181 [P] Create convex/gdprRequests.ts with requestDataExport mutation
- [ ] T182 Implement requestAccountDeletion mutation in convex/gdprRequests.ts
- [ ] T183 Implement processGdprRequests internal mutation
- [ ] T184 Create admin budget status dashboard (view usage, set limits, toggle service)

**Checkpoint**: Cost control and GDPR compliance complete

---

## Phase 17: Scheduled Jobs (Crons)

**Purpose**: Background tasks for maintenance and cleanup

- [ ] T185 Create convex/crons.ts with cronJobs configuration
- [ ] T186 [P] Add cron: checkInactiveUsers (every 1 minute) for auto-away
- [ ] T187 [P] Add cron: cleanupTypingIndicators (every 10 seconds)
- [ ] T188 [P] Add cron: cleanupExpiredStatuses (every 1 minute)
- [ ] T189 [P] Add cron: anonymizeExpiredMessages (daily 2:00 AM UTC)
- [ ] T190 [P] Add cron: processGdprRequests (every 15 minutes)
- [ ] T191 [P] Add cron: cleanupExpiredExports (daily 3:00 AM UTC)
- [ ] T192 [P] Add cron: resetDailyTranscriptionLimits (daily midnight UTC)
- [ ] T193 [P] Add cron: checkMonthlyBudget (every 1 hour)
- [ ] T194 [P] Add cron: processPendingMentions (every 1 minute)

**Checkpoint**: All scheduled jobs configured

---

## Phase 18: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T195 [P] Add loading skeletons to channel-list.tsx, dm-list.tsx, message-list.tsx
- [ ] T196 [P] Add error boundaries and retry logic to messaging components
- [ ] T197 [P] Add empty states for no channels, no messages, no search results
- [ ] T198 Add keyboard navigation support (Ctrl+K for search, Esc to close panels)
- [ ] T199 Add mobile responsive styles for messaging UI
- [ ] T200 [P] Add rate limit exceeded user feedback in message-input.tsx (FR-047)
- [ ] T201 Implement "show more" for messages over 500 characters (edge case from spec)
- [ ] T202 Handle network disconnection with local queue and retry (edge case from spec)
- [ ] T203 Run quickstart.md validation - verify all documented workflows work
- [ ] T204 Performance audit: verify <1s message delivery (SC-001), <500ms search (SC-003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-15)**: All depend on Foundational phase completion
  - P1 stories (US1-US2) should complete first as MVP
  - P2-P4 stories can proceed in priority order
- **Cost Control (Phase 16)**: Can run after US8 (Voice Messages)
- **Crons (Phase 17)**: Can run after related features complete
- **Polish (Phase 18)**: Depends on all desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends On | Can Start After |
|-------|----------|------------|-----------------|
| US1 - Channel Messaging | P1 | Foundational | Phase 2 |
| US2 - Direct Messages | P1 | Foundational | Phase 2 |
| US3 - Course Discussions | P2 | US1 | Phase 3 |
| US4 - Public/Private Channels | P2 | US1 | Phase 3 |
| US5 - Threaded Replies | P2 | US1 | Phase 3 |
| US6 - Rich Text | P2 | US1 | Phase 3 |
| US7 - Reactions/Mentions | P3 | US1 | Phase 3 |
| US8 - Voice Messages | P3 | US1, US2 | Phase 4 |
| US9 - Search | P3 | US1 | Phase 3 |
| US10 - Presence | P3 | Foundational | Phase 2 |
| US11 - Pins/Bookmarks | P4 | US1 | Phase 3 |
| US12 - File Attachments | P4 | US1 | Phase 3 |
| US13 - Administration | P4 | US1, US4 | Phase 6 |

### Within Each User Story

- Models/schema before services
- Convex functions before frontend components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities by Phase

**Phase 1 Setup**: T003, T004, T007 can run in parallel

**Phase 2 Foundational**: T010, T011, T012, T015, T016 can run in parallel

**Phase 3 US1**: T018-T019, T027-T028 can run in parallel

**Phase 4 US2**: T038-T039, T046, T051 can run in parallel

**Phase 9 US7**: T095, T098, T101-T103 can run in parallel

**Phase 10 US8**: T106, T114, T116-T117, T120 can run in parallel

---

## Parallel Example: User Story 1 Launch

```bash
# Launch all parallel-safe US1 tasks together:
Task: "Create convex/channels.ts with create mutation"
Task: "Create convex/messages.ts with sendToChannel mutation"
Task: "Create src/components/messaging/channel-list.tsx"
Task: "Create src/components/messaging/channel-header.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1-2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Channel Messaging)
4. Complete Phase 4: User Story 2 (Direct Messages)
5. **STOP and VALIDATE**: Test both stories independently
6. Deploy/demo if ready - users can now communicate!

### Incremental Delivery

1. Setup + Foundational + US1 + US2 → MVP (core messaging)
2. Add US3-US6 (P2) → Enhanced messaging with courses, threads, rich text
3. Add US7-US10 (P3) → Engagement features (reactions, voice, search, presence)
4. Add US11-US13 (P4) → Admin and power user features
5. Cost Control + Crons → Production readiness
6. Polish → Performance and UX refinement

### Suggested MVP Scope

**Minimum Viable Product**: User Stories 1 + 2 only
- Channel messaging with real-time updates
- Direct messages with typing indicators
- Unread tracking
- Basic message editing/deletion

This delivers core communication value and can be shipped independently.

---

## Summary

| Phase | Description | Task Count |
|-------|-------------|------------|
| 1 | Setup | 8 |
| 2 | Foundational | 9 |
| 3 | US1 - Channel Messaging | 20 |
| 4 | US2 - Direct Messages | 21 |
| 5 | US3 - Course Discussions | 11 |
| 6 | US4 - Public/Private Channels | 10 |
| 7 | US5 - Threaded Replies | 8 |
| 8 | US6 - Rich Text | 7 |
| 9 | US7 - Reactions/Mentions | 11 |
| 10 | US8 - Voice Messages | 17 |
| 11 | US9 - Search | 11 |
| 12 | US10 - Presence | 15 |
| 13 | US11 - Pins/Bookmarks | 9 |
| 14 | US12 - File Attachments | 7 |
| 15 | US13 - Administration | 9 |
| 16 | Cost Control & Retention | 11 |
| 17 | Crons | 10 |
| 18 | Polish | 10 |
| **Total** | | **204** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests are not included (not explicitly requested in spec)
- Voice transcription depends on OPENAI_API_KEY environment variable
