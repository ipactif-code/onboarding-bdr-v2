import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageActionButtons } from "@/components/messaging/message-action-buttons";

// ============================================================================
// Mocks
// ============================================================================

// Mock Button component from shadcn/ui
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    className,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock Tooltip component
vi.mock("@/components/ui-plate/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children: React.ReactNode;
  }) => <div data-tooltip-trigger>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-tooltip-content>{children}</div>
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  MessageSquare: ({ className }: { className?: string }) => (
    <svg data-testid="message-square-icon" className={className} aria-hidden="true" />
  ),
  MoreHorizontal: ({ className }: { className?: string }) => (
    <svg data-testid="more-horizontal-icon" className={className} aria-hidden="true" />
  ),
  Pencil: ({ className }: { className?: string }) => (
    <svg data-testid="pencil-icon" className={className} aria-hidden="true" />
  ),
  Trash2: ({ className }: { className?: string }) => (
    <svg data-testid="trash2-icon" className={className} aria-hidden="true" />
  ),
}));

// ============================================================================
// Tests
// ============================================================================

describe("MessageActionButtons", () => {
  const mockOnReply = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests - Thread Button
  // ==========================================================================

  it("shows reply button when showThreadButton=true", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={false}
        showThreadButton={true}
        onReply={mockOnReply}
      />
    );

    // Assert
    const replyButton = screen.getByRole("button", { name: /reply in thread/i });
    expect(replyButton).toBeInTheDocument();
    expect(screen.getByTestId("message-square-icon")).toBeInTheDocument();
  });

  it("hides reply button when showThreadButton=false", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={false}
        showThreadButton={false}
        onReply={mockOnReply}
      />
    );

    // Assert
    expect(screen.queryByRole("button", { name: /reply in thread/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("message-square-icon")).not.toBeInTheDocument();
  });

  it("shows reply button by default (showThreadButton not specified)", () => {
    // Arrange & Act
    render(<MessageActionButtons isOwn={false} onReply={mockOnReply} />);

    // Assert
    const replyButton = screen.getByRole("button", { name: /reply in thread/i });
    expect(replyButton).toBeInTheDocument();
  });

  // ==========================================================================
  // Rendering Tests - Own Message Actions
  // ==========================================================================

  it("shows edit and delete buttons only for own messages", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /edit message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete message/i })).toBeInTheDocument();
    expect(screen.getByTestId("pencil-icon")).toBeInTheDocument();
    expect(screen.getByTestId("trash2-icon")).toBeInTheDocument();
  });

  it("hides edit and delete buttons for other users' messages", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={false}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert
    expect(screen.queryByRole("button", { name: /edit message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete message/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pencil-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trash2-icon")).not.toBeInTheDocument();
  });

  it("always shows more actions button regardless of ownership", () => {
    // Arrange & Act - Not own message
    const { rerender } = render(
      <MessageActionButtons isOwn={false} onReply={mockOnReply} />
    );

    // Assert
    expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
    expect(screen.getByTestId("more-horizontal-icon")).toBeInTheDocument();

    // Act - Own message
    rerender(<MessageActionButtons isOwn={true} onReply={mockOnReply} />);

    // Assert
    expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("calls onReply when reply button clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <MessageActionButtons
        isOwn={false}
        showThreadButton={true}
        onReply={mockOnReply}
      />
    );

    // Act
    await user.click(screen.getByRole("button", { name: /reply in thread/i }));

    // Assert
    expect(mockOnReply).toHaveBeenCalledTimes(1);
  });

  it("calls onEdit when edit button clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <MessageActionButtons
        isOwn={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Act
    await user.click(screen.getByRole("button", { name: /edit message/i }));

    // Assert
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <MessageActionButtons
        isOwn={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Act
    await user.click(screen.getByRole("button", { name: /delete message/i }));

    // Assert
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper aria-labels for all buttons", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /reply in thread/i })).toHaveAttribute(
      "aria-label",
      "Reply in thread"
    );
    expect(screen.getByRole("button", { name: /edit message/i })).toHaveAttribute(
      "aria-label",
      "Edit message"
    );
    expect(screen.getByRole("button", { name: /delete message/i })).toHaveAttribute(
      "aria-label",
      "Delete message"
    );
    expect(screen.getByRole("button", { name: /more actions/i })).toHaveAttribute(
      "aria-label",
      "More actions"
    );
  });

  it("has 44x44px minimum touch targets (WCAG 2.5.5)", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert - All buttons should have min-h-11 min-w-11 (44px)
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.className).toMatch(/min-h-11/);
      expect(button.className).toMatch(/min-w-11/);
    });
  });

  it("icons have aria-hidden=true", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert
    expect(screen.getByTestId("message-square-icon")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("pencil-icon")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("trash2-icon")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("more-horizontal-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("has proper keyboard navigation (focusable buttons)", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert - All buttons should be focusable (no tabindex=-1)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4); // Reply, Edit, Delete, More

    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute("tabindex", "-1");
    });
  });

  it("shows tooltips on hover (via Tooltip component)", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert - Check that tooltip content is present
    expect(screen.getByText("Reply in thread")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });

  // ==========================================================================
  // Visual/Style Tests
  // ==========================================================================

  it("delete button has destructive styling", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert
    const deleteButton = screen.getByRole("button", { name: /delete message/i });
    expect(deleteButton.className).toMatch(/text-destructive/);
    expect(deleteButton.className).toMatch(/hover:bg-destructive\/10/);
    expect(deleteButton.className).toMatch(/hover:text-destructive/);
  });

  it("applies custom className when provided", () => {
    // Arrange & Act
    const { container } = render(
      <MessageActionButtons
        isOwn={false}
        showThreadButton={true}
        onReply={mockOnReply}
        className="custom-class"
      />
    );

    // Assert
    const buttonContainer = container.querySelector('[data-slot="message-action-buttons"]');
    expect(buttonContainer).toHaveClass("custom-class");
  });

  it("has hover/focus opacity transitions", () => {
    // Arrange & Act
    const { container } = render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
      />
    );

    // Assert
    const buttonContainer = container.querySelector('[data-slot="message-action-buttons"]');
    expect(buttonContainer?.className).toMatch(/opacity-0/);
    expect(buttonContainer?.className).toMatch(/group-hover:opacity-100/);
    expect(buttonContainer?.className).toMatch(/focus-within:opacity-100/);
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("works without callback props (buttons still render)", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        // No callbacks provided
      />
    );

    // Assert - Buttons should still render
    expect(screen.getByRole("button", { name: /reply in thread/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete message/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more actions/i })).toBeInTheDocument();
  });

  it("handles rapid clicks correctly", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Act - Click reply button 3 times rapidly
    const replyButton = screen.getByRole("button", { name: /reply in thread/i });
    await user.click(replyButton);
    await user.click(replyButton);
    await user.click(replyButton);

    // Assert
    expect(mockOnReply).toHaveBeenCalledTimes(3);
  });

  it("renders all button variants correctly", () => {
    // Arrange & Act
    render(
      <MessageActionButtons
        isOwn={true}
        showThreadButton={true}
        onReply={mockOnReply}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Assert - All buttons should have ghost variant and icon size
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("data-variant", "ghost");
      expect(button).toHaveAttribute("data-size", "icon");
    });
  });
});
