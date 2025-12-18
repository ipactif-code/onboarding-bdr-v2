# Feature Specification: BDR Messaging — Slack-like Communication Platform

**Feature Branch**: `001-slack-messaging`
**Created**: 2025-12-18
**Status**: Draft
**Input**: User description: "Build a comprehensive real-time messaging system integrated into an existing Learning Management System (LMS) with channels, direct messages, voice messages with transcription, and LMS integration"

## Clarifications

### Session 2025-12-18

- Q: Course channel architecture — one channel per course or multiple? → A: One channel per course; lesson discussions are threads within that channel
- Q: How is unread tracking updated? → A: Hybrid: auto-update on view (viewport) + "mark all as read" button available
- Q: Rate limiting strategy? → A: Moderate limits (30 msg/min, 20 voice/hr, 4000 char max)
- Q: Message delivery confirmation model? → A: Sent indicator only (✓), no delivered/read receipts
- Q: Soft-deleted message retention period? → A: 90 days then anonymize; retain anonymized data indefinitely for AI/analytics
- Q: Voice message duration & format? → A: 5 minutes max, WebM/Opus + MP4/AAC fallback for Safari
- Q: Transcription language setting? → A: Auto-detect only, no fallback
- Q: Course channel admin rights? → A: All course instructors + global admins
- Q: Typing indicators in v1? → A: Include for DMs only, defer channels to v2
- Q: Search permissions for left/archived channels? → A: Cannot search left channels; can search archived channels

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Channel Messaging (Priority: P1)

A user wants to communicate with colleagues in organized topic-based spaces. They navigate to the messaging section, see a list of channels they belong to, select a channel, view the conversation history, and send text messages. Other members see the message appear in real-time.

**Why this priority**: Channel messaging is the core functionality that enables all other features. Without the ability to send and receive messages in channels, no other messaging features provide value.

**Independent Test**: Can be fully tested by creating a channel, sending a message, and verifying another user sees it instantly. Delivers immediate communication value even without DMs, threads, or voice.

**Acceptance Scenarios**:

1. **Given** a user is a member of a channel, **When** they open the channel, **Then** they see the message history in chronological order with sender names, avatars, and timestamps
2. **Given** a user is viewing a channel, **When** they type a message and send it, **Then** the message appears immediately in their view and other channel members see it within 1 second
3. **Given** a channel has new messages, **When** a member is not viewing that channel, **Then** they see an unread indicator with message count
4. **Given** a user sends a message, **When** another member is viewing the channel, **Then** the message appears without requiring a page refresh

---

### User Story 2 - Direct Messages (Priority: P1)

A user wants to have a private conversation with one or more colleagues. They find a user by name or select from recent conversations, open a direct message view, and exchange messages privately.

**Why this priority**: Direct messages are equally fundamental to channel messaging. Private 1:1 and group conversations are essential for workplace communication.

**Independent Test**: Can be tested by initiating a DM with another user, sending messages back and forth. Delivers private communication value independently.

**Acceptance Scenarios**:

1. **Given** a user wants to message someone, **When** they search for a colleague by name, **Then** they can start or continue a direct message conversation
2. **Given** a user is in a DM conversation, **When** they send a message, **Then** the recipient sees it in real-time with notification
3. **Given** a user wants to message multiple people privately, **When** they create a group DM with up to 8 participants, **Then** all participants can send and receive messages in that conversation
4. **Given** a user has multiple DM conversations, **When** they view their DM list, **Then** they see conversations sorted by most recent activity with unread indicators

---

### User Story 3 - Course-Linked Discussions (Priority: P2)

A learner watching a course lesson has a question. They open a discussion panel linked to that specific lesson, see existing questions and answers, and post their own question. Instructors and peers can respond, and the learner is notified when answered.

**Why this priority**: This is the key differentiator from standalone chat apps—contextual discussions tied to learning content. It's P2 because it depends on basic messaging (P1) being functional first.

**Independent Test**: Can be tested by navigating to a lesson, opening its discussion, posting a question, and having another user reply. Delivers learning-specific value.

**Acceptance Scenarios**:

1. **Given** a user is viewing a lesson, **When** they open the discussion panel, **Then** they see all discussion threads related to that specific lesson
2. **Given** a user posts a question in a lesson discussion, **When** someone replies, **Then** the original poster receives a notification
3. **Given** a course is published, **When** a user enrolls, **Then** they automatically gain access to that course's discussion channel
4. **Given** a lesson has multiple discussion threads, **When** a user views the lesson, **Then** they can see thread previews and expand to read full conversations

---

### User Story 4 - Public and Private Channels (Priority: P2)

An administrator or team lead wants to create a channel for a specific purpose. They create either a public channel (visible to all) or private channel (invite-only), add a description, and invite members. Members can then communicate within that channel.

**Why this priority**: Channel creation/management builds on basic channel messaging. Users need organized spaces beyond course discussions.

**Independent Test**: Can be tested by creating a channel, setting its visibility, inviting members, and verifying access controls work correctly.

**Acceptance Scenarios**:

1. **Given** an admin wants to create a company-wide announcement space, **When** they create a public channel, **Then** all users can see and join the channel
2. **Given** a team lead wants a private team space, **When** they create a private channel and invite specific members, **Then** only invited members can see and access the channel
3. **Given** a channel exists, **When** its creator edits the description or topic, **Then** all members see the updated information
4. **Given** a private channel, **When** a non-member searches for it, **Then** the channel does not appear in their results

---

### User Story 5 - Threaded Replies (Priority: P2)

A user wants to respond to a specific message without cluttering the main channel conversation. They click "reply in thread" on a message, add their response, and the thread is visible as a sub-conversation attached to the original message.

**Why this priority**: Threads organize conversations and reduce noise, essential for active channels. Depends on basic messaging being in place.

**Independent Test**: Can be tested by sending a message, replying in thread, and verifying the thread appears correctly attached to the parent message.

**Acceptance Scenarios**:

1. **Given** a message in a channel, **When** a user replies in thread, **Then** the reply appears in a thread view attached to that message
2. **Given** a message has thread replies, **When** another user views the channel, **Then** they see a "X replies" indicator on the original message
3. **Given** a user is following a thread, **When** someone adds a reply, **Then** the user receives a notification
4. **Given** a user opens a thread, **When** they view replies, **Then** replies appear in chronological order with the original message as context

---

### User Story 6 - Rich Text Messages (Priority: P2)

A user wants to format their message for clarity—adding bold text, bullet lists, code snippets, or links. They use formatting controls or markdown shortcuts while composing, and recipients see the formatted message.

**Why this priority**: Rich text significantly improves message readability and is expected in modern messaging. Builds on basic text messaging.

**Independent Test**: Can be tested by composing a message with formatting (bold, lists, code, links) and verifying it renders correctly for recipients.

**Acceptance Scenarios**:

1. **Given** a user is composing a message, **When** they apply bold or italic formatting, **Then** the message displays with those text styles
2. **Given** a user includes a URL in their message, **When** the message is sent, **Then** the URL is clickable and optionally shows a link preview
3. **Given** a user wants to share code, **When** they format text as code block, **Then** recipients see it with monospace font and syntax highlighting
4. **Given** a user creates a bulleted or numbered list, **When** recipients view the message, **Then** the list is properly formatted

---

### User Story 7 - Reactions and Mentions (Priority: P3)

A user wants to quickly acknowledge a message or get someone's attention. They add an emoji reaction to a message, or @mention a user/channel in their message. Mentioned users receive notifications.

**Why this priority**: Reactions and mentions enhance engagement but aren't critical for core communication. They add polish after messaging fundamentals work.

**Independent Test**: Can be tested by adding a reaction to a message, mentioning a user with @, and verifying the notification is received.

**Acceptance Scenarios**:

1. **Given** a message in a channel, **When** a user adds an emoji reaction, **Then** the reaction appears on the message with a count
2. **Given** a user types @username in a message, **When** they send it, **Then** the mentioned user receives a notification
3. **Given** a user types @here in a channel, **When** they send the message, **Then** all online channel members receive a notification
4. **Given** a message has multiple reactions, **When** a user views it, **Then** they see all unique reactions with counts and can add their own

---

### User Story 8 - Voice Messages with Transcription (Priority: P3)

A user wants to send a voice message instead of typing. They record audio, optionally review it, and send. The system automatically transcribes the audio. Recipients can listen to the audio or read the transcript.

**Why this priority**: Voice messages are a "premium feature" that adds convenience but isn't essential for core communication. Requires third-party transcription integration.

**Independent Test**: Can be tested by recording a voice message, sending it, verifying playback works, and checking transcription accuracy.

**Acceptance Scenarios**:

1. **Given** a user wants to send a voice message, **When** they record and send audio, **Then** recipients see a voice message with playback controls
2. **Given** a voice message is sent, **When** transcription completes (within 30 seconds for 1-minute audio), **Then** the transcript appears alongside the audio
3. **Given** a recipient views a voice message, **When** they play it, **Then** they can adjust playback speed (0.5x to 2x) and see a waveform visualization
4. **Given** a voice message has been transcribed, **When** a user searches for words in the transcript, **Then** the voice message appears in search results

---

### User Story 9 - Message Search and Filtering (Priority: P3)

A user needs to find a past message. They enter search terms, optionally filter by channel, sender, date, or message type. They see matching results and can jump to the original message in context.

**Why this priority**: Search becomes important as message volume grows. It's a utility feature that enhances experience but isn't needed for initial adoption.

**Independent Test**: Can be tested by sending several messages, searching for specific terms, and verifying results are accurate and navigable.

**Acceptance Scenarios**:

1. **Given** a user searches for a term, **When** results load, **Then** they see matching messages from channels and DMs they have access to within 500ms
2. **Given** search results are displayed, **When** a user clicks a result, **Then** they are navigated to that message in its original context
3. **Given** a user wants to narrow results, **When** they filter by channel, sender, or date range, **Then** results update accordingly
4. **Given** voice messages have transcripts, **When** a user searches for transcript text, **Then** matching voice messages appear in results

---

### User Story 10 - Presence and Status (Priority: P3)

A user wants to see who is available and set their own status. They see online/away/offline indicators on colleagues, and can set a custom status message and emoji for themselves.

**Why this priority**: Presence adds social context but doesn't affect core messaging functionality. It's a quality-of-life feature.

**Independent Test**: Can be tested by setting a status, going idle to trigger auto-away, and verifying other users see correct presence indicators.

**Acceptance Scenarios**:

1. **Given** a user is active in the app, **When** other users view them in a channel or DM list, **Then** they see a green "online" indicator
2. **Given** a user is inactive for a configured period, **When** that time elapses, **Then** their status changes to "away" automatically
3. **Given** a user wants to set a custom status, **When** they enter a status message and emoji, **Then** it appears next to their name throughout the app
4. **Given** a user enables Do Not Disturb, **When** they receive messages, **Then** they do not receive push notifications

---

### User Story 11 - Message Pinning and Bookmarking (Priority: P4)

A user or channel admin wants to highlight important messages. They pin a message to the channel for all members to see, or bookmark a message for their personal reference. Pinned messages are easily accessible from a channel header.

**Why this priority**: Pinning and bookmarking are convenience features that help with information management but aren't essential for communication.

**Independent Test**: Can be tested by pinning a message, verifying it appears in pinned messages, and bookmarking a message for personal access.

**Acceptance Scenarios**:

1. **Given** an admin pins a message in a channel, **When** members view the channel, **Then** they can access pinned messages from a dedicated area
2. **Given** a user bookmarks a message, **When** they view their bookmarks, **Then** the message appears in their personal bookmark list
3. **Given** multiple messages are pinned, **When** a user views pinned messages, **Then** they see them in order of when they were pinned

---

### User Story 12 - File Attachments (Priority: P4)

A user wants to share a file (image, document, etc.) in a conversation. They attach a file up to 50MB, optionally add a message, and send. Recipients can view or download the file.

**Why this priority**: File sharing enhances collaboration but isn't critical for text-based communication. Many users will link to external storage initially.

**Independent Test**: Can be tested by uploading a file, sending it in a channel, and verifying recipients can download it.

**Acceptance Scenarios**:

1. **Given** a user wants to share a file, **When** they attach a file up to 50MB and send, **Then** the file appears in the conversation with preview (for images)
2. **Given** a file is shared, **When** a recipient clicks it, **Then** they can download or view the file
3. **Given** a user tries to upload a file over 50MB, **When** they attempt the upload, **Then** they see an error message about the size limit

---

### User Story 13 - Channel Administration (Priority: P4)

An administrator needs to manage channels and content. They can archive channels, moderate messages (hide/delete), mute or ban users from channels, and export conversation history.

**Why this priority**: Admin features are important for governance but not needed for initial user adoption. Can be added once messaging is established.

**Independent Test**: Can be tested by archiving a channel, hiding a message, and exporting history. Verifies admin controls work as expected.

**Acceptance Scenarios**:

1. **Given** an admin wants to decommission a channel, **When** they archive it, **Then** the channel becomes read-only and moves to an archive section
2. **Given** inappropriate content is reported, **When** an admin hides or deletes a message, **Then** regular users no longer see it (but admins retain access)
3. **Given** a user is disruptive, **When** an admin mutes them from a channel, **Then** the user cannot send messages in that channel
4. **Given** an admin needs records, **When** they export channel history, **Then** they receive a downloadable file with all messages

---

### Edge Cases

- What happens when a user sends a message to a channel they were just removed from? (Message fails with clear error)
- How does the system handle network disconnection during message send? (Queue locally, retry on reconnect, show pending status)
- What happens if voice transcription fails? (Show audio-only with "transcription unavailable" message, allow retry)
- How are very long messages handled? (Collapse with "show more" after 500 characters)
- What happens when a user is mentioned in a channel they're not a member of? (Mention is displayed but notification only if user has access)
- How does search behave with special characters or empty queries? (Escape special chars, require minimum 2 characters)
- What happens to DM history if one participant deletes their account? (Messages remain attributed to "Deleted User")
- How are course channels handled when a course is unpublished? (Channel becomes read-only, members retain view access to history)

## Requirements *(mandatory)*

### Functional Requirements

**Channels**
- **FR-001**: System MUST support public channels visible to all authenticated users
- **FR-002**: System MUST support private channels with invite-only access controlled by channel creator/admins
- **FR-003**: System MUST auto-create a single discussion channel when a course is published, with membership synced to enrolled users
- **FR-003a**: System MUST grant channel admin rights to all course instructors and global admins on course channels
- **FR-004**: System MUST support lesson-linked discussion threads as threads within the course channel, attached to specific lesson IDs
- **FR-005**: System MUST allow channel descriptions and topics to be set and edited
- **FR-006**: System MUST support channel archiving (soft-delete, read-only) rather than hard deletion

**Direct Messages**
- **FR-007**: System MUST support one-on-one direct message conversations
- **FR-008**: System MUST support group DMs with 2-8 total participants
- **FR-009**: System MUST persist DM conversation history indefinitely (subject to retention policy)
- **FR-009a**: System MUST display typing indicators in DMs (timeout: 3 seconds after last keystroke); channel typing indicators deferred to v2

**Messages**
- **FR-010**: System MUST support rich text formatting (bold, italic, code, links, lists)
- **FR-011**: System MUST support voice messages with automatic speech-to-text transcription
- **FR-012**: System MUST support file attachments up to 50MB (images, documents)
- **FR-013**: System MUST allow message editing with edit history visible to viewers
- **FR-014**: System MUST support soft-delete of messages (hidden from users, visible to admins for 90 days)
- **FR-014a**: System MUST anonymize soft-deleted messages after 90 days (remove sender attribution, PII)
- **FR-014b**: System MUST retain anonymized message content indefinitely for AI training and analytics purposes
- **FR-015**: System MUST support threaded replies attached to parent messages
- **FR-015a**: System MUST display a sent indicator (✓) when message is successfully transmitted; no delivered or read receipts in v1

**Reactions & Engagement**
- **FR-016**: System MUST support emoji reactions on messages with counts
- **FR-017**: System MUST support @mentions for users, @here (online channel members), and @everyone (all channel members)
- **FR-018**: System MUST support message pinning per channel (admin/creator only)
- **FR-019**: System MUST support personal message bookmarking

**Voice Messages**
- **FR-020**: System MUST record audio at 48kHz with noise reduction, maximum duration 5 minutes
- **FR-020a**: System MUST use WebM/Opus format for Chrome/Firefox and MP4/AAC fallback for Safari
- **FR-020b**: System MUST reject recordings under 1 second (accidental recordings)
- **FR-021**: System MUST provide automatic speech-to-text transcription for voice messages with auto-detected language (no manual selection, no fallback)
- **FR-022**: System MUST support playback speed controls (0.5x, 1x, 1.5x, 2x)
- **FR-023**: System MUST display waveform visualization during playback
- **FR-024**: System MUST allow senders to edit transcriptions for accuracy

**Search & Discovery**
- **FR-025**: System MUST provide full-text search across messages the user has access to
- **FR-025a**: System MUST exclude messages from channels the user has left or been removed from
- **FR-025b**: System MUST include messages from archived channels the user is still a member of
- **FR-026**: System MUST support search filters: channel, sender, date range, message type
- **FR-027**: System MUST include voice message transcripts in search index

**Notifications**
- **FR-028**: System MUST deliver real-time push notifications for new messages
- **FR-029**: System MUST support per-channel notification preferences (all messages, mentions only, none)
- **FR-030**: System MUST support Do Not Disturb mode with optional schedule
- **FR-031**: System MUST display unread indicators and counts on channels/DMs, tracked by last-read message position per user
- **FR-031a**: System MUST auto-update last-read position when messages scroll into viewport
- **FR-031b**: System MUST provide a "mark all as read" action for channels and DMs
- **FR-032**: System MUST visually highlight @mentions in messages

**Presence & Status**
- **FR-033**: System MUST display online/away/offline indicators for users
- **FR-034**: System MUST support custom status messages with emoji
- **FR-035**: System MUST auto-transition to "away" after configurable inactivity period (default: 5 minutes)

**Administration**
- **FR-036**: System MUST restrict channel creation to admins and designated users
- **FR-037**: System MUST allow admins to hide or delete any message
- **FR-038**: System MUST allow admins to mute or ban users from specific channels
- **FR-039**: System MUST support exporting conversation history (JSON/CSV format)
- **FR-040**: System MUST support configurable message retention policies

**Integration**
- **FR-041**: System MUST automatically add users to course channels upon enrollment
- **FR-042**: System MUST notify course instructors when questions are posted in their course discussions
- **FR-043**: System MUST remove users from course channels when enrollment is revoked

**Rate Limiting**
- **FR-044**: System MUST limit text messages to 30 per minute per user
- **FR-045**: System MUST limit voice messages to 20 per hour per user
- **FR-046**: System MUST limit message length to 4000 characters maximum
- **FR-047**: System MUST display clear feedback when rate limits are exceeded

### Key Entities

- **Channel**: Represents a communication space. Has type (public/private/course-linked), name, description, topic, archived status, creator, and member list.

- **Conversation**: Represents a DM or group DM. Has participant list (2-8 users) and conversation type (direct/group).

- **Message**: A single communication unit. Has content (text/voice/file), sender, timestamp, channel or conversation reference, parent message (for threads), edit history, deleted status, and reactions.

- **Thread**: A collection of reply messages attached to a parent message within a channel.

- **VoiceMessage**: Extended message type with audio file reference, duration, waveform data, transcription text, and transcription status.

- **Reaction**: An emoji response to a message. Has emoji identifier, user who reacted, and message reference.

- **Mention**: Reference within a message to a user, @here, or @everyone. Links to notification delivery.

- **ChannelMember**: Relationship between user and channel. Has role (member/admin), join date, notification preference, and last read message ID (updated on viewport visibility or manual mark-as-read).

- **UserStatus**: User's current presence state. Has status type (online/away/offline/dnd), custom message, emoji, and last active timestamp.

- **Bookmark**: Personal reference to a message. Has user, message reference, and created timestamp.

- **Pin**: Channel-level reference to an important message. Has channel, message, pinner, and timestamp.

## Assumptions

1. **Authentication**: Users are authenticated via existing Clerk integration; no separate auth needed for messaging.
2. **Real-time infrastructure**: Convex's real-time subscriptions will be used for message delivery without additional WebSocket setup.
3. **Voice transcription**: A third-party speech-to-text service will be integrated (cost to be considered per the constraints).
4. **File storage**: Files will use the existing UploadThing integration with size limits enforced.
5. **Notification delivery**: Push notifications will use web push notifications; native mobile push is out of scope for v1.
6. **Retention default**: Active messages retained indefinitely; soft-deleted messages anonymized after 90 days with anonymized content retained for AI/analytics.
7. **Inactivity timeout**: Auto-away triggers after 5 minutes of inactivity by default.
8. **Maximum channel members**: No hard limit on public channel membership; system must scale to handle 500+ members per channel.
9. **Emoji set**: Standard Unicode emoji set will be used for reactions; custom emoji is out of scope.
10. **Search indexing**: Messages are indexed for search upon creation; full reindex is not needed for existing messages (greenfield).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive new messages within 1 second of being sent (real-time delivery)
- **SC-002**: Voice message transcription completes within 30 seconds for 1-minute audio recordings
- **SC-003**: Search returns results within 500 milliseconds for queries across user's accessible messages
- **SC-004**: System supports 500 concurrent active users without performance degradation
- **SC-005**: 80% of users engage with messaging features at least once per week within 60 days of launch
- **SC-006**: Average response time for course-related questions is under 4 hours (measured by time between question post and first reply)
- **SC-007**: Support tickets related to course questions decrease by 50% within 90 days (peer-to-peer answers)
- **SC-008**: Voice message transcription accuracy exceeds 95% (measured by user corrections)
- **SC-009**: Users can find any message via search with under 3 filter adjustments on average
- **SC-010**: Unread message counts are accurate within 2 seconds of message delivery

## Out of Scope (v1)

- Video calls and screen sharing
- Bot/app framework and integrations
- External guest access (non-authenticated users)
- Message scheduling (send later)
- Workflow automation (message-triggered actions)
- Custom emoji creation
- Native mobile push notifications (web push only)
- End-to-end encryption (message integrity via standard HTTPS)
- Offline mode with local message composition (requires online for all actions)
- Typing indicators in channels (DMs only in v1)

## Dependencies

- Existing Clerk authentication system
- Existing Convex backend infrastructure
- Existing UploadThing file storage
- Third-party speech-to-text API for voice transcription (to be selected)
- Existing user and course data models in the LMS
