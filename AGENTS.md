# Agent Guidelines for This Codebase

Guidelines for maintaining high-quality TypeScript/React code in this
project. These rules MUST be followed by all AI coding agents and
contributors.

## Stack

- **React + TypeScript**, built with **Vite**, into one static bundle that
  serves two purposes:
  - the **desktop app** ([src-tauri/](src-tauri/)), which wraps the bundle with
    **Tauri** and is where real data lives, and
  - the **web preview** on GitHub Pages, which opens on
    [a sample portfolio](src/domain/samplePortfolio.ts) and saves nothing.
- Persistence is chosen in [src/storage/index.ts](src/storage/index.ts): the
  Tauri store in the desktop app, an in-memory store in the browser. The desktop
  app's Rust commands are its only file access - they hold the folder the user
  picked and touch nothing but `portfolio.json` in it. Never hand the page a path,
  and never add Tauri plugins that reach the network or the wider file system
  (`http`, `updater`, `shell`, `fs`).
- No network I/O of any kind. The Content-Security-Policy in
  [vite.config.ts](vite.config.ts) and its twin in `src-tauri/tauri.conf.json`
  set `connect-src` to nothing but Tauri's own channel; keep the two in step.
- Checked and built locally in **Docker** (see [Dockerfile](Dockerfile)) - do
  not assume Node.js is installed on the host. CI runs the same npm scripts on
  Node 24; [.github/workflows/ci.yml](.github/workflows/ci.yml) publishes the preview;
  [.github/workflows/release.yml](.github/workflows/release.yml) builds the
  installers from a version tag.
- A position is identified by its **ticker**, never its name: rounds key their
  buys by ticker, and tickers must be unique. A change to the `portfolio.json`
  layout bumps `FILE_VERSION` in
  [src/storage/serialization.ts](src/storage/serialization.ts) and migrates
  older files on load.
- Amounts are whole units of the portfolio's own currency, so no name carries a
  currency (`holding`, not `holdingCzk`). The only currency-specific values are
  the defaults for a new portfolio in
  [src/domain/portfolio.ts](src/domain/portfolio.ts): CZK and a minimum order of
  5,000.
- Only `src-tauri/app-icon.svg` is committed; `npx tauri icon` derives every
  other icon, locally and in the release workflow.
- All UI text, code, comments, and commit messages are in **English**.

## Core Principles

- No extra code beyond what the task requires - no speculative
  abstractions, no unused exports, no dead code paths.
- Keep dependencies to the minimum: React, and `@tauri-apps/api` for the
  desktop bridge. Charts are plain SVG. Add a library only when it replaces far
  more code than it costs, never for something a few lines already do.
- UI text is short and plain, as if said to a friend: a label, a tip, or a banner
  makes its point in one or two short sentences. No semicolons, no jargon.

## Code Style

- Formatting is owned by **Prettier** ([.prettierrc.json](.prettierrc.json))
  - single quotes, semicolons, trailing commas, 2-space indent, 88-column
    width. Run `npm run format` rather than hand-formatting.
- Linting is **ESLint** ([.eslintrc.cjs](.eslintrc.cjs)): typescript-eslint
  recommended rules, React hooks rules, plus `eqeqeq`, `curly`, `no-var`,
  `prefer-const`. `npm run lint` must be clean before committing.
- Use `camelCase` for variables/functions, `PascalCase` for
  components/types/classes, `UPPER_CASE` for module-level constants.
- Meaningful, descriptive names. No single-letter identifiers outside tight
  loop indices.
- **NEVER** use emoji, or unicode that emulates emoji.
- **MUST** avoid comments that just restate what the code obviously does.
  Only comment the non-obvious: a hidden constraint, a subtle invariant, a
  workaround. Do not reference a task, ticket, or prompt in a comment.

## Types

- **MUST** enable and keep passing TypeScript `strict` mode (see
  [tsconfig.json](tsconfig.json)); run `npm run typecheck`.
- **NEVER** use `any`. Prefer precise types; use `unknown` plus a type guard
  at real boundaries (e.g. parsing JSON from a file - see
  [src/storage/serialization.ts](src/storage/serialization.ts)).
- Prefer `interface` for object shapes, `type` for unions/aliases.
- Use `readonly` for data that shouldn't be mutated after creation (see
  [src/domain/types.ts](src/domain/types.ts)).

## Component Design

- Function components with hooks only - no class components.
- Keep components focused on one screen or one concern; put pure business
  logic in [src/domain/](src/domain/), not inside components.
- Co-locate a component's styles as a CSS Module (`Name.module.css`) next to
  `Name.tsx`. No inline `style={}` objects - the Content-Security-Policy does not
  allow them - and no global class soup.
- Every screen works from a 360px-wide phone to a full desktop window, and in
  the desktop app at any display scaling.
- State that needs to survive a screen switch lives in
  [src/state/PortfolioContext.tsx](src/state/PortfolioContext.tsx); local
  UI-only state (an open dialog, a draft form value) stays in the
  component.

## Testing

- **MUST** use Vitest + React Testing Library. Run `npm run test`.
- **MUST** write tests for new domain logic
  ([src/domain/](src/domain/)) and new storage logic
  ([src/storage/](src/storage/)); these must not depend on Tauri or a real
  file system - mock at the boundary (see `tauriStore.test.ts` for the pattern).
- Follow Arrange-Act-Assert. Don't commit commented-out tests.
- A change to the rebalancing algorithm in
  [src/domain/allocation.ts](src/domain/allocation.ts) must keep the
  exhaustive-search parity test passing
  (`allocation.test.ts`) - it's what proves the search is actually optimal
  over its candidates (the positions still below target once the deposit is
  counted), not just that it runs.

## Error Handling

- **NEVER** silently swallow an error. Surface it to the user via a
  `Banner`, or log it.
- Throw typed errors (`PortfolioValidationError`, `StoreError`) rather than
  plain strings, and catch by type, not by message text.

## Before Committing

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run format:check` passes
- [ ] `npm run build` passes
- [ ] No commented-out code, debug `console.log`, or unused exports
