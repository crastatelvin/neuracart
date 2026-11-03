This repository is **NeuraCart**, a full-stack grocery delivery platform. The customer Expo app lives at the repo root (`src/app/` routes). The API lives in `backend/` (Express 5 + Prisma 5.22 + PostgreSQL). The store manager panel lives in `admin/` (Next.js, `http://localhost:3000`); the rider app lives in `delivery/` (Expo, routes in `delivery/src/app/`). The complete specification is `plan.md`; read it before changing architecture, schema, API contracts, or business rules.

Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Project rules

- **Commit and push after every completed, verified step.** Use conventional commits.
- Never commit `.env`, secrets, logs, uploads, `node_modules/`, or generated native folders.
- Run the delivery app's `npm run lint`/`npx tsc --noEmit` (from `delivery/`), plus the customer app's `npm run lint` and `npx tsc --noEmit`, plus `npm run typecheck` in `backend/`, before declaring work done.
- Backend architecture is route → middleware → controller → service → repository → Prisma. Controllers never touch Prisma; repositories never hold business logic.
- Backend API base is `http://localhost:8000`; customer dev server is `http://localhost:8081`; admin panel is `http://localhost:3000`; delivery dev server can be `http://localhost:8082`.
- Update `plan.md` when a product or architecture decision changes.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` for the customer app and `delivery/src/app/` for the rider app — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
