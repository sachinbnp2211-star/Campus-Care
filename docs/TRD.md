# Campus Complaint Management System — Technical Requirements

## Document basis and scope

This document describes the current repository implementation: active Express route mounts, controllers and middleware, React routes/pages/services, MySQL DDL and seed data, package scripts, and tests. Source files that are not mounted or reachable are identified as inactive rather than documented as working APIs.

## Architecture

### Frontend

- React 18 single-page application built with Vite.
- React Router v6 defines public, student-protected, and administrator-protected routes.
- Tailwind CSS is configured through the client build pipeline; Recharts renders administrator dashboard charts and Lucide icons are used in navigation.
- `AuthProvider` restores the session using `GET /api/auth/me`, calls register/login APIs, and clears the browser token on logout.
- Axios is configured in `client/src/services/api.js`. Its base URL is `VITE_API_URL` or `http://localhost:5000/api`; a request interceptor attaches the stored token as a bearer authorization header.
- Login/session token storage uses browser `localStorage`. Application records and complaint data are stored in MySQL, not in local storage.
- Admin screens are lazy-loaded. Student and administrator pages call the live API and expose loading/error states.

### Backend

- Node.js CommonJS application using Express 4.
- `server/app.js` configures CORS, JSON parsing (5 MB request limit), URL-encoded parsing, health check, active route mounts, 404 handling, and the final error handler.
- MySQL access uses `mysql2/promise` through a lazily created connection pool in `server/config/db.js`.
- The pool reads the project-root `.env` and requires `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`; `DB_CONNECTION_LIMIT` defaults to 10.
- Active route mounts:
  - `/api/auth` → authentication routes.
  - `/api/complaints` / `/api/student` → student-only complaint routes.
  - `/api/staff` → staff-only complaint management and dashboard routes.
  - `/api/admin` → administrator-only management routes.
  - `/api/dashboard` → role-specific dashboard metrics.
  - `/api/notifications` → user notification routes.

## Configuration and database commands

The project-root `.env.example` lists:

- `PORT`, `CLIENT_URL`, `VITE_API_URL`
- `JWT_SECRET`, optionally `JWT_EXPIRES_IN`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, optionally `DB_CONNECTION_LIMIT`
- Attachment settings may use `MAX_FILE_SIZE` and `UPLOAD_DIR`.

Do not commit `.env` or replace the example placeholders with real credentials. Database setup applies `database/schema.sql` and then `database/seed.sql`; the script can add the `student_id` column and unique index when upgrading an older schema. It does not drop tables. The DB check reports the selected database and MySQL version.

## Authentication and authorization

### Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

Registration validates name/email/password plus optional phone, student ID, and department. It normalizes email to lowercase, checks unique email/student ID, validates an optional department, hashes passwords using `bcryptjs` with cost 12, and inserts the user with the `student` role. The response uses an explicit safe-user column list and excludes the password hash.

Login looks up by parameterized email query, compares with bcrypt, removes the hash from the response, and returns user data with a JWT. The token uses HS256, has the user ID as `sub`, and expires according to `JWT_EXPIRES_IN` (default `8h`). `JWT_SECRET` must be at least 32 characters.

`protect` requires `Authorization: Bearer <token>`, verifies the HS256 JWT, validates the numeric subject, then loads the current user from MySQL. The current database role, not user-supplied role data, is attached to `req.user`. `authorize(...roles)` returns 401 without a current user and 403 when the current database role is not permitted.

### Active role boundaries

- Registration is public but always creates students.
- `/api/complaints` requires authentication and `student` role on every route.
- `/api/admin` requires authentication and `admin` role on every route.
- A staff role exists in the database and seed data but has no active staff-only application API or routed staff workflow.

## Active API contracts

All APIs are prefixed with `/api`. JSON endpoints return JSON objects; validation and operational errors ordinarily include a `message`.

### Student complaint APIs (`/api/complaints`)

All routes below require a valid student JWT.

| Method and path | Purpose |
|---|---|
| `GET /categories` | List categories for complaint entry/filtering. |
| `GET /departments` | List departments for complaint entry/filtering. |
| `GET /` | List only the authenticated student's complaints. Accepts `status`, `category`, `department`, `priority`, `search`, `sortBy`, `sortOrder`, `page`, and `limit`. Page defaults to 1, limit to 10, maximum limit is 100. |
| `POST /` | Create a complaint from multipart form data. Accepts title, description, location, category ID, optional department ID, priority, and optional `attachments` files (`image` is accepted for one-file compatibility). |
| `GET /:id` | Return owned complaint details, status history, and attachment metadata/URLs. |
| `PUT /:id` | Edit allowed complaint content/category/department/priority only while status is `Submitted`. Owner, status, and assignment staff cannot be changed by the student. |
| `PUT /:id/status` | Explicitly denies student status changes with 403. |
| `GET /:id/attachments/:attachmentId` | Download an attachment after confirming the complaint belongs to the authenticated student. |

Complaint creation validates referenced category/department IDs, takes a MySQL named lock while allocating a year-prefixed complaint number (`CMP-YYYY-NNNNN`), and uses a transaction for the complaint, initial history, and attachment metadata. The authenticated JWT user ID determines complaint ownership.

List sorting is limited to an explicit column allowlist. Filters and values are bound as SQL parameters. The endpoint returns a `complaints` array and `pagination` object (`page`, `limit`, `total`, `totalPages`).

### Administrator APIs (`/api/admin`)

All routes below require a valid administrator JWT.

| Method and path | Purpose |
|---|---|
| `GET /dashboard` | Database-derived complaint totals, student/staff counts, category/status counts, recent complaint records, and monthly counts. |
| `GET /complaints` | List all complaints with submitter/category/department/staff details and status, priority, category, department, search, sorting, and pagination filters. |
| `PATCH /complaints/:id` | Update valid status/priority and department/staff assignment; optional `remark` is recorded for status change history. |
| `GET /users` | List safe user fields and department name; does not select password hashes. |
| `PUT /users/:id` | Update `role` and/or `departmentId`; rejects unknown fields/roles/departments and prevents self-demotion or demotion of the last administrator. |
| `GET /categories` | List categories. |
| `POST /categories` | Create a category (`name`, optional `description`). |
| `PUT /categories/:id` | Edit a category. |
| `GET /departments` | List departments. |
| `POST /departments` | Create a department (`name`, optional `description`). |
| `PUT /departments/:id` | Edit a department. |

Complaint list defaults to page 1 and limit 10, caps limit at 100, validates filters and sorting, and returns `complaints` plus pagination metadata. Assignment validation requires an existing department; a selected staff account must have role `staff` and belong to the selected department. Assignment changes can set an initial/review complaint to `Assigned`. The complaint and status-history update is transactional and uses a row lock.

Reference names are required and limited to 100 characters; descriptions are strings limited to 2,000 characters. Duplicate reference names return a conflict response. There are no active delete endpoints for users, categories, or departments.

### Not active in the Express app

The database contains feedback and notification tables. Legacy complaint and dashboard controllers/routes contain additional code, but their route files are not mounted. The available student notifications page, staff dashboard page, and admin reports page are not registered in the active React route tree. Do not present those as working endpoints/features or activate them without an approved task.

## MySQL schema and relationships

The DDL uses InnoDB and `utf8mb4` with `utf8mb4_0900_ai_ci`.

| Table | Current responsibility |
|---|---|
| `users` | Accounts, unique email, optional unique student ID, bcrypt password hash, role enum, optional department, timestamps. |
| `departments` | Named departments and optional descriptions; name is unique. |
| `categories` | Named complaint categories and optional descriptions; name is unique. |
| `complaints` | Complaint number, submitting user, category, details, priority/status enums, department/staff assignments, timestamps, and resolution time. |
| `complaint_attachments` | Original file name, server-relative stored file path, complaint, uploader, and timestamp. |
| `complaint_status_history` | Previous/new status, complaint, actor, optional remark, and timestamp. |
| `feedback` | Unique feedback row per complaint with user, rating and optional comment. Not used by an active feedback API. |
| `notifications` | User, optional complaint, title/message/read flag and timestamp. Not used by an active notification API. |

Relationships and delete behavior:

- `users.department_id` → `departments.id` (`ON DELETE SET NULL`).
- `complaints.user_id` → `users.id` (`ON DELETE RESTRICT`).
- `complaints.category_id` → `categories.id` (`ON DELETE RESTRICT`).
- `complaints.assigned_department_id` → `departments.id` (`ON DELETE SET NULL`).
- `complaints.assigned_staff_id` → `users.id` (`ON DELETE SET NULL`).
- `complaint_attachments.complaint_id` → `complaints.id` (`ON DELETE CASCADE`); `uploaded_by` → `users.id` (`ON DELETE RESTRICT`).
- `complaint_status_history.complaint_id` → `complaints.id` (`ON DELETE CASCADE`); `changed_by` → `users.id` (`ON DELETE RESTRICT`).
- `feedback.complaint_id` → `complaints.id` (`ON DELETE CASCADE`); `user_id` → `users.id` (`ON DELETE RESTRICT`).
- `notifications.user_id` → `users.id` (`ON DELETE CASCADE`); optional `complaint_id` → `complaints.id` (`ON DELETE SET NULL`).

The schema has indexes on role, foreign keys, complaint ownership/status/category/priority/assignment, attachment lookup, status history lookup, feedback user, and notification user/read state. Feedback rating is constrained to 1–5. Complaint priority is `Low`, `Medium`, `High`, or `Urgent`; complaint status is `Submitted`, `Under Review`, `Assigned`, `In Progress`, `Resolved`, `Closed`, or `Rejected`.

## Attachment processing

The active student upload middleware uses Multer memory storage. It accepts JPEG, PNG, WebP, and PDF MIME types, enforces a maximum of five files and a per-file limit of `MAX_FILE_SIZE` (default 5 MiB), and limits multipart fields. The complaint controller verifies content signatures before writing UUID-named files to local storage. `UPLOAD_DIR` is resolved relative to the server directory; the default is `server/uploads`. Database file paths are relative names, not absolute paths. Download authorization is checked against both complaint and owner.

## Validation, SQL safety, and errors

- Controllers validate required data, types, maximum lengths, numeric IDs, enum values, pagination, sort columns, and referenced entities.
- SQL data values use `mysql2` prepared `execute` calls and placeholders. Dynamic sort columns are selected from hard-coded allowlists; table names for category/department writes are internal constants, not client input.
- Ownership and role checks are performed on the server, not inferred from frontend route visibility.
- Database transactions and row locks protect complaint updates and student complaint creation; a named lock protects complaint-number generation.
- Express returns a JSON 404 for unknown routes. The central handler exposes expected 4xx error messages, reports configured/database unavailability as 503, and otherwise returns a generic 500 message while logging server errors.
- CORS allows the configured `CLIENT_URL`, defaulting to `http://localhost:5173`.

## Testing

- `server/test/auth.test.js` exercises registration/login validation, password hashing, JWT, current-user, expiry, and role checks using an isolated test database adapter.
- `server/test/complaints.integration.test.js` uses configured MySQL for complaint persistence, numbering, initial history, attachments, search/filter/sort/pagination, and owner authorization; it creates and removes temporary test data.
- `server/test/admin.integration.test.js` uses configured MySQL for administrator authorization, dashboard/list responses, input validation, status history, assignment/staff department checks, safe user results/updates, and category/department edits.
- Integration tests require a reachable configured MySQL database and seeded reference data. They insert temporary records and perform cleanup.

## Development and verification commands

From the repository root:

```bash
npm install
npm run install:server
npm run install:client
cp .env.example .env
# Configure database credentials and a JWT_SECRET of at least 32 characters in .env.
npm run db:setup
npm run db:check
npm run dev
npm run test:server
npm run build:client
```

`npm run dev` starts the Express server and Vite development server concurrently. Defaults are `http://localhost:5000` for the API and `http://localhost:5173` for the client. `GET /api/health` is the server health check; it does not prove MySQL connectivity. `npm run db:check` verifies MySQL access.

## Unspecified future implementation details

The available project documentation names future staff features, notifications/feedback, dashboards/reports, and additional testing/security work, but does not provide detailed future API contracts, transitions, UI acceptance criteria, attachment access rules, or external integration requirements. Those details require an approved specification before implementation.
