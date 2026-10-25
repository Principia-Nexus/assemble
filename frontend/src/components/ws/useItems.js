import { useCallback, useEffect, useState } from "react";
import { api, errList } from "@/lib/api";

// Work items + relationships for the open project. Every change goes through /items/ops (validated, undoable).
export function useItems(rev, onChanged) {
  const [items, setItems] = useState([]);
  const [edges, setEdges] = useState([]);
  const [save, setSave] = useState("idle");
  const [lastBatch, setLastBatch] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/project/items");
    setItems(data.items);
    setEdges(data.edges);
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const finish = useCallback(async (data) => {
    setItems(data.items);
    setEdges(data.edges);
    setLastBatch(data.batch);
    setSave("saved");
    await onChanged();
    return { ok: true, batch: data.batch };
  }, [onChanged]);

  const fail = useCallback(async (e) => {
    setSave("failed");
    if (e.response?.status === 409) await onChanged();
    return { ok: false, errors: errList(e) };
  }, [onChanged]);

  const run = useCallback(async (ops, summary) => {
    setSave("saving");
    try { return await finish((await api.post("/project/items/ops", { rev, ops, summary })).data); }
    catch (e) { return fail(e); }
  }, [rev, finish, fail]);

  const undo = useCallback(async (batchId) => {
    setSave("saving");
    try { return await finish((await api.post("/project/items/undo", { rev, batch_id: batchId })).data); }
    catch (e) { return fail(e); }
  }, [rev, finish, fail]);

  const adopt = useCallback(async (batch) => { setLastBatch(batch); await load(); }, [load]);

  return { items, edges, save, lastBatch, setLastBatch, run, undo, reload: load, adopt };
}

export const KIND_LABEL = { group: "Group", task: "Task", milestone: "Milestone", ai_task: "AI run", condition: "Condition" };
export const STATUS_OPTIONS = {
  task: ["open", "done"], milestone: ["open", "reached"], condition: ["open", "resolved"], group: ["open"],
  ai_task: ["queued", "working", "needs_input", "draft_ready", "failed", "stopped"],
};
export const statusText = (s) => ({ draft_ready: "Draft ready", needs_input: "Needs input" }[s] || (s ? s[0].toUpperCase() + s.slice(1) : ""));
