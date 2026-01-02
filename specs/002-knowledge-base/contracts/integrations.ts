/**
 * API Contracts: Integrations
 *
 * Convex queries and mutations for LMS links and external integrations.
 * External integrations (GitHub, Jira, Linear, MS365) use Nango Cloud.
 * All functions require authentication via requireAuth().
 */

import { v } from "convex/values";

// =============================================================================
// VALIDATORS
// =============================================================================

export const linkType = v.union(
  v.literal("reference"),    // General reference
  v.literal("supplement"),   // Supplementary material
  v.literal("prerequisite")  // Required reading
);

export const externalProvider = v.union(
  v.literal("github"),
  v.literal("jira"),
  v.literal("linear"),
  v.literal("microsoft")
);

export const documentLinkInput = v.object({
  documentId: v.id("kbDocuments"),
  linkType: linkType,
  // One must be set
  courseId: v.optional(v.id("courses")),
  lessonId: v.optional(v.id("lessons")),
});

// =============================================================================
// LMS INTEGRATION QUERIES
// =============================================================================

/**
 * Get LMS links for a document.
 *
 * @param documentId - Document to get links for
 * @returns Array of linked courses and lessons
 *
 * @example
 * const links = useQuery(api.knowledge.integrations.getDocumentLinks, {
 *   documentId,
 * });
 */
export const getDocumentLinks = {
  args: {
    documentId: v.id("kbDocuments"),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocumentLinks"),
      linkType: linkType,
      // Course or lesson info
      target: v.union(
        v.object({
          type: v.literal("course"),
          _id: v.id("courses"),
          title: v.string(),
          description: v.optional(v.string()),
          coverImageUrl: v.optional(v.string()),
        }),
        v.object({
          type: v.literal("lesson"),
          _id: v.id("lessons"),
          title: v.string(),
          courseName: v.string(),
          sectionName: v.string(),
        })
      ),
      createdBy: v.object({
        _id: v.id("users"),
        name: v.string(),
      }),
      createdAt: v.number(),
    })
  ),
};

/**
 * Get documents linked to a course.
 *
 * Used to show "Related documents" on course page.
 *
 * @param courseId - Course to get documents for
 * @returns Array of linked documents
 *
 * @example
 * const docs = useQuery(api.knowledge.integrations.getCourseDocuments, {
 *   courseId,
 * });
 */
export const getCourseDocuments = {
  args: {
    courseId: v.id("courses"),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      linkType: linkType,
      workspaceName: v.string(),
      folderName: v.string(),
    })
  ),
};

/**
 * Get documents linked to a lesson.
 *
 * @param lessonId - Lesson to get documents for
 * @returns Array of linked documents
 *
 * @example
 * const docs = useQuery(api.knowledge.integrations.getLessonDocuments, {
 *   lessonId,
 * });
 */
export const getLessonDocuments = {
  args: {
    lessonId: v.id("lessons"),
  },
  returns: v.array(
    v.object({
      _id: v.id("kbDocuments"),
      title: v.string(),
      icon: v.optional(v.string()),
      linkType: linkType,
      workspaceName: v.string(),
      folderName: v.string(),
    })
  ),
};

/**
 * Search courses and lessons for linking.
 *
 * @param query - Search query
 * @param type - Filter by type (optional)
 * @returns Matching courses and lessons
 *
 * @example
 * const results = useQuery(api.knowledge.integrations.searchLMSContent, {
 *   query: "sales",
 * });
 */
export const searchLMSContent = {
  args: {
    query: v.string(),
    type: v.optional(v.union(v.literal("course"), v.literal("lesson"))),
  },
  returns: v.object({
    courses: v.array(
      v.object({
        _id: v.id("courses"),
        title: v.string(),
        description: v.optional(v.string()),
      })
    ),
    lessons: v.array(
      v.object({
        _id: v.id("lessons"),
        title: v.string(),
        courseName: v.string(),
        sectionName: v.string(),
      })
    ),
  }),
};

// =============================================================================
// LMS INTEGRATION MUTATIONS
// =============================================================================

/**
 * Link a document to a course or lesson.
 *
 * @param input - Link details
 * @returns Created link ID
 * @throws Error if user lacks write permission on document
 *
 * @example
 * const linkId = await createDocumentLink({
 *   documentId,
 *   courseId,
 *   linkType: "supplement",
 * });
 */
export const createDocumentLink = {
  args: documentLinkInput,
  returns: v.id("kbDocumentLinks"),
};

/**
 * Update link type.
 *
 * @param linkId - Link to update
 * @param linkType - New link type
 *
 * @example
 * await updateDocumentLink({
 *   linkId,
 *   linkType: "prerequisite",
 * });
 */
export const updateDocumentLink = {
  args: {
    linkId: v.id("kbDocumentLinks"),
    linkType: linkType,
  },
  returns: v.null(),
};

/**
 * Remove a document link.
 *
 * @param linkId - Link to remove
 *
 * @example
 * await removeDocumentLink({ linkId });
 */
export const removeDocumentLink = {
  args: {
    linkId: v.id("kbDocumentLinks"),
  },
  returns: v.null(),
};

// =============================================================================
// EXTERNAL INTEGRATIONS (P4 - Nango Cloud)
// =============================================================================

/**
 * Get connected external integrations for current user.
 *
 * @returns Array of connected providers
 *
 * @example
 * const integrations = useQuery(api.knowledge.integrations.getConnections);
 */
export const getConnections = {
  args: {},
  returns: v.array(
    v.object({
      provider: externalProvider,
      isConnected: v.boolean(),
      connectedAt: v.optional(v.number()),
      accountName: v.optional(v.string()),
      scopes: v.optional(v.array(v.string())),
    })
  ),
};

/**
 * Get OAuth URL for connecting an integration.
 *
 * @param provider - Provider to connect
 * @returns OAuth redirect URL
 *
 * @example
 * const { url } = await getOAuthUrl({ provider: "github" });
 * window.location.href = url;
 */
export const getOAuthUrl = {
  args: {
    provider: externalProvider,
  },
  returns: v.object({
    url: v.string(),
    state: v.string(), // For CSRF protection
  }),
};

/**
 * Complete OAuth flow after redirect.
 *
 * @param provider - Provider being connected
 * @param code - OAuth authorization code
 * @param state - CSRF state token
 * @returns Connection result
 *
 * @example
 * await completeOAuth({
 *   provider: "github",
 *   code: searchParams.get("code"),
 *   state: searchParams.get("state"),
 * });
 */
export const completeOAuth = {
  args: {
    provider: externalProvider,
    code: v.string(),
    state: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    accountName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
};

/**
 * Disconnect an external integration.
 *
 * @param provider - Provider to disconnect
 *
 * @example
 * await disconnectIntegration({ provider: "github" });
 */
export const disconnectIntegration = {
  args: {
    provider: externalProvider,
  },
  returns: v.null(),
};

/**
 * Fetch GitHub issue for embedding.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @returns Issue data
 *
 * @example
 * const issue = await fetchGitHubIssue({
 *   owner: "company",
 *   repo: "product",
 *   issueNumber: 123,
 * });
 */
export const fetchGitHubIssue = {
  args: {
    owner: v.string(),
    repo: v.string(),
    issueNumber: v.number(),
  },
  returns: v.union(
    v.object({
      title: v.string(),
      number: v.number(),
      state: v.union(v.literal("open"), v.literal("closed")),
      author: v.string(),
      createdAt: v.string(),
      body: v.optional(v.string()),
      labels: v.array(v.string()),
      url: v.string(),
    }),
    v.null()
  ),
};

/**
 * Fetch Jira issue for embedding.
 *
 * @param issueKey - Jira issue key (e.g., "PROJ-123")
 * @returns Issue data
 *
 * @example
 * const issue = await fetchJiraIssue({ issueKey: "SALES-456" });
 */
export const fetchJiraIssue = {
  args: {
    issueKey: v.string(),
  },
  returns: v.union(
    v.object({
      key: v.string(),
      summary: v.string(),
      status: v.string(),
      type: v.string(),
      assignee: v.optional(v.string()),
      priority: v.optional(v.string()),
      url: v.string(),
    }),
    v.null()
  ),
};

/**
 * Fetch Linear issue for embedding.
 *
 * @param issueId - Linear issue identifier
 * @returns Issue data
 *
 * @example
 * const issue = await fetchLinearIssue({ issueId: "ABC-123" });
 */
export const fetchLinearIssue = {
  args: {
    issueId: v.string(),
  },
  returns: v.union(
    v.object({
      identifier: v.string(),
      title: v.string(),
      state: v.string(),
      assignee: v.optional(v.string()),
      priority: v.optional(v.number()),
      url: v.string(),
    }),
    v.null()
  ),
};

// =============================================================================
// EMBED DETECTION
// =============================================================================

/**
 * Detect embed provider from URL.
 *
 * @param url - URL to detect
 * @returns Detected embed info or null
 *
 * @example
 * const embed = await detectEmbed({ url: "https://github.com/owner/repo/issues/123" });
 * // { provider: "github", type: "issue", data: {...} }
 */
export const detectEmbed = {
  args: {
    url: v.string(),
  },
  returns: v.union(
    v.object({
      provider: v.union(
        v.literal("youtube"),
        v.literal("vimeo"),
        v.literal("loom"),
        v.literal("figma"),
        v.literal("google_docs"),
        v.literal("github"),
        v.literal("jira"),
        v.literal("linear")
      ),
      type: v.string(), // video, design, document, issue, etc.
      embedUrl: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
    v.null()
  ),
};
