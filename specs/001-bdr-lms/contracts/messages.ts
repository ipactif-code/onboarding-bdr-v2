# Convex Function Contracts: Messaging

**Module**: `convex/messages.ts`
**Date**: 2025-12-06

## Overview

Real-time messaging system for direct messages and admin broadcasts.
All message queries update in real-time via Convex subscriptions.

---

## Queries

### `api.messages.listConversations`
Get all conversations for current user.

```typescript
export const listConversations = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("conversations"),
    type: v.union(v.literal("direct"), v.literal("broadcast")),
    participants: v.array(v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    })),
    lastMessage: v.optional(v.object({
      content: v.string(),
      senderId: v.id("users"),
      senderName: v.string(),
      createdAt: v.number(),
    })),
    unreadCount: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user's conversations only
**Ordering**: By updatedAt descending (most recent first)

---

### `api.messages.getConversation`
Get a single conversation with messages.

```typescript
export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.object({
    _id: v.id("conversations"),
    type: v.union(v.literal("direct"), v.literal("broadcast")),
    participants: v.array(v.object({
      _id: v.id("users"),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      status: v.union(v.literal("online"), v.literal("offline"), v.literal("away")),
    })),
    messages: v.array(v.object({
      _id: v.id("messages"),
      content: v.string(),
      sender: v.object({
        _id: v.id("users"),
        name: v.string(),
        avatarUrl: v.optional(v.string()),
      }),
      createdAt: v.number(),
      isOwn: v.boolean(),
    })),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Must be a participant
**Real-time**: Messages update automatically when new ones arrive

---

### `api.messages.getOrCreateDirect`
Get or create a direct conversation with another user.

```typescript
export const getOrCreateDirect = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user
**Validation**: Cannot create conversation with self

---

### `api.messages.getUnreadCount`
Get total unread message count (for navigation badge).

```typescript
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Current user only
**Real-time**: Updates automatically when new messages arrive

---

### `api.messages.search`
Search messages within a conversation.

```typescript
export const search = query({
  args: {
    conversationId: v.id("conversations"),
    query: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("messages"),
    content: v.string(),
    sender: v.object({
      _id: v.id("users"),
      name: v.string(),
    }),
    createdAt: v.number(),
    matchIndices: v.array(v.object({
      start: v.number(),
      end: v.number(),
    })),
  })),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Must be a participant

---

## Mutations

### `api.messages.send`
Send a message in a conversation.

```typescript
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Must be a participant
**Validation**: Content 1-10000 characters
**Side Effects**:
- Updates conversation updatedAt
- Logs activity for analytics

---

### `api.messages.sendDirect`
Send a direct message to a user (creates conversation if needed).

```typescript
export const sendDirect = mutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
  },
  returns: v.object({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
  }),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Any authenticated user
**Validation**: Cannot message self, content 1-10000 characters

---

### `api.messages.broadcast`
Send a broadcast message (admin only).

```typescript
export const broadcast = mutation({
  args: {
    content: v.string(),
    teamIds: v.optional(v.array(v.id("teams"))), // null = all users
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Admin only
**Behavior**:
- Creates broadcast conversation
- Adds all target users as participants
- Single message delivered to all

---

### `api.messages.markRead`
Mark messages in a conversation as read.

```typescript
export const markRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Authorization**: Must be a participant
**Behavior**: Updates lastReadAt for current user's participation

---

## Real-Time Patterns

```typescript
// Component subscribes to messages
const conversation = useQuery(api.messages.getConversation, { conversationId });
// Automatically updates when new messages arrive

// Unread count in navigation
const unreadCount = useQuery(api.messages.getUnreadCount);
// Updates within 1 second of new message
```

---

## Validation Rules

- Message content: 1-10000 characters
- Cannot message yourself
- Must be participant to view/send in conversation
- Broadcast requires admin role

---

## Read Receipt Logic

```typescript
// Check if message is read by recipient
function isMessageRead(message, participant) {
  if (message.senderId === participant.userId) return true; // own message
  return participant.lastReadAt >= message.createdAt;
}

// Unread count for user in conversation
function getUnreadCount(conversation, userId) {
  const participant = getParticipant(conversation, userId);
  return messages.filter(m =>
    m.senderId !== userId &&
    m.createdAt > (participant.lastReadAt ?? 0)
  ).length;
}
```

---

## Delivery Guarantees

- Messages delivered within 1 second via Convex real-time
- Automatic retry on network failure
- Optimistic updates for sent messages
- Ordered by creation time within conversation
