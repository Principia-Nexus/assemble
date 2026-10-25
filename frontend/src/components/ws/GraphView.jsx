import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Folder, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConditionCard, ItemCard, PackageCard } from "./Cards";

const LINK_KINDS = [["prerequisite", "Must finish first"], ["uses_input", "Provides input to"], ["produces_output", "Produces output for"], ["relates_to", "Related to"]];
const NO_PAN = "[data-movable],button,a,input,textarea,select,[role=link],[data-link-menu]";

function Frame({ title, count, children, testId, open, onToggle, tone = "" }) {
  return (
    <section data-testid={testId} className={`rounded-2xl border border-[#CBD5E1] bg-white/40 p-3 ${tone}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-1 pb-2 text-left text-[13px] font-semibold text-[#1A2838]" aria-expanded={open}>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        <Folder className="h-3.5 w-3.5 text-[#64748B]" /> {title}
        {count && <span className="ml-auto rounded-full bg-[#FFFFFF] px-2 py-0.5 font-mono text-[10px] font-medium text-[#64748B]">{count}</span>}
      </button>
      {open && <div className="flex flex-wrap gap-3">{children}</div>}
    </section>
  );
}

// Lines for explicit relationships only, measured from rendered cards (unscaled content coordinates).
function Edges({ edges, refs, contentRef, zoom, tick, focus, draft }) {
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    const box = contentRef.current?.getBoundingClientRect();
    if (!box) return;
    setLines(edges.map((e) => {
      const a = refs.current[e.from_id]?.getBoundingClientRect(), b = refs.current[e.to_id]?.getBoundingClientRect();
      if (!a || !b) return null;
      const X = (v) => (v - box.left) / zoom, Y = (v) => (v - box.top) / zoom;
      const side = b.left >= a.right - 4 || b.right <= a.left + 4;
      if (side) {
        const rtl = b.right <= a.left + 4;
        const x1 = X(rtl ? a.left : a.right), y1 = Y(a.top + a.height / 2), x2 = X(rtl ? b.right : b.left), y2 = Y(b.top + b.height / 2), dx = rtl ? -30 : 30;
        return { ...e, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2 - dx / 5},${y2}` };
      }
      const down = b.top >= a.bottom;
      const x1 = X(a.left + a.width / 2), y1 = Y(down ? a.bottom : a.top), x2 = X(b.left + b.width / 2), y2 = Y(down ? b.top : b.bottom), dy = down ? 40 : -40;
      return { ...e, d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2 - dy / 7}` };
    }).filter(Boolean));
  }, [edges, refs, contentRef, zoom, tick]);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <defs><marker id="ws-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#2F4A66" /></marker></defs>
      {lines.map((l) => (
        <path key={l.edge_id} d={l.d} fill="none" stroke={focus && !focus.has(l.from_id) && !focus.has(l.to_id) ? "#CFC5B8" : "#2F4A66"} strokeWidth="1.5"
          strokeDasharray={l.proposed ? "5 4" : l.kind === "relates_to" ? "2 3" : undefined} markerEnd="url(#ws-arrow)" />
      ))}
      {draft && <path d={`M${draft.x1},${draft.y1} L${draft.x2},${draft.y2}`} stroke="#215273" strokeWidth="1.5" strokeDasharray="4 3" fill="none" markerEnd="url(#ws-arrow)" data-testid="graph-link-draft" />}
    </svg>
  );
}

function Movable({ id, pos, dragging, onStart, linkable, onLink, children }) {
  return (
    <div data-movable={id} data-item-id={linkable ? id : undefined} onPointerDown={(e) => onStart(e, id)}
      className={`group/m relative touch-none ${dragging ? "z-30 cursor-grabbing" : "cursor-grab"}`}
      style={{ transform: pos ? `translate(${pos.x}px, ${pos.y}px)` : undefined, transition: dragging ? "none" : "transform .18s ease-out" }}>
      {children}
      {linkable && (
        <span role="button" tabIndex={-1} aria-label="Drag to another card to link" data-link-handle onPointerDown={(e) => onLink(e, id)} data-testid={`link-handle-${id}`}
          className="absolute -right-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-[#215273] opacity-0 shadow transition-opacity duration-150 group-hover/m:opacity-100 [@media(hover:none)]:opacity-100" />
      )}
    </div>
  );
}

export default function GraphView({ sheet, items, edges, pkgs, conds, selectedId, onSelect, hot, focus, filter, run, layout }) {
  const scroller = useRef(null), contentRef = useRef(null), refs = useRef({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [closed, setClosed] = useState({});
  const [tick, setTick] = useState(0);
  const [pos, setPos] = useState(layout || {});
  const [dragId, setDragId] = useState(null);
  const [panning, setPanning] = useState(false);
  const [draft, setDraft] = useState(null);
  const [menu, setMenu] = useState(null);
  const suppress = useRef(false), zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Keep the canvas bounded: content can move at most EDGE px past any side of the view.
  const clamp = useCallback((p, z = zoomRef.current) => {
    const c = contentRef.current, s = scroller.current;
    if (!c || !s) return p;
    const EDGE = 120, cw = c.offsetWidth * z, ch = c.offsetHeight * z, vw = s.clientWidth, vh = s.clientHeight;
    const lim = (v, size, view) => Math.max(Math.min(0, view - size) - EDGE, Math.min(EDGE, v));
    return { x: lim(p.x, cw, vw), y: lim(p.y, ch, vh) };
  }, []);

  useEffect(() => { setPos(layout || {}); }, [layout]);
  useEffect(() => {
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    if (contentRef.current) ro.observe(contentRef.current);
    const el = scroller.current;
    const wheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setZoom((z) => Math.max(0.4, Math.min(1.6, +(z - e.deltaY * 0.002).toFixed(3))));
      else setPan((p) => clamp({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener("wheel", wheel); };
  }, [clamp]);
  useEffect(() => setTick((t) => t + 1), [items, edges, closed, zoom, pos]);
  useEffect(() => { setPan((p) => clamp(p, zoom)); }, [zoom, clamp, tick]);

  const local = (cx, cy) => { const b = contentRef.current.getBoundingClientRect(); return { x: (cx - b.left) / zoomRef.current, y: (cy - b.top) / zoomRef.current }; };
  const track = (move, up) => {
    const end = (e) => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); up(e); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const startPan = (e) => {
    if (e.button !== 0 || e.target.closest(NO_PAN)) return;
    setMenu(null);
    const s = { x: e.clientX, y: e.clientY, p: pan };
    setPanning(true);
    track((m) => setPan(clamp({ x: s.p.x + m.clientX - s.x, y: s.p.y + m.clientY - s.y })), () => setPanning(false));
  };
  const startMove = (e, id) => {
    if (e.button !== 0 || e.target.closest("[data-link-handle]")) return;
    e.stopPropagation();
    const s = { x: e.clientX, y: e.clientY, p: pos[id] || { x: 0, y: 0 } };
    let moved = false, last = s.p;
    track((m) => {
      const dx = (m.clientX - s.x) / zoomRef.current, dy = (m.clientY - s.y) / zoomRef.current;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      setDragId(id);
      last = { x: Math.round(s.p.x + dx), y: Math.round(s.p.y + dy) };
      setPos((p) => ({ ...p, [id]: last }));
    }, () => {
      setDragId(null);
      if (!moved) return;
      suppress.current = true;
      setTimeout(() => { suppress.current = false; }, 0);
      api.put("/project/layout", { id, ...last }).catch(() => toast.error("Card position was not saved."));
    });
  };
  const startLink = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const r = refs.current[id]?.getBoundingClientRect();
    const a = local(r.right, r.top + r.height / 2);
    setDraft({ x1: a.x, y1: a.y, x2: a.x, y2: a.y });
    track((m) => { const b = local(m.clientX, m.clientY); setDraft((d) => d && { ...d, x2: b.x, y2: b.y }); }, (u) => {
      setDraft(null);
      const to = document.elementFromPoint(u.clientX, u.clientY)?.closest("[data-item-id]")?.dataset.itemId;
      if (to && to !== id) { const at = local(u.clientX, u.clientY); setMenu({ from: id, to, x: at.x, y: u.clientY > window.innerHeight - 280 ? at.y - 200 / zoomRef.current : at.y }); }
    });
  };
  const link = async (kind) => {
    const m = menu;
    setMenu(null);
    const r = await run([{ op: "link", from_id: m.from, to_id: m.to, kind }], "Linked two items");
    if (r.ok) toast.success("Linked");
  };

  const fit = useCallback(() => {
    const c = contentRef.current, s = scroller.current;
    if (!c || !s) return;
    setPan({ x: 0, y: 0 });
    setZoom(Math.max(0.4, Math.min(1, (s.clientWidth - 48) / (c.scrollWidth || 1))));
  }, []);

  const groups = items.filter((i) => i.kind === "group");
  const childrenOf = (gid) => items.filter((i) => i.kind !== "group" && (i.parent_id || null) === gid && filter(i));
  const loose = childrenOf(null);
  const toggle = (k) => setClosed((c) => ({ ...c, [k]: !c[k] }));
  const setRef = (id) => (el) => { refs.current[id] = el; };
  const wrap = (id, node, linkable = false) => (
    <Movable key={id} id={id} pos={pos[id]} dragging={dragId === id} onStart={startMove} linkable={linkable && !!run} onLink={startLink}>{node}</Movable>
  );
  const card = (it) => wrap(it.item_id, <ItemCard it={it} sheet={sheet} selected={selectedId === it.item_id} hot={hot.has(it.item_id)} onSelect={onSelect} cardRef={setRef(it.item_id)} />, true);
  const visiblePkgs = pkgs.filter((p) => filter(p));
  const empty = !groups.length && !loose.length && !pkgs.length && !conds.length;

  return (
    <div className="relative h-full">
      <div ref={scroller} onPointerDown={startPan} onClickCapture={(e) => { if (suppress.current) { e.stopPropagation(); e.preventDefault(); } }}
        className={`ws-dots h-full touch-none overflow-hidden select-none ${panning ? "cursor-grabbing" : "cursor-grab"}`} data-testid="graph-view">
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", transition: panning || dragId ? "none" : "transform .15s ease-out" }} className="min-w-full">
          <div ref={contentRef} className="relative mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 pb-44 sm:px-6" data-testid="graph-canvas">
            {empty && <p data-testid="graph-empty" className="max-w-md text-sm text-[#64748B]">Nothing here yet. Describe the job below, or use Add to enter a work item.</p>}
            {visiblePkgs.length > 0 && (
              <Frame title={sheet.preview ? "Plan · private draft" : sheet.current ? "Plan" : "Firms and sites"} count={`${visiblePkgs.length} package${visiblePkgs.length === 1 ? "" : "s"}`} testId="graph-plan-frame" open={!closed.plan} onToggle={() => toggle("plan")}>
                {visiblePkgs.map((p) => wrap(p.id, <PackageCard pkg={p} sheet={sheet} selected={selectedId === p.id} onSelect={onSelect} cardRef={setRef(p.id)} />))}
              </Frame>
            )}
            {conds.length > 0 && (
              <Frame title="Open conditions" count={`${conds.length}`} testId="graph-conditions-frame" open={!closed.conds} onToggle={() => toggle("conds")} tone="border-dashed border-[#F3D9A8]">
                {conds.filter(filter).map((c) => wrap(c.id, <ConditionCard c={c} selected={selectedId === c.id} onSelect={onSelect} />))}
              </Frame>
            )}
            {groups.filter((g) => filter(g) || childrenOf(g.item_id).length).map((g) => {
              const kids = childrenOf(g.item_id), done = kids.filter((k) => ["done", "reached", "resolved"].includes(k.status)).length;
              return (
                <div key={g.item_id} ref={setRef(g.item_id)} data-item-id={g.item_id} className={`rounded-2xl ${selectedId === g.item_id ? "ring-2 ring-[#215273]" : ""} ${hot.has(g.item_id) ? "outline outline-2 outline-offset-2 outline-[#215273]" : ""}`}>
                  <Frame title={<span role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); onSelect(g.item_id); }} onKeyDown={(e) => e.key === "Enter" && onSelect(g.item_id)} className="hover:underline" data-testid={`group-title-${g.item_id}`}>{g.title}</span>}
                    count={`${done} of ${kids.length}`} testId={`group-${g.item_id}`} open={!closed[g.item_id]} onToggle={() => toggle(g.item_id)}>
                    {kids.length ? kids.map(card) : <p className="px-1 text-xs text-[#64748B]">No work inside yet.</p>}
                  </Frame>
                </div>
              );
            })}
            {loose.length > 0 && <div className="flex flex-wrap gap-3" data-testid="graph-loose">{loose.map(card)}</div>}
            <Edges edges={edges} refs={refs} contentRef={contentRef} zoom={zoom} tick={tick} focus={focus} draft={draft} />
            {menu && (
              <div data-link-menu className="ws-tray-in absolute z-50 w-48 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg" style={{ left: menu.x, top: menu.y }} data-testid="graph-link-menu">
                {LINK_KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => link(k)} className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[#1A2838] transition-colors hover:bg-[#F1F5F9]" data-testid={`graph-link-${k}`}>{l}</button>)}
                <button type="button" onClick={() => setMenu(null)} className="block w-full px-3 py-1.5 text-left text-[12px] text-[#64748B] transition-colors hover:bg-[#F1F5F9]" data-testid="graph-link-cancel">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="absolute right-4 top-4 z-10 flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-sm" data-testid="graph-zoom-controls">
        <button type="button" className="p-2 transition-colors hover:bg-[#F1F5F9] active:bg-[#E2E8F0]" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in" data-testid="graph-zoom-in"><ZoomIn className="h-4 w-4" /></button>
        <button type="button" className="p-2 transition-colors hover:bg-[#F1F5F9] active:bg-[#E2E8F0]" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} aria-label="Zoom out" data-testid="graph-zoom-out"><ZoomOut className="h-4 w-4" /></button>
        <button type="button" className="p-2 transition-colors hover:bg-[#F1F5F9] active:bg-[#E2E8F0]" onClick={fit} aria-label="Fit to view" data-testid="graph-fit"><Maximize className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
