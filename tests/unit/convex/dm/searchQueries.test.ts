import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import { Id } from "../../../../convex/_generated/dataModel";

describe("dm/searchQueries.ts - User Search", () => {
  describe("searchUsers query", () => {
    it("should find users by name", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      // Setup database
      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "john-clerk",
          email: "john@example.com",
          name: "John Doe",
          avatarUrl: "https://example.com/john.jpg",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "jane-clerk",
          email: "jane@example.com",
          name: "Jane Smith",
          role: "user",
          status: "away",
        });
      });

      // Create authenticated identity
      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const result = await asCurrentUser.query(api.directMessages.searchUsers, {
        query: "john",
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        _id: user2Id!,
        name: "John Doe",
        email: "john@example.com",
        avatarUrl: "https://example.com/john.jpg",
        status: "online",
      });
    });

    it("should be case insensitive", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "alice-clerk",
          email: "alice@example.com",
          name: "Alice Johnson",
          role: "user",
          status: "online",
        });
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const resultLower = await asCurrentUser.query(
        api.directMessages.searchUsers,
        { query: "alice" }
      );
      const resultUpper = await asCurrentUser.query(
        api.directMessages.searchUsers,
        { query: "ALICE" }
      );
      const resultMixed = await asCurrentUser.query(
        api.directMessages.searchUsers,
        { query: "AlIcE" }
      );

      // Assert
      expect(resultLower).toHaveLength(1);
      expect(resultUpper).toHaveLength(1);
      expect(resultMixed).toHaveLength(1);
      expect(resultLower[0]!._id).toEqual(user2Id!);
      expect(resultUpper[0]!._id).toEqual(user2Id!);
      expect(resultMixed[0]!._id).toEqual(user2Id!);
    });

    it("should exclude current user from results", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Test User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "other-clerk",
          email: "other@example.com",
          name: "Other Test User",
          role: "user",
          status: "online",
        });
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const result = await asCurrentUser.query(api.directMessages.searchUsers, {
        query: "test",
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Other Test User");
    });

    it("should limit results to specified limit", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        // Create 15 users with "User" in their name
        for (let i = 1; i <= 15; i++) {
          await ctx.db.insert("users", {
            clerkId: `user${i}-clerk`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            role: "user",
            status: "online",
          });
        }
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const resultDefault = await asCurrentUser.query(
        api.directMessages.searchUsers,
        { query: "User" }
      );
      const resultLimit5 = await asCurrentUser.query(
        api.directMessages.searchUsers,
        { query: "User", limit: 5 }
      );

      // Assert
      expect(resultDefault).toHaveLength(10); // Default limit
      expect(resultLimit5).toHaveLength(5);
    });

    it("should return empty array for empty query", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "other-clerk",
          email: "other@example.com",
          name: "Other User",
          role: "user",
          status: "online",
        });
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const result = await asCurrentUser.query(api.directMessages.searchUsers, {
        query: "",
      });

      // Assert
      expect(result).toEqual([]);
    });

    it("should search by email as well as name", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "special-clerk",
          email: "special@company.com",
          name: "Bob",
          role: "user",
          status: "online",
        });
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const result = await asCurrentUser.query(api.directMessages.searchUsers, {
        query: "company",
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]!._id).toEqual(user2Id!);
      expect(result[0]!.email).toBe("special@company.com");
    });

    it("should trim whitespace from query", async () => {
      const t = convexTest(schema);

      let user2Id: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        user2Id = await ctx.db.insert("users", {
          clerkId: "alice-clerk",
          email: "alice@example.com",
          name: "Alice",
          role: "user",
          status: "online",
        });
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const result = await asCurrentUser.query(api.directMessages.searchUsers, {
        query: "  alice  ",
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]!._id).toEqual(user2Id!);
    });

    it("should return users with all status types", async () => {
      const t = convexTest(schema);

      let onlineId: Id<"users">;
      let awayId: Id<"users">;
      let dndId: Id<"users">;
      let offlineId: Id<"users">;

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "current-user-clerk",
          email: "current@example.com",
          name: "Current User",
          role: "user",
          status: "online",
        });

        onlineId = await ctx.db.insert("users", {
          clerkId: "online-clerk",
          email: "online@example.com",
          name: "Test Online",
          role: "user",
          status: "online",
        });

        awayId = await ctx.db.insert("users", {
          clerkId: "away-clerk",
          email: "away@example.com",
          name: "Test Away",
          role: "user",
          status: "away",
        });

        dndId = await ctx.db.insert("users", {
          clerkId: "dnd-clerk",
          email: "dnd@example.com",
          name: "Test DND",
          role: "user",
          status: "dnd",
        });

        offlineId = await ctx.db.insert("users", {
          clerkId: "offline-clerk",
          email: "offline@example.com",
          name: "Test Offline",
          role: "user",
          status: "offline",
        });
      });

      const asCurrentUser = t.withIdentity({ subject: "current-user-clerk" });

      // Act
      const result = await asCurrentUser.query(api.directMessages.searchUsers, {
        query: "test",
      });

      // Assert
      expect(result).toHaveLength(4);
      const ids = result.map((r) => r._id);
      expect(ids).toContain(onlineId!);
      expect(ids).toContain(awayId!);
      expect(ids).toContain(dndId!);
      expect(ids).toContain(offlineId!);
    });
  });
});
