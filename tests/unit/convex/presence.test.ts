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
  });
});
