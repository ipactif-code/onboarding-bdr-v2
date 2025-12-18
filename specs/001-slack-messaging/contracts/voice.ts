/**
 * Voice Message API Contracts
 *
 * This file defines the TypeScript signatures for voice message
 * recording, transcription, and playback functionality.
 */

import { Id } from "convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type TranscriptionStatus = "pending" | "processing" | "completed" | "failed";

export interface VoiceMessage {
  _id: Id<"voiceMessages">;
  messageId: Id<"messages">;
  storageId: Id<"_storage">;
  fileSize: number;
  mimeType: string;
  duration: number;
  waveformData: number[];
  transcription?: string;
  transcriptionStatus: TranscriptionStatus;
  transcriptionError?: string;
  transcriptionCompletedAt?: number;
  transcriptionEdited: boolean;
  originalTranscription?: string;
}

export interface VoiceMessageWithUrl extends VoiceMessage {
  audioUrl: string;
}

// ============================================================================
// Cost Control Types
// ============================================================================

export interface TranscriptionBudget {
  // Daily limits (per user)
  dailyMinutesUsed: number;
  dailyMinutesLimit: number;  // 30 min default
  dailyTranscriptionCount: number;

  // Monthly global budget
  monthlyUsageCents: number;
  monthlyBudgetCents: number;  // 200000 ($2000) default
  monthlyBudgetPercentUsed: number;

  // State
  canTranscribe: boolean;
  reason?: "daily_limit" | "monthly_budget" | "service_disabled";

  // Next reset times
  dailyResetAt: number;
  monthlyResetAt: number;
}

export interface TranscriptionCost {
  durationSeconds: number;
  estimatedCostCents: number;  // $0.006/min = 0.01 cents/sec
}

// ============================================================================
// Cost Control Queries
// ============================================================================

/**
 * Check if user can transcribe before recording
 *
 * Call when user opens voice recorder to show warnings.
 */
export interface CheckTranscriptionBudgetResult {
  budget: TranscriptionBudget;
}

// Query: api.voice.checkBudget

/**
 * Estimate cost for a voice message duration
 */
export interface EstimateTranscriptionCostArgs {
  durationSeconds: number;
}

export interface EstimateTranscriptionCostResult {
  cost: TranscriptionCost;
  wouldExceedDaily: boolean;
  wouldExceedMonthly: boolean;
}

// Query: api.voice.estimateCost

/**
 * Get user's transcription usage history
 */
export interface GetTranscriptionUsageArgs {
  days?: number;  // Default 30
}

export interface GetTranscriptionUsageResult {
  daily: Array<{
    date: string;
    minutesUsed: number;
    transcriptionCount: number;
    costCents: number;
  }>;
  totalMinutes: number;
  totalCostCents: number;
}

// Query: api.voice.getUsage

// ============================================================================
// Admin Cost Control Queries
// ============================================================================

/**
 * Get global transcription budget status
 * Admin only.
 */
export interface GetGlobalBudgetStatusResult {
  currentMonth: {
    month: string;
    minutesUsed: number;
    transcriptionCount: number;
    costCents: number;
    budgetCents: number;
    percentUsed: number;
    isDisabled: boolean;
  };
  topUsers: Array<{
    userId: Id<"users">;
    userName: string;
    minutesUsed: number;
    costCents: number;
  }>;
  alerts: Array<{
    type: "80_percent" | "100_percent";
    sentAt: number;
  }>;
}

// Query: api.voice.getGlobalBudgetStatus

// ============================================================================
// Admin Cost Control Mutations
// ============================================================================

/**
 * Update monthly budget
 * Admin only.
 */
export interface UpdateMonthlyBudgetArgs {
  budgetCents: number;
}

export interface UpdateMonthlyBudgetResult {
  success: boolean;
  newBudgetCents: number;
}

// Mutation: api.voice.updateMonthlyBudget

/**
 * Toggle transcription service (emergency kill switch)
 * Admin only.
 */
export interface ToggleTranscriptionServiceArgs {
  enabled: boolean;
  reason: string;
}

export interface ToggleTranscriptionServiceResult {
  success: boolean;
  isEnabled: boolean;
}

// Mutation: api.voice.toggleTranscriptionService

/**
 * Reset user's daily limit (for special cases)
 * Admin only.
 */
export interface ResetUserDailyLimitArgs {
  userId: Id<"users">;
}

export interface ResetUserDailyLimitResult {
  success: boolean;
}

// Mutation: api.voice.resetUserDailyLimit

/**
 * Set custom daily limit for user (instructors, power users)
 * Admin only.
 */
export interface SetUserDailyLimitArgs {
  userId: Id<"users">;
  dailyMinutesLimit: number;
}

export interface SetUserDailyLimitResult {
  success: boolean;
}

// Mutation: api.voice.setUserDailyLimit

// ============================================================================
// Queries
// ============================================================================

/**
 * Get voice message details with audio URL
 */
export interface GetVoiceMessageArgs {
  messageId: Id<"messages">;
}

export interface GetVoiceMessageResult {
  voiceMessage: VoiceMessageWithUrl;
}

// Query: api.voice.get

/**
 * Get transcription status
 *
 * Used for polling while transcription is in progress.
 */
export interface GetTranscriptionStatusArgs {
  messageId: Id<"messages">;
}

export interface GetTranscriptionStatusResult {
  status: TranscriptionStatus;
  transcription?: string;
  error?: string;
  completedAt?: number;
}

// Query: api.voice.getTranscriptionStatus

// ============================================================================
// Mutations
// ============================================================================

/**
 * Generate upload URL for voice message
 *
 * Client uploads audio file to this URL, then calls sendVoiceMessage.
 */
export interface GenerateUploadUrlResult {
  uploadUrl: string;
}

// Mutation: api.voice.generateUploadUrl

/**
 * Send a voice message to a channel
 *
 * Rate limited to 20 voice messages per hour (FR-045).
 * Duration must be 1-300 seconds (FR-020, FR-020b).
 */
export interface SendVoiceToChannelArgs {
  channelId: Id<"channels">;
  storageId: Id<"_storage">;
  duration: number;
  waveformData: number[];
  mimeType: string;
  fileSize: number;
  parentId?: Id<"messages">; // For thread replies
}

export interface SendVoiceToChannelResult {
  messageId: Id<"messages">;
  voiceMessageId: Id<"voiceMessages">;
}

// Mutation: api.voice.sendToChannel

/**
 * Send a voice message to a DM conversation
 */
export interface SendVoiceToConversationArgs {
  conversationId: Id<"conversations">;
  storageId: Id<"_storage">;
  duration: number;
  waveformData: number[];
  mimeType: string;
  fileSize: number;
}

export interface SendVoiceToConversationResult {
  messageId: Id<"messages">;
  voiceMessageId: Id<"voiceMessages">;
}

// Mutation: api.voice.sendToConversation

/**
 * Edit transcription for accuracy
 *
 * Only the sender can edit. Original preserved for reference.
 */
export interface EditTranscriptionArgs {
  messageId: Id<"messages">;
  transcription: string;
}

export interface EditTranscriptionResult {
  success: boolean;
}

// Mutation: api.voice.editTranscription

/**
 * Retry failed transcription
 *
 * Only available if status is "failed".
 */
export interface RetryTranscriptionArgs {
  messageId: Id<"messages">;
}

export interface RetryTranscriptionResult {
  success: boolean;
}

// Mutation: api.voice.retryTranscription

// ============================================================================
// Internal Actions (Server-side)
// ============================================================================

/**
 * Process voice transcription
 *
 * Called internally after voice message upload.
 * Uses OpenAI Whisper API for transcription.
 */
export interface ProcessTranscriptionArgs {
  voiceMessageId: Id<"voiceMessages">;
  storageId: Id<"_storage">;
}

// Internal action: api.voice.processTranscription

// ============================================================================
// Client-Side Utilities (Not Convex)
// ============================================================================

/**
 * Audio recording configuration
 */
export interface AudioRecorderConfig {
  maxDuration: 300; // 5 minutes in seconds
  minDuration: 1; // Minimum 1 second
  sampleRate: 48000;
  mimeType: "audio/webm;codecs=opus" | "audio/mp4";
  audioBitsPerSecond: 128000;
}

/**
 * Waveform generation options
 */
export interface WaveformOptions {
  samples: 100; // Number of amplitude samples
  normalize: true; // Normalize to 0-1 range
}

/**
 * Playback speed options (FR-022)
 */
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

/**
 * Voice recorder state
 */
export interface VoiceRecorderState {
  status: "idle" | "recording" | "paused" | "stopped";
  duration: number; // Current duration in seconds
  waveformData: number[]; // Live waveform during recording
  error?: string;
}

/**
 * Voice player state
 */
export interface VoicePlayerState {
  status: "loading" | "ready" | "playing" | "paused" | "ended" | "error";
  currentTime: number;
  duration: number;
  playbackSpeed: PlaybackSpeed;
  error?: string;
}
