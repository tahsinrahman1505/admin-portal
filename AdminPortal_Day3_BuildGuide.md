# Admin Portal — Day 3 Build Guide
**Conversations Page + Shared Layout System**
*Friday, May 15, 2026 — 4:21 AM – 5:10 AM*

---

## Agenda

1. Build the Conversations page (90 min)
2. Add a search bar with real-time filter (30 min)
3. Add status badges per thread (20 min)
4. Fix sidebar navigation to be consistent across all pages

---

## What We Built

### 1. Conversations Page (`app/(portal)/conversations/page.js`)

A full chat viewer with three panels:

- **Left sidebar** — shared navigation (handled by layout)
- **Thread list panel** — all conversation threads for this client, ordered by most recent
- **Chat panel** — full message history in bubble format when a thread is clicked

**Key features:**
- Customer phone numbers masked: `+97150XXXX67` (last 6 digits hidden)
- Timestamps formatted as `Fri 15 May, 3:50 am`
- Bot messages: dark gray background, left-aligned
- Customer messages: blue background, right-aligned
- Thread list shows: masked phone, first message preview, last active time, status badge

### 2. Real-Time Search Bar

A text input at the top of the thread list filters threads instantly as you type. No backend call — filters the already-fetched data in JS using `useState`.

Filters by:
- Phone number
- Any message content in the thread

### 3. Status Badges

Each thread shows a color-coded badge pulled from the `session_status` column in Supabase:

| Status | Color |
|---|---|
| Handled by Bot | Green |
| Handed Off | Amber |
| Pending | Red |

### 4. Shared Layout System (Route Groups)

The biggest architectural fix of the session. Moved all portal pages into a Next.js **route group** so they share one sidebar without duplicating code.

**Final folder structure:**
```
app/
├── layout.js              ← root layout
├── login/page.js          ← no sidebar (outside group)
└── (portal)/              ← route group — doesn't affect URLs
    ├── layout.js          ← shared sidebar lives here
    ├── dashboard/page.js  ← /dashboard
    └── conversations/page.js  ← /conversations
```

**How it works:** Any page inside `(portal)/` automatically gets the sidebar. To add a new page (e.g. Leads), just create `app/(portal)/leads/page.js` — the sidebar appears automatically with zero extra work.

---

## Supabase Setup

### Columns added to `conversations` table

```sql
alter table conversations add column if not exists session_id text;
alter table conversations add column if not exists role text default 'customer';
alter table conversations add column if not exists phone_number text;
alter table conversations add column if not exists session_status text default 'Handled by Bot';
```

### Test data seeded

Three realistic conversation threads were inserted:
- `sess_001` — +97150XXXX67 — 4 messages, "Handled by Bot"
- `sess_002` — +97155XXXX22 — 2 messages, "Handed Off"
- `sess_003` — +97152XXXX89 — 1 message, "Pending"

---

## Problems Faced & How We Resolved Them

### Problem 1: JSX parse error — `Expected '<//', got '.'`
**Cause:** Emoji characters (`⚙️`, `💬`, `🎯`) in JSX string literals were breaking the Next.js/Turbopack parser. Multi-codepoint emoji caused silent parse failures.

**Fix:** Replaced all emoji in JSX string literals with plain text or ASCII characters. When writing icon strings in JSX, avoid emoji — use text labels or a proper icon library instead.

---

### Problem 2: `<a` tag silently stripped by heredoc
**Cause:** When writing JSX files using bash `cat << 'EOF'` heredocs, the `<a` tag at the start of a line was being interpreted by the shell and stripped.

**Fix:** Always write JSX files using Python's `open().write()` instead of bash heredocs. Python handles angle brackets correctly with no escaping needed.

```python
python3 << 'PYEOF'
content = """...<a href="...">...</a>..."""
open('app/conversations/page.js', 'w').write(content)
PYEOF
```

---

### Problem 3: `sed -i` failing on macOS with `\n`
**Cause:** macOS's built-in `sed` doesn't support `\n` in replacement strings the same way Linux does.

**Fix:** Use Python for all multi-line string replacements instead of `sed`.

```python
python3 << 'PYEOF'
content = open('file.js').read()
content = content.replace('old string', 'new string')
open('file.js', 'w').write(content)
PYEOF
```

---

### Problem 4: zsh history expansion breaking Python inline commands
**Cause:** Using `!user` inside a Python string passed via `python3 -c "..."` triggered zsh's history expansion (`!` = run previous command).

**Fix:** Use `python3 << 'PYEOF'` heredoc syntax instead of `-c "..."`. The single quotes around `PYEOF` prevent zsh from expanding anything inside.

---

### Problem 5: Dashboard and conversations showing double sidebar
**Cause:** Both pages had their own built-in sidebar code. When we added the shared layout, it added a third sidebar on top.

**Root cause:** The original dashboard was built with an inline `<aside className="sidebar">` inside the page component itself. When moved into the route group, the layout added its own sidebar, resulting in two sidebars rendering simultaneously.

**Fix (architectural):** 
1. Moved pages into `app/(portal)/` route group
2. Created `app/(portal)/layout.js` with the shared sidebar
3. Removed the `<aside>` block from the dashboard page using line-number deletion:

```python
lines = open('app/(portal)/dashboard/page.js').readlines()
del lines[392:410]  # exact lines of the aside block
open('app/(portal)/dashboard/page.js', 'w').writelines(lines)
```

4. Replaced the dashboard's `<div className="dash-root">` outer wrapper with a simple `<div className="flex-1 overflow-auto">` so it fills the layout's `<main>` correctly.

---

### Problem 6: Two pages resolving to the same URL path
**Cause:** After creating `app/(portal)/dashboard/page.js`, the original `app/dashboard/page.js` still existed. Next.js threw: *"You cannot have two parallel pages that resolve to the same path."*

**Fix:** Delete the old page files before creating the route group versions.

```bash
rm -rf app/dashboard app/conversations
```

---

### Problem 7: Import path broke after moving page into route group
**Cause:** The dashboard originally imported `../../lib/supabase` (relative path). After moving one folder deeper into `(portal)/dashboard/`, the relative path was wrong.

**Fix:** Replace all relative imports with the `@/` alias which always resolves from the project root regardless of folder depth.

```python
content = content.replace("'../../lib/supabase'", "'@/lib/supabase'")
```

---

### Problem 8: Dashboard lost its CSS styling after sidebar removal
**Cause:** The dashboard's inline `<style>` block used `.dash-root` and `.main` CSS classes. After replacing `<div className="dash-root">` with a generic div, these CSS rules no longer applied correctly.

**Fix:** Kept the `.main` CSS class by converting `<main className="main">` to `<div className="main">` instead of removing the class entirely. The dashboard's own inline CSS block continued to style the content area correctly.

---

### Problem 9: Shared layout sidebar had no styling
**Cause:** The first version of the shared layout used Tailwind classes. But the dashboard page used inline CSS with its own class names — there was a style conflict between the two systems.

**Fix:** Rewrote the shared layout to use inline `<style>` with custom CSS class names (`.portal-sidebar`, `.nav-item`, `.nav-item.active`, etc.) that match the original dashboard aesthetic. This made both pages visually identical.

---

## Key Concepts Learned

### Next.js Route Groups
Folders wrapped in `()` are called route groups. They organize files without affecting URLs. `app/(portal)/dashboard/page.js` still serves `/dashboard`.

### Shared Layout via `layout.js`
Any `layout.js` file in a folder wraps all pages inside that folder with shared UI. The layout receives `{ children }` and renders the page content inside it. Layouts do not re-render on navigation — only the page content changes.

### Why this matters for future pages
Every new page added to `app/(portal)/` automatically gets:
- The sidebar
- Auth check
- Consistent styling
- Working navigation

No copy-paste. No duplicate code. One change to `layout.js` updates every page.

---

## Final Checklist

- [x] `/conversations` page lists all threads for this client
- [x] Clicking a thread shows full chat in bubble format
- [x] Search filters threads in real time by phone or message content
- [x] Status badges show correctly (green/amber/red)
- [x] Sidebar is identical and consistent on dashboard and conversations
- [x] Navigation works in both directions
- [x] Route group architecture in place — future pages get sidebar automatically
- [x] Pushed to GitHub

**Commit:** `Day 3: conversations page + shared layout via route group + consistent sidebar`
**Repository:** `https://github.com/tahsinrahman1505/admin-portal`

---

*Admin Portal Day 3 — AI Build Series — May 15, 2026*
