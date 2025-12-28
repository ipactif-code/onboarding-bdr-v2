/**
 * Tests for VoiceRecorder Component (F038)
 *
 * Tests the complete voice recording UI including:
 * - Start/stop/pause/resume controls
 * - Timer display
 * - Waveform visualization
 * - Preview before sending
 * - Cancel and send actions
 * - Keyboard shortcuts (Escape, Enter)
 * - Accessibility
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceRecorder } from "@/components/messaging/voice-recorder";

// Mock hooks
vi.mock("@/hooks/voice", () => ({
  useVoiceRecorder: vi.fn(() => ({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
    waveformData: [],
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    resetRecording: vi.fn(),
    mimeType: "audio/webm",
    isSupported: true,
  })),
}));

describe("VoiceRecorder (F038)", () => {
  const mockOnSend = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render start button in idle state", () => {
    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument();
  });

  it("should show timer when recording", async () => {
    const mockUseVoiceRecorder = await import("@/hooks/voice");
    vi.mocked(mockUseVoiceRecorder.useVoiceRecorder).mockReturnValue({
      isRecording: true,
      isPaused: false,
      duration: 5.2,
      audioBlob: null,
      audioUrl: null,
      error: null,
      waveformData: Array(50).fill(0.5),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      resetRecording: vi.fn(),
      mimeType: "audio/webm",
      isSupported: true,
    } as any);

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    expect(screen.getByText(/0:05/)).toBeInTheDocument();
  });

  it("should show waveform visualization while recording", async () => {
    const mockUseVoiceRecorder = await import("@/hooks/voice");
    vi.mocked(mockUseVoiceRecorder.useVoiceRecorder).mockReturnValue({
      isRecording: true,
      isPaused: false,
      duration: 3,
      audioBlob: null,
      audioUrl: null,
      error: null,
      waveformData: Array(50).fill(0.5),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      resetRecording: vi.fn(),
      mimeType: "audio/webm",
      isSupported: true,
    } as any);

    const { container } = render(
      <VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />
    );

    // Check for waveform container
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });

  it("should show preview after stopping", async () => {
    const mockBlob = new Blob(["audio"], { type: "audio/webm" });
    const mockUrl = "blob:http://localhost/mock-audio";

    const mockUseVoiceRecorder = await import("@/hooks/voice");
    vi.mocked(mockUseVoiceRecorder.useVoiceRecorder).mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 10.5,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      error: null,
      waveformData: Array(100).fill(0.6),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      resetRecording: vi.fn(),
      mimeType: "audio/webm",
      isSupported: true,
    } as any);

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel|delete/i })).toBeInTheDocument();
  });

  it("should call onSend with correct data", async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(["audio"], { type: "audio/webm" });
    const mockUrl = "blob:http://localhost/mock-audio";
    const waveformData = Array(100).fill(0.6);

    const mockUseVoiceRecorder = await import("@/hooks/voice");
    vi.mocked(mockUseVoiceRecorder.useVoiceRecorder).mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 10.5,
      audioBlob: mockBlob,
      audioUrl: mockUrl,
      error: null,
      waveformData,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      resetRecording: vi.fn(),
      mimeType: "audio/webm",
      isSupported: true,
    } as any);

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(mockOnSend).toHaveBeenCalledWith(
      mockBlob,
      "audio/webm",
      10.5,
      waveformData
    );
  });

  it("should call onCancel when cancelled", async () => {
    const user = userEvent.setup();

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("should handle keyboard shortcuts - Escape", async () => {
    const user = userEvent.setup();

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    await user.keyboard("{Escape}");

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("should handle keyboard shortcuts - Enter to send", async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(["audio"], { type: "audio/webm" });

    const mockUseVoiceRecorder = await import("@/hooks/voice");
    vi.mocked(mockUseVoiceRecorder.useVoiceRecorder).mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 10,
      audioBlob: mockBlob,
      audioUrl: "blob:url",
      error: null,
      waveformData: Array(100).fill(0.5),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      resetRecording: vi.fn(),
      mimeType: "audio/webm",
      isSupported: true,
    } as any);

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    await user.keyboard("{Enter}");

    expect(mockOnSend).toHaveBeenCalled();
  });

  it("should display error message with retry button", async () => {
    const user = userEvent.setup();
    const mockResetRecording = vi.fn();

    const mockUseVoiceRecorder = await import("@/hooks/voice");
    vi.mocked(mockUseVoiceRecorder.useVoiceRecorder).mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: "Microphone permission denied",
      waveformData: [],
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      resetRecording: mockResetRecording,
      mimeType: "audio/webm",
      isSupported: true,
    } as any);

    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/microphone permission denied/i);

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(mockResetRecording).toHaveBeenCalled();
  });

  it("should be accessible with ARIA labels", () => {
    render(<VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} />);

    const startButton = screen.getByRole("button", { name: /start recording/i });
    expect(startButton).toHaveAccessibleName();
  });

  it("should respect disabled prop", () => {
    render(
      <VoiceRecorder onSend={mockOnSend} onCancel={mockOnCancel} disabled />
    );

    const startButton = screen.getByRole("button", { name: /start recording/i });
    expect(startButton).toBeDisabled();
  });
});
