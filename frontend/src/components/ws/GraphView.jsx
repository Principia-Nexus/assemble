import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Folder, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { ConditionCard, ItemCard, PackageCard } from "./Cards";

function Frame({ title, count, children, testId, open, onToggle, tone = "" }) {
  return (
    <section data-testid={testId} className={`rounded-2xl border border-[#CBD5E1] bg-white/40 p-3 ${tone}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-1 pb-2 text-left text-[13px] font-semibold text-[#1A2838]" aria-expanded={open}>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        <Folder className="h-3.5 w-3.5 text-[#64748B]" /> {title}
        {count && <span className="ml-auto rounded-full bg-[#FFFFFF] px-2 py-0.5 font-mono text-[10px] font-medium text-[#64748B]">{count}</span>}
      </button>
      {open && <div className="flex flex-wrap gap-3">{children}</div>}
    </section>
  );
}

// Lines for explicit relationships only, measured from rendered cards (unscaled content coordinates).
function Edges({ edges, refs, contentRef, zoom, tick, focus }) {
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    const box = contentRef.current?.getBoundingClientRect();
    if (!box) return;
    setLines(edges.map((e) => {
      const a = refs.current[e.from_id]?.getBoundingClientRect(), b = refs.current[e.to_id]?.getBoundingClientRect();
      if (!a || !b) return null;
      const x1 = (a.left + a.width / 2 - box.left) / zoom, y1 = (a.bottom - box.top) / zoom;
      const x2 = (b.left + b.width / 2 - box.left) / zoom, y2 = (b.top - box.top) / zoom;
      return { ...e, d: `M${x1},${y1} C${x1},${y1 + 40} ${x2},${y2 - 40} ${x2},${y2 - 6}` };
    }).filter(Boolean));
  }, [edges, refs, contentRef, zoom, tick]);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <defs><marker id="ws-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2F4A66" /></marker></defs>
      {lines.map((l) => (
        <path key={l.edge_id} d={l.d} fill="none" stroke={focus && !focus.has(l.from_id) && !focus.has(l.to_id) ? "#CFC5B8" : "#2F4A66"} strokeWidth="1.5"
          strokeDasharray={l.proposed ? "5 4" : l.kind === "relates_to" ? "2 3" : undefined} markerEnd="url(#ws-arrow)" />
      ))}
    </svg>
  );
}

export default function GraphView({ sheet, items, edges, pkgs, conds, selectedId, onSelect, hot, focus, filter }) {
  const scroller = useRef(null), contentRef = useRef(null), refs = useRef({});
  const [zoom, setZoom] = useState(1);
  const [closed, setClosed] = useState({});
  const [tick, setTick] = useState(0);
  const drag = useRef(null), space = useRef(false);

  useEffect(() => {
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    if (contentRef.current) ro.observe(contentRef.current);
    const down = (e) => { if (e.code === "Space" && !e.target.closest("input,textarea,select,[contenteditable]")) { space.current = true; e.preventDefault(); } };
    const up = (e) => { if (e.code === "Space") space.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { ro.disconnect(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useEffect(() => setTick((t) => t + 1), [items, edges, closed, zoom]);

  const fit = useCallback(() => {
    const c = contentRef.current, s = scroller.current;
    if (!c || !s) return;
    const w = c.scrollWidth / zoom;
    setZoom(Math.max(0.4, Math.min(1, (s.clientWidth - 48) / w)));
  }, [zoom]);

  const groups = items.filter((i) => i.kind === "group");
  const childrenOf = (gid) => items.filter((i) => i.kind !== "group" && (i.parent_id || null) === gid && filter(i));
  const loose = childrenOf(null);
  const toggle = (k) => setClosed((c) => ({ ...c, [k]: !c[k] }));
  const setRef = (id) => (el) => { refs.current[id] = el; };
  const card = (it) => <ItemCard key={it.item_id} it={it} sheet={sheet} selected={selectedId === it.item_id} hot={hot.has(it.item_id)} onSelect={onSelect} cardRef={setRef(it.item_id)} />;
  const visiblePkgs = pkgs.filter((p) => filter(p));

  const onDown = (e) => { if (space.current) { drag.current = { x: e.clientX, y: e.clientY, l: scroller.current.scrollLeft, t: scroller.current.scrollTop }; e.preventDefault(); } };
  const onMove = (e) => { if (drag.current) { scroller.current.scrollLeft = drag.current.l - (e.clientX - drag.current.x); scroller.current.scrollTop = drag.current.t - (e.clientY - drag.current.y); } };
  const empty = !groups.length && !loose.length && !pkgs.length && !conds.length;

  return (
    <div className="relative h-full">
      <div ref={scroller} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={() => { drag.current = null; }} onMouseLeave={() => { drag.current = null; }}
        className="ws-dots h-full overflow-auto" data-testid="graph-view">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="min-w-full">
          <div ref={contentRef} className="relative mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 pb-10 sm:px-6">
            {empty && <p data-testid="graph-empty" className="max-w-md text-sm text-[#64748B]">Nothing here yet. Describe the job below, or use Add to enter details, a source or a work item.</p>}
            {visiblePkgs.length > 0 && (
              <Frame title={sheet.preview ? "Plan · private draft" : sheet.current ? "Plan" : "Firms and sites"} count={`${visiblePkgs.length} package${visiblePkgs.length === 1 ? "" : "s"}`} testId="graph-plan-frame" open={!closed.plan} onToggle={() => toggle("plan")}>
                {visiblePkgs.map((p) => <PackageCard key={p.id} pkg={p} selected={selectedId === p.id} onSelect={onSelect} cardRef={setRef(p.id)} />)}
              </Frame>
            )}
            {conds.length > 0 && (
              <Frame title="Open conditions" count={`${conds.length}`} testId="graph-conditions-frame" open={!closed.conds} onToggle={() => toggle("conds")} tone="border-dashed border-[#F3D9A8]">
                {conds.filter(filter).map((c) => <ConditionCard key={c.id} c={c} selected={selectedId === c.id} onSelect={onSelect} />)}
              </Frame>
            )}
            {groups.filter((g) => filter(g) || childrenOf(g.item_id).length).map((g) => {
              const kids = childrenOf(g.item_id), done = kids.filter((k) => ["done", "reached", "resolved"].includes(k.status)).length;
              return (
                <div key={g.item_id} ref={setRef(g.item_id)} className={`rounded-2xl ${selectedId === g.item_id ? "ring-2 ring-[#215273]" : ""} ${hot.has(g.item_id) ? "outline outline-2 outline-offset-2 outline-[#215273]" : ""}`}>
                  <Frame title={<span role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); onSelect(g.item_id); }} onKeyDown={(e) => e.key === "Enter" && onSelect(g.item_id)} className="hover:underline" data-testid={`group-title-${g.item_id}`}>{g.title}</span>}
                    count={`${done} of ${kids.length}`} testId={`group-${g.item_id}`} open={!closed[g.item_id]} onToggle={() => toggle(g.item_id)}>
                    {kids.length ? kids.map(card) : <p className="px-1 text-xs text-[#64748B]">No work inside yet.</p>}
                  </Frame>
                </div>
              );
            })}
            {loose.length > 0 && <div className="flex flex-wrap gap-3" data-testid="graph-loose">{loose.map(card)}</div>}
            <Edges edges={edges} refs={refs} contentRef={contentRef} zoom={zoom} tick={tick} focus={focus} />
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 z-10 flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-sm" data-testid="graph-zoom-controls">
        <button type="button" className="p-2 hover:bg-[#F1F5F9]" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in" data-testid="graph-zoom-in"><ZoomIn className="h-4 w-4" /></button>
        <button type="button" className="p-2 hover:bg-[#F1F5F9]" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} aria-label="Zoom out" data-testid="graph-zoom-out"><ZoomOut className="h-4 w-4" /></button>
        <button type="button" className="p-2 hover:bg-[#F1F5F9]" onClick={fit} aria-label="Fit to view" data-testid="graph-fit"><Maximize className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
