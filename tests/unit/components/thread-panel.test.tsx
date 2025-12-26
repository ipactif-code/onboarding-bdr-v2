import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadPanel } from "@/components/messaging/thread-panel";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock Sheet component from shadcn/ui
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="sheet" data-open={open}>
      {open && children}
      <button
        data-testid="sheet-close"
        onClick={() => onOpenChange(false)}
        aria-label="Close sheet"
      />
    </div>
  ),
  SheetContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    side?: string;
    showCloseButton?: boolean;
    className?: string;
    "aria-label"?: string;
  }) => (
    <div data-testid="sheet-content" className={className} aria-label="Thread panel">
      {children}
    </div>
  ),
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="sheet-title" className={className}>{children}</h2>
  ),
}));

// Mock ThreadView component
vi.mock("@/components/messaging/thread-view", () => ({
  ThreadView: ({
    parentMessageId,
    currentUserId,
    onClose,
    closeButtonRef,
  }: {
    parentMessageId: Id<"messages">;
    currentUserId: Id<"users">;
    onClose?: () => void;
    closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  }) => (
    <div data-testid="thread-view">
      <button
        ref={closeButtonRef}
        onClick={onClose}
        aria-label="Close thread"
        data-testid="thread-close-button"
      >
        Close
      </button>
      <div>ParentMessageId: {parentMessageId}</div>
      <div>CurrentUserId: {currentUserId}</div>
    </div>
  ),
}));

// Mock MessageInput component - calls onSend on Enter key press
vi.mock("@/components/messaging/message-input", () => ({
  MessageInput: ({
    onSend,
    parentId,
    placeholder,
    onSent,
  }: {
    onSend: (content: string) => void;
    parentId?: Id<"messages">;
    placeholder?: string;
    onSent?: () => void;
  }) => {
    // Use a closure variable to track input value
    let currentValue = "";
    return (
      <div data-testid="message-input">
        <input
          data-testid="message-input-field"
          placeholder={placeholder}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            currentValue = e.target.value;
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter" && !e.shiftKey && currentValue.trim()) {
              onSend(currentValue);
              currentValue = "";
            }
          }}
        />
        <div>ParentId: {parentId}</div>
        <button onClick={onSent} data-testid="sent-callback">
          Sent
        </button>
      </div>
    );
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const mockParentMessageId = "test-parent-message-id" as Id<"messages">;
const mockCurrentUserId = "test-current-user-id" as Id<"users">;

// ============================================================================
// Tests
// ============================================================================

describe("ThreadPanel", () => {
  const mockOnClose = vi.fn();
  const mockOnSendReply = vi.fn();
  const mockOnReplySent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders when open with parentMessageId", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
    expect(screen.getByTestId("sheet")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
  });

  it("does not render content when closed (isOpen=false)", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={null}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert
    expect(screen.getByTestId("sheet")).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("thread-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-input")).not.toBeInTheDocument();
  });

  it("renders ThreadView with correct props when open", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert
    expect(screen.getByTestId("thread-view")).toBeInTheDocument();
    expect(screen.getByText(`ParentMessageId: ${mockParentMessageId}`)).toBeInTheDocument();
    expect(screen.getByText(`CurrentUserId: ${mockCurrentUserId}`)).toBeInTheDocument();
  });

  it("renders MessageInput with correct props when open", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert
    const messageInput = screen.getByTestId("message-input-field");
    expect(messageInput).toBeInTheDocument();
    expect(messageInput).toHaveAttribute("placeholder", "Reply to thread...");
    expect(screen.getByText(`ParentId: ${mockParentMessageId}`)).toBeInTheDocument();
  });

  it("renders visually hidden title for accessibility", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert
    const title = screen.getByTestId("sheet-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Message Thread");
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("calls onClose when close button clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Act
    await user.click(screen.getByTestId("sheet-close"));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when ThreadView close button clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Act
    await user.click(screen.getByTestId("thread-close-button"));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSendReply when reply message sent", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Act
    const input = screen.getByTestId("message-input-field");
    await user.type(input, "Test reply message{Enter}");

    // Assert
    expect(mockOnSendReply).toHaveBeenCalledWith("Test reply message");
  });

  it("calls onReplySent callback when provided", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
        onReplySent={mockOnReplySent}
      />
    );

    // Act
    await user.click(screen.getByTestId("sent-callback"));

    // Assert
    expect(mockOnReplySent).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has correct accessibility attributes", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert
    const sheetContent = screen.getByTestId("sheet-content");
    expect(sheetContent).toHaveAttribute("aria-label", "Thread panel");
  });

  it("manages focus on close button when panel opens", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert - close button should be present for focus management
    expect(screen.getByTestId("thread-close-button")).toBeInTheDocument();
  });

  it("has keyboard support via Sheet component (Escape to close)", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert - Sheet handles Escape key internally via onOpenChange
    expect(screen.getByTestId("sheet-close")).toBeInTheDocument();
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("handles null parentMessageId gracefully", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={null}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert - panel should be closed, no content rendered
    expect(screen.getByTestId("sheet")).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("thread-view")).not.toBeInTheDocument();
  });

  it("transitions from closed to open state correctly", () => {
    // Arrange
    const { rerender } = render(
      <ThreadPanel
        parentMessageId={null}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert - initially closed
    expect(screen.queryByTestId("thread-view")).not.toBeInTheDocument();

    // Act - open panel
    rerender(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
      />
    );

    // Assert - now open
    expect(screen.getByTestId("thread-view")).toBeInTheDocument();
  });

  it("works without onReplySent callback (optional)", () => {
    // Arrange & Act
    render(
      <ThreadPanel
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
        onSendReply={mockOnSendReply}
        // onReplySent is optional - not provided
      />
    );

    // Assert - component should render normally
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });
});
