/**
 * Praiz Pipeline - Extraction Contract
 *
 * Types and interfaces for AI-powered pattern extraction from sales call transcripts.
 * Uses Claude Sonnet for quality extraction of objections, winning phrases, and failure patterns.
 *
 * @module contracts/extraction
 */

// ============================================================================
// Constants
// ============================================================================

export const EXTRACTION_CONFIG = {
  /** AI model for extraction */
  model: "claude-3-5-sonnet-20241022",
  /** Temperature for consistent extraction */
  temperature: 0.2,
  /** Maximum tokens for extraction response */
  maxTokens: 4096,
  /** Target cost per video in USD */
  targetCostPerVideo: 0.5,
} as const;

export const CONFIDENCE_THRESHOLDS = {
  /** Auto-approve if confidence >= this value */
  autoApprove: 0.85,
  /** Require manual validation if confidence >= this value */
  manualValidation: 0.7,
  /** Auto-reject if confidence < manualValidation */
} as const;

export const OBJECTION_CATEGORIES = [
  "existing_solution",
  "price",
  "timing",
  "competition",
  "complexity",
  "authority",
  "budget",
  "security",
  "integration",
] as const;

export const PHRASE_TYPES = [
  "opener",
  "value_prop",
  "pain_question",
  "closing",
  "objection_response",
  "buying_signal_response",
] as const;

export const DILITRUST_MODULES = [
  "clm",
  "board",
  "entities",
  "litigation",
  "doc_library",
] as const;

export const SUPPORTED_LANGUAGES = ["fr", "en", "it", "es", "de"] as const;

export const DEAL_OUTCOMES = ["won", "lost", "stalled", "unknown"] as const;

// ============================================================================
// Types
// ============================================================================

export type ObjectionCategory = (typeof OBJECTION_CATEGORIES)[number];
export type PhraseType = (typeof PHRASE_TYPES)[number];
export type DilitrustModule = (typeof DILITRUST_MODULES)[number];
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type DealOutcome = (typeof DEAL_OUTCOMES)[number];

// ============================================================================
// Extraction Input Types
// ============================================================================

/** Input for the extraction action */
export interface ExtractionInput {
  /** Praiz video ID */
  videoId: string;
  /** Full transcript text */
  transcript: string;
  /** Detected or provided language */
  language: SupportedLanguage;
  /** DiliTrust module context */
  dilitrustModule: DilitrustModule;
  /** Deal outcome for pattern segmentation */
  dealOutcome: DealOutcome;
  /** Video duration in seconds */
  durationSeconds: number;
}

/** Context passed to the extraction prompt */
export interface ExtractionContext {
  module: DilitrustModule;
  dealOutcome: DealOutcome;
  language: SupportedLanguage;
}

// ============================================================================
// Extraction Output Types
// ============================================================================

/** Extracted objection from transcript */
export interface ExtractedObjection {
  /** Exact quote from prospect */
  verbatim: string;
  /** Objection category */
  category: ObjectionCategory;
  /** Position in video (seconds) */
  timestamp: number;
  /** Description of prospect's reaction */
  prospectReaction: string;
  /** What the salesperson responded */
  salesResponse: string;
  /** Whether the response was effective */
  responseEffective: boolean;
  /** Confidence score 0-1 */
  confidence: number;
}

/** Extracted winning phrase from transcript */
export interface ExtractedPhrase {
  /** Exact quote from salesperson */
  phrase: string;
  /** Context leading to this phrase */
  context: string;
  /** Positive outcome triggered */
  outcome: string;
  /** Type of phrase */
  phraseType: PhraseType;
  /** Position in video (seconds) */
  timestamp: number;
  /** Confidence score 0-1 */
  confidence: number;
}

/** Extracted failure pattern from transcript */
export interface ExtractedFailure {
  /** What the salesperson did/said wrong */
  action: string;
  /** Situation context */
  context: string;
  /** Negative outcome triggered */
  negativeOutcome: string;
  /** Suggested better approach */
  betterAlternative: string;
  /** Position in video (seconds) */
  timestamp: number;
  /** Confidence score 0-1 */
  confidence: number;
}

/** Call summary from extraction */
export interface CallSummary {
  /** Duration in minutes */
  duration: number;
  /** Main objections raised */
  mainObjections: string[];
  /** Key moments in the call */
  keyMoments: string[];
  /** Overall call quality 0-100 */
  overallQuality: number;
}

/** Complete extraction result from Claude */
export interface ExtractionResult {
  /** Extracted objections */
  objections: ExtractedObjection[];
  /** Extracted winning phrases */
  winningPhrases: ExtractedPhrase[];
  /** Extracted failure patterns */
  failurePatterns: ExtractedFailure[];
  /** Call summary */
  callSummary: CallSummary;
}

/** Wrapper with metadata */
export interface ExtractionOutput {
  /** The extraction results */
  result: ExtractionResult;
  /** Total tokens used */
  tokensUsed: number;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ============================================================================
// Prompt Template
// ============================================================================

export const EXTRACTION_PROMPT_TEMPLATE = `
Tu es un expert en analyse de conversations commerciales B2B.
Analyse ce transcript d'un appel de vente DiliTrust et extrais:

1. OBJECTIONS: Toute résistance ou préoccupation exprimée par le prospect
2. WINNING PHRASES: Phrases du commercial qui ont provoqué une réaction positive
3. FAILURE PATTERNS: Erreurs qui ont provoqué une réaction négative

CONTEXTE:
- Module DiliTrust: {module}
- Issue de l'appel: {dealOutcome}
- Langue: {language}

TRANSCRIPT:
{transcript}

OUTPUT FORMAT (JSON strict):
{
  "objections": [
    {
      "verbatim": "Citation exacte du prospect",
      "category": "existing_solution|price|timing|competition|complexity|authority|budget|security|integration",
      "timestamp": 123,
      "prospectReaction": "Description de la réaction",
      "salesResponse": "Ce que le commercial a répondu",
      "responseEffective": true,
      "confidence": 0.85
    }
  ],
  "winningPhrases": [
    {
      "phrase": "Citation exacte du commercial",
      "context": "Ce qui se passait avant",
      "outcome": "Réaction positive du prospect",
      "phraseType": "opener|value_prop|pain_question|closing|objection_response|buying_signal_response",
      "timestamp": 123,
      "confidence": 0.85
    }
  ],
  "failurePatterns": [
    {
      "action": "Ce que le commercial a fait/dit",
      "context": "Situation",
      "negativeOutcome": "Réaction négative",
      "betterAlternative": "Ce qu'il aurait dû faire",
      "timestamp": 123,
      "confidence": 0.85
    }
  ],
  "callSummary": {
    "duration": 15,
    "mainObjections": ["liste des principales objections"],
    "keyMoments": ["moments clés de l'appel"],
    "overallQuality": 75
  }
}

IMPORTANT:
- Extrais UNIQUEMENT les objections réelles (pas les questions neutres)
- La confidence reflète la certitude de la catégorisation
- Anonymise automatiquement les noms de personnes et sociétés avec [PERSON] et [COMPANY]
- Retourne un JSON valide uniquement, sans texte avant ou après
`;

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Build extraction prompt with context
 */
export function buildExtractionPrompt(
  transcript: string,
  context: ExtractionContext
): string {
  return EXTRACTION_PROMPT_TEMPLATE.replace("{module}", context.module)
    .replace("{dealOutcome}", context.dealOutcome)
    .replace("{language}", context.language)
    .replace("{transcript}", transcript);
}

/**
 * Determine validation status based on confidence
 */
export function determineValidationStatus(
  confidence: number
): "approved" | "pending" | "rejected" {
  if (confidence >= CONFIDENCE_THRESHOLDS.autoApprove) {
    return "approved";
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.manualValidation) {
    return "pending";
  }
  return "rejected";
}

/**
 * Check if extraction should be auto-approved
 */
export function isAutoApproved(confidence: number): boolean {
  return confidence >= CONFIDENCE_THRESHOLDS.autoApprove;
}

/**
 * Generate slug from objection properties
 */
export function generateObjectionSlug(
  category: ObjectionCategory,
  module: DilitrustModule,
  language: SupportedLanguage,
  index: number
): string {
  return `${category}-${module}-${language}-${Date.now()}-${index}`;
}

/**
 * Calculate freshness review date (12 months from extraction)
 */
export function calculateFreshnessReviewDate(extractedAt: number): number {
  const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;
  return extractedAt + TWELVE_MONTHS_MS;
}

/**
 * Validate extraction result structure
 */
export function validateExtractionResult(
  result: unknown
): result is ExtractionResult {
  if (!result || typeof result !== "object") return false;

  const r = result as Record<string, unknown>;

  if (!Array.isArray(r.objections)) return false;
  if (!Array.isArray(r.winningPhrases)) return false;
  if (!Array.isArray(r.failurePatterns)) return false;
  if (!r.callSummary || typeof r.callSummary !== "object") return false;

  return true;
}

/**
 * Anonymize PII in text
 */
export function anonymizeText(text: string): string {
  let result = text;

  // Email pattern
  result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]");

  // Phone patterns (French and international)
  result = result.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g,
    "[PHONE]"
  );

  // Named entities should be handled by the LLM in the extraction prompt
  // This is a fallback for any missed patterns

  return result;
}
