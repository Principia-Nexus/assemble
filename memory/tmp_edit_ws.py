import os
os.chdir('/app/frontend/src')


def edit(p, pairs):
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (p, o[:60])
        s = s.replace(o, n)
    open(p, 'w').write(s)


edit('pages/ProjectSheet.jsx', [
    ('<div className="no-print border-b border-slate-200 bg-white px-4 py-3 sm:px-6" data-testid="workspace-header">\n          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">',
     '<div className="no-print border-b border-slate-200 bg-white" data-testid="workspace-header">\n          <div className="mx-auto flex max-w-[1440px] flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-6">'),
    ('{q && conds.length > 0 && <p className="mt-1 text-xs', '{q && conds.length > 0 && <p className="mx-auto max-w-[1440px] px-4 pb-2 sm:px-6 text-xs'),
])
edit('components/ws/GraphView.jsx', [
    ('<div ref={contentRef} className="relative flex max-w-[1180px] flex-col gap-5 p-6 pb-10">', '<div ref={contentRef} className="relative mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 pb-10 sm:px-6">'),
    ('className="w-max min-w-full"', 'className="min-w-full"'),
    ('title={sheet.preview ? "Plan · private draft" : "Plan"}', 'title={sheet.preview ? "Plan · private draft" : sheet.current ? "Plan" : "Firms and sites"}'),
])
edit('components/ws/derive.js', [
    ('''  const v = planVersion(sheet);
  if (!v) return [];
  const status''', '''  const v = planVersion(sheet);
  const firms = sheet.intake.partners || [];
  if (!v) {
    const sites = sheet.intake.sites || [];
    const out = firms.map((p) => ({ id: `plan-${p.partner_id}`, derived: true, kind: "package", owner: p.partner_id, title: p.name, sites: [], response: null, quote: p }));
    if (sites.length) out.push({ id: "plan-unassigned", derived: true, kind: "package", owner: "unassigned", title: "Unassigned sites", sites, response: null });
    return out;
  }
  const status'''),
    ('''  return Object.entries(by).map(([owner, sites]) => ({''', '''  for (const p of firms) by[p.partner_id] ||= [];
  return Object.entries(by).map(([owner, sites]) => ({'''),
    ('''    sites, response: status[owner] || null,''', '''    sites, response: status[owner] || null, quote: firms.find((p) => p.partner_id === owner),'''),
])
edit('components/ws/Cards.jsx', [
    ('''      <p className="mt-1 text-[11.5px] text-[#2F4A66]">{pkg.sites.length} site{pkg.sites.length === 1 ? "" : "s"}{weeks.length ? ` · week ${weeks.join(", ")}` : ""}</p>''',
     '''      <p className="mt-1 text-[11.5px] text-[#2F4A66]">{pkg.sites.length ? `${pkg.sites.length} site${pkg.sites.length === 1 ? "" : "s"}${weeks.length ? ` · week ${weeks.join(", ")}` : ""}` : "Not in plan"}{pkg.quote?.price_per_site_cents != null ? ` · $${(pkg.quote.price_per_site_cents / 100).toLocaleString()}/site` : ""}</p>
      {pkg.sites.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{pkg.sites.map((s) => <span key={s.site_id} title={s.name} className="rounded bg-[#F1F5F9] px-1 font-mono text-[10px] text-[#2F4A66]">{s.site_id}</span>)}</div>}'''),
])
print("ok")
