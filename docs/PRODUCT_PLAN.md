# Udhiyya Saver product plan

Build order, one slice at a time. Each phase ships backend and frontend together, in the app design from the dashboard reference (`C:\Users\muham\OneDrive\Documents\dashboard`) and the landing page.

## Roles
| Role | How they get in | Scope |
|---|---|---|
| Super admin | `ADMIN` role (seeded) | Creates mahallus, assigns mahallu admins |
| Mahallu admin | Assigned by super admin (`MahalluStaff`, `MAHALLU_ADMIN`) | One mahallu: members, programs, volunteers, expenses |
| Volunteer | Admin creates a generated username and password (`MahalluStaff`, `VOLUNTEER`) | One mahallu: animal status or meat distribution; admin can terminate any time |
| Member (user) | Registers, then links to their household with mahallu number and phone | Programs, payments, tracking |

## Phases
1. **Foundation (done):** mahallus, staff scoping, households (manual add, CSV or Excel import), super admin screen, scoped app shell for desktop and mobile, sign-in restyle, member linking.
2. **Programs (done):** per-mahallu programs (Udhiyya 2027), editable animal types and prices (goat 1 share, other animals 7), start and end a program, member enrolment with share counts.
3. **Allocation and draw (done):** unique animal codes, correct animal counts, auto-allocate button, manual edits, random draw for slaughter order and time slots.
4. **Payments (done):** one-time and installments, Razorpay checkout and webhook, cash recorded by admin or volunteer, history, autopay toggle, monthly reminders.
5. **Volunteers (done):** generated credentials, termination, status role (slaughtered, processing, packed), distribution role (stock given, handed out, who received).
6. **Member tracking (done):** animal code, status, queue position, time slot, "you are next" notification, received-meat confirmation.
7. **Expenses and dashboards (done):** public expense ledger, admin dashboard with all transactions.

## Decisions
- Money is whole rupees. Razorpay keys come from environment variables, test mode first.
- Households link to accounts by mahallu number plus phone. There is no SMS provider yet.
- Excel files are read in the browser without extra dependencies.
- Sheep count as one person per animal, like goats. Only cows and camels are shared by seven.
- The earlier global Udhiyya module (`/udhiyya/*` API and tables) is no longer used by the UI. It is dropped when payments and meat tokens are rebuilt per mahallu in phases 4 and 5.
- A household is told "your animal is next" when the animal before it in the draw order is marked slaughtered. They are also told when their own animal is slaughtered and packed, and when meat is recorded for them. Messages go to the in-app inbox and, if opted in, to email and Telegram.
- The public ledger shows only totals, expenses, animal progress and meat counts. It never shows households, names, phones or individual payments. Voided expenses stay visible with the reason.
