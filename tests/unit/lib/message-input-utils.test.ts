/**
 * Unit tests for message-input-utils.ts
 * Tests character counting, serialization, and Plate.js value manipulation.
 *
 * Target coverage: 100% (critical utility functions)
 */

import { describe, it, expect } from "vitest";
import {
  getTextFromValue,
  serializeEditorValue,
  createEmptyEditorValue,
} from "@/components/messaging/message-input-utils";

// ============================================================================
// getTextFromValue() - Character Counting Tests
// ============================================================================

describe("getTextFromValue", () => {
  // ------------------------------------------------------------------------
  // Basic Cases
  // ------------------------------------------------------------------------

  describe("basic cases", () => {
    it("should return empty string for empty array", () => {
      // Arrange
      const value: unknown[] = [];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });

    it("should extract plain text from simple paragraph", () => {
      // Arrange
      const value = [{ type: "p", children: [{ text: "Hello world" }] }];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Hello world");
    });

    it("should extract text from multiple paragraphs", () => {
      // Arrange
      const value = [
        { type: "p", children: [{ text: "Line 1" }] },
        { type: "p", children: [{ text: "Line 2" }] },
        { type: "p", children: [{ text: "Line 3" }] },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Line 1Line 2Line 3");
    });
  });

  // ------------------------------------------------------------------------
  // Formatted Text - Formatting should NOT be counted
  // ------------------------------------------------------------------------

  describe("formatted text", () => {
    it("should extract text from bold content", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "Hello ", bold: true }, { text: "world" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Hello world");
    });

    it("should extract text from italic content", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "Hello ", italic: true }, { text: "world" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Hello world");
    });

    it("should extract text from code content", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "const x = ", code: true }, { text: "42;" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("const x = 42;");
    });

    it("should extract text from underlined content", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            { text: "Important", underline: true },
            { text: " notice" },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Important notice");
    });

    it("should extract text from strikethrough content", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            { text: "Old price", strikethrough: true },
            { text: " New price" },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Old price New price");
    });

    it("should extract text from mixed formatting", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            { text: "Normal " },
            { text: "bold", bold: true },
            { text: " " },
            { text: "italic", italic: true },
            { text: " " },
            { text: "code", code: true },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Normal bold italic code");
    });

    it("should extract text from multiple format marks on same text", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            {
              text: "Bold italic underline",
              bold: true,
              italic: true,
              underline: true,
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Bold italic underline");
    });
  });

  // ------------------------------------------------------------------------
  // Links - URL should NOT be counted, only link text
  // ------------------------------------------------------------------------

  describe("links", () => {
    it("should extract link text, not URL", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            {
              type: "a",
              url: "https://very-long-url-that-should-not-be-counted.com/path/to/resource?query=param",
              children: [{ text: "Click here" }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Click here");
    });

    it("should extract text from multiple links", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            { text: "Check " },
            {
              type: "a",
              url: "https://example.com",
              children: [{ text: "this link" }],
            },
            { text: " and " },
            {
              type: "a",
              url: "https://another-example.com",
              children: [{ text: "that link" }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Check this link and that link");
    });

    it("should handle formatted text inside links", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            {
              type: "a",
              url: "https://example.com",
              children: [{ text: "Bold link", bold: true }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Bold link");
    });
  });

  // ------------------------------------------------------------------------
  // Lists
  // ------------------------------------------------------------------------

  describe("lists", () => {
    it("should extract text from bullet list", () => {
      // Arrange
      const value = [
        {
          type: "ul",
          children: [
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "Item 1" }] }],
            },
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "Item 2" }] }],
            },
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "Item 3" }] }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Item 1Item 2Item 3");
    });

    it("should extract text from numbered list", () => {
      // Arrange
      const value = [
        {
          type: "ol",
          children: [
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "First" }] }],
            },
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "Second" }] }],
            },
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "Third" }] }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("FirstSecondThird");
    });

    it("should extract text from nested lists", () => {
      // Arrange
      const value = [
        {
          type: "ul",
          children: [
            {
              type: "li",
              children: [
                { type: "p", children: [{ text: "Parent 1" }] },
                {
                  type: "ul",
                  children: [
                    {
                      type: "li",
                      children: [{ type: "p", children: [{ text: "Child 1" }] }],
                    },
                    {
                      type: "li",
                      children: [{ type: "p", children: [{ text: "Child 2" }] }],
                    },
                  ],
                },
              ],
            },
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "Parent 2" }] }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Parent 1Child 1Child 2Parent 2");
    });

    it("should extract text from list with formatted items", () => {
      // Arrange
      const value = [
        {
          type: "ul",
          children: [
            {
              type: "li",
              children: [
                {
                  type: "p",
                  children: [{ text: "Bold item", bold: true }],
                },
              ],
            },
            {
              type: "li",
              children: [
                {
                  type: "p",
                  children: [{ text: "Italic item", italic: true }],
                },
              ],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Bold itemItalic item");
    });
  });

  // ------------------------------------------------------------------------
  // Edge Cases
  // ------------------------------------------------------------------------

  describe("edge cases", () => {
    it("should handle null input", () => {
      // Arrange
      const value = null as unknown as unknown[];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });

    it("should handle undefined input", () => {
      // Arrange
      const value = undefined as unknown as unknown[];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });

    it("should handle non-array input", () => {
      // Arrange
      const value = "not an array" as unknown as unknown[];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });

    it("should handle malformed nodes without text property", () => {
      // Arrange
      const value = [{ type: "p", children: [{ notText: "ignored" }] }];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });

    it("should handle empty text nodes", () => {
      // Arrange
      const value = [{ type: "p", children: [{ text: "" }] }];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });

    it("should handle nodes with null children", () => {
      // Arrange
      const value = [{ type: "p", children: [null, { text: "text" }, null] }];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("text");
    });

    it("should handle nodes with undefined children", () => {
      // Arrange
      const value = [
        { type: "p", children: [undefined, { text: "text" }, undefined] },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("text");
    });

    it("should handle deeply nested structures", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            {
              type: "a",
              url: "https://example.com",
              children: [
                {
                  type: "p",
                  children: [{ text: "Nested", bold: true }],
                },
              ],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Nested");
    });
  });

  // ------------------------------------------------------------------------
  // Unicode and Special Characters
  // ------------------------------------------------------------------------

  describe("unicode and special characters", () => {
    it("should handle emoji", () => {
      // Arrange
      const value = [
        { type: "p", children: [{ text: "Hello 👋 World 🌍" }] },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Hello 👋 World 🌍");
    });

    it("should handle multiple emoji", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "🎉 🎊 🎈 🎁 🎂" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("🎉 🎊 🎈 🎁 🎂");
    });

    it("should handle special HTML characters", () => {
      // Arrange
      const value = [
        { type: "p", children: [{ text: "<script>alert('xss')</script>" }] },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("<script>alert('xss')</script>");
    });

    it("should handle unicode characters", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "日本語 中文 한글 العربية" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("日本語 中文 한글 العربية");
    });

    it("should handle special punctuation", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "Special: @#$%^&*()_+-=[]{}|;':\",./<>?" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Special: @#$%^&*()_+-=[]{}|;':\",./<>?");
    });

    it("should handle newline and tab characters in text", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [{ text: "Line 1\nLine 2\tTabbed" }],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Line 1\nLine 2\tTabbed");
    });
  });

  // ------------------------------------------------------------------------
  // Complex Real-World Scenarios
  // ------------------------------------------------------------------------

  describe("complex real-world scenarios", () => {
    it("should handle mixed content with all features", () => {
      // Arrange
      const value = [
        {
          type: "p",
          children: [
            { text: "This is ", bold: true },
            { text: "a complex", italic: true },
            { text: " message with " },
            {
              type: "a",
              url: "https://example.com",
              children: [{ text: "a link" }],
            },
            { text: " and " },
            { text: "code", code: true },
          ],
        },
        {
          type: "ul",
          children: [
            {
              type: "li",
              children: [{ type: "p", children: [{ text: "List item 1" }] }],
            },
            {
              type: "li",
              children: [
                {
                  type: "p",
                  children: [{ text: "List item 2 with emoji 🎯" }],
                },
              ],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe(
        "This is a complex message with a link and codeList item 1List item 2 with emoji 🎯"
      );
    });

    it("should accurately count characters for length validation", () => {
      // Arrange - 10 characters visible, but long URL
      const value = [
        {
          type: "p",
          children: [
            {
              type: "a",
              url: "https://this-is-a-very-long-url-with-many-characters-that-should-not-be-counted.com/path/to/resource?query=param&another=value",
              children: [{ text: "Click here" }],
            },
          ],
        },
      ];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("Click here");
      expect(result.length).toBe(10); // Only visible text counted
    });

    it("should handle empty editor state", () => {
      // Arrange - typical empty state from Plate.js
      const value = [{ type: "p", children: [{ text: "" }] }];

      // Act
      const result = getTextFromValue(value);

      // Assert
      expect(result).toBe("");
    });
  });
});

// ============================================================================
// serializeEditorValue() - Serialization Tests
// ============================================================================

describe("serializeEditorValue", () => {
  it("should serialize simple value to JSON string", () => {
    // Arrange
    const value = [{ type: "p", children: [{ text: "Hello" }] }];

    // Act
    const result = serializeEditorValue(value);

    // Assert
    expect(result).toBe('[{"type":"p","children":[{"text":"Hello"}]}]');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("should serialize complex value with formatting", () => {
    // Arrange
    const value = [
      {
        type: "p",
        children: [
          { text: "Bold", bold: true },
          { text: " and ", italic: false },
          { text: "italic", italic: true },
        ],
      },
    ];

    // Act
    const result = serializeEditorValue(value);
    const parsed = JSON.parse(result);

    // Assert
    expect(parsed).toEqual(value);
  });

  it("should serialize links with URLs", () => {
    // Arrange
    const value = [
      {
        type: "p",
        children: [
          {
            type: "a",
            url: "https://example.com",
            children: [{ text: "Link text" }],
          },
        ],
      },
    ];

    // Act
    const result = serializeEditorValue(value);
    const parsed = JSON.parse(result);

    // Assert
    expect(parsed).toEqual(value);
    expect(parsed[0].children[0].url).toBe("https://example.com");
  });

  it("should serialize lists", () => {
    // Arrange
    const value = [
      {
        type: "ul",
        children: [
          {
            type: "li",
            children: [{ type: "p", children: [{ text: "Item" }] }],
          },
        ],
      },
    ];

    // Act
    const result = serializeEditorValue(value);
    const parsed = JSON.parse(result);

    // Assert
    expect(parsed).toEqual(value);
  });

  it("should serialize empty array", () => {
    // Arrange
    const value: unknown[] = [];

    // Act
    const result = serializeEditorValue(value);

    // Assert
    expect(result).toBe("[]");
  });

  it("should preserve special characters in serialization", () => {
    // Arrange
    const value = [
      {
        type: "p",
        children: [{ text: 'Special: "quotes" & <tags>' }],
      },
    ];

    // Act
    const result = serializeEditorValue(value);
    const parsed = JSON.parse(result);

    // Assert
    expect(parsed[0].children[0].text).toBe('Special: "quotes" & <tags>');
  });

  it("should preserve emoji in serialization", () => {
    // Arrange
    const value = [{ type: "p", children: [{ text: "Hello 👋 🌍" }] }];

    // Act
    const result = serializeEditorValue(value);
    const parsed = JSON.parse(result);

    // Assert
    expect(parsed[0].children[0].text).toBe("Hello 👋 🌍");
  });
});

// ============================================================================
// createEmptyEditorValue() - Empty State Tests
// ============================================================================

describe("createEmptyEditorValue", () => {
  it("should create valid empty editor state", () => {
    // Act
    const result = createEmptyEditorValue();

    // Assert
    expect(result).toEqual([{ type: "p", children: [{ text: "" }] }]);
  });

  it("should create array with single paragraph", () => {
    // Act
    const result = createEmptyEditorValue();

    // Assert
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("p");
  });

  it("should create paragraph with empty text child", () => {
    // Act
    const result = createEmptyEditorValue();

    // Assert
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.text).toBe("");
  });

  it("should create state that serializes correctly", () => {
    // Arrange
    const emptyValue = createEmptyEditorValue();

    // Act
    const serialized = serializeEditorValue(emptyValue);
    const parsed = JSON.parse(serialized);

    // Assert
    expect(parsed).toEqual(emptyValue);
  });

  it("should create state that returns empty string from getTextFromValue", () => {
    // Arrange
    const emptyValue = createEmptyEditorValue();

    // Act
    const text = getTextFromValue(emptyValue);

    // Assert
    expect(text).toBe("");
  });
});
