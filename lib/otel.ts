import "server-only";

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

/**
 * OpenTelemetry tracing setup for QR Menu.
 * - Auto-instrumentations for HTTP, Express, PostgreSQL
 * - OTLP HTTP exporter (configure OTEL_EXPORTER_OTLP_ENDPOINT for production)
 * - Resource attributes for service identification
 * 
 * Environment variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint (e.g., https://tempo.example.com/v1/traces)
 * - OTEL_SERVICE_NAME: Service name (default: qr-menu)
 * - OTEL_SERVICE_VERSION: Version (default: npm_package_version)
 * - OTEL_EXPORTER_OTLP_HEADERS: Optional headers (e.g., Authorization=Bearer token)
 */

// Enable internal diagnostics in development
if (process.env.NODE_ENV !== "production") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const serviceName = process.env.OTEL_SERVICE_NAME || "qr-menu";
const serviceVersion = process.env.npm_package_version || "unknown";

const resource = resourceFromAttributes({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
});

// Create tracer provider
const provider = new NodeTracerProvider({ resource });

// OTLP HTTP Exporter (configure endpoint via env)
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (otlpEndpoint) {
  const exporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : undefined,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (provider as any).addSpanProcessor(new BatchSpanProcessor(exporter));
}

// Register auto-instrumentations
registerInstrumentations({
  tracerProvider: provider,
  instrumentations: [
    new HttpInstrumentation({
      requestHook: (span, request) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = (request as any).url || new URL((request as any).headers?.referer || '', 'http://localhost').pathname;
        span.setAttribute("http.route", url);
      },
    }),
    new ExpressInstrumentation(),
    new PgInstrumentation({
      // Add query parameters as attributes (sanitized)
      enhancedDatabaseReporting: true,
    }),
  ],
});

// Register the provider
provider.register();

// Export tracer for manual instrumentation
export const tracer = provider.getTracer("qr-menu", process.env.npm_package_version);

/**
 * Helper to create a child span with attributes
 */
export function createSpan(name: string, attributes?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tracer.startActiveSpan(name, { attributes: attributes as any }, (span) => {
    // Span is active here, return end function
    return () => span.end();
  });
}

/**
 * Middleware helper for Next.js API routes
 */
export function withTracing(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    return tracer.startActiveSpan(`HTTP ${req.method} ${new URL(req.url).pathname}`, async (span) => {
      try {
        span.setAttribute("http.method", req.method);
        span.setAttribute("http.url", req.url);
        span.setAttribute("http.scheme", new URL(req.url).protocol.replace(":", ""));
        
        const response = await handler(req);
        
        span.setAttribute("http.status_code", response.status);
        span.setStatus({ code: response.status >= 400 ? 2 : 1 }); // 2=ERROR, 1=OK
        
        return response;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  };
}