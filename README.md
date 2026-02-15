# 🗳️ Real-Time Poll Rooms

A full-stack web application for creating polls, sharing them via links, and collecting votes with **real-time result updates** for all viewers.

**🌐 Live Demo:** [https://quick-poll-jam.lovable.app](https://quick-poll-jam.lovable.app)

---

## ✨ Features

### Core
- **Poll Creation** — Create a poll with a question and 2–10 options
- **Shareable Links** — Each poll gets a unique short code URL (e.g., `/poll/a1b2c3d4`)
- **Real-Time Results** — All viewers see votes update instantly via WebSocket subscriptions (Supabase Realtime)
- **Persistence** — Polls and votes are stored in PostgreSQL; links work across sessions
- **Animated Charts** — Live horizontal bar chart visualization with `recharts`

### CRUD & Poll Management
- **Edit Polls** — Poll creators can edit the question, add/remove options
- **Delete Polls** — Permanently remove a poll and all associated data
- **Start/End Polls** — Close or reopen voting at any time
- **Max Votes Threshold** — Set a vote limit at creation; poll auto-closes when reached
- **Winner Declaration** — Automatically highlights the winning option when a poll closes
- **Browse All Polls** — View all created polls with status, vote counts, and timestamps

### Analytics
- **Percentage Breakdowns** — Each option shows vote count and percentage
- **Bar Chart Visualization** — Animated horizontal bar chart updates in real time

---

## 🛡️ Fairness & Anti-Abuse Mechanisms

### Mechanism 1: Browser Fingerprinting
- Generates a **SHA-256 hash** from multiple browser attributes:
  - Canvas rendering output
  - Screen resolution and color depth
  - Timezone and language settings
  - User agent and platform
- This fingerprint is stored with each vote to identify unique devices
- **What it prevents:** The same browser/device casting multiple votes on the same poll
- **Limitation:** A determined user could use different browsers or devices to vote multiple times

### Mechanism 2: Database-Level Unique Constraint
- A `UNIQUE(poll_id, voter_fingerprint)` constraint on the `votes` table
- Enforced at the PostgreSQL level — cannot be bypassed from the client
- **What it prevents:** Duplicate vote insertion even if the client-side check fails
- **Limitation:** Tied to fingerprint accuracy; different fingerprints from the same person are treated as distinct voters

---

## 🧩 Edge Cases Handled

| Edge Case | How It's Handled |
|---|---|
| Empty question or fewer than 2 options | Client-side validation with error toast |
| Duplicate option labels | Detected and rejected before submission |
| Option label too long | `maxLength` enforced on input fields (100 chars) |
| Question too long | `maxLength` enforced (200 chars) |
| Poll not found (invalid share link) | Friendly 404 page with "Go Home" button |
| Double-voting attempt | Unique constraint returns error code `23505`; shown as "already voted" toast |
| Poll closed while user is on page | Real-time subscription updates UI to show closed state |
| Max votes reached | Poll auto-closes and declares winner |
| Deleting options below minimum | Prevented with toast ("must have at least 2 options") |
| Concurrent vote submissions | Database constraint ensures consistency |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL + Realtime) |
| Hosting | Lovable Cloud |

---

## 📐 Architecture

```
┌─────────────┐       WebSocket        ┌──────────────────┐
│   Browser    │◄──────────────────────►│  Supabase        │
│  (React SPA) │       REST API         │  - PostgreSQL    │
│              │◄──────────────────────►│  - Realtime      │
│  Fingerprint │                        │  - RLS Policies  │
│  Generation  │                        └──────────────────┘
└─────────────┘
```

### Database Schema

- **`polls`** — `id`, `question`, `share_code`, `is_active`, `max_votes`, `creator_fingerprint`, `created_at`, `closed_at`
- **`poll_options`** — `id`, `poll_id`, `label`, `position`
- **`votes`** — `id`, `poll_id`, `option_id`, `voter_fingerprint`, `voter_ip`, `created_at`
  - `UNIQUE(poll_id, voter_fingerprint)` constraint

### Security
- **Row-Level Security (RLS)** enabled on all tables
- Public read access for polls, options, and votes
- Insert-only for votes (no update/delete by voters)
- Creator-based update/delete for polls and options (matched by fingerprint)

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server
npm run dev
```

---

## 📋 Known Limitations & Future Improvements

### Known Limitations
- **No user authentication** — Creator identity is tied to browser fingerprint, not accounts. Clearing browser data loses creator privileges
- **Fingerprint accuracy** — Browser fingerprints can change with updates or settings changes; not 100% reliable for identity
- **No rate limiting** — Server-side rate limiting for API calls is not implemented
- **No poll expiration by time** — Polls can only be closed manually or via max vote threshold

### Potential Improvements
- Add optional password-protected private polls
- Implement time-based poll expiration (auto-close after X hours)
- Add IP-based rate limiting via edge functions
- User authentication for persistent creator identity
- Poll templates and categories
- Export results as CSV
- Pie chart and additional visualization options

---

## 📄 License

MIT
