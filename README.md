# Courier App — Backend

A MERN-stack courier management system backend built with Node.js, Express, and MongoDB. Supports two user roles (Admin and Partner) with full job lifecycle management — from job creation through pickup, PDF generation, and dispatch.

> Note: project name is a placeholder for now, will be updated later.

## Tech Stack

- **Runtime:** Node.js, Express
- **Database:** MongoDB (Mongoose)
- **Auth:** JWT (httpOnly cookies)
- **File Storage:** Cloudinary (photos + generated PDFs)
- **File Uploads:** Multer + multer-storage-cloudinary
- **Queue / Background Jobs:** BullMQ + Redis (Upstash)
- **PDF Generation:** Puppeteer (HTML → PDF)

## Architecture Overview

- Two roles — **Admin** and **Partner** — each with separate login endpoints, stored in separate Mongoose models.
- Role identity is carried in the JWT payload (`role: "admin" | "partner"`), not stored redundantly on documents.
- Heavy/slow work (PDF generation) is offloaded to a BullMQ queue + worker, decoupled from the request/response cycle — routes enqueue jobs and respond immediately; the worker processes them in the background using Puppeteer + Cloudinary.
- Every meaningful state change (job created, assigned, locked/unlocked, dispatched, PDFs generated, partner deactivated/activated) is recorded in an append-only `AuditLog` collection for traceability and dispute resolution.

## Project Structure

```
src/
├── config/          # DB, Redis, Cloudinary connection setup
├── middleware/       # Auth, role guards, lock/assignment checks
├── model/             # Mongoose schemas
├── routes/           # Express route definitions
├── queues/            # BullMQ queue definitions
├── workers/           # BullMQ worker(s) — PDF generation
├── utils/             # Shared helpers (audit logging, template rendering)
└── index.js           # App entry point

uploads/
└── templates/         # HTML templates used for PDF generation (invoice, pod-slip)

scripts/
└── seedAdmin.js        # One-off script to seed the first admin account
```

## Data Models

| Model | Purpose |
|---|---|
| `Admin` | Admin accounts |
| `Partner` | Delivery partner accounts, includes `isDeactivated` flag |
| `Job` | Core courier job — client & receiver details, weight/dimensions, status, lock state |
| `JobItem` | Individual items within a job's package |
| `JobPhoto` | Labelled photos (id proof, waybill, packed box, etc.) tied to a job |
| `ClientInvoice` | Generated invoice PDF metadata |
| `PodSlip` | Generated proof-of-delivery PDF metadata, includes SHA-256 hash |
| `Shipment` | Carrier/tracking info once a job is dispatched |
| `AuditLog` | Append-only event log for every significant action |

## Authentication & Authorization

- `POST /api/auth/login` — Admin login
- `POST /api/partner/login` — Partner login
- JWT stored in an httpOnly, secure cookie
- `userAuth` middleware — verifies JWT, attaches `req.user`
- `isAdmin` middleware — restricts a route to admin role only
- `verifyPartnerAccess` middleware — allows admin unconditionally; for partners, verifies the job is assigned to them **and** not locked

## Core Job Lifecycle

1. **Admin creates a job** (`POST /api/jobs/new-job`)
2. **Admin assigns it** to a partner, or self-assigns
3. **Partner (or admin) fills in details** as they go — receiver info, weight, dimensions, items, photos — all save-as-you-go via PATCH/POST routes
4. **Partner submits** (`POST /api/jobs/:id/submit`) — if weight & price are present, triggers both invoice and pod-slip PDF generation in the background
   - If price/weight is missing, partner instead calls `/defer-invoice`, which generates only the pod-slip; admin completes the invoice later via `POST /api/jobs/:id/invoice`
5. **Admin records shipment** (`POST /api/jobs/:id/shipment`) — logs carrier/tracking info, marks job dispatched
6. Job can be **manually locked/unlocked** by admin at any point (with reason tracking); locking blocks partner edits but never blocks admin

## PDF Generation Pipeline

1. Route enqueues a typed job (`generate-invoice` / `generate-pod-slip`) into a single BullMQ queue, passing only the data needed (job id, actor info)
2. Worker picks up the job, fetches full job data (+ items/photos for pod-slip) from MongoDB
3. Data is injected into a static HTML template
4. Puppeteer renders the HTML to a PDF buffer
5. Buffer is uploaded to Cloudinary (raw resource type, `.pdf` extension baked into the public ID)
6. Resulting URL + metadata saved to `ClientInvoice` / `PodSlip`
7. An audit log entry (`pdfGenerated`, actor role `system`) is recorded

Typical generation time: well within 30 seconds per job.

## Known Quirks

- Cloudinary `raw`-type PDF URLs sometimes fail to preview inline in Chrome's built-in PDF viewer (shows "Failed to load PDF document") even though the file is completely valid — confirmed downloadable and correct via Cloudinary's own dashboard. This does not affect proper download flows (`<a download>`, blob fetch) that the frontend will use.

## Environment Variables

```dotenv
PORT=
MONGO_URI=
JWT_SECRET=
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Not Yet Built

- Socket.IO real-time notifications (PDF-ready events) — deferred until frontend is further along
- BullMQ scheduled auto-lock job (`jobAutoLocked`) — manual lock/unlock exists, automatic time-based locking does not yet
- `pdfRegenerated` audit action — reserved for a future "regenerate after correction" flow, not yet triggered anywhere
