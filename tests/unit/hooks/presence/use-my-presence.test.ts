import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMyPresence } from "@/hooks/use-my-presence";
import { useQuery, useMutation } from "convex/react";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock the api import (avoid TS2589 error)
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    users: {
      me: "users.me",
    },
    presence: {
      setStatus: "presence.setStatus",
      setCustomStatus: "presence.setCustomStatus",
      clearCustomStatus: "presence.clearCustomStatus",
    },
  },
}));

describe("useMyPresence hook", () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  let mockSetStatusMutation: ReturnType<typeof vi.fn>;
  let mockSetCustomStatusMutation: ReturnType<typeof vi.fn>;
  let mockClearCustomStatusMutation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);

    // Reset mutation mocks
    mockSetStatusMutation = vi.fn().mockResolvedValue(undefined);
    mockSetCustomStatusMutation = vi.fn().mockResolvedValue(undefined);
    mockClearCustomStatusMutation = vi.fn().mockResolvedValue(undefined);

    // Setup mutations - return each mock in order for each call to useMutation
    mockUseMutation
      .mockReturnValueOnce(mockSetStatusMutation as any)
      .mockReturnValueOnce(mockSetCustomStatusMutation as any)
      .mockReturnValueOnce(mockClearCustomStatusMutation as any);
  });

  describe("initial state", () => {
    it("should return offline status when user data is loading", () => {
      // Arrange
      mockUseQuery.mockReturnValue(undefined);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.status).toBe("offline");
      expect(result.current.customStatus).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isUpdating).toBe(false);
    });

    it("should return user status when data is loaded", () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: undefined,
        customStatusEmoji: undefined,
        customStatusExpiresAt: undefined,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.status).toBe("online");
      expect(result.current.customStatus).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("customStatus computation", () => {
    it("should return custom status when set", () => {
      // Arrange
      const expiresAt = Date.now() + 3600000; // 1 hour from now
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: "In a meeting",
        customStatusEmoji: "📅",
        customStatusExpiresAt: expiresAt,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.customStatus).toEqual({
        text: "In a meeting",
        emoji: "📅",
        expiresAt,
      });
    });

    it("should return null when no custom status is set", () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: undefined,
        customStatusEmoji: undefined,
        customStatusExpiresAt: undefined,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.customStatus).toBeNull();
    });

    it("should return null when custom status has expired", () => {
      // Arrange
      const expiredTime = Date.now() - 1000; // 1 second ago
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: "Lunch break",
        customStatusEmoji: "🍔",
        customStatusExpiresAt: expiredTime,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.customStatus).toBeNull();
    });

    it("should handle custom status with only text", () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: "Working from home",
        customStatusEmoji: undefined,
        customStatusExpiresAt: undefined,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.customStatus).toEqual({
        text: "Working from home",
        emoji: undefined,
        expiresAt: undefined,
      });
    });

    it("should handle custom status with only emoji", () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: undefined,
        customStatusEmoji: "☕",
        customStatusExpiresAt: undefined,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current.customStatus).toEqual({
        text: undefined,
        emoji: "☕",
        expiresAt: undefined,
      });
    });
  });

  describe("setStatus", () => {
    it("should call mutation with correct status", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      await act(async () => {
        await result.current.setStatus("dnd");
      });

      // Assert
      expect(mockSetStatusMutation).toHaveBeenCalledWith({ status: "dnd" });
    });

    it("should set isUpdating to true during mutation", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);

      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockSetStatusMutation.mockReturnValue(promise);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Start the mutation inside act to avoid warnings
      let statusPromise: Promise<void>;
      act(() => {
        statusPromise = result.current.setStatus("away");
      });

      // Assert - Wait for isUpdating to become true
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(true);
      });

      // Resolve mutation
      await act(async () => {
        resolvePromise!();
        await statusPromise!;
      });

      // Assert - Should no longer be updating
      expect(result.current.isUpdating).toBe(false);
    });

    it("should reset isUpdating on error", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);
      mockSetStatusMutation.mockRejectedValue(new Error("Network error"));

      // Act
      const { result } = renderHook(() => useMyPresence());

      await act(async () => {
        try {
          await result.current.setStatus("offline");
        } catch {
          // Expected error
        }
      });

      // Assert
      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe("setCustomStatus", () => {
    it("should call mutation with text and emoji", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      await act(async () => {
        await result.current.setCustomStatus({
          text: "At lunch",
          emoji: "🍔",
        });
      });

      // Assert
      expect(mockSetCustomStatusMutation).toHaveBeenCalledWith({
        text: "At lunch",
        emoji: "🍔",
        expiresAt: undefined,
      });
    });

    it("should call mutation with expiration time", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);
      const expiresAt = Date.now() + 1800000; // 30 minutes

      // Act
      const { result } = renderHook(() => useMyPresence());

      await act(async () => {
        await result.current.setCustomStatus({
          text: "In meeting",
          emoji: "📅",
          expiresAt,
        });
      });

      // Assert
      expect(mockSetCustomStatusMutation).toHaveBeenCalledWith({
        text: "In meeting",
        emoji: "📅",
        expiresAt,
      });
    });

    it("should set isUpdating during mutation", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);

      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockSetCustomStatusMutation.mockReturnValue(promise);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Start the mutation inside act to avoid warnings
      let statusPromise: Promise<void>;
      act(() => {
        statusPromise = result.current.setCustomStatus({ text: "Testing" });
      });

      // Assert - Wait for isUpdating to become true
      await waitFor(() => {
        expect(result.current.isUpdating).toBe(true);
      });

      await act(async () => {
        resolvePromise!();
        await statusPromise!;
      });

      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe("clearCustomStatus", () => {
    it("should call clear mutation", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
        customStatus: "Old status",
        customStatusEmoji: "📝",
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      await act(async () => {
        await result.current.clearCustomStatus();
      });

      // Assert
      expect(mockClearCustomStatusMutation).toHaveBeenCalled();
    });

    it("should complete clear operation", async () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);
      mockClearCustomStatusMutation.mockResolvedValue(undefined);

      // Act
      const { result } = renderHook(() => useMyPresence());

      await act(async () => {
        await result.current.clearCustomStatus();
      });

      // Assert - Clear was called and completed without error
      expect(mockClearCustomStatusMutation).toHaveBeenCalled();
      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe("return type structure", () => {
    it("should return all expected properties", () => {
      // Arrange
      const userData = {
        _id: "user123" as any,
        status: "online" as const,
      };
      mockUseQuery.mockReturnValue(userData);

      // Act
      const { result } = renderHook(() => useMyPresence());

      // Assert
      expect(result.current).toHaveProperty("status");
      expect(result.current).toHaveProperty("customStatus");
      expect(result.current).toHaveProperty("setStatus");
      expect(result.current).toHaveProperty("setCustomStatus");
      expect(result.current).toHaveProperty("clearCustomStatus");
      expect(result.current).toHaveProperty("isUpdating");
      expect(result.current).toHaveProperty("isLoading");
      expect(typeof result.current.setStatus).toBe("function");
      expect(typeof result.current.setCustomStatus).toBe("function");
      expect(typeof result.current.clearCustomStatus).toBe("function");
    });
  });
});
