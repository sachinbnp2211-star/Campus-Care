# CampusCare Production Deployment Guide & Checklist

This document provides instructions for deploying and running CampusCare securely in a production environment.

---

## 1. Pre-Deployment Configuration Checklist

Before deploying, ensure the following environment variables are set in your hosting platform (AWS ECS/Elastic Beanstalk, Render, DigitalOcean, Heroku, or self-hosted VPS):

| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | Must be set to `production`. |
| `PORT` | Node.js listener port | Standard container or HTTP port (e.g., `5000` or `8080`). |
| `CLIENT_URL` | Allowed frontend origin for CORS | Set to exact production frontend URL (e.g. `https://campuscare.university.edu`). Wildcard `*` is blocked in production. |
| `VITE_API_URL` | Frontend API baseURL | Built into the client bundle (e.g. `https://api.campuscare.university.edu/api`). |
| `JWT_SECRET` | Secret key for signing authentication tokens | Must be a unique cryptographically random string (min 32 characters, recommended 64+). Generate with `openssl rand -base64 48`. Demo/default secrets will cause startup rejection. |
| `DB_HOST` | MySQL database hostname | Hostname/endpoint of managed database (e.g., Amazon RDS / Google Cloud SQL). |
| `DB_PORT` | MySQL database port | Standard port `3306`. |
| `DB_USER` | MySQL database username | Dedicated application user with least-privilege permissions. |
| `DB_PASSWORD` | MySQL database password | Strong, randomly generated password. |
| `DB_NAME` | MySQL database name | `campus_complaint_db`. |
| `DB_CONNECTION_LIMIT` | Max connection pool size | Recommended `10` to `20` per instance. |
| `TRUST_PROXY` | Reverse proxy trust hops | Set to `1` when running behind ALB, Nginx, or Cloudflare. |

---

## 2. Database Provisioning & Migration

1. Run the database schema initialization against your production database:
   ```bash
   mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < database/schema.sql
   ```
2. **Important**: Do **not** load `seed.sql` on a live production instance. The seed script creates demo student and staff accounts.
3. If seeding an initial Super Admin account is needed, insert the hashed password directly:
   ```sql
   INSERT INTO users (name, email, password, phone, role, status)
   VALUES ('Campus Administrator', 'admin@university.edu', '<BCRYPT_HASH>', '5550100', 'admin', 'Active');
   ```

---

## 3. Storage & Multi-Instance Architecture Note

- **Current Implementation**: Uploaded attachments (PDFs, images) are stored locally under `server/uploads/`.
- **Single Instance Deployment**: Local disk storage is safe and fully functional for single container or VPS deployments with persistent disk mounts.
- **Horizontal Scaling / Multi-Instance Deployment**: If scaling to multiple load-balanced instances, mount a shared persistent network volume (e.g., AWS EFS) at `server/uploads` or migrate attachment storage to an S3/Cloud Storage bucket using signed URLs.

---

## 4. Build & Run Commands

### Backend Server
```bash
cd server
npm ci --only=production
node app.js
```

### Frontend Client
```bash
cd client
npm ci
npm run build
# The compiled static files in client/dist can be served via Nginx, S3 + CloudFront, or Vercel
```

---

## 5. Security Protections Included

- **Helmet**: Secures HTTP response headers, preventing clickjacking, MIME sniffing, and cross-site framing.
- **Login Rate Limiting**: Enforces brute-force protection on `/api/auth/login` (max 10 failed attempts per 15 minutes per IP).
- **JWT Verification & Inactive Token Revocation**: Disallows inactive or deactivated user accounts from using active tokens.
- **Attachment Restrictions**: File types strictly restricted to JPG, PNG, WebP, and PDF with memory buffering, file signature validation, and path traversal protection.
- **Strict Error Masking**: Centralized error middleware ensures internal database errors, paths, and stack traces are hidden from clients in production.
