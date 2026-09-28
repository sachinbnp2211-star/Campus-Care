# CampusCare — Campus Complaint & Issue Resolution System

CampusCare is an enterprise-grade, role-based campus issue tracking and complaint management platform designed for universities and colleges. It bridges students, department staff, and campus administrators with transparent issue routing, status tracking, SLA monitoring, and security controls.

---

## Key Highlights & Architecture

- **Role-Based Access Control (RBAC)**: Distinct, isolated portals and capabilities for **Students**, **Department Staff**, and **Campus Administrators**.
- **Category → Responsible Department Routing**: Complaints submitted by students (e.g., Transportation, Electrical, Plumbing, Security, IT, Housekeeping) automatically resolve to the responsible campus department.
- **Assignment & Escalation Workflow**: Department administrators assign complaints to active staff officers within the corresponding department.
- **Strict Complaint Lifecycle**: Atomic status transitions (`Submitted` → `Under Review` → `Assigned` → `In Progress` → `Resolved` → `Closed`) backed by audit histories and mandatory resolution remarks.
- **Security & Access Control**: Enforces IDOR isolation, login brute-force rate limiting, Helmet HTTP security headers, JWT validation with inactive account revocation, and path-traversal protected attachment uploads.

---

## User Roles & Capabilities

### 1. Student Portal (`/student/*`)
- **Interactive Dashboard**: Real-time summary of submitted, in-progress, and resolved complaints.
- **Complaint Submission**: Multi-category issue submission with automatic department resolution, location tagging, priority selection, and attachment uploads (PDF, PNG, JPG, WebP).
- **Edit Immutability**: Students can safely edit complaint details while in `Submitted` status; edits are locked once reviewed or assigned.
- **Notifications**: Instant notifications on status changes and staff assignments with mark-as-read toggles.
- **Issue Timeline & Tracking**: Complete visibility into status history, assigned department, and staff resolution remarks.

### 2. Staff Portal (`/staff/*`)
- **Direct Login**: Dedicated login endpoint (`/staff/login`). Public staff registration is disabled; all staff accounts are created and managed by administrators.
- **Department Queue & Dashboard**: Live statistics for complaints directly assigned to the staff officer.
- **Investigation & Progression**: Move assigned complaints through `In Progress` and `Resolved` with resolution remarks.
- **Isolated Access Control**: Staff members can only view, download attachments for, and update complaints assigned directly to them.

### 3. Administrator Portal (`/admin/*`)
- **Executive Dashboard & Analytics**: System-wide complaint metrics, department workload breakdown, and monthly trends.
- **Staff Management**: Create, edit, activate/deactivate staff members, assign staff to departments, and execute administrative password resets.
- **Category & Department Management**: Configure campus departments and map complaint categories to responsible departments with Active/Inactive toggles.
- **Complaint Routing & Assignment**: Review submitted complaints, assign issues to qualified active staff members in the responsible department, or reassign across departments.

---

## Project Structure

```text
campuscare/
├── client/                     # Frontend React (Vite + TailwindCSS)
│   ├── src/
│   │   ├── components/         # Reusable UI components (Layout, StatCard, StatusBadge, ProtectedRoute)
│   │   ├── context/            # AuthContext & Session management
│   │   ├── pages/
│   │   │   ├── admin/          # Admin Dashboard, Complaints, Staff, Users, Departments, Categories, Reports
│   │   │   ├── staff/          # Staff Login, Assigned Dashboard, Complaint Details & Resolution
│   │   │   ├── student/        # Student Dashboard, Submit Complaint, My Complaints, Notifications
│   │   │   └── profile/        # User Profile page
│   │   ├── services/           # Axios API client with bearer token interceptors
│   │   └── App.jsx             # React Router with role guards and lazy loading
│   └── package.json
│
├── server/                     # Backend Node.js Express API
│   ├── config/                 # MySQL connection pool & environment validation
│   ├── controllers/            # adminController, authController, staffController, studentComplaintController, dashboardController
│   ├── middleware/             # auth (JWT & RBAC), complaintUpload (Multer), rateLimiter
│   ├── routes/                 # Express API route modules
│   ├── scripts/                # Database setup & connection checker
│   ├── test/                   # Comprehensive Node test runner integration suites (81+ tests)
│   └── app.js                  # Application entry point with Helmet, CORS, and error handlers
│
├── database/
│   ├── schema.sql              # MySQL DDL schema (InnoDB, Foreign Keys, Indexes, Checks)
│   └── seed.sql                # Development demonstration dataset
│
├── DEPLOYMENT.md               # Production deployment guide and checklist
├── README.md                   # System documentation
└── .env.example                # Environment template
```

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **npm**: `v9.0.0` or higher
- **MySQL**: `8.0.16` or higher (InnoDB engine)

---

## Quick Start & Local Setup

### 1. Clone & Install Dependencies

```bash
# Install root, server, and client dependencies
npm install
npm run install:server
npm run install:client
```

### 2. Configure Environment

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Configure your local MySQL database credentials in `.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_local_development_secret_min_32_characters
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=campus_complaint_db
```

### 3. Initialize Database

Create the database in MySQL and run the migration/seed script:

```bash
# Verify connection
npm run db:check

# Apply schema and initial development seed
npm run db:setup
```

### 4. Start Development Servers

```bash
# Start both backend (port 5000) and frontend (port 5173) concurrently
npm run dev
```

Visit **http://localhost:5173** to access CampusCare.

---

## Demo Credentials (Development Seed)

| Role | Portal Login | Email | Password |
| :--- | :--- | :--- | :--- |
| **Administrator** | `/login` | `admin@campus.edu` | `admin123` |
| **Staff (Transport)** | `/staff/login` | `staff1@campus.edu` | `staff123` |
| **Staff (Maintenance)**| `/staff/login` | `staff2@campus.edu` | `staff123` |
| **Student** | `/login` | `student1@campus.edu` | `student123` |

> *Note: Seed passwords are stored exclusively as bcrypt hashes in `seed.sql`. Never use demo credentials in a production deployment.*

---

## Automated Test Suites

CampusCare includes comprehensive integration and security test suites using the native Node.js test runner:

```bash
npm --prefix server test
```

### Coverage Scope:
- **Authentication & JWT**: Password hashing, duplicate checks, token expiry, inactive token revocation.
- **RBAC Matrix**: Enforces strict privilege boundaries between Student, Staff, and Admin roles.
- **IDOR Protection**: Validates that users and staff cannot access or tamper with unauthorized complaints or attachments.
- **Category → Department Routing**: Derivation of assigned department, spoofing protection, and cross-department reassignment.
- **Complaint Lifecycle**: Forward-only state transitions, resolution remarks, and notification dispatch.
- **Production Hardening**: Rate limiting, Helmet security headers, CORS origin validation, and error masking.

---

## Production Build

```bash
# Build production frontend bundle into client/dist/
npm --prefix client run build

# Start production server
NODE_ENV=production npm --prefix server start
```

For complete production deployment instructions, reverse proxy setup, and environment checklists, see [DEPLOYMENT.md](./DEPLOYMENT.md).
