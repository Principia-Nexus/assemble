import os
os.chdir('/app/frontend/src')


def edit(p, pairs):
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (p, o[:70])
        s = s.replace(o, n)
    open(p, 'w').write(s)


edit('components/ws/QuotePanel.jsx', [
    ('''onClick={async () => { await api.delete(`/project/quotes/${q.quote_id}`); onSaved(null, true); }}''',
     '''onClick={async () => { try { await api.delete(`/project/quotes/${q.quote_id}`); onSaved(null, true); } catch (e) { setErrors(errList(e)); onSaved(null, true); } }}'''),
    ('''issued {q.issued_at?.slice(0, 16).replace("T", " ")}''', '''issued {new Date(q.issued_at).toLocaleString()}'''),
    ('''{r.action.replace("_", " ")} {r.version} · {r.at.slice(0, 16).replace("T", " ")}''', '''{r.action.replace("_", " ")} {r.version} · {new Date(r.at).toLocaleString()}'''),
])
edit('pages/QuoteReview.jsx', [
    ('''{r.version} at {r.at.slice(0, 16).replace("T", " ")} UTC.''', '''{r.version} at {new Date(r.at).toLocaleString()}.'''),
])
edit('App.js', [('<Toaster position="top-right" offset={76} richColors visibleToasts={2} />', '<Toaster position="bottom-right" offset={96} richColors visibleToasts={2} />')])
edit('pages/ProjectSheet.jsx', [
    ('''<Inspector target={target} sheet={sheet} items={items} edges={edges} run={runOps}''', '''<Inspector target={target} sheet={sheet} items={items} edges={edges} run={run}'''),
    ('''className="break-words text-[26px] font-bold''', '''className="break-words text-[22px] font-bold sm:text-[26px]'''),
])
edit('components/ws/ReportView.jsx', [
    ('''<Printer className="h-4 w-4" /> Print / PDF</Button>''', '''<Printer className="h-4 w-4" /><span className="hidden sm:inline">Print / PDF</span></Button>'''),
])
print("ok")
