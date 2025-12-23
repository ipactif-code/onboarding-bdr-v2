import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import { Id } from "../../../../convex/_generated/dataModel";

describe("dm/participantMutations.ts - Participant Mutations", () => {
  describe("leaveGroup mutation", () => {
    it("should leave group successfully", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.directMessages.leaveGroup, {
        conversationId,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.leftAt).toBeDefined();
        expect(participant?.leftAt).toBeGreaterThan(0);
      });
    });

    it("should fail if conversation is 1:1", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.leaveGroup, {
          conversationId,
        })
      ).rejects.toThrow("group conversations");
    });

    it("should fail if user is not a participant", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.leaveGroup, {
          conversationId,
        })
      ).rejects.toThrow("not a participant");
    });

    it("should set leftAt timestamp", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      const beforeTime = Date.now();

      // Act
      await asUser.mutation(api.directMessages.leaveGroup, {
        conversationId,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.leftAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should allow rejoining later via addParticipant", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: creatorId,
          joinedAt: Date.now(),
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });
      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act - user leaves
      await asUser.mutation(api.directMessages.leaveGroup, {
        conversationId,
      });

      // Assert - user has left
      await t.run(async (ctx) => {
        const participantAfterLeave = await ctx.db.get(participantId);
        expect(participantAfterLeave?.leftAt).toBeDefined();
      });

      // Act - creator adds user back
      await asCreator.mutation(api.dm.groupMutations.addParticipant, {
        conversationId,
        userId,
      });

      // Assert - user rejoined
      await t.run(async (ctx) => {
        const participantAfterRejoin = await ctx.db.get(participantId);
        expect(participantAfterRejoin?.leftAt).toBeUndefined();
      });
    });

    it("should allow last person to leave", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert - should succeed
      await expect(
        asUser.mutation(api.directMessages.leaveGroup, {
          conversationId,
        })
      ).resolves.not.toThrow();
    });

    it("should keep conversation record after leaving", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.directMessages.leaveGroup, {
        conversationId,
      });

      // Assert - conversation still exists
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation).toBeDefined();
      });
    });

    it("should fail if user has already left", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
          leftAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.leaveGroup, {
          conversationId,
        })
      ).rejects.toThrow("already left");
    });
  });

  describe("updateGroupName mutation", () => {
    it("should update name successfully", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Old Name",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.directMessages.updateGroupName, {
        conversationId,
        name: "New Name",
      });

      // Assert
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation?.name).toBe("New Name");
      });
    });

    it("should fail if user is not a participant", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.updateGroupName, {
          conversationId,
          name: "New Name",
        })
      ).rejects.toThrow("not an active participant");
    });

    it("should fail if conversation is 1:1", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.updateGroupName, {
          conversationId,
          name: "New Name",
        })
      ).rejects.toThrow("group conversations");
    });

    it("should fail with empty name", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.updateGroupName, {
          conversationId,
          name: "",
        })
      ).rejects.toThrow("cannot be empty");
    });

    it("should fail with name exceeding 100 characters", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      const longName = "a".repeat(101);

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.updateGroupName, {
          conversationId,
          name: longName,
        })
      ).rejects.toThrow("cannot exceed 100 characters");
    });

    it("should trim whitespace from name", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.directMessages.updateGroupName, {
        conversationId,
        name: "  Trimmed Name  ",
      });

      // Assert
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation?.name).toBe("Trimmed Name");
      });
    });

    it("should update updatedAt timestamp", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Old Name",
          createdAt: Date.now(),
          updatedAt: Date.now() - 10000,
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      const beforeTime = Date.now();

      // Act
      await asUser.mutation(api.directMessages.updateGroupName, {
        conversationId,
        name: "New Name",
      });

      // Assert
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation?.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should fail if participant has left", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
          leftAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.updateGroupName, {
          conversationId,
          name: "New Name",
        })
      ).rejects.toThrow("not an active participant");
    });
  });

  describe("hide mutation", () => {
    it("should hide conversation successfully", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.directMessages.hide, {
        conversationId,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.leftAt).toBeDefined();
      });
    });

    it("should fail if not a participant", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.hide, {
          conversationId,
        })
      ).rejects.toThrow("not a participant");
    });

    it("should set leftAt timestamp", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      const beforeTime = Date.now();

      // Act
      await asUser.mutation(api.directMessages.hide, {
        conversationId,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.leftAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should not affect other participants", async () => {
      const t = convexTest(schema);

      let user1Id!: Id<"users">;
      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participant2Id!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
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

        participant2Id = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asUser1 = t.withIdentity({ subject: "user1-clerk" });

      // Act - user1 hides
      await asUser1.mutation(api.directMessages.hide, {
        conversationId,
      });

      // Assert - user2 is unaffected
      await t.run(async (ctx) => {
        const participant2 = await ctx.db.get(participant2Id);
        expect(participant2?.leftAt).toBeUndefined();
      });
    });

    it("should be idempotent if already hidden", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
          leftAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act & Assert - should not throw
      await expect(
        asUser.mutation(api.directMessages.hide, {
          conversationId,
        })
      ).resolves.not.toThrow();
    });

    it("should work for group conversations", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          name: "Test Group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      await asUser.mutation(api.directMessages.hide, {
        conversationId,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.leftAt).toBeDefined();
      });
    });

    it("should fail if conversation not found", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      const fakeId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as any;

      // Act & Assert
      await expect(
        asUser.mutation(api.directMessages.hide, {
          conversationId: fakeId,
        })
      ).rejects.toThrow();
    });
  });

  describe("toggleFavorite mutation", () => {
    it("should set isFavorite to true when false", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
          isFavorite: false, // Initially not favorite
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const newState = await asUser.mutation(api.directMessages.toggleFavorite, {
        conversationId,
      });

      // Assert
      expect(newState).toBe(true);

      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.isFavorite).toBe(true);
      });
    });

    it("should set isFavorite to false when true", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;
      let participantId!: Id<"conversationParticipants">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now(),
          isFavorite: true, // Initially favorite
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const newState = await asUser.mutation(api.directMessages.toggleFavorite, {
        conversationId,
      });

      // Assert
      expect(newState).toBe(false);

      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.isFavorite).toBe(false);
      });
    });

    it("should throw error for non-participants", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      // Arrange
      await t.run(async (ctx) => {
        const otherUserId = await ctx.db.insert("users", {
          clerkId: "other-clerk",
          email: "other@example.com",
          name: "Other User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "non-participant-clerk",
          email: "nonparticipant@example.com",
          name: "Non Participant",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "direct",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        // Only other user is participant
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: otherUserId,
          joinedAt: Date.now(),
        });
      });

      const asNonParticipant = t.withIdentity({ subject: "non-participant-clerk" });

      // Act & Assert
      await expect(
        asNonParticipant.mutation(api.directMessages.toggleFavorite, {
          conversationId,
        })
      ).rejects.toThrow("not a participant");
    });

    it("should throw error for users who have left the conversation", async () => {
      const t = convexTest(schema);

      let conversationId!: Id<"conversations">;

      // Arrange
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "left-user-clerk",
          email: "left@example.com",
          name: "Left User",
          role: "user",
          status: "online",
        });

        conversationId = await ctx.db.insert("conversations", {
          type: "group",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: true,
        });

        // User has left
        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId,
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          isFavorite: true, // Was favorite before leaving
        });
      });

      const asLeftUser = t.withIdentity({ subject: "left-user-clerk" });

      // Act & Assert
      await expect(
        asLeftUser.mutation(api.directMessages.toggleFavorite, {
          conversationId,
        })
      ).rejects.toThrow("left");
    });
  });
});
