import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../../convex/schema";
import { Doc } from "../../../convex/_generated/dataModel";

describe("Messaging Schema Validation", () => {

  describe("New Messaging Tables Exist", () => {
    it("should have channels table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user first (required for creatorId)
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "general",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
        const channel = await ctx.db.get(channelId);
        expect(channel).toBeDefined();
        expect(channel?.name).toBe("general");
      });
    });

    it("should have channelMembers table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user first
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channel
        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        const memberId = await ctx.db.insert("channelMembers", {
          channelId: channelId,
          userId: userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
        const member = await ctx.db.get(memberId);
        expect(member).toBeDefined();
        expect(member?.role).toBe("member");
      });
    });

    it("should have channelAdmins table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create users
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
        const granterId = await ctx.db.insert("users", {
          clerkId: "granter-clerk",
          email: "granter@example.com",
          name: "Granter User",
          role: "admin",
          status: "online",
        });

        // Create channel
        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        const adminId = await ctx.db.insert("channelAdmins", {
          channelId: channelId,
          userId: userId,
          grantedAt: Date.now(),
          grantedBy: granterId,
          reason: "global_admin",
        });
        const admin = await ctx.db.get(adminId);
        expect(admin).toBeDefined();
        expect(admin?.reason).toBe("global_admin");
      });
    });

    it("should have voiceMessages table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Skip actual voiceMessages creation due to storage API limitations in test environment
        // Instead, verify the table exists by attempting a query
        const voices = await ctx.db.query("voiceMessages").collect();
        // Table exists if query succeeds (even if empty)
        expect(Array.isArray(voices)).toBe(true);

        // Note: Full voiceMessages testing with storage requires complex mocking
        // This test validates the table schema exists and is queryable
      });
    });

    it("should have reactions table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        // Create message
        const messageId = await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "Test message",
          createdAt: Date.now(),
        });

        const reactionId = await ctx.db.insert("reactions", {
          messageId: messageId,
          userId: userId,
          emoji: "👍",
          createdAt: Date.now(),
        });
        const reaction = await ctx.db.get(reactionId);
        expect(reaction).toBeDefined();
        expect(reaction?.emoji).toBe("👍");
      });
    });

    it("should have mentions table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create users
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
        const mentionedUserId = await ctx.db.insert("users", {
          clerkId: "mentioned-clerk",
          email: "mentioned@example.com",
          name: "Mentioned User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        // Create message
        const messageId = await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "@Mentioned User test",
          createdAt: Date.now(),
        });

        const mentionId = await ctx.db.insert("mentions", {
          messageId: messageId,
          type: "user",
          mentionedUserId: mentionedUserId,
          createdAt: Date.now(),
        });
        const mention = await ctx.db.get(mentionId);
        expect(mention).toBeDefined();
        expect(mention?.type).toBe("user");
      });
    });

    it("should have pins table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channel
        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        // Create message
        const messageId = await ctx.db.insert("messages", {
          channelId: channelId,
          senderId: userId,
          content: "Pinned message",
          createdAt: Date.now(),
        });

        const pinId = await ctx.db.insert("pins", {
          channelId: channelId,
          messageId: messageId,
          pinnedBy: userId,
          pinnedAt: Date.now(),
        });
        const pin = await ctx.db.get(pinId);
        expect(pin).toBeDefined();
      });
    });

    it("should have bookmarks table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        // Create message
        const messageId = await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "Bookmarked message",
          createdAt: Date.now(),
        });

        const bookmarkId = await ctx.db.insert("bookmarks", {
          userId: userId,
          messageId: messageId,
          createdAt: Date.now(),
        });
        const bookmark = await ctx.db.get(bookmarkId);
        expect(bookmark).toBeDefined();
      });
    });

    it("should have typingIndicators table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        const typingId = await ctx.db.insert("typingIndicators", {
          conversationId: conversationId,
          userId: userId,
          expiresAt: Date.now() + 3000,
        });
        const typing = await ctx.db.get(typingId);
        expect(typing).toBeDefined();
      });
    });

    it("should have notificationPreferences table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const prefId = await ctx.db.insert("notificationPreferences", {
          userId: userId,
          enablePush: true,
          enableSound: true,
          enableDesktop: true,
          dndEnabled: false,
          defaultChannelLevel: "all",
          defaultDmLevel: "all",
          keywords: ["urgent", "important"],
        });
        const pref = await ctx.db.get(prefId);
        expect(pref).toBeDefined();
        expect(pref?.keywords).toEqual(["urgent", "important"]);
      });
    });

    it("should have messageAttachments table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        // Create message
        const messageId = await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "Message with attachment",
          createdAt: Date.now(),
        });

        const attachmentId = await ctx.db.insert("messageAttachments", {
          messageId: messageId,
          fileName: "document.pdf",
          fileSize: 2048,
          fileType: "application/pdf",
          uploadedAt: Date.now(),
        });
        const attachment = await ctx.db.get(attachmentId);
        expect(attachment).toBeDefined();
        expect(attachment?.fileName).toBe("document.pdf");
      });
    });

    it("should have rateLimits table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const rateLimitId = await ctx.db.insert("rateLimits", {
          userId: userId,
          type: "text_message",
          windowStart: Date.now(),
          count: 5,
        });
        const rateLimit = await ctx.db.get(rateLimitId);
        expect(rateLimit).toBeDefined();
        expect(rateLimit?.count).toBe(5);
      });
    });

    it("should have transcriptionUsage table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const usageId = await ctx.db.insert("transcriptionUsage", {
          userId: userId,
          date: "2025-12-22",
          dailyMinutesUsed: 15,
          dailyTranscriptionCount: 3,
          estimatedCostCents: 150,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        const usage = await ctx.db.get(usageId);
        expect(usage).toBeDefined();
        expect(usage?.dailyMinutesUsed).toBe(15);
      });
    });

    it("should have transcriptionBudget table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const budgetId = await ctx.db.insert("transcriptionBudget", {
          month: "2025-12",
          totalMinutesUsed: 100,
          totalTranscriptionCount: 20,
          totalCostCents: 1000,
          budgetCents: 200000,
          isDisabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        const budget = await ctx.db.get(budgetId);
        expect(budget).toBeDefined();
        expect(budget?.budgetCents).toBe(200000);
      });
    });

    it("should have aiTrainingCorpus table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const corpusId = await ctx.db.insert("aiTrainingCorpus", {
          sourceMessageHash: "abc123hash",
          sourceType: "text",
          anonymizedContent: "This is anonymized content",
          metadata: {
            wordCount: 4,
            characterCount: 27,
            hasCodeBlock: false,
            hasLinks: false,
            isThreadReply: false,
            isLessonDiscussion: false,
            reactionCount: 0,
            wasEdited: false,
          },
          isProcessed: false,
          originalCreatedAt: Date.now(),
          anonymizedAt: Date.now(),
        });
        const corpus = await ctx.db.get(corpusId);
        expect(corpus).toBeDefined();
        expect(corpus?.sourceType).toBe("text");
      });
    });

    it("should have messageRetention table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        // Create message
        const messageId = await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "Deleted message",
          createdAt: Date.now(),
        });

        const retentionId = await ctx.db.insert("messageRetention", {
          messageId: messageId,
          deletedAt: Date.now(),
          deletedBy: userId,
          deletionReason: "user_deleted",
          anonymizationScheduledFor: Date.now() + 90 * 24 * 60 * 60 * 1000,
          addedToCorpus: false,
        });
        const retention = await ctx.db.get(retentionId);
        expect(retention).toBeDefined();
        expect(retention?.deletionReason).toBe("user_deleted");
      });
    });

    it("should have gdprRequests table", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const gdprId = await ctx.db.insert("gdprRequests", {
          userId: userId,
          type: "export",
          status: "pending",
          requestedAt: Date.now(),
          retryCount: 0,
        });
        const request = await ctx.db.get(gdprId);
        expect(request).toBeDefined();
        expect(request?.type).toBe("export");
      });
    });
  });

  describe("Enhanced Existing Tables", () => {
    it("should have enhanced users table with new presence fields", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "clerk_test_123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "dnd", // New field
          lastActiveAt: Date.now(), // Enhanced field
          customStatus: "In a meeting", // New field
          customStatusEmoji: "📅", // New field
          customStatusExpiresAt: Date.now() + 3600000, // New field
        });
        const user = await ctx.db.get(userId);
        expect(user).toBeDefined();
        expect(user?.status).toBe("dnd");
        expect(user?.customStatus).toBe("In a meeting");
        expect(user?.customStatusEmoji).toBe("📅");
      });
    });

    it("should have enhanced conversations table with group DM support", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const conversationId = await ctx.db.insert("conversations", {
          type: "group", // New type
          name: "Team Discussion", // New field
          createdAt: Date.now(), // New field
          updatedAt: Date.now(),
          lastMessageAt: Date.now(), // New field
          isActive: true, // New field
        });
        const conversation = await ctx.db.get(conversationId);
        expect(conversation).toBeDefined();
        expect(conversation?.type).toBe("group");
        expect(conversation?.name).toBe("Team Discussion");
        expect(conversation?.isActive).toBe(true);
      });
    });

    it("should have enhanced messages table with channel support", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channel
        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        const messageId = await ctx.db.insert("messages", {
          channelId: channelId, // New field
          senderId: userId,
          content: "Hello from channel",
          contentType: "text", // New field
          parentId: undefined, // New field for threading
          threadReplyCount: 0, // New field
          createdAt: Date.now(),
          reactionCount: 0, // New field
          status: "sent", // New field
        });
        const message = await ctx.db.get(messageId);
        expect(message).toBeDefined();
        expect(message?.contentType).toBe("text");
        expect(message?.status).toBe("sent");
      });
    });
  });

  describe("Required Indexes", () => {
    it("should have by_last_active index on users", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("users", {
          clerkId: "user1",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
          lastActiveAt: now - 1000,
        });
        await ctx.db.insert("users", {
          clerkId: "user2",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
          lastActiveAt: now,
        });

        const users = await ctx.db
          .query("users")
          .withIndex("by_last_active")
          .collect();
        expect(users.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should have by_course index on channels", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create actual course with all required fields
        const courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test Description",
          creatorId: userId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        await ctx.db.insert("channels", {
          name: "course-channel",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        const channels = await ctx.db
          .query("channels")
          .withIndex("by_course", (q) => q.eq("courseId", courseId))
          .collect();
        expect(channels.length).toBe(1);
      });
    });

    it("should have by_channel_time index on messages", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channel
        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          content: "Message 1",
          createdAt: Date.now(),
        });

        const messages = await ctx.db
          .query("messages")
          .withIndex("by_channel_time", (q) => q.eq("channelId", channelId))
          .collect();
        expect(messages.length).toBe(1);
      });
    });

    it("should have search_content index on messages", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "This is a searchable message",
          createdAt: Date.now(),
        });

        const results = await ctx.db
          .query("messages")
          .withSearchIndex("search_content", (q) => q.search("content", "searchable"))
          .collect();
        expect(results.length).toBe(1);
      });
    });

    it("should have by_user_active index on channelMembers", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create channel
        const channelId = await ctx.db.insert("channels", {
          name: "test-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });

        await ctx.db.insert("channelMembers", {
          channelId: channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const activeMembers = await ctx.db
          .query("channelMembers")
          .withIndex("by_user_active", (q) => q.eq("userId", userId))
          .collect();
        expect(activeMembers.length).toBe(1);
      });
    });

    it("should have by_transcription_status index on voiceMessages", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Skip actual voiceMessages creation due to storage API limitations in test environment
        // Instead, verify the index exists by attempting a query with it
        const pending = await ctx.db
          .query("voiceMessages")
          .withIndex("by_transcription_status", (q) =>
            q.eq("transcriptionStatus", "pending")
          )
          .collect();
        // Index exists if query succeeds (even if empty)
        expect(Array.isArray(pending)).toBe(true);

        // Note: Full index testing with storage requires complex mocking
        // This test validates the index schema exists and is usable
      });
    });

    it("should have by_user_date index on transcriptionUsage", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const date = "2025-12-22";
        await ctx.db.insert("transcriptionUsage", {
          userId,
          date,
          dailyMinutesUsed: 10,
          dailyTranscriptionCount: 2,
          estimatedCostCents: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const usage = await ctx.db
          .query("transcriptionUsage")
          .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
          .first();
        expect(usage).toBeDefined();
        expect(usage?.dailyMinutesUsed).toBe(10);
      });
    });

    it("should have by_month index on transcriptionBudget", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const month = "2025-12";
        await ctx.db.insert("transcriptionBudget", {
          month,
          totalMinutesUsed: 50,
          totalTranscriptionCount: 10,
          totalCostCents: 500,
          budgetCents: 200000,
          isDisabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const budget = await ctx.db
          .query("transcriptionBudget")
          .withIndex("by_month", (q) => q.eq("month", month))
          .first();
        expect(budget).toBeDefined();
        expect(budget?.totalMinutesUsed).toBe(50);
      });
    });
  });

  describe("Field Types and Constraints", () => {
    it("should enforce channel type enum", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 0,
        });
        const channel = await ctx.db.get(channelId);
        expect(["public", "private", "course"]).toContain(channel?.type);
      });
    });

    it("should enforce user status enum including dnd", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test",
          email: "test@example.com",
          name: "Test",
          role: "user",
          status: "dnd",
        });
        const user = await ctx.db.get(userId);
        expect(["online", "offline", "away", "dnd"]).toContain(user?.status);
      });
    });

    it("should enforce message contentType enum", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        // Create user
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        // Create conversation
        const conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          updatedAt: Date.now(),
          isActive: true,
        });

        const messageId = await ctx.db.insert("messages", {
          conversationId: conversationId,
          senderId: userId,
          content: "test",
          contentType: "voice",
          createdAt: Date.now(),
        });
        const message = await ctx.db.get(messageId);
        expect(["text", "voice", "file", "system"]).toContain(message?.contentType);
      });
    });

    it("should support conversation type enum with group", async () => {
      const t = convexTest(schema);
      await t.run(async (ctx) => {
        const conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Group Chat",
          updatedAt: Date.now(),
          isActive: true,
        });
        const conversation = await ctx.db.get(conversationId);
        expect(["direct", "group", "broadcast"]).toContain(conversation?.type);
      });
    });
  });
});
