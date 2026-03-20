# OHP Frontend

React + TypeScript + Vite. Scaffolded from `create-vite` with the `react-ts` template, then customized for OHP.

## Dev

```bash
npm install
npm run dev        # starts Vite on :5173, proxies /api/* to FastAPI on :8000
```

## Stack

React 19, react-router-dom v7, TypeScript 5.9, Vite 8. Styling TBD — currently Vite defaults, will be replaced.

## Structure

<!-- Keep this in sync with the project tree in the root README. -->

- `src/App.tsx` — top-level routing table
- `src/api/client.ts` — typed fetch wrappers for backend endpoints
- `src/components/Layout.tsx` — shared nav + footer shell
- `src/pages/` — one component per route (Home, Search, Profile, Join, Login, Dashboard, Admin, About, NotFound)
