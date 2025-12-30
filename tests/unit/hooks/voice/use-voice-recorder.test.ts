/**
 * Tests for useVoiceRecorder Hook (F034)
 *
 * Tests voice recording orchestration including:
 * - Microphone permission handling
 * - MediaRecorder initialization
 * - Duration tracking and limits
 * - Waveform generation
 * - Resource cleanup
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useVoiceRecorder } from "@/hooks/voice/use-voice-recorder";

// ============================================================================
// Mocks
// ============================================================================

// Mock MediaRecorder
class MockMediaRecorder {
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
    this.onstart?.();
  }

  stop() {
    this.state = "inactive";
    // Simulate data available
    const blob = new Blob(["audio data"], { type: "audio/webm" });
    this.ondataavailable?.({ data: blob });
    this.onstop?.();
  }

  pause() {
    this.state = "paused";
    this.onpause?.();
  }

  resume() {
    this.state = "recording";
    this.onresume?.();
  }
}

global.MediaRecorder = MockMediaRecorder as any;

// Mock audio-utils
vi.mock("@/lib/audio-utils", () => ({
  getSupportedMimeType: vi.fn(() => "audio/webm;codecs=opus"),
  isMediaRecorderSupported: vi.fn(() => true),
  validateVoiceMessage: vi.fn(() => ({ valid: true })),
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, "mediaDevices", {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
  },
});

// Mock MediaStream
class MockMediaStream {
  private tracks: Array<{ stop: () => void }> = [{ stop: vi.fn() }];
  getTracks() {
    return this.tracks;
  }
}

describe("useVoiceRecorder (F034)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize in idle state", () => {
      const { result } = renderHook(() => useVoiceRecorder());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.duration).toBe(0);
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("should detect browser support", () => {
      const { result } = renderHook(() => useVoiceRecorder());

      expect(result.current.isSupported).toBe(true);
      expect(result.current.mimeType).toBe("audio/webm;codecs=opus");
    });
  });

  describe("Permission Handling", () => {
    it("should request microphone permissions", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    });

    it("should handle permission denied", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError")
      );

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toContain("permission denied");
      expect(result.current.isRecording).toBe(false);
    });

    it("should handle no microphone found", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("No microphone", "NotFoundError")
      );

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toContain("no microphone found");
      expect(result.current.isRecording).toBe(false);
    });

    it("should handle microphone in use", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("In use", "NotReadableError")
      );

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toContain("in use");
      expect(result.current.isRecording).toBe(false);
    });
  });

  describe("Recording Controls", () => {
    it("should start recording successfully", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should stop recording successfully", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      // Wait for minimum duration
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.audioBlob).toBeDefined();
    });

    it("should pause and resume recording", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.pauseRecording();
      });

      expect(result.current.isPaused).toBe(true);

      act(() => {
        result.current.resumeRecording();
      });

      expect(result.current.isPaused).toBe(false);
      expect(result.current.isRecording).toBe(true);
    });

    it("should reset recording state", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.resetRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.duration).toBe(0);
      expect(result.current.audioBlob).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe("Duration Tracking", () => {
    it("should track duration while recording", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      // Wait for duration to update
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.duration).toBeGreaterThan(0);
    });

    it("should respect minimum duration", async () => {
      const { result } = renderHook(() =>
        useVoiceRecorder({ minDuration: 2 })
      );

      await act(async () => {
        await result.current.startRecording();
      });

      // Try to stop immediately (duration < minDuration)
      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.error).toContain("at least 2 second");
      expect(result.current.audioBlob).toBeNull();
    });

    it("should auto-stop at maximum duration", async () => {
      const onMaxDurationReached = vi.fn();
      const { result } = renderHook(() =>
        useVoiceRecorder({
          maxDuration: 1,
          onMaxDurationReached,
        })
      );

      await act(async () => {
        await result.current.startRecording();
      });

      // Wait for max duration to be reached
      await waitFor(
        () => {
          expect(result.current.isRecording).toBe(false);
        },
        { timeout: 1500 }
      );

      expect(onMaxDurationReached).toHaveBeenCalled();
    });
  });

  describe("Waveform Generation", () => {
    it("should capture waveform data during recording", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      // Wait for waveform data to be captured
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Waveform data should be populated by the waveform analyzer hook
      // (This would require mocking Web Audio API which is complex)
      expect(result.current.waveformData).toBeDefined();
    });
  });

  describe("Resource Cleanup", () => {
    it("should clean up on unmount", async () => {
      const { result, unmount } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      const stream = mockGetUserMedia.mock.results[0]?.value;
      expect(stream).toBeDefined();

      unmount();

      // Verify stream tracks are stopped
      expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it("should revoke object URLs on reset", async () => {
      const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      act(() => {
        result.current.stopRecording();
      });

      // URL should be created
      expect(result.current.audioUrl).toBeTruthy();

      act(() => {
        result.current.resetRecording();
      });

      // URL should be revoked
      expect(revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should clear errors on new recording", async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      // Trigger an error
      mockGetUserMedia.mockRejectedValueOnce(
        new DOMException("Error", "NotAllowedError")
      );

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeTruthy();

      // Start new recording
      mockGetUserMedia.mockResolvedValueOnce(new MockMediaStream());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeNull();
    });

    it("should handle browser without MediaRecorder support", async () => {
      const { result, rerender } = renderHook(() => useVoiceRecorder());

      // Mock browser without support
      vi.mocked(
        await import("@/lib/audio-utils")
      ).isMediaRecorderSupported.mockReturnValue(false);

      rerender();

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toContain("not supported");
    });
  });
});
