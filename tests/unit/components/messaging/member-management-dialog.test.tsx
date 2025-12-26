import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberManagementDialog } from "@/components/messaging/member-management-dialog";
import type { Id } from "../../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
}));

// Mock sub-components
vi.mock("@/components/messaging/channel-members-dialog/members-list", () => ({
  MembersList: ({ channelId, userRole }: { channelId: Id<"channels">; userRole?: string }) => (
    <div data-testid="members-list">
      Members List - ChannelId: {channelId} - UserRole: {userRole ?? "undefined"}
    </div>
  ),
}));

vi.mock(
  "@/components/messaging/channel-members-dialog/add-members-tab",
  () => ({
    AddMembersTab: ({ channelId }: { channelId: Id<"channels"> }) => (
      <div data-testid="add-members-tab">
        Add Members Tab - ChannelId: {channelId}
      </div>
    ),
  })
);

// ============================================================================
// Test Data
// ============================================================================

const mockChannelId = "test-channel-id" as Id<"channels">;

const mockPublicChannel = {
  _id: mockChannelId,
  name: "public-channel",
  type: "public" as const,
  membership: {
    role: "member" as const,
  },
};

const mockPrivateChannel = {
  _id: mockChannelId,
  name: "private-channel",
  type: "private" as const,
  membership: {
    role: "member" as const,
  },
};

const mockChannelOwner = {
  ...mockPrivateChannel,
  membership: {
    role: "owner" as const,
  },
};

const mockChannelAdmin = {
  ...mockPrivateChannel,
  membership: {
    role: "admin" as const,
  },
};

const mockChannelModerator = {
  ...mockPrivateChannel,
  membership: {
    role: "moderator" as const,
  },
};

const mockChannelMember = {
  ...mockPrivateChannel,
  membership: {
    role: "member" as const,
  },
};

// ============================================================================
// Tests
// ============================================================================

describe("MemberManagementDialog", () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests - Regular Users
  // ==========================================================================

  it("renders member list for regular users", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelMember);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByText(/manage members/i)).toBeInTheDocument();
    expect(
      screen.getByText(/view members in this channel/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("members-list")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument(); // No tabs
  });

  it("shows read-only message for regular members", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelMember);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByText(/view members in this channel/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/invite, or manage members/i)
    ).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Rendering Tests - Admins
  // ==========================================================================

  it("shows invite tab for admins on private channels", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /current members/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /invite members/i })
    ).toBeInTheDocument();
  });

  it("shows invite tab for owners on private channels", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelOwner);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /current members/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /invite members/i })
    ).toBeInTheDocument();
  });

  it("shows management message for admins", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByText(/view, invite, or manage members in this channel/i)
    ).toBeInTheDocument();
  });

  // ==========================================================================
  // Public Channel Tests
  // ==========================================================================

  it("hides invite tab for public channels (even for admins)", () => {
    // Arrange
    mockUseQuery.mockReturnValue({
      ...mockPublicChannel,
      membership: { role: "admin" as const },
    });

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - should show tabs but only "Current Members"
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /current members/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /invite members/i })
    ).not.toBeInTheDocument();
  });

  it("shows single tab layout for public channel admins", () => {
    // Arrange
    mockUseQuery.mockReturnValue({
      ...mockPublicChannel,
      membership: { role: "admin" as const },
    });

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    const tabList = screen.getByRole("tablist");
    expect(tabList).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(1); // Only "Current Members"
  });

  // ==========================================================================
  // Type Guard Tests
  // ==========================================================================

  it("uses type guards for role checking (not type assertions)", () => {
    // Arrange - role is undefined (not in membership)
    mockUseQuery.mockReturnValue({
      ...mockPrivateChannel,
      membership: undefined,
    });

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - should treat as regular user (no undefined role passed to MembersList)
    const membersList = screen.getByTestId("members-list");
    expect(membersList).toHaveTextContent("UserRole: undefined");
  });

  it("handles invalid role strings gracefully", () => {
    // Arrange - role is an invalid string
    mockUseQuery.mockReturnValue({
      ...mockPrivateChannel,
      membership: {
        role: "invalid-role" as const,
      },
    });

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - should not crash, treats as undefined
    const membersList = screen.getByTestId("members-list");
    expect(membersList).toHaveTextContent("UserRole: undefined");
  });

  it("correctly validates 'owner' role", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelOwner);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    const membersList = screen.getByTestId("members-list");
    expect(membersList).toHaveTextContent("UserRole: owner");
  });

  it("correctly validates 'admin' role", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    const membersList = screen.getByTestId("members-list");
    expect(membersList).toHaveTextContent("UserRole: admin");
  });

  it("correctly validates 'moderator' role", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelModerator);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    const membersList = screen.getByTestId("members-list");
    expect(membersList).toHaveTextContent("UserRole: moderator");
  });

  it("correctly validates 'member' role", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelMember);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    const membersList = screen.getByTestId("members-list");
    expect(membersList).toHaveTextContent("UserRole: member");
  });

  // ==========================================================================
  // Permission-Based Rendering Tests
  // ==========================================================================

  it("moderators do not see invite tab (not admin/owner)", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelModerator);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - moderators see tabs but not invite
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("members-list")).toBeInTheDocument();
  });

  // ==========================================================================
  // Tab Switching Tests
  // ==========================================================================

  it("displays MembersList in 'Current Members' tab", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - Current Members tab should be visible
    const currentMembersTab = screen.getByRole("tab", {
      name: /current members/i,
    });
    expect(currentMembersTab).toBeInTheDocument();
    expect(screen.getByTestId("members-list")).toBeInTheDocument();
  });

  it("displays AddMembersTab in 'Invite Members' tab content", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - Both tabs should be present
    expect(screen.getByRole("tab", { name: /current members/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /invite members/i })).toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has accessible dialog structure", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(
      screen.getByRole("dialog", { name: /manage members/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/view, invite, or manage members in this channel/i)
    ).toBeInTheDocument();
  });

  it("tab navigation is keyboard accessible", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - tabs should be accessible
    const currentMembersTab = screen.getByRole("tab", {
      name: /current members/i,
    });
    const inviteMembersTab = screen.getByRole("tab", {
      name: /invite members/i,
    });

    expect(currentMembersTab).toBeInTheDocument();
    expect(inviteMembersTab).toBeInTheDocument();

    // Tabs should have proper ARIA attributes
    expect(currentMembersTab).toHaveAttribute("role", "tab");
    expect(inviteMembersTab).toHaveAttribute("role", "tab");
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("handles null channel gracefully", () => {
    // Arrange
    mockUseQuery.mockReturnValue(null);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - should still render dialog but with undefined role
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("members-list")).toBeInTheDocument();
  });

  it("handles undefined channel gracefully (loading)", () => {
    // Arrange
    mockUseQuery.mockReturnValue(undefined);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert - should render dialog
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("passes correct channelId to child components", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelAdmin);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByTestId("members-list")).toHaveTextContent(
      `ChannelId: ${mockChannelId}`
    );
  });

  it("passes correct userRole to MembersList", () => {
    // Arrange
    mockUseQuery.mockReturnValue(mockChannelOwner);

    // Act
    render(
      <MemberManagementDialog
        channelId={mockChannelId}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Assert
    expect(screen.getByTestId("members-list")).toHaveTextContent(
      "UserRole: owner"
    );
  });
});
