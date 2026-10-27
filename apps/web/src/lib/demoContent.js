import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useProjectApi } from "@/lib/api";

const cache = {};

// The demo's sample customer change comes from the fixtures collection, per project.
export function useDemoContent(enabled) {
  const { projectId: pid } = useParams();
  const api = useProjectApi();
  const [content, setContent] = useState(cache[pid] || null);
  useEffect(() => {
    if (!enabled || cache[pid]) return;
    api.get("/project/demo-content").then((r) => { cache[pid] = r.data; setContent(r.data); }).catch(() => setContent(null));
  }, [enabled, pid, api]);
  return enabled ? content : null;
}

export const clearDemoContent = () => { Object.keys(cache).forEach((k) => delete cache[k]); };
