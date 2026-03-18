# GEMINI.md

## Project Overview
**Slackr** is a real-time messaging platform (Slack clone) built with a modern full-stack architecture. It leverages **Next.js** for the frontend and **Convex** for the backend, providing a seamless, reactive user experience.

### Core Technologies
- **Frontend:** Next.js (App Router), React 19, Tailwind CSS v4.
- **Backend:** Convex (Real-time database, serverless functions).
- **Authentication:** Convex Auth (Password-based authentication).
- **Deployment:** Next.js for web hosting, Convex for backend infrastructure.

### Architecture
- **Reactive Data:** Queries are automatically reactive; the UI updates instantly when data in Convex changes.
- **Auth Flow:** Managed via `@convex-dev/auth`, with middleware handling redirects between `/signin` and the root `/` page.
- **Styling:** Uses a mix of Tailwind CSS v4 and custom CSS variables (defined in `app/globals.css`) for a consistent dark-themed UI.

---

## Building and Running

### Prerequisites
- Node.js and npm installed.
- A Convex account (for backend hosting).

### Setup and Development
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Start Development Environment:**
    The following command starts both the Next.js development server and the Convex backend in parallel:
    ```bash
    npm run dev
    ```
    *Note: The `predev` script automatically handles Convex setup and opens the dashboard.*

3.  **Individual Services:**
    - **Frontend Only:** `npm run dev:frontend`
    - **Backend Only:** `npm run dev:backend`

### Production
- **Build:** `npm run build`
- **Start:** `npm run start`

---

## Development Conventions

### Codebase Structure
- `/app`: Contains Next.js pages, layouts, and global styles.
- `/convex`: Backend logic, including:
    - `schema.ts`: Database table definitions (`channels`, `messages`, `users`).
    - `auth.ts`: Authentication configuration.
    - `channels.ts` & `messages.ts`: API queries and mutations.
- `/components`: Reusable React components.
- `/convex/_generated`: Auto-generated types and API hooks (do not edit manually).

### Key Patterns
- **Authentication:** Always use `getAuthUserId(ctx)` in Convex mutations to enforce security.
- **Data Fetching:** Use `useQuery` for reactive data and `useMutation` for writes.
- **Styling:** Prefer CSS variables for theme-related colors to maintain consistency with the established dark-purple palette.
- **Message Grouping:** consecutive messages from the same user within 5 minutes are visually grouped (logic in `app/page.tsx`).
- **Channel Seeding:** If no channels exist, the `channels.seed` mutation is triggered on the first load to create default channels (`#general`, `#random`, `#announcements`).

### Standards
- **Linting:** `npm run lint` (uses ESLint with Convex-specific plugins).
- **Formatting:** `npx prettier --write .`
- **Type Safety:** TypeScript is used throughout; ensure types are correctly inferred from Convex's generated API.
