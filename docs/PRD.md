# Campus Complaint Management System — Product Requirements

## Document basis

This document reconstructs requirements from the current README, active Express routes, React routes/pages, MySQL schema/seed data, and automated tests. It describes current behavior only where it is implemented and connected. Roadmap items are marked **Planned** and are not commitments to details that the current project does not specify.

## Project purpose

Campus Complaint Management System (CampusCare) provides a database-backed way for students to report campus issues and for administrators to review and manage submitted complaints. The active application supports student complaint submission and tracking, and administrator complaint, user, category, and department management.

## Target users

- **Students (implemented):** Register for an account, authenticate, submit complaints, and review or edit their own complaints while they remain in the initial `Submitted` state.
- **Administrators (implemented):** Review all complaints, assign a department and staff member, update complaint status and priority, manage user roles/departments, maintain categories and departments, and view database-backed dashboard summaries.
- **Staff (planned):** The database and seed data support staff users and complaint assignment, but there is no active staff complaint workflow in the mounted API or frontend routes.

## Authentication and accounts — implemented

- Students can register with name, email, and password; phone, student ID, and department are optional.
- Email is normalized and validated. Student ID and email must be unique.
- Self-registration creates a `student` account; it does not accept a requested elevated role.
- Passwords are stored as bcrypt hashes.
- Users can log in using email and password and receive a signed JWT with safe user information.
- The authenticated user can be retrieved through the current-user endpoint. Protected requests re-read the user's role and profile from MySQL.
- The frontend has login, registration, protected routes, role checks, session restoration, and logout.

## Student functionality — implemented

- View categories and departments offered by the database.
- Create a complaint with title, description, location, category, optional department, priority, and optional attachments.
- Receive a generated complaint number and the initial `Submitted` status.
- List only complaints belonging to the signed-in student.
- Search, filter, sort, and paginate the student's complaint list.
- View complaint details, status history, and attachment metadata; download attachments as the complaint owner.
- Edit allowed complaint details only while the complaint status is `Submitted`.
- Students cannot change complaint status, assignment, ownership, or role through complaint input.
- Frontend pages are available at `/student/complaints`, `/student/complaints/new`, and `/student/complaints/:id`.

## Administrator functionality — implemented

- View aggregate complaint counts and category/status/month summaries from MySQL at `/admin/dashboard`.
- List all complaints with search, status, priority, category, and department filters and pagination.
- Update complaint status and priority; assign a department and, optionally, a staff user belonging to that department.
- Review complaint submitter details in the admin complaint list.
- List users and update their role and department. Password fields are not returned. An administrator cannot demote themself, and the final administrator account cannot be demoted.
- Create and edit categories and departments. There are no category or department delete endpoints in the active admin API.
- Admin pages are under `/admin/dashboard`, `/admin/complaints`, `/admin/users`, `/admin/categories`, and `/admin/departments`.

## Complaint management and lifecycle — implemented

The active complaint record contains a unique complaint number, submitting student, category, title, description, campus location, priority, status, optional assigned department and staff member, timestamps, and optional resolution timestamp.

Statuses represented in the database are:

1. `Submitted` — initial status when a student creates a complaint.
2. `Under Review`
3. `Assigned`
4. `In Progress`
5. `Resolved`
6. `Closed`
7. `Rejected`

Complaint creation creates a status-history entry from no previous status to `Submitted`. An administrator can set a valid status and priority. When an administrator assigns a department to a complaint currently in `Submitted` or `Under Review` without explicitly supplying another status, the implementation sets status to `Assigned`. Status changes are recorded with the previous status, new status, acting administrator, remark, and timestamp. Resolution time is set when status becomes `Resolved` or `Closed`; it is cleared when changed to a nonterminal status.

The database constrains status values but the active admin API does not enforce a single ordered transition graph; it accepts any status in the database enum. Do not assume additional workflow rules.

## Categories and departments — implemented

- Categories and departments are MySQL reference records with unique names and optional descriptions.
- Students can retrieve them for complaint forms and filters.
- Administrators can list, create, and edit them.
- The seed file provides demonstration departments and categories. Seed values are examples, not a fixed product taxonomy.

## Attachments — implemented for student submissions

- Students may attach up to five files per complaint.
- Supported content types are JPEG, PNG, WebP, and PDF. The server checks file signatures in addition to the declared MIME type.
- The default per-file limit is 5 MB; `MAX_FILE_SIZE` may configure the limit.
- Files are stored locally beneath `server/uploads` by default, or in the configured `UPLOAD_DIR` relative to the server directory. MySQL stores attachment metadata and the local relative stored path.
- Downloads are available only to the authenticated student who owns the complaint.
- Active admin and staff interfaces do not provide attachment review/download functionality.

## Existing schema objects

The database defines `users`, `departments`, `categories`, `complaints`, `complaint_attachments`, `complaint_status_history`, `feedback`, and `notifications`. Feedback and notifications currently exist as schema/seed concepts only; their application workflows are not mounted in the active API.

## Delivery status and roadmap

### Completed phases

- **Phase 1 — Foundation:** React/Vite client, Express server, environment template, MySQL connection setup, and development/build scripts.
- **Phase 2 — Database:** MySQL schema, seed data, setup script, and connection check.
- **Phase 3 — Authentication:** Student registration, login, JWT, current-user endpoint, and role-protected routes.
- **Phase 4 — Student complaint workflow:** Database-backed create/list/detail/edit, ownership checks, filters, pagination, history, and local attachments.
- **Phase 5 — Admin workflow:** Dashboard summaries, all-complaint review and updates, assignment, user role/department management, and category/department create/edit.

### Planned phases identified by existing project documentation

- **Phase 6 — Staff features:** The README identifies staff features as a planned phase. Exact staff pages, API contracts, status transition rules, remarks, and attachment permissions are not specified in the available project documentation. Staff assignment fields and seeded staff accounts are prerequisites, not evidence that a staff workflow is implemented.
- **Phase 7 — Notifications and feedback:** The README identifies notifications and feedback as planned. Corresponding tables and seed examples exist, but no active notification/feedback routes or connected pages are available.
- **Phase 8 — Dashboards and reports:** The README identifies dashboards and reports as a planned phase. An administrator dashboard is already implemented in Phase 5. A student/staff dashboard controller, a staff-dashboard source file, and an admin reports source file exist, but their routes/pages are not mounted in the active application; further scope is unspecified.
- **Phase 9 — Testing and security:** The README identifies further testing and security work as planned. Existing automated authentication, student complaint, and admin integration tests are already present; the exact remaining acceptance criteria are unspecified.

This document does not authorize implementation of a planned phase. Follow the current user instruction and get approval before beginning one.
