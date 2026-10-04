# Walkthrough script (5 to 10 minutes)

Audience: the course evaluator. Goal: show the UI/UX, the role-based flows and the
integrations, in the order a user would meet them.

| Time | Scene | What to show | Point to make |
|---|---|---|---|
| 0:00 to 0:40 | Landing | Hero, feature cards, latest notices. Toggle light and dark theme. Resize to phone width. | Mobile-first layout and consistent theming. Statically generated (ISR). |
| 0:40 to 1:30 | Public catalogue | Search "programming", filter by department, reload the page. Open a course and read the offering seats. | Filters live in the URL, so they survive a reload and can be shared. |
| 1:30 to 2:10 | Login | Empty submit (field errors), wrong password (server error), then the three one-click demo buttons. | Zod validation matches the backend. Demo credentials never reach the browser. |
| 2:10 to 3:10 | Administrator | Overview stats and charts. Departments: create, search, sort, delete with a confirm dialog. | Forms use TanStack Form with Zod; toasts confirm each change. |
| 3:10 to 3:50 | Admin records | Students (open a profile), payments (open a payment), audit log filtered by action. | Read-only views for oversight; every change is recorded. |
| 3:50 to 4:40 | Student | Enrol in an offering: the seat count updates at once (optimistic). Results and GPA. | Optimistic update rolls back if the server refuses. |
| 4:40 to 5:30 | Payments | Open "Pay semester fee", then the bKash checkout. Show the result page polling the real status. | The amount is set by the server. PAID appears only after the gateway confirms it. |
| 5:30 to 6:20 | Faculty | My offerings, open a course, enter a grade (grade point fills in), publish. | Role layouts stop other roles at the page, and the API enforces it too. |
| 6:20 to 7:10 | Security and robustness | Log out. Open an admin page as a student (redirected). Show that an expired session refreshes silently. | Proxy-based session rotation; no client-side secrets. |
| 7:10 to 8:00 | Engineering | Show the repository layout, the 32 unit tests, the CI workflow, and the Lighthouse scores. | Typed API client, shared components, test coverage of the riskiest logic. |

Before recording: start the backend, run `npm run seed` there, set the `DEMO_*`
variables in `frontend/.env.local`, and make sure at least one course offering exists
for the student and faculty demos.
