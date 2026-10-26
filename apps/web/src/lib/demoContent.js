import { useEffect, useState } from "react";
import { api, currentProjectId } from "@/lib/api";

const cache = {};

// Demo documents, tour and sample change come from the fixtures collection, per project.
export function useDemoContent(enabled) {
  const pid = currentProjectId();
  const [content, setContent] = useState(cache[pid] || null);
  useEffect(() => {
    if (!enabled || cache[pid]) return;
    api.get("/project/demo-content").then((r) => { cache[pid] = r.data; setContent(r.data); }).catch(() => setContent(null));
  }, [enabled, pid]);
  return enabled ? content : null;
}

export const clearDemoContent = () => { Object.keys(cache).forEach((k) => delete cache[k]); };
