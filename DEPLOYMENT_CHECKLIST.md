# CampusCare Deployment Checklist

This checklist must be executed before, during, and after deploying CampusCare to staging or production environments.

---

## 1. Before Deployment

- [ ] **Production Database**: MySQL 8.0+ instance provisioned and accessible with secure network rules.
- [ ] **Database Credentials**: Secure, non-default database user and password configured.
- [ ] **Production JWT Secret**: High-entropy `JWT_SECRET` generated (minimum 32 characters, e.g., via `openssl rand -hex 32`).
- [ ] **Client Origin Configuration**: `CLIENT_URL` explicitly configured with the production domain (no wildcards or localhost).
- [ ] **Environment Mode**: `NODE_ENV=production` set across process managers and runtime containers.
- [ ] **Transport Security**: HTTPS/TLS certificates active with HTTP-to-HTTPS redirect enforced.
- [ ] **CORS Settings**: Verified against authorized frontend origin.
- [ ] **Reverse Proxy**: NGINX / Caddy configured with TLS, request timeouts, and secure proxy headers.
- [ ] **Persistent Attachment Storage**: Persistent mount or volume allocated for `server/uploads` with restricted read/write file permissions.
- [ ] **Automated Backups**: Regular MySQL dump / backup schedule configured and tested for restoration.
- [ ] **Demo Credentials Removed**: Ensure all demo accounts from `seed.sql` are changed or disabled in production.
- [ ] **Schema & Migrations**: Schema verified against [`database/schema.sql`](file:///Users/sachinkumar/Desktop/complain/database/schema.sql) without running destructive scripts.

---

## 2. Verification

- [ ] **Backend Service**: Server starts cleanly (`NODE_ENV=production node server.js`) and logs listening status.
- [ ] **Frontend Application**: SPA loads without console errors or broken assets.
- [ ] **Admin Authentication**: Admin login functions; token stored securely; role restricted.
- [ ] **Student Authentication**: Student registration and login functions properly.
- [ ] **Staff Authentication**: Staff login functions and loads assigned department dashboard.
- [ ] **Complaint Submission**: Student can submit a complaint; automatic Category → Department routing assigns correct department.
- [ ] **Staff Assignment**: Admin assigns complaint to eligible department staff; invalid staff rejected.
- [ ] **Status Lifecycle**: Staff updates status through `Assigned` → `In Progress` → `Resolved` / `Closed` with remarks.
- [ ] **Notifications**: Real-time notifications generate upon complaint assignment, status change, and resolution.
- [ ] **Attachment Authorization**: Direct attachment access is restricted to owning student and assigned staff.
- [ ] **RBAC / Security**: Cross-role access denied (Student cannot access Admin/Staff APIs; Staff cannot access Admin APIs).

---

## 3. Final Release

- [ ] Complete automated test suite passes: `npm test` (81/81 tests pass).
- [ ] Production build succeeds: `npm run build` (0 build errors).
- [ ] Git repository clean: No `.env`, secrets, or temporary files tracked.
- [ ] Security validation: No exposed credentials in responses or client logs.
- [ ] Database backup snapshot taken before release cut.
- [ ] Production release approved.
