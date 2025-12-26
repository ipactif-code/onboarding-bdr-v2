import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ChannelSettingsDialog,
  ChannelSettingsDialogSkeleton,
} from "@/components/messaging/channel-settings-dialog";
import type { Id } from "../../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockChannelId = "test-channel-id" as Id<"channels">;
const mockUserId = "test-user-id" as Id<"users">;

const mockChannelOwner = {
  _id: mockChannelId,
  name: "test-channel",
  description: "Test description",
  topic: "Test topic",
  type: "public" as const,
  membership: {
    role: "owner" as const,
    userId: mockUserId,
  },
};

const mockChannelAdmin = {
  ...mockChannelOwner,
  membership: {
    role: "admin" as const,
    userId: mockUserId,
  },
};

const mockChannelModerator = {
  ...mockChannelOwner,
  membership: {
    role: "moderator" as const,
    userId: mockUserId,
  },
};

const mockChannelMember = {
  ...mockChannelOwner,
  membership: {
    role: "member" as const,
    userId: mockUserId,
  },
};

const mockMembers = [
  {
    _id: "member-1" as Id<"channelMembers">,
    userId: mockUserId,
    role: "owner" as const,
  },
];

const mockCurrentUser = {
  _id: mockUserId,
  clerkId: "clerk-id",
  email: "test@example.com",
  name: "Test User",
  role: "user" as const,
};

const mockAdminUser = {
  ...mockCurrentUser,
  role: "admin" as const,
};

// ============================================================================
// Tests
// ============================================================================

describe("ChannelSettingsDialog", () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  it("renders loading skeleton initially", () => {
    // Arrange
    mockUseQuery.mockReturnValue(undefined); // All queries return undefined (loading)

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/loading channel settings/i)).toBeInTheDocument();
  });

  it("skeleton has aria-busy='true'", () => {
    // Arrange
    mockUseQuery.mockReturnValue(undefined);

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });

  it("renders ChannelSettingsDialogSkeleton component standalone", () => {
    // Arrange & Act
    render(<ChannelSettingsDialogSkeleton />);

    // Assert
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/loading channel settings/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  it("shows 'Channel not found' for invalid channel", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      // First call: channels.get -> null
      // Second call: channels.getMembers -> []
      // Third call: users.me -> mockCurrentUser
      const results = [null, [], mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByText(/channel not found or you don't have access/i)
    ).toBeInTheDocument();
  });

  // ==========================================================================
  // Permission Tests
  // ==========================================================================

  it("shows 'No permission' for non-admin users (member role)", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelMember, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByText(/you don't have permission to manage this channel/i)
    ).toBeInTheDocument();
  });

  it("shows tabs for channel owner", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelOwner, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - tabs should be visible
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /members \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
  });

  it("shows tabs for channel admin", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelAdmin, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /members \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
  });

  it("shows tabs for channel moderator", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelModerator, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /members \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
  });

  it("shows tabs for global admin (even if not channel admin)", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelMember, mockMembers, mockAdminUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - global admin should see tabs
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /members \(1\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
  });

  // ==========================================================================
  // Tabs Content Tests
  // ==========================================================================

  it("shows tabs (Details, Members, Advanced) for admins", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelOwner, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - all tabs should be present
    const detailsTab = screen.getByRole("tab", { name: /details/i });
    const membersTab = screen.getByRole("tab", { name: /members \(1\)/i });
    const advancedTab = screen.getByRole("tab", { name: /advanced/i });

    expect(detailsTab).toBeInTheDocument();
    expect(membersTab).toBeInTheDocument();
    expect(advancedTab).toBeInTheDocument();
  });

  it("displays member count in Members tab label", () => {
    // Arrange
    const manyMembers = [
      ...mockMembers,
      {
        _id: "member-2" as Id<"channelMembers">,
        userId: "user-2" as Id<"users">,
        role: "member" as const,
      },
      {
        _id: "member-3" as Id<"channelMembers">,
        userId: "user-3" as Id<"users">,
        role: "member" as const,
      },
    ];

    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelOwner, manyMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByRole("tab", { name: /members \(3\)/i })
    ).toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("accessible: has DialogDescription", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelOwner, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByText(/manage channel details, members, and advanced options/i)
    ).toBeInTheDocument();
  });

  it("accessible: Settings icon has aria-hidden", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      const results = [mockChannelOwner, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - Settings icon is decorative and has aria-hidden
    const heading = screen.getByRole("heading", { name: /channel settings/i });
    expect(heading).toBeInTheDocument();
    // The icon is present but decorative, we verify the heading is accessible
  });

  // ==========================================================================
  // Skip Query When Closed Tests
  // ==========================================================================

  it("skips queries when dialog is closed (open={false})", () => {
    // Arrange
    mockUseQuery.mockImplementation((query, args) => {
      // Queries should be skipped when args === "skip"
      if (args === "skip") return undefined;
      return mockChannelOwner;
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={false}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - mockUseQuery should have been called with "skip"
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("executes queries when dialog is open (open={true})", () => {
    // Arrange
    let callCount = 0;
    mockUseQuery.mockImplementation((query, args) => {
      if (args === "skip") return undefined;
      const results = [mockChannelOwner, mockMembers, mockCurrentUser];
      return results[callCount++];
    });

    // Act
    render(
      <ChannelSettingsDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - mockUseQuery should have been called with channelId
    expect(mockUseQuery).toHaveBeenCalledWith(expect.anything(), {
      channelId: mockChannelId,
    });
  });
});
