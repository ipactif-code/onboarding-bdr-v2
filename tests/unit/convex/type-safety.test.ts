import { describe, it, expect } from "vitest";
import { Id, Doc } from "../../../convex/_generated/dataModel";

describe("Convex Type Safety", () => {
  describe("Generated Schema Types", () => {
    it("should have Id types for all messaging tables", () => {
      // Test that Id types are properly generated for new tables
      const channelId: Id<"channels"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channels">;
      const channelMemberId: Id<"channelMembers"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channelMembers">;
      const channelAdminId: Id<"channelAdmins"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channelAdmins">;
      const voiceMessageId: Id<"voiceMessages"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"voiceMessages">;
      const reactionId: Id<"reactions"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"reactions">;
      const mentionId: Id<"mentions"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"mentions">;
      const pinId: Id<"pins"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"pins">;
      const bookmarkId: Id<"bookmarks"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"bookmarks">;
      const typingIndicatorId: Id<"typingIndicators"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"typingIndicators">;
      const notificationPreferenceId: Id<"notificationPreferences"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"notificationPreferences">;
      const messageAttachmentId: Id<"messageAttachments"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"messageAttachments">;
      const rateLimitId: Id<"rateLimits"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"rateLimits">;
      const transcriptionUsageId: Id<"transcriptionUsage"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"transcriptionUsage">;
      const transcriptionBudgetId: Id<"transcriptionBudget"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"transcriptionBudget">;
      const aiTrainingCorpusId: Id<"aiTrainingCorpus"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"aiTrainingCorpus">;
      const messageRetentionId: Id<"messageRetention"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"messageRetention">;
      const gdprRequestId: Id<"gdprRequests"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"gdprRequests">;

      // If this compiles, types are correctly generated
      expect(channelId).toBeDefined();
      expect(channelMemberId).toBeDefined();
      expect(channelAdminId).toBeDefined();
      expect(voiceMessageId).toBeDefined();
      expect(reactionId).toBeDefined();
      expect(mentionId).toBeDefined();
      expect(pinId).toBeDefined();
      expect(bookmarkId).toBeDefined();
      expect(typingIndicatorId).toBeDefined();
      expect(notificationPreferenceId).toBeDefined();
      expect(messageAttachmentId).toBeDefined();
      expect(rateLimitId).toBeDefined();
      expect(transcriptionUsageId).toBeDefined();
      expect(transcriptionBudgetId).toBeDefined();
      expect(aiTrainingCorpusId).toBeDefined();
      expect(messageRetentionId).toBeDefined();
      expect(gdprRequestId).toBeDefined();
    });

    it("should have Doc types for all messaging tables", () => {
      // Test that Doc types are properly generated
      const channel: Partial<Doc<"channels">> = {
        name: "general",
        type: "public",
      };

      const channelMember: Partial<Doc<"channelMembers">> = {
        role: "member",
        notificationLevel: "all",
      };

      const voiceMessage: Partial<Doc<"voiceMessages">> = {
        duration: 30,
        transcriptionStatus: "pending",
      };

      const reaction: Partial<Doc<"reactions">> = {
        emoji: "👍",
      };

      const mention: Partial<Doc<"mentions">> = {
        type: "user",
      };

      const transcriptionUsage: Partial<Doc<"transcriptionUsage">> = {
        date: "2025-12-22",
        dailyMinutesUsed: 10,
      };

      const aiTrainingCorpus: Partial<Doc<"aiTrainingCorpus">> = {
        sourceType: "text",
        isProcessed: false,
      };

      // If this compiles, Doc types are correctly generated
      expect(channel).toBeDefined();
      expect(channelMember).toBeDefined();
      expect(voiceMessage).toBeDefined();
      expect(reaction).toBeDefined();
      expect(mention).toBeDefined();
      expect(transcriptionUsage).toBeDefined();
      expect(aiTrainingCorpus).toBeDefined();
    });
  });

  describe("Enhanced Existing Table Types", () => {
    it("should have enhanced user type with new presence fields", () => {
      const user: Partial<Doc<"users">> = {
        clerkId: "clerk_123",
        email: "test@example.com",
        name: "Test User",
        role: "user",
        status: "dnd", // New field
        lastActiveAt: Date.now(), // Enhanced field
        customStatus: "In a meeting", // New field
        customStatusEmoji: "📅", // New field
        customStatusExpiresAt: Date.now() + 3600000, // New field
      };

      // TypeScript should allow all these fields
      expect(user.status).toBe("dnd");
      expect(user.customStatus).toBe("In a meeting");
      expect(user.customStatusEmoji).toBe("📅");
    });

    it("should have enhanced conversation type with group DM support", () => {
      const conversation: Partial<Doc<"conversations">> = {
        type: "group", // New type
        name: "Team Discussion", // New field
        createdAt: Date.now(), // New field
        lastMessageAt: Date.now(), // New field
        isActive: true, // New field
      };

      // TypeScript should allow group type and new fields
      expect(conversation.type).toBe("group");
      expect(conversation.name).toBe("Team Discussion");
      expect(conversation.isActive).toBe(true);
    });

    it("should have enhanced message type with channel support", () => {
      const message: Partial<Doc<"messages">> = {
        channelId: "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channels">, // New field
        senderId: "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"users">,
        content: "Hello from channel",
        contentType: "text", // New field
        parentId: undefined, // New field for threading
        threadReplyCount: 0, // New field
        reactionCount: 0, // New field
        status: "sent", // New field
      };

      // TypeScript should allow channel messaging fields
      expect(message.channelId).toBeDefined();
      expect(message.contentType).toBe("text");
      expect(message.status).toBe("sent");
    });
  });

  describe("Type-safe Enums", () => {
    it("should enforce channel type enum", () => {
      const validTypes: Array<Doc<"channels">["type"]> = ["public", "private", "course"];

      validTypes.forEach((type) => {
        const channel: Partial<Doc<"channels">> = { type };
        expect(["public", "private", "course"]).toContain(channel.type);
      });
    });

    it("should enforce user status enum with dnd", () => {
      const validStatuses: Array<Doc<"users">["status"]> = [
        "online",
        "offline",
        "away",
        "dnd",
      ];

      validStatuses.forEach((status) => {
        const user: Partial<Doc<"users">> = { status };
        expect(["online", "offline", "away", "dnd"]).toContain(user.status);
      });
    });

    it("should enforce message contentType enum", () => {
      const validContentTypes: Array<NonNullable<Doc<"messages">["contentType"]>> = [
        "text",
        "voice",
        "file",
        "system",
      ];

      validContentTypes.forEach((contentType) => {
        const message: Partial<Doc<"messages">> = { contentType };
        expect(["text", "voice", "file", "system"]).toContain(message.contentType);
      });
    });

    it("should enforce conversation type enum with group", () => {
      const validTypes: Array<Doc<"conversations">["type"]> = [
        "direct",
        "group",
        "broadcast",
      ];

      validTypes.forEach((type) => {
        const conversation: Partial<Doc<"conversations">> = { type };
        expect(["direct", "group", "broadcast"]).toContain(conversation.type);
      });
    });

    it("should enforce channelMember role enum", () => {
      const validRoles: Array<Doc<"channelMembers">["role"]> = [
        "owner",
        "admin",
        "moderator",
        "member",
      ];

      validRoles.forEach((role) => {
        const member: Partial<Doc<"channelMembers">> = { role };
        expect(["owner", "admin", "moderator", "member"]).toContain(member.role);
      });
    });

    it("should enforce notification level enum", () => {
      const validLevels: Array<Doc<"channelMembers">["notificationLevel"]> = [
        "all",
        "mentions",
        "none",
      ];

      validLevels.forEach((level) => {
        const member: Partial<Doc<"channelMembers">> = { notificationLevel: level };
        expect(["all", "mentions", "none"]).toContain(member.notificationLevel);
      });
    });

    it("should enforce transcription status enum", () => {
      const validStatuses: Array<Doc<"voiceMessages">["transcriptionStatus"]> = [
        "pending",
        "processing",
        "completed",
        "failed",
      ];

      validStatuses.forEach((status) => {
        const voice: Partial<Doc<"voiceMessages">> = { transcriptionStatus: status };
        expect(["pending", "processing", "completed", "failed"]).toContain(
          voice.transcriptionStatus
        );
      });
    });

    it("should enforce mention type enum", () => {
      const validTypes: Array<Doc<"mentions">["type"]> = ["user", "here", "everyone"];

      validTypes.forEach((type) => {
        const mention: Partial<Doc<"mentions">> = { type };
        expect(["user", "here", "everyone"]).toContain(mention.type);
      });
    });

    it("should enforce GDPR request type enum", () => {
      const validTypes: Array<Doc<"gdprRequests">["type"]> = ["export", "deletion"];

      validTypes.forEach((type) => {
        const request: Partial<Doc<"gdprRequests">> = { type };
        expect(["export", "deletion"]).toContain(request.type);
      });
    });

    it("should enforce GDPR request status enum", () => {
      const validStatuses: Array<Doc<"gdprRequests">["status"]> = [
        "pending",
        "processing",
        "completed",
        "failed",
      ];

      validStatuses.forEach((status) => {
        const request: Partial<Doc<"gdprRequests">> = { status };
        expect(["pending", "processing", "completed", "failed"]).toContain(request.status);
      });
    });
  });

  describe("Complex Field Types", () => {
    it("should support voiceMessage waveformData as number array", () => {
      const waveformData: Doc<"voiceMessages">["waveformData"] = [0.1, 0.2, 0.3, 0.4, 0.5];
      expect(Array.isArray(waveformData)).toBe(true);
      expect(waveformData.every((n) => typeof n === "number")).toBe(true);
    });

    it("should support notificationPreferences keywords as string array", () => {
      const keywords: Doc<"notificationPreferences">["keywords"] = [
        "urgent",
        "important",
        "critical",
      ];
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.every((k) => typeof k === "string")).toBe(true);
    });

    it("should support aiTrainingCorpus metadata object structure", () => {
      const metadata: Doc<"aiTrainingCorpus">["metadata"] = {
        wordCount: 100,
        characterCount: 500,
        hasCodeBlock: false,
        hasLinks: true,
        channelType: "public",
        isThreadReply: false,
        isLessonDiscussion: false,
        detectedLanguage: "en",
        reactionCount: 5,
        wasEdited: false,
      };

      expect(metadata.wordCount).toBe(100);
      expect(metadata.hasLinks).toBe(true);
      expect(metadata.channelType).toBe("public");
    });

    it("should support message editHistory as array of objects", () => {
      const editHistory: NonNullable<Doc<"messages">["editHistory"]> = [
        {
          content: "Original content",
          editedAt: Date.now() - 1000,
        },
        {
          content: "Updated content",
          editedAt: Date.now(),
        },
      ];

      expect(Array.isArray(editHistory)).toBe(true);
      expect(editHistory.length).toBe(2);
      expect(editHistory[0]?.content).toBe("Original content");
    });
  });

  describe("Optional vs Required Fields", () => {
    it("should allow optional fields to be undefined", () => {
      const channel: Partial<Doc<"channels">> = {
        name: "general",
        type: "public",
        description: undefined, // Optional
        topic: undefined, // Optional
        courseId: undefined, // Optional
        archivedAt: undefined, // Optional
      };

      expect(channel.description).toBeUndefined();
      expect(channel.topic).toBeUndefined();
    });

    it("should allow optional customStatus fields on users", () => {
      const user: Partial<Doc<"users">> = {
        clerkId: "test",
        email: "test@example.com",
        name: "Test",
        role: "user",
        status: "online",
        customStatus: undefined, // Optional
        customStatusEmoji: undefined, // Optional
        customStatusExpiresAt: undefined, // Optional
      };

      expect(user.customStatus).toBeUndefined();
    });

    it("should require createdAt on transcriptionUsage", () => {
      const usage: Partial<Doc<"transcriptionUsage">> & {
        createdAt: number;
        updatedAt: number;
      } = {
        userId: "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"users">,
        date: "2025-12-22",
        dailyMinutesUsed: 10,
        dailyTranscriptionCount: 2,
        estimatedCostCents: 100,
        createdAt: Date.now(), // Required
        updatedAt: Date.now(), // Required
      };

      expect(usage.createdAt).toBeDefined();
      expect(usage.updatedAt).toBeDefined();
    });
  });

  describe("Cross-table References", () => {
    it("should type channelId correctly in messages", () => {
      const channelId: Id<"channels"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"channels">;
      const message: Partial<Doc<"messages">> = {
        channelId, // Should accept Id<"channels">
      };

      expect(message.channelId).toBe(channelId);
    });

    it("should type messageId correctly in reactions", () => {
      const messageId: Id<"messages"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"messages">;
      const reaction: Partial<Doc<"reactions">> = {
        messageId, // Should accept Id<"messages">
      };

      expect(reaction.messageId).toBe(messageId);
    });

    it("should type courseId correctly in channels", () => {
      const courseId: Id<"courses"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"courses">;
      const channel: Partial<Doc<"channels">> = {
        type: "course",
        courseId, // Should accept Id<"courses">
      };

      expect(channel.courseId).toBe(courseId);
    });

    it("should type lessonId correctly in messages", () => {
      const lessonId: Id<"lessons"> = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"lessons">;
      const message: Partial<Doc<"messages">> = {
        lessonId, // Should accept Id<"lessons">
      };

      expect(message.lessonId).toBe(lessonId);
    });
  });
});
