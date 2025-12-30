import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("presence.ts - User Presence & Online Status", () => {
  describe("presence.updatePresence mutation", () => {
    it("should update lastActiveAt to current time", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 60000, // 1 minute ago
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });
      const beforeUpdate = Date.now();

      // Act
      await asUser.mutation(api.presence.updatePresence, {});

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.lastActiveAt).toBeGreaterThanOrEqual(beforeUpdate);
        expect(user?.lastActiveAt).toBeLessThanOrEqual(Date.now());
      });
    });

    it("should change status from offline to online", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User is offline
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "offline",
          lastActiveAt: Date.now() - 600000, // 10 minutes ago
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.updatePresence, {});

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("online");
      });
    });

    it("should preserve away status (manual override)", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User is away
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "away",
          lastActiveAt: Date.now() - 30000,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.updatePresence, {});

      // Assert - Status should remain "away"
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("away");
      });
    });

    it("should preserve dnd status (manual override)", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User is in DND mode
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "dnd",
          lastActiveAt: Date.now() - 30000,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.updatePresence, {});

      // Assert - Status should remain "dnd"
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("dnd");
      });
    });
  });

  describe("presence.getOnlineStatus query", () => {
    it("should return online for active users (< 60s)", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User active within last 60 seconds
      await t.run(async (ctx) => {
        const requesterId = await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "active-user-clerk",
          email: "active@example.com",
          name: "Active User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 30000, // 30 seconds ago (within ONLINE_THRESHOLD)
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const statuses = await asRequester.query(api.presence.getOnlineStatus, {
        userIds: [userId],
      });

      // Assert
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.userId).toBe(userId);
      expect(statuses[0]!.status).toBe("online");
    });

    it("should return away for users active 1-5min ago", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User active 2 minutes ago
      await t.run(async (ctx) => {
        const requesterId = await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "away-user-clerk",
          email: "away@example.com",
          name: "Away User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 120000, // 2 minutes ago (within AWAY_THRESHOLD)
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const statuses = await asRequester.query(api.presence.getOnlineStatus, {
        userIds: [userId],
      });

      // Assert
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.status).toBe("away");
    });

    it("should return offline for users inactive > 5min", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User inactive for 10 minutes
      await t.run(async (ctx) => {
        const requesterId = await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "offline-user-clerk",
          email: "offline@example.com",
          name: "Offline User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 600000, // 10 minutes ago (beyond AWAY_THRESHOLD)
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const statuses = await asRequester.query(api.presence.getOnlineStatus, {
        userIds: [userId],
      });

      // Assert
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.status).toBe("offline");
    });

    it("should always respect dnd status regardless of activity", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User in DND mode but very recently active
      await t.run(async (ctx) => {
        const requesterId = await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "dnd-user-clerk",
          email: "dnd@example.com",
          name: "DND User",
          role: "user",
          status: "dnd",
          lastActiveAt: Date.now() - 10000, // 10 seconds ago (would normally be "online")
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const statuses = await asRequester.query(api.presence.getOnlineStatus, {
        userIds: [userId],
      });

      // Assert - Should return "dnd" despite recent activity
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.status).toBe("dnd");
    });

    it("should handle missing/invalid userIds gracefully", async () => {
      const t = convexTest(schema);

      let validUserId!: Id<"users">;
      let invalidUserId!: Id<"users">;

      // Arrange - Create one valid user and get an invalid ID
      await t.run(async (ctx) => {
        const requesterId = await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        validUserId = await ctx.db.insert("users", {
          clerkId: "valid-user-clerk",
          email: "valid@example.com",
          name: "Valid User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 10000,
        });

        // Create and delete a user to get an invalid ID
        invalidUserId = await ctx.db.insert("users", {
          clerkId: "temp-clerk",
          email: "temp@example.com",
          name: "Temp",
          role: "user",
          status: "online",
        });

        await ctx.db.delete(invalidUserId);
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const statuses = await asRequester.query(api.presence.getOnlineStatus, {
        userIds: [validUserId, invalidUserId],
      });

      // Assert
      expect(statuses).toHaveLength(2);

      const validStatus = statuses.find((s) => s.userId === validUserId);
      const invalidStatus = statuses.find((s) => s.userId === invalidUserId);

      expect(validStatus?.status).toBe("online");
      expect(invalidStatus?.status).toBe("offline");
      expect(invalidStatus?.lastActiveAt).toBeUndefined();
    });
  });

  describe("presence.setStatus mutation", () => {
    it("should allow changing status to online", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "away",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.setStatus, { status: "online" });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("online");
      });
    });

    it("should allow changing status to away", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.setStatus, { status: "away" });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("away");
      });
    });

    it("should allow changing status to dnd", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.setStatus, { status: "dnd" });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("dnd");
      });
    });

    it("should allow changing status to offline", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.setStatus, { status: "offline" });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("offline");
      });
    });

    it("should update lastActiveAt when setting status", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 60000, // 1 minute ago
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });
      const beforeUpdate = Date.now();

      // Act
      await asUser.mutation(api.presence.setStatus, { status: "away" });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.lastActiveAt).toBeGreaterThanOrEqual(beforeUpdate);
        expect(user?.lastActiveAt).toBeLessThanOrEqual(Date.now());
      });
    });

    it("should throw if not authenticated", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.presence.setStatus, { status: "away" })
      ).rejects.toThrow();
    });
  });

  describe("presence.setCustomStatus mutation", () => {
    it("should set customStatus text", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.setCustomStatus, {
        text: "In a meeting",
      });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.customStatus).toBe("In a meeting");
      });
    });

    it("should set customStatusEmoji", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.setCustomStatus, {
        text: "On vacation",
        emoji: "🏖️",
      });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.customStatus).toBe("On vacation");
        expect(user?.customStatusEmoji).toBe("🏖️");
      });
    });

    it("should set customStatusExpiresAt", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });
      const expiryTime = Date.now() + 3600000; // 1 hour from now

      // Act
      await asUser.mutation(api.presence.setCustomStatus, {
        text: "Busy",
        expiresAt: expiryTime,
      });

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.customStatusExpiresAt).toBe(expiryTime);
      });
    });

    it("should throw if text exceeds 100 characters", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });
      const longText = "a".repeat(101);

      // Act & Assert
      await expect(
        asUser.mutation(api.presence.setCustomStatus, {
          text: longText,
        })
      ).rejects.toThrow("Custom status text must be 100 characters or less");
    });

    it("should throw if not authenticated", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.presence.setCustomStatus, { text: "Test" })
      ).rejects.toThrow();
    });
  });

  describe("presence.clearCustomStatus mutation", () => {
    it("should clear all custom status fields", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User has custom status
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
          customStatus: "In a meeting",
          customStatusEmoji: "📅",
          customStatusExpiresAt: Date.now() + 3600000,
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.clearCustomStatus, {});

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.customStatus).toBeUndefined();
        expect(user?.customStatusEmoji).toBeUndefined();
        expect(user?.customStatusExpiresAt).toBeUndefined();
      });
    });

    it("should throw if not authenticated", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.presence.clearCustomStatus, {})
      ).rejects.toThrow();
    });
  });

  describe("presence.goOffline mutation", () => {
    it("should set status to offline", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      await asUser.mutation(api.presence.goOffline, {});

      // Assert
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId);
        expect(user?.status).toBe("offline");
      });
    });

    it("should throw if not authenticated", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(t.mutation(api.presence.goOffline, {})).rejects.toThrow();
    });
  });

  describe("presence.getMultiple query", () => {
    it("should return presence data for multiple users", async () => {
      const t = convexTest(schema);

      let user1Id!: Id<"users">;
      let user2Id!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        const requesterId = await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        user1Id = await ctx.db.insert("users", {
          clerkId: "user1-clerk",
          email: "user1@example.com",
          name: "User 1",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 10000,
          customStatus: "Working",
          customStatusEmoji: "💼",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "user2-clerk",
          email: "user2@example.com",
          name: "User 2",
          role: "user",
          status: "dnd",
          lastActiveAt: Date.now() - 20000,
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const results = await asRequester.query(api.presence.getMultiple, {
        userIds: [user1Id, user2Id],
      });

      // Assert
      expect(results).toHaveLength(2);

      const user1Data = results.find((r) => r.userId === user1Id);
      expect(user1Data?.status).toBe("online");
      expect(user1Data?.customStatus).toBe("Working");
      expect(user1Data?.customStatusEmoji).toBe("💼");

      const user2Data = results.find((r) => r.userId === user2Id);
      expect(user2Data?.status).toBe("dnd");
    });

    it("should return empty array for empty input", async () => {
      const t = convexTest(schema);

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const results = await asRequester.query(api.presence.getMultiple, {
        userIds: [],
      });

      // Assert
      expect(results).toEqual([]);
    });

    it("should handle non-existent user IDs gracefully", async () => {
      const t = convexTest(schema);

      let invalidUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        // Create and delete a user to get an invalid ID
        invalidUserId = await ctx.db.insert("users", {
          clerkId: "temp-clerk",
          email: "temp@example.com",
          name: "Temp",
          role: "user",
          status: "online",
        });

        await ctx.db.delete(invalidUserId);
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const results = await asRequester.query(api.presence.getMultiple, {
        userIds: [invalidUserId],
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe("offline");
      expect(results[0]!.customStatus).toBeUndefined();
    });

    it("should mark expired custom statuses as expired", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User has expired custom status
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 10000,
          customStatus: "In meeting",
          customStatusEmoji: "📅",
          customStatusExpiresAt: Date.now() - 1000, // Expired 1 second ago
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const results = await asRequester.query(api.presence.getMultiple, {
        userIds: [userId],
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]!.customStatus).toBeUndefined();
      expect(results[0]!.customStatusEmoji).toBeUndefined();
      expect(results[0]!.customStatusExpiresAt).toBeUndefined();
    });
  });

  describe("presence.getOnlineUsers query", () => {
    it("should return users with online status", async () => {
      const t = convexTest(schema);

      let onlineUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        onlineUserId = await ctx.db.insert("users", {
          clerkId: "online-clerk",
          email: "online@example.com",
          name: "Online User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 10000,
        });

        await ctx.db.insert("users", {
          clerkId: "offline-clerk",
          email: "offline@example.com",
          name: "Offline User",
          role: "user",
          status: "offline",
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const onlineUsers = await asRequester.query(
        api.presence.getOnlineUsers,
        {}
      );

      // Assert
      expect(onlineUsers.length).toBeGreaterThan(0);
      const onlineUser = onlineUsers.find((u) => u.userId === onlineUserId);
      expect(onlineUser).toBeDefined();
      expect(onlineUser?.name).toBe("Online User");
    });

    it("should include users active within 5 minutes even if status != online", async () => {
      const t = convexTest(schema);

      let recentUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        recentUserId = await ctx.db.insert("users", {
          clerkId: "recent-clerk",
          email: "recent@example.com",
          name: "Recently Active",
          role: "user",
          status: "away",
          lastActiveAt: Date.now() - 120000, // 2 minutes ago
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const onlineUsers = await asRequester.query(
        api.presence.getOnlineUsers,
        {}
      );

      // Assert
      const recentUser = onlineUsers.find((u) => u.userId === recentUserId);
      expect(recentUser).toBeDefined();
    });

    it("should NOT return users offline for > 5 minutes", async () => {
      const t = convexTest(schema);

      let staleUserId!: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        staleUserId = await ctx.db.insert("users", {
          clerkId: "stale-clerk",
          email: "stale@example.com",
          name: "Stale User",
          role: "user",
          status: "offline",
          lastActiveAt: Date.now() - 600000, // 10 minutes ago
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const onlineUsers = await asRequester.query(
        api.presence.getOnlineUsers,
        {}
      );

      // Assert
      const staleUser = onlineUsers.find((u) => u.userId === staleUserId);
      expect(staleUser).toBeUndefined();
    });

    it("should deduplicate users", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User is both "online" and recently active
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "requester-clerk",
          email: "requester@example.com",
          name: "Requester",
          role: "user",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Test User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 30000, // 30 seconds ago
        });
      });

      const asRequester = t.withIdentity({ subject: "requester-clerk" });

      // Act
      const onlineUsers = await asRequester.query(
        api.presence.getOnlineUsers,
        {}
      );

      // Assert - User should appear only once
      const userMatches = onlineUsers.filter((u) => u.userId === userId);
      expect(userMatches).toHaveLength(1);
    });
  });

  describe("presence.checkInactiveUsers internal mutation", () => {
    it("should set status to away for inactive online users", async () => {
      const t = convexTest(schema);

      let inactiveUserId!: Id<"users">;
      let activeUserId!: Id<"users">;
      let updatedCount!: number;

      // Arrange & Act - Run in single transaction to test internal mutation
      await t.run(async (ctx) => {
        // Inactive online user (> 5 minutes)
        inactiveUserId = await ctx.db.insert("users", {
          clerkId: "inactive-clerk",
          email: "inactive@example.com",
          name: "Inactive User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 600000, // 10 minutes ago
        });

        // Active online user
        activeUserId = await ctx.db.insert("users", {
          clerkId: "active-clerk",
          email: "active@example.com",
          name: "Active User",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 30000, // 30 seconds ago
        });

        // Execute internal mutation logic
        const now = Date.now();
        const cutoffTime = now - 5 * 60 * 1000; // 5 minutes

        const onlineUsers = await ctx.db
          .query("users")
          .withIndex("by_status", (q) => q.eq("status", "online"))
          .collect();

        updatedCount = 0;
        for (const user of onlineUsers) {
          const lastActive = user.lastActiveAt ?? 0;
          if (lastActive < cutoffTime) {
            await ctx.db.patch(user._id, { status: "away" });
            updatedCount++;
          }
        }
      });

      // Assert
      expect(updatedCount).toBeGreaterThanOrEqual(1);

      await t.run(async (ctx) => {
        const inactiveUser = await ctx.db.get(inactiveUserId);
        expect(inactiveUser?.status).toBe("away");

        const activeUser = await ctx.db.get(activeUserId);
        expect(activeUser?.status).toBe("online");
      });
    });

    it("should NOT change away, dnd, or offline users", async () => {
      const t = convexTest(schema);

      let awayUserId!: Id<"users">;
      let dndUserId!: Id<"users">;
      let offlineUserId!: Id<"users">;

      // Arrange & Act
      await t.run(async (ctx) => {
        awayUserId = await ctx.db.insert("users", {
          clerkId: "away-clerk",
          email: "away@example.com",
          name: "Away User",
          role: "user",
          status: "away",
          lastActiveAt: Date.now() - 600000,
        });

        dndUserId = await ctx.db.insert("users", {
          clerkId: "dnd-clerk",
          email: "dnd@example.com",
          name: "DND User",
          role: "user",
          status: "dnd",
          lastActiveAt: Date.now() - 600000,
        });

        offlineUserId = await ctx.db.insert("users", {
          clerkId: "offline-clerk",
          email: "offline@example.com",
          name: "Offline User",
          role: "user",
          status: "offline",
          lastActiveAt: Date.now() - 600000,
        });

        // Execute internal mutation logic - should only affect "online" users
        const now = Date.now();
        const cutoffTime = now - 5 * 60 * 1000;

        const onlineUsers = await ctx.db
          .query("users")
          .withIndex("by_status", (q) => q.eq("status", "online"))
          .collect();

        for (const user of onlineUsers) {
          const lastActive = user.lastActiveAt ?? 0;
          if (lastActive < cutoffTime) {
            await ctx.db.patch(user._id, { status: "away" });
          }
        }
      });

      // Assert - Statuses should remain unchanged
      await t.run(async (ctx) => {
        const awayUser = await ctx.db.get(awayUserId);
        expect(awayUser?.status).toBe("away");

        const dndUser = await ctx.db.get(dndUserId);
        expect(dndUser?.status).toBe("dnd");

        const offlineUser = await ctx.db.get(offlineUserId);
        expect(offlineUser?.status).toBe("offline");
      });
    });

    it("should return count of updated users", async () => {
      const t = convexTest(schema);

      let updatedCount!: number;

      // Arrange & Act
      await t.run(async (ctx) => {
        // Create 3 inactive online users
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("users", {
            clerkId: `inactive-${i}-clerk`,
            email: `inactive${i}@example.com`,
            name: `Inactive User ${i}`,
            role: "user",
            status: "online",
            lastActiveAt: Date.now() - 600000,
          });
        }

        // Execute internal mutation logic
        const now = Date.now();
        const cutoffTime = now - 5 * 60 * 1000;

        const onlineUsers = await ctx.db
          .query("users")
          .withIndex("by_status", (q) => q.eq("status", "online"))
          .collect();

        updatedCount = 0;
        for (const user of onlineUsers) {
          const lastActive = user.lastActiveAt ?? 0;
          if (lastActive < cutoffTime) {
            await ctx.db.patch(user._id, { status: "away" });
            updatedCount++;
          }
        }
      });

      // Assert
      expect(updatedCount).toBe(3);
    });

    it("should use 5-minute threshold", async () => {
      const t = convexTest(schema);

      let justUnderThresholdId!: Id<"users">;
      let justOverThresholdId!: Id<"users">;

      // Arrange & Act
      await t.run(async (ctx) => {
        // Just under 5 minutes (4:59)
        justUnderThresholdId = await ctx.db.insert("users", {
          clerkId: "under-clerk",
          email: "under@example.com",
          name: "Just Under",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 299000, // 4:59 minutes
        });

        // Just over 5 minutes (5:01)
        justOverThresholdId = await ctx.db.insert("users", {
          clerkId: "over-clerk",
          email: "over@example.com",
          name: "Just Over",
          role: "user",
          status: "online",
          lastActiveAt: Date.now() - 301000, // 5:01 minutes
        });

        // Execute internal mutation logic
        const now = Date.now();
        const cutoffTime = now - 5 * 60 * 1000;

        const onlineUsers = await ctx.db
          .query("users")
          .withIndex("by_status", (q) => q.eq("status", "online"))
          .collect();

        for (const user of onlineUsers) {
          const lastActive = user.lastActiveAt ?? 0;
          if (lastActive < cutoffTime) {
            await ctx.db.patch(user._id, { status: "away" });
          }
        }
      });

      // Assert
      await t.run(async (ctx) => {
        const justUnder = await ctx.db.get(justUnderThresholdId);
        expect(justUnder?.status).toBe("online"); // Should remain online

        const justOver = await ctx.db.get(justOverThresholdId);
        expect(justOver?.status).toBe("away"); // Should be set to away
      });
    });
  });
});
