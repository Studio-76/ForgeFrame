# ForgeFrame Frontend

Control-plane frontend for the ForgeFrame platform — a Linux-first runtime for autonomous AI instances.

Built with **React 19**, **TypeScript 5.9**, **Vite 7**, and **TanStack Query 5**.

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Server state | TanStack Query 5 |
| Routing | React Router 7 |
| Styling | Custom CSS (`fg-*` design system) |
| Testing | Vitest 3 + jsdom |
| UI library | None — hand-crafted `fg-*` components |

## Project Structure

```
src/
├── api/           API client (domain-barrel architecture)
├── app/           App shell, routing, session, auth
├── components/    Shared UI components + layout
├── features/      Feature modules (skills, learning, queues, etc.)
├── pages/         Page-level components (lazy-loaded)
├── styles/        Legacy CSS compat entry
├── theme/         Decomposed CSS modules (tokens, reset, layout, components, pages)
└── main.tsx       Entry point with 44+ routes
```

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run typecheck    # TypeScript type check
npm test             # Run tests
npm run build        # Production build
npm run docs         # Generate TypeDoc HTML documentation
```

## Documentation

Browsable HTML documentation is generated from TSDoc comments using **TypeDoc v0.28**:

```bash
npm run docs       # generate to docs/
npm run docs:watch # rebuild on changes
```

Open `docs/index.html` in any browser. All exported symbols (functions, types,
interfaces, components) are documented with their TSDoc annotations. The
generated site includes full-text search, type hierarchy, and cross-references.

## Key Conventions

- **Named exports only** — no default exports
- **TSDoc required** on all exported symbols
- **`fg-*` CSS classes** — custom design system, no external UI library
- **LoadState union** — `"idle" | "loading" | "success" | "error"` for data-fetching state
- **Feature modules** in `features/` — decomposed from monolithic pages
- **Route-scoped error boundaries** via `RouteErrorBoundary`
