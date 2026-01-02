# Feature Specification: Knowledge Base - Notion-like Collaborative Documentation Platform

**Feature Branch**: `004-knowledge-base`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: Notion-like documentation platform for BDR/Sales training materials, company wiki, and shared knowledge base with real-time collaboration, AI-powered features, and deep LMS integration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Edit Documents (Priority: P1)

As a Team Lead or Trainer, I want to create and edit rich-text documents so that I can document procedures, training guides, and methodology (SPIN, MEDDIC, BANT) for my team.

**Why this priority**: This is the core functionality - without document creation and editing, the knowledge base has no value. All other features depend on having content to collaborate on, search, and share.

**Independent Test**: Can be fully tested by creating a new document, adding various content blocks (headings, lists, tables, callouts), and saving. Delivers immediate value as a documentation tool.

**Acceptance Scenarios**:

1. **Given** a Team Lead is authenticated and has write permissions, **When** they click "New Document" and select a folder location, **Then** a new document is created in draft status with the creator as admin.

2. **Given** a user has a document open in edit mode, **When** they type "/" to open the slash command menu, **Then** they see a list of available block types to insert (headings, lists, code blocks, tables, callouts, etc.).

3. **Given** a user is editing a document, **When** they stop typing for 5 seconds, **Then** the document auto-saves without manual intervention.

4. **Given** a user is editing a document, **When** they use keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K), **Then** the appropriate formatting is applied to selected text.

5. **Given** a user has created a document with content, **When** they click "Publish", **Then** the document status changes from "draft" to "published" and becomes visible according to workspace/folder permissions.

---

### User Story 2 - Navigate and Organize Documents (Priority: P1)

As a user, I want to navigate through a hierarchical document structure so that I can quickly find training materials and company documentation.

**Why this priority**: Navigation is essential for adoption - users must be able to find content easily or they won't use the system. Tied with P1 as it enables the core value proposition.

**Independent Test**: Can be tested by creating a workspace with folders and documents, then navigating via sidebar, breadcrumbs, and favorites. Delivers value as an organized documentation repository.

**Acceptance Scenarios**:

1. **Given** a user is on any document page, **When** they view the sidebar, **Then** they see a collapsible tree of workspaces, folders, and documents they have access to.

2. **Given** a user is viewing a nested document, **When** they look at the top of the page, **Then** they see breadcrumbs showing the full path (Workspace > Folder > Subfolder > Document).

3. **Given** a user frequently accesses certain documents, **When** they star a document, **Then** it appears in their Favorites section in the sidebar.

4. **Given** a user has recently viewed documents, **When** they open the Recent section, **Then** they see their most recently accessed documents in chronological order.

5. **Given** an Admin wants to reorganize content, **When** they drag a document or folder to a new location, **Then** the item moves and the hierarchy updates accordingly.

---

### User Story 3 - Real-Time Collaboration (Priority: P2)

As a user with write permissions, I want to see others' changes in real-time so that I can collaborate effectively on documents with my team.

**Why this priority**: Collaboration differentiates this from a simple document store and enables team workflows. Critical for training document maintenance but depends on core document functionality being in place.

**Independent Test**: Can be tested by having two users open the same document and verifying changes sync in real-time with visible cursors. Delivers value as a collaborative workspace.

**Acceptance Scenarios**:

1. **Given** two users are editing the same document, **When** User A makes a change, **Then** User B sees the change within 100ms without refreshing.

2. **Given** multiple users are in a document, **When** a user positions their cursor, **Then** other users see a colored cursor with their name label at that position.

3. **Given** multiple users are in a document, **When** viewing the presence indicator, **Then** users see who is currently viewing or editing the document.

4. **Given** two users edit the same paragraph simultaneously, **When** their changes conflict, **Then** the system automatically resolves the conflict without data loss.

---

### User Story 4 - Comment and Discuss (Priority: P2)

As a user with read permissions, I want to comment on documents so that I can provide feedback, ask questions, and discuss content with colleagues.

**Why this priority**: Comments enable asynchronous collaboration and quality review. Important for the training workflow where content needs feedback cycles.

**Independent Test**: Can be tested by adding page-level and inline comments, @mentioning users, and resolving threads. Delivers value as a feedback mechanism.

**Acceptance Scenarios**:

1. **Given** a user is viewing a document, **When** they select text and choose "Add comment", **Then** an inline comment thread is created attached to that selection.

2. **Given** a comment exists on a document, **When** another user replies, **Then** a threaded discussion is created under the original comment.

3. **Given** a user is writing a comment, **When** they type "@" followed by a name, **Then** they see autocomplete suggestions and the mentioned user receives a notification.

4. **Given** a discussion is resolved, **When** the comment owner marks it as resolved, **Then** the comment thread is archived but can be viewed in history.

---

### User Story 5 - Search Documents (Priority: P2)

As a user, I want to search documents by keyword and natural language so that I can quickly find relevant information without browsing the hierarchy.

**Why this priority**: Search is critical for knowledge discovery, especially as the document base grows. Users expect instant access to information.

**Independent Test**: Can be tested by searching for known content via keywords and natural language queries. Delivers value as an information retrieval system.

**Acceptance Scenarios**:

1. **Given** a user presses Cmd+K (or Ctrl+K), **When** they type a search query, **Then** they see matching documents ranked by relevance within 200ms.

2. **Given** documents exist with specific content, **When** a user searches by keyword, **Then** matching terms are highlighted in the search results.

3. **Given** a user wants to find information without exact keywords, **When** they toggle "AI mode" and ask a natural language question, **Then** they receive relevant passages with citations and confidence scores.

4. **Given** search results are displayed, **When** results include documents the user cannot access, **Then** those documents are not shown (permissions respected).

---

### User Story 6 - Manage Permissions (Priority: P2)

As an Admin, I want to control who can access workspaces, folders, and documents so that I can ensure sensitive information is only visible to authorized users.

**Why this priority**: Security and access control are fundamental for a company knowledge base. Required before broad organizational adoption.

**Independent Test**: Can be tested by setting workspace permissions, adding users/teams, and verifying access is correctly enforced. Delivers value as a secure documentation system.

**Acceptance Scenarios**:

1. **Given** an Admin creates a workspace, **When** they set a default permission level (none/read/write), **Then** all child folders and documents inherit this permission.

2. **Given** a folder Admin wants custom permissions, **When** they choose "Custom permissions" and add specific users or teams, **Then** those permissions override the inherited ones.

3. **Given** a document is in draft status, **When** any user (including Admins) tries to access it, **Then** only the creator can see the draft.

4. **Given** a user has read-only access to a workspace, **When** they try to edit a document, **Then** the editor is in read-only mode and save is disabled.

---

### User Story 7 - Version History (Priority: P3)

As a user with write permissions, I want to view and restore previous versions of a document so that I can understand document evolution and recover from mistakes.

**Why this priority**: Version history provides safety net for content editing but is not required for basic functionality. Important for mature usage patterns.

**Independent Test**: Can be tested by making changes over time, viewing version history, and restoring a previous version. Delivers value as a content recovery mechanism.

**Acceptance Scenarios**:

1. **Given** a user opens version history for a document, **When** viewing the list, **Then** they see versions with date, author, and description.

2. **Given** automatic versioning is enabled, **When** changes are detected over a 5-minute period, **Then** a new version is automatically created.

3. **Given** a user selects a previous version, **When** they click "Restore", **Then** a new version is created with the previous content (non-destructive restore).

4. **Given** a user wants to save a milestone, **When** they click "Save this version", **Then** a manual version is created with optional description.

---

### User Story 8 - AI Editor Commands (Priority: P3)

As a user with write permissions, I want to use AI commands to summarize, translate, and rephrase selected text so that I can improve my writing efficiency.

**Why this priority**: AI features enhance productivity but are not required for core document functionality. Valuable differentiation once the base system is stable.

**Independent Test**: Can be tested by selecting text, invoking AI commands, and accepting/rejecting results. Delivers value as a writing assistant.

**Acceptance Scenarios**:

1. **Given** a user selects text in a document, **When** they choose "Summarize" from the AI menu, **Then** they see a condensed version (max 3 sentences) that they can accept or reject.

2. **Given** a user selects text, **When** they choose "Translate" and select a target language, **Then** they see the translated text with streaming display.

3. **Given** a user wants to improve text, **When** they choose "Rephrase" with a style (formal, simpler, persuasive), **Then** they see the rephrased version to review.

4. **Given** a user has used 100 AI commands in the current month, **When** they try another command, **Then** they see a rate limit message indicating the monthly limit is reached.

---

### User Story 9 - AI Content Generation (Priority: P3)

As a user with write permissions, I want to generate content from a prompt so that I can quickly create first drafts for training materials.

**Why this priority**: Content generation is a power-user feature that enhances productivity once users are comfortable with the basic editor.

**Independent Test**: Can be tested by using /ai command with a prompt and inserting generated content. Delivers value as a content creation accelerator.

**Acceptance Scenarios**:

1. **Given** a user is editing a document, **When** they type "/ai" and enter a prompt, **Then** they see generated content (paragraphs, lists, tables) streamed to them.

2. **Given** generated content is displayed, **When** the user accepts it, **Then** the content is inserted at the cursor position.

3. **Given** a user has used 50 content generations this month, **When** they try to generate more, **Then** they see a rate limit message.

---

### User Story 10 - Embed External Content (Priority: P3)

As a user with write permissions, I want to embed external content (videos, Figma designs, documents) so that I can enrich my training materials.

**Why this priority**: Embeds enhance content quality but are supplementary to core document features.

**Independent Test**: Can be tested by pasting URLs and verifying they render as embedded content. Delivers value as a rich content platform.

**Acceptance Scenarios**:

1. **Given** a user pastes a YouTube URL, **When** the system detects the provider, **Then** an embedded video player is inserted that can be resized.

2. **Given** a user pastes a Figma URL, **When** the embed is created, **Then** an interactive Figma preview is displayed.

3. **Given** a user pastes a Google Docs URL, **When** the embed is created, **Then** an iframe embed of the Google Doc is displayed.

---

### User Story 11 - Link Documents to LMS Content (Priority: P3)

As a user, I want to link documents to courses and lessons so that I can create complementary resources and cross-references.

**Why this priority**: LMS integration deepens the value proposition but requires both systems to be functional. Important for training workflow completeness.

**Independent Test**: Can be tested by linking a document to a course/lesson and verifying bidirectional display. Delivers value as integrated learning materials.

**Acceptance Scenarios**:

1. **Given** a user is editing a document, **When** they choose "Link to course/lesson", **Then** they can search and select from available LMS content.

2. **Given** a document is linked to a lesson, **When** viewing the lesson, **Then** an "Associated documents" section shows the linked document.

3. **Given** a user is typing in the editor, **When** they @mention a course or lesson, **Then** they see autocomplete suggestions and the mention becomes a navigable link.

---

### User Story 12 - Advanced Integrations (Priority: P4)

As an Admin, I want to connect external tools (GitHub, Jira, Linear, Microsoft 365) so that I can display live data in documents.

**Why this priority**: Third-party integrations are advanced features that extend the platform but are not required for core documentation needs.

**Independent Test**: Can be tested by connecting an integration and embedding live data. Delivers value as an integrated workspace.

**Acceptance Scenarios**:

1. **Given** an Admin wants to connect GitHub, **When** they authenticate via OAuth, **Then** the integration is enabled for embedding GitHub issues and PRs.

2. **Given** GitHub is connected, **When** a user inserts a GitHub issue embed, **Then** the current status and details are displayed with a manual refresh option.

---

### Edge Cases

- What happens when a user loses internet connection while editing? (Changes should be queued and synced when reconnected)
- How does the system handle concurrent edits to the same paragraph? (CRDT-based conflict resolution preserves all changes)
- What happens when a document exceeds the 10MB size limit? (User is warned at 8MB; system prevents saves beyond 10MB with clear error message)
- How are orphaned documents handled when a parent folder is deleted? (Soft delete with restore capability; children remain accessible)
- What happens when rate limits are reached mid-operation? (Operation completes but subsequent operations are blocked with clear messaging)
- How does search handle documents with restricted permissions? (Results are filtered server-side; users never see documents they cannot access)
- What happens when a linked LMS course/lesson is deleted? (Link becomes broken with visual indicator; cleanup job notifies document owners)
- How does the system handle very long documents? (Pagination/virtualization for display; content split across blocks for performance)

## Requirements *(mandatory)*

### Functional Requirements

**Document Management**
- **FR-001**: System MUST allow authenticated users with write permissions to create new documents in any accessible folder
- **FR-002**: System MUST support a rich-text editor with at least 50 block types including text, headings, lists, code blocks, images, videos, tables, toggles, callouts, dividers, quotes, and columns
- **FR-003**: System MUST auto-save document changes every 5 seconds without user intervention
- **FR-004**: System MUST support slash commands (/) for inserting block types
- **FR-005**: System MUST support drag-and-drop reordering of blocks within a document
- **FR-006**: System MUST support standard keyboard shortcuts (Ctrl/Cmd+B, I, K, etc.) for text formatting
- **FR-007**: System MUST support cover images and emoji icons for documents
- **FR-008**: System MUST enforce draft status where only the creator can view unpublished documents
- **FR-008a**: System MUST enforce a maximum document size of 10MB (including embedded media references)

**Hierarchy & Navigation**
- **FR-009**: System MUST support a three-level hierarchy: Workspaces > Folders > Documents
- **FR-010**: System MUST support unlimited nesting of subfolders within folders
- **FR-011**: System MUST display a collapsible tree navigation sidebar
- **FR-012**: System MUST display breadcrumbs showing full document path
- **FR-013**: System MUST allow users to mark documents as favorites
- **FR-014**: System MUST track and display recently accessed documents per user
- **FR-015**: System MUST support soft delete (archive) with restore capability; archived items are permanently deleted after 90 days
- **FR-015a**: System MUST enforce a maximum of 1000 direct child items per workspace or folder

**Real-Time Collaboration**
- **FR-016**: System MUST synchronize document changes between users within 100ms
- **FR-016a**: System MUST support a maximum of 25 concurrent editors per document
- **FR-017**: System MUST display colored cursors with user names for all active editors
- **FR-018**: System MUST display text selections made by other users
- **FR-019**: System MUST show a presence indicator of users viewing/editing a document
- **FR-020**: System MUST automatically resolve editing conflicts without data loss

**Comments & Discussions**
- **FR-021**: System MUST support page-level comments on documents
- **FR-022**: System MUST support inline comments on text selections
- **FR-023**: System MUST support threaded replies on comments
- **FR-024**: System MUST support @mentions of users with notifications
- **FR-025**: System MUST allow comment owners to resolve/archive threads
- **FR-026**: System MUST support emoji reactions on comments

**Search**
- **FR-027**: System MUST provide full-text search across document titles and content
- **FR-028**: System MUST return search results within 200ms
- **FR-029**: System MUST highlight matching terms in search results
- **FR-030**: System MUST support filters by workspace, document type, creator, and date range
- **FR-031**: System MUST provide AI-powered semantic search with natural language queries
- **FR-032**: System MUST enforce permission filtering on all search results
- **FR-033**: System MUST support multi-source search across documents and courses (MVP); message search is P3 enhancement

**Permissions & Security**
- **FR-034**: System MUST support role-based permissions with read, write, and admin levels
- **FR-035**: System MUST support permission inheritance from workspace to folder to document
- **FR-036**: System MUST allow permission overrides at any hierarchy level
- **FR-037**: System MUST support team-based permission grants
- **FR-038**: System MUST prevent users from escalating permissions beyond their own level
- **FR-039**: System MUST isolate draft documents to be visible only to creators
- **FR-039a**: System MUST log all permission changes with timestamp, actor, resource, and change details
- **FR-039b**: System MUST log document lifecycle events (create, publish, archive, delete, restore) with timestamp and actor

**Version History**
- **FR-040**: System MUST automatically create versions every 5 minutes when changes are detected
- **FR-041**: System MUST allow users to manually save versions with descriptions
- **FR-042**: System MUST display version history with date, author, and description
- **FR-043**: System MUST allow preview of past versions in read-only mode
- **FR-044**: System MUST support non-destructive version restore (creates new version)
- **FR-045**: System MUST enforce version retention: 7 days full, 30 days daily snapshots

**AI Features**
- **FR-046**: System MUST provide AI summarize command (max 3 sentences output)
- **FR-047**: System MUST provide AI translate command supporting FR, EN, DE, ES, IT, PT
- **FR-048**: System MUST provide AI rephrase command with style options
- **FR-049**: System MUST provide AI expand command for adding details
- **FR-050**: System MUST display AI responses with streaming
- **FR-051**: System MUST require accept/reject before applying AI changes
- **FR-052**: System MUST provide AI content generation from free prompts
- **FR-053**: System MUST enforce rate limits: 100 commands/user/month, 50 generations/user/month, 500 searches/user/month
- **FR-054**: System MUST track AI usage against budget ceiling with alerts at 80% and hard stop at 95%

**Embeds & Integrations**
- **FR-055**: System MUST support embedded players for YouTube, Vimeo, and Loom
- **FR-056**: System MUST support Figma interactive previews
- **FR-057**: System MUST support Google Docs/Sheets iframe embeds
- **FR-058**: System MUST auto-detect embed provider from pasted URLs
- **FR-059**: System MUST support bidirectional links between documents and LMS courses/lessons
- **FR-060**: System MUST support @mentions of courses and lessons with autocomplete

### Key Entities

- **Workspace**: Top-level organizational container for documentation; has name, icon, cover image, default permission level, and owner
- **Folder**: Hierarchical container within workspaces; can contain other folders or documents; inherits or overrides parent permissions
- **Document**: Individual documentation page with rich-text content; has title, icon, cover, status (draft/published), creator, and metadata
- **DocumentContent**: Separated storage for document body (rich-text JSON); optimized for large content and versioning
- **DocumentVersion**: Point-in-time snapshot of document content; includes timestamp, author, description, and full content snapshot
- **ResourcePermission**: Permission grant linking a resource (workspace/folder/document) to a user or team with a specific access level
- **DocumentComment**: Comment attached to a document or text selection; supports threading, mentions, reactions, and resolution status
- **DocumentLink**: Association between a document and LMS content (course, lesson); includes link type (reference, supplement, prerequisite)
- **DocumentEmbedding**: Vector representation of document content for semantic search; updated on document changes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new document and publish it within 5 minutes of first use
- **SC-002**: Users can find any document via search in under 30 seconds
- **SC-003**: 80% of users create or view at least one document within their first 30 days
- **SC-004**: BDR onboarding time reduces by 30% after knowledge base adoption (measured via HR metrics)
- **SC-005**: System supports 100 concurrent users editing documents without degradation
- **SC-006**: Document changes sync between collaborators within 100ms
- **SC-007**: Search results return within 200ms for 95% of queries
- **SC-008**: Zero unauthorized document access incidents (permission security)
- **SC-009**: AI feature budget stays within 150 EUR/month ceiling
- **SC-010**: 95% uptime for document editing and collaboration features
- **SC-011**: Users rate search effectiveness at 4+/5 satisfaction score
- **SC-012**: 70% of training documents have at least one LMS course/lesson link within 90 days

## Assumptions

- **Plate Pro Potion template** (purchased) will provide the rich-text editor, sidebar, and collaboration components (~40 hours saved)
- **Hocuspocus (self-hosted YJS server)** will be used for real-time collaboration infrastructure (~$10-20/month vs $150/month Liveblocks)
- Potion template uses better-auth/Prisma/tRPC which must be adapted to Clerk/Convex
- Phase 0 (Potion extraction) must complete before implementation phases begin
- Nango Cloud will be used for third-party integrations (GitHub, Jira, Linear, MS365)
- Claude Haiku will power AI editor commands; Claude Sonnet will power content generation
- OpenAI text-embedding-3-small will be used for semantic search embeddings
- Existing Clerk authentication will be extended for document permissions
- Existing Convex backend will be extended with new document-related tables
- Users with "Team Lead" or "Trainer" roles have write permissions; BDRs have read-only
- LMS Admins have full admin permissions across all workspaces
- Monthly AI budget of 150 EUR is allocated and must not be exceeded
- Document notifications will use the existing notification system
- Mobile-optimized UX is not required for MVP (desktop-first)
- Document analytics will use existing analytics patterns
- Document templates and duplication are deferred to post-MVP

## Clarifications

### Session 2026-01-02

- Q: What is the maximum document size limit? → A: 10MB per document (heavy media, long documents)
- Q: What audit logging is required? → A: Log permission changes and document lifecycle events (create/publish/archive/delete)
- Q: How long are archived documents retained before permanent deletion? → A: 90 days (standard retention window)
- Q: What is the maximum number of items per workspace/folder? → A: 1000 items per container (permissive)
- Q: What is the maximum concurrent editors per document? → A: 25 concurrent editors per document (medium teams)

## Non-Goals (Out of Scope)

- Offline editing mode
- Document templates library
- Native PDF/Word export (embeds serve this need)
- Real-time push notifications (Convex polling is sufficient)
- Public document sharing outside authenticated users
- Mobile-native applications
