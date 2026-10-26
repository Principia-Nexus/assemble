import axios from "axios";
import { useLayoutEffect, useMemo } from "react";
import { useParams } from "react-router-dom";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || ""}/api`,
  withCredentials: true,
});

// Every project call carries the id of the project it was made for (the server re-checks it belongs to the signed-in
// firm). A call or reply for a project that is no longer open is dropped and never settles, so a retry, queued edit or
// late reply can neither land on nor report into the project the user switched to.
let openId = null;
export function useOpenProject(id) {
  useLayoutEffect(() => {
    openId = id;
    return () => { if (openId === id) openId = null; };
  }, [id]);
}

const dropped = () => new Promise(() => {});
export function projectApi(pid) {
  const send = (cfg) => {
    if (openId !== pid) return dropped();
    return api.request({ ...cfg, headers: { ...cfg.headers, "X-Project-Id": pid } })
      .then((r) => (openId === pid ? r : dropped()), (e) => (openId === pid ? Promise.reject(e) : dropped()));
  };
  return {
    get: (url, cfg = {}) => send({ ...cfg, method: "get", url }),
    delete: (url, cfg = {}) => send({ ...cfg, method: "delete", url }),
    post: (url, data, cfg = {}) => send({ ...cfg, method: "post", url, data }),
    put: (url, data, cfg = {}) => send({ ...cfg, method: "put", url, data }),
  };
}

// The client for the project on this route (/projects/:projectId); use it for every /project call.
export function useProjectApi() {
  const { projectId } = useParams();
  return useMemo(() => projectApi(projectId), [projectId]);
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
