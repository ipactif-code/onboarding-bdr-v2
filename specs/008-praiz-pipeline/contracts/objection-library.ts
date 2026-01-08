/**
 * Praiz Pipeline - Objection Library Contract
 *
 * Types and interfaces for the Objection Library management.
 * Supports CRUD operations, filtering, and Context Builder integration.
 *
 * @module contracts/objection-library
 */

import type {
  DilitrustModule,
  ObjectionCategory,
  SupportedLanguage,
} from "./extraction";

// ============================================================================
// Constants
// ============================================================================

export const VALIDATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "archived",
] as const;

export const SCENARIO_TYPES = [
  "cold_call",
  "discovery",
  "demo",
  "negotiation",
  "closing",
] as const;

export const DEFAULT_EFFECTIVENESS_SCORE = 50;
export const DEFAULT_USAGE_COUNT = 0;

// ============================================================================
// Types
// ============================================================================

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];
export type ScenarioType = (typeof SCENARIO_TYPES)[number];

// ============================================================================
// RACC Response Types
// ============================================================================

/** RACC framework response structure */
export interface RaccResponse {
  /** Reframe: Empathetic validation of the objection */
  reframe: string;
  /** Address: Value-based response with data */
  address: string;
  /** Confirm: Verification question */
  confirm: string;
  /** Close: Propose next step */
  close: string;
}

/** RACC template for a specific category */
export interface RaccTemplate {
  reframe: {
    pattern: string;
    examples: Record<string, string>;
  };
  address: {
    pattern: string;
    requirements: string[];
  };
  confirm: {
    pattern: string;
    examples: Record<string, string>;
  };
  close: {
    pattern: string;
    examples: Record<string, string>;
  };
}

// ============================================================================
// Objection Entry Types
// ============================================================================

/** Full objection entry as stored in database */
export interface ObjectionEntry {
  /** Convex document ID */
  _id: string;
  /** URL-safe identifier */
  slug: string;
  /** Exact objection text */
  verbatim: string;
  /** Alternative phrasings */
  verbatimVariants: string[];
  /** Objection category */
  category: ObjectionCategory;
  /** DiliTrust module context */
  dilitrustModule: DilitrustModule;
  /** Compatible persona types */
  personaTypes: string[];
  /** Compatible scenario types */
  scenarioTypes: ScenarioType[];
  /** Language */
  language: SupportedLanguage;
  /** RACC response (may be partial) */
  raccResponse?: RaccResponse;
  /** Source video ID */
  sourceVideoId: string;
  /** Position in source video (seconds) */
  sourceTimestamp: number;
  /** When extracted */
  extractedAt: number;
  /** Extraction confidence 0-1 */
  extractionConfidence: number;
  /** Validation status */
  status: ValidationStatus;
  /** True if auto-approved (confidence >= 0.85) */
  autoApproved: boolean;
  /** Who validated */
  validatedBy?: string;
  /** When validated */
  validatedAt?: number;
  /** Rejection reason if rejected */
  rejectionReason?: string;
  /** Times used in training sessions */
  usageCount: number;
  /** Effectiveness score 0-100 */
  effectivenessScore: number;
  /** Last time used in training */
  lastUsedAt?: number;
  /** When freshness review is due */
  freshnessReviewAt: number;
  /** Whether objection is fresh */
  isFresh: boolean;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/** Objection entry for display (with computed fields) */
export interface ObjectionDisplay extends ObjectionEntry {
  /** Formatted extraction date */
  extractedAtFormatted: string;
  /** Formatted validation date */
  validatedAtFormatted?: string;
  /** Status badge variant */
  statusVariant: "success" | "warning" | "error" | "secondary";
  /** Has complete RACC response */
  hasCompleteRacc: boolean;
  /** Days until freshness review */
  daysUntilReview: number;
}

// ============================================================================
// Query Types
// ============================================================================

/** Filters for objection library queries */
export interface ObjectionFilters {
  /** Filter by validation status */
  status?: ValidationStatus;
  /** Filter by category */
  category?: ObjectionCategory;
  /** Filter by DiliTrust module */
  dilitrustModule?: DilitrustModule;
  /** Filter by language */
  language?: SupportedLanguage;
  /** Filter by freshness */
  isFresh?: boolean;
  /** Filter by RACC completeness */
  hasRaccResponse?: boolean;
  /** Search in verbatim text */
  searchQuery?: string;
}

/** Sort options for objection queries */
export interface ObjectionSort {
  field:
    | "extractedAt"
    | "validatedAt"
    | "effectivenessScore"
    | "usageCount"
    | "freshnessReviewAt";
  direction: "asc" | "desc";
}

/** Pagination for objection queries */
export interface ObjectionPagination {
  cursor?: string;
  limit: number;
}

/** Complete query input */
export interface ObjectionQueryInput {
  filters?: ObjectionFilters;
  sort?: ObjectionSort;
  pagination?: ObjectionPagination;
}

/** Query result with pagination */
export interface ObjectionQueryResult {
  items: ObjectionEntry[];
  nextCursor?: string;
  totalCount: number;
}

// ============================================================================
// Context Builder Integration
// ============================================================================

/** Input for Context Builder queries */
export interface ContextBuilderObjectionQuery {
  /** DiliTrust module for the session */
  dilitrustModule: DilitrustModule;
  /** Persona type for the session */
  personaType: string;
  /** Session language */
  language: SupportedLanguage;
  /** Scenario type */
  scenarioType?: ScenarioType;
  /** Maximum objections to return */
  limit?: number;
}

/** Objection formatted for AI injection */
export interface ContextBuilderObjection {
  /** Objection text to raise */
  verbatim: string;
  /** Alternative phrasings for variety */
  variants: string[];
  /** Category for tracking */
  category: ObjectionCategory;
  /** Expected RACC response pattern */
  expectedRaccPattern?: RaccResponse;
  /** Effectiveness weight for selection */
  weight: number;
}

// ============================================================================
// Mutation Types
// ============================================================================

/** Input for creating new objection */
export interface CreateObjectionInput {
  verbatim: string;
  verbatimVariants: string[];
  category: ObjectionCategory;
  dilitrustModule: DilitrustModule;
  personaTypes: string[];
  scenarioTypes: ScenarioType[];
  language: SupportedLanguage;
  sourceVideoId: string;
  sourceTimestamp: number;
  extractionConfidence: number;
  raccResponse?: RaccResponse;
}

/** Input for updating objection */
export interface UpdateObjectionInput {
  objectionId: string;
  verbatim?: string;
  verbatimVariants?: string[];
  category?: ObjectionCategory;
  personaTypes?: string[];
  scenarioTypes?: ScenarioType[];
  raccResponse?: RaccResponse;
}

/** Input for validating objection */
export interface ValidateObjectionInput {
  objectionId: string;
  action: "approve" | "reject";
  rejectionReason?: string;
}

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Check if RACC response is complete
 */
export function isRaccComplete(racc?: RaccResponse): boolean {
  if (!racc) return false;
  return (
    racc.reframe.length > 0 &&
    racc.address.length > 0 &&
    racc.confirm.length > 0 &&
    racc.close.length > 0
  );
}

/**
 * Get status badge variant
 */
export function getStatusVariant(
  status: ValidationStatus
): "success" | "warning" | "error" | "secondary" {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "error";
    case "archived":
      return "secondary";
  }
}

/**
 * Calculate days until freshness review
 */
export function daysUntilReview(freshnessReviewAt: number): number {
  const now = Date.now();
  const diff = freshnessReviewAt - now;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/**
 * Format objection for display
 */
export function formatObjectionForDisplay(
  entry: ObjectionEntry
): ObjectionDisplay {
  return {
    ...entry,
    extractedAtFormatted: new Date(entry.extractedAt).toLocaleDateString(),
    validatedAtFormatted: entry.validatedAt
      ? new Date(entry.validatedAt).toLocaleDateString()
      : undefined,
    statusVariant: getStatusVariant(entry.status),
    hasCompleteRacc: isRaccComplete(entry.raccResponse),
    daysUntilReview: daysUntilReview(entry.freshnessReviewAt),
  };
}

/**
 * Calculate effectiveness weight for Context Builder selection
 */
export function calculateSelectionWeight(
  effectivenessScore: number,
  usageCount: number,
  isFresh: boolean
): number {
  // Base weight from effectiveness (0-100 -> 0.5-1.5)
  const effectivenessWeight = 0.5 + effectivenessScore / 100;

  // Usage factor (slight boost for proven objections)
  const usageFactor = Math.min(1.2, 1 + usageCount / 100);

  // Freshness penalty
  const freshnessFactor = isFresh ? 1 : 0.7;

  return effectivenessWeight * usageFactor * freshnessFactor;
}

/**
 * Filter objections for Context Builder query
 */
export function matchesContextBuilderQuery(
  entry: ObjectionEntry,
  query: ContextBuilderObjectionQuery
): boolean {
  // Must be approved and fresh
  if (entry.status !== "approved") return false;
  if (!entry.isFresh) return false;

  // Must match module and language
  if (entry.dilitrustModule !== query.dilitrustModule) return false;
  if (entry.language !== query.language) return false;

  // Persona type match (if specified)
  if (query.personaType && !entry.personaTypes.includes(query.personaType)) {
    return false;
  }

  // Scenario type match (if specified)
  if (
    query.scenarioType &&
    !entry.scenarioTypes.includes(query.scenarioType)
  ) {
    return false;
  }

  return true;
}

/**
 * Convert objection to Context Builder format
 */
export function toContextBuilderFormat(
  entry: ObjectionEntry
): ContextBuilderObjection {
  return {
    verbatim: entry.verbatim,
    variants: entry.verbatimVariants,
    category: entry.category,
    expectedRaccPattern: entry.raccResponse,
    weight: calculateSelectionWeight(
      entry.effectivenessScore,
      entry.usageCount,
      entry.isFresh
    ),
  };
}

// ============================================================================
// RACC Templates (Pre-seeded)
// ============================================================================

export const RACC_TEMPLATES: Record<ObjectionCategory, RaccTemplate> = {
  existing_solution: {
    reframe: {
      pattern: "Je comprends [validation empathique de l'objection]...",
      examples: {
        fr: "Je comprends, vous avez investi dans un système qui fonctionne.",
        en: "I understand, you've invested in a system that works.",
      },
    },
    address: {
      pattern: "[Valeur + données + case study]",
      requirements: [
        "Doit contenir au moins 1 métrique chiffrée",
        "Doit mentionner un case study si possible",
      ],
    },
    confirm: {
      pattern: "Est-ce que [question de vérification]?",
      examples: {
        fr: "Est-ce que le manque de visibilité sur les échéances est un problème pour vous?",
        en: "Is the lack of visibility on deadlines a problem for you?",
      },
    },
    close: {
      pattern: "Si [condition], [proposition next step]",
      examples: {
        fr: "Si je vous montre comment FM Logistics a migré en 6 semaines, seriez-vous ouvert à une démo?",
        en: "If I show you how FM Logistics migrated in 6 weeks, would you be open to a demo?",
      },
    },
  },
  price: {
    reframe: {
      pattern: "Je comprends [validation du budget comme préoccupation]...",
      examples: {
        fr: "Je comprends que le budget est une préoccupation importante.",
        en: "I understand that budget is an important concern.",
      },
    },
    address: {
      pattern: "[ROI + TCO comparison + case study]",
      requirements: [
        "Doit contenir le ROI en mois",
        "Doit comparer TCO vs alternatives",
      ],
    },
    confirm: {
      pattern: "Le ROI en [X] mois répond-il à vos critères?",
      examples: {
        fr: "Le ROI en 6 mois répond-il à vos critères d'investissement?",
        en: "Does the 6-month ROI meet your investment criteria?",
      },
    },
    close: {
      pattern: "Si [business case], [next step]",
      examples: {
        fr: "Si je vous prépare un business case personnalisé, pouvons-nous en discuter la semaine prochaine?",
        en: "If I prepare a personalized business case, can we discuss it next week?",
      },
    },
  },
  timing: {
    reframe: {
      pattern: "Je comprends [validation du timing]...",
      examples: {
        fr: "Je comprends que le timing n'est pas idéal en ce moment.",
        en: "I understand the timing isn't ideal right now.",
      },
    },
    address: {
      pattern: "[Urgence + coût de l'inaction]",
      requirements: ["Doit quantifier le coût de l'inaction"],
    },
    confirm: {
      pattern: "Quand serait le bon moment pour [action]?",
      examples: {
        fr: "Quand serait le bon moment pour revoir ce sujet?",
        en: "When would be the right time to revisit this?",
      },
    },
    close: {
      pattern: "Si [condition timing], [proposition low-commitment]",
      examples: {
        fr: "Si on planifie une démo dans 3 mois, cela vous conviendrait?",
        en: "If we schedule a demo in 3 months, would that work for you?",
      },
    },
  },
  competition: {
    reframe: {
      pattern: "Je comprends [validation de l'évaluation]...",
      examples: {
        fr: "Je comprends, vous évaluez plusieurs options.",
        en: "I understand, you're evaluating several options.",
      },
    },
    address: {
      pattern: "[Différentiateurs clés + proof points]",
      requirements: [
        "Doit mentionner les 3 différentiateurs clés",
        "Ne pas dénigrer la concurrence",
      ],
    },
    confirm: {
      pattern: "Qu'est-ce qui vous a plu chez [concurrent]?",
      examples: {
        fr: "Qu'est-ce qui vous a plu chez Icertis?",
        en: "What did you like about Icertis?",
      },
    },
    close: {
      pattern: "Puis-je vous montrer [différentiateur] qui fait souvent la différence?",
      examples: {
        fr: "Puis-je vous montrer notre approche sur l'intégration ERP?",
        en: "Can I show you our approach to ERP integration?",
      },
    },
  },
  complexity: {
    reframe: {
      pattern: "Je comprends [validation de la préoccupation complexité]...",
      examples: {
        fr: "Je comprends que la mise en place semble complexe.",
        en: "I understand the implementation seems complex.",
      },
    },
    address: {
      pattern: "[Simplification + accompagnement + timeline]",
      requirements: ["Doit mentionner le délai de déploiement"],
    },
    confirm: {
      pattern: "Quel aspect vous préoccupe le plus?",
      examples: {
        fr: "Quel aspect de la mise en place vous préoccupe le plus?",
        en: "Which aspect of the implementation concerns you most?",
      },
    },
    close: {
      pattern: "Si [simplification], [next step]",
      examples: {
        fr: "Si je vous montre notre parcours de déploiement simplifié?",
        en: "What if I show you our simplified deployment journey?",
      },
    },
  },
  authority: {
    reframe: {
      pattern: "Je comprends [validation du processus décisionnel]...",
      examples: {
        fr: "Je comprends, ce type de décision implique plusieurs parties prenantes.",
        en: "I understand, this type of decision involves multiple stakeholders.",
      },
    },
    address: {
      pattern: "[Aide à la vente interne + matériaux]",
      requirements: ["Doit proposer des supports pour convaincre en interne"],
    },
    confirm: {
      pattern: "Qui d'autre devrait être impliqué dans cette évaluation?",
      examples: {
        fr: "Qui d'autre devrait être impliqué dans cette évaluation?",
        en: "Who else should be involved in this evaluation?",
      },
    },
    close: {
      pattern: "Si [aide interne], [proposition multi-stakeholder]",
      examples: {
        fr: "Puis-je vous préparer une présentation pour votre comité?",
        en: "Can I prepare a presentation for your committee?",
      },
    },
  },
  budget: {
    reframe: {
      pattern: "Je comprends [validation de la contrainte budgétaire]...",
      examples: {
        fr: "Je comprends que le budget n'est pas prévu cette année.",
        en: "I understand the budget isn't planned for this year.",
      },
    },
    address: {
      pattern: "[Flexibilité paiement + ROI rapide]",
      requirements: ["Doit mentionner les options de paiement flexibles"],
    },
    confirm: {
      pattern: "Quand le budget serait-il disponible?",
      examples: {
        fr: "Quand le budget serait-il potentiellement disponible?",
        en: "When would the budget potentially be available?",
      },
    },
    close: {
      pattern: "Si [option budget], [proposition adaptée]",
      examples: {
        fr: "Si on commence par un pilote avec budget réduit?",
        en: "What if we start with a pilot at reduced budget?",
      },
    },
  },
  security: {
    reframe: {
      pattern: "Je comprends [validation de l'importance sécurité]...",
      examples: {
        fr: "Je comprends, la sécurité des données est primordiale.",
        en: "I understand, data security is paramount.",
      },
    },
    address: {
      pattern: "[Certifications + souveraineté + architecture]",
      requirements: [
        "Doit mentionner les certifications (ISO, SOC2)",
        "Doit mentionner la souveraineté EU",
      ],
    },
    confirm: {
      pattern: "Quelles certifications sont requises par votre équipe sécurité?",
      examples: {
        fr: "Quelles certifications sont requises par votre équipe sécurité?",
        en: "What certifications are required by your security team?",
      },
    },
    close: {
      pattern: "Si [documentation sécurité], [proposition assessment]",
      examples: {
        fr: "Puis-je organiser un appel avec notre RSSI et le vôtre?",
        en: "Can I arrange a call between our CISO and yours?",
      },
    },
  },
  integration: {
    reframe: {
      pattern: "Je comprends [validation de la préoccupation intégration]...",
      examples: {
        fr: "Je comprends, l'intégration avec votre SI existant est critique.",
        en: "I understand, integration with your existing IT is critical.",
      },
    },
    address: {
      pattern: "[Connecteurs natifs + API + cas similaires]",
      requirements: [
        "Doit mentionner les connecteurs disponibles",
        "Doit donner un exemple d'intégration réussie",
      ],
    },
    confirm: {
      pattern: "Quels systèmes doivent être connectés en priorité?",
      examples: {
        fr: "Quels systèmes doivent être connectés en priorité?",
        en: "Which systems need to be connected first?",
      },
    },
    close: {
      pattern: "Si [démonstration intégration], [next step technique]",
      examples: {
        fr: "Puis-je vous montrer notre connecteur SAP en action?",
        en: "Can I show you our SAP connector in action?",
      },
    },
  },
};
