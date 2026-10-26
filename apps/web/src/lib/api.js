import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

// The open project travels on every request; the server re-checks that it belongs to the signed-in firm.
let projectId = null;
export const currentProjectId = () => projectId;
export function setProjectId(id) {
  projectId = id || null;
  if (projectId) api.defaults.headers.common["X-Project-Id"] = projectId;
  else delete api.defaults.headers.common["X-Project-Id"];
}

const TAG = / ?\(Synthetic\)/g;
const untag = (v) =>
  typeof v === "string" ? v.replace(TAG, "")
    : Array.isArray(v) ? v.map(untag)
    : v && typeof v === "object" && v.constructor === Object ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, untag(x)]))
    : v;

let refreshing = null;
api.interceptors.response.use(
  (r) => (r.config.url === "/auth/demo-accounts" ? r : { ...r, data: untag(r.data) }),
  async (err) => {
    if (err.response?.data) err.response.data = untag(err.response.data);
    const cfg = err.config || {};
    if (err.response?.status === 401 && !cfg._retry && !String(cfg.url).startsWith("/auth/")) {
      cfg._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return api(cfg);
      } catch (e) {
        refreshing = null;
      }
    }
    return Promise.reject(err);
  }
);

export function errList(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return [e?.message || "Something went wrong. Please try again."];
  if (typeof d === "string") return [d];
  if (Array.isArray(d)) return d.map((x) => (typeof x === "string" ? x : x?.msg || JSON.stringify(x)));
  return [d.msg || String(d)];
}

export const errText = (e) => errList(e).join(" ");

export function visitorId() {
  let v = localStorage.getItem("assemble_visitor");
  if (!v) {
    v = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("assemble_visitor", v);
  }
  return v;
}

export const newKey = () =>
  (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
