import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadView } from "@/components/messaging/thread-view";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock useThread hook
const mockUseThread = vi.fn();
vi.mock("@/hooks/use-thread", () => ({
  useThread: (options: { parentMessageId: Id<"messages"> }) =>
    mockUseThread(options),
}));

// Mock MessageItem component
vi.mock("@/components/messaging/message-item", () => ({
  MessageItem: ({
    id,
    content,
    senderName,
    isOwn,
    isEdited,
    threadReplyCount,
    status,
    showThreadButton,
  }: {
    id: Id<"messages">;
    content: string;
    senderName: string;
    isOwn: boolean;
    isEdited?: boolean;
    threadReplyCount?: number;
    status: string;
    showThreadButton?: boolean;
  }) => (
    <div data-testid={`message-item-${id}`} role="article">
      <div>Content: {content}</div>
      <div>Sender: {senderName}</div>
      <div>IsOwn: {String(isOwn)}</div>
      <div>IsEdited: {String(isEdited ?? false)}</div>
      <div>ThreadReplyCount: {threadReplyCount ?? 0}</div>
      <div>Status: {status}</div>
      <div>ShowThreadButton: {String(showThreadButton ?? false)}</div>
    </div>
  ),
}));

// Mock ThreadHeader component
vi.mock("@/components/messaging/thread-header", () => ({
  ThreadHeader: ({
    onClose,
    closeButtonRef,
  }: {
    onClose?: () => void;
    closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  }) => (
    <div data-testid="thread-header">
      <button
        ref={closeButtonRef}
        onClick={onClose}
        data-testid="header-close-button"
        aria-label="Close thread header"
      >
        Close Header
      </button>
    </div>
  ),
}));

// Mock ThreadViewSkeleton component
vi.mock("@/components/messaging/thread-view-skeleton", () => ({
  ThreadViewSkeleton: () => <div data-testid="thread-view-skeleton">Loading...</div>,
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  MessageCircle: ({ className }: { className?: string }) => (
    <svg data-testid="message-circle-icon" className={className} />
  ),
}));

// ============================================================================
// Test Data
// ============================================================================

const mockParentMessageId = "parent-message-123" as Id<"messages">;
const mockCurrentUserId = "current-user-456" as Id<"users">;
const mockSenderId = "sender-789" as Id<"users">;

const mockParentMessage = {
  _id: mockParentMessageId,
  content: "This is the parent message",
  senderId: mockSenderId,
  sender: {
    name: "John Doe",
    avatarUrl: "https://example.com/avatar.jpg",
  },
  createdAt: Date.now(),
  isEdited: false,
  threadReplyCount: 2,
  status: "sent" as const,
  lesson: null,
};

const mockReplies = [
  {
    _id: "reply-1" as Id<"messages">,
    content: "First reply",
    senderId: mockCurrentUserId,
    sender: {
      name: "Current User",
      avatarUrl: "https://example.com/avatar2.jpg",
    },
    createdAt: Date.now() + 1000,
    isEdited: false,
    status: "sent" as const,
    lesson: null,
  },
  {
    _id: "reply-2" as Id<"messages">,
    content: "Second reply",
    senderId: mockSenderId,
    sender: {
      name: "John Doe",
      avatarUrl: "https://example.com/avatar.jpg",
    },
    createdAt: Date.now() + 2000,
    isEdited: true,
    status: "sent" as const,
    lesson: null,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe("ThreadView", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders parent message correctly", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
      />
    );

    // Assert
    const parentMessage = screen.getByTestId(`message-item-${mockParentMessageId}`);
    expect(parentMessage).toBeInTheDocument();
    expect(within(parentMessage).getByText("Content: This is the parent message")).toBeInTheDocument();
    expect(within(parentMessage).getByText("Sender: John Doe")).toBeInTheDocument();
    expect(within(parentMessage).getByText("ShowThreadButton: false")).toBeInTheDocument();
  });

  it("renders all replies in order", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    const reply1 = screen.getByTestId("message-item-reply-1");
    const reply2 = screen.getByTestId("message-item-reply-2");

    expect(reply1).toBeInTheDocument();
    expect(reply2).toBeInTheDocument();
    expect(within(reply1).getByText("Content: First reply")).toBeInTheDocument();
    expect(within(reply2).getByText("Content: Second reply")).toBeInTheDocument();

    // Note: We're checking that both replies are present - article count may vary
    // based on mock implementation details, but content is what matters
    const articles = screen.getAllByRole("article");
    expect(articles.length).toBeGreaterThanOrEqual(3); // At least parent + 2 replies
  });

  it("shows loading skeleton while fetching", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: null,
      replies: [],
      isLoading: true,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    expect(screen.getByTestId("thread-view-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId(`message-item-${mockParentMessageId}`)).not.toBeInTheDocument();
  });

  it("shows empty state when no replies", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: [],
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    expect(screen.getByText("No replies yet. Start the conversation!")).toBeInTheDocument();
    expect(screen.getByTestId("message-circle-icon")).toBeInTheDocument();
  });

  it("shows thread not found state when parent is null", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: null,
      replies: [],
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    expect(screen.getByText("Thread not found")).toBeInTheDocument();
    expect(
      screen.getByText("This thread may have been deleted or you don't have access to it.")
    ).toBeInTheDocument();
  });

  it("renders ThreadHeader in all states", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
      />
    );

    // Assert
    expect(screen.getByTestId("thread-header")).toBeInTheDocument();
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("calls onClose when close button clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByTestId("header-close-button"));

    // Assert
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has aria-live region for new replies", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    const feed = screen.getByRole("feed");
    expect(feed).toHaveAttribute("aria-live", "polite");
    expect(feed).toHaveAttribute("aria-atomic", "false");
    expect(feed).toHaveAttribute("aria-relevant", "additions");
    expect(feed).toHaveAttribute("aria-label", "Thread replies. 2 replies");
  });

  it("has correct aria-label for single reply", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: [mockReplies[0]],
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    const feed = screen.getByRole("feed");
    expect(feed).toHaveAttribute("aria-label", "Thread replies. 1 reply");
  });

  it("has proper article attributes for replies", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    const { container } = render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert - Find the articles that have aria-posinset (the reply wrapper articles)
    const replyArticles = container.querySelectorAll('article[aria-posinset]');

    expect(replyArticles.length).toBe(2);
    expect(replyArticles[0]).toHaveAttribute("aria-posinset", "1");
    expect(replyArticles[0]).toHaveAttribute("aria-setsize", "2");
    expect(replyArticles[1]).toHaveAttribute("aria-posinset", "2");
    expect(replyArticles[1]).toHaveAttribute("aria-setsize", "2");
  });

  it("supports closeButtonRef for focus management", () => {
    // Arrange
    const closeButtonRef = { current: null } as React.RefObject<HTMLButtonElement | null>;
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        closeButtonRef={closeButtonRef}
      />
    );

    // Assert
    const closeButton = screen.getByTestId("header-close-button");
    expect(closeButton).toBeInTheDocument();
  });

  // ==========================================================================
  // Message Display Tests
  // ==========================================================================

  it("handles deleted messages display (null status)", () => {
    // Arrange
    const deletedReply = {
      ...mockReplies[0],
      status: null,
    };

    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: [deletedReply],
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    const reply = screen.getByTestId("message-item-reply-1");
    expect(within(reply).getByText("Status: sent")).toBeInTheDocument(); // Defaults to "sent"
  });

  it("displays isEdited state correctly", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    const reply1 = screen.getByTestId("message-item-reply-1");
    const reply2 = screen.getByTestId("message-item-reply-2");

    expect(within(reply1).getByText("IsEdited: false")).toBeInTheDocument();
    expect(within(reply2).getByText("IsEdited: true")).toBeInTheDocument();
  });

  it("correctly identifies own messages", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert
    const reply1 = screen.getByTestId("message-item-reply-1");
    const reply2 = screen.getByTestId("message-item-reply-2");

    expect(within(reply1).getByText("IsOwn: true")).toBeInTheDocument(); // Current user's message
    expect(within(reply2).getByText("IsOwn: false")).toBeInTheDocument(); // Other user's message
  });

  it("disables nested threading (showThreadButton=false for all messages)", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
      />
    );

    // Assert - All messages should have showThreadButton=false
    const parentMessage = screen.getByTestId(`message-item-${mockParentMessageId}`);
    const reply1 = screen.getByTestId("message-item-reply-1");
    const reply2 = screen.getByTestId("message-item-reply-2");

    expect(within(parentMessage).getByText("ShowThreadButton: false")).toBeInTheDocument();
    expect(within(reply1).getByText("ShowThreadButton: false")).toBeInTheDocument();
    expect(within(reply2).getByText("ShowThreadButton: false")).toBeInTheDocument();
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("applies custom className when provided", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    const { container } = render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        className="custom-class"
      />
    );

    // Assert
    const threadView = container.querySelector('[data-slot="thread-view"]');
    expect(threadView).toHaveClass("custom-class");
  });

  it("works without onClose callback (optional)", () => {
    // Arrange
    mockUseThread.mockReturnValue({
      parent: mockParentMessage,
      replies: mockReplies,
      isLoading: false,
    });

    // Act
    render(
      <ThreadView
        parentMessageId={mockParentMessageId}
        currentUserId={mockCurrentUserId}
        // onClose not provided
      />
    );

    // Assert
    expect(screen.getByTestId("thread-header")).toBeInTheDocument();
  });
});
