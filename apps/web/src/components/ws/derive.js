// Read-only views derived from the saved plan/intake (packages per firm, open conditions). Never stored separately.
const OWN = "own";

// The plan being worked on: the private amendment draft when one is open, else the current version. Wherever it is
// shown, title it with planLabel so a draft never reads as the schedule.
export function planVersion(sheet) {
  return sheet.preview?.version || sheet.current?.version || null;
}

// In the header's words (statusSentence): a current plan that is not selected yet is itself a private draft.
export const isPrivateDraft = (sheet, version) => !!version && (version === sheet.preview?.version || !sheet.project.plan_selected);
export function planLabel(sheet, version = planVersion(sheet)) {
  if (!version) return null;
  return isPrivateDraft(sheet, version) ? `Plan · private draft v${version.number}` : `Plan v${version.number}`;
}

// The calendar's schedule: the selected plan unless the private amendment draft is asked for.
export const scheduleVersion = (sheet, wantDraft) => (wantDraft && sheet.preview?.version) || sheet.current?.version || null;

export function firmName(sheet, id) {
  if (!id) return null;
  if (id === OWN) return "Own crews";
  const p = (sheet.intake.partners || []).find((x) => x.partner_id === id) || (planVersion(sheet)?.partners || []).find((x) => x.partner_id === id);
  return p?.name || id;
}

// Work first: "Lighting retrofit" from "12-branch lighting retrofit".
export function workLabel(sheet) {
  const w = (sheet.intake.job_name || "Scope").replace(/^\s*\d+[-\s]?\w*\s+/, "").trim() || "Scope";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function packages(sheet) {
  const v = planVersion(sheet);
  const firms = sheet.intake.partners || [];
  if (!v) {
    const sites = sheet.intake.sites || [];
    const out = firms.map((p) => ({ id: `plan-${p.partner_id}`, derived: true, kind: "package", owner: p.partner_id, title: p.name, sites: [], response: null, quote: p }));
    if (sites.length) out.push({ id: "plan-unassigned", derived: true, kind: "package", owner: "unassigned", title: "Unassigned sites", sites, response: null });
    return out;
  }
  const status = Object.fromEntries((sheet.current?.partners || []).map((x) => [x.partner_id, x.status]));
  const curN = sheet.current?.version?.number, preN = sheet.preview?.version?.number;
  const changed = new Set((sheet.preview?.diff?.partners || []).filter((x) => x.state !== "unchanged").map((x) => x.partner_id));
  const respOf = (owner) => {
    if (preN && changed.has(owner)) return { response: "needs_review_v", for_version: preN };
    return sheet.project.plan_selected && status[owner] ? { response: status[owner], for_version: curN } : { response: null };
  };
  const by = {};
  for (const s of v.sites || []) {
    const a = v.assignments?.[s.site_id] || {};
    const key = a.owner || "unassigned";
    (by[key] ||= []).push({ ...s, week: a.week });
  }
  for (const p of firms) by[p.partner_id] ||= [];
  const qa = (sheet.preview || sheet.current)?.qualification?.sites || {};
  const RANK = { fits: 0, review_needed: 1, evidence_needed: 2, does_not_fit: 3 };
  return Object.entries(by).map(([owner, sites]) => {
    const st = sites.map((s) => qa[s.site_id]?.status).filter((x) => x && x !== "open");
    const qual = st.length ? st.reduce((a, b) => (RANK[b] > RANK[a] ? b : a)) : null;
    return {
      id: `plan-${owner}`, derived: true, kind: "package", owner,
      title: owner === "unassigned" ? "Open scopes" : sites.length ? `${workLabel(sheet)}: ${sites.length} site${sites.length === 1 ? "" : "s"}` : firmName(sheet, owner),
      firm: owner === "unassigned" || !sites.length ? null : firmName(sheet, owner),
      sites, ...respOf(owner), quote: firms.find((p) => p.partner_id === owner), qual,
      reasons: sites.flatMap((s) => (qa[s.site_id]?.reasons || []).map((r) => `${s.site_id}: ${r}`)),
    };
  });
}

// True when `name` appears in `text` as a whole name, not inside a longer word ("Volt" is not in "Voltline").
const namesWhole = (text, name) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(text);

export function conditions(sheet) {
  const out = [];
  // Omissions of firms that are not in the plan stay on their records, not in the active list.
  const pv = planVersion(sheet), inPlan = new Set(Object.values(pv?.assignments || {}).map((a) => a.owner));
  const unused = pv ? (sheet.intake.partners || []).filter((p) => !inPlan.has(p.partner_id) && p.name).map((p) => p.name) : [];
  (sheet.gap?.unknowns || []).forEach((u, i) => {
    const t = typeof u === "string" ? u : u.text || u.label || JSON.stringify(u);
    if (!unused.some((n) => namesWhole(t, n))) out.push({ id: `unk-${i}`, derived: true, kind: "unknown", title: t });
  });
  (sheet.gap?.open_conditions || []).forEach((c, i) => { if (!unused.includes(c.scope)) out.push({ id: `cond-${i}`, derived: true, kind: "condition", title: c.text, scope: c.scope, source: c.source }); });
  (sheet.questions || []).forEach((q) => out.push({ id: `q-${q.key}`, derived: true, kind: "question", question: q.key, title: `${q.field}?` }));
  (sheet.qual?.requirements || []).filter((r) => r.status === "suggested").forEach((r) => out.push({ id: `req-${r.req_id}`, derived: true, kind: "requirement", title: `${r.label}: review needed`, note: r.reason, source: r.source }));
  const v = planVersion(sheet);
  (((sheet.preview || sheet.current)?.qualification?.coverage?.open) || []).forEach((sid) => {
    const s = (v?.sites || []).find((x) => x.site_id === sid);
    out.push({ id: `open-${sid}`, derived: true, kind: "open_scope", site_id: sid, title: `${sid}${s?.name ? ` ${s.name}` : ""}: qualified firm needed` });
  });
  const ch = sheet.preview?.checker || sheet.current?.checker;
  (ch?.rules || []).filter((r) => r.status === "fail").forEach((r, i) => out.push({ id: `rule-${i}`, derived: true, kind: "finding", title: `${r.label}: ${(r.details || []).join(" ")}` }));
  return out;
}

const RESPONDED = ["confirmed", "confirmed_conditional", "declined", "change_requested"];

export function statusSentence(sheet) {
  const it = sheet.intake, parts = [];
  parts.push(`${(it.sites || []).length} site${(it.sites || []).length === 1 ? "" : "s"}`);
  const v = planVersion(sheet);
  if (sheet.current) parts.push(sheet.project.plan_selected ? `plan v${sheet.current.version.number} selected` : `plan v${sheet.current.version.number} private draft`);
  if (sheet.preview) parts.push(`private draft v${sheet.preview.version.number}`);
  if (!v) parts.push("no plan yet");
  const open = conditions(sheet).length;
  if (open) parts.push(`${open} open item${open === 1 ? "" : "s"}`);
  const ps = sheet.current?.partners || [];
  if (ps.length) parts.push(`${ps.filter((p) => RESPONDED.includes(p.status)).length} of ${ps.length} firms responded`);
  return parts.join(" · ");
}

export function matches(q, ...texts) {
  if (!q) return true;
  const n = q.toLowerCase();
  return texts.some((t) => (t || "").toString().toLowerCase().includes(n));
}

// One colour per firm, used wherever that firm appears (card dot, site chips, calendar bars).
export const FIRM_TONES = [
  { dot: "bg-[#2D6A9F]", chip: "bg-[#E4EFF6] text-[#215273]", bar: "bg-[#E4EFF6] text-[#215273] border-[#2D6A9F]/30" },
  { dot: "bg-[#C77A12]", chip: "bg-[#FDF1DC] text-[#8A5208]", bar: "bg-[#FDF1DC] text-[#8A5208] border-[#C77A12]/30" },
  { dot: "bg-[#2E8B65]", chip: "bg-[#E3F2EA] text-[#1E6B4F]", bar: "bg-[#E3F2EA] text-[#1E6B4F] border-[#2E8B65]/30" },
  { dot: "bg-[#B5475F]", chip: "bg-[#F6E6EA] text-[#8E2F45]", bar: "bg-[#F6E6EA] text-[#8E2F45] border-[#B5475F]/30" },
  { dot: "bg-[#6A5BC0]", chip: "bg-[#ECE9F6] text-[#4B3F8A]", bar: "bg-[#ECE9F6] text-[#4B3F8A] border-[#6A5BC0]/30" },
  { dot: "bg-[#7C9A24]", chip: "bg-[#EEF3DC] text-[#4D6114]", bar: "bg-[#EEF3DC] text-[#4D6114] border-[#7C9A24]/30" },
  { dot: "bg-[#1F8A8A]", chip: "bg-[#E0F2F2] text-[#156666]", bar: "bg-[#E0F2F2] text-[#156666] border-[#1F8A8A]/30" },
  { dot: "bg-[#8B5E3C]", chip: "bg-[#F3EAE3] text-[#674329]", bar: "bg-[#F3EAE3] text-[#674329] border-[#8B5E3C]/30" },
  { dot: "bg-[#A8459C]", chip: "bg-[#F5E6F3] text-[#7E2F74]", bar: "bg-[#F5E6F3] text-[#7E2F74] border-[#A8459C]/30" },
  { dot: "bg-[#C2532F]", chip: "bg-[#FAE9E3] text-[#923B1F]", bar: "bg-[#FAE9E3] text-[#923B1F] border-[#C2532F]/30" },
  { dot: "bg-[#2B8CB8]", chip: "bg-[#E2F1F8] text-[#1D6889]", bar: "bg-[#E2F1F8] text-[#1D6889] border-[#2B8CB8]/30" },
  { dot: "bg-[#5E6E84]", chip: "bg-[#EAEEF3] text-[#3F4D60]", bar: "bg-[#EAEEF3] text-[#3F4D60] border-[#5E6E84]/30" },
];
const OWN_TONE = { dot: "bg-[#1A2838]", chip: "bg-[#E2E8F0] text-[#1A2838]", bar: "bg-[#E2E8F0] text-[#1A2838] border-[#1A2838]/25" };
const NONE_TONE = { dot: "bg-[#CBD5E1]", chip: "bg-[#F1F5F9] text-[#64748B]", bar: "bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]" };
// Each firm starts at the slot its id hashes to and, in id order, takes the next free one, so up to FIRM_TONES.length
// firms never share a colour and removing a firm recolours only a firm that had collided with it.
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function firmToneSlots(ids) {
  const n = FIRM_TONES.length, taken = new Set(), slots = {};
  for (const id of [...ids].sort()) {
    let i = hash(id) % n;
    if (taken.size < n) while (taken.has(i)) i = (i + 1) % n;
    taken.add(i);
    slots[id] = i;
  }
  return slots;
}
export function firmTone(sheet, owner) {
  if (owner === "own") return OWN_TONE;
  const ids = (sheet.intake.partners || []).map((p) => p.partner_id);
  if (!ids.includes(owner)) return NONE_TONE;
  return FIRM_TONES[firmToneSlots(ids)[owner]];
}
export const RESP_TONE = { confirmed: "text-[#1E7B5C]", confirmed_conditional: "text-[#1E7B5C]", declined: "text-[#A93A3A]", change_requested: "text-[#A93A3A]", expired: "text-[#A93A3A]" };

// The plan is the source of truth for site work: a task tied to one planned site shows the plan's firm and week.
export function withPlan(items, sheet) {
  const v = planVersion(sheet);
  if (!v) return items;
  const draft = isPrivateDraft(sheet, v);
  return items.map((it) => {
    const sid = it.kind === "task" && it.site_ids?.length === 1 ? it.site_ids[0] : null;
    const a = sid && v.assignments?.[sid];
    return a ? { ...it, firm_id: a.owner || null, plan_site: sid, plan_week: a.week ?? null, plan_draft: draft } : it;
  });
}
