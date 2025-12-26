import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import * as apiModule from "../../../convex/_generated/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = (apiModule as any).internal;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = (apiModule as any).api;
import schema from "../../../convex/schema";
import { Id } from "../../../convex/_generated/dataModel";

describe("Course Discussions - Phase 5", () => {
  // ============================================================================
  // createCourseChannel (internal mutation)
  // ============================================================================
  describe("createCourseChannel", () => {
    it("should create channel with correct type and link to course", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let creatorId: Id<"users">;

      // Arrange
      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Course Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Introduction to Testing",
          description: "Learn testing basics",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act
      const channelId = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: courseId!,
          creatorId: creatorId!,
        });
      }) as Id<"channels">;

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel).toBeDefined();
        expect(channel?.type).toBe("course");
        expect(channel?.courseId).toEqual(courseId);
        expect(channel?.creatorId).toEqual(creatorId);
        expect(channel?.isArchived).toBe(false);
        expect(channel?.memberCount).toBe(1);
        expect(channel?.name).toBe("introduction-to-testing");
        expect(channel?.description).toBe("Learn testing basics");

        // Check creator membership
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", creatorId)
          )
          .unique();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("owner");
      });
    });

    it("should slugify course title correctly for channel name", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let creatorId: Id<"users">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Course Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Advanced React & TypeScript! 🚀",
          description: "Master React and TypeScript",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act
      const channelId = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: courseId!,
          creatorId: creatorId!,
        });
      }) as Id<"channels">;

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.name).toBe("advanced-react-typescript");
      });
    });

    it("should handle duplicate channel names by appending suffix", async () => {
      const t = convexTest(schema);

      let course1Id: Id<"courses">;
      let course2Id: Id<"courses">;
      let creatorId: Id<"users">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Course Creator",
          role: "admin",
          status: "online",
        });

        course1Id = await ctx.db.insert("courses", {
          title: "Testing Fundamentals",
          description: "Course 1",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        course2Id = await ctx.db.insert("courses", {
          title: "Testing Fundamentals",
          description: "Course 2",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act - create first channel
      const channel1Id = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: course1Id!,
          creatorId: creatorId!,
        });
      }) as Id<"channels">;

      // Act - create second channel with same title
      const channel2Id = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: course2Id!,
          creatorId: creatorId!,
        });
      }) as Id<"channels">;

      // Assert
      await t.run(async (ctx) => {
        const channel1 = await ctx.db.get(channel1Id);
        const channel2 = await ctx.db.get(channel2Id);

        expect(channel1?.name).toBe("testing-fundamentals");
        expect(channel2?.name).toBe("testing-fundamentals-1");
      });
    });

    it("should return existing channel if already exists for course", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let creatorId: Id<"users">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Course Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Testing Course",
          description: "Test course",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act - create channel first time
      const firstChannelId = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: courseId!,
          creatorId: creatorId!,
        });
      });

      // Act - create channel second time
      const secondChannelId = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: courseId!,
          creatorId: creatorId!,
        });
      });

      // Assert - should return the same channel ID
      expect(secondChannelId).toEqual(firstChannelId);
    });

    it("should unarchive channel if exists but was archived", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let creatorId: Id<"users">;
      let channelId: Id<"channels">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Course Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Testing Course",
          description: "Test course",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        // Create an archived channel
        channelId = await ctx.db.insert("channels", {
          name: "testing-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: true,
          archivedAt: Date.now(),
          archivedBy: creatorId,
          memberCount: 1,
        });
      });

      // Act - create channel (should unarchive existing)
      const returnedChannelId = await t.run(async (ctx) => {
        return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
          courseId: courseId!,
          creatorId: creatorId!,
        });
      });

      // Assert
      expect(returnedChannelId).toEqual(channelId!);

      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId!);
        expect(channel?.isArchived).toBe(false);
        expect(channel?.archivedAt).toBeUndefined();
        expect(channel?.archivedBy).toBeUndefined();
      });
    });

    it("should throw error if course does not exist", async () => {
      const t = convexTest(schema);

      let creatorId: Id<"users">;
      let fakeCourseId: Id<"courses">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Course Creator",
          role: "admin",
          status: "online",
        });

        // Create and delete a course to get a valid but non-existent ID
        fakeCourseId = await ctx.db.insert("courses", {
          title: "Temp Course",
          description: "Temp",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
        await ctx.db.delete(fakeCourseId);
      });

      // Act & Assert
      await expect(
        t.run(async (ctx) => {
          return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
            courseId: fakeCourseId!,
            creatorId: creatorId!,
          });
        })
      ).rejects.toThrow("Course not found");
    });

    it("should throw error if creator does not exist", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let fakeCreatorId: Id<"users">;

      await t.run(async (ctx) => {
        const tempCreatorId = await ctx.db.insert("users", {
          clerkId: "temp-clerk",
          email: "temp@example.com",
          name: "Temp User",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Testing Course",
          description: "Test course",
          creatorId: tempCreatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        // Create and delete a user to get a valid but non-existent ID
        fakeCreatorId = await ctx.db.insert("users", {
          clerkId: "fake-clerk",
          email: "fake@example.com",
          name: "Fake User",
          role: "admin",
          status: "online",
        });
        await ctx.db.delete(fakeCreatorId);
      });

      // Act & Assert
      await expect(
        t.run(async (ctx) => {
          return await ctx.runMutation(internal.channels.courseMutations.createCourseChannel, {
            courseId: courseId!,
            creatorId: fakeCreatorId!,
          });
        })
      ).rejects.toThrow("Creator user not found");
    });
  });

  // ============================================================================
  // addCourseEnrollee (internal mutation)
  // ============================================================================
  describe("addCourseEnrollee", () => {
    it("should add user to course channel as member", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", userId)
          )
          .unique();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("member");
        expect(membership?.isBanned).toBe(false);
        expect(membership?.leftAt).toBeUndefined();

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2);
      });
    });

    it("should handle user already in channel gracefully (no error)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Already add user as member
        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act - add again (should not error)
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert - member count should remain same
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2); // Should not increase
      });
    });

    it("should handle user who left and rejoins (clears leftAt)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Add user as member who left
        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeUndefined();
        expect(membership?.joinedAt).toBeGreaterThan(Date.now() - 1000);

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2); // Incremented
      });
    });

    it("should do nothing if channel doesn't exist (course not published)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "draft", // Not published
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act - should not error
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert - no membership created
      await t.run(async (ctx) => {
        const memberships = await ctx.db
          .query("channelMembers")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

        expect(memberships).toHaveLength(0);
      });
    });

    it("should not re-add banned users automatically", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        // Add user as banned member
        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt: Date.now() - 5000,
          notificationLevel: "all",
          isMuted: false,
          isBanned: true,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert - membership should remain unchanged
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.isBanned).toBe(true);
        expect(membership?.leftAt).toBeDefined(); // Still has leftAt
      });
    });

    it("should throw error if user does not exist", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let fakeUserId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        // Create and delete user
        fakeUserId = await ctx.db.insert("users", {
          clerkId: "fake-clerk",
          email: "fake@example.com",
          name: "Fake",
          role: "user",
          status: "online",
        });
        await ctx.db.delete(fakeUserId);
      });

      // Act & Assert
      await expect(
        t.run(async (ctx) => {
          await ctx.runMutation(internal.channels.courseMutations.addCourseEnrollee, {
            courseId: courseId!,
            userId: fakeUserId!,
          });
        })
      ).rejects.toThrow("User not found");
    });
  });

  // ============================================================================
  // removeCourseEnrollee (internal mutation)
  // ============================================================================
  describe("removeCourseEnrollee", () => {
    it("should soft-remove user from course channel (sets leftAt)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeDefined();
        expect(membership?.leftAt).toBeGreaterThan(0);

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(1); // Decremented
      });
    });

    it("should handle user not in channel gracefully (no error)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act - should not error
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // No assertion needed - just verify no error thrown
    });

    it("should do nothing if channel doesn't exist", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "draft",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act - should not error
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // No assertion needed - just verify no error thrown
    });

    it("should do nothing if user already left", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        const leftAt = Date.now() - 5000;
        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "member",
          joinedAt: Date.now() - 10000,
          leftAt,
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert - leftAt unchanged
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeDefined();
        // Should not update leftAt
      });
    });

    it("should not remove course owner", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let creatorId: Id<"users">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act - try to remove owner
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
          courseId: courseId!,
          userId: creatorId!,
        });
      });

      // Assert - owner not removed
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.leftAt).toBeUndefined();

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(1); // Not decremented
      });
    });

    it("should decrement member count correctly", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        userId = await ctx.db.insert("users", {
          clerkId: "student-clerk",
          email: "student@example.com",
          name: "Student",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 5,
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
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.removeCourseEnrollee, {
          courseId: courseId!,
          userId: userId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(4);
      });
    });
  });

  // ============================================================================
  // grantCourseInstructorAdmin (internal mutation)
  // ============================================================================
  describe("grantCourseInstructorAdmin", () => {
    it("should grant admin role to instructor", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let instructorId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
          courseId: courseId!,
          userId: instructorId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const adminAccess = await ctx.db
          .query("channelAdmins")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", instructorId)
          )
          .unique();

        expect(adminAccess).toBeDefined();
        expect(adminAccess?.reason).toBe("course_instructor");

        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", instructorId)
          )
          .unique();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("admin");
      });
    });

    it("should create channelAdmin entry with reason course_instructor", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let instructorId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
          courseId: courseId!,
          userId: instructorId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const adminAccess = await ctx.db
          .query("channelAdmins")
          .withIndex("by_channel", (q) => q.eq("channelId", channelId))
          .collect();

        const instructorAdmin = adminAccess.find((a) => a.userId === instructorId);
        expect(instructorAdmin).toBeDefined();
        expect(instructorAdmin?.reason).toBe("course_instructor");
        expect(instructorAdmin?.grantedBy).toEqual(
          (await ctx.db.get(channelId))?.creatorId
        );
      });
    });

    it("should upgrade existing member role to admin", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let instructorId: Id<"users">;
      let membershipId: Id<"channelMembers">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 2,
        });

        // Add instructor as regular member first
        membershipId = await ctx.db.insert("channelMembers", {
          channelId,
          userId: instructorId,
          role: "member",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
          courseId: courseId!,
          userId: instructorId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db.get(membershipId);
        expect(membership?.role).toBe("admin");
      });
    });

    it("should create new membership if user not already member", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let instructorId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });
      });

      // Act
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
          courseId: courseId!,
          userId: instructorId!,
        });
      });

      // Assert
      await t.run(async (ctx) => {
        const membership = await ctx.db
          .query("channelMembers")
          .withIndex("by_channel_user", (q) =>
            q.eq("channelId", channelId).eq("userId", instructorId)
          )
          .unique();

        expect(membership).toBeDefined();
        expect(membership?.role).toBe("admin");

        const channel = await ctx.db.get(channelId);
        expect(channel?.memberCount).toBe(2); // Incremented
      });
    });

    it("should be idempotent (calling twice doesn't error)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let instructorId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });
      });

      // Act - call twice
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
          courseId: courseId!,
          userId: instructorId!,
        });
      });

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
          courseId: courseId!,
          userId: instructorId!,
        });
      });

      // Assert - no error, single admin access
      await t.run(async (ctx) => {
        const adminAccesses = await ctx.db
          .query("channelAdmins")
          .withIndex("by_user", (q) => q.eq("userId", instructorId))
          .collect();

        expect(adminAccesses).toHaveLength(1);
      });
    });

    it("should throw error if course channel not found", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let instructorId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        instructorId = await ctx.db.insert("users", {
          clerkId: "instructor-clerk",
          email: "instructor@example.com",
          name: "Instructor",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "draft", // No channel created
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });
      });

      // Act & Assert
      await expect(
        t.run(async (ctx) => {
          await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
            courseId: courseId!,
            userId: instructorId!,
          });
        })
      ).rejects.toThrow("Course channel not found");
    });

    it("should throw error if user does not exist", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let fakeUserId: Id<"users">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        fakeUserId = await ctx.db.insert("users", {
          clerkId: "fake-clerk",
          email: "fake@example.com",
          name: "Fake",
          role: "user",
          status: "online",
        });
        await ctx.db.delete(fakeUserId);
      });

      // Act & Assert
      await expect(
        t.run(async (ctx) => {
          await ctx.runMutation(internal.channels.courseMutations.grantCourseInstructorAdmin, {
            courseId: courseId!,
            userId: fakeUserId!,
          });
        })
      ).rejects.toThrow("User not found");
    });
  });

  // ============================================================================
  // getLessonDiscussion (public query)
  // ============================================================================
  describe("getLessonDiscussion", () => {
    it("should return messages for specific lessonId", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let lessonId: Id<"lessons">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });

        // Add messages for this lesson
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Question about lesson 1",
          createdAt: Date.now() - 2000,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Another question",
          createdAt: Date.now() - 1000,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert
      expect(result.messages).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.channelId).toEqual(channelId!);
      expect(result.messages[0]!.content).toBe("Question about lesson 1");
      expect(result.messages[1]!.content).toBe("Another question");
    });

    it("should filter by channelId correctly", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let otherChannelId: Id<"channels">;
      let lessonId: Id<"lessons">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        otherChannelId = await ctx.db.insert("channels", {
          name: "other-channel",
          type: "public",
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });

        // Add message in course channel
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Question in course channel",
          createdAt: Date.now(),
        });

        // Add message with same lessonId but in different channel
        await ctx.db.insert("messages", {
          channelId: otherChannelId,
          senderId: userId,
          lessonId,
          content: "Should not appear",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert - should only return message from course channel
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.content).toBe("Question in course channel");
    });

    it("should return empty array if no messages", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let lessonId: Id<"lessons">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert
      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.channelId).toEqual(channelId!);
    });

    it("should require authentication (throws if not authenticated)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let lessonId: Id<"lessons">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });
      });

      // Act & Assert - no identity
      await expect(
        t.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
          courseId: courseId!,
          lessonId: lessonId!,
        })
      ).rejects.toThrow();
    });

    it("should require channel membership or access", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let lessonId: Id<"lessons">;

      await t.run(async (ctx) => {
        const creatorId = await ctx.db.insert("users", {
          clerkId: "creator-clerk",
          email: "creator@example.com",
          name: "Creator",
          role: "admin",
          status: "online",
        });

        await ctx.db.insert("users", {
          clerkId: "non-member-clerk",
          email: "nonmember@example.com",
          name: "Non Member",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId: creatorId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });
      });

      const asNonMember = t.withIdentity({ subject: "non-member-clerk" });

      // Act & Assert
      await expect(
        asNonMember.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
          courseId: courseId!,
          lessonId: lessonId!,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("should exclude deleted messages", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let lessonId: Id<"lessons">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });

        // Add regular message
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Regular message",
          createdAt: Date.now(),
        });

        // Add deleted message
        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Deleted message",
          createdAt: Date.now(),
          deletedAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert - should only return regular message
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.content).toBe("Regular message");
    });

    it("should include sender information", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let lessonId: Id<"lessons">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Test message",
          createdAt: Date.now(),
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert
      expect(result.messages[0]!.sender).toEqual({
        _id: userId!,
        name: "Test User",
        avatarUrl: "https://example.com/avatar.jpg",
        status: "online",
      });
    });

    it("should sort by createdAt ascending (oldest first)", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let channelId: Id<"channels">;
      let lessonId: Id<"lessons">;
      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "published",
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        channelId = await ctx.db.insert("channels", {
          name: "test-course",
          type: "course",
          courseId,
          creatorId: userId,
          createdAt: Date.now(),
          isArchived: false,
          memberCount: 1,
        });

        await ctx.db.insert("channelMembers", {
          channelId,
          userId,
          role: "owner",
          joinedAt: Date.now(),
          notificationLevel: "all",
          isMuted: false,
          isBanned: false,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Third message",
          createdAt: Date.now(),
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "First message",
          createdAt: Date.now() - 2000,
        });

        await ctx.db.insert("messages", {
          channelId,
          senderId: userId,
          lessonId,
          content: "Second message",
          createdAt: Date.now() - 1000,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert - oldest first
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]!.content).toBe("First message");
      expect(result.messages[1]!.content).toBe("Second message");
      expect(result.messages[2]!.content).toBe("Third message");
    });

    it("should return empty result with null channelId if no channel exists", async () => {
      const t = convexTest(schema);

      let courseId: Id<"courses">;
      let lessonId: Id<"lessons">;

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          clerkId: "user-clerk",
          email: "user@example.com",
          name: "User",
          role: "user",
          status: "online",
        });

        courseId = await ctx.db.insert("courses", {
          title: "Test Course",
          description: "Test",
          creatorId: userId,
          status: "draft", // No channel
          visibility: "all_teams",
          displayOrder: 0,
          viewCount: 0,
        });

        const sectionId = await ctx.db.insert("sections", {
          courseId,
          title: "Section 1",
          displayOrder: 1,
        });

        lessonId = await ctx.db.insert("lessons", {
          sectionId,
          type: "text",
          title: "Lesson 1",
          displayOrder: 1,
        });
      });

      const asUser = t.withIdentity({ subject: "user-clerk" });

      // Act
      const result = await asUser.query(api.messages.lessonDiscussionQueries.getLessonDiscussion, {
        courseId: courseId!,
        lessonId: lessonId!,
      });

      // Assert
      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.channelId).toBeNull();
    });
  });
});
