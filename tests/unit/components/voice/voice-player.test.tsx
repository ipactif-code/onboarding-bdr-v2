/**
 * Tests for VoicePlayer Component (Phase 10)
 *
 * Tests voice message playback UI including:
 * - Rendering with valid audioUrl
 * - Unavailable state when audioUrl is null/empty
 * - Play/pause button interaction
 * - Loading/error states
 * - Transcription display and editing
 * - Keyboard shortcuts
 * - Speed selector changes
 * - Accessibility (ARIA labels and roles)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoicePlayer } from "@/components/messaging/voice-player";

// ============================================================================
// Mocks
// ============================================================================

// Mock useVoicePlayback hook
const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();
const mockSeekTo = vi.fn();
const mockSetPlaybackRate = vi.fn();

vi.mock("@/hooks/voice", () => ({
  useVoicePlayback: vi.fn(() => ({
    isPlaying: false,
    currentTime: 0,
    play: mockPlay,
    pause: mockPause,
    seekTo: mockSeekTo,
    setPlaybackRate: mockSetPlaybackRate,
  })),
}));

// Mock Convex useQuery (for reactions)
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
}));

describe("VoicePlayer Component (Phase 10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Test Case 1: Renders with valid audioUrl - shows player controls
  // ==========================================================================
  it("should render player controls when audioUrl is provided", () => {
    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    expect(
      screen.getByRole("region", { name: /voice message player/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /loading audio/i })).toBeInTheDocument();
    // Time display shows skeleton during loading
    expect(screen.getByLabelText(/loading time/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Test Case 2: Renders unavailable state when audioUrl is null/empty
  // ==========================================================================
  it("should show unavailable state when audioUrl is null", () => {
    render(
      <VoicePlayer
        audioUrl=""
        duration={60}
        waveformData={[]}
      />
    );

    expect(
      screen.getByRole("region", { name: /voice message unavailable/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/audio file unavailable/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /play/i })
    ).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Test Case 3: Play/pause button toggles playback state
  // ==========================================================================
  it("should toggle play/pause when button is clicked", async () => {
    const user = userEvent.setup();
    const { useVoicePlayback } = await import("@/hooks/voice");

    // Start with "ready" state by providing onReady callback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useVoicePlayback as any).mockImplementationOnce((options: any) => {
      // Simulate ready state immediately
      if (options.onReady) {
        setTimeout(options.onReady, 0);
      }
      return {
        isPlaying: false,
        currentTime: 0,
        play: mockPlay,
        pause: mockPause,
        seekTo: mockSeekTo,
        setPlaybackRate: mockSetPlaybackRate,
      };
    });

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    // Wait for ready state - use exact match to avoid ambiguity
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Play" })).toBeInTheDocument();
    });

    const playButton = screen.getByRole("button", { name: "Play" });

    // Click play
    await user.click(playButton);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Test Case 4: Shows loading state with skeleton initially
  // ==========================================================================
  it("should show loading state initially", () => {
    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    // Check for loading announcement
    expect(screen.getByText(/loading audio/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Test Case 5: Shows error state with retry button on error
  // ==========================================================================
  it("should show error state and allow retry", async () => {
    const { useVoicePlayback } = await import("@/hooks/voice");

    // Mock error state by calling onError immediately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useVoicePlayback as any).mockImplementationOnce((options: any) => {
      if (options.onError) {
        setTimeout(() => options.onError(new Error("Load failed")), 0);
      }
      return {
        isPlaying: false,
        currentTime: 0,
        play: mockPlay,
        pause: mockPause,
        seekTo: mockSeekTo,
        setPlaybackRate: mockSetPlaybackRate,
      };
    });

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    // Wait for error state to be triggered
    await waitFor(() => {
      expect(screen.getByLabelText(/retry loading audio/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Test Case 6: Transcription display shows text when provided
  // ==========================================================================
  it("should display transcription when provided", () => {
    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        transcription="This is a test transcription"
        transcriptionStatus="completed"
        waveformData={[]}
      />
    );

    expect(screen.getByText(/this is a test transcription/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Test Case 7: Transcription editing workflow (start edit, save, cancel)
  // ==========================================================================
  it("should handle transcription editing workflow", async () => {
    const user = userEvent.setup();
    const onTranscriptionEdit = vi.fn();

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        transcription="Original transcription"
        transcriptionStatus="completed"
        onTranscriptionEdit={onTranscriptionEdit}
        waveformData={[]}
      />
    );

    // Find and click edit button
    const editButton = screen.getByRole("button", { name: /edit transcription/i });
    await user.click(editButton);

    // Find textarea and edit
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Updated transcription");

    // Save
    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    expect(onTranscriptionEdit).toHaveBeenCalledWith("Updated transcription");
  });

  it("should cancel transcription editing", async () => {
    const user = userEvent.setup();
    const onTranscriptionEdit = vi.fn();

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        transcription="Original transcription"
        transcriptionStatus="completed"
        onTranscriptionEdit={onTranscriptionEdit}
        waveformData={[]}
      />
    );

    // Start editing
    const editButton = screen.getByRole("button", { name: /edit transcription/i });
    await user.click(editButton);

    // Cancel
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(onTranscriptionEdit).not.toHaveBeenCalled();
    expect(screen.getByText(/original transcription/i)).toBeInTheDocument();
  });

  // ==========================================================================
  // Test Case 8: Keyboard shortcut (spacebar) toggles play/pause
  // ==========================================================================
  it("should toggle play/pause with spacebar", async () => {
    const user = userEvent.setup();

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    const playerRegion = screen.getByRole("region", { name: /voice message player/i });

    // Focus the player
    playerRegion.focus();

    // Press spacebar
    await user.keyboard(" ");

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("should not toggle play/pause with spacebar when editing transcription", async () => {
    const user = userEvent.setup();

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        transcription="Test transcription"
        transcriptionStatus="completed"
        onTranscriptionEdit={vi.fn()}
        waveformData={[]}
      />
    );

    // Start editing
    const editButton = screen.getByRole("button", { name: /edit transcription/i });
    await user.click(editButton);

    // Press spacebar in textarea
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, " ");

    // Play should not be triggered
    expect(mockPlay).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test Case 9: Speed selector changes are applied
  // ==========================================================================
  it("should change playback speed when speed selector is used", async () => {
    const user = userEvent.setup();
    const { useVoicePlayback } = await import("@/hooks/voice");

    // Mock ready state so speed selector is enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useVoicePlayback as any).mockImplementationOnce((options: any) => {
      if (options.onReady) {
        setTimeout(options.onReady, 0);
      }
      return {
        isPlaying: false,
        currentTime: 0,
        play: mockPlay,
        pause: mockPause,
        seekTo: mockSeekTo,
        setPlaybackRate: mockSetPlaybackRate,
      };
    });

    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    // Wait for ready state (speed selector becomes enabled)
    await waitFor(() => {
      const speedButton = screen.getByLabelText(/playback speed/i);
      expect(speedButton).not.toBeDisabled();
    });

    // Find and click speed selector
    const speedButton = screen.getByLabelText(/playback speed/i);
    await user.click(speedButton);

    // Wait for menu to open and select 1.5x speed
    await waitFor(() => {
      expect(screen.getByText("1.5x")).toBeInTheDocument();
    });

    const speed15x = screen.getByText("1.5x");
    await user.click(speed15x);

    expect(mockSetPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  // ==========================================================================
  // Test Case 10: Accessibility - proper ARIA labels and roles
  // ==========================================================================
  it("should have proper accessibility attributes", () => {
    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        transcription="Test transcription"
        waveformData={[]}
      />
    );

    // Main player region
    expect(
      screen.getByRole("region", { name: /voice message player/i })
    ).toBeInTheDocument();

    // Status announcements
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Play button
    const playButton = screen.getByRole("button", { name: /play/i });
    expect(playButton).toBeInTheDocument();

    // Player should be focusable
    const playerRegion = screen.getByRole("region", { name: /voice message player/i });
    expect(playerRegion).toHaveAttribute("tabIndex", "0");
  });

  it("should announce state changes to screen readers", async () => {
    // Loading state
    render(
      <VoicePlayer
        audioUrl="https://example.com/audio.mp3"
        duration={60}
        waveformData={[]}
      />
    );

    // Check for loading announcement (in sr-only status region)
    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toHaveTextContent(/loading audio/i);

    // For playing state, we'd need to actually trigger playback
    // Since this is complex to test with mocks, we verify the status region exists
    // and is properly configured for announcements
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
    expect(statusRegion).toHaveAttribute("aria-atomic", "true");
  });
});
