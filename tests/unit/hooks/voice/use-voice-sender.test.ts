/**
 * Tests for useVoiceSender Hook (F036)
 *
 * Tests voice message upload and sending workflow:
 * - Upload URL generation
 * - Blob upload to Convex Storage
 * - Message creation via mutation
 * - Error handling
 * - Loading states
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useVoiceSender } from "@/hooks/voice/use-voice-sender";
import type { Id } from "../../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Mock Convex mutations
const mockGenerateUploadUrl = vi.fn();
const mockSendVoiceToChannel = vi.fn();
const mockSendVoiceToConversation = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn((fn: any) => {
    if (fn.toString().includes("generateUploadUrl")) {
      return mockGenerateUploadUrl;
    }
    if (fn.toString().includes("sendVoiceToChannel")) {
      return mockSendVoiceToChannel;
    }
    if (fn.toString().includes("sendVoiceToConversation")) {
      return mockSendVoiceToConversation;
    }
    return vi.fn();
  }),
}));

// Mock toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock("sonner", () => ({
  toast: mockToast,
}));

// Mock fetch
global.fetch = vi.fn();

describe("useVoiceSender (F036)", () => {
  const channelId = "k175xp9v5vkmxekqnjspm53jz574r9r1" as Id<"channels">;
  const conversationId = "k275xp9v5vkmxekqnjspm53jz574r9r2" as Id<"conversations">;
  const storageId = "kg2e35v6yb5w9eqgwdzxyzqn4n74wvjr" as Id<"_storage">;

  const testBlob = new Blob(["audio data"], { type: "audio/webm" });
  const testMimeType = "audio/webm;codecs=opus";
  const testDuration = 10;
  const testWaveformData = Array(100).fill(0.5);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGenerateUploadUrl.mockResolvedValue("https://upload.url");
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ storageId }),
    });
    mockSendVoiceToChannel.mockResolvedValue("message_id");
    mockSendVoiceToConversation.mockResolvedValue("message_id");
  });

  describe("Initialization", () => {
    it("should initialize with not uploading", () => {
      const { result } = renderHook(() => useVoiceSender({ channelId }));

      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("Channel Voice Messages", () => {
    it("should upload audio blob to Convex Storage", async () => {
      const { result } = renderHook(() => useVoiceSender({ channelId }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(mockGenerateUploadUrl).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith("https://upload.url", {
        method: "POST",
        headers: { "Content-Type": testMimeType },
        body: testBlob,
      });
    });

    it("should call mutation with correct args", async () => {
      const lessonId = "k375xp9v5vkmxekqnjspm53jz574r9r3" as Id<"lessons">;
      const parentId = "k475xp9v5vkmxekqnjspm53jz574r9r4" as Id<"messages">;

      const { result } = renderHook(() =>
        useVoiceSender({ channelId, lessonId, parentId })
      );

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(mockSendVoiceToChannel).toHaveBeenCalledWith({
        channelId,
        storageId,
        duration: testDuration,
        fileSize: testBlob.size,
        mimeType: testMimeType,
        waveformData: testWaveformData,
        parentId,
        lessonId,
      });
    });

    it("should show success toast on successful send", async () => {
      const { result } = renderHook(() => useVoiceSender({ channelId }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(mockToast.success).toHaveBeenCalledWith("Voice message sent");
    });

    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useVoiceSender({ channelId, onSuccess })
      );

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(onSuccess).toHaveBeenCalled();
    });
  });

  describe("DM Voice Messages", () => {
    it("should send to conversation when conversationId provided", async () => {
      const { result } = renderHook(() =>
        useVoiceSender({ conversationId })
      );

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(mockSendVoiceToConversation).toHaveBeenCalledWith({
        conversationId,
        storageId,
        duration: testDuration,
        fileSize: testBlob.size,
        mimeType: testMimeType,
        waveformData: testWaveformData,
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle upload errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useVoiceSender({ channelId }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(result.current.error).toBeTruthy();
      expect(mockToast.error).toHaveBeenCalled();
    });

    it("should handle mutation errors", async () => {
      mockSendVoiceToChannel.mockRejectedValueOnce(
        new Error("Mutation failed")
      );

      const { result } = renderHook(() => useVoiceSender({ channelId }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("Mutation failed");
    });

    it("should call onError callback on error", async () => {
      const onError = vi.fn();
      (global.fetch as any).mockResolvedValueOnce({ ok: false });

      const { result } = renderHook(() =>
        useVoiceSender({ channelId, onError })
      );

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should show error toast on failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false });

      const { result } = renderHook(() => useVoiceSender({ channelId }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(mockToast.error).toHaveBeenCalled();
    });

    it("should reject when neither channelId nor conversationId provided", async () => {
      const onError = vi.fn();

      const { result } = renderHook(() => useVoiceSender({ onError }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(result.current.error?.message).toContain(
        "Either channelId or conversationId must be provided"
      );
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("Loading States", () => {
    it("should set isUploading to true during upload", async () => {
      let resolveUpload: any;
      (global.fetch as any).mockReturnValue(
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
      );

      const { result } = renderHook(() => useVoiceSender({ channelId }));

      act(() => {
        result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      // Should be uploading
      await waitFor(() => {
        expect(result.current.isUploading).toBe(true);
      });

      // Resolve upload
      await act(async () => {
        resolveUpload({
          ok: true,
          json: () => Promise.resolve({ storageId }),
        });
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });
    });

    it("should prevent concurrent uploads", async () => {
      let resolveUpload: any;
      (global.fetch as any).mockReturnValue(
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
      );

      const { result } = renderHook(() => useVoiceSender({ channelId }));

      // Start first upload
      act(() => {
        result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      await waitFor(() => {
        expect(result.current.isUploading).toBe(true);
      });

      // Try second upload (should be ignored)
      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      // Should only have called fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should reset isUploading on error", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false });

      const { result } = renderHook(() => useVoiceSender({ channelId }));

      await act(async () => {
        await result.current.sendVoice(
          testBlob,
          testMimeType,
          testDuration,
          testWaveformData
        );
      });

      expect(result.current.isUploading).toBe(false);
    });
  });
});
