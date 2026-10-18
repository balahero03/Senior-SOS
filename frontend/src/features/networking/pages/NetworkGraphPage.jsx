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
import useAuthStore from '../../../stores/authStore';
import {
  getGraphStatus,
  getNetworkGraph,
  getConnectionPath,
  getReachableAtCompany,
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
  const { user } = useAuthStore();
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);

  const [status, setStatus] = useState(null);
  const [depth, setDepth] = useState(2);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Query panel
  const [pathTargetId, setPathTargetId] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResult, setCompanyResult] = useState(null);
  const [queryBusy, setQueryBusy] = useState(false);

  useEffect(() => {
    getGraphStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
  }, []);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getNetworkGraph({ depth, limit: 140 });
      setGraphData({ nodes: data.nodes || [], edges: data.edges || [] });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load the network graph.');
      setGraphData({ nodes: [], edges: [] });
    } finally {
      setIsLoading(false);
    }
  }, [depth]);

  useEffect(() => {
    if (status?.enabled) loadGraph();
    else if (status) setIsLoading(false);
  }, [status, loadGraph]);

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

    const nodes = graphData.nodes.map((n) => ({ ...n, isRoot: n.id === user?.id }));
    simulate(nodes, graphData.edges, width, height);
    nodesRef.current = nodes;
    edgesRef.current = graphData.edges;

    draw(ctx, width, height, nodes, graphData.edges, null, null);
  }, [graphData, user?.id]);

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

  const runPath = async (targetId) => {
    if (!targetId) return;
    setQueryBusy(true);
    setPathResult(null);
    try {
      setPathResult(await getConnectionPath(targetId));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Path query failed.');
    } finally {
      setQueryBusy(false);
    }
  };

  const runCompany = async (e) => {
    e.preventDefault();
    if (!companyQuery.trim()) return;
    setQueryBusy(true);
    setCompanyResult(null);
    try {
      setCompanyResult(await getReachableAtCompany(companyQuery.trim(), { limit: 15 }));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Company query failed.');
    } finally {
      setQueryBusy(false);
    }
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
              Graph
            </span>
            <h1 className="text-lg font-bold mt-1">Your Campus Network</h1>
            <p className="text-xs text-blue-100/80 max-w-2xl mt-0.5">
              Everyone within {depth} {depth === 1 ? 'hop' : 'hops'} of you. Click a person to see how you are connected.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <label className="text-xs font-semibold text-blue-100">Depth</label>
            <select
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
            >
              <option className="text-slate-900" value={1}>1 — direct</option>
              <option className="text-slate-900" value={2}>2 — friends of friends</option>
              <option className="text-slate-900" value={3}>3 — extended</option>
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
                    <p className="font-bold text-slate-700 text-sm">No connections yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Connect with people from the Discover page and your network will appear here.
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
                      if (n && n.id !== user?.id) { setPathTargetId(n.id); runPath(n.id); }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <aside className="space-y-4">
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
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selected.role === 'ALUMNI'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {selected.role}
                  </span>
                </div>
              )}
            </div>

            {/* Shortest path */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Connection path</h3>
              {queryBusy && !pathResult ? (
                <p className="text-xs text-slate-400">Finding the shortest route…</p>
              ) : !pathResult ? (
                <p className="text-xs text-slate-400">Select someone to see how you reach them.</p>
              ) : !pathResult.found ? (
                <p className="text-xs text-slate-500">No path found within 6 degrees.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#0a66c2]">
                    {pathResult.degrees} {pathResult.degrees === 1 ? 'degree' : 'degrees'} of connection
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
            </div>

            {/* Who do we know at… */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Who do we know at…</h3>
              <form onSubmit={runCompany} className="flex gap-2">
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="e.g. Amazon"
                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button type="submit" disabled={queryBusy} className="px-3 py-1.5 rounded-xl bg-[#0a66c2] text-white text-xs font-bold disabled:opacity-50 hover:bg-[#004182] transition-colors">
                  Find
                </button>
              </form>

              {companyResult && (
                <div className="mt-3 space-y-2">
                  {companyResult.count === 0 ? (
                    <p className="text-xs text-slate-500">
                      Nobody at {companyResult.company} is reachable within 4 degrees.
                    </p>
                  ) : (
                    companyResult.people.map((p) => (
                      <div key={p.user.id} className="pb-2 border-b border-slate-100 last:border-0">
                        <Link to={`/profile/${p.user.id}`} className="font-semibold text-slate-800 text-xs hover:text-[#0a66c2]">
                          {p.user.name}
                        </Link>
                        <p className="text-[11px] text-slate-500">
                          {p.user.designation || 'Alumnus'} · {p.degrees} {p.degrees === 1 ? 'degree' : 'degrees'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">via {p.via.join(' → ')}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
