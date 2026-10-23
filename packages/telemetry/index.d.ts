export type TelemetryMode = 'off' | 'console' | 'posthog';
export type TelemetryService = 'web' | 'api' | 'worker';
export type ErrorCode = 'RENDER_ERROR' | 'UNHANDLED_ERROR' | 'UNHANDLED_REJECTION' |
  'HTTP_UNEXPECTED_ERROR' | 'DEPENDENCY_UNAVAILABLE' | 'WORKER_HEARTBEAT_FAILED';
export type TelemetryEventName = 'screen viewed' | 'diagnostic refreshed' | 'api readiness checked';
export interface TelemetryConfig {
  mode: TelemetryMode;
  environment: string;
  release: string;
  token?: string;
  host?: string;
  disabledReason?: string;
}
export interface TelemetryEvent { event: string; properties: Record<string, unknown> }
export interface TelemetrySink {
  capture(name: string, properties: Record<string, unknown>): unknown;
  exception(error: Error, properties: Record<string, unknown>): unknown;
}
export interface Reporter {
  capture(name: TelemetryEventName, properties?: Record<string, unknown>): void;
  exception(error: unknown, code: ErrorCode): void;
}
export function resolveTelemetryConfig(input?: { mode?: string; environment?: string; release?: string; token?: string; host?: string }): TelemetryConfig;
export function buildEvent(name: string, properties: Record<string, unknown>, config: TelemetryConfig, service: TelemetryService): TelemetryEvent | null;
export function safeException(error: unknown, code: ErrorCode): Error;
export function filterEvent<T extends { event: string; properties?: Record<string, unknown>; uuid?: string; timestamp?: Date; distinctId?: string }>(event: T, config: TelemetryConfig, service: TelemetryService): T | null;
export function createReporter(config: TelemetryConfig, service: TelemetryService, sink: TelemetrySink): Reporter;
