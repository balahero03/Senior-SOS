// frontend/src/features/networking/pages/NetworkGraphPage.jsx
// The /network/graph page: a force-directed view of the campus network,
// plus the graph queries project.md calls for — mutual connections, shortest
// path, and reachability by employer.
//
// The layout is a small force simulation drawn to a canvas. A library would
// add ~100KB for what is a few dozen lines of physics here.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/layout/Navbar';
import {
  getGraphStatus,
  getCampusGraph,
  getPathBetween,
  searchGraphUsers,
  getTopConnectors,
} from '../graphApi';

const ROLE_COLOR = {
  ALUMNI: '#0a66c2',
  STUDENT: '#059669',
  ADMIN: '#7c3aed',
};

// ─── Force-directed layout ───────────────────────────────────────────────────

/**
 * Lays out nodes with repulsion between all pairs, spring attraction along
 * edges, and a pull toward the centre. Mutates and returns the node list.
 */
function simulate(nodes, edges, width, height, iterations = 260) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cx = width / 2;
  const cy = height / 2;

  // Start on a circle: a random start makes the result jitter between loads.
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const radius = n.isRoot ? 0 : Math.min(width, height) * 0.32;
    n.x = cx + Math.cos(angle) * radius;
    n.y = cy + Math.sin(angle) * radius;
    n.vx = 0;
    n.vy = 0;
  });

  const repulsion = 5200;
  const springLength = 70;
  const springK = 0.012;

  for (let step = 0; step < iterations; step += 1) {
    const cooling = 1 - step / iterations;

    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist > 320) continue;              // ignore distant pairs: O(n²) otherwise
        const force = repulsion / (dist * dist);
        dx /= dist; dy /= dist;
        a.vx += dx * force; a.vy += dy * force;
        b.vx -= dx * force; b.vy -= dy * force;
      }
    }

    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - springLength) * springK;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    for (const n of nodes) {
      // The root anchors the view, so it stays put.
      if (n.isRoot) { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; continue; }
      n.vx += (cx - n.x) * 0.0016;
      n.vy += (cy - n.y) * 0.0016;
      n.x += n.vx * cooling * 0.5;
      n.y += n.vy * cooling * 0.5;
      n.vx *= 0.86;
      n.vy *= 0.86;
      const pad = 28;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad, Math.min(height - pad, n.y));
    }
  }
  return nodes;
}

export default function NetworkGraphPage() {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);

  const [status, setStatus] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], degrees: {} });
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters over the campus network
  const [limit, setLimit] = useState(120);
  const [roleFilter, setRoleFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  // Path tracing: an admin picks both endpoints, since they are not in the
  // graph themselves.
  const [pathFrom, setPathFrom] = useState(null);
  const [pathResult, setPathResult] = useState(null);
  const [queryBusy, setQueryBusy] = useState(false);

  // People search, to locate someone in a large graph
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState([]);
  const [topConnectors, setTopConnectors] = useState([]);

  useEffect(() => {
    getGraphStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
  }, []);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = { limit };
      if (roleFilter) params.role = roleFilter;
      if (companyFilter.trim()) params.company = companyFilter.trim();
      const data = await getCampusGraph(params);
      setGraphData({
        nodes: data.nodes || [],
        edges: data.edges || [],
        degrees: data.degrees || {},
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load the campus graph.');
      setGraphData({ nodes: [], edges: [], degrees: {} });
    } finally {
      setIsLoading(false);
    }
  }, [limit, roleFilter, companyFilter]);

  useEffect(() => {
    if (status?.enabled) loadGraph();
    else if (status) setIsLoading(false);
  }, [status, loadGraph]);

  useEffect(() => {
    if (status?.enabled) getTopConnectors(8).then(setTopConnectors).catch(() => {});
  }, [status]);

  // Debounced people search.
  useEffect(() => {
    if (personQuery.trim().length < 2) { setPersonResults([]); return undefined; }
    const timer = setTimeout(() => {
      searchGraphUsers(personQuery.trim(), 8).then(setPersonResults).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [personQuery]);

  // Lay out and draw whenever the data changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData.nodes.length) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // There is no single root: an admin is not part of the campus graph, so
    // the highlighted node is whichever person they are tracing from.
    const nodes = graphData.nodes.map((n) => ({ ...n, isRoot: n.id === pathFrom?.id }));
    simulate(nodes, graphData.edges, width, height);
    nodesRef.current = nodes;
    edgesRef.current = graphData.edges;

    draw(ctx, width, height, nodes, graphData.edges, null, null);
  }, [graphData, pathFrom?.id]);

  // Redraw on hover/selection without re-running the simulation.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodesRef.current.length) return;
    const ctx = canvas.getContext('2d');
    draw(ctx, canvas.clientWidth, canvas.clientHeight, nodesRef.current, edgesRef.current, hovered, selected);
  }, [hovered, selected]);

  function draw(ctx, width, height, nodes, edges, hoverNode, selectedNode) {
    ctx.clearRect(0, 0, width, height);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const focusId = hoverNode?.id || selectedNode?.id;

    // Everything touching the focused node, so its neighbourhood stands out.
    const linked = new Set();
    if (focusId) {
      for (const e of edges) {
        if (e.source === focusId) linked.add(e.target);
        if (e.target === focusId) linked.add(e.source);
      }
    }

    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const touchesFocus = focusId && (e.source === focusId || e.target === focusId);
      ctx.strokeStyle = touchesFocus ? 'rgba(10,102,194,0.55)' : 'rgba(148,163,184,0.18)';
      ctx.lineWidth = touchesFocus ? 1.6 : 0.7;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    for (const n of nodes) {
      const isFocus = n.id === focusId;
      const isNeighbour = linked.has(n.id);
      const dim = focusId && !isFocus && !isNeighbour;

      const radius = n.isRoot ? 13 : isFocus ? 10 : 7;
      ctx.globalAlpha = dim ? 0.22 : 1;
      ctx.fillStyle = n.isRoot ? '#dc2626' : (ROLE_COLOR[n.role] || '#64748b');
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (n.isRoot || isFocus) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Label only what is readable: root, focus and neighbours.
      if (n.isRoot || isFocus || (isNeighbour && nodes.length < 90)) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0f172a';
        ctx.font = `${n.isRoot ? 'bold 12px' : '11px'} system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.name || '', n.x, n.y - radius - 6);
      }
      ctx.globalAlpha = 1;
    }
  }

  function nodeAt(evt) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    let best = null;
    let bestDist = 16;
    for (const n of nodesRef.current) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestDist) { best = n; bestDist = d; }
    }
    return best;
  }

  /** Traces from the pinned person to the one just clicked. */
  const runPath = async (toId) => {
    if (!pathFrom || !toId || pathFrom.id === toId) return;
    setQueryBusy(true);
    setPathResult(null);
    try {
      setPathResult(await getPathBetween(pathFrom.id, toId));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Path query failed.');
    } finally {
      setQueryBusy(false);
    }
  };

  /** Pins someone as the start of a path trace and centres the view on them. */
  const pinAsOrigin = (person) => {
    setPathFrom(person);
    setPathResult(null);
    setSelected(person);
    setPersonQuery('');
    setPersonResults([]);
  };

  // ─── Graph unavailable ────────────────────────────────────────────────────

  if (status && !status.enabled) {
    return (
      <div className="min-h-screen bg-[#f4f2ee] flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4">🕸️</div>
            <h2 className="text-lg font-bold text-slate-800">Network graph is not available</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
              Graph features need a Neo4j connection. Set{' '}
              <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">NEO4J_URI</code> and{' '}
              <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">NEO4J_PASSWORD</code>{' '}
              in <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">backend/.env</code>, then run{' '}
              <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">npm run graph:sync</code>.
            </p>
            <Link to="/network" className="inline-block mt-6 px-4 py-2 rounded-xl bg-[#0a66c2] text-white text-xs font-bold hover:bg-[#004182] transition-colors">
              Back to My Network
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-[#004182] text-white rounded-2xl p-5 shadow-sm mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/10 border border-white/20">
              Campus graph
            </span>
            <h1 className="text-lg font-bold mt-1">Campus Network Overview</h1>
            <p className="text-xs text-blue-100/80 max-w-2xl mt-0.5">
              The {graphData.nodes.length} best-connected people on campus and every
              connection between them. Click anyone to inspect them, or pin two
              people to trace the route between them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option className="text-slate-900" value="">Everyone</option>
              <option className="text-slate-900" value="ALUMNI">Alumni only</option>
              <option className="text-slate-900" value="STUDENT">Students only</option>
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option className="text-slate-900" value={60}>Top 60</option>
              <option className="text-slate-900" value={120}>Top 120</option>
              <option className="text-slate-900" value={200}>Top 200</option>
            </select>
            <button onClick={loadGraph} className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold hover:bg-white/20 transition-colors">
              ↻ Rebuild
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">
                  {isLoading ? 'Building layout…' : `${graphData.nodes.length} people · ${graphData.edges.length} connections`}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" /> You</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#0a66c2]" /> Alumni</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#059669]" /> Students</span>
                </div>
              </div>

              <div className="relative" style={{ height: '560px' }}>
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    Loading your network…
                  </div>
                ) : graphData.nodes.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <p className="font-bold text-slate-700 text-sm">No connections in the graph</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Nothing has been mirrored into Neo4j yet. Run{' '}
                      <code className="px-1 py-0.5 bg-slate-100 rounded">npm run graph:sync</code>{' '}
                      in the backend, then rebuild.
                    </p>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-pointer"
                    onMouseMove={(e) => setHovered(nodeAt(e))}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(e) => {
                      const n = nodeAt(e);
                      setSelected(n);
                      // With an origin pinned, a click traces the route to it.
                      if (n && pathFrom && n.id !== pathFrom.id) runPath(n.id);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <aside className="space-y-4">
            {/* Find a person */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Find a person</h3>
              <input
                type="text"
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {personResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {personResults.map((r) => (
                    <button
                      key={r.user.id}
                      onClick={() => pinAsOrigin(r.user)}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span className="block font-semibold text-slate-800 text-xs truncate">{r.user.name}</span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        {r.user.role} · {r.degree} connections
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Path tracing between any two people */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Trace a route</h3>

              {!pathFrom ? (
                <p className="text-xs text-slate-400">
                  Search for someone above, or click a person in the graph and pin
                  them as the starting point.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">From</span>
                      <span className="block font-semibold text-slate-800 text-xs truncate">{pathFrom.name}</span>
                    </div>
                    <button
                      onClick={() => { setPathFrom(null); setPathResult(null); }}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 shrink-0"
                    >
                      clear
                    </button>
                  </div>

                  {queryBusy ? (
                    <p className="text-xs text-slate-400">Finding the shortest route…</p>
                  ) : !pathResult ? (
                    <p className="text-xs text-slate-400">Now click anyone in the graph to trace the route.</p>
                  ) : !pathResult.found ? (
                    <p className="text-xs text-slate-500">No route within 6 degrees.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#0a66c2]">
                        {pathResult.degrees} {pathResult.degrees === 1 ? 'degree' : 'degrees'} apart
                      </p>
                      <ol className="space-y-1.5">
                        {pathResult.path.map((p, i) => (
                          <li key={p.id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {i + 1}
                            </span>
                            <Link to={`/profile/${p.id}`} className="font-semibold text-slate-800 hover:text-[#0a66c2] truncate">
                              {p.name}
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Selected person */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Selected</h3>
              {!selected ? (
                <p className="text-xs text-slate-400">Click anyone in the graph.</p>
              ) : (
                <div className="space-y-2">
                  <Link to={`/profile/${selected.id}`} className="font-bold text-slate-900 text-sm hover:text-[#0a66c2] block">
                    {selected.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {selected.company
                      ? `${selected.designation || 'Alumnus'} at ${selected.company}`
                      : `${selected.department || '—'}${selected.graduationYear ? ` • Class of ${selected.graduationYear}` : ''}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selected.role === 'ALUMNI'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selected.role}
                    </span>
                    {graphData.degrees[selected.id] != null && (
                      <span className="text-[11px] text-slate-500">
                        {graphData.degrees[selected.id]} connections
                      </span>
                    )}
                  </div>
                  {(!pathFrom || pathFrom.id !== selected.id) && (
                    <button
                      onClick={() => pinAsOrigin(selected)}
                      className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition-colors"
                    >
                      Trace routes from here
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Most connected */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Most connected</h3>
              {topConnectors.length === 0 ? (
                <p className="text-xs text-slate-400">—</p>
              ) : (
                <div className="space-y-1.5">
                  {topConnectors.map((c, i) => (
                    <button
                      key={c.user.id}
                      onClick={() => pinAsOrigin(c.user)}
                      className="w-full flex items-center gap-2 text-left px-1.5 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span className="w-4 text-[10px] font-bold text-slate-400">{i + 1}</span>
                      <span className="flex-1 min-w-0 font-semibold text-slate-800 text-xs truncate">{c.user.name}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">{c.degree}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
