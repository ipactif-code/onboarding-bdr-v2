import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isMediaRecorderSupported,
  getSupportedMimeType,
  validateVoiceMessage,
  formatDuration,
  getExtensionForMimeType,
  AudioMimeType,
} from "@/lib/audio-utils";

// Mock global objects for browser APIs
const mockMediaRecorder = {
  isTypeSupported: vi.fn(),
};

/* eslint-disable @typescript-eslint/no-explicit-any */
describe("Audio Utils", () => {
  describe("isMediaRecorderSupported", () => {
    it("should return false in SSR context (no window)", () => {
      // Arrange - save original window
      const originalWindow = global.window;
      // @ts-expect-error - deleting window for SSR simulation
      delete global.window;

      // Act
      const result = isMediaRecorderSupported();

      // Assert
      expect(result).toBe(false);

      // Cleanup
      global.window = originalWindow;
    });

    it("should return true when MediaRecorder is available", () => {
      // Arrange
      global.MediaRecorder = mockMediaRecorder as any;

      // Act
      const result = isMediaRecorderSupported();

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when MediaRecorder is undefined", () => {
      // Arrange
      const originalMediaRecorder = global.MediaRecorder;
      // @ts-expect-error - deleting MediaRecorder
      delete global.MediaRecorder;

      // Act
      const result = isMediaRecorderSupported();

      // Assert
      expect(result).toBe(false);

      // Cleanup
      global.MediaRecorder = originalMediaRecorder;
    });
  });

  describe("getSupportedMimeType", () => {
    beforeEach(() => {
      // Reset mocks before each test
      vi.clearAllMocks();
    });

    it("should return null in SSR context (no window)", () => {
      // Arrange
      const originalWindow = global.window;
      // @ts-expect-error - deleting window for SSR simulation
      delete global.window;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBeNull();

      // Cleanup
      global.window = originalWindow;
    });

    it("should return null when MediaRecorder is unavailable", () => {
      // Arrange
      const originalMediaRecorder = global.MediaRecorder;
      // @ts-expect-error - deleting MediaRecorder
      delete global.MediaRecorder;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBeNull();

      // Cleanup
      global.MediaRecorder = originalMediaRecorder;
    });

    it("should return webm/opus when supported (best quality)", () => {
      // Arrange
      global.MediaRecorder = {
        isTypeSupported: vi.fn((mimeType: string) => {
          return mimeType === "audio/webm;codecs=opus";
        }),
      } as any;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBe("audio/webm;codecs=opus");
    });

    it("should fallback to webm when opus not supported", () => {
      // Arrange
      global.MediaRecorder = {
        isTypeSupported: vi.fn((mimeType: string) => {
          return mimeType === "audio/webm";
        }),
      } as any;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBe("audio/webm");
    });

    it("should fallback to mp4 for Safari", () => {
      // Arrange
      global.MediaRecorder = {
        isTypeSupported: vi.fn((mimeType: string) => {
          return mimeType === "audio/mp4"; // Safari
        }),
      } as any;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBe("audio/mp4");
    });

    it("should fallback to ogg as last resort", () => {
      // Arrange
      global.MediaRecorder = {
        isTypeSupported: vi.fn((mimeType: string) => {
          return mimeType === "audio/ogg";
        }),
      } as any;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBe("audio/ogg");
    });

    it("should return null when no formats supported", () => {
      // Arrange
      global.MediaRecorder = {
        isTypeSupported: vi.fn(() => false), // Nothing supported
      } as any;

      // Act
      const result = getSupportedMimeType();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("validateVoiceMessage", () => {
    it("should reject voice message shorter than 1 second", () => {
      // Arrange
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      const duration = 0.5; // Too short

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 1 second");
    });

    it("should reject voice message at exactly 0 seconds", () => {
      // Arrange
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      const duration = 0;

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 1 second");
    });

    it("should accept voice message at exactly 1 second", () => {
      // Arrange
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      const duration = 1; // Minimum valid

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject voice message longer than 5 minutes (300 seconds)", () => {
      // Arrange
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      const duration = 301; // Too long

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot exceed 5 minutes");
    });

    it("should accept voice message at exactly 5 minutes (300 seconds)", () => {
      // Arrange
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      const duration = 300; // Maximum valid

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject voice message larger than 25MB", () => {
      // Arrange - Create blob larger than 25MB
      const largeData = new Uint8Array(26 * 1024 * 1024); // 26MB
      const blob = new Blob([largeData], { type: "audio/webm" });
      const duration = 60; // Valid duration

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot exceed 25MB");
    });

    it("should accept voice message at exactly 25MB", () => {
      // Arrange
      const data = new Uint8Array(25 * 1024 * 1024); // Exactly 25MB
      const blob = new Blob([data], { type: "audio/webm" });
      const duration = 60;

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid voice message (normal case)", () => {
      // Arrange
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      const duration = 30; // 30 seconds, normal

      // Act
      const result = validateVoiceMessage(blob, duration);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate independently (duration and size)", () => {
      // Test 1: Valid duration, invalid size
      const largeBlobValidDuration = new Blob(
        [new Uint8Array(26 * 1024 * 1024)],
        { type: "audio/webm" }
      );
      const result1 = validateVoiceMessage(largeBlobValidDuration, 30);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain("25MB");

      // Test 2: Invalid duration, valid size
      const smallBlobInvalidDuration = new Blob(["audio"], {
        type: "audio/webm",
      });
      const result2 = validateVoiceMessage(smallBlobInvalidDuration, 0.5);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain("at least 1 second");
    });
  });

  describe("formatDuration", () => {
    it("should format 0 seconds as 0:00", () => {
      // Act
      const result = formatDuration(0);

      // Assert
      expect(result).toBe("0:00");
    });

    it("should format seconds less than 60 as 0:SS", () => {
      // Act & Assert
      expect(formatDuration(5)).toBe("0:05");
      expect(formatDuration(30)).toBe("0:30");
      expect(formatDuration(59)).toBe("0:59");
    });

    it("should format exactly 60 seconds as 1:00", () => {
      // Act
      const result = formatDuration(60);

      // Assert
      expect(result).toBe("1:00");
    });

    it("should format 1:30 correctly", () => {
      // Act
      const result = formatDuration(90);

      // Assert
      expect(result).toBe("1:30");
    });

    it("should format 5:00 (max duration)", () => {
      // Act
      const result = formatDuration(300);

      // Assert
      expect(result).toBe("5:00");
    });

    it("should format durations over 10 minutes", () => {
      // Act
      const result = formatDuration(725); // 12:05

      // Assert
      expect(result).toBe("12:05");
    });

    it("should pad single digit seconds with zero", () => {
      // Act & Assert
      expect(formatDuration(61)).toBe("1:01");
      expect(formatDuration(125)).toBe("2:05");
      expect(formatDuration(309)).toBe("5:09");
    });

    it("should handle fractional seconds by flooring", () => {
      // Act & Assert
      expect(formatDuration(90.7)).toBe("1:30"); // Floors to 90
      expect(formatDuration(59.9)).toBe("0:59"); // Floors to 59
    });
  });

  describe("getExtensionForMimeType", () => {
    it("should return webm for audio/webm;codecs=opus", () => {
      // Act
      const result = getExtensionForMimeType("audio/webm;codecs=opus");

      // Assert
      expect(result).toBe("webm");
    });

    it("should return webm for audio/webm", () => {
      // Act
      const result = getExtensionForMimeType("audio/webm");

      // Assert
      expect(result).toBe("webm");
    });

    it("should return mp4 for audio/mp4", () => {
      // Act
      const result = getExtensionForMimeType("audio/mp4");

      // Assert
      expect(result).toBe("mp4");
    });

    it("should return ogg for audio/ogg", () => {
      // Act
      const result = getExtensionForMimeType("audio/ogg");

      // Assert
      expect(result).toBe("ogg");
    });

    it("should return webm as default for null", () => {
      // Act
      const result = getExtensionForMimeType(null);

      // Assert
      expect(result).toBe("webm");
    });

    it("should return webm as default for unknown type", () => {
      // Act
      const result = getExtensionForMimeType("audio/unknown" as AudioMimeType);

      // Assert
      expect(result).toBe("webm");
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
