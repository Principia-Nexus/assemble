import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { STATUS } from "@/lib/format";

const BANDS = ["Sources", "Changes", "Sites", "Firms"];

function trace(edges, start) {
  if (!start) return null;
  const out = new Set([start]);
  const walk = (dir) => {
    const q = [start];
    while (q.length) {
      const n = q.shift();
      for (const e of edges) {
        const [a, b] = dir ? [e.from, e.to] : [e.to, e.from];
        if (a === n && !out.has(b)) { out.add(b); q.push(b); }
      }
    }
  };
  walk(true); walk(false);
  return out;
}

function Node({ n, on, dim, onClick, refFn }) {
  const sub = n.band === 3 ? STATUS[n.sub]?.label || n.sub : n.sub;
  return (
    <button ref={refFn} type="button" onClick={onClick} aria-pressed={on} title={sub ? `${n.label} · ${sub}` : n.label} data-testid={`graph-node-${n.id.replace(/[^a-zA-Z0-9-]/g, "-")}`}
      className={`relative z-10 w-full rounded-md border px-2.5 py-1 text-left transition-[opacity,border-color,background-color] duration-200 ${
        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-400"} ${dim ? "opacity-30" : "opacity-100"}`}>
      <span className="block truncate text-xs font-semibold">{n.label}</span>
      {sub && <span className={`block truncate text-[10px] ${on ? "text-white/70" : "text-slate-500"}`}>{sub}</span>}
    </button>
  );
}

export default function TraceGraph({ rev }) {
  const [g, setG] = useState(null);
  const [sel, setSel] = useState(null);
  const [paths, setPaths] = useState([]);
  const box = useRef(null);
  const refs = useRef({});
  useEffect(() => { api.get("/project/graph").then((r) => setG(r.data)).catch(() => setG({ nodes: [], edges: [] })); }, [rev]);
  const lit = useMemo(() => (g ? trace(g.edges, sel) : null), [g, sel]);
  const layout = useCallback(() => {
    if (!g || !box.current) return;
    const b = box.current.getBoundingClientRect();
    setPaths(g.edges.map((e) => {
      const a = refs.current[e.from]?.getBoundingClientRect();
      const c = refs.current[e.to]?.getBoundingClientRect();
      if (!a || !c || !a.width || !c.width) return null;
      const x1 = a.right - b.left, y1 = a.top + a.height / 2 - b.top, x2 = c.left - b.left, y2 = c.top + c.height / 2 - b.top;
      const mx = (x1 + x2) / 2;
      return { k: `${e.from}>${e.to}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, on: lit ? lit.has(e.from) && lit.has(e.to) : false };
    }).filter(Boolean));
  }, [g, lit]);
  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [layout]);
  if (!g || !g.edges.length) return null;
  const bands = BANDS.map((title, band) => ({ title, band, ns: g.nodes.filter((n) => n.band === band) })).filter((b) => b.ns.length || b.band >= 2);
  return (
    <section data-testid="trace-graph" aria-label="Map" className="no-print hidden rounded-md border border-slate-200 bg-white p-3 md:block">
      <div ref={box} className="relative grid gap-8" style={{ gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))` }}>
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" aria-hidden>
          {paths.map((p) => <path key={p.k} d={p.d} fill="none" strokeWidth={p.on ? 2 : 1}
            className={`transition-[stroke,opacity] duration-200 ${p.on ? "stroke-slate-900" : "stroke-slate-300"}`} opacity={lit && !p.on ? 0.25 : 1} />)}
        </svg>
        {bands.map(({ title, band, ns }) => {
          return (
            <div key={title} className="min-w-0 space-y-1" data-testid={`graph-band-${band}`}>
              <p className="eyebrow">{title}</p>
              {ns.length === 0 && <p className="text-[11px] text-slate-400">None</p>}
              {ns.map((n) => (
                <Node key={n.id} n={n} on={sel === n.id} dim={!!lit && !lit.has(n.id)} refFn={(el) => { refs.current[n.id] = el; }}
                  onClick={() => setSel(sel === n.id ? null : n.id)} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
