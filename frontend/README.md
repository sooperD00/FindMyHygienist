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

- `src/App.tsx` — top-level routing table with AuthProvider, ProtectedRoute, AdminRoute
- `src/api/client.ts` — typed fetch wrappers with CSRF handling, auth + profile + photo + location endpoints
- `src/contexts/AuthContext.tsx` — auth state provider (login/register/logout + GET /me on mount)
- `src/components/` — Layout (nav+footer shell), ProtectedRoute, AdminRoute, Accordion, CredentialSelector, IntakeProfile, ListInput, LocationEntry, PhotoUpload
- `src/pages/` — one component per route (Home, Search, Profile, Join, Login, Dashboard, Admin, About, NotFound)
- `src/types/` — auth.ts (UserResponse, LoginRequest, etc.), provider.ts (OwnProfile, Credential, OwnLocation, etc.)
- `src/assets/` — hero.png, default-avatar.svg
- `src/__tests__/` — Vitest: 54 tests (client, component, and integration)
