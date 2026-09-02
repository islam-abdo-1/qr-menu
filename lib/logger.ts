import pino from "pino";

/**
 * Structured logger using Pino.
 * - Development: pretty printed with colors
 * - Production: JSON lines to stdout (Vercel captures automatically)
 * - Includes correlation ID support for request tracing
 */

const isDevelopment = process.env.NODE_ENV !== "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    service: "qr-menu",
    env: process.env.NODE_ENV || "development",
  },
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Create a logger with correlation ID for request tracing
 */
export function createRequestLogger(correlationId: string, additionalContext?: Record<string, unknown>) {
  return logger.child({ correlationId, ...additionalContext });
}

export default logger;