import os
os.chdir('/app/frontend/src')


def edit(p, pairs):
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (p, o[:70])
        s = s.replace(o, n)
    open(p, 'w').write(s)


edit('pages/ProjectSheet.jsx', [
    ('''<Button size="sm" variant="ghost" className="h-8" onClick={() => setTourOpen(true)} data-testid="demo-tour-open">''',
     '''<Button size="sm" variant="ghost" className="hidden h-8 sm:inline-flex" onClick={() => setTourOpen(true)} data-testid="demo-tour-open">'''),
    ('''                  <DropdownMenuItem onSelect={() => setTool("quote")} data-testid="overflow-quote">Customer quote</DropdownMenuItem>''',
     '''                  <DropdownMenuItem onSelect={() => setTool("quote")} data-testid="overflow-quote">Customer quote</DropdownMenuItem>
                  {isCanon && <DropdownMenuItem className="sm:hidden" onSelect={() => setTourOpen(true)} data-testid="overflow-tour">Guided tour</DropdownMenuItem>}'''),
])
edit('components/ws/ListView.jsx', [
    ('''<Section title={sheet.preview ? "Plan · private draft" : "Plan"}''', '''<Section title={sheet.preview ? "Plan · private draft" : sheet.current ? "Plan" : "Firms and sites"}'''),
])
print("ok")
