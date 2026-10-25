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
