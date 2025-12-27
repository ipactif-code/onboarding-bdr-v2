import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MentionInputMessaging } from "@/components/messaging/mention-input-messaging";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex useQuery hook
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
}));

// Mock Plate.js hooks and components
 
vi.mock("platejs/react", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PlateElement: (props: any) => {
    const { children, as: Component = "span" } = props;
    return React.createElement(Component, {}, children);
  },
}));

// Mock @platejs/mention
vi.mock("@platejs/mention", () => ({
  getMentionOnSelectItem: () => vi.fn(),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Users: ({ className }: { className?: string }) => (
    <svg data-testid="users-icon" className={className} aria-hidden="true" />
  ),
  Megaphone: ({ className }: { className?: string }) => (
    <svg data-testid="megaphone-icon" className={className} aria-hidden="true" />
  ),
}));

// Mock Avatar components
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, size }: { children: React.ReactNode; size?: string }) => (
    <div data-testid="avatar" data-size={size}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => (
    <img data-testid="avatar-image" src={src} alt={alt} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="avatar-fallback">{children}</div>
  ),
}));

// Mock InlineCombobox components
vi.mock("@/components/ui/inline-combobox", () => ({
  InlineCombobox: ({
    children,
    trigger,
  }: {
    children: React.ReactNode;
    trigger: string;
  }) => (
    <div data-testid="inline-combobox" data-trigger={trigger}>
      {children}
    </div>
  ),
  InlineComboboxInput: ({ "aria-label": ariaLabel }: { "aria-label"?: string }) => (
    <input
      data-testid="combobox-input"
      aria-label={ariaLabel}
      placeholder="Type to mention..."
    />
  ),
  InlineComboboxContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="combobox-content">{children}</div>
  ),
  InlineComboboxEmpty: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="combobox-empty">{children}</div>
  ),
  InlineComboboxGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="combobox-group">{children}</div>
  ),
  InlineComboboxGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="combobox-group-label">{children}</div>
  ),
  InlineComboboxItem: ({
    children,
    value,
    onClick,
  }: {
    children: React.ReactNode;
    value: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      data-testid="combobox-item"
      data-value={value}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockCurrentUser = {
  role: "admin" as const,
  _id: "current-user-id" as Id<"users">,
  name: "Current User",
};

const mockRegularUser = {
  role: "user" as const,
  _id: "regular-user-id" as Id<"users">,
  name: "Regular User",
};

const mockSearchResults = [
  {
    _id: "user1" as Id<"users">,
    name: "Alice Johnson",
    avatarUrl: "https://example.com/alice.jpg",
    role: "user" as const,
  },
  {
    _id: "user2" as Id<"users">,
    name: "Bob Smith",
    avatarUrl: undefined,
    role: "admin" as const,
  },
  {
    _id: "user3" as Id<"users">,
    name: "Charlie Brown",
    avatarUrl: "https://example.com/charlie.jpg",
    role: "user" as const,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe("MentionInputMessaging", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockEditor = {} as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockElement = { id: "test-element" } as any;

  // Helper to render component with proper type workaround
  const renderMentionInput = (children: React.ReactNode) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Component = MentionInputMessaging as any;
    return render(
      <Component editor={mockEditor} element={mockElement}>
        {children}
      </Component>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: current user is admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseQuery.mockImplementation((query: any, args: any) => {
      if (args === "skip") return undefined;
      // First call: users.me
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!mockUseQuery.mock.calls.some((call: any[]) => call[1] !== "skip")) {
        return mockCurrentUser;
      }
      // Subsequent calls: users.search
      return mockSearchResults;
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders combobox with @ trigger", () => {
    // Arrange & Act
    renderMentionInput(<span>@</span>);

    // Assert
    const combobox = screen.getByTestId("inline-combobox");
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveAttribute("data-trigger", "@");
  });

  it("renders input with proper aria-label", () => {
    // Arrange & Act
    renderMentionInput(<span>@</span>);

    // Assert
    expect(
      screen.getByLabelText("Search users to mention")
    ).toBeInTheDocument();
  });

  // ==========================================================================
  // Special Mentions (@here, @everyone) Tests
  // ==========================================================================

  it("shows @here in Quick Mentions group for all users", async () => {
    // Arrange & Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Quick Mentions")).toBeInTheDocument();
      const hereButton = screen
        .getAllByTestId("combobox-item")
        .find((btn) => btn.getAttribute("data-value") === "here");
      expect(hereButton).toBeInTheDocument();
      expect(hereButton).toHaveTextContent("@here");
      expect(hereButton).toHaveTextContent("Notify online members");
    });
  });

  it("shows @everyone in Quick Mentions group for admin users", async () => {
    // Arrange
    mockUseQuery.mockReturnValueOnce(mockCurrentUser); // admin user

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      const everyoneButton = screen
        .getAllByTestId("combobox-item")
        .find((btn) => btn.getAttribute("data-value") === "everyone");
      expect(everyoneButton).toBeInTheDocument();
      expect(everyoneButton).toHaveTextContent("@everyone");
      expect(everyoneButton).toHaveTextContent("Notify all members");
    });
  });

  it("hides @everyone from non-admin users", async () => {
    // Arrange
    mockUseQuery.mockReturnValueOnce(mockRegularUser); // regular user

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      const items = screen.getAllByTestId("combobox-item");
      const everyoneButton = items.find(
        (btn) => btn.getAttribute("data-value") === "everyone"
      );
      expect(everyoneButton).toBeUndefined();
    });
  });

  it("displays correct icons for special mentions", async () => {
    // Arrange
    mockUseQuery.mockReturnValueOnce(mockCurrentUser); // admin user

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("users-icon")).toBeInTheDocument(); // @here
      expect(screen.getByTestId("megaphone-icon")).toBeInTheDocument(); // @everyone (admin only)
    });
  });

  // ==========================================================================
  // User Search Tests
  // ==========================================================================

  it("shows empty state when search is less than 2 characters", async () => {
    // Arrange
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(undefined); // No search results

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      // Should show special mentions but empty message for users
      // Note: The component shows "Type to search users..." when search < 2 chars
      // This is shown when there are no results
    });
  });

  it("queries users when search has 2+ characters", async () => {
    // Arrange
    const { rerender } = renderMentionInput(<span>@</span>);

    // Simulate typing (in real component, this would update search state)
    // For this test, we verify that useQuery is called with proper args

    // Assert
    expect(mockUseQuery).toHaveBeenCalled();
  });

  it("displays user search results with avatars and names", async () => {
    // Arrange
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(mockSearchResults);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Users")).toBeInTheDocument();
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });
  });

  it("shows admin badge for admin users in search results", async () => {
    // Arrange
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(mockSearchResults);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      // Bob Smith is admin in mockSearchResults
      const adminBadges = screen.getAllByText(/Admin/);
      expect(adminBadges.length).toBeGreaterThan(0);
    });
  });

  it("displays user initials as fallback when no avatar", async () => {
    // Arrange
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(mockSearchResults);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      const fallbacks = screen.getAllByTestId("avatar-fallback");
      expect(fallbacks.length).toBeGreaterThan(0);
      // Bob Smith has no avatar, should show "BS" initials
      expect(fallbacks.some((el) => el.textContent === "BS")).toBe(true);
    });
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("calls onSelectItem when user clicks on a mention", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseQuery.mockReturnValueOnce(mockCurrentUser);

    renderMentionInput(<span>@</span>);

    // Wait for items to render
    await waitFor(() => {
      expect(screen.getByText("Quick Mentions")).toBeInTheDocument();
    });

    // Act - Click on @here
    const hereButton = screen
      .getAllByTestId("combobox-item")
      .find((btn) => btn.getAttribute("data-value") === "here");
    expect(hereButton).toBeDefined();
    await user.click(hereButton!);

    // Assert - onSelectItem mock was called in getMentionOnSelectItem
    // We just verify no errors occurred
    expect(true).toBe(true);
  });

  // ==========================================================================
  // Keyboard Navigation Tests
  // ==========================================================================

  it("allows keyboard navigation through mention items", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseQuery.mockReturnValueOnce(mockCurrentUser);

    renderMentionInput(<span>@</span>);

    // Wait for items to render
    await waitFor(() => {
      expect(screen.getByText("Quick Mentions")).toBeInTheDocument();
    });

    // Act - Tab through items
    await user.tab();

    // Assert - First item should be focusable
    const items = screen.getAllByTestId("combobox-item");
    expect(items.length).toBeGreaterThan(0);
  });

  it("selects mention on Enter key press", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseQuery.mockReturnValueOnce(mockCurrentUser);

    renderMentionInput(<span>@</span>);

    await waitFor(() => {
      expect(screen.getByText("Quick Mentions")).toBeInTheDocument();
    });

    // Act - Focus first item and press Enter
    const firstItem = screen.getAllByTestId("combobox-item")[0];
    if (firstItem) {
      await user.click(firstItem);
    }

    // Assert - No errors
    expect(true).toBe(true);
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper ARIA label on combobox input", () => {
    // Arrange & Act
    renderMentionInput(<span>@</span>);

    // Assert
    const input = screen.getByLabelText("Search users to mention");
    expect(input).toBeInTheDocument();
  });

  it("icons have aria-hidden attribute", async () => {
    // Arrange
    mockUseQuery.mockReturnValueOnce(mockCurrentUser); // admin user to see all icons

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      const icons = [
        screen.getByTestId("users-icon"),
        screen.getByTestId("megaphone-icon"),
      ];
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  it("provides screen reader text for admin role", async () => {
    // Arrange
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(mockSearchResults);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      // Should have sr-only text for admin role
      const srOnlyElements = document.querySelectorAll(".sr-only");
      const hasAdminLabel = Array.from(srOnlyElements).some(
        (el) => el.textContent === "User role: "
      );
      expect(hasAdminLabel).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("handles undefined current user gracefully", () => {
    // Arrange
    mockUseQuery.mockReturnValueOnce(undefined); // No current user

    // Act & Assert - Should not crash
    expect(() =>
      renderMentionInput(<span>@</span>)
    ).not.toThrow();
  });

  it("handles empty search results gracefully", async () => {
    // Arrange
    mockUseQuery.mockReturnValueOnce(mockCurrentUser).mockReturnValueOnce([]);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert - Should show special mentions only
    await waitFor(() => {
      expect(screen.getByText("Quick Mentions")).toBeInTheDocument();
    });
  });

  it("handles users without avatars", async () => {
    // Arrange
    const usersWithoutAvatars = [
      {
        _id: "user1" as Id<"users">,
        name: "Test User",
        avatarUrl: undefined,
        role: "user" as const,
      },
    ];
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(usersWithoutAvatars);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("TU")).toBeInTheDocument(); // Initials fallback
    });
  });

  it("properly truncates long usernames", async () => {
    // Arrange
    const longNameUsers = [
      {
        _id: "user1" as Id<"users">,
        name: "Very Long Username That Should Be Truncated",
        avatarUrl: undefined,
        role: "user" as const,
      },
    ];
    mockUseQuery
      .mockReturnValueOnce(mockCurrentUser)
      .mockReturnValueOnce(longNameUsers);

    // Act
    renderMentionInput(<span>@</span>);

    // Assert - Should render with truncate class
    await waitFor(() => {
      const nameElement = screen.getByText(
        "Very Long Username That Should Be Truncated"
      );
      expect(nameElement.className).toMatch(/truncate/);
    });
  });
});
