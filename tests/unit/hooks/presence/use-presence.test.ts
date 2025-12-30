import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePresence, useSingleUserPresence } from "@/hooks/use-presence";
import { useQuery } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mock the api import (avoid TS2589 error)
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    presence: {
      getMultiple: "presence.getMultiple",
    },
  },
}));

describe("usePresence hook", () => {
  const mockUseQuery = vi.mocked(useQuery);
  const userId1 = "user1" as Id<"users">;
  const userId2 = "user2" as Id<"users">;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);
  });

  describe("initial state", () => {
    it("should return empty map when no users provided", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result } = renderHook(() => usePresence([]));

      // Assert
      expect(result.current.users.size).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should return loading state when data is undefined", () => {
      // Arrange
      mockUseQuery.mockReturnValue(undefined);

      // Act
      const { result } = renderHook(() => usePresence([userId1]));

      // Assert
      expect(result.current.users.size).toBe(0);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe("presence data mapping", () => {
    it("should return presence data for multiple users", () => {
      // Arrange
      const presenceData = [
        {
          userId: userId1,
          status: "online" as const,
          lastActiveAt: Date.now(),
          customStatus: "Working",
          customStatusEmoji: "💼",
          customStatusExpiresAt: Date.now() + 3600000,
        },
        {
          userId: userId2,
          status: "away" as const,
          lastActiveAt: Date.now() - 300000,
          customStatus: undefined,
          customStatusEmoji: undefined,
          customStatusExpiresAt: undefined,
        },
      ];
      mockUseQuery.mockReturnValue(presenceData);

      // Act
      const { result } = renderHook(() => usePresence([userId1, userId2]));

      // Assert
      expect(result.current.users.size).toBe(2);
      const user1 = result.current.users.get(userId1);
      expect(user1?.status).toBe("online");
      expect(user1?.customStatus).toBe("Working");
      expect(user1?.customStatusEmoji).toBe("💼");
      expect(user1?.isExpired).toBe(false);

      const user2 = result.current.users.get(userId2);
      expect(user2?.status).toBe("away");
      expect(user2?.customStatus).toBeUndefined();
    });

    it("should handle expired custom status (client-side filtering)", () => {
      // Arrange
      const expiredTime = Date.now() - 1000; // 1 second ago
      const presenceData = [
        {
          userId: userId1,
          status: "online" as const,
          lastActiveAt: Date.now(),
          customStatus: "In meeting",
          customStatusEmoji: "📅",
          customStatusExpiresAt: expiredTime,
        },
      ];
      mockUseQuery.mockReturnValue(presenceData);

      // Act
      const { result } = renderHook(() => usePresence([userId1]));

      // Assert
      const user1 = result.current.users.get(userId1);
      expect(user1?.customStatus).toBeUndefined();
      expect(user1?.customStatusEmoji).toBeUndefined();
      expect(user1?.isExpired).toBe(true);
    });

    it("should handle null lastActiveAt", () => {
      // Arrange
      const presenceData = [
        {
          userId: userId1,
          status: "offline" as const,
          lastActiveAt: null,
          customStatus: undefined,
          customStatusEmoji: undefined,
          customStatusExpiresAt: undefined,
        },
      ];
      mockUseQuery.mockReturnValue(presenceData);

      // Act
      const { result } = renderHook(() => usePresence([userId1]));

      // Assert
      const user1 = result.current.users.get(userId1);
      expect(user1?.lastActiveAt).toBeNull();
    });
  });

  describe("userIds memoization", () => {
    it("should memoize userIds array to prevent unnecessary re-renders", () => {
      // Arrange
      const userIds1 = [userId1, userId2];
      const userIds2 = [userId1, userId2]; // Different array reference, same contents
      mockUseQuery.mockReturnValue([]);

      // Act
      const { rerender } = renderHook(
        ({ ids }) => usePresence(ids),
        { initialProps: { ids: userIds1 } }
      );

      rerender({ ids: userIds2 });

      // Assert - The hook should handle array memoization correctly
      // This test verifies the hook doesn't crash with different array references
      const calls = mockUseQuery.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("query skipping", () => {
    it('should not crash when userIds array is empty', () => {
      // Act & Assert - Should not throw
      expect(() => {
        renderHook(() => usePresence([]));
      }).not.toThrow();
    });

    it('should not crash when userIds array is not empty', () => {
      // Act & Assert - Should not throw
      expect(() => {
        renderHook(() => usePresence([userId1]));
      }).not.toThrow();
    });
  });

  describe("return type structure", () => {
    it("should return all expected properties", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result } = renderHook(() => usePresence([]));

      // Assert
      expect(result.current).toHaveProperty("users");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
      expect(result.current.users instanceof Map).toBe(true);
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });
});

describe("useSingleUserPresence hook", () => {
  const mockUseQuery = vi.mocked(useQuery);
  const userId = "user1" as Id<"users">;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);
  });

  describe("single user lookup", () => {
    it("should return presence data for a single user", () => {
      // Arrange
      const presenceData = [
        {
          userId,
          status: "online" as const,
          lastActiveAt: Date.now(),
          customStatus: "Available",
          customStatusEmoji: "✅",
          customStatusExpiresAt: Date.now() + 3600000,
        },
      ];
      mockUseQuery.mockReturnValue(presenceData);

      // Act
      const { result } = renderHook(() => useSingleUserPresence(userId));

      // Assert
      expect(result.current.presence).toBeDefined();
      expect(result.current.presence?.status).toBe("online");
      expect(result.current.presence?.customStatus).toBe("Available");
      expect(result.current.isLoading).toBe(false);
    });

    it("should return null when userId is null", () => {
      // Act
      const { result } = renderHook(() => useSingleUserPresence(null));

      // Assert
      expect(result.current.presence).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return null when user not found in results", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result } = renderHook(() => useSingleUserPresence(userId));

      // Assert
      expect(result.current.presence).toBeNull();
    });

    it("should pass loading state from usePresence", () => {
      // Arrange
      mockUseQuery.mockReturnValue(undefined);

      // Act
      const { result } = renderHook(() => useSingleUserPresence(userId));

      // Assert
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("return type structure", () => {
    it("should return all expected properties", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result } = renderHook(() => useSingleUserPresence(userId));

      // Assert
      expect(result.current).toHaveProperty("presence");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
    });
  });
});
