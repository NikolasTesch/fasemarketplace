const environments = new Set(['local', 'preview', 'production']);
const services = new Set(['web', 'api', 'worker']);
const codes = new Set(['RENDER_ERROR', 'UNHANDLED_ERROR', 'UNHANDLED_REJECTION',
  'HTTP_UNEXPECTED_ERROR', 'DEPENDENCY_UNAVAILABLE', 'WORKER_HEARTBEAT_FAILED']);
const kinds = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError']);
const opaqueId = /^[A-Za-z0-9_-]{8,100}$/;
const framePattern = /(?:^|[\\/\s])((?:App|main|worker|infrastructure|telemetry|api-exception-filter|error-boundary|index(?:-[A-Za-z0-9_-]{1,60})?)\.[cm]?[jt]sx?)(?:\?[^:\s)]*)?:(\d{1,8}):(\d{1,8})/g;

export function resolveTelemetryConfig(input = {}) {
  const base = { mode: 'off', environment: input.environment ?? 'local', release: input.release ?? 'development' };
  if (!environments.has(base.environment) || !/^[A-Za-z0-9._-]{1,64}$/.test(base.release)) {
    return { mode: 'off', environment: 'local', release: 'development', disabledReason: 'invalid metadata' };
  }
  if (input.mode === undefined || input.mode === '' || input.mode === 'off') return base;
  if (input.mode === 'console') return { ...base, mode: 'console' };
  if (input.mode === 'posthog' && /^phc_[A-Za-z0-9_-]{8,200}$/.test(input.token ?? '') &&
      ['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(input.host)) {
    return { ...base, mode: 'posthog', token: input.token, host: input.host };
  }
  return { ...base, disabledReason: 'invalid mode, project token or ingestion host' };
}

export function buildEvent(name, input = {}, config, service) {
  if (!services.has(service)) return null;
  const properties = { environment: config.environment, service, release: config.release, schema_version: 1 };
  switch (name) {
    case 'screen viewed':
    case 'diagnostic refreshed':
      if (input.screen !== 'bootstrap') return null;
      properties.screen = 'bootstrap';
      break;
    case 'api readiness checked':
      if (!['ready', 'unavailable'].includes(input.status)) return null;
      properties.status = input.status;
      if (Number.isFinite(input.duration_ms)) properties.duration_ms = Math.max(0, Math.min(60000, Math.round(input.duration_ms)));
      break;
    case '$exception':
      if (!codes.has(input.code)) return null;
      properties.code = input.code;
      properties.error_kind = kinds.has(input.error_kind) ? input.error_kind : 'Error';
      if (/^[A-Za-z0-9_.-]{1,80}:\d{1,8}:\d{1,8}$/.test(input.error_site ?? '')) properties.error_site = input.error_site;
      break;
    default: return null;
  }
  return { event: name, properties };
}

function framesFromStack(stack) {
  if (typeof stack !== 'string') return [];
  return [...stack.slice(0, 16000).matchAll(framePattern)].slice(0, 8).map((match) => ({
    filename: match[1], lineno: Number(match[2]), colno: Number(match[3]),
  }));
}

export function safeException(original, code) {
  const safe = new Error(codes.has(code) ? code : 'UNHANDLED_ERROR');
  safe.name = 'Error';
  let frames = [];
  try {
    if (kinds.has(original?.name)) safe.name = original.name;
    // Skip the message line, which may contain credentials or buyer data.
    frames = framesFromStack(typeof original?.stack === 'string' ? original.stack.split('\n').slice(1).join('\n') : '');
  } catch { /* Hostile error getters must not break the application. */ }
  safe.stack = `${safe.name}: ${safe.message}` + frames.map((frame) => `\n    at ${frame.filename}:${frame.lineno}:${frame.colno}`).join('');
  return safe;
}

export function filterEvent(event, config, service) {
  const source = event.properties ?? {};
  const safe = buildEvent(event.event, source, config, service);
  if (!safe) return null;
  const properties = safe.properties;
  for (const key of ['distinct_id', '$device_id', '$session_id', '$window_id']) {
    if (typeof source[key] === 'string' && opaqueId.test(source[key])) properties[key] = source[key];
  }
  for (const key of ['$lib', '$lib_version']) {
    if (typeof source[key] === 'string' && /^[A-Za-z0-9._-]{1,50}$/.test(source[key])) properties[key] = source[key];
  }
  properties.$process_person_profile = false;
  properties.$geoip_disable = true;
  if (config.token) properties.token = config.token;
  if (event.event === '$exception') {
    const first = source.$exception_list?.[0];
    const frames = (first?.stacktrace?.frames ?? []).slice(0, 8).flatMap((frame) => {
      const parsed = framesFromStack(`${frame.filename}:${frame.lineno}:${frame.colno}`);
      return parsed;
    });
    properties.$exception_list = [{ type: properties.error_kind, value: properties.code,
      mechanism: { type: 'generic', handled: true }, stacktrace: { frames } }];
    properties.$exception_type = properties.error_kind;
    properties.$exception_message = properties.code;
    properties.$exception_fingerprint = [service, properties.code, properties.error_site ?? 'unknown'];
  }
  const result = { event: safe.event, properties };
  if (event.uuid && opaqueId.test(event.uuid)) result.uuid = event.uuid;
  if (event.timestamp instanceof Date && Number.isFinite(event.timestamp.getTime())) result.timestamp = event.timestamp;
  if (event.distinctId && opaqueId.test(event.distinctId)) result.distinctId = event.distinctId;
  return result;
}

export function createReporter(config, service, sink) {
  let windowStarted = Date.now();
  let count = 0;
  let lifetimeCount = 0;
  const errors = new Set();
  function send(action) {
    if (config.mode === 'off') return;
    // SDK status-0/offline retries may pause indefinitely. Bound browser captures
    // across minute windows too, independently of SDK transport error callbacks.
    if (service === 'web' && lifetimeCount++ >= 500) return;
    if (Date.now() - windowStarted >= 60000) { windowStarted = Date.now(); count = 0; errors.clear(); }
    if (count++ >= 120) return;
    try {
      const pending = action();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch { /* Telemetry must never break a request, UI interaction or worker. */ }
  }
  return {
    capture(name, properties = {}) {
      const event = buildEvent(name, properties, config, service);
      if (event) send(() => sink.capture(event.event, event.properties));
    },
    exception(original, code) {
      const safe = safeException(original, code);
      const first = framesFromStack(safe.stack)[0];
      const event = buildEvent('$exception', { code, error_kind: safe.name,
        error_site: first ? `${first.filename}:${first.lineno}:${first.colno}` : undefined }, config, service);
      if (!event) return;
      send(() => {
        const key = `${code}:${event.properties.error_site ?? 'unknown'}`;
        if (errors.has(key)) return;
        errors.add(key);
        return sink.exception(safe, event.properties);
      });
    },
  };
}
