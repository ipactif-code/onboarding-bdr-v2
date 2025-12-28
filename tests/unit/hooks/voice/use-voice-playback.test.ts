/**
 * Tests for useVoicePlayback Hook (F035)
 *
 * Tests WaveSurfer.js audio playback including:
 * - WaveSurfer initialization
 * - Play/pause controls
 * - Seeking functionality
 * - Playback rate adjustment
 * - Error handling
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoicePlayback } from "@/hooks/voice/use-voice-playback";
import { useRef } from "react";

// ============================================================================
// Mocks
// ============================================================================

// Mock WaveSurfer
const mockWaveSurfer = {
  on: vi.fn(),
  load: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  seekTo: vi.fn(),
  setPlaybackRate: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn(() => mockWaveSurfer),
  },
}));

describe("useVoicePlayback (F035)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize WaveSurfer with correct options", () => {
    const WaveSurfer = require("wavesurfer.js").default;
    const containerRef = { current: document.createElement("div") };

    renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    expect(WaveSurfer.create).toHaveBeenCalledWith({
      container: containerRef.current,
      waveColor: "hsl(var(--muted-foreground) / 0.3)",
      progressColor: "hsl(var(--primary))",
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 40,
      normalize: true,
      hideScrollbar: true,
      interact: true,
    });
  });

  it("should load audio with pre-computed waveform data", () => {
    const containerRef = { current: document.createElement("div") };
    const waveformData = Array(100).fill(0.5);

    renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData,
        duration: 60,
      })
    );

    expect(mockWaveSurfer.load).toHaveBeenCalledWith(
      "https://example.com/audio.mp3",
      [waveformData],
      60
    );
  });

  it("should load audio without pre-computed waveform", () => {
    const containerRef = { current: document.createElement("div") };

    renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    expect(mockWaveSurfer.load).toHaveBeenCalledWith(
      "https://example.com/audio.mp3"
    );
  });

  it("should register event listeners", () => {
    const containerRef = { current: document.createElement("div") };
    const onReady = vi.fn();
    const onError = vi.fn();
    const onTimeUpdate = vi.fn();
    const onFinish = vi.fn();

    renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
        onReady,
        onError,
        onTimeUpdate,
        onFinish,
      })
    );

    expect(mockWaveSurfer.on).toHaveBeenCalledWith("ready", expect.any(Function));
    expect(mockWaveSurfer.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockWaveSurfer.on).toHaveBeenCalledWith("timeupdate", expect.any(Function));
    expect(mockWaveSurfer.on).toHaveBeenCalledWith("play", expect.any(Function));
    expect(mockWaveSurfer.on).toHaveBeenCalledWith("pause", expect.any(Function));
    expect(mockWaveSurfer.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("should handle play event", async () => {
    const containerRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    // Simulate play event
    const playCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "play"
    )?.[1];

    act(() => {
      playCallback?.();
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it("should handle pause event", async () => {
    const containerRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    // Simulate play then pause
    const playCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "play"
    )?.[1];
    const pauseCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "pause"
    )?.[1];

    act(() => {
      playCallback?.();
    });

    expect(result.current.isPlaying).toBe(true);

    act(() => {
      pauseCallback?.();
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it("should update current time on timeupdate", () => {
    const containerRef = { current: document.createElement("div") };
    const onTimeUpdate = vi.fn();

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
        onTimeUpdate,
      })
    );

    const timeupdateCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "timeupdate"
    )?.[1];

    act(() => {
      timeupdateCallback?.(15.5);
    });

    expect(result.current.currentTime).toBe(15.5);
    expect(onTimeUpdate).toHaveBeenCalledWith(15.5);
  });

  it("should handle finish event", () => {
    const containerRef = { current: document.createElement("div") };
    const onFinish = vi.fn();

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
        onFinish,
      })
    );

    const finishCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "finish"
    )?.[1];

    act(() => {
      finishCallback?.();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(onFinish).toHaveBeenCalled();
  });

  it("should play audio", async () => {
    const containerRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    await act(async () => {
      await result.current.play();
    });

    expect(mockWaveSurfer.play).toHaveBeenCalled();
  });

  it("should pause audio", () => {
    const containerRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    act(() => {
      result.current.pause();
    });

    expect(mockWaveSurfer.pause).toHaveBeenCalled();
  });

  it("should seek to position", () => {
    const containerRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    act(() => {
      result.current.seekTo(0.5);
    });

    expect(mockWaveSurfer.seekTo).toHaveBeenCalledWith(0.5);
  });

  it("should set playback rate", () => {
    const containerRef = { current: document.createElement("div") };

    const { result } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    act(() => {
      result.current.setPlaybackRate(1.5);
    });

    expect(mockWaveSurfer.setPlaybackRate).toHaveBeenCalledWith(1.5, true);
  });

  it("should call onReady callback", () => {
    const containerRef = { current: document.createElement("div") };
    const onReady = vi.fn();

    renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
        onReady,
      })
    );

    const readyCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "ready"
    )?.[1];

    act(() => {
      readyCallback?.();
    });

    expect(onReady).toHaveBeenCalled();
  });

  it("should call onError callback", () => {
    const containerRef = { current: document.createElement("div") };
    const onError = vi.fn();

    renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
        onError,
      })
    );

    const errorCallback = mockWaveSurfer.on.mock.calls.find(
      ([event]) => event === "error"
    )?.[1];

    const testError = new Error("Playback failed");

    act(() => {
      errorCallback?.(testError);
    });

    expect(onError).toHaveBeenCalledWith(testError);
  });

  it("should destroy WaveSurfer on unmount", () => {
    const containerRef = { current: document.createElement("div") };

    const { unmount } = renderHook(() =>
      useVoicePlayback({
        containerRef: containerRef as any,
        audioUrl: "https://example.com/audio.mp3",
        waveformData: [],
        duration: 60,
      })
    );

    unmount();

    expect(mockWaveSurfer.destroy).toHaveBeenCalled();
  });

  it("should reinitialize on audio URL change", () => {
    const containerRef = { current: document.createElement("div") };

    const { rerender } = renderHook(
      ({ audioUrl }) =>
        useVoicePlayback({
          containerRef: containerRef as any,
          audioUrl,
          waveformData: [],
          duration: 60,
        }),
      {
        initialProps: { audioUrl: "https://example.com/audio1.mp3" },
      }
    );

    expect(mockWaveSurfer.load).toHaveBeenCalledWith(
      "https://example.com/audio1.mp3"
    );

    // Change URL
    rerender({ audioUrl: "https://example.com/audio2.mp3" });

    expect(mockWaveSurfer.destroy).toHaveBeenCalled();
    // WaveSurfer.create would be called again for new instance
  });
});
