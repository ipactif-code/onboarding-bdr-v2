import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOnlineUsers } from "@/hooks/use-online-users";
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
      getOnlineUsers: "presence.getOnlineUsers",
    },
  },
}));

describe("useOnlineUsers hook", () => {
  const mockUseQuery = vi.mocked(useQuery);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);
  });

  describe("initial state", () => {
    it("should return empty array and loading true when data is undefined", () => {
      // Arrange
      mockUseQuery.mockReturnValue(undefined);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current.users).toEqual([]);
      expect(result.current.isLoading).toBe(true);
    });

    it("should return empty array when no users are online", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current.users).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("online users data", () => {
    it("should return list of online users", () => {
      // Arrange
      const onlineUsers = [
        {
          userId: "user1" as Id<"users">,
          name: "Alice Johnson",
        },
        {
          userId: "user2" as Id<"users">,
          name: "Bob Smith",
        },
        {
          userId: "user3" as Id<"users">,
          name: "Charlie Davis",
        },
      ];
      mockUseQuery.mockReturnValue(onlineUsers);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current.users).toEqual(onlineUsers);
      expect(result.current.users).toHaveLength(3);
      expect(result.current.isLoading).toBe(false);
    });

    it("should return users with correct structure", () => {
      // Arrange
      const onlineUsers = [
        {
          userId: "user123" as Id<"users">,
          name: "Test User",
        },
      ];
      mockUseQuery.mockReturnValue(onlineUsers);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current.users[0]).toHaveProperty("userId");
      expect(result.current.users[0]).toHaveProperty("name");
      expect(result.current.users[0].userId).toBe("user123");
      expect(result.current.users[0].name).toBe("Test User");
    });
  });

  describe("real-time updates", () => {
    it("should update when users come online", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result, rerender } = renderHook(() => useOnlineUsers());

      // Assert - Initially empty
      expect(result.current.users).toHaveLength(0);

      // Act - User comes online
      const newUsers = [
        {
          userId: "user1" as Id<"users">,
          name: "New User",
        },
      ];
      mockUseQuery.mockReturnValue(newUsers);
      rerender();

      // Assert
      expect(result.current.users).toHaveLength(1);
      expect(result.current.users[0].name).toBe("New User");
    });

    it("should update when users go offline", () => {
      // Arrange
      const initialUsers = [
        {
          userId: "user1" as Id<"users">,
          name: "Alice",
        },
        {
          userId: "user2" as Id<"users">,
          name: "Bob",
        },
      ];
      mockUseQuery.mockReturnValue(initialUsers);

      // Act
      const { result, rerender } = renderHook(() => useOnlineUsers());

      // Assert - Initially 2 users
      expect(result.current.users).toHaveLength(2);

      // Act - One user goes offline
      const updatedUsers = [
        {
          userId: "user1" as Id<"users">,
          name: "Alice",
        },
      ];
      mockUseQuery.mockReturnValue(updatedUsers);
      rerender();

      // Assert
      expect(result.current.users).toHaveLength(1);
      expect(result.current.users[0].name).toBe("Alice");
    });
  });

  describe("loading state transitions", () => {
    it("should transition from loading to loaded", () => {
      // Arrange
      mockUseQuery.mockReturnValue(undefined);

      // Act
      const { result, rerender } = renderHook(() => useOnlineUsers());

      // Assert - Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.users).toEqual([]);

      // Act - Data loads
      const users = [
        {
          userId: "user1" as Id<"users">,
          name: "Test User",
        },
      ];
      mockUseQuery.mockReturnValue(users);
      rerender();

      // Assert - No longer loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.users).toEqual(users);
    });
  });

  describe("return type structure", () => {
    it("should return all expected properties", () => {
      // Arrange
      mockUseQuery.mockReturnValue([]);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current).toHaveProperty("users");
      expect(result.current).toHaveProperty("isLoading");
      expect(Array.isArray(result.current.users)).toBe(true);
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("edge cases", () => {
    it("should handle single user online", () => {
      // Arrange
      const singleUser = [
        {
          userId: "user1" as Id<"users">,
          name: "Solo User",
        },
      ];
      mockUseQuery.mockReturnValue(singleUser);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current.users).toHaveLength(1);
      expect(result.current.users[0].name).toBe("Solo User");
    });

    it("should handle many users online", () => {
      // Arrange
      const manyUsers = Array.from({ length: 50 }, (_, i) => ({
        userId: `user${i}` as Id<"users">,
        name: `User ${i}`,
      }));
      mockUseQuery.mockReturnValue(manyUsers);

      // Act
      const { result } = renderHook(() => useOnlineUsers());

      // Assert
      expect(result.current.users).toHaveLength(50);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("hook initialization", () => {
    it("should initialize without errors", () => {
      // Act & Assert - Should not throw
      expect(() => {
        renderHook(() => useOnlineUsers());
      }).not.toThrow();
    });
  });
});
