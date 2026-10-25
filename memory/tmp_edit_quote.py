import os
os.chdir('/app/frontend/src')


def edit(p, pairs):
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (p, o[:60])
        s = s.replace(o, n)
    open(p, 'w').write(s)


edit('App.js', [
    ('import Summary from "@/pages/Summary";', 'import Summary from "@/pages/Summary";\nimport QuoteReview from "@/pages/QuoteReview";'),
    ('      <Route path="/review/:token"', '      <Route path="/quote/:token" element={<QuoteReview />} />\n      <Route path="/review/:token"'),
])
edit('components/ws/ToolSheet.jsx', [
    ('import DecideTask from "@/components/sheet/DecideTask";', 'import DecideTask from "@/components/sheet/DecideTask";\nimport QuotePanel from "./QuotePanel";'),
    ('decide: "Decide on changes" };', 'decide: "Decide on changes", quote: "Customer quote" };'),
    ('          {tool === "decide" && <DecideTask {...props} />}', '          {tool === "decide" && <DecideTask {...props} />}\n          {tool === "quote" && <QuotePanel />}'),
])
edit('components/ws/Composer.jsx', [
    ('''              <DropdownMenuItem onSelect={() => onAdd("review")} data-testid="add-prepare-review">Prepare review</DropdownMenuItem>''',
     '''              <DropdownMenuItem onSelect={() => onAdd("review")} data-testid="add-prepare-review">Prepare review</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("quote")} data-testid="add-customer-quote">Customer quote</DropdownMenuItem>'''),
])
edit('pages/ProjectSheet.jsx', [
    ('''                  <DropdownMenuItem onSelect={() => setTool("decide")} data-testid="overflow-decide">Decide on changes</DropdownMenuItem>''',
     '''                  <DropdownMenuItem onSelect={() => setTool("decide")} data-testid="overflow-decide">Decide on changes</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTool("quote")} data-testid="overflow-quote">Customer quote</DropdownMenuItem>'''),
])
print("ok")
