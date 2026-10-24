import { useEffect, useState } from "react";
import { api } from "@/lib/api";

let cache = null;

// Demo documents, tour and sample change come from the fixtures collection in MongoDB.
export function useDemoContent(enabled) {
  const [content, setContent] = useState(cache);
  useEffect(() => {
    if (!enabled || cache) return;
    api.get("/project/demo-content").then((r) => { cache = r.data; setContent(r.data); }).catch(() => setContent(null));
  }, [enabled]);
  return enabled ? content : null;
}

export const clearDemoContent = () => { cache = null; };
