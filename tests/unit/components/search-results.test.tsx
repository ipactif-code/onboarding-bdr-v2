import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SearchResults } from "@/components/messaging/search-results";
import type { SearchResult } from "@/hooks/use-message-search";

// ============================================================================
// Mocks
// ============================================================================

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
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

const createMockResult = (overrides?: Partial<SearchResult>): SearchResult => ({
  _id: "msg1" as any,
  content: "Hello world",
  senderId: "user1" as any,
  senderName: "John Doe",
  channelId: "ch1" as any,
  channelName: "general",
  createdAt: Date.now(),
  contentType: "text",
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("SearchResults", () => {
  const mockOnLoadMore = vi.fn();
  const mockOnResultClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders list of search results", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ _id: "msg1" as any, senderName: "Alice", content: "First message" }),
      createMockResult({ _id: "msg2" as any, senderName: "Bob", content: "Second message" }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/first message/i)).toBeInTheDocument();
    expect(screen.getByText(/second message/i)).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true and no results", () => {
    // Arrange & Act
    const { container } = render(
      <SearchResults
        query="test"
        results={[]}
        isLoading={true}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);

    // Check for loading state aria attributes
    const loadingContainer = container.querySelector('[aria-busy="true"]');
    expect(loadingContainer).toBeInTheDocument();
    expect(screen.getByText(/searching messages/i)).toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    // Arrange & Act
    render(
      <SearchResults
        query="test"
        results={[]}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText(/no messages found/i)).toBeInTheDocument();
    expect(screen.getByText(/try different keywords/i)).toBeInTheDocument();
    expect(screen.getByTestId("message-square-icon")).toBeInTheDocument();
  });

  it("displays results count", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ _id: "msg1" as any }),
      createMockResult({ _id: "msg2" as any }),
      createMockResult({ _id: "msg3" as any }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText("3 results found")).toBeInTheDocument();
  });

  it("shows singular result label for single result", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText("1 result found")).toBeInTheDocument();
  });

  // ==========================================================================
  // Highlighting Tests
  // ==========================================================================

  it("highlights search query in content", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ content: "This is a test message" }),
    ];

    // Act
    const { container } = render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert - The word "test" should be wrapped in a <mark> element
    const mark = container.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark?.textContent).toBe("test");
  });

  it("highlights multiple query words", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ content: "hello world and hello again" }),
    ];

    // Act
    const { container } = render(
      <SearchResults
        query="hello world"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert - Both words should be highlighted
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Load More Tests
  // ==========================================================================

  it("shows Load More button when hasMore is true", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: /load more results/i })).toBeInTheDocument();
  });

  it("does not show Load More button when hasMore is false", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.queryByRole("button", { name: /load more results/i })).not.toBeInTheDocument();
  });

  it("calls onLoadMore when Load More is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const results: SearchResult[] = [createMockResult()];

    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Act
    const loadMoreButton = screen.getByRole("button", { name: /load more results/i });
    await user.click(loadMoreButton);

    // Assert
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  it("disables Load More button while loading", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={true}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    const loadMoreButton = screen.getByRole("button", { name: /loading/i });
    expect(loadMoreButton).toBeDisabled();
    // Multiple loader icons may be present (button + pagination indicator)
    const loaders = screen.getAllByTestId("loader-icon");
    expect(loaders.length).toBeGreaterThan(0);
  });

  it("shows more available indicator in results count", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText("1 result found (more available)")).toBeInTheDocument();
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("calls onResultClick when result is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const results: SearchResult[] = [
      createMockResult({ _id: "msg123" as any, content: "Test message" }),
    ];

    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Act - Click on the result item (it has role="option")
    const resultItem = screen.getByRole("option");
    await user.click(resultItem);

    // Assert
    expect(mockOnResultClick).toHaveBeenCalledTimes(1);
    expect(mockOnResultClick).toHaveBeenCalledWith("msg123");
  });

  it("supports keyboard navigation with Enter key", async () => {
    // Arrange
    const user = userEvent.setup();
    const results: SearchResult[] = [
      createMockResult({ _id: "msg456" as any }),
    ];

    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Act
    const resultItem = screen.getByRole("option");
    resultItem.focus();
    await user.keyboard("{Enter}");

    // Assert
    expect(mockOnResultClick).toHaveBeenCalledWith("msg456");
  });

  it("supports keyboard navigation with Space key", async () => {
    // Arrange
    const user = userEvent.setup();
    const results: SearchResult[] = [
      createMockResult({ _id: "msg789" as any }),
    ];

    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Act
    const resultItem = screen.getByRole("option");
    resultItem.focus();
    await user.keyboard(" ");

    // Assert
    expect(mockOnResultClick).toHaveBeenCalledWith("msg789");
  });

  // ==========================================================================
  // Content Display Tests
  // ==========================================================================

  it("shows sender name and channel name", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({
        senderName: "Alice Smith",
        channelName: "engineering",
      }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("engineering")).toBeInTheDocument();
    expect(screen.getByTestId("hash-icon")).toBeInTheDocument();
  });

  it("shows direct message label when no channel", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({
        channelId: undefined,
        channelName: undefined,
        conversationId: "conv1" as any,
      }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText(/direct message/i)).toBeInTheDocument();
  });

  it("formats timestamp correctly", () => {
    // Arrange
    const timestamp = Date.now();
    const results: SearchResult[] = [
      createMockResult({ createdAt: timestamp }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert - Check that formatTimestamp was called (shows time)
    const formattedTime = new Date(timestamp).toLocaleTimeString();
    expect(screen.getByText(formattedTime)).toBeInTheDocument();
  });

  it("displays avatar with initials fallback", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ senderName: "Jane Doe", senderAvatarUrl: undefined }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("J");
  });

  it("displays avatar image when URL is provided", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({
        senderName: "Jane Doe",
        senderAvatarUrl: "https://example.com/avatar.jpg",
      }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    const avatarImage = screen.getByTestId("avatar-image");
    expect(avatarImage).toHaveAttribute("src", "https://example.com/avatar.jpg");
    expect(avatarImage).toHaveAttribute("alt", "Jane Doe");
  });

  // ==========================================================================
  // Content Type Badge Tests
  // ==========================================================================

  it("shows voice message badge for voice content", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ contentType: "voice", content: "[Voice message]" }),
    ];

    // Act
    const { container } = render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert - Check for the badge specifically (not the content text)
    const badge = container.querySelector('.bg-violet-100');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toMatch(/voice message/i);
  });

  it("shows file attachment badge for file content", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ contentType: "file", content: "document.pdf" }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.getByText(/file attachment/i)).toBeInTheDocument();
  });

  it("does not show badge for text messages", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({ contentType: "text", content: "Regular text" }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    expect(screen.queryByText(/voice message/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/file attachment/i)).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper listbox ARIA role", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    const { container } = render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute("aria-label", "Search results");
  });

  it("has proper option ARIA role on items", () => {
    // Arrange
    const results: SearchResult[] = [createMockResult()];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "false");
    expect(option).toHaveAttribute("tabIndex", "0");
  });

  it("has descriptive aria-label for result items", () => {
    // Arrange
    const results: SearchResult[] = [
      createMockResult({
        senderName: "Alice",
        channelName: "general",
      }),
    ];

    // Act
    render(
      <SearchResults
        query="test"
        results={results}
        isLoading={false}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-label", "Message from Alice in general");
  });

  it("has proper status role for loading state", () => {
    // Arrange & Act
    const { container } = render(
      <SearchResults
        query="test"
        results={[]}
        isLoading={true}
        hasMore={false}
        onLoadMore={mockOnLoadMore}
        onResultClick={mockOnResultClick}
      />
    );

    // Assert - Multiple status roles may be present
    const statusElements = container.querySelectorAll('[role="status"]');
    expect(statusElements.length).toBeGreaterThan(0);

    // Check for aria-live and aria-busy on at least one status element
    const ariaLiveElements = container.querySelectorAll('[aria-live="polite"]');
    expect(ariaLiveElements.length).toBeGreaterThan(0);

    const ariaBusyElements = container.querySelectorAll('[aria-busy="true"]');
    expect(ariaBusyElements.length).toBeGreaterThan(0);
  });
});
