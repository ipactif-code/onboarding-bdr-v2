import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("notificationPreferences.ts - User Notification Settings", () => {
  describe("notificationPreferences.getPreferences query", () => {
    it("should return defaults when no preferences exist", async () => {
      const t = convexTest(schema);

      // Arrange - User without preferences
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

      // Act
      const prefs = await asUser.query(
        api.notificationPreferences.getPreferences,
        {}
      );

      // Assert - Check default values
      expect(prefs).toEqual({
        mentions: true,
        directMessages: true,
        channelMessages: true,
        desktopNotifications: false,
        soundEnabled: true,
        doNotDisturbStart: null,
        doNotDisturbEnd: null,
      });
    });

    it("should return stored preferences when they exist", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - User with custom preferences
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("notificationPreferences", {
          userId,
          enablePush: true,
          enableSound: false,
          enableDesktop: true,
          dndEnabled: true,
          dndStart: "22:00",
          dndEnd: "08:00",
          defaultChannelLevel: "mentions",
          defaultDmLevel: "all",
          keywords: [],
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const prefs = await asUser.query(
        api.notificationPreferences.getPreferences,
        {}
      );

      // Assert
      expect(prefs).toEqual({
        mentions: true, // defaultChannelLevel is "mentions"
        directMessages: true, // defaultDmLevel is "all"
        channelMessages: false, // defaultChannelLevel is not "all"
        desktopNotifications: true, // enableDesktop
        soundEnabled: false, // enableSound
        doNotDisturbStart: 22, // Converted from "22:00"
        doNotDisturbEnd: 8, // Converted from "08:00"
      });
    });

    it("should map schema fields to simplified API format", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - Test different defaultChannelLevel values
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("notificationPreferences", {
          userId,
          enablePush: true,
          enableSound: true,
          enableDesktop: false,
          dndEnabled: false,
          defaultChannelLevel: "all",
          defaultDmLevel: "none",
          keywords: [],
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act
      const prefs = await asUser.query(
        api.notificationPreferences.getPreferences,
        {}
      );

      // Assert
      expect(prefs.mentions).toBe(true); // "all" includes mentions
      expect(prefs.channelMessages).toBe(true); // "all" means all messages
      expect(prefs.directMessages).toBe(false); // defaultDmLevel is "none"
    });
  });

  describe("notificationPreferences.updatePreferences mutation", () => {
    it("should create new preferences if none exist", async () => {
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
      const result = await asUser.mutation(
        api.notificationPreferences.updatePreferences,
        {
          desktopNotifications: true,
          soundEnabled: false,
        }
      );

      // Assert
      expect(result.success).toBe(true);

      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs).toBeDefined();
        expect(prefs?.enableDesktop).toBe(true);
        expect(prefs?.enableSound).toBe(false);
      });
    });

    it("should update existing preferences", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;
      let prefsId!: Id<"notificationPreferences">;

      // Arrange - Existing preferences
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        prefsId = await ctx.db.insert("notificationPreferences", {
          userId,
          enablePush: true,
          enableSound: true,
          enableDesktop: false,
          dndEnabled: false,
          defaultChannelLevel: "all",
          defaultDmLevel: "all",
          keywords: [],
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act - Update sound preference
      const result = await asUser.mutation(
        api.notificationPreferences.updatePreferences,
        {
          soundEnabled: false,
        }
      );

      // Assert
      expect(result.success).toBe(true);

      await t.run(async (ctx) => {
        const prefs = await ctx.db.get(prefsId);
        expect(prefs?.enableSound).toBe(false);
        expect(prefs?.enableDesktop).toBe(false); // Unchanged
      });
    });

    it("should validate DND hours (0-23)", async () => {
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

      // Act & Assert - Valid hours should work
      await expect(
        asUser.mutation(api.notificationPreferences.updatePreferences, {
          doNotDisturbStart: 0,
          doNotDisturbEnd: 23,
        })
      ).resolves.toEqual({ success: true });
    });

    it("should throw for invalid DND hours", async () => {
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

      // Act & Assert - Hour < 0
      await expect(
        asUser.mutation(api.notificationPreferences.updatePreferences, {
          doNotDisturbStart: -1,
        })
      ).rejects.toThrow("doNotDisturbStart must be a valid hour between 0 and 23");

      // Hour > 23
      await expect(
        asUser.mutation(api.notificationPreferences.updatePreferences, {
          doNotDisturbEnd: 24,
        })
      ).rejects.toThrow("doNotDisturbEnd must be a valid hour between 0 and 23");

      // Non-integer
      await expect(
        asUser.mutation(api.notificationPreferences.updatePreferences, {
          doNotDisturbStart: 12.5,
        })
      ).rejects.toThrow("doNotDisturbStart must be a valid hour between 0 and 23");
    });

    it("should only update provided fields (partial update)", async () => {
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

        await ctx.db.insert("notificationPreferences", {
          userId,
          enablePush: true,
          enableSound: true,
          enableDesktop: true,
          dndEnabled: false,
          defaultChannelLevel: "all",
          defaultDmLevel: "all",
          keywords: [],
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act - Update only desktopNotifications
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        desktopNotifications: false,
      });

      // Assert - Other fields unchanged
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.enableDesktop).toBe(false); // Changed
        expect(prefs?.enableSound).toBe(true); // Unchanged
        expect(prefs?.defaultChannelLevel).toBe("all"); // Unchanged
      });
    });

    it("should handle DND enabled/disabled based on start and end", async () => {
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

      // Act - Set both start and end
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        doNotDisturbStart: 22,
        doNotDisturbEnd: 8,
      });

      // Assert - DND should be enabled
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.dndEnabled).toBe(true);
        expect(prefs?.dndStart).toBe("22:00");
        expect(prefs?.dndEnd).toBe("08:00");
      });

      // Act - Set start to null
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        doNotDisturbStart: null,
      });

      // Assert - DND should be disabled
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.dndEnabled).toBe(false);
      });
    });

    it("should map channelMessages to defaultChannelLevel correctly", async () => {
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

      // Act - Enable channelMessages
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        channelMessages: true,
      });

      // Assert - defaultChannelLevel should be "all"
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.defaultChannelLevel).toBe("all");
      });

      // Act - Disable channelMessages but enable mentions
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        channelMessages: false,
        mentions: true,
      });

      // Assert - defaultChannelLevel should be "mentions"
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.defaultChannelLevel).toBe("mentions");
      });

      // Act - Disable both
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        channelMessages: false,
        mentions: false,
      });

      // Assert - defaultChannelLevel should be "none"
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.defaultChannelLevel).toBe("none");
      });
    });

    it("should map directMessages to defaultDmLevel correctly", async () => {
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

      // Act - Enable directMessages
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        directMessages: true,
      });

      // Assert - defaultDmLevel should be "all"
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.defaultDmLevel).toBe("all");
      });

      // Act - Disable directMessages
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        directMessages: false,
      });

      // Assert - defaultDmLevel should be "none"
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.defaultDmLevel).toBe("none");
      });
    });

    it("should throw if not authenticated", async () => {
      const t = convexTest(schema);

      // Act & Assert
      await expect(
        t.mutation(api.notificationPreferences.updatePreferences, {
          soundEnabled: false,
        })
      ).rejects.toThrow();
    });

    it("should handle complex preference updates", async () => {
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

      // Act - Update multiple fields at once
      const result = await asUser.mutation(
        api.notificationPreferences.updatePreferences,
        {
          mentions: true,
          directMessages: false,
          channelMessages: false,
          desktopNotifications: true,
          soundEnabled: false,
          doNotDisturbStart: 23,
          doNotDisturbEnd: 7,
        }
      );

      // Assert
      expect(result.success).toBe(true);

      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.defaultChannelLevel).toBe("mentions");
        expect(prefs?.defaultDmLevel).toBe("none");
        expect(prefs?.enableDesktop).toBe(true);
        expect(prefs?.enableSound).toBe(false);
        expect(prefs?.dndEnabled).toBe(true);
        expect(prefs?.dndStart).toBe("23:00");
        expect(prefs?.dndEnd).toBe("07:00");
      });
    });

    it("should preserve existing DND settings when updating one hour", async () => {
      const t = convexTest(schema);

      let userId!: Id<"users">;

      // Arrange - Existing preferences with DND
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "test-clerk",
          email: "test@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("notificationPreferences", {
          userId,
          enablePush: true,
          enableSound: true,
          enableDesktop: false,
          dndEnabled: true,
          dndStart: "22:00",
          dndEnd: "08:00",
          defaultChannelLevel: "all",
          defaultDmLevel: "all",
          keywords: [],
        });
      });

      const asUser = t.withIdentity({ subject: "test-clerk" });

      // Act - Update only doNotDisturbEnd
      await asUser.mutation(api.notificationPreferences.updatePreferences, {
        doNotDisturbEnd: 7,
      });

      // Assert - Start hour should be preserved
      await t.run(async (ctx) => {
        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        expect(prefs?.dndEnabled).toBe(true);
        expect(prefs?.dndStart).toBe("22:00"); // Preserved
        expect(prefs?.dndEnd).toBe("07:00"); // Updated
      });
    });
  });
});
