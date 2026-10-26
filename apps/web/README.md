# apps/web/

React 19 on Create React App with craco (only for the `@` -> `src` alias), Tailwind and
shadcn/ui. It decides nothing: every permission and rule is the API's.

## Connects

| Direction | Where | Through |
|---|---|---|
| out | `apps/api` | `src/lib/api.js`: axios on `REACT_APP_BACKEND_URL` + `/api` with credentials; every `/project` call goes through `useProjectApi()` / `projectApi(id)`, which sends that call's own `X-Project-Id` and drops replies for a project that is no longer open |
| in | the browser | `public/index.html`, `src/index.js`, routes in `src/App.js` |

| Path | What it is |
|---|---|
| `src/pages/` | routes: login, projects, the project workspace, partner review, customer quote, pilot |
| `src/components/ws/` | the workspace: graph, list, calendar, inspector, composer, quote panel |
| `src/components/sheet/` | intake, plan, partners, readings and the other task panels |
| `src/components/ui/` | the shadcn/ui primitives in use; delete one when nothing imports it |
| `src/context/AuthContext.jsx` | the signed-in user |
