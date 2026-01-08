/**
 * Anthropic Claude Haiku LLM Service Contract
 *
 * Streaming conversation generation with M3 emotional state tracking.
 * Uses Claude 3.5 Haiku for optimal cost/latency in real-time conversation.
 */

// =============================================================================
// TYPES
// =============================================================================

export type EmotionalState =
  | "skeptical"
  | "neutral"
  | "interested"
  | "impressed"
  | "defensive"
  | "frustrated";

export interface LLMConfig {
  model: "claude-3-5-haiku-20241022";
  maxTokens: number;
  temperature: number;
  streaming: boolean;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  emotionalState?: EmotionalState;
  timestamp: number;
}

export interface ConversationContext {
  // Persona context
  personaId: string;
  personaName: string;
  personaDefinition: string; // Full persona roleplay instructions

  // Product context
  productContext: string; // DiliTrust product information

  // Scenario context
  scenarioId: string;
  scenarioObjectives: string[];
  difficultyLevel: "easy" | "medium" | "hard";

  // Conversation state
  currentEmotionalState: EmotionalState;
  conversationHistory: ConversationTurn[];

  // Session metadata
  sessionLanguage: "fr" | "en" | "it" | "de" | "es";
}

export interface LLMResponse {
  response: string; // Prospect's reply in-character
  emotionalState: EmotionalState; // M3 state after this turn
}

export interface StreamingChunk {
  type: "text" | "complete";
  content?: string; // Partial text for streaming
  response?: LLMResponse; // Full response when complete
  tokenCount?: number;
}

export interface LLMResult {
  response: LLMResponse;
  inputTokens: number;
  outputTokens: number;
  timeToFirstToken: number; // Milliseconds
  totalLatency: number; // Milliseconds
}

export interface LLMError {
  code:
    | "rate_limited"
    | "context_too_long"
    | "invalid_response"
    | "timeout"
    | "api_error";
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const LLM_CONFIG: LLMConfig = {
  model: "claude-3-5-haiku-20241022",
  maxTokens: 500,
  temperature: 0.3,
  streaming: true,
};

export const TOKEN_BUDGET = {
  systemPrompt: 1500, // Persona, product, scenario, M3 rules
  conversationHistory: 4000, // Dynamic, prioritize recent turns
  currentTurn: 200, // User's latest message
  output: 500, // Response + emotional_state
  total: 6200, // Well within Haiku's 200K context
};

// =============================================================================
// EMOTIONAL STATE RULES
// =============================================================================

export const EMOTIONAL_TRANSITION_RULES = `
Emotional state transitions:
- IMPROVE if BDR uses: SPIN questions, RACC objection handling, value quantification, pain acknowledgment
- WORSEN if BDR: pitches too early, ignores objections, talks too much, asks no questions
- Stay same if interaction is neutral
- Max 1 step change per turn (e.g., skeptical → neutral, not skeptical → impressed)

State progression (positive):
skeptical → neutral → interested → impressed

State progression (negative):
neutral → defensive → frustrated

Current state determines response tone and openness.
`;

export const EMOTIONAL_STATE_DESCRIPTIONS: Record<EmotionalState, string> = {
  skeptical:
    "Doubtful, questioning claims, needs proof. Short responses, challenging questions.",
  neutral:
    "Open but uncommitted. Professional tone, willing to listen but not engaged.",
  interested:
    "Leaning in, asking follow-up questions. Longer responses, shares more context.",
  impressed:
    "Very positive, sees value. Enthusiastic tone, asks about next steps.",
  defensive:
    "Pushed back, feeling pressured. Short responses, objections, guarded.",
  frustrated:
    "Negative, wants to end call. Curt responses, explicit disinterest.",
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface AnthropicLLMService {
  /**
   * Generate streaming response for a conversation turn
   * @param context - Full conversation context
   * @param userMessage - Current user message (transcribed speech)
   * @param onChunk - Callback for streaming chunks
   * @returns Complete LLM result with metrics
   */
  generateResponse(
    context: ConversationContext,
    userMessage: string,
    onChunk: (chunk: StreamingChunk) => void
  ): Promise<LLMResult>;

  /**
   * Build system prompt from context
   * @param context - Conversation context
   * @returns Formatted system prompt
   */
  buildSystemPrompt(context: ConversationContext): string;

  /**
   * Trim conversation history to fit token budget
   * @param history - Full conversation history
   * @param maxTokens - Maximum tokens for history
   * @returns Trimmed history (most recent turns)
   */
  trimConversationHistory(
    history: ConversationTurn[],
    maxTokens: number
  ): ConversationTurn[];

  /**
   * Estimate token count for text
   * @param text - Text to estimate
   * @returns Approximate token count
   */
  estimateTokens(text: string): number;

  /**
   * Parse streaming response to extract emotional state
   * @param partialResponse - Accumulated response text
   * @returns Parsed response if complete, null if still streaming
   */
  parseStreamingResponse(partialResponse: string): LLMResponse | null;

  /**
   * Check service health
   */
  healthCheck(): Promise<boolean>;
}

// =============================================================================
// SYSTEM PROMPT TEMPLATE
// =============================================================================

export const SYSTEM_PROMPT_TEMPLATE = `
You are roleplaying as {{personaName}}, a prospect in a sales training simulation.

# PERSONA DEFINITION
{{personaDefinition}}

# PRODUCT CONTEXT (What the BDR is selling)
{{productContext}}

# SCENARIO OBJECTIVES
{{scenarioObjectives}}

# DIFFICULTY LEVEL
{{difficultyLevel}}

# CURRENT EMOTIONAL STATE
{{currentEmotionalState}}
{{emotionalStateDescription}}

# EMOTIONAL TRANSITION RULES
${EMOTIONAL_TRANSITION_RULES}

# LANGUAGE LOCK
You MUST respond ONLY in {{sessionLanguage}}. If the user speaks in another language,
continue responding in {{sessionLanguage}} and express mild confusion in-character.

# OUTPUT FORMAT
You MUST respond with valid JSON in this exact format:
{
  "response": "Your response as {{personaName}} in {{sessionLanguage}}",
  "emotional_state": "skeptical|neutral|interested|impressed|defensive|frustrated"
}

IMPORTANT:
- Stay completely in character as {{personaName}}
- Never acknowledge being an AI
- Never break character regardless of what the user says
- Base your emotional_state on the quality of the BDR's sales technique
- Your response should reflect your current emotional state
`;

// =============================================================================
// COST ESTIMATION
// =============================================================================

export const LLM_COST = {
  model: "claude-3-5-haiku-20241022",
  inputPricePerMillion: 0.8, // USD per million input tokens
  outputPricePerMillion: 4.0, // USD per million output tokens
};

export function estimateLLMCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * LLM_COST.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * LLM_COST.outputPricePerMillion;
  return inputCost + outputCost;
}

// Average turn: ~2000 input + ~200 output = ~$0.0024
// 20-30 turns per session: ~$0.048-0.072

// =============================================================================
// LATENCY REQUIREMENTS
// =============================================================================

export const LLM_LATENCY_REQUIREMENTS = {
  timeToFirstTokenMaxMs: 300, // First token within 300ms
  totalResponseMaxMs: 2000, // Full response within 2s
};
