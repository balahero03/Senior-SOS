// backend/src/middleware/requestLogger.middleware.js
// Writes every API request and its response to a human-readable .txt log.
//
// Each entry is a fixed-width block so the file can be read directly, and
// carries a header line of key=value pairs so it can also be filtered
// mechanically (see scripts/logs.js and the admin Logs tab).
//
// Sessions: a browser gets a session id cookie on its first request, so all
// activity from one sign-in session groups together without needing auth.
//
// NOTE: bodies are written verbatim, with no redaction, at the project
// owner's request. The log therefore contains passwords and JWTs in clear
// text. logs/ is gitignored for that reason — do not commit it, and do not
// enable this on a deployment that handles real accounts.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const SESSION_COOKIE = 'sos_log_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const MAX_BODY_CHARS = 20000;               // keep one entry readable

// Entries are separated by a line that cannot occur inside JSON, so the
// parser can split the file reliably.
const ENTRY_SEPARATOR = '='.repeat(100);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/** One file per day keeps date filtering cheap and files a sane size. */
function logFileFor(date) {
  const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOG_DIR, `api-${day}.txt`);
}

/** Pretty-print a body, truncating anything unreasonably large. */
function formatBody(body) {
  if (body === undefined || body === null) return '(empty)';
  if (typeof body === 'string') {
    if (!body.trim()) return '(empty)';
    try {
      return formatBody(JSON.parse(body));
    } catch {
      return body.length > MAX_BODY_CHARS
        ? `${body.slice(0, MAX_BODY_CHARS)}\n… [truncated, ${body.length} chars total]`
        : body;
    }
  }
  if (typeof body === 'object' && Object.keys(body).length === 0) return '(empty)';

  let text;
  try {
    text = JSON.stringify(body, null, 2);
  } catch {
    text = String(body);
  }
  return text.length > MAX_BODY_CHARS
    ? `${text.slice(0, MAX_BODY_CHARS)}\n… [truncated, ${text.length} chars total]`
    : text;
}

function formatHeaders(headers) {
  return Object.entries(headers)
    .map(([k, v]) => `    ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n') || '    (none)';
}

/**
 * Reads the session id from the cookie, or mints one and sets it.
 * Kept separate from auth so anonymous traffic is grouped too.
 */
function resolveSession(req, res) {
  const existing = req.cookies?.[SESSION_COOKIE];
  if (existing) return existing;

  const id = `s_${crypto.randomBytes(8).toString('hex')}`;
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
  });
  return id;
}

function requestLogger(req, res, next) {
  // Only log the API surface; static assets and health checks add noise.
  if (!req.originalUrl.startsWith('/api')) return next();

  const startedAt = Date.now();
  const startedIso = new Date().toISOString();
  const sessionId = resolveSession(req, res);
  const requestId = `r_${crypto.randomBytes(6).toString('hex')}`;

  // Capture the response body by wrapping the methods that send it.
  let responseBody;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };
  res.send = (body) => {
    if (responseBody === undefined) responseBody = body;
    return originalSend(body);
  };

  res.on('finish', () => {
    try {
      ensureLogDir();

      const durationMs = Date.now() - startedAt;
      // req.user is set by requireAuth, which runs after this middleware but
      // before the response finishes, so it is populated by now.
      const userId = req.user?.sub || req.user?.id || '-';
      const role = req.user?.role || 'ANONYMOUS';

      // Header line: single line, key=value, for mechanical filtering.
      const header = [
        `time=${startedIso}`,
        `session=${sessionId}`,
        `request=${requestId}`,
        `method=${req.method}`,
        `path=${req.originalUrl.split('?')[0]}`,
        `status=${res.statusCode}`,
        `duration_ms=${durationMs}`,
        `role=${role}`,
        `user=${userId}`,
        `ip=${req.ip || '-'}`,
      ].join(' | ');

      const block = [
        ENTRY_SEPARATOR,
        header,
        ENTRY_SEPARATOR,
        `[${startedIso}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
        `  Session : ${sessionId}`,
        `  Request : ${requestId}`,
        `  Actor   : ${role} ${userId}`,
        '',
        '  --- REQUEST ---',
        `  Query:`,
        `${formatBody(req.query).split('\n').map((l) => `    ${l}`).join('\n')}`,
        `  Headers:`,
        formatHeaders(req.headers),
        `  Body:`,
        `${formatBody(req.body).split('\n').map((l) => `    ${l}`).join('\n')}`,
        '',
        '  --- RESPONSE ---',
        `  Status: ${res.statusCode} ${res.statusMessage || ''}`.trimEnd(),
        `  Body:`,
        `${formatBody(responseBody).split('\n').map((l) => `    ${l}`).join('\n')}`,
        '',
      ].join('\n');

      fs.appendFile(logFileFor(new Date()), `${block}\n`, (err) => {
        if (err) console.error('[requestLogger] write failed:', err.message);
      });
    } catch (err) {
      // Logging must never break a request.
      console.error('[requestLogger] error:', err.message);
    }
  });

  next();
}

module.exports = requestLogger;
module.exports.LOG_DIR = LOG_DIR;
module.exports.ENTRY_SEPARATOR = ENTRY_SEPARATOR;
module.exports.SESSION_COOKIE = SESSION_COOKIE;
