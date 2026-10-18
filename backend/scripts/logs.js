// backend/scripts/logs.js
// Reads and filters the API transcript written by requestLogger.middleware.
//
//   npm run logs -- [filters]
//
// Filters (all optional, all combinable):
//   --date 2026-10-18         exactly this day
//   --from 2026-10-01         on or after this day
//   --to   2026-10-18         on or before this day
//   --today                   shorthand for --date <today>
//   --session s_ab12…         one browser session
//   --user <uuid>             one user id
//   --role ALUMNI             ANONYMOUS | STUDENT | ALUMNI | ADMIN
//   --method POST             GET | POST | PUT | PATCH | DELETE
//   --path /api/admin         path prefix or substring
//   --status 500              exact code, or 2xx / 4xx / 5xx
//   --min-ms 500              slower than this
//   --contains "text"         anywhere in the entry (searches bodies)
//   --last 20                 only the most recent N matches
//   --sessions                list sessions instead of entries
//   --summary                 counts by path/status instead of entries
//   --files                   list available log files
//
// Examples:
//   npm run logs -- --role ALUMNI --today
//   npm run logs -- --status 5xx --last 10
//   npm run logs -- --session s_3f9c1a2b --summary

'use strict';

const fs = require('fs');
const path = require('path');

const { LOG_DIR, ENTRY_SEPARATOR } = require('../src/middleware/requestLogger.middleware');

// ─── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(fs.readFileSync(__filename, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('//'))
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n'));
  process.exit(0);
}

// ─── Load entries ────────────────────────────────────────────────────────────

function listLogFiles() {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs.readdirSync(LOG_DIR)
    .filter((f) => /^api-\d{4}-\d{2}-\d{2}\.txt$/.test(f))
    .sort();
}

function dayOf(file) {
  return file.replace(/^api-/, '').replace(/\.txt$/, '');
}

/** Parses the `key=value | key=value` header line of an entry. */
function parseHeader(line) {
  const meta = {};
  for (const part of line.split('|')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    meta[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return meta;
}

function loadEntries(files) {
  const entries = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(LOG_DIR, file), 'utf8');
    // Blocks look like: SEP \n header \n SEP \n body…
    const chunks = raw.split(`${ENTRY_SEPARATOR}\n`);
    for (let i = 0; i < chunks.length - 1; i += 1) {
      const headerLine = chunks[i + 1]?.split('\n')[0];
      if (!headerLine || !headerLine.startsWith('time=')) continue;
      const body = chunks[i + 2];
      if (body === undefined) continue;
      entries.push({ file, meta: parseHeader(headerLine), text: body.trimEnd() });
      i += 1; // the header chunk is consumed
    }
  }
  return entries;
}

const allFiles = listLogFiles();

if (args.files) {
  if (!allFiles.length) {
    console.log('No log files yet. Set API_TRANSCRIPT_LOG=true and make some requests.');
    process.exit(0);
  }
  console.log(`Log directory: ${LOG_DIR}\n`);
  for (const f of allFiles) {
    const size = fs.statSync(path.join(LOG_DIR, f)).size;
    console.log(`  ${dayOf(f)}  ${(size / 1024).toFixed(1).padStart(8)} KB  ${f}`);
  }
  process.exit(0);
}

// Narrow by file first — cheaper than reading every day.
const today = new Date().toISOString().slice(0, 10);
const wantDate = args.today ? today : args.date;

let files = allFiles;
if (wantDate) files = files.filter((f) => dayOf(f) === wantDate);
if (args.from) files = files.filter((f) => dayOf(f) >= args.from);
if (args.to) files = files.filter((f) => dayOf(f) <= args.to);

if (!allFiles.length) {
  console.log('No log files found.');
  console.log(`Expected in: ${LOG_DIR}`);
  console.log('Enable logging with API_TRANSCRIPT_LOG=true in backend/.env, then restart the server.');
  process.exit(0);
}

let entries = loadEntries(files);

// ─── Filters ─────────────────────────────────────────────────────────────────

function statusMatches(actual, wanted) {
  if (/^\d{3}$/.test(wanted)) return actual === wanted;
  const m = /^([1-5])xx$/i.exec(wanted);
  if (m) return actual.startsWith(m[1]);
  return false;
}

if (args.session) entries = entries.filter((e) => e.meta.session === args.session);
if (args.user) entries = entries.filter((e) => e.meta.user === args.user);
if (args.role) entries = entries.filter((e) => e.meta.role === String(args.role).toUpperCase());
if (args.method) entries = entries.filter((e) => e.meta.method === String(args.method).toUpperCase());
if (args.path) entries = entries.filter((e) => e.meta.path.includes(args.path));
if (args.status) entries = entries.filter((e) => statusMatches(e.meta.status, String(args.status)));
if (args['min-ms']) {
  const min = Number(args['min-ms']);
  entries = entries.filter((e) => Number(e.meta.duration_ms) >= min);
}
if (args.contains) {
  const needle = String(args.contains).toLowerCase();
  entries = entries.filter((e) => e.text.toLowerCase().includes(needle));
}

entries.sort((a, b) => a.meta.time.localeCompare(b.meta.time));

// ─── Output modes ────────────────────────────────────────────────────────────

const describeFilters = () => {
  const applied = Object.entries(args)
    .filter(([k]) => !['summary', 'sessions', 'files', 'last'].includes(k))
    .map(([k, v]) => (v === true ? `--${k}` : `--${k} ${v}`));
  return applied.length ? applied.join(' ') : '(no filters)';
};

if (args.sessions) {
  const sessions = new Map();
  for (const e of entries) {
    const s = sessions.get(e.meta.session) || {
      count: 0, first: e.meta.time, last: e.meta.time, roles: new Set(), users: new Set(),
    };
    s.count += 1;
    if (e.meta.time < s.first) s.first = e.meta.time;
    if (e.meta.time > s.last) s.last = e.meta.time;
    s.roles.add(e.meta.role);
    if (e.meta.user !== '-') s.users.add(e.meta.user);
    sessions.set(e.meta.session, s);
  }

  console.log(`\nSessions  —  ${describeFilters()}\n`);
  if (!sessions.size) {
    console.log('  No matching sessions.\n');
    process.exit(0);
  }
  console.log(`  ${'SESSION'.padEnd(20)} ${'REQS'.padStart(5)}  ${'ROLES'.padEnd(22)} FIRST → LAST`);
  console.log(`  ${'-'.repeat(95)}`);
  for (const [id, s] of [...sessions].sort((a, b) => b[1].last.localeCompare(b[1].last))) {
    const roles = [...s.roles].join(',').slice(0, 22);
    console.log(`  ${id.padEnd(20)} ${String(s.count).padStart(5)}  ${roles.padEnd(22)} ${s.first.slice(11, 19)} → ${s.last.slice(11, 19)}  ${s.first.slice(0, 10)}`);
  }
  console.log(`\n  ${sessions.size} session(s), ${entries.length} request(s)\n`);
  process.exit(0);
}

if (args.summary) {
  console.log(`\nSummary  —  ${describeFilters()}\n`);
  if (!entries.length) {
    console.log('  No matching entries.\n');
    process.exit(0);
  }

  const by = (fn) => {
    const m = new Map();
    for (const e of entries) m.set(fn(e), (m.get(fn(e)) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };

  const section = (title, rows, limit = 15) => {
    console.log(`  ${title}`);
    for (const [k, v] of rows.slice(0, limit)) {
      console.log(`    ${String(v).padStart(6)}  ${k}`);
    }
    if (rows.length > limit) console.log(`    … ${rows.length - limit} more`);
    console.log('');
  };

  section('By status', by((e) => e.meta.status));
  section('By method', by((e) => e.meta.method));
  section('By role', by((e) => e.meta.role));
  section('By endpoint', by((e) => `${e.meta.method} ${e.meta.path}`));

  const durations = entries.map((e) => Number(e.meta.duration_ms)).sort((a, b) => a - b);
  const pct = (p) => durations[Math.min(durations.length - 1, Math.floor(durations.length * p))];
  console.log('  Response time');
  console.log(`    median ${pct(0.5)}ms · p95 ${pct(0.95)}ms · slowest ${durations[durations.length - 1]}ms`);
  console.log(`\n  ${entries.length} request(s) across ${new Set(entries.map((e) => e.meta.session)).size} session(s)\n`);
  process.exit(0);
}

// Default: print the matching entries.
if (args.last) entries = entries.slice(-Number(args.last));

if (!entries.length) {
  console.log(`\nNo entries match ${describeFilters()}\n`);
  console.log(`Searched ${files.length} file(s) in ${LOG_DIR}\n`);
  process.exit(0);
}

for (const e of entries) {
  console.log(ENTRY_SEPARATOR);
  console.log(Object.entries(e.meta).map(([k, v]) => `${k}=${v}`).join(' | '));
  console.log(ENTRY_SEPARATOR);
  console.log(e.text);
}
console.log(`\n${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}  —  ${describeFilters()}\n`);
