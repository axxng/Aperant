---
status: pending
type: full-app-uat
phases_covered: [01, 02, 03, 04, 04.1, 04.2, 05, 06, 07, 08]
created: 2026-04-23
updated: 2026-04-23
tester: ~
---

# Currents — Full App UAT

## How to run this with Claude Code

Open this file in your project, then tell Claude:

> "Please guide me through the FULL-UAT.md file in .planning/. Present one test at a time. When I respond, record the result and move to the next test. 'yes', 'y', or blank = pass. Anything else = issue — note it and keep going."

Claude will walk you through each test, record your responses, and summarise all issues at the end.

---

## Setup

Before testing, choose one of the two modes:

### Option A — Mock mode (no real GitHub account needed)

```bash
cd apps/web
cp .env.example .env.local
# Edit .env.local:
#   MOCK_SERVICES=true
#   VITE_MOCK_SERVICES=true
#   JWT_SECRET=any-long-random-string-here
npx tsx scripts/seed.ts
npx tsx scripts/dev-server.ts
```

Open http://localhost:5173

**Mock login:** Click "Sign in with GitHub" — you are instantly logged in as the seeded admin user. No real GitHub account needed.

### Option B — Real GitHub OAuth

Set up `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` in `.env.local`. Start with:

```bash
cd apps/web && npm run dev
```

Login with a real GitHub account. First user to log in becomes admin.

---

## Known Issue (open from Phase 05 UAT)

**Priority badges lazy load:** Priority pills on issue list rows only appear after you open that issue's detail panel at least once in the current session. Issues with priority already in the database will show no pill on first page load until the panel is opened. This is a known gap — do not log it as a new issue.

---

## Tests

### 1. Cold Start Smoke Test

Kill any running dev server. Re-run the setup commands from scratch (including `seed.ts` for mock mode). Navigate to http://localhost:5173.

**Expected:** Server starts without errors. The app loads — you see either a login page or the main app (if a session cookie exists). No server crash or uncaught exception in the terminal.

result: [pending]

---

### 2. Unauthenticated redirect

Open http://localhost:5173 in a private/incognito window (no session cookie).

**Expected:** You are redirected to the login page. The main app content (sidebar, issues) is not visible.

result: [pending]

---

### 3. Login page branding

On the login page, inspect the page title and any visible app name.

**Expected:** The app name reads "Currents" — not "Aperant", "Auto Claude", or any prior name. The page shows a single "Sign in with GitHub" button. There is no email input, OTP field, or "Send code" button.

result: [pending]

---

### 4. GitHub OAuth login

Click "Sign in with GitHub". Complete the OAuth flow (or in mock mode, it completes instantly).

**Expected:** You land on the main app. The sidebar is visible. No error or blank page.

result: [pending]

---

### 5. First-user admin role

If you are the first user to log in to this instance (fresh seed or fresh database), check your role in the app settings or by calling `GET /api/auth/me` in the browser devtools network tab.

**Expected:** Your `role` field is `"admin"`. A second user who logs in afterward gets `"member"`.

result: [pending]

---

### 6. App navigation — sidebar structure

After logging in, observe the sidebar.

**Expected:** The sidebar contains at minimum:
- An "All Issues" link (with an Inbox-style icon)
- A product/repo list below it
- Navigation collapses to icon-only when the sidebar is narrowed

result: [pending]

---

### 7. Single-repo issues list loads

Click on any product in the sidebar to open its issues view.

**Expected:** A list of GitHub issues loads. Each row shows the issue title, state (open/closed), labels (with coloured dots), and assignees. A skeleton loading state (8 placeholder rows) appears briefly before content arrives.

result: [pending]

---

### 8. Issues list — open/closed filter

In the issues browser, toggle the state filter between Open and Closed.

**Expected:** The list re-fetches and shows only open or only closed issues respectively. The URL updates to reflect the selected state.

result: [pending]

---

### 9. Issues list — label filter

Click the Labels dropdown and select one or more labels.

**Expected:** The list filters to show only issues that carry all selected labels. Label options show coloured dots matching their GitHub color. A Reset button appears in the filter bar while any filter is active.

result: [pending]

---

### 10. Issues list — assignee filter

Click the Assignee dropdown and select a user.

**Expected:** The list shows only issues assigned to that user. "All assignees" clears the filter.

result: [pending]

---

### 11. Issues list — keyword search

Type a word in the search input.

**Expected:** The displayed list filters client-side to rows whose title contains the typed text. No network request is made for each keystroke. Clearing the input restores the full list.

result: [pending]

---

### 12. Issues list — pagination

If the repo has more than one page of issues, scroll to the bottom of the list.

**Expected:** A "Load More" button appears. Clicking it appends the next page of issues to the list without losing scroll position. (Skip this test and mark skipped if the repo has fewer than ~30 issues.)

result: [pending]

---

### 13. Issue detail panel — opens on click

Click any issue row in the list.

**Expected:** A panel slides in from the right. It shows the issue title, issue number, state badge, full body rendered as Markdown (including code blocks, bold, links), labels with background colours, assignee avatars (or 2-character initials if no avatar), and the created date.

result: [pending]

---

### 14. Issue detail panel — "View on GitHub" link

With the detail panel open, click "View on GitHub".

**Expected:** The issue opens in a new browser tab pointing to the correct GitHub URL. The panel stays open.

result: [pending]

---

### 15. Issue detail panel — close via X button

Click the X button in the top-right corner of the detail panel.

**Expected:** The panel slides away. The issue list is still visible and in its previous scroll position.

result: [pending]

---

### 16. Issue detail panel — close via Escape key

Open a panel, then press the Escape key.

**Expected:** The panel closes. Pressing Escape again does nothing (panel already closed).

result: [pending]

---

### 17. All Issues — cross-repo unified view

Click "All Issues" in the sidebar.

**Expected:** Issues from all connected products/repos appear in a single merged list. Each row has a small coloured product badge (dot + truncated repo name) to show which repo the issue comes from.

result: [pending]

---

### 18. All Issues — per-repo error handling

If one repo is unreachable or returns an error (simulate by using an invalid repo slug in your product list), observe the All Issues view.

**Expected:** A dismissible error banner appears for the failing repo. Issues from other repos still load and display. The banner shows a Retry button. (Skip and mark skipped if you cannot simulate a failing repo.)

result: [pending]

---

### 19. Triage — mark as triaged

Open any open issue's detail panel. Locate the "Mark as Triaged" toggle button.

**Expected:** Clicking the button visually toggles between untriaged (Circle icon, muted) and triaged (CheckCircle2 icon, highlighted). The change is instant (optimistic update).

result: [pending]

---

### 20. Triage — set priority

With the detail panel open, click the Priority dropdown and select "High".

**Expected:** The dropdown updates to show "Priority: High". An orange "High" pill appears on the issue row in the list behind the panel — without any page reload.

result: [pending]

---

### 21. Triage — persistence across browser refresh

Triage an issue (mark triaged + set a priority). Refresh the browser tab (F5).

**Expected:** After reload, the same issue's panel shows the correct triaged state and priority. The priority pill is visible on the list row (note: due to the known lazy-load issue, you may need to open the panel first for the pill to appear).

result: [pending]

---

### 22. Triage — keyboard navigation

Close the detail panel. Press `j` on the keyboard.

**Expected:** The previous issue in the list gets selected and its panel opens. Press `k` — the next issue opens. At the top of the list, `j` does nothing. At the bottom, `k` does nothing. If focus is in the search input, `j`/`k` do not navigate (they type instead).

result: [pending]

---

### 23. Triage — closed issue warning

Switch the list to Closed issues. Click any closed issue to open its panel.

**Expected:** A warning banner appears at the top of the panel reading something like "This issue is closed. Triage actions are still saved in Currents." The triage toggle and priority selector remain functional.

result: [pending]

---

### 24. Triage — optimistic rollback on error

(This test requires temporarily breaking the triage API — skip if you can't do this easily. Mark as skipped.)

With devtools network tab open, block requests to `/api/triage/*`. Toggle the triaged state on an issue.

**Expected:** The UI updates instantly (optimistic). After the network request fails, the toggle reverts to its previous state and a toast error appears.

result: [pending]

---

### 25. Notes — post a comment

Open any issue's detail panel. Locate the notes/comment textarea at the bottom. Type a short comment and click "Post Note" (or the equivalent submit button).

**Expected:** The button briefly shows a "Sent" state (checkmark icon). A success toast appears. The comment is posted to GitHub — verify by opening the issue on github.com in another tab.

result: [pending]

---

### 26. Notes — Ctrl+Enter keyboard shortcut

Open an issue panel. Type text in the comment textarea. Press Ctrl+Enter (or Cmd+Enter on Mac).

**Expected:** The comment is submitted — same "Sent" feedback as clicking the button.

result: [pending]

---

### 27. Notes — empty textarea blocked

With the comment textarea empty, observe the submit button state.

**Expected:** The "Post Note" button is disabled (greyed out) when the textarea is empty.

result: [pending]

---

### 28. Notes — comment on a closed issue

Switch to Closed issues. Open a closed issue. Post a comment.

**Expected:** The comment posts successfully to GitHub. The closed-issue warning banner is present but does not block the comment form.

result: [pending]

---

### 29. Promote to Backlog — button appears

Open any open issue's detail panel. Look for a "Promote to Backlog" button.

**Expected:** A "Promote to Backlog" button is visible (assuming this issue has not been promoted before).

result: [pending]

---

### 30. Promote to Backlog — creates task in Kanban

Click "Promote to Backlog" on an issue.

**Expected:** The button disappears and is replaced by a "View in Backlog" badge/link. Navigate to the Kanban board — a new task card appears in the Backlog column with the issue title.

result: [pending]

---

### 31. Promote to Backlog — priority mapping

Promote an issue that has a triage priority set (e.g., "Critical").

**Expected:** The created Kanban task has its priority set to "Urgent" (Critical → Urgent, High → High, Medium → Medium, Low → Low, None → no priority).

result: [pending]

---

### 32. Promote to Backlog — duplicate guard

On an already-promoted issue (showing "View in Backlog" badge), try to click "Promote to Backlog" again.

**Expected:** The Promote button is not visible — it was replaced by the "View in Backlog" badge. No duplicate task can be created through the UI.

result: [pending]

---

### 33. Promote to Backlog — write-back

Find the Kanban task created in Test 30. Edit its title to something different and save.

**Expected:** The title update syncs back to the linked GitHub issue. Refresh the issues list — the issue title in Currents reflects the new title. (Note: this updates the display in Currents; GitHub itself may show a title edit event in the issue timeline.)

result: [pending]

---

### 34. Rate-limit error display

(Skip and mark skipped if you cannot trigger a GitHub rate limit in your test environment.)

Trigger or simulate a GitHub rate limit (429 response). Observe the UI.

**Expected:** An error banner appears with a message indicating rate limiting and showing how many seconds until retry (e.g., "Rate limited — retry in 42s"). No crash or blank page.

result: [pending]

---

### 35. App title and document tab

Check the browser tab title while using the app.

**Expected:** The document title shows "Currents" (not "Aperant" or any prior name). The favicon, if present, is consistent with the Currents brand.

result: [pending]

---

## Summary

```
total: 35
passed: 0
issues: 0
skipped: 0
pending: 35
blocked: 0
```

## Gaps

[none yet]
