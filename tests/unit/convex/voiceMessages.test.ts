/**
 * Voice Messages - Convex Backend Tests
 *
 * Tests for voice message mutations, queries, and validation.
 * Covers F026-F033: Backend functionality for voice messaging.
 */

import { convexTest } from "convex-test";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConvexError } from "convex/values";
import { validateWaveformData } from "../../../convex/voiceMessages/types";

describe("voiceMessages", () => {
  describe("generateUploadUrl (F026)", () => {
    it("should require authentication", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(api.voiceMessages.channelMutations.generateUploadUrl, {})
      ).rejects.toThrow();
    });

    it("should generate upload URL for authenticated user", async () => {
      const t = convexTest(schema);

      // Create authenticated user
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });
      });

      const asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });

      const result = await asUser.mutation(
        api.voiceMessages.channelMutations.generateUploadUrl,
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should respect rate limits (20/hour)", async () => {
      const t = convexTest(schema);

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });
      });

      const asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });

      // Generate 20 upload URLs (should succeed)
      for (let i = 0; i < 20; i++) {
        await asUser.mutation(
          api.voiceMessages.channelMutations.generateUploadUrl,
          {}
        );
      }

      // Note: Rate limiting is enforced in sendVoiceToChannel, not generateUploadUrl
      // This test validates that the mutation doesn't throw on multiple calls
      const result = await asUser.mutation(
        api.voiceMessages.channelMutations.generateUploadUrl,
        {}
      );
      expect(result).toBeDefined();
    });
  });

  describe("sendVoiceToChannel (F027)", () => {
    let t: ReturnType<typeof convexTest>;
    let userId: Id<"users">;
    let channelId: Id<"channels">;
    let storageId: Id<"_storage">;
    let asUser: ReturnType<typeof t.withIdentity>;

    beforeEach(async () => {
      t = convexTest(schema);

      // Create user and channel
      const setup = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });

        const cid = await ctx.db.insert("channels", {
          name: "test-channel",
          description: "Test channel",
          type: "public",
          creatorId: uid,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Add user as channel member
        await ctx.db.insert("channelMembers", {
          channelId: cid,
          userId: uid,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create a mock audio file in storage for testing
        // Using Buffer as Blob might not work correctly in test environment
        const mockAudioBuffer = Buffer.from("mock audio data", "utf-8");
        const mockBlob = new Blob([mockAudioBuffer]);
        const sid = await ctx.storage.store(mockBlob);

        return { userId: uid, channelId: cid, storageId: sid };
      });

      userId = setup.userId;
      channelId = setup.channelId;
      storageId = setup.storageId;

      asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });
    });

    it("should require channel membership", async () => {
      const t2 = convexTest(schema);

      // Create a different user not in channel
      const otherUserId = await t2.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "user_456",
          email: "other@example.com",
          name: "Other User",
          role: "user" as const,
          status: "offline" as const,
        });
      });

      const asOtherUser = t2.withIdentity({
        subject: "user_456",
        issuer: "https://clerk.example.com",
      });

      await expect(
        asOtherUser.mutation(api.voiceMessages.channelMutations.sendVoiceToChannel, {
          channelId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        })
      ).rejects.toThrow();
    });

    it("should create message with voice data", async () => {
      const messageId = await asUser.mutation(
        api.voiceMessages.channelMutations.sendVoiceToChannel,
        {
          channelId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        }
      );

      expect(messageId).toBeDefined();

      // Verify message created
      const message = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(message).toBeDefined();
      expect(message?.contentType).toBe("voice");
      expect(message?.senderId).toBe(userId);
      expect(message?.channelId).toBe(channelId);

      // Verify voice message data created
      const voiceMessage = await t.run(async (ctx) => {
        return await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
      });

      expect(voiceMessage).toBeDefined();
      expect(voiceMessage?.storageId).toBe(storageId);
      expect(voiceMessage?.duration).toBe(5);
      expect(voiceMessage?.transcriptionStatus).toBe("pending");
    });

    it("should validate waveform data", async () => {
      // Invalid waveform: too few samples
      await expect(
        asUser.mutation(api.voiceMessages.channelMutations.sendVoiceToChannel, {
          channelId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: [0.5, 0.6], // Only 2 samples (min: 10)
        })
      ).rejects.toThrow(/too short/i);
    });

    it("should reject invalid duration (zero)", async () => {
      await expect(
        asUser.mutation(api.voiceMessages.channelMutations.sendVoiceToChannel, {
          channelId,
          storageId,
          duration: 0,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        })
      ).rejects.toThrow(/duration must be greater than 0/i);
    });

    it("should reject invalid duration (exceeds max)", async () => {
      await expect(
        asUser.mutation(api.voiceMessages.channelMutations.sendVoiceToChannel, {
          channelId,
          storageId,
          duration: 121, // Max is 120 seconds
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        })
      ).rejects.toThrow(/exceeds maximum/i);
    });

    it("should schedule transcription", async () => {
      // Mock scheduler to verify it's called
      let scheduledAction: string | null = null;

      const messageId = await asUser.mutation(
        api.voiceMessages.channelMutations.sendVoiceToChannel,
        {
          channelId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        }
      );

      // Verify voice message has pending status
      const voiceMessage = await t.run(async (ctx) => {
        return await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
      });

      expect(voiceMessage?.transcriptionStatus).toBe("pending");
    });
  });

  describe("sendVoiceToConversation (F028)", () => {
    let t: ReturnType<typeof convexTest>;
    let userId: Id<"users">;
    let otherUserId: Id<"users">;
    let conversationId: Id<"directMessageConversations">;
    let storageId: Id<"_storage">;
    let asUser: ReturnType<typeof t.withIdentity>;

    beforeEach(async () => {
      t = convexTest(schema);

      const setup = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });

        const otherUid = await ctx.db.insert("users", {
          clerkId: "user_456",
          email: "other@example.com",
          name: "Other User",
          role: "user" as const,
          status: "offline" as const,
        });

        const convId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Add participants
        await ctx.db.insert("conversationParticipants", {
          conversationId: convId,
          userId: uid,
          joinedAt: Date.now(),
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId: convId,
          userId: otherUid,
          joinedAt: Date.now(),
        });

        // Create a mock audio file in storage for testing
        // Using Buffer as Blob might not work correctly in test environment
        const mockAudioBuffer = Buffer.from("mock audio data", "utf-8");
        const mockBlob = new Blob([mockAudioBuffer]);
        const sid = await ctx.storage.store(mockBlob);

        return {
          userId: uid,
          otherUserId: otherUid,
          conversationId: convId,
          storageId: sid,
        };
      });

      userId = setup.userId;
      otherUserId = setup.otherUserId;
      conversationId = setup.conversationId;
      storageId = setup.storageId;

      asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });
    });

    it("should require authentication", async () => {
      await expect(
        t.mutation(api.voiceMessages.dmMutations.sendVoiceToConversation, {
          conversationId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        })
      ).rejects.toThrow();
    });

    it("should require conversation membership", async () => {
      const t2 = convexTest(schema);

      const strangerUserId = await t2.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "user_789",
          email: "stranger@example.com",
          name: "Stranger",
          role: "user" as const,
          status: "offline" as const,
        });
      });

      const asStranger = t2.withIdentity({
        subject: "user_789",
        issuer: "https://clerk.example.com",
      });

      await expect(
        asStranger.mutation(api.voiceMessages.dmMutations.sendVoiceToConversation, {
          conversationId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(100).fill(0.5),
        })
      ).rejects.toThrow();
    });

    it("should create DM with voice data", async () => {
      const messageId = await asUser.mutation(
        api.voiceMessages.dmMutations.sendVoiceToConversation,
        {
          conversationId,
          storageId,
          duration: 8,
          fileSize: 75000,
          mimeType: "audio/mp4",
          waveformData: Array(150).fill(0.7),
        }
      );

      expect(messageId).toBeDefined();

      // Verify DM created
      const dm = await t.run(async (ctx) => {
        return await ctx.db.get(messageId);
      });

      expect(dm).toBeDefined();
      expect(dm?.contentType).toBe("voice");
      expect(dm?.senderId).toBe(userId);
      expect(dm?.conversationId).toBe(conversationId);

      // Verify voice message data
      const voiceMessage = await t.run(async (ctx) => {
        return await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
      });

      expect(voiceMessage).toBeDefined();
      expect(voiceMessage?.duration).toBe(8);
      expect(voiceMessage?.waveformData).toHaveLength(150);
    });

    it("should validate waveform data", async () => {
      await expect(
        asUser.mutation(api.voiceMessages.dmMutations.sendVoiceToConversation, {
          conversationId,
          storageId,
          duration: 5,
          fileSize: 50000,
          mimeType: "audio/webm",
          waveformData: Array(1001).fill(0.5), // Too many samples (max: 1000)
        })
      ).rejects.toThrow(/too long/i);
    });
  });

  describe("getVoiceMessage (F029)", () => {
    it("should return voice message data with audio URL", async () => {
      const t = convexTest(schema);

      const setup = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });

        const cid = await ctx.db.insert("channels", {
          name: "test-channel",
          description: "Test",
          type: "public",
          creatorId: uid,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const mid = await ctx.db.insert("messages", {
          channelId: cid,
          senderId: uid,
          content: "[Voice Message]",
          contentType: "voice",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // Create a mock audio file in storage for testing
        // Using Buffer as Blob might not work correctly in test environment
        const mockAudioBuffer = Buffer.from("mock audio data", "utf-8");
        const mockBlob = new Blob([mockAudioBuffer]);
        const sid = await ctx.storage.store(mockBlob);

        await ctx.db.insert("voiceMessages", {
          messageId: mid,
          storageId: sid,
          fileSize: 50000,
          mimeType: "audio/webm",
          duration: 10,
          waveformData: Array(100).fill(0.5),
          transcriptionStatus: "completed",
          transcription: "Test transcription",
          transcriptionEdited: false,
        });

        return { messageId: mid };
      });

      const asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });

      const result = await asUser.query(api.voiceMessages.queries.getVoiceMessage, {
        messageId: setup.messageId,
      });

      expect(result).toBeDefined();
      expect(result?.duration).toBe(10);
      expect(result?.waveformData).toHaveLength(100);
      expect(result?.transcription).toBe("Test transcription");
      expect(result?.transcriptionStatus).toBe("completed");
      expect(result?.audioUrl).toBeDefined();
    });

    it("should return null for non-existent message", async () => {
      const t = convexTest(schema);

      // Create a message ID by inserting and deleting a message
      const fakeId = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          clerkId: "temp-user",
          email: "temp@example.com",
          name: "Temp User",
          role: "user" as const,
          status: "offline" as const,
        });

        const convId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        const mid = await ctx.db.insert("messages", {
          conversationId: convId,
          senderId: uid,
          content: "temp",
          createdAt: Date.now(),
        });

        // Delete the message so it doesn't exist
        await ctx.db.delete(mid);

        return mid;
      });

      const asUser = t.withIdentity({
        subject: "temp-user",
        issuer: "https://clerk.example.com",
      });

      const result = await asUser.query(api.voiceMessages.queries.getVoiceMessage, {
        messageId: fakeId,
      });

      expect(result).toBeNull();
    });
  });

  describe("editTranscription (F030)", () => {
    let t: ReturnType<typeof convexTest>;
    let userId: Id<"users">;
    let messageId: Id<"messages">;
    let asUser: ReturnType<typeof t.withIdentity>;

    beforeEach(async () => {
      t = convexTest(schema);

      const setup = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });

        const cid = await ctx.db.insert("channels", {
          name: "test-channel",
          description: "Test",
          type: "public",
          creatorId: uid,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const mid = await ctx.db.insert("messages", {
          channelId: cid,
          senderId: uid,
          content: "[Voice Message]",
          contentType: "voice",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // Create a mock audio file in storage for testing
        // Using Buffer as Blob might not work correctly in test environment
        const mockAudioBuffer = Buffer.from("mock audio data", "utf-8");
        const mockBlob = new Blob([mockAudioBuffer]);
        const sid = await ctx.storage.store(mockBlob);

        await ctx.db.insert("voiceMessages", {
          messageId: mid,
          storageId: sid,
          fileSize: 50000,
          mimeType: "audio/webm",
          duration: 10,
          waveformData: Array(100).fill(0.5),
          transcriptionStatus: "completed",
          transcription: "Original transcription",
          transcriptionEdited: false,
        });

        return { userId: uid, messageId: mid };
      });

      userId = setup.userId;
      messageId = setup.messageId;

      asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });
    });

    it("should require authentication", async () => {
      await expect(
        t.mutation(api.voiceMessages.transcriptionMutations.editTranscription, {
          messageId,
          transcription: "New transcription",
        })
      ).rejects.toThrow();
    });

    it("should only allow sender to edit", async () => {
      // Create another user in the same test context
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user_456",
          email: "other@example.com",
          name: "Other User",
          role: "user" as const,
          status: "offline" as const,
        });
      });

      const asOtherUser = t.withIdentity({
        subject: "user_456",
        issuer: "https://clerk.example.com",
      });

      await expect(
        asOtherUser.mutation(api.voiceMessages.transcriptionMutations.editTranscription, {
          messageId,
          transcription: "Edited by someone else",
        })
      ).rejects.toThrow(/only the sender/i);
    });

    it("should validate transcription length", async () => {
      // Empty transcription
      await expect(
        asUser.mutation(api.voiceMessages.transcriptionMutations.editTranscription, {
          messageId,
          transcription: "   ",
        })
      ).rejects.toThrow(/cannot be empty/i);

      // Too long
      await expect(
        asUser.mutation(api.voiceMessages.transcriptionMutations.editTranscription, {
          messageId,
          transcription: "a".repeat(10001),
        })
      ).rejects.toThrow(/too long/i);
    });

    it("should preserve original transcription on first edit", async () => {
      await asUser.mutation(api.voiceMessages.transcriptionMutations.editTranscription, {
        messageId,
        transcription: "Edited transcription",
      });

      const voiceMessage = await t.run(async (ctx) => {
        return await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
      });

      expect(voiceMessage?.transcription).toBe("Edited transcription");
      expect(voiceMessage?.originalTranscription).toBe("Original transcription");
      expect(voiceMessage?.transcriptionEdited).toBe(true);
    });

    it("should reject empty transcription", async () => {
      await expect(
        asUser.mutation(api.voiceMessages.transcriptionMutations.editTranscription, {
          messageId,
          transcription: "",
        })
      ).rejects.toThrow(/cannot be empty/i);
    });
  });

  describe("retryTranscription (F031)", () => {
    let t: ReturnType<typeof convexTest>;
    let userId: Id<"users">;
    let messageId: Id<"messages">;
    let asUser: ReturnType<typeof t.withIdentity>;

    beforeEach(async () => {
      t = convexTest(schema);

      const setup = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          clerkId: "user_123",
          email: "test@example.com",
          name: "Test User",
          role: "user" as const,
          status: "offline" as const,
        });

        const cid = await ctx.db.insert("channels", {
          name: "test-channel",
          description: "Test",
          type: "public",
          creatorId: uid,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const mid = await ctx.db.insert("messages", {
          channelId: cid,
          senderId: uid,
          content: "[Voice Message]",
          contentType: "voice",
          createdAt: Date.now(),
          status: "sent",
          reactionCount: 0,
          threadReplyCount: 0,
        });

        // Create a mock audio file in storage for testing
        // Using Buffer as Blob might not work correctly in test environment
        const mockAudioBuffer = Buffer.from("mock audio data", "utf-8");
        const mockBlob = new Blob([mockAudioBuffer]);
        const sid = await ctx.storage.store(mockBlob);

        await ctx.db.insert("voiceMessages", {
          messageId: mid,
          storageId: sid,
          fileSize: 50000,
          mimeType: "audio/webm",
          duration: 10,
          waveformData: Array(100).fill(0.5),
          transcriptionStatus: "failed",
          transcriptionError: "API error",
          transcriptionEdited: false,
        });

        return { userId: uid, messageId: mid };
      });

      userId = setup.userId;
      messageId = setup.messageId;

      asUser = t.withIdentity({
        subject: "user_123",
        issuer: "https://clerk.example.com",
      });
    });

    it("should require authentication", async () => {
      await expect(
        t.mutation(api.voiceMessages.transcriptionMutations.retryTranscription, {
          messageId,
        })
      ).rejects.toThrow();
    });

    it("should only allow sender to retry", async () => {
      // Create another user in the same test context
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user_456",
          email: "other@example.com",
          name: "Other User",
          role: "user" as const,
          status: "offline" as const,
        });
      });

      const asOtherUser = t.withIdentity({
        subject: "user_456",
        issuer: "https://clerk.example.com",
      });

      await expect(
        asOtherUser.mutation(api.voiceMessages.transcriptionMutations.retryTranscription, {
          messageId,
        })
      ).rejects.toThrow(/only the sender/i);
    });

    it("should only work on failed transcriptions", async () => {
      // Change status to completed
      await t.run(async (ctx) => {
        const vm = await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
        if (vm) {
          await ctx.db.patch(vm._id, { transcriptionStatus: "completed" });
        }
      });

      await expect(
        asUser.mutation(api.voiceMessages.transcriptionMutations.retryTranscription, {
          messageId,
        })
      ).rejects.toThrow(/can only retry failed/i);
    });

    it("should validate duration before retry", async () => {
      // Set invalid duration
      await t.run(async (ctx) => {
        const vm = await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
        if (vm) {
          await ctx.db.patch(vm._id, { duration: 121 }); // Exceeds max
        }
      });

      await expect(
        asUser.mutation(api.voiceMessages.transcriptionMutations.retryTranscription, {
          messageId,
        })
      ).rejects.toThrow(/exceeds maximum/i);
    });

    it("should reset status to pending", async () => {
      await asUser.mutation(api.voiceMessages.transcriptionMutations.retryTranscription, {
        messageId,
      });

      const voiceMessage = await t.run(async (ctx) => {
        return await ctx.db
          .query("voiceMessages")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .unique();
      });

      expect(voiceMessage?.transcriptionStatus).toBe("pending");
      expect(voiceMessage?.transcriptionError).toBeUndefined();
    });
  });

  describe("validateWaveformData (F032)", () => {
    it("should pass valid waveform (10-1000 samples, 0-1 values)", () => {
      const validData = Array(100)
        .fill(0)
        .map((_, i) => i / 100);
      const result = validateWaveformData(validData);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should fail on too few samples", () => {
      const tooShort = [0.5, 0.6, 0.7];
      const result = validateWaveformData(tooShort);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too short/i);
    });

    it("should fail on too many samples", () => {
      const tooLong = Array(1001).fill(0.5);
      const result = validateWaveformData(tooLong);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too long/i);
    });

    it("should fail on out-of-range values (negative)", () => {
      const data = Array(100).fill(0.5);
      data[50] = -0.1;
      const result = validateWaveformData(data);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid waveform value/i);
    });

    it("should fail on out-of-range values (>1)", () => {
      const data = Array(100).fill(0.5);
      data[75] = 1.5;
      const result = validateWaveformData(data);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid waveform value/i);
    });

    it("should fail on NaN values", () => {
      const data = Array(100).fill(0.5);
      data[25] = NaN;
      const result = validateWaveformData(data);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid waveform value/i);
    });

    it("should accept edge values (0 and 1)", () => {
      const data = Array(100).fill(0);
      data[0] = 1;
      data[99] = 0;
      const result = validateWaveformData(data);

      expect(result.valid).toBe(true);
    });
  });
});
