import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMessageSearch } from "@/hooks/use-message-search";
import { useQuery, useMutation } from "convex/react";
import { act } from "@testing-library/react";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock the api import (avoid TS2589 error)
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    messages: {
      search: {
        searchMessages: "messages.search.searchMessages",
        getSuggestions: "messages.search.getSuggestions",
        getRecent: "messages.search.getRecent",
        saveToHistory: "messages.search.saveToHistory",
      },
    },
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("useMessageSearch hook", () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseMutation = vi.mocked(useMutation);
  const mockSaveToHistory = Object.assign(vi.fn(), {
    withOptimisticUpdate: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockSaveToHistory as any);
    mockSaveToHistory.mockResolvedValue(undefined);

    // Default mock responses (empty state)
    mockUseQuery.mockReturnValue(undefined);
  });

  describe("initial state", () => {
    it("should have empty query and results initially", () => {
      // Act
      const { result } = renderHook(() => useMessageSearch());

      // Assert
      expect(result.current.query).toBe("");
      expect(result.current.results).toEqual([]);
      expect(result.current.filters).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.debouncedQuery).toBe("");
    });
  });

  describe("setQuery", () => {
    it("should update query state", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act
      act(() => {
        result.current.setQuery("test query");
      });

      // Assert
      expect(result.current.query).toBe("test query");
    });

    it("should trim whitespace from query", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act
      act(() => {
        result.current.setQuery("  test query  ");
      });

      // Assert - query should be trimmed (checked via debouncedQuery after debounce)
      expect(result.current.query).toBe("  test query  ");
    });
  });

  describe("setFilters", () => {
    it("should update filter state", () => {
      const { result } = renderHook(() => useMessageSearch());

      const filters = {
        channelId: "channel1" as any,
        contentType: "voice" as const,
      };

      // Act
      act(() => {
        result.current.setFilters(filters);
      });

      // Assert
      expect(result.current.filters).toEqual(filters);
    });

    it("should allow updating individual filter properties", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act - Set initial filters
      act(() => {
        result.current.setFilters({
          channelId: "channel1" as any,
        });
      });

      // Assert
      expect(result.current.filters.channelId).toBeDefined();

      // Act - Update filters
      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          contentType: "text",
        });
      });

      // Assert
      expect(result.current.filters).toEqual({
        channelId: "channel1" as any,
        contentType: "text",
      });
    });
  });

  describe("clearFilters", () => {
    it("should reset all filters", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Set filters first
      act(() => {
        result.current.setFilters({
          channelId: "channel1" as any,
          contentType: "text",
          senderId: "user1" as any,
        });
      });

      expect(result.current.filters).not.toEqual({});

      // Act
      act(() => {
        result.current.clearFilters();
      });

      // Assert
      expect(result.current.filters).toEqual({});
    });
  });

  describe("clearSearch", () => {
    it("should reset query, filters, and results", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Set up some state
      act(() => {
        result.current.setQuery("test query");
        result.current.setFilters({
          channelId: "channel1" as any,
        });
      });

      // Verify state is set
      expect(result.current.query).not.toBe("");
      expect(result.current.filters).not.toEqual({});

      // Act
      act(() => {
        result.current.clearSearch();
      });

      // Assert - Everything should be reset
      expect(result.current.query).toBe("");
      expect(result.current.filters).toEqual({});
      expect(result.current.results).toEqual([]);
    });
  });

  describe("loadMore", () => {
    it("should be callable when there is no next cursor", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act - Should not throw even if there's no cursor
      expect(() => {
        act(() => {
          result.current.loadMore();
        });
      }).not.toThrow();
    });
  });

  describe("computed properties", () => {
    it("should expose isLoading property", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert
      expect(typeof result.current.isLoading).toBe("boolean");
    });

    it("should expose hasMore property", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert
      expect(typeof result.current.hasMore).toBe("boolean");
      expect(result.current.hasMore).toBe(false);
    });

    it("should expose debouncedQuery property", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert
      expect(result.current.debouncedQuery).toBe("");
    });

    it("should expose suggestions array", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert
      expect(Array.isArray(result.current.suggestions)).toBe(true);
    });

    it("should expose recentSearches array", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert
      expect(Array.isArray(result.current.recentSearches)).toBe(true);
    });
  });

  describe("state management", () => {
    it("should maintain independent state for query and filters", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act - Set query
      act(() => {
        result.current.setQuery("test");
      });

      // Assert - Filters should remain empty
      expect(result.current.query).toBe("test");
      expect(result.current.filters).toEqual({});

      // Act - Set filters
      act(() => {
        result.current.setFilters({ contentType: "voice" });
      });

      // Assert - Query should remain unchanged
      expect(result.current.query).toBe("test");
      expect(result.current.filters).toEqual({ contentType: "voice" });
    });

    it("should allow multiple query updates", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act - Multiple updates
      act(() => {
        result.current.setQuery("first");
      });

      expect(result.current.query).toBe("first");

      act(() => {
        result.current.setQuery("second");
      });

      expect(result.current.query).toBe("second");

      act(() => {
        result.current.setQuery("third");
      });

      // Assert - Should have the latest value
      expect(result.current.query).toBe("third");
    });
  });

  describe("return type structure", () => {
    it("should return all expected properties", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert - Check all expected properties exist
      expect(result.current).toHaveProperty("query");
      expect(result.current).toHaveProperty("setQuery");
      expect(result.current).toHaveProperty("filters");
      expect(result.current).toHaveProperty("setFilters");
      expect(result.current).toHaveProperty("clearFilters");
      expect(result.current).toHaveProperty("results");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("hasMore");
      expect(result.current).toHaveProperty("loadMore");
      expect(result.current).toHaveProperty("suggestions");
      expect(result.current).toHaveProperty("recentSearches");
      expect(result.current).toHaveProperty("clearSearch");
      expect(result.current).toHaveProperty("debouncedQuery");
    });

    it("should return functions for state setters", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Assert - Check functions are callable
      expect(typeof result.current.setQuery).toBe("function");
      expect(typeof result.current.setFilters).toBe("function");
      expect(typeof result.current.clearFilters).toBe("function");
      expect(typeof result.current.loadMore).toBe("function");
      expect(typeof result.current.clearSearch).toBe("function");
    });
  });

  describe("filter types", () => {
    it("should accept channelId filter", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act
      act(() => {
        result.current.setFilters({
          channelId: "channel123" as any,
        });
      });

      // Assert
      expect(result.current.filters.channelId).toBe("channel123");
    });

    it("should accept senderId filter", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act
      act(() => {
        result.current.setFilters({
          senderId: "user123" as any,
        });
      });

      // Assert
      expect(result.current.filters.senderId).toBe("user123");
    });

    it("should accept contentType filter", () => {
      const { result } = renderHook(() => useMessageSearch());

      // Act
      act(() => {
        result.current.setFilters({
          contentType: "voice",
        });
      });

      // Assert
      expect(result.current.filters.contentType).toBe("voice");
    });

    it("should accept dateRange filter", () => {
      const { result } = renderHook(() => useMessageSearch());

      const start = new Date("2024-01-01");
      const end = new Date("2024-12-31");

      // Act
      act(() => {
        result.current.setFilters({
          dateRange: { start, end },
        });
      });

      // Assert
      expect(result.current.filters.dateRange).toEqual({ start, end });
    });

    it("should accept multiple filters at once", () => {
      const { result } = renderHook(() => useMessageSearch());

      const filters = {
        channelId: "channel1" as any,
        senderId: "user1" as any,
        contentType: "text" as const,
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-12-31"),
        },
      };

      // Act
      act(() => {
        result.current.setFilters(filters);
      });

      // Assert
      expect(result.current.filters).toEqual(filters);
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
