/**
 * Sanitize Editor Content for Convex
 *
 * Removes JavaScript Map/Set objects and other non-serializable data
 * that Convex cannot store. Specifically handles Excalidraw's
 * collaborators and followedBy Map objects.
 */

/**
 * Recursively sanitizes any value, converting Maps/Sets to plain objects/arrays
 */
function deepSanitize(value: unknown): unknown {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Convert Map to plain object
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    value.forEach((v, k) => {
      obj[String(k)] = deepSanitize(v);
    });
    return obj;
  }

  // Convert Set to array
  if (value instanceof Set) {
    return Array.from(value).map(deepSanitize);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }

  // Handle plain objects
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = deepSanitize(val);
    }
    return sanitized;
  }

  // Primitives pass through
  return value;
}

/**
 * Sanitizes Excalidraw-specific data by removing problematic fields
 */
function sanitizeExcalidrawData(data: Record<string, unknown>): Record<string, unknown> {
  // Fields that contain Map objects or are not needed for persistence
  const fieldsToRemove = [
    'collaborators', // Map object - causes Convex error
    'followedBy', // Map object - causes Convex error
    'selectedElementIds', // Selection state - not needed
    'selectedGroupIds', // Selection state - not needed
    'editingGroupId', // Editing state - not needed
    'editingLinearElement', // Editing state - not needed
    'selectedLinearElement', // Editing state - not needed
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip fields that cause issues
    if (fieldsToRemove.includes(key)) {
      continue;
    }

    // Handle nested 'state' object (common Excalidraw structure)
    if (key === 'state' && typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeExcalidrawData(value as Record<string, unknown>);
    } else {
      sanitized[key] = deepSanitize(value);
    }
  }

  return sanitized;
}

/**
 * Main sanitization function for Plate.js editor content
 * Call this before saving content to Convex
 */
export function sanitizeEditorContent(content: unknown[]): unknown[] {
  if (!Array.isArray(content)) {
    console.warn('[Sanitizer] Content is not an array, returning as-is');
    return content;
  }

  return content.map((node) => {
    if (typeof node !== 'object' || node === null) {
      return node;
    }

    const nodeObj = node as Record<string, unknown>;

    // Check if this is an Excalidraw node
    if (nodeObj.type === 'excalidraw' && nodeObj.data) {
      return {
        ...nodeObj,
        data: sanitizeExcalidrawData(nodeObj.data as Record<string, unknown>),
      };
    }

    // For other nodes, just do deep sanitization to catch any Maps/Sets
    return deepSanitize(nodeObj);
  });
}

/**
 * Debug utility - validates content is Convex-safe
 * Use this in development to catch issues early
 */
export function validateContentForConvex(content: unknown, path = 'root'): string[] {
  const errors: string[] = [];

  if (content instanceof Map) {
    errors.push(`Map found at ${path}`);
  } else if (content instanceof Set) {
    errors.push(`Set found at ${path}`);
  } else if (content instanceof Function) {
    errors.push(`Function found at ${path}`);
  } else if (content instanceof Date) {
    // Dates should be converted to ISO strings
    errors.push(`Date found at ${path} - convert to ISO string`);
  } else if (Array.isArray(content)) {
    content.forEach((item, index) => {
      errors.push(...validateContentForConvex(item, `${path}[${index}]`));
    });
  } else if (typeof content === 'object' && content !== null) {
    Object.entries(content).forEach(([key, value]) => {
      errors.push(...validateContentForConvex(value, `${path}.${key}`));
    });
  }

  return errors;
}
