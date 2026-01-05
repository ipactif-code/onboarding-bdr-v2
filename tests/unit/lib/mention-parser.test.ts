import { describe, it, expect } from "vitest";
import {
  parseMentions,
  extractMentionedUserIds,
  replaceMentionsWithLinks,
  hasBroadcastMention,
  stripMentionMarkers,
  ParsedMention,
} from "@/lib/mention-parser";

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("Mention Parser Utility", () => {
  describe("parseMentions", () => {
    it("should find single @username mention", () => {
      // Arrange
      const content = "Hello @john.doe, how are you?";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        type: "user",
        username: "john.doe",
        startIndex: 6,
        endIndex: 15,
      });
    });

    it("should find multiple @username mentions", () => {
      // Arrange
      const content = "Hey @alice and @bob, meet @charlie!";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(3);
      expect(mentions[0]!.username).toBe("alice");
      expect(mentions[1]!.username).toBe("bob");
      expect(mentions[2]!.username).toBe("charlie");
    });

    it("should detect @here mention", () => {
      // Arrange
      const content = "Attention @here, meeting in 5 minutes";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        type: "here",
        username: "here",
        startIndex: 10,
        endIndex: 15,
      });
    });

    it("should detect @everyone mention", () => {
      // Arrange
      const content = "Important announcement @everyone!";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        type: "everyone",
        username: "everyone",
        startIndex: 23,
        endIndex: 32,
      });
    });

    it("should handle @here case-insensitively", () => {
      // Arrange
      const content = "Hey @HERE and @Here and @hErE";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(3);
      expect(mentions[0]!.type).toBe("here");
      expect(mentions[1]!.type).toBe("here");
      expect(mentions[2]!.type).toBe("here");
      // Username normalized to lowercase
      expect(mentions[0]!.username).toBe("here");
      expect(mentions[1]!.username).toBe("here");
      expect(mentions[2]!.username).toBe("here");
    });

    it("should handle @everyone case-insensitively", () => {
      // Arrange
      const content = "Alert @EVERYONE and @Everyone";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(2);
      expect(mentions[0]!.type).toBe("everyone");
      expect(mentions[1]!.type).toBe("everyone");
      expect(mentions[0]!.username).toBe("everyone");
      expect(mentions[1]!.username).toBe("everyone");
    });

    it("should skip @mentions in URLs", () => {
      // Arrange
      const content = "Check out https://example.com/@john for details";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(0); // URL mention should be skipped
    });

    it("should skip @mentions in http:// URLs", () => {
      // Arrange
      const content = "Visit http://site.com/@user/profile";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(0);
    });

    it("should skip @mentions in inline code blocks", () => {
      // Arrange
      const content = "Use `@user.name` to mention someone";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(0);
    });

    it("should skip @mentions in code blocks", () => {
      // Arrange
      const content = "Example:\n```\n@user.email = 'test@example.com'\n```";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(0);
    });

    it("should handle empty input", () => {
      // Act
      const mentions1 = parseMentions("");
      const mentions2 = parseMentions(null as any);
      const mentions3 = parseMentions(undefined as any);

      // Assert
      expect(mentions1).toEqual([]);
      expect(mentions2).toEqual([]);
      expect(mentions3).toEqual([]);
    });

    it("should handle input with no mentions", () => {
      // Arrange
      const content = "This is a regular message with no mentions";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toEqual([]);
    });

    it("should support usernames with dots, hyphens, underscores", () => {
      // Arrange
      const content = "@user.name @user-name @user_name";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(3);
      expect(mentions[0]!.username).toBe("user.name");
      expect(mentions[1]!.username).toBe("user-name");
      expect(mentions[2]!.username).toBe("user_name");
    });

    it("should sort mentions by startIndex", () => {
      // Arrange
      const content = "Third @charlie, first @alice, second @bob";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(3);
      expect(mentions[0]!.username).toBe("charlie"); // Appears first at index 6
      expect(mentions[1]!.username).toBe("alice"); // Appears second at index 22
      expect(mentions[2]!.username).toBe("bob"); // Appears third at index 38
    });

    it("should handle adjacent mentions", () => {
      // Arrange
      const content = "@alice@bob @charlie";

      // Act
      const mentions = parseMentions(content);

      // Assert
      // The regex treats @alice@bob as two separate mentions
      expect(mentions).toHaveLength(3);
      expect(mentions[0]!.username).toBe("alice");
      expect(mentions[1]!.username).toBe("bob");
      expect(mentions[2]!.username).toBe("charlie");
    });

    it("should handle mentions at start and end of string", () => {
      // Arrange
      const content = "@start middle content @end";

      // Act
      const mentions = parseMentions(content);

      // Assert
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        type: "user",
        username: "start",
        startIndex: 0,
        endIndex: 6,
      });
      expect(mentions[1]).toEqual({
        type: "user",
        username: "end",
        startIndex: 22,
        endIndex: 26,
      });
    });

    it("should detect mentions even in email-like patterns", () => {
      // Arrange
      const content = "Contact test@example.com for help";

      // Act
      const mentions = parseMentions(content);

      // Assert
      // The regex will match @example.com as a mention (dots are allowed in usernames)
      // This is expected behavior - email filtering would need additional context
      expect(mentions).toHaveLength(1);
      expect(mentions[0]!.username).toBe("example.com");
    });
  });

  describe("extractMentionedUserIds", () => {
    it("should extract unique user IDs from user mentions", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          userId: "user_123",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "user",
          userId: "user_456",
          username: "jane",
          startIndex: 10,
          endIndex: 15,
        },
      ];

      // Act
      const userIds = extractMentionedUserIds(mentions);

      // Assert
      expect(userIds).toEqual(["user_123", "user_456"]);
    });

    it("should deduplicate user IDs", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          userId: "user_123",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "user",
          userId: "user_123", // Duplicate
          username: "john",
          startIndex: 10,
          endIndex: 15,
        },
        {
          type: "user",
          userId: "user_456",
          username: "jane",
          startIndex: 20,
          endIndex: 25,
        },
      ];

      // Act
      const userIds = extractMentionedUserIds(mentions);

      // Assert
      expect(userIds).toEqual(["user_123", "user_456"]); // No duplicates
    });

    it("should exclude @here and @everyone mentions", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          userId: "user_123",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "here",
          username: "here",
          startIndex: 10,
          endIndex: 15,
        },
        {
          type: "everyone",
          username: "everyone",
          startIndex: 20,
          endIndex: 29,
        },
      ];

      // Act
      const userIds = extractMentionedUserIds(mentions);

      // Assert
      expect(userIds).toEqual(["user_123"]); // Only user type
    });

    it("should exclude user mentions without userId", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          userId: "user_123",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "user",
          // No userId (username not resolved)
          username: "unknown",
          startIndex: 10,
          endIndex: 18,
        },
      ];

      // Act
      const userIds = extractMentionedUserIds(mentions);

      // Assert
      expect(userIds).toEqual(["user_123"]); // Only resolved user
    });

    it("should handle empty array", () => {
      // Act
      const userIds = extractMentionedUserIds([]);

      // Assert
      expect(userIds).toEqual([]);
    });

    it("should handle invalid input gracefully", () => {
      // Act
      const userIds1 = extractMentionedUserIds(null as any);
      const userIds2 = extractMentionedUserIds(undefined as any);

      // Assert
      expect(userIds1).toEqual([]);
      expect(userIds2).toEqual([]);
    });
  });

  describe("replaceMentionsWithLinks", () => {
    it("should replace user mention with marker", () => {
      // Arrange
      const content = "Hello @john, how are you?";
      const mentions: ParsedMention[] = [
        {
          type: "user",
          username: "john",
          startIndex: 6,
          endIndex: 11,
        },
      ];

      // Act
      const result = replaceMentionsWithLinks(content, mentions);

      // Assert
      expect(result).toBe("Hello [[mention:user:john]], how are you?");
    });

    it("should replace multiple mentions", () => {
      // Arrange
      const content = "Hey @alice and @bob!";
      const mentions: ParsedMention[] = [
        {
          type: "user",
          username: "alice",
          startIndex: 4,
          endIndex: 10,
        },
        {
          type: "user",
          username: "bob",
          startIndex: 15,
          endIndex: 19,
        },
      ];

      // Act
      const result = replaceMentionsWithLinks(content, mentions);

      // Assert
      expect(result).toBe("Hey [[mention:user:alice]] and [[mention:user:bob]]!");
    });

    it("should replace @here with marker", () => {
      // Arrange
      const content = "Attention @here!";
      const mentions: ParsedMention[] = [
        {
          type: "here",
          username: "here",
          startIndex: 10,
          endIndex: 15,
        },
      ];

      // Act
      const result = replaceMentionsWithLinks(content, mentions);

      // Assert
      expect(result).toBe("Attention [[mention:here:here]]!");
    });

    it("should replace @everyone with marker", () => {
      // Arrange
      const content = "Alert @everyone!";
      const mentions: ParsedMention[] = [
        {
          type: "everyone",
          username: "everyone",
          startIndex: 6,
          endIndex: 15,
        },
      ];

      // Act
      const result = replaceMentionsWithLinks(content, mentions);

      // Assert
      expect(result).toBe("Alert [[mention:everyone:everyone]]!");
    });

    it("should handle empty mentions array", () => {
      // Arrange
      const content = "Hello world";

      // Act
      const result = replaceMentionsWithLinks(content, []);

      // Assert
      expect(result).toBe("Hello world"); // Unchanged
    });

    it("should handle empty content", () => {
      // Act
      const result1 = replaceMentionsWithLinks("", []);
      const result2 = replaceMentionsWithLinks(null as any, []);
      const result3 = replaceMentionsWithLinks(undefined as any, []);

      // Assert
      expect(result1).toBe("");
      expect(result2).toBe("");
      expect(result3).toBe("");
    });

    it("should preserve indices when processing in reverse order", () => {
      // Arrange - mentions NOT sorted
      const content = "First @a, second @b, third @c";
      const mentions: ParsedMention[] = [
        { type: "user", username: "c", startIndex: 27, endIndex: 29 },
        { type: "user", username: "a", startIndex: 6, endIndex: 8 },
        { type: "user", username: "b", startIndex: 17, endIndex: 19 },
      ];

      // Act
      const result = replaceMentionsWithLinks(content, mentions);

      // Assert
      expect(result).toBe(
        "First [[mention:user:a]], second [[mention:user:b]], third [[mention:user:c]]"
      );
    });
  });

  describe("hasBroadcastMention", () => {
    it("should detect @here mention", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "here",
          username: "here",
          startIndex: 10,
          endIndex: 15,
        },
      ];

      // Act
      const result = hasBroadcastMention(mentions);

      // Assert
      expect(result).toBe(true);
    });

    it("should detect @everyone mention", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "everyone",
          username: "everyone",
          startIndex: 10,
          endIndex: 19,
        },
      ];

      // Act
      const result = hasBroadcastMention(mentions);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for only user mentions", () => {
      // Arrange
      const mentions: ParsedMention[] = [
        {
          type: "user",
          username: "john",
          startIndex: 0,
          endIndex: 5,
        },
        {
          type: "user",
          username: "jane",
          startIndex: 10,
          endIndex: 15,
        },
      ];

      // Act
      const result = hasBroadcastMention(mentions);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false for empty array", () => {
      // Act
      const result = hasBroadcastMention([]);

      // Assert
      expect(result).toBe(false);
    });

    it("should handle invalid input gracefully", () => {
      // Act
      const result1 = hasBroadcastMention(null as any);
      const result2 = hasBroadcastMention(undefined as any);

      // Assert
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe("stripMentionMarkers", () => {
    it("should strip user mention markers", () => {
      // Arrange
      const content = "Hello [[mention:user:john]], how are you?";

      // Act
      const result = stripMentionMarkers(content);

      // Assert
      expect(result).toBe("Hello @john, how are you?");
    });

    it("should strip @here mention markers", () => {
      // Arrange
      const content = "Attention [[mention:here:here]]!";

      // Act
      const result = stripMentionMarkers(content);

      // Assert
      expect(result).toBe("Attention @here!");
    });

    it("should strip @everyone mention markers", () => {
      // Arrange
      const content = "Alert [[mention:everyone:everyone]]!";

      // Act
      const result = stripMentionMarkers(content);

      // Assert
      expect(result).toBe("Alert @everyone!");
    });

    it("should strip multiple markers", () => {
      // Arrange
      const content =
        "Hey [[mention:user:alice]] and [[mention:user:bob]], meet [[mention:here:here]]";

      // Act
      const result = stripMentionMarkers(content);

      // Assert
      expect(result).toBe("Hey @alice and @bob, meet @here");
    });

    it("should handle content with no markers", () => {
      // Arrange
      const content = "Hello world";

      // Act
      const result = stripMentionMarkers(content);

      // Assert
      expect(result).toBe("Hello world"); // Unchanged
    });

    it("should handle empty content", () => {
      // Act
      const result1 = stripMentionMarkers("");
      const result2 = stripMentionMarkers(null as any);
      const result3 = stripMentionMarkers(undefined as any);

      // Assert
      expect(result1).toBe("");
      expect(result2).toBe("");
      expect(result3).toBe("");
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
