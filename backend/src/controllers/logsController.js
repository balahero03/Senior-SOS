// backend/src/controllers/logsController.js
// Serves the API transcript written by requestLogger.middleware to the admin
// Logs tab. Admin-only: these entries contain full request and response
// bodies, including credentials.

'use strict';

const fs = require('fs');
const path = require('path');

const config = require('../config');
const asyncHandler = require('../shared/utils/asyncHandler');
const AppError = require('../shared/errors/AppError');
const { LOG_DIR, ENTRY_SEPARATOR } = require('../middleware/requestLogger.middleware');

const FILE_PATTERN = /^api-\d{4}-\d{2}-\d{2}\.txt$/;

function listLogFiles() {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs.readdirSync(LOG_DIR).filter((f) => FILE_PATTERN.test(f)).sort().reverse();
}

const dayOf = (file) => file.replace(/^api-/, '').replace(/\.txt$/, '');

function parseHeader(line) {
  const meta = {};
  for (const part of line.split('|')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    meta[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return meta;
}

/** Reads the chosen files into structured entries. */
function loadEntries(files) {
  const entries = [];
  for (const file of files) {
    let raw;
    try {
      raw = fs.readFileSync(path.join(LOG_DIR, file), 'utf8');
    } catch {
      continue;
    }
    const chunks = raw.split(`${ENTRY_SEPARATOR}\n`);
    for (let i = 0; i < chunks.length - 1; i += 1) {
      const headerLine = chunks[i + 1]?.split('\n')[0];
      if (!headerLine || !headerLine.startsWith('time=')) continue;
      const body = chunks[i + 2];
      if (body === undefined) continue;
      const meta = parseHeader(headerLine);
      entries.push({
        id: meta.request,
        file,
        date: dayOf(file),
        time: meta.time,
        session: meta.session,
        method: meta.method,
        path: meta.path,
        status: Number(meta.status),
        durationMs: Number(meta.duration_ms),
        role: meta.role,
        userId: meta.user,
        ip: meta.ip,
        detail: body.trimEnd(),
      });
      i += 1;
    }
  }
  return entries;
}

function assertEnabled() {
  if (!config.transcriptLog.enabled) {
    throw new AppError(
      'API transcript logging is disabled. Set API_TRANSCRIPT_LOG=true in backend/.env and restart the server.',
      503,
      'LOGGING_DISABLED',
    );
  }
}

/**
 * GET /api/admin/logs
 * Filters: date, from, to, session, user, role, method, path, status, minMs,
 *          q (free text over the whole entry), page, limit
 */
const getLogs = asyncHandler(async (req, res) => {
  assertEnabled();

  const {
    date, from, to, session, user, role, method, path: pathFilter, status, minMs, q,
  } = req.query;

  let files = listLogFiles();
  if (date) files = files.filter((f) => dayOf(f) === date);
  if (from) files = files.filter((f) => dayOf(f) >= from);
  if (to) files = files.filter((f) => dayOf(f) <= to);

  let entries = loadEntries(files);

  if (session) entries = entries.filter((e) => e.session === session);
  if (user) entries = entries.filter((e) => e.userId === user);
  if (role) entries = entries.filter((e) => e.role === String(role).toUpperCase());
  if (method) entries = entries.filter((e) => e.method === String(method).toUpperCase());
  if (pathFilter) entries = entries.filter((e) => e.path.includes(pathFilter));
  if (status) {
    const wanted = String(status);
    const band = /^([1-5])xx$/i.exec(wanted);
    entries = entries.filter((e) => (band
      ? String(e.status).startsWith(band[1])
      : String(e.status) === wanted));
  }
  if (minMs) entries = entries.filter((e) => e.durationMs >= Number(minMs));
  if (q) {
    const needle = String(q).toLowerCase();
    entries = entries.filter((e) => e.detail.toLowerCase().includes(needle));
  }

  // Newest first for reading.
  entries.sort((a, b) => b.time.localeCompare(a.time));

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const total = entries.length;
  const pageItems = entries.slice((page - 1) * limit, page * limit);

  res.json({
    success: true,
    data: {
      logs: pageItems,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    },
  });
});

/**
 * GET /api/admin/logs/meta
 * The values the UI needs to populate its filter dropdowns.
 */
const getLogsMeta = asyncHandler(async (req, res) => {
  const enabled = config.transcriptLog.enabled;
  if (!enabled) {
    return res.json({
      success: true,
      data: { enabled: false, dates: [], sessions: [], roles: [], methods: [], paths: [] },
    });
  }

  const files = listLogFiles();
  const entries = loadEntries(files);

  const sessions = new Map();
  for (const e of entries) {
    const s = sessions.get(e.session) || {
      id: e.session, count: 0, first: e.time, last: e.time, roles: new Set(), date: e.date,
    };
    s.count += 1;
    if (e.time < s.first) s.first = e.time;
    if (e.time > s.last) s.last = e.time;
    s.roles.add(e.role);
    sessions.set(e.session, s);
  }

  res.json({
    success: true,
    data: {
      enabled: true,
      logDir: LOG_DIR,
      totalEntries: entries.length,
      dates: files.map(dayOf),
      roles: [...new Set(entries.map((e) => e.role))].sort(),
      methods: [...new Set(entries.map((e) => e.method))].sort(),
      paths: [...new Set(entries.map((e) => e.path))].sort().slice(0, 200),
      sessions: [...sessions.values()]
        .sort((a, b) => b.last.localeCompare(a.last))
        .slice(0, 100)
        .map((s) => ({ ...s, roles: [...s.roles] })),
    },
  });
});

/**
 * GET /api/admin/logs/download?date=YYYY-MM-DD
 * Returns the raw .txt for a day, so it can be saved or shared.
 */
const downloadLog = asyncHandler(async (req, res) => {
  assertEnabled();

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('A date in YYYY-MM-DD format is required', 400, 'VALIDATION_ERROR');
  }

  // Build the name ourselves from a validated date: never join user input
  // straight onto a filesystem path.
  const file = path.join(LOG_DIR, `api-${date}.txt`);
  if (!fs.existsSync(file)) {
    throw new AppError(`No log file for ${date}`, 404, 'NOT_FOUND');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="api-${date}.txt"`);
  fs.createReadStream(file).pipe(res);
});

module.exports = { getLogs, getLogsMeta, downloadLog };
