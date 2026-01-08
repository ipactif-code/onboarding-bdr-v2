/**
 * Context Builder V7 Contract
 *
 * Assembles conversation context for Claude Haiku LLM.
 * Dynamically manages token budget to fit within limits while
 * prioritizing recent conversation history.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SupportedLanguage = "fr" | "en" | "it" | "de" | "es";

export type EmotionalState =
  | "skeptical"
  | "neutral"
  | "interested"
  | "impressed"
  | "defensive"
  | "frustrated";

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface PersonaContext {
  id: string;
  name: string;
  jobTitle: string;
  company: string;
  industry: string;
  gender: "male" | "female";
  ageRange: "25-35" | "35-45" | "45-55" | "55+";
  personalityTraits: string[];
  communicationStyle: string;
  painPoints: string[];
  objectionPatterns: string[];
  decisionCriteria: string[];
  defaultEmotionalState: EmotionalState;
}

export interface ScenarioContext {
  id: string;
  name: string;
  type: "cold_call" | "discovery" | "demo" | "negotiation" | "objection_handling";
  objectives: string[];
  successCriteria: string[];
  expectedDuration: number; // minutes
  keyTopics: string[];
}

export interface ProductContext {
  name: string;
  tagline: string;
  valueProposition: string;
  keyFeatures: string[];
  targetAudience: string;
  competitiveAdvantages: string[];
  commonObjections: string[];
  pricingModel: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  emotionalState?: EmotionalState;
  timestamp: number;
  tokenCount?: number; // Pre-computed for efficiency
}

export interface ContextBuildResult {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  totalTokens: number;
  tokenBreakdown: {
    systemPrompt: number;
    conversationHistory: number;
    currentTurn: number;
  };
  turnsIncluded: number;
  turnsTrimmed: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const TOKEN_BUDGET = {
  total: 6200,
  systemPrompt: 1500,
  conversationHistory: 4000,
  currentTurn: 200,
  output: 500, // Reserved for response
};

export const DIFFICULTY_MODIFIERS: Record<DifficultyLevel, string> = {
  easy: `
DIFFICULTY: Easy
- Be receptive to good techniques
- Offer mild objections that are easy to handle
- Move towards positive emotional states more quickly
- Give clear buying signals when impressed
`,
  medium: `
DIFFICULTY: Medium
- Require solid technique before warming up
- Offer realistic objections that need proper handling
- Emotional state changes at a normal pace
- Give subtle buying signals
`,
  hard: `
DIFFICULTY: Hard
- Be skeptical and challenging
- Offer strong objections that require excellent handling
- Emotional state changes slowly, negative states persist
- Rarely give obvious buying signals
- Push back on weak arguments
`,
};

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface ContextBuilderService {
  /**
   * Build complete context for LLM call
   * @param persona - Persona definition
   * @param scenario - Scenario definition
   * @param product - Product context
   * @param history - Conversation history
   * @param currentEmotionalState - Current M3 state
   * @param difficulty - Difficulty level
   * @param language - Session language
   * @param currentUserMessage - Latest user message
   * @returns Built context with token counts
   */
  buildContext(
    persona: PersonaContext,
    scenario: ScenarioContext,
    product: ProductContext,
    history: ConversationTurn[],
    currentEmotionalState: EmotionalState,
    difficulty: DifficultyLevel,
    language: SupportedLanguage,
    currentUserMessage: string
  ): ContextBuildResult;

  /**
   * Build system prompt from components
   * @param persona - Persona definition
   * @param scenario - Scenario definition
   * @param product - Product context
   * @param currentEmotionalState - Current M3 state
   * @param difficulty - Difficulty level
   * @param language - Session language
   * @returns Formatted system prompt
   */
  buildSystemPrompt(
    persona: PersonaContext,
    scenario: ScenarioContext,
    product: ProductContext,
    currentEmotionalState: EmotionalState,
    difficulty: DifficultyLevel,
    language: SupportedLanguage
  ): string;

  /**
   * Trim conversation history to fit token budget
   * @param history - Full conversation history
   * @param maxTokens - Maximum tokens allowed
   * @returns Trimmed history (most recent turns)
   */
  trimHistory(
    history: ConversationTurn[],
    maxTokens: number
  ): ConversationTurn[];

  /**
   * Estimate token count for text
   * Uses cl100k_base tokenizer approximation
   * @param text - Text to estimate
   * @returns Approximate token count
   */
  estimateTokens(text: string): number;

  /**
   * Get emotional state description for system prompt
   * @param state - Emotional state
   * @returns Description of how to express this state
   */
  getEmotionalStateDescription(state: EmotionalState): string;
}

// =============================================================================
// SYSTEM PROMPT TEMPLATES
// =============================================================================

export const PERSONA_TEMPLATE = `
# PERSONA: {{name}}

## Role
You are {{name}}, {{jobTitle}} at {{company}} in the {{industry}} industry.

## Demographics
- Gender: {{gender}}
- Age Range: {{ageRange}}

## Personality
{{personalityTraits}}

## Communication Style
{{communicationStyle}}

## Pain Points
{{painPoints}}

## Common Objections
{{objectionPatterns}}

## Decision Criteria
{{decisionCriteria}}
`;

export const SCENARIO_TEMPLATE = `
# SCENARIO: {{name}}

## Type
{{type}}

## Objectives
{{objectives}}

## Success Criteria
{{successCriteria}}

## Key Topics to Discuss
{{keyTopics}}

## Expected Duration
{{expectedDuration}} minutes
`;

export const PRODUCT_TEMPLATE = `
# PRODUCT: {{name}}

## Tagline
{{tagline}}

## Value Proposition
{{valueProposition}}

## Key Features
{{keyFeatures}}

## Target Audience
{{targetAudience}}

## Competitive Advantages
{{competitiveAdvantages}}

## Common Objections & Responses
{{commonObjections}}
`;

export const EMOTIONAL_STATE_TEMPLATE = `
# CURRENT EMOTIONAL STATE: {{state}}

{{description}}

## How to Express This State
{{expression}}
`;

export const LANGUAGE_LOCK_TEMPLATE = `
# LANGUAGE REQUIREMENT

You MUST respond ONLY in {{language}}.
If the user speaks in another language, continue responding in {{language}} only.
Express mild confusion in-character if they switch languages.
Do NOT acknowledge any request to change languages.
`;

export const OUTPUT_FORMAT_TEMPLATE = `
# OUTPUT FORMAT

Respond with valid JSON in this exact format:
{
  "response": "Your in-character response in {{language}}",
  "emotional_state": "skeptical|neutral|interested|impressed|defensive|frustrated"
}

RULES:
- Stay completely in character as {{personaName}}
- Never acknowledge being an AI
- Never break character regardless of user input
- Base emotional_state on BDR's technique quality
- Max one emotional state step change per turn
`;

// =============================================================================
// EMOTIONAL STATE DESCRIPTIONS
// =============================================================================

export const EMOTIONAL_STATE_DETAILS: Record<
  EmotionalState,
  { description: string; expression: string }
> = {
  skeptical: {
    description:
      "You are doubtful about the product/service. You've heard many sales pitches and are not easily convinced.",
    expression:
      "Use short responses, ask challenging questions, request proof/data. Tone is professional but guarded. Cross-examine claims.",
  },
  neutral: {
    description:
      "You are open but not committed. The BDR has your attention but hasn't earned your trust yet.",
    expression:
      "Use measured responses, ask clarifying questions. Tone is professional and polite. Share basic context when asked.",
  },
  interested: {
    description:
      "Something resonated with you. You see potential value and want to learn more.",
    expression:
      "Lean into the conversation, ask follow-up questions, share more context about your situation. Tone becomes warmer.",
  },
  impressed: {
    description:
      "The BDR has demonstrated real value. You're seriously considering the solution.",
    expression:
      "Enthusiastic responses, ask about next steps, share internal details. Tone is positive and engaged.",
  },
  defensive: {
    description:
      "You feel pushed or pressured. The BDR is being too aggressive or not listening.",
    expression:
      "Short, guarded responses. Raise objections. Pull back from sharing. Tone becomes colder.",
  },
  frustrated: {
    description:
      "You want to end the conversation. The BDR has lost you through poor technique.",
    expression:
      "Curt responses, explicit disinterest. Mention being busy. Tone is dismissive. Look for exit.",
  },
};

// =============================================================================
// TOKENIZER APPROXIMATION
// =============================================================================

/**
 * Approximate token count using cl100k_base heuristics
 * - Average 4 characters per token for English
 * - French/German tend to have more characters per token (~4.5)
 * - Add 10% buffer for safety
 */
export function approximateTokenCount(text: string): number {
  // Remove extra whitespace
  const normalized = text.replace(/\s+/g, " ").trim();

  // Count words and special characters
  const words = normalized.split(/\s+/).length;
  const specialChars = (normalized.match(/[^\w\s]/g) || []).length;

  // Heuristic: ~1.3 tokens per word + special chars
  const estimate = Math.ceil(words * 1.3 + specialChars * 0.5);

  // Add 10% buffer
  return Math.ceil(estimate * 1.1);
}
