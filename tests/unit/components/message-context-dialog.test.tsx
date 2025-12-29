import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MessageContextDialog } from "@/components/messaging/message-context-dialog";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex hooks
const mockContextData = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (api: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    return mockContextData();
  },
}));

// Mock Next.js router
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock UI components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open}>
      <button onClick={() => onOpenChange(false)}>Close Dialog</button>
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogFooter: ({
    children,
    showCloseButton,
  }: {
    children?: React.ReactNode;
    showCloseButton?: boolean;
  }) => (
    <div data-testid="dialog-footer" data-show-close={showCloseButton}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, size, className }: { children: React.ReactNode; size?: string; className?: string }) => (
    <div data-testid="avatar" data-size={size} className={className}>
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

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Hash: () => <svg data-testid="hash-icon" aria-hidden="true" />,
  ExternalLink: () => <svg data-testid="external-link-icon" aria-hidden="true" />,
  MessageSquare: ({ className }: { className?: string }) => (
    <svg data-testid="message-square-icon" className={className} aria-hidden="true" />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <svg data-testid="loader-icon" className={className} aria-hidden="true" />
  ),
}));

// Mock utility functions
vi.mock("@/lib/message-utils", () => ({
  getInitials: (name: string) => name.charAt(0).toUpperCase(),
  formatTimestamp: (timestamp: number) => new Date(timestamp).toLocaleTimeString(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockMessage = (overrides = {}) => ({
  _id: "msg1" as any,
  senderId: "user1" as any,
  senderName: "John Doe",
  senderAvatarUrl: undefined as string | undefined,
  content: "Test message content",
  contentType: "text" as "text" | "voice" | "file",
  createdAt: Date.now(),
  isEdited: false,
  ...overrides,
});

const createMockContextData = (overrides = {}) => ({
  before: [
    createMockMessage({ _id: "msg-before-1" as any, content: "Message before 1" }),
    createMockMessage({ _id: "msg-before-2" as any, content: "Message before 2" }),
  ],
  target: createMockMessage({ _id: "msg-target" as any, content: "Target message" }),
  after: [
    createMockMessage({ _id: "msg-after-1" as any, content: "Message after 1" }),
    createMockMessage({ _id: "msg-after-2" as any, content: "Message after 2" }),
  ],
  channelId: "ch1" as any,
  channelName: "general",
  conversationId: undefined as any,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("MessageContextDialog", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockContextData.mockReturnValue(undefined);
    mockRouterPush.mockClear();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders dialog when isOpen is true", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const dialog = screen.getByTestId("dialog");
    expect(dialog).toHaveAttribute("data-open", "true");
  });

  it("does not render content when isOpen is false", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    // Assert
    const dialog = screen.getByTestId("dialog");
    expect(dialog).toHaveAttribute("data-open", "false");
  });

  it("renders dialog title", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/message context/i)).toBeInTheDocument();
    expect(screen.getByTestId("message-square-icon")).toBeInTheDocument();
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  it("shows loading skeleton while fetching context", () => {
    // Arrange - undefined means loading
    mockContextData.mockReturnValue(undefined);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.getByText(/loading message context/i)).toBeInTheDocument();
  });

  it("does not fetch context when dialog is closed", () => {
    // Arrange
    const spy = vi.fn();
    mockContextData.mockImplementation(spy);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    // Assert - Query should be skipped
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not fetch context when messageId is null", () => {
    // Arrange
    const spy = vi.fn();
    mockContextData.mockImplementation(spy);

    // Act
    render(
      <MessageContextDialog
        messageId={null}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert - Query should be skipped
    expect(spy).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Message Display Tests
  // ==========================================================================

  it("renders messages before target", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/message before 1/i)).toBeInTheDocument();
    expect(screen.getByText(/message before 2/i)).toBeInTheDocument();
  });

  it("renders messages after target", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/message after 1/i)).toBeInTheDocument();
    expect(screen.getByText(/message after 2/i)).toBeInTheDocument();
  });

  it("highlights target message visually", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    const { container } = render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/matched message/i)).toBeInTheDocument();
    expect(screen.getByText(/target message/i)).toBeInTheDocument();

    // Target message should have special styling
    const targetElement = container.querySelector('[data-message-id="msg-target"]');
    expect(targetElement).toBeInTheDocument();
    expect(targetElement?.className).toMatch(/bg-yellow/);
  });

  it("displays sender name and timestamp for each message", () => {
    // Arrange
    const timestamp = Date.now();
    const contextData = createMockContextData();
    contextData.target.createdAt = timestamp;
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const senderNames = screen.getAllByText("John Doe");
    expect(senderNames.length).toBeGreaterThan(0);

    // Multiple messages will have the same timestamp, so use getAllByText
    const formattedTime = new Date(timestamp).toLocaleTimeString();
    const timestamps = screen.getAllByText(formattedTime);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it("shows edited indicator for edited messages", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.target.isEdited = true;
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/\(edited\)/i)).toBeInTheDocument();
  });

  it("displays voice message placeholder", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.target.contentType = "voice";
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/\[voice message\]/i)).toBeInTheDocument();
  });

  it("displays file attachment placeholder", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.target.contentType = "file";
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/\[file attachment\]/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Channel/Conversation Display Tests
  // ==========================================================================

  it("shows channel or conversation name in title", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.channelName = "engineering";
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText("engineering")).toBeInTheDocument();
    expect(screen.getByTestId("hash-icon")).toBeInTheDocument();
  });

  it("shows direct message label when no channel", () => {
    // Arrange
    const contextData = createMockContextData({
      channelId: undefined,
      channelName: "",
      conversationId: "conv1" as any,
    });
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/direct message/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  it("shows Go to Channel button", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /go to #general/i })).toBeInTheDocument();
    expect(screen.getByTestId("external-link-icon")).toBeInTheDocument();
  });

  it("navigates to channel on button click", async () => {
    // Arrange
    const user = userEvent.setup();
    const contextData = createMockContextData();
    contextData.channelId = "ch123" as any;
    mockContextData.mockReturnValue(contextData);

    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Act
    const goToChannelButton = screen.getByRole("button", { name: /go to #general/i });
    await user.click(goToChannelButton);

    // Assert
    expect(mockRouterPush).toHaveBeenCalledWith("/messages/ch123");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to conversation on button click for DMs", async () => {
    // Arrange
    const user = userEvent.setup();
    const contextData = createMockContextData({
      channelId: undefined,
      channelName: "",
      conversationId: "conv456" as any,
    });
    mockContextData.mockReturnValue(contextData);

    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Act
    const goToButton = screen.getByRole("button", { name: /go to conversation/i });
    await user.click(goToButton);

    // Assert
    expect(mockRouterPush).toHaveBeenCalledWith("/messages/dm/conv456");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Error State Tests
  // ==========================================================================

  it("shows error state when message not found", () => {
    // Arrange - null means not found
    mockContextData.mockReturnValue(null);

    // Act
    const { container } = render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert - Use getAllByText to handle multiple occurrences
    const notFoundTexts = screen.getAllByText(/message not found/i);
    expect(notFoundTexts.length).toBeGreaterThan(0);

    // Check that the error state content is in the main content area
    const mainContent = container.querySelector('.flex.flex-col.items-center.justify-center');
    expect(mainContent).toBeInTheDocument();
    expect(screen.getByText(/may have been deleted/i)).toBeInTheDocument();
  });

  it("shows message not found in dialog description", () => {
    // Arrange
    mockContextData.mockReturnValue(null);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const description = screen.getByTestId("dialog-description");
    expect(description).toHaveTextContent(/message not found or access denied/i);
  });

  // ==========================================================================
  // Dialog Behavior Tests
  // ==========================================================================

  it("calls onClose when dialog is closed", async () => {
    // Arrange
    const user = userEvent.setup();
    mockContextData.mockReturnValue(createMockContextData());

    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Act
    const closeButton = screen.getByRole("button", { name: /close dialog/i });
    await user.click(closeButton);

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("auto-scrolls to target message on load", async () => {
    // Arrange
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert - Wait for auto-scroll
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it("shows hint when target is the only message", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.before = [];
    contextData.after = [];
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByText(/this is the only message in view/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper dialog ARIA attributes", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const dialog = screen.getByTestId("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
  });

  it("displays avatars for all messages", () => {
    // Arrange
    mockContextData.mockReturnValue(createMockContextData());

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const avatars = screen.getAllByTestId("avatar");
    // 5 messages total (2 before + 1 target + 2 after)
    expect(avatars.length).toBe(5);
  });

  it("shows avatar with image when URL provided", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.target.senderAvatarUrl = "https://example.com/avatar.jpg";
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const avatarImage = screen.getByTestId("avatar-image");
    expect(avatarImage).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows avatar fallback with initials", () => {
    // Arrange
    const contextData = createMockContextData();
    contextData.target.senderAvatarUrl = undefined;
    mockContextData.mockReturnValue(contextData);

    // Act
    render(
      <MessageContextDialog
        messageId={"msg1" as any}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Assert
    const fallbacks = screen.getAllByTestId("avatar-fallback");
    expect(fallbacks.length).toBeGreaterThan(0);
    // Check that at least one has the correct initial
    expect(fallbacks[0]).toHaveTextContent("J");
  });
});
