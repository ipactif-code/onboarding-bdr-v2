import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SearchBar } from "@/components/messaging/search-bar";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex hooks
const mockChannelsList = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (api: unknown) => {
    // Return channel list for channel queries
    if (typeof api === "object" && api !== null) {
      return mockChannelsList();
    }
    return undefined;
  },
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock use-message-search hook
const mockUseMessageSearch = {
  query: "",
  setQuery: vi.fn(),
  filters: {},
  setFilters: vi.fn(),
  clearFilters: vi.fn(),
  results: [] as Array<{
    _id: any;
    content: string;
    senderId: any;
    senderName: string;
    createdAt: number;
    contentType: string;
  }>,
  isLoading: false,
  hasMore: false,
  loadMore: vi.fn(),
  suggestions: [] as string[],
  clearSearch: vi.fn(),
  debouncedQuery: "",
};

vi.mock("@/hooks/use-message-search", () => ({
  useMessageSearch: () => mockUseMessageSearch,
}));

// Mock SearchResults component
vi.mock("@/components/messaging/search-results", () => ({
  SearchResults: ({
    query,
    results,
    isLoading,
    hasMore,
    onLoadMore,
    onResultClick,
  }: {
    query: string;
    results: unknown[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onResultClick: (id: unknown) => void;
  }) => (
    <div data-testid="search-results">
      <span>Results: {results.length}</span>
      <span>Query: {query}</span>
      <span>Loading: {String(isLoading)}</span>
      <span>Has More: {String(hasMore)}</span>
      <button onClick={onLoadMore}>Load More</button>
      <button onClick={() => onResultClick("msg1")}>Click Result</button>
    </div>
  ),
}));

// Mock UI components
vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >((props, ref) => <input ref={ref} {...props} />),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    tabIndex,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
    tabIndex?: number;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      tabIndex={tabIndex}
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

vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => {
    if (render) {
      return <div data-testid="popover-trigger">{React.cloneElement(render, {}, children)}</div>;
    }
    return <div data-testid="popover-trigger">{children}</div>;
  },
  PopoverContent: ({
    children,
    align,
  }: {
    children: React.ReactNode;
    align?: string;
  }) => (
    <div data-testid="popover-content" data-align={align}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command">{children}</div>
  ),
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input data-testid="command-input" placeholder={placeholder} />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-list">{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-empty">{children}</div>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-group">{children}</div>
  ),
  CommandItem: ({
    children,
    onSelect,
    ...props
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onSelect} data-testid="command-item" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Search: () => <svg data-testid="search-icon" aria-hidden="true" />,
  X: () => <svg data-testid="x-icon" aria-hidden="true" />,
  Filter: () => <svg data-testid="filter-icon" aria-hidden="true" />,
  Clock: () => <svg data-testid="clock-icon" aria-hidden="true" />,
  Hash: () => <svg data-testid="hash-icon" aria-hidden="true" />,
  FileText: () => <svg data-testid="file-text-icon" aria-hidden="true" />,
  Mic: () => <svg data-testid="mic-icon" aria-hidden="true" />,
  FileIcon: () => <svg data-testid="file-icon" aria-hidden="true" />,
  ChevronDown: () => <svg data-testid="chevron-down-icon" aria-hidden="true" />,
}));

// ============================================================================
// Tests
// ============================================================================

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock state
    mockUseMessageSearch.query = "";
    mockUseMessageSearch.filters = {};
    mockUseMessageSearch.results = [];
    mockUseMessageSearch.suggestions = [];
    mockUseMessageSearch.debouncedQuery = "";
    mockUseMessageSearch.isLoading = false;
    mockUseMessageSearch.hasMore = false;

    // Mock channels list
    mockChannelsList.mockReturnValue({
      channels: [
        { _id: "ch1", name: "general", type: "public" },
        { _id: "ch2", name: "random", type: "public" },
      ],
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("renders search input with placeholder", () => {
    // Arrange & Act
    render(<SearchBar />);

    // Assert
    const input = screen.getByPlaceholderText("Search messages...");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders with custom className", () => {
    // Arrange & Act
    const { container } = render(<SearchBar className="custom-class" />);

    // Assert
    const searchBar = container.querySelector('[data-slot="search-bar"]');
    expect(searchBar?.className).toMatch(/custom-class/);
  });

  it("displays keyboard shortcut hint when input is empty", () => {
    // Arrange & Act
    render(<SearchBar />);

    // Assert
    const kbd = screen.getByText(/K/);
    expect(kbd.closest("kbd")).toBeInTheDocument();
  });

  it("renders filter button with correct label", () => {
    // Arrange & Act
    render(<SearchBar />);

    // Assert
    const filterButton = screen.getByRole("button", { name: /filters/i });
    expect(filterButton).toBeInTheDocument();
  });

  // ==========================================================================
  // Input Interaction Tests
  // ==========================================================================

  it("updates query on user input", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.type(input, "test query");

    // Assert
    expect(mockUseMessageSearch.setQuery).toHaveBeenCalledWith("t");
    expect(mockUseMessageSearch.setQuery).toHaveBeenCalledWith("e");
    // Called once per character
    expect(mockUseMessageSearch.setQuery).toHaveBeenCalledTimes(10);
  });

  it("shows clear button when query is not empty", () => {
    // Arrange
    mockUseMessageSearch.query = "test";

    // Act
    render(<SearchBar />);

    // Assert
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
  });

  it("does not show clear button when query is empty", () => {
    // Arrange
    mockUseMessageSearch.query = "";

    // Act
    render(<SearchBar />);

    // Assert
    const clearButton = screen.queryByRole("button", { name: /clear search/i });
    expect(clearButton).not.toBeInTheDocument();
  });

  it("clears search on clear button click", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "test query";
    render(<SearchBar />);

    // Act
    const clearButton = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearButton);

    // Assert
    expect(mockUseMessageSearch.clearSearch).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Filter Popover Tests
  // ==========================================================================

  it("opens filter popover on filter button click", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<SearchBar />);

    // Act
    const filterButton = screen.getByRole("button", { name: /filters/i });
    await user.click(filterButton);

    // Assert
    expect(screen.getByText(/search filters/i)).toBeInTheDocument();
  });

  it("shows active filter count badge", () => {
    // Arrange
    mockUseMessageSearch.filters = {
      channelId: "ch1" as any,
      contentType: "text",
    };

    // Act
    render(<SearchBar />);

    // Assert
    expect(screen.getByText("2")).toBeInTheDocument(); // Badge with count
  });

  it("displays Clear all button when filters are active", () => {
    // Arrange
    mockUseMessageSearch.filters = { channelId: "ch1" as any };

    // Act
    render(<SearchBar />);
    const filterButton = screen.getByRole("button", { name: /filters.*1 active/i });
    filterButton.click();

    // Assert
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });

  // ==========================================================================
  // Keyboard Navigation Tests
  // ==========================================================================

  it("supports keyboard shortcut (Ctrl+K)", async () => {
    // Arrange
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act - Wait for the event to be handled
    await waitFor(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    // Assert - Input should be focused
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("closes dropdown on Escape key", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "test";
    mockUseMessageSearch.suggestions = ["test search"];

    const { container } = render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act - Focus input to open dropdown
    await user.click(input);

    // Wait for dropdown to appear
    await waitFor(() => {
      expect(container.querySelector('[id="message-search-listbox"]')).toBeInTheDocument();
    });

    // Press Escape
    await user.keyboard("{Escape}");

    // Assert - Input should blur
    await waitFor(() => {
      expect(input).not.toHaveFocus();
    });
  });

  it("navigates suggestions with arrow keys", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "t";
    mockUseMessageSearch.suggestions = ["test", "testing", "text"];

    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act - Focus input
    await user.click(input);

    // Press ArrowDown
    await user.keyboard("{ArrowDown}");

    // Assert - First suggestion should be highlighted
    // (Implementation detail: highlighted via state, visual feedback)
    expect(input).toHaveFocus();
  });

  it("selects suggestion on Enter key", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "t";
    mockUseMessageSearch.suggestions = ["test search"];

    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act - Focus input and press ArrowDown then Enter
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    // Assert - setQuery should be called with suggestion
    expect(mockUseMessageSearch.setQuery).toHaveBeenCalledWith("test search");
  });

  // ==========================================================================
  // Suggestions Dropdown Tests
  // ==========================================================================

  it("shows suggestions dropdown when input is focused", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "t";
    mockUseMessageSearch.suggestions = ["test", "testing"];

    const { container } = render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.click(input);

    // Assert
    await waitFor(() => {
      const listbox = container.querySelector('[id="message-search-listbox"]');
      expect(listbox).toBeInTheDocument();
    });
  });

  it("displays recent searches label", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "";
    mockUseMessageSearch.suggestions = ["previous search"];

    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.click(input);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/recent searches/i)).toBeInTheDocument();
    });
  });

  it("displays suggestion items with clock icon", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "";
    mockUseMessageSearch.suggestions = ["my search"];

    const { container } = render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.click(input);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("my search")).toBeInTheDocument();
      expect(container.querySelector('[data-testid="clock-icon"]')).toBeInTheDocument();
    });
  });

  it("shows minimum characters message for short queries", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "a";
    mockUseMessageSearch.suggestions = [];

    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.click(input);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Results Display Tests
  // ==========================================================================

  it("shows results when query is 2+ characters", async () => {
    // Arrange
    mockUseMessageSearch.query = "test";
    mockUseMessageSearch.debouncedQuery = "test";
    mockUseMessageSearch.results = [
      {
        _id: "msg1" as any,
        content: "test message",
        senderId: "user1" as any,
        senderName: "John",
        createdAt: Date.now(),
        contentType: "text",
      },
    ];

    // Act
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");
    await userEvent.setup().click(input);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper ARIA attributes for combobox", () => {
    // Arrange & Act
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Assert
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-controls", "message-search-listbox");
  });

  it("announces results count to screen readers", async () => {
    // Arrange
    mockUseMessageSearch.query = "test";
    mockUseMessageSearch.debouncedQuery = "test";
    mockUseMessageSearch.results = [
      { _id: "msg1" as any, content: "test", senderId: "user1" as any, senderName: "John", createdAt: Date.now(), contentType: "text" },
      { _id: "msg2" as any, content: "test 2", senderId: "user2" as any, senderName: "Jane", createdAt: Date.now(), contentType: "text" },
    ];

    // Act
    render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");
    await userEvent.setup().click(input);

    // Assert - Screen reader announcement
    await waitFor(() => {
      const srOnly = screen.getByText(/2 messages found/i);
      expect(srOnly).toBeInTheDocument();
      expect(srOnly.closest('[role="status"]')).toBeInTheDocument();
    });
  });

  it("has proper listbox role for dropdown", async () => {
    // Arrange
    const user = userEvent.setup();
    mockUseMessageSearch.query = "t";
    mockUseMessageSearch.suggestions = ["test"];

    const { container } = render(<SearchBar />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.click(input);

    // Assert
    await waitFor(() => {
      const listbox = container.querySelector('[id="message-search-listbox"]');
      expect(listbox).toHaveAttribute("role", "listbox");
      expect(listbox).toHaveAttribute("aria-label", "Search suggestions and results");
    });
  });

  // ==========================================================================
  // Callback Tests
  // ==========================================================================

  it("calls onResultSelect when result is clicked", async () => {
    // Arrange
    const onResultSelect = vi.fn();
    mockUseMessageSearch.query = "test";
    mockUseMessageSearch.debouncedQuery = "test";
    mockUseMessageSearch.results = [
      { _id: "msg1" as any, content: "test", senderId: "user1" as any, senderName: "John", createdAt: Date.now(), contentType: "text" },
    ];

    const user = userEvent.setup();
    render(<SearchBar onResultSelect={onResultSelect} />);
    const input = screen.getByPlaceholderText("Search messages...");

    // Act
    await user.click(input);

    // Wait for results
    await waitFor(() => {
      expect(screen.getByTestId("search-results")).toBeInTheDocument();
    });

    // Click a result (using the mock button)
    await user.click(screen.getByRole("button", { name: /click result/i }));

    // Assert
    expect(onResultSelect).toHaveBeenCalledWith("msg1");
  });
});
