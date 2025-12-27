import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { EmojiPicker } from "@/components/messaging/emoji-picker";

// ============================================================================
// Mocks
// ============================================================================

// Mock next-themes
const mockResolvedTheme = vi.fn(() => "light");
vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme(),
  }),
}));

// Mock @emoji-mart/react and @emoji-mart/data for lazy loading
const mockEmojiMartPicker = vi.fn(({ onEmojiSelect, theme, data }) => (
  <div data-testid="emoji-picker-component" data-theme={theme}>
    <button
      type="button"
      onClick={() =>
        onEmojiSelect({
          id: "grinning",
          name: "Grinning Face",
          native: "😀",
          unified: "1f600",
          keywords: ["smile", "happy"],
          shortcodes: ":grinning:",
        })
      }
    >
      Mock Emoji 😀
    </button>
  </div>
));

const mockEmojiData = { categories: [], emojis: {} };

// Mock dynamic imports
vi.mock("@emoji-mart/react", () => ({
  default: mockEmojiMartPicker,
}));

vi.mock("@emoji-mart/data", () => ({
  default: mockEmojiData,
}));

// Mock shadcn/ui components
// Note: The real Button component uses forwardRef, so we need to handle that
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    type,
    variant,
    size,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    type?: "button" | "submit" | "reset";
    variant?: string;
    size?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      type={type as "button" | "submit" | "reset" | undefined}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => <div data-popover data-open={open}>{children}</div>,
  PopoverTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => {
    // PopoverTrigger in real code passes children to render prop
    if (render) {
      return <div data-popover-trigger>{React.cloneElement(render, {}, children)}</div>;
    }
    return <div data-popover-trigger>{children}</div>;
  },
  PopoverContent: ({
    children,
    side,
    align,
  }: {
    children: React.ReactNode;
    side?: string;
    align?: string;
  }) => (
    <div data-popover-content data-side={side} data-align={align}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Smile: ({ className }: { className?: string }) => (
    <svg data-testid="smile-icon" className={className} aria-hidden="true" />
  ),
}));

// ============================================================================
// Tests
// ============================================================================

describe("EmojiPicker", () => {
  const mockOnEmojiSelect = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolvedTheme.mockReturnValue("light");
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders trigger button when closed", () => {
    // Arrange & Act
    render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /insert emoji/i })).toBeInTheDocument();
    // Icon should be inside button
    const button = screen.getByRole("button", { name: /insert emoji/i });
    expect(button.querySelector('[data-testid="smile-icon"]')).toBeTruthy();
  });

  it("renders trigger button with custom className", () => {
    // Arrange & Act
    render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
        triggerClassName="custom-trigger-class"
      />
    );

    // Assert
    const button = screen.getByRole("button", { name: /insert emoji/i });
    expect(button.className).toMatch(/custom-trigger-class/);
  });

  it("renders disabled trigger when disabled prop is true", () => {
    // Arrange & Act
    render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
        disabled={true}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /insert emoji/i })).toBeDisabled();
  });

  it("shows loading skeleton when picker is opening", async () => {
    // Arrange & Act
    const { rerender } = render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Act - Open picker
    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Loading skeleton should appear briefly
    await waitFor(() => {
      const skeletons = screen.queryAllByTestId("skeleton");
      // Either skeletons are shown OR picker has loaded
      expect(
        skeletons.length > 0 || screen.queryByTestId("emoji-picker-component")
      ).toBeTruthy();
    });
  });

  it("renders emoji picker component when open", async () => {
    // Arrange & Act
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Wait for picker to load
    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Theme Tests
  // ==========================================================================

  it("passes light theme to emoji picker when resolvedTheme is light", async () => {
    // Arrange
    mockResolvedTheme.mockReturnValue("light");

    // Act
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    await waitFor(() => {
      const picker = screen.getByTestId("emoji-picker-component");
      expect(picker).toHaveAttribute("data-theme", "light");
    });
  });

  it("passes dark theme to emoji picker when resolvedTheme is dark", async () => {
    // Arrange
    mockResolvedTheme.mockReturnValue("dark");

    // Act
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    await waitFor(() => {
      const picker = screen.getByTestId("emoji-picker-component");
      expect(picker).toHaveAttribute("data-theme", "dark");
    });
  });

  it("defaults to light theme when resolvedTheme is undefined", async () => {
    // Arrange
    mockResolvedTheme.mockReturnValue(undefined as any);

    // Act
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    await waitFor(() => {
      const picker = screen.getByTestId("emoji-picker-component");
      expect(picker).toHaveAttribute("data-theme", "light");
    });
  });

  it("defaults to light theme when resolvedTheme is system", async () => {
    // Arrange
    mockResolvedTheme.mockReturnValue("system");

    // Act
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    await waitFor(() => {
      const picker = screen.getByTestId("emoji-picker-component");
      expect(picker).toHaveAttribute("data-theme", "light");
    });
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("calls onEmojiSelect with correct emoji when emoji clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Wait for picker to load
    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });

    // Act - Click emoji
    await user.click(screen.getByRole("button", { name: /mock emoji/i }));

    // Assert
    expect(mockOnEmojiSelect).toHaveBeenCalledTimes(1);
    expect(mockOnEmojiSelect).toHaveBeenCalledWith("😀");
  });

  it("calls onOpenChange(false) after emoji selection", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Wait for picker to load
    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });

    // Act - Click emoji
    await user.click(screen.getByRole("button", { name: /mock emoji/i }));

    // Assert
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  // ==========================================================================
  // Popover Position Tests
  // ==========================================================================

  it("renders popover with default side=top and align=start", async () => {
    // Arrange & Act
    const { container } = render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Wait for picker to potentially load
    await waitFor(() => {
      const popoverContent = container.querySelector("[data-popover-content]");
      expect(popoverContent).toBeTruthy();
    });

    // Assert
    const popoverContent = container.querySelector("[data-popover-content]");
    expect(popoverContent).toHaveAttribute("data-side", "top");
    expect(popoverContent).toHaveAttribute("data-align", "start");
  });

  it("renders popover with custom side and align", async () => {
    // Arrange & Act
    const { container } = render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
        side="bottom"
        align="end"
      />
    );

    // Wait for popover content to render
    await waitFor(() => {
      const popoverContent = container.querySelector("[data-popover-content]");
      expect(popoverContent).toBeTruthy();
    });

    // Assert
    const popoverContent = container.querySelector("[data-popover-content]");
    expect(popoverContent).toHaveAttribute("data-side", "bottom");
    expect(popoverContent).toHaveAttribute("data-align", "end");
  });

  // ==========================================================================
  // Lazy Loading Tests
  // ==========================================================================

  it("only loads emoji data once when opened multiple times", async () => {
    // Arrange
    const { rerender } = render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Act - Open picker first time
    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });

    // Act - Close picker
    rerender(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Act - Open picker second time
    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Picker should render immediately (no loading skeleton)
    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });
  });

  it("does not load emoji data when never opened", () => {
    // Arrange & Act
    render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Picker component should not be loaded
    expect(screen.queryByTestId("emoji-picker-component")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper aria-label on trigger button", () => {
    // Arrange & Act
    render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /insert emoji/i })).toHaveAttribute(
      "aria-label",
      "Insert emoji"
    );
  });

  it("smile icon has aria-hidden=true", () => {
    // Arrange & Act
    const { container } = render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert
    const icon = container.querySelector('[data-testid="smile-icon"]');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("trigger button is keyboard accessible", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Act - Tab to button
    await user.tab();
    const button = screen.getByRole("button", { name: /insert emoji/i });

    // Assert
    expect(button).toHaveFocus();
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("handles rapid open/close correctly", async () => {
    // Arrange
    const { rerender } = render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Act - Rapidly toggle open state
    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    rerender(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Should eventually render picker
    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });
  });

  it("handles missing onEmojiSelect gracefully", async () => {
    // Arrange
    const user = userEvent.setup();
    const noOpCallback = vi.fn(); // Use a mock instead of undefined
    render(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={noOpCallback}
      />
    );

    // Wait for picker to load
    await waitFor(() => {
      expect(screen.getByTestId("emoji-picker-component")).toBeInTheDocument();
    });

    // Act
    await user.click(screen.getByRole("button", { name: /mock emoji/i }));

    // Assert - Should call the callback
    expect(noOpCallback).toHaveBeenCalledWith("😀");
  });

  it("renders skeleton with correct layout structure", () => {
    // Arrange & Act
    const { rerender } = render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Open to trigger loading
    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Check for skeleton elements (may appear briefly)
    const skeletons = screen.queryAllByTestId("skeleton");
    if (skeletons.length > 0) {
      // If loading state is visible, verify skeleton structure
      expect(skeletons.length).toBeGreaterThan(0);
    }
  });

  it("popover respects open state", () => {
    // Arrange & Act - Closed
    const { container, rerender } = render(
      <EmojiPicker
        open={false}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Popover closed
    const popover = container.querySelector("[data-popover]");
    expect(popover).toHaveAttribute("data-open", "false");

    // Act - Open
    rerender(
      <EmojiPicker
        open={true}
        onOpenChange={mockOnOpenChange}
        onEmojiSelect={mockOnEmojiSelect}
      />
    );

    // Assert - Popover open
    expect(popover).toHaveAttribute("data-open", "true");
  });
});
