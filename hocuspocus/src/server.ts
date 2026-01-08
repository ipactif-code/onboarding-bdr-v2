/**
 * Hocuspocus Server for Knowledge Base Real-Time Collaboration
 *
 * This server handles Yjs document synchronization for the Knowledge Base feature.
 * It authenticates users via Clerk JWT tokens and manages WebSocket connections
 * for real-time collaborative editing.
 *
 * Room naming convention: `kb-doc-{documentId}`
 *
 * @see https://tiptap.dev/docs/hocuspocus/server/hooks
 */

import {
  Server,
  type onConnectPayload,
  type onDisconnectPayload,
} from "@hocuspocus/server";
import { SQLite } from "@hocuspocus/extension-sqlite";
import { Throttle } from "@hocuspocus/extension-throttle";
import { verifyToken } from "@clerk/backend";
import { createServer } from "http";
import "dotenv/config";

// =============================================================================
// Constants
// =============================================================================

/** Debounce delay before syncing document changes (ms) */
const DEBOUNCE_MS = 2000;

/** Maximum wait time before forcing sync regardless of activity (ms) */
const MAX_DEBOUNCE_MS = 10000;

/** Duration to ban IP after rate limit exceeded (ms) */
const THROTTLE_BAN_TIME_MS = 60000;

/** Maximum connection attempts per minute per IP */
const THROTTLE_MAX_CONNECTIONS = 15;

/** Room name prefix for Knowledge Base documents */
const KB_DOC_ROOM_PREFIX = "kb-doc-";

/** Clock skew tolerance for JWT validation (ms) */
const CLOCK_SKEW_MS = 5000;

/** Port offset for health check endpoint relative to WebSocket port */
const HEALTH_PORT_OFFSET = 1;

/** Timeout for graceful shutdown before forcing exit (ms) */
const SHUTDOWN_TIMEOUT_MS = 5000;

// =============================================================================
// Environment Configuration
// =============================================================================

const PORT = parseInt(process.env.PORT ?? "1234", 10);
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const NODE_ENV = process.env.NODE_ENV ?? "development";
const SQLITE_PATH = process.env.SQLITE_PATH ?? "documents.sqlite";

/**
 * Validated user context returned from authentication.
 */
interface AuthenticatedUser {
  userId: string;
  sessionId: string | undefined;
}

/**
 * Log levels for structured logging.
 */
type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/**
 * Structured logger for server events.
 */
function log(level: LogLevel, category: string, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaString = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${timestamp}] [${level}] [${category}] ${message}${metaString}`);
}

// =============================================================================
// Startup Validation
// =============================================================================

if (!CLERK_SECRET_KEY) {
  log("ERROR", "CONFIG", "CLERK_SECRET_KEY environment variable is required");
  process.exit(1);
}

if (!CLERK_SECRET_KEY.startsWith("sk_")) {
  log("ERROR", "CONFIG", "CLERK_SECRET_KEY must start with 'sk_' (secret key format)");
  process.exit(1);
}

log("INFO", "CONFIG", "Configuration validated", {
  port: PORT,
  environment: NODE_ENV,
  clerkKeyPrefix: CLERK_SECRET_KEY.substring(0, 10) + "...",
  sqlitePath: SQLITE_PATH,
  sqlitePathSource: process.env.SQLITE_PATH ? "environment" : "default",
});

// =============================================================================
// Document Name Validation
// =============================================================================

/**
 * Validates that the document name follows the expected pattern.
 * Expected format: `kb-doc-{documentId}`
 */
function validateDocumentName(documentName: string): boolean {
  // Allow kb-doc-{id} pattern where id is alphanumeric
  const validPattern = new RegExp(`^${KB_DOC_ROOM_PREFIX}[a-zA-Z0-9]+$`);
  return validPattern.test(documentName);
}

// =============================================================================
// Server Configuration
// =============================================================================

const server = Server.configure({
  port: PORT,

  // ==========================================================================
  // Extensions: Persistence and Rate Limiting
  // ==========================================================================
  extensions: [
    // SQLite persistence - stores documents for durability across restarts
    new SQLite({
      database: SQLITE_PATH,
    }),

    // Rate limiting - prevents connection abuse
    new Throttle({
      banTime: THROTTLE_BAN_TIME_MS,
      throttle: THROTTLE_MAX_CONNECTIONS,
    }),
  ],

  /**
   * Authenticate incoming connections using Clerk JWT tokens.
   *
   * The token is passed from the client via connection parameters.
   * This hook validates the JWT signature and extracts user information.
   *
   * @throws Error if authentication fails
   */
  async onAuthenticate({ token, documentName }): Promise<AuthenticatedUser> {
    // Validate token presence
    if (!token) {
      log("WARN", "AUTH", "Connection rejected: No token provided", { documentName });
      throw new Error("Authentication required: No token provided");
    }

    // Validate document name format
    if (!validateDocumentName(documentName)) {
      log("WARN", "AUTH", "Connection rejected: Invalid document name format", { documentName });
      throw new Error("Invalid document name format");
    }

    try {
      // Verify the Clerk JWT token
      const payload = await verifyToken(token, {
        secretKey: CLERK_SECRET_KEY,
        clockSkewInMs: CLOCK_SKEW_MS,
      });

      const userId = payload.sub;
      const sessionId = payload.sid;

      if (!userId) {
        log("WARN", "AUTH", "Connection rejected: Token missing subject claim", { documentName });
        throw new Error("Invalid token: Missing user identifier");
      }

      log("INFO", "AUTH", "User authenticated successfully", {
        userId,
        sessionId,
        documentName,
      });

      // Return user context for use in other hooks
      return {
        userId,
        sessionId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log("ERROR", "AUTH", "Token validation failed", {
        documentName,
        error: errorMessage,
      });

      // Throw a generic error to avoid leaking validation details
      throw new Error("Authentication failed: Invalid or expired token");
    }
  },

  /**
   * Handle new connections after authentication succeeds.
   */
  async onConnect(data: onConnectPayload): Promise<void> {
    const user = data.context as AuthenticatedUser | undefined;
    log("INFO", "CONNECT", "User connected", {
      userId: user?.userId,
      documentName: data.documentName,
      socketId: data.socketId,
    });
  },

  /**
   * Handle disconnections.
   */
  async onDisconnect(data: onDisconnectPayload): Promise<void> {
    const user = data.context as AuthenticatedUser | undefined;
    log("INFO", "DISCONNECT", "User disconnected", {
      userId: user?.userId,
      documentName: data.documentName,
      socketId: data.socketId,
      clientsCount: data.clientsCount,
    });
  },

  /**
   * Log document persistence events (development only).
   */
  async afterStoreDocument({ documentName }): Promise<void> {
    if (NODE_ENV === "development") {
      log("DEBUG", "PERSIST", `Document ${documentName} saved to SQLite`);
    }
  },

  // Debounce settings for document changes
  // This helps reduce the number of sync operations
  debounce: DEBOUNCE_MS,
  maxDebounce: MAX_DEBOUNCE_MS,

  // Quiet mode reduces console noise in production
  quiet: NODE_ENV === "production",
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    log("WARN", "SHUTDOWN", "Shutdown already in progress, ignoring signal", { signal });
    return;
  }

  isShuttingDown = true;
  log("INFO", "SHUTDOWN", "Graceful shutdown initiated", { signal });

  try {
    await server.destroy();
    log("INFO", "SHUTDOWN", "Hocuspocus server destroyed successfully");

    // Close health check server
    if (healthServer) {
      healthServer.close(() => {
        log("INFO", "SHUTDOWN", "Health check server closed successfully");
        process.exit(0);
      });

      // Force close if graceful shutdown hangs
      setTimeout(() => {
        log("WARN", "SHUTDOWN", "Forcing shutdown after timeout");
        process.exit(0);
      }, SHUTDOWN_TIMEOUT_MS);
    } else {
      process.exit(0);
    }
  } catch (error) {
    log("ERROR", "SHUTDOWN", "Error during shutdown", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  log("ERROR", "FATAL", "Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
  void gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  log("ERROR", "FATAL", "Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  void gracefulShutdown("unhandledRejection");
});

// =============================================================================
// HTTP Health Check Server
// =============================================================================

/**
 * Simple HTTP server for health checks.
 * Docker/orchestrators can hit /health to verify the service is running.
 * Runs on a separate port to avoid interfering with WebSocket connections.
 */
const HEALTH_PORT = PORT + HEALTH_PORT_OFFSET;
const healthServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      wsPort: PORT,
      healthPort: HEALTH_PORT,
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(HEALTH_PORT, () => {
  log("INFO", "HEALTH", `Health check endpoint available at http://localhost:${HEALTH_PORT}/health`);
});

// =============================================================================
// Server Startup
// =============================================================================

// Actually start the WebSocket server
server.listen()
  .then(() => {
    log("INFO", "SERVER", `Hocuspocus WebSocket server listening on port ${PORT}`, {
      environment: NODE_ENV,
      debounce: DEBOUNCE_MS,
      maxDebounce: MAX_DEBOUNCE_MS,
    });
    log("INFO", "SERVER", "Waiting for WebSocket connections...");
  })
  .catch((error) => {
    log("ERROR", "SERVER", "Failed to start Hocuspocus server", {
      error: error instanceof Error ? error.message : "Unknown error",
      port: PORT,
    });
    process.exit(1);
  });
