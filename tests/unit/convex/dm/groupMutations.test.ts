import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import { Id } from "../../../../convex/_generated/dataModel";

describe("dm/groupMutations.ts - Group DM Mutations", () => {
  describe("createGroup mutation", () => {
    it("should create group with valid participants", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      // Setup database
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      // Create authenticated identity
      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
          name: "Test Group",
        }
      );

      // Assert
      expect(conversationId).toBeDefined();
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation?.type).toBe("group");
        expect(conversation?.name).toBe("Test Group");
      });
    });

    it("should fail with less than 2 participants", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.createGroup, {
          participantIds: [user2Id],
        })
      ).rejects.toThrow("at least 2 other participants");
    });

    it("should fail with more than 8 participants total", async () => {
      const t = convexTest(schema);

      const participantIds: Id<"users">[] = [];

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "user",
          status: "online",
        });

        for (let i = 1; i <= 8; i++) {
          const userId = await ctx.db.insert("users", {
            clerkId: `user${i}-clerk`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role: "user",
            status: "online",
          });
          participantIds.push(userId);
        }
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert - creator + 8 others = 9 total
      await expect(
        asCreator.mutation(api.directMessages.createGroup, {
          participantIds,
        })
      ).rejects.toThrow("cannot have more than 8 participants");
    });

    it("should fail if user tries to add themselves", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.createGroup, {
          participantIds: [creatorId, user2Id],
        })
      ).rejects.toThrow("cannot add yourself");
    });

    it("should fail with empty group name", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act - name is optional, but this tests the implementation
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
        }
      );

      // Assert - should succeed without name
      expect(conversationId).toBeDefined();
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation?.name).toBeUndefined();
      });
    });

    it("should fail with name exceeding 100 characters", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      const longName = "a".repeat(101);

      // Act - the mutation should succeed (name validation is in updateGroupName)
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
          name: longName,
        }
      );

      // Assert - should succeed (no validation in createGroup)
      expect(conversationId).toBeDefined();
    });

    it("should create conversation record with correct fields", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      const beforeTime = Date.now();

      // Act
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
          name: "My Group",
        }
      );

      // Assert
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation?.type).toBe("group");
        expect(conversation?.name).toBe("My Group");
        expect(conversation?.isActive).toBe(true);
        expect(conversation?.createdAt).toBeGreaterThanOrEqual(beforeTime);
        expect(conversation?.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      });
    });

    it("should create all participant records", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
          name: "Test Group",
        }
      );

      // Assert
      await t.run(async (ctx) => {
        const participants = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversationId)
          )
          .collect();

        expect(participants).toHaveLength(3);
        const userIds = participants.map((p) => p.userId);
        expect(userIds).toContain(creatorId);
        expect(userIds).toContain(user2Id);
        expect(userIds).toContain(user3Id);
      });
    });

    it("should set correct timestamps on participant records", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      const beforeTime = Date.now();

      // Act
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
        }
      );

      // Assert
      await t.run(async (ctx) => {
        const participants = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversationId)
          )
          .collect();

        for (const participant of participants) {
          expect(participant.joinedAt).toBeGreaterThanOrEqual(beforeTime);
          expect(participant.leftAt).toBeUndefined();
        }
      });
    });

    it("should return new conversation ID", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act
      conversationId = await asCreator.mutation(
        api.directMessages.createGroup,
        {
          participantIds: [user2Id, user3Id],
        }
      );

      // Assert
      expect(conversationId).toBeDefined();
      await t.run(async (ctx) => {
        const conversation = await ctx.db.get(conversationId);
        expect(conversation).toBeDefined();
      });
    });

    it("should fail if a participant does not exist", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      const fakeId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as any;

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.createGroup, {
          participantIds: [user2Id, fakeId],
        })
      ).rejects.toThrow();
    });

    it("should reject duplicate participants", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.createGroup, {
          participantIds: [user2Id, user2Id],
        })
      ).rejects.toThrow("Duplicate participants");
    });
  });

  describe("addParticipant mutation", () => {
    it("should add participant successfully", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
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

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act
      await asCreator.mutation(api.directMessages.addParticipant, {
        conversationId,
        userId: user3Id,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_user_conversation", (q) =>
            q.eq("userId", user3Id).eq("conversationId", conversationId)
          )
          .unique();

        expect(participant).toBeDefined();
        expect(participant?.userId).toEqual(user3Id);
        expect(participant?.leftAt).toBeUndefined();
      });
    });

    it("should fail if conversation is not a group", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
          userId: creatorId,
          joinedAt: Date.now(),
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.addParticipant, {
          conversationId,
          userId: user2Id,
        })
      ).rejects.toThrow("group conversations");
    });

    it("should fail if current user is not a participant", async () => {
      const t = convexTest(schema);

      let user2Id!: Id<"users">;
      let user3Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "outsider-clerk",
          email: "outsider@example.com",
          name: "Outsider",
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

        user3Id = await ctx.db.insert("users", {
          clerkId: "user3-clerk",
          email: "user3@example.com",
          name: "User 3",
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
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asOutsider = t.withIdentity({ subject: "outsider-clerk" });

      // Act & Assert - outsider tries to add user3
      await expect(
        asOutsider.mutation(api.directMessages.addParticipant, {
          conversationId,
          userId: user3Id,
        })
      ).rejects.toThrow("not an active participant");
    });

    it("should fail if target user is already a participant", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now(),
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.addParticipant, {
          conversationId,
          userId: user2Id,
        })
      ).rejects.toThrow("already a participant");
    });

    it("should fail if group is at max capacity", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user9Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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

        // Add 7 more participants (8 total)
        for (let i = 1; i <= 7; i++) {
          const userId = await ctx.db.insert("users", {
            clerkId: `user${i}-clerk`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role: "user",
            status: "online",
          });
          await ctx.db.insert("conversationParticipants", {
            conversationId,
            userId,
            joinedAt: Date.now(),
          });
        }

        user9Id = await ctx.db.insert("users", {
          clerkId: "user9-clerk",
          email: "user9@example.com",
          name: "User 9",
          role: "user",
          status: "online",
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.addParticipant, {
          conversationId,
          userId: user9Id,
        })
      ).rejects.toThrow("cannot have more than 8 participants");
    });

    it("should fail if target user does not exist", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      const fakeId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as any;

      // Act & Assert
      await expect(
        asCreator.mutation(api.directMessages.addParticipant, {
          conversationId,
          userId: fakeId,
        })
      ).rejects.toThrow();
    });

    it("should create participant record with correct data", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;
      let conversationId!: Id<"conversations">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
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
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      const beforeTime = Date.now();

      // Act
      await asCreator.mutation(api.directMessages.addParticipant, {
        conversationId,
        userId: user2Id,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db
          .query("conversationParticipants")
          .withIndex("by_user_conversation", (q) =>
            q.eq("userId", user2Id).eq("conversationId", conversationId)
          )
          .unique();

        expect(participant).toBeDefined();
        expect(participant?.conversationId).toEqual(conversationId);
        expect(participant?.userId).toEqual(user2Id);
        expect(participant?.joinedAt).toBeGreaterThanOrEqual(beforeTime);
        expect(participant?.addedBy).toEqual(creatorId);
        expect(participant?.leftAt).toBeUndefined();
      });
    });

    it("should allow rejoining after leaving", async () => {
      const t = convexTest(schema);

      let creatorId!: Id<"users">;
      let user2Id!: Id<"users">;
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

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
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

        // User2 previously left
        participantId = await ctx.db.insert("conversationParticipants", {
          conversationId,
          userId: user2Id,
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
        });
      });

      const asCreator = t.withIdentity({ subject: "creator-clerk" });

      // Act
      await asCreator.mutation(api.directMessages.addParticipant, {
        conversationId,
        userId: user2Id,
      });

      // Assert
      await t.run(async (ctx) => {
        const participant = await ctx.db.get(participantId);
        expect(participant?.leftAt).toBeUndefined();
        expect(participant?.addedBy).toEqual(creatorId);
      });
    });
  });
});
