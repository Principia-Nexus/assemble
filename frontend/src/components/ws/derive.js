// Read-only views derived from the saved plan/intake (packages per firm, open conditions). Never stored separately.
const OWN = "own";

export function planVersion(sheet) {
  return sheet.preview?.version || sheet.current?.version || null;
}

export function firmName(sheet, id) {
  if (!id) return null;
  if (id === OWN) return "Own crews";
  const p = (sheet.intake.partners || []).find((x) => x.partner_id === id) || (planVersion(sheet)?.partners || []).find((x) => x.partner_id === id);
  return p?.name || id;
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
  const by = {};
  for (const s of v.sites || []) {
    const a = v.assignments?.[s.site_id] || {};
    const key = a.owner || "unassigned";
    (by[key] ||= []).push({ ...s, week: a.week });
  }
  for (const p of firms) by[p.partner_id] ||= [];
  return Object.entries(by).map(([owner, sites]) => ({
    id: `plan-${owner}`, derived: true, kind: "package", owner,
    title: owner === "unassigned" ? "Unassigned sites" : firmName(sheet, owner),
    sites, response: status[owner] || null, quote: firms.find((p) => p.partner_id === owner),
  }));
}

export function conditions(sheet) {
  const out = [];
  (sheet.gap?.unknowns || []).forEach((u, i) => out.push({ id: `unk-${i}`, derived: true, kind: "unknown", title: typeof u === "string" ? u : u.text || u.label || JSON.stringify(u) }));
  (sheet.gap?.open_conditions || []).forEach((c, i) => out.push({ id: `cond-${i}`, derived: true, kind: "condition", title: c.text, scope: c.scope, source: c.source }));
  const ch = sheet.preview?.checker || sheet.current?.checker;
  (ch?.rules || []).filter((r) => r.status === "fail").forEach((r, i) => out.push({ id: `rule-${i}`, derived: true, kind: "finding", title: `${r.label}: ${(r.details || []).join(" ")}` }));
  return out;
}

const RESPONDED = ["confirmed", "confirmed_conditional", "declined", "change_requested"];

export function statusSentence(sheet) {
  const it = sheet.intake, parts = [];
  parts.push(`${(it.sites || []).length} site${(it.sites || []).length === 1 ? "" : "s"}`);
  const v = planVersion(sheet);
  if (sheet.current) parts.push(`plan v${sheet.current.version.number} selected for review`);
  if (sheet.preview) parts.push(`private draft v${sheet.preview.version.number}`);
  if (!v) parts.push("no plan yet");
  const open = (sheet.gap?.unknowns || []).length + (sheet.gap?.open_conditions || []).length;
  if (open) parts.push(`${open} open condition${open === 1 ? "" : "s"}`);
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
];
const OWN_TONE = { dot: "bg-[#1A2838]", chip: "bg-[#E2E8F0] text-[#1A2838]", bar: "bg-[#E2E8F0] text-[#1A2838] border-[#1A2838]/25" };
const NONE_TONE = { dot: "bg-[#CBD5E1]", chip: "bg-[#F1F5F9] text-[#64748B]", bar: "bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]" };
export function firmTone(sheet, owner) {
  if (owner === "own") return OWN_TONE;
  const ids = (sheet.intake.partners || []).map((p) => p.partner_id);
  const i = ids.indexOf(owner);
  return i < 0 ? NONE_TONE : FIRM_TONES[i % FIRM_TONES.length];
}
export const RESP_TONE = { confirmed: "text-[#1E7B5C]", confirmed_conditional: "text-[#1E7B5C]", declined: "text-[#A93A3A]", change_requested: "text-[#A93A3A]", expired: "text-[#A93A3A]" };
