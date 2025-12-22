import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach } from "vitest";
import schema from "../../convex/schema";
import { Id } from "../../convex/_generated/dataModel";

describe("Messaging System Integration Smoke Tests", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, {});
  });

  describe("Basic CRUD Operations", () => {
    it("should create and read a channel", async () => {
      const channelId = await t.run(async (ctx) => {
        return await ctx.db.insert("channels", {
          name: "smoke-test-channel",
          type: "public",
          creatorId: "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"users">,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
      });

      const channel = await t.run(async (ctx) => {
        return await ctx.db.get(channelId);
      });

      expect(channel).toBeDefined();
      expect(channel?.name).toBe("smoke-test-channel");
      expect(channel?.type).toBe("public");
      expect(channel?.isArchived).toBe(false);
    });

    it("should create and read a message in a channel", async () => {
      const { channelId, userId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "smoke-test-user",
          email: "smoke@test.com",
          name: "Smoke Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        return { channelId, userId };
      });

      const messageId = await t.run(async (ctx) => {
        return await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Hello from smoke test!",
          contentType: "text",
          createdAt: Date.now(),
          status: "sent",
        });
      });

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(message).toBeDefined();
      expect(message?.content).toBe("Hello from smoke test!");
      expect(message?.channelId).toBe(channelId);
      expect(message?.senderId).toBe(userId);
    });

    it("should create and read a direct message conversation", async () => {
      const { conversationId, user1Id, user2Id } = await t.run(async (ctx) => {
        const user1Id = await ctx.db.insert("users", {
          clerkId: "user1",
          email: "user1@test.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        const user2Id = await ctx.db.insert("users", {
          clerkId: "user2",
          email: "user2@test.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user1Id,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });

        return { conversationId, user1Id, user2Id };
      });

      const conversation = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

      const participants = await t.run(async (ctx) => {
        return await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation" as any, (q: any) => q.eq("conversationId", conversationId))
          .collect();
      });

      expect(conversation).toBeDefined();
      expect(conversation?.type).toBe("direct");
      expect(participants.length).toBe(2);
      expect(participants.map((p) => p.userId)).toContain(user1Id);
      expect(participants.map((p) => p.userId)).toContain(user2Id);
    });
  });

  describe("Relationship Integrity", () => {
    it("should link channel members to channels and users", async () => {
      const { channelId, userId, memberId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "member-test",
          email: "member@test.com",
          name: "Member Test",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "member-test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const memberId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        return { channelId, userId, memberId };
      });

      // Verify the relationship
      const member = await t.run(async (ctx) => {
        return await ctx.db.get(memberId);
      });

      const channel = await t.run(async (ctx) => {
        return await ctx.db.get(channelId);
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(member).toBeDefined();
      expect(member?.channelId).toBe(channelId);
      expect(member?.userId).toBe(userId);
      expect(channel).toBeDefined();
      expect(user).toBeDefined();
    });

    it("should link reactions to messages and users", async () => {
      const { messageId, userId, reactionId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "reactor",
          email: "reactor@test.com",
          name: "Reactor",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        const messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "React to this!",
          createdAt: Date.now(),
        });

        const reactionId = await ctx.db.insert("reactions", {
          messageId,
          userId,
          emoji: "❤️",
          createdAt: Date.now(),
        });

        return { messageId, userId, reactionId };
      });

      const reaction = await t.run(async (ctx) => {
        return await ctx.db.get(reactionId);
      });

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(reaction).toBeDefined();
      expect(reaction?.messageId).toBe(messageId);
      expect(reaction?.emoji).toBe("❤️");
      expect(message).toBeDefined();
    });

    it("should link voice messages to messages", async () => {
      const { messageId, voiceId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "voice-user",
          email: "voice@test.com",
          name: "Voice User",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        const messageId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "",
          contentType: "voice",
          createdAt: Date.now(),
        });

        const voiceId = await ctx.db.insert("voiceMessages", {
          messageId,
          storageId: "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"_storage">,
          fileSize: 1024,
          mimeType: "audio/webm",
          duration: 30,
          waveformData: [0.1, 0.2, 0.3],
          transcriptionStatus: "pending",
          transcriptionEdited: false,
        });

        return { messageId, voiceId };
      });

      const voice = await t.run(async (ctx) => {
        return await ctx.db.get(voiceId);
      });

      const message = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(voice).toBeDefined();
      expect(voice?.messageId).toBe(messageId);
      expect(message?.contentType).toBe("voice");
    });
  });

  describe("Index Performance", () => {
    it("should efficiently query messages by channel using index", async () => {
      const channelId = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "index-test",
          email: "index@test.com",
          name: "Index Test",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "index-test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Create multiple messages
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("messages", {
            channelId,
            senderId: userId,
            content: `Message ${i}`,
            contentType: "text",
            createdAt: Date.now() + i,
          });
        }

        return channelId;
      });

      const messages = await t.run(async (ctx) => {
        return await ctx.db
          .query("messages")
          .withIndex("by_channel_time" as any, (q: any) => q.eq("channelId", channelId))
          .collect();
      });

      expect(messages.length).toBe(10);
    });

    it("should efficiently query channel members by user using index", async () => {
      const userId = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "multi-channel-user",
          email: "multi@test.com",
          name: "Multi Channel User",
          role: "user",
          status: "online",
        });

        // Create multiple channel memberships
        for (let i = 0; i < 5; i++) {
          const channelId = await ctx.db.insert("channels", {
            name: `channel-${i}`,
            type: "public",
            creatorId: userId,
            createdAt: Date.now(),
            isArchived: false,
            memberCount: 1,
          });

          await ctx.db.insert("channelMembers", {
            channelId,
            userId,
            role: "member",
            joinedAt: Date.now(),
            notificationLevel: "all",
            isMuted: false,
            isBanned: false,
          });
        }

        return userId;
      });

      const memberships = await t.run(async (ctx) => {
        return await ctx.db
          .query("channelMembers")
          .withIndex("by_user" as any, (q: any) => q.eq("userId", userId))
          .collect();
      });

      expect(memberships.length).toBe(5);
    });

    it("should efficiently search messages by content", async () => {
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "search-user",
          email: "search@test.com",
          name: "Search User",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "This message contains a searchable keyword",
          createdAt: Date.now(),
        });

        await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "This message does not contain the term",
          createdAt: Date.now(),
        });
      });

      const results = await t.run(async (ctx) => {
        return await (ctx.db
          .query("messages") as any)
          .withSearchIndex("search_content", (q: any) => q.search("content", "searchable"))
          .collect();
      });

      expect(results.length).toBe(1);
      expect(results[0].content).toContain("searchable");
    });
  });

  describe("Enhanced Features", () => {
    it("should support user presence with dnd status", async () => {
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "dnd-user",
          email: "dnd@test.com",
          name: "DND User",
          role: "user",
          status: "dnd",
          lastActiveAt: Date.now(),
          customStatus: "In a meeting",
          customStatusEmoji: "📅",
          customStatusExpiresAt: Date.now() + 3600000,
        });
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user?.status).toBe("dnd");
      expect(user?.customStatus).toBe("In a meeting");
      expect(user?.customStatusEmoji).toBe("📅");
    });

    it("should support group conversations", async () => {
      const conversationId = await t.run(async (ctx) => {
        return await ctx.db.insert("conversations", {
          type: "group",
          name: "Team Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const conversation = await t.run(async (ctx) => {
        return await ctx.db.get(conversationId);
      });

      expect(conversation?.type).toBe("group");
      expect(conversation?.name).toBe("Team Chat");
    });

    it("should support threaded messages", async () => {
      const { parentId, replyId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "thread-user",
          email: "thread@test.com",
          name: "Thread User",
          role: "user",
          status: "online",
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        const parentId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Parent message",
          createdAt: Date.now(),
        });

        const replyId = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Reply to parent",
          parentId,
          createdAt: Date.now() + 1,
        });

        return { parentId, replyId };
      });

      const parent = await t.run(async (ctx) => {
        return await ctx.db.get(parentId);
      });

      const reply = await t.run(async (ctx) => {
        return await ctx.db.get(replyId);
      });

      expect(parent).toBeDefined();
      expect(reply?.parentId).toBe(parentId);
    });

    it("should support course channels", async () => {
      const { channelId, courseId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "instructor",
          email: "instructor@test.com",
          name: "Instructor",
          role: "admin",
          status: "online",
        });

        const courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 1,
          viewCount: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "course-test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        return { channelId, courseId };
      });

      const channel = await t.run(async (ctx) => {
        return await ctx.db.get(channelId);
      });

      const linkedChannels = await t.run(async (ctx) => {
        return await ctx.db
          .query("channels")
          .withIndex("by_course" as any, (q: any) => q.eq("courseId", courseId))
          .collect();
      });

      expect(channel?.type).toBe("course");
      expect(channel?.courseId).toBe(courseId);
      expect(linkedChannels.length).toBe(1);
    });
  });

  describe("Data Integrity", () => {
    it("should enforce message belongs to either channel or conversation", async () => {
      const { channelMessage, conversationMessage } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "integrity-user",
          email: "integrity@test.com",
          name: "Integrity User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "integrity-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
        });

        const channelMessage = await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Channel message",
          createdAt: Date.now(),
        });

        const conversationMessage = await ctx.db.insert("messages", {
          conversationId,
          senderId: userId,
          content: "Conversation message",
          createdAt: Date.now(),
        });

        return { channelMessage, conversationMessage };
      });

      const channelMsg = await t.run(async (ctx) => {
        return await ctx.db.get(channelMessage);
      });

      const conversationMsg = await t.run(async (ctx) => {
        return await ctx.db.get(conversationMessage);
      });

      // Channel message should have channelId but not conversationId
      expect(channelMsg?.channelId).toBeDefined();
      expect(channelMsg?.conversationId).toBeUndefined();

      // Conversation message should have conversationId but not channelId
      expect(conversationMsg?.conversationId).toBeDefined();
      expect(conversationMsg?.channelId).toBeUndefined();
    });
  });
});
