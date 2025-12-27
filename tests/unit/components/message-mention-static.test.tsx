import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  MessageMentionStatic,
  MentionContextProvider,
} from "@/components/messaging/rich-text-static-components";

// ============================================================================
// Mocks
// ============================================================================

// Mock cn utility
vi.mock("@/lib/utils", () => ({
  cn: (...classes: (string | boolean | undefined)[]) =>
    classes.filter(Boolean).join(" "),
}));

// ============================================================================
// Tests
// ============================================================================

describe("MessageMentionStatic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  it("renders username mention with @ prefix", () => {
    // Arrange
    const element = { value: "johndoe" };

    // Act
    render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    expect(screen.getByText("@johndoe", { exact: false })).toBeInTheDocument();
  });

  it("renders with proper role attribute", () => {
    // Arrange
    const element = { value: "alice" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toBeInTheDocument();
  });

  it("renders with data attributes for mention value and type", () => {
    // Arrange
    const element = { value: "bob" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector("[data-mention-value]");
    expect(mention).toHaveAttribute("data-mention-value", "bob");
    expect(mention).toHaveAttribute("data-mention-type", "user");
  });

  // ==========================================================================
  // Styling Tests - Regular User Mentions
  // ==========================================================================

  it("applies blue styling to regular user mentions", () => {
    // Arrange
    const element = { value: "johndoe" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="user"]');
    expect(mention?.className).toMatch(/text-blue-600/);
    expect(mention?.className).toMatch(/bg-primary\/10/);
    expect(mention?.className).toMatch(/hover:underline/);
  });

  it("applies dark mode styles to regular user mentions", () => {
    // Arrange
    const element = { value: "alice" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="user"]');
    expect(mention?.className).toMatch(/dark:text-blue-400/);
  });

  // ==========================================================================
  // Styling Tests - Current User Mentions
  // ==========================================================================

  it("applies amber background to current user mention", () => {
    // Arrange
    const element = { value: "currentuser" };

    // Act
    const { container } = render(
      <MentionContextProvider currentUserName="currentuser">
        <MessageMentionStatic element={element} attributes={{}}>
          <span />
        </MessageMentionStatic>
      </MentionContextProvider>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="currentUser"]');
    expect(mention).toBeInTheDocument();
    expect(mention?.className).toMatch(/bg-amber-100/);
    expect(mention?.className).toMatch(/text-amber-900/);
    expect(mention?.className).toMatch(/hover:underline/);
  });

  it("applies dark mode amber styles to current user mention", () => {
    // Arrange
    const element = { value: "me" };

    // Act
    const { container } = render(
      <MentionContextProvider currentUserName="me">
        <MessageMentionStatic element={element} attributes={{}}>
          <span />
        </MessageMentionStatic>
      </MentionContextProvider>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="currentUser"]');
    expect(mention?.className).toMatch(/dark:bg-amber-900\/40/);
    expect(mention?.className).toMatch(/dark:text-amber-200/);
  });

  it("matches current user case-insensitively", () => {
    // Arrange
    const element = { value: "JohnDoe" };

    // Act
    const { container } = render(
      <MentionContextProvider currentUserName="johndoe">
        <MessageMentionStatic element={element} attributes={{}}>
          <span />
        </MessageMentionStatic>
      </MentionContextProvider>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="currentUser"]');
    expect(mention).toBeInTheDocument();
  });

  // ==========================================================================
  // Styling Tests - @here Special Mention
  // ==========================================================================

  it("applies purple bold styling to @here mention", () => {
    // Arrange
    const element = { value: "here" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="here"]');
    expect(mention).toBeInTheDocument();
    expect(mention?.className).toMatch(/bg-purple-100/);
    expect(mention?.className).toMatch(/text-purple-700/);
    expect(mention?.className).toMatch(/font-semibold/);
  });

  it("applies dark mode purple styles to @here mention", () => {
    // Arrange
    const element = { value: "here" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="here"]');
    expect(mention?.className).toMatch(/dark:bg-purple-900\/30/);
    expect(mention?.className).toMatch(/dark:text-purple-300/);
  });

  it("recognizes @here case-insensitively", () => {
    // Arrange
    const element = { value: "HERE" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="here"]');
    expect(mention).toBeInTheDocument();
  });

  // ==========================================================================
  // Styling Tests - @everyone Special Mention
  // ==========================================================================

  it("applies purple bold styling to @everyone mention", () => {
    // Arrange
    const element = { value: "everyone" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="everyone"]');
    expect(mention).toBeInTheDocument();
    expect(mention?.className).toMatch(/bg-purple-100/);
    expect(mention?.className).toMatch(/text-purple-700/);
    expect(mention?.className).toMatch(/font-semibold/);
  });

  it("applies dark mode purple styles to @everyone mention", () => {
    // Arrange
    const element = { value: "everyone" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="everyone"]');
    expect(mention?.className).toMatch(/dark:bg-purple-900\/30/);
    expect(mention?.className).toMatch(/dark:text-purple-300/);
  });

  it("recognizes @everyone case-insensitively", () => {
    // Arrange
    const element = { value: "EveryOne" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="everyone"]');
    expect(mention).toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("has proper aria-label for regular user mention", () => {
    // Arrange
    const element = { value: "johndoe" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute("aria-label", "mentioned johndoe");
  });

  it("has proper aria-label for current user mention", () => {
    // Arrange
    const element = { value: "me" };

    // Act
    const { container } = render(
      <MentionContextProvider currentUserName="me">
        <MessageMentionStatic element={element} attributes={{}}>
          <span />
        </MessageMentionStatic>
      </MentionContextProvider>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute("aria-label", "mentioned you, me");
  });

  it("has proper aria-label for @here mention", () => {
    // Arrange
    const element = { value: "here" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute(
      "aria-label",
      "mentioned here, notifying online members"
    );
  });

  it("has proper aria-label for @everyone mention", () => {
    // Arrange
    const element = { value: "everyone" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute(
      "aria-label",
      "mentioned everyone, notifying all members"
    );
  });

  it("announces mention to screen readers correctly", () => {
    // Arrange
    const element = { value: "alice" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute("aria-label");
    expect(mention?.getAttribute("aria-label")).toContain("mentioned");
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("handles empty mention value gracefully", () => {
    // Arrange
    const element = { value: "" };

    // Act & Assert - Should not crash
    expect(() =>
      render(
        <MessageMentionStatic element={element} attributes={{}}>
          <span />
        </MessageMentionStatic>
      )
    ).not.toThrow();
  });

  it("handles missing element gracefully", () => {
    // Arrange & Act - Should not crash
    expect(() =>
      render(
        <MessageMentionStatic attributes={{}}>
          <span />
        </MessageMentionStatic>
      )
    ).not.toThrow();
  });

  it("handles mention value with whitespace", () => {
    // Arrange
    const element = { value: "  johndoe  " };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert - Should trim whitespace for type detection
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute("data-mention-value", "  johndoe  ");
  });

  it("handles special mention with mixed case and spaces", () => {
    // Arrange
    const element = { value: " HeRe " };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="here"]');
    expect(mention).toBeInTheDocument();
  });

  it("passes through custom attributes", () => {
    // Arrange
    const element = { value: "test" };
    const customAttributes = {
      "data-custom": "value",
      id: "mention-123",
    };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={customAttributes}>
        <span />
      </MessageMentionStatic>
    );

    // Assert
    const mention = container.querySelector('[role="mark"]');
    expect(mention).toHaveAttribute("data-custom", "value");
    expect(mention).toHaveAttribute("id", "mention-123");
  });

  // ==========================================================================
  // MentionContextProvider Tests
  // ==========================================================================

  it("provides currentUserName to nested mentions", () => {
    // Arrange & Act
    const { container } = render(
      <MentionContextProvider currentUserName="testuser">
        <MessageMentionStatic element={{ value: "testuser" }} attributes={{}}>
          <span />
        </MessageMentionStatic>
      </MentionContextProvider>
    );

    // Assert
    const mention = container.querySelector('[data-mention-type="currentUser"]');
    expect(mention).toBeInTheDocument();
  });

  it("handles nested MentionContextProviders", () => {
    // Arrange & Act
    const { container } = render(
      <MentionContextProvider currentUserName="user1">
        <MentionContextProvider currentUserName="user2">
          <MessageMentionStatic element={{ value: "user2" }} attributes={{}}>
            <span />
          </MessageMentionStatic>
        </MentionContextProvider>
      </MentionContextProvider>
    );

    // Assert - Inner provider should take precedence
    const mention = container.querySelector('[data-mention-type="currentUser"]');
    expect(mention).toBeInTheDocument();
  });

  it("handles undefined currentUserName in context", () => {
    // Arrange & Act
    const { container } = render(
      <MentionContextProvider currentUserName={undefined}>
        <MessageMentionStatic element={{ value: "anyone" }} attributes={{}}>
          <span />
        </MessageMentionStatic>
      </MentionContextProvider>
    );

    // Assert - Should render as regular user mention
    const mention = container.querySelector('[data-mention-type="user"]');
    expect(mention).toBeInTheDocument();
  });

  // ==========================================================================
  // Base Styling Tests
  // ==========================================================================

  it("applies base mention styles to all mention types", () => {
    // Arrange
    const testCases = [
      { value: "user", type: "user" },
      { value: "here", type: "here" },
      { value: "everyone", type: "everyone" },
    ];

    testCases.forEach(({ value, type }) => {
      // Act
      const { container } = render(
        <MessageMentionStatic element={{ value }} attributes={{}}>
          <span />
        </MessageMentionStatic>
      );

      // Assert - All should have base styles
      const mention = container.querySelector(`[data-mention-type="${type}"]`);
      expect(mention?.className).toMatch(/inline/);
      expect(mention?.className).toMatch(/rounded/);
      expect(mention?.className).toMatch(/px-1/);
      expect(mention?.className).toMatch(/py-0\.5/);
      expect(mention?.className).toMatch(/font-medium/);
    });
  });

  it("renders children alongside mention value", () => {
    // Arrange
    const element = { value: "johndoe" };

    // Act
    const { container } = render(
      <MessageMentionStatic element={element} attributes={{}}>
        <span data-testid="child-content">child</span>
      </MessageMentionStatic>
    );

    // Assert
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(container.textContent).toContain("@johndoe");
  });
});
