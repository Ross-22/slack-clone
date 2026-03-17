# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start both frontend and Convex backend together
npm run dev

# Start individually
npm run dev:frontend   # Next.js dev server
npm run dev:backend    # Convex backend (npx convex dev)

# Build for production
npm run build

# Lint
npm run lint

# Format (Prettier)
npx prettier --write .
```

## Architecture Overview

This is a **Slack clone** built with Next.js + Convex. The app is called **Slackr** — real-time messaging with channels, built on Convex for the backend (database + serverless functions).

### Frontend (`/app`, `/components`)
- Next.js App Router with React 19, Tailwind CSS v4
- `app/page.tsx` — full Slack UI (sidebar + channel view); redirects to `/signin` if unauthenticated
- `app/signin/page.tsx` — sign in / sign up page
- `middleware.ts` — auth redirect middleware (unauthenticated → `/signin`, authenticated → `/`)
- `app/globals.css` — CSS custom properties for the dark theme (`--bg`, `--accent`, `--sidebar-bg`, etc.) and keyframe animations

### Backend (`/convex`)
- `convex/schema.ts` — `channels` table + `messages` table (with `by_channel` index) + `authTables`
- `convex/channels.ts` — `list` query, `create` mutation, `seed` mutation (creates default channels)
- `convex/messages.ts` — `list` query (by channelId), `send` mutation
- `convex/auth.ts` — Convex Auth with Password provider
- `convex/_generated/` — auto-generated types/API (do not edit)

### Key Patterns
- **Queries** are reactive — clients re-render automatically when data changes
- **Mutations** write to the DB; `getAuthUserId(ctx)` enforces auth
- Channel seeding: `channels.seed` is called client-side when `channels.list` returns empty
- Message grouping: consecutive messages from the same user within 5 minutes are visually grouped (no repeated avatar/name)
- Theme: dark purple palette via CSS variables in `globals.css`; no Tailwind utilities used in `page.tsx` (inline styles only for the chat UI)

### Environment Variables
- `NEXT_PUBLIC_CONVEX_URL` — auto-set by `npx convex dev`
- `CONVEX_SITE_URL` — site URL for Convex Auth (set in `.env.local`)
- `CONVEX_DEPLOY_KEY` — production deployments only
