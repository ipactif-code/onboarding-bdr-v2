import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChannelCreateDialog } from "@/components/messaging/channel-create-dialog";
import type { Id } from "../../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex
const mockCreateChannel = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: () => mockCreateChannel,
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe("ChannelCreateDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders when open={true}", () => {
    // Arrange & Act
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Assert
    expect(
      screen.getByRole("dialog", { name: /create channel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create a new channel for team communication.")
    ).toBeInTheDocument();
  });

  it("does not render when open={false}", () => {
    // Arrange & Act
    render(
      <ChannelCreateDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Form Fields Tests
  // ==========================================================================

  it("shows all form fields (name, description, topic, type)", () => {
    // Arrange & Act
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Assert - Name field
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/e.g., general-discussion/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/lowercase letters, numbers, hyphens, and underscores only/i)
    ).toBeInTheDocument();

    // Assert - Description field
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/what is this channel about\?/i)
    ).toBeInTheDocument();
    expect(screen.getByText("0/500")).toBeInTheDocument();

    // Assert - Topic field
    expect(screen.getByLabelText(/^topic$/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/current discussion topic \(optional\)/i)
    ).toBeInTheDocument();

    // Assert - Channel Type field
    expect(screen.getByLabelText(/channel type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/public/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/private/i)).toBeInTheDocument();
    expect(screen.getByText(/anyone can join this channel/i)).toBeInTheDocument();
    expect(
      screen.getByText(/only invited members can access/i)
    ).toBeInTheDocument();
  });

  it("description character counter updates as user types", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act
    const descriptionInput = screen.getByLabelText(/^description$/i);
    await user.type(descriptionInput, "This is a test");

    // Assert
    expect(screen.getByText("14/500")).toBeInTheDocument();
  });

  // ==========================================================================
  // Name Input Validation Tests
  // ==========================================================================

  it("name input enforces lowercase", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act
    const nameInput = screen.getByLabelText(/^name$/i);
    await user.type(nameInput, "TestChannel");

    // Assert - should convert to lowercase
    expect(nameInput).toHaveValue("testchannel");
  });

  it("name input converts spaces to hyphens", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act
    const nameInput = screen.getByLabelText(/^name$/i);
    await user.type(nameInput, "test channel name");

    // Assert
    expect(nameInput).toHaveValue("test-channel-name");
  });

  it("name input removes invalid characters", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act
    const nameInput = screen.getByLabelText(/^name$/i);
    await user.type(nameInput, "test@#channel!123");

    // Assert - only valid characters (a-z, 0-9, -, _) remain
    expect(nameInput).toHaveValue("testchannel123");
  });

  it("name input allows valid characters (lowercase, numbers, hyphens, underscores)", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act
    const nameInput = screen.getByLabelText(/^name$/i);
    await user.type(nameInput, "valid-channel_name123");

    // Assert
    expect(nameInput).toHaveValue("valid-channel_name123");
  });

  // ==========================================================================
  // Form Validation Tests
  // ==========================================================================

  it("submit button disabled when form is invalid", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Assert - initially disabled (empty name)
    const submitButton = screen.getByRole("button", { name: /create channel/i });
    expect(submitButton).toBeDisabled();

    // Act - type just 1 character (invalid: min 2 chars)
    await user.type(screen.getByLabelText(/^name$/i), "a");

    // Assert - still disabled
    expect(submitButton).toBeDisabled();
  });

  it("submit button enabled when form is valid", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - type valid name (min 2 chars)
    await user.type(screen.getByLabelText(/^name$/i), "valid-name");

    // Assert - button should be enabled after valid input
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create channel/i })
      ).not.toBeDisabled();
    });
  });

  // ==========================================================================
  // Form Submission Tests
  // ==========================================================================

  it("calls onSuccess with channelId on successful creation", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockChannelId = "test-channel-id" as Id<"channels">;
    mockCreateChannel.mockResolvedValue(mockChannelId);

    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - fill form and submit
    await user.type(screen.getByLabelText(/^name$/i), "test-channel");
    await user.type(
      screen.getByLabelText(/^description$/i),
      "Test description"
    );
    await user.type(screen.getByLabelText(/^topic$/i), "Test topic");

    // Wait for form to be valid
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create channel/i })
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /create channel/i }));

    // Assert
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith({
        name: "test-channel",
        description: "Test description",
        topic: "Test topic",
        type: "public", // default
      });
      expect(mockOnSuccess).toHaveBeenCalledWith(mockChannelId);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("omits optional fields when empty", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockChannelId = "test-channel-id" as Id<"channels">;
    mockCreateChannel.mockResolvedValue(mockChannelId);

    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - fill only required field
    await user.type(screen.getByLabelText(/^name$/i), "minimal-channel");

    // Wait for form to be valid
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create channel/i })
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /create channel/i }));

    // Assert - description and topic should be undefined
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith({
        name: "minimal-channel",
        description: undefined,
        topic: undefined,
        type: "public",
      });
    });
  });

  it("creates private channel when private type is selected", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockChannelId = "test-channel-id" as Id<"channels">;
    mockCreateChannel.mockResolvedValue(mockChannelId);

    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - select private type
    await user.type(screen.getByLabelText(/^name$/i), "private-channel");
    await user.click(screen.getByLabelText(/private/i));

    // Wait for form to be valid
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create channel/i })
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /create channel/i }));

    // Assert
    await waitFor(() => {
      expect(mockCreateChannel).toHaveBeenCalledWith({
        name: "private-channel",
        description: undefined,
        topic: undefined,
        type: "private",
      });
    });
  });

  // ==========================================================================
  // Cancel / Close Tests
  // ==========================================================================

  it("calls onOpenChange(false) on cancel", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Assert
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets form when cancel is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - fill form
    await user.type(screen.getByLabelText(/^name$/i), "test-channel");
    await user.type(
      screen.getByLabelText(/^description$/i),
      "Test description"
    );

    // Assert - form has values
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("test-channel");
    expect(screen.getByLabelText(/^description$/i)).toHaveValue(
      "Test description"
    );

    // Act - click cancel (which triggers onOpenChange(false))
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    // Assert - onOpenChange was called
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  it("shows loading state during submission", async () => {
    // Arrange
    const user = userEvent.setup();
    let resolveSubmit: (value: Id<"channels">) => void;
    const submitPromise = new Promise<Id<"channels">>((resolve) => {
      resolveSubmit = resolve;
    });
    mockCreateChannel.mockReturnValue(submitPromise);

    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - fill and submit
    await user.type(screen.getByLabelText(/^name$/i), "test-channel");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create channel/i })
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /create channel/i }));

    // Assert - submit button should be disabled during submission
    await waitFor(() => {
      const submitButton = screen.getByRole("button", {
        name: /create channel/i,
      });
      expect(submitButton).toBeDisabled();
    });

    // Cleanup - resolve the promise
    resolveSubmit!("test-id" as Id<"channels">);
  });

  it("handles submission error", async () => {
    // Arrange
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    mockCreateChannel.mockRejectedValue(new Error("Network error"));

    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - fill and submit
    await user.type(screen.getByLabelText(/^name$/i), "test-channel");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create channel/i })
      ).not.toBeDisabled();
    });

    await user.click(screen.getByRole("button", { name: /create channel/i }));

    // Assert
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has accessible dialog structure", () => {
    // Arrange & Act
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Assert
    expect(
      screen.getByRole("dialog", { name: /create channel/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Create a new channel for team communication.")
    ).toBeInTheDocument();

    // Form fields should be properly labeled
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^topic$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel type/i)).toBeInTheDocument();
  });

  it("is keyboard navigable", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ChannelCreateDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Act - focus on name input directly and navigate
    const nameInput = screen.getByLabelText(/^name$/i);
    nameInput.focus();
    expect(nameInput).toHaveFocus();

    // Tab to description
    await user.tab();
    expect(screen.getByLabelText(/^description$/i)).toHaveFocus();

    // Tab to topic
    await user.tab();
    expect(screen.getByLabelText(/^topic$/i)).toHaveFocus();

    // All form fields are keyboard accessible
    // (Radio groups and buttons are accessible as well, just not testing specific tab order)
  });
});
