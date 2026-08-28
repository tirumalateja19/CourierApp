# PickItUp Courier App — Backend

A MERN-stack courier management system backend built with Node.js, Express, and MongoDB. Supports two user roles (Admin and Partner) with full job lifecycle management — from job creation through pickup, PDF generation, and dispatch.

## Tech Stack

| **Category** | **Technology** |
| :--- | :--- |
| **Runtime** | [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/) [![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/) |
| **Database** | [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/) [![Mongoose](https://img.shields.io/badge/Mongoose-ODM-880000?logo=mongoose&logoColor=white)](https://mongoosejs.com/) |
| **Auth & Security** | [![JWT](https://img.shields.io/badge/JWT-httpOnly_Cookies-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/) |
| **File Storage** | [![Cloudinary](https://img.shields.io/badge/Cloudinary-Media_%26_PDFs-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/) [![Multer](https://img.shields.io/badge/Multer-File_Uploads-FF6C37?logo=npm&logoColor=white)](https://www.npmjs.com/package/multer) |
| **Background Queue** | [![BullMQ](https://img.shields.io/badge/BullMQ-Job_Queue-E72C41?logo=redis&logoColor=white)](https://docs.bullmq.io/) [![Upstash](https://img.shields.io/badge/Upstash-Serverless_Redis-00E9A3?logo=upstash&logoColor=white)](https://upstash.com/) |
| **PDF Generation** | [![Puppeteer](https://img.shields.io/badge/Puppeteer-HTML_to_PDF-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev/) |

## Architecture Overview

- Two roles — **Admin** and **Partner** — each with separate login endpoints, stored in separate Mongoose models.
- Role identity is carried in the JWT payload (`role: "admin" | "partner"`), not stored redundantly on documents.
- Heavy/slow work (PDF generation) is offloaded to a BullMQ queue + worker, decoupled from the request/response cycle — routes enqueue jobs and respond immediately; the worker processes them in the background using Puppeteer + Cloudinary.
- Every meaningful state change (job created, assigned, locked/unlocked, dispatched, pod slip generated, partner deactivated/activated, items/photos edited) is recorded in an append-only `AuditLog` collection for traceability and dispute resolution.

## Project Structure

```
src/
├── config/          # DB, Redis, Cloudinary, Multer/Cloudinary storage setup
├── middleware/       # Auth, role guards, lock/assignment checks
├── model/             # Mongoose schemas
├── routes/           # Express route definitions
├── queues/            # BullMQ queue definitions
├── workers/           # BullMQ worker(s) — PDF generation
├── utils/             # Shared helpers (audit logging, template rendering)
└── index.js           # App entry point

uploads/
└── templates/         # HTML template used for PDF generation (pod-slip)

scripts/
└── seedAdmin.js        # One-off script to seed the first admin account
```

## Architecture Notes

<img width="994" height="1496" alt="image" src="https://github.com/user-attachments/assets/4238e1f5-3d57-4c12-a19a-83f37c3a7315" />

## Data Models

| Model | Purpose |
|---|---|
| `Admin` | Admin accounts |
| `Partner` | Delivery partner accounts, includes `isDeactivated` flag |
| `Job` | Core courier job — client & receiver details, weight/dimensions, status, lock state |
| `JobItem` | Individual items within a job's package |
| `JobPhoto` | Labelled photos (id proof, waybill, packed box, invoice, item evidence, payment receipt) tied to a job, includes Cloudinary `publicId` for deletion |
| `PodSlip` | Generated proof-of-delivery PDF metadata, includes SHA-256 hash (`pdfHash`) for future dedup use |
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
3. **Partner (or admin) fills in details** as they go — receiver info, price, weight, dimensions, items, photos — all save-as-you-go via PATCH/POST routes
4. **Partner (or admin) submits** (`POST /api/jobs/pickup/:id/submit`) — requires receiver details to be present; enqueues a single `generate-pod-slip` job, which renders the pod slip as page 1 followed by each uploaded photo as its own page
5. **Admin records shipment** (`POST /api/jobs/:id/shipment`) — logs carrier/tracking info, marks job dispatched
6. Job can be **manually locked/unlocked** by admin at any point (with reason tracking); locking blocks partner edits (details, items, photo upload/delete) but never blocks admin

## PDF Generation Pipeline

1. `/submit` route enqueues a `generate-pod-slip` job into a single BullMQ queue (fixed `jobId: pod-slip-${id}`, `removeOnFail: true` — prevents duplicate jobs on repeat clicks while allowing retries after failure), passing only the data needed (job id, actor info)
2. Worker picks up the job, fetches full job data + items + photos for that job from MongoDB
3. Data is injected into a static HTML template
4. Puppeteer renders the HTML to a PDF buffer (pod slip page first, followed by one page per uploaded photo)
5. Buffer is uploaded to Cloudinary (raw resource type, `.pdf` extension baked into the public ID)
6. Resulting URL + SHA-256 hash saved to `PodSlip` (upserted per job)
7. An audit log entry (`podSlipGenerated`) is recorded

On Render, the worker launches Chromium via `@sparticuz/chromium` + `puppeteer-core` (detected via `RENDER=true`); locally it dynamically imports standard `puppeteer` to avoid module resolution issues.

Typical generation time is well within 30 seconds, though first-request cold starts on Render's free tier can add noticeable delay.

## Item Name Suggestions

`GET /api/jobs/pickup/items/suggestions` returns all distinct `itemName` values ever recorded (`JobItem.distinct("itemName")`). Given the expected ceiling of a few hundred unique item names, the frontend fetches this list once per form load and filters it client-side as the user types, rather than querying on every keystroke.

## Job List Pagination

`GET /api/jobs` (admin job list) supports `page` and `limit` query params alongside existing filters (`status`, `assignedToId`, `clientName`, `fromDate`, `toDate`). Response includes `totalJobs` (the page's results — name kept for frontend compatibility), `totalCount`, `totalPages`, and `currentPage`. The count query runs in parallel with the paginated find via `Promise.all`.

## Environment Variables

```dotenv
PORT=
MONGO_URI=
JWT_SECRET=
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RENDER=
```

## Not Yet Built

- Socket.IO real-time notifications (pod-slip-ready events) — deferred until frontend is further along
- BullMQ scheduled auto-lock job (`jobAutoLocked`) — manual lock/unlock exists, automatic time-based locking does not yet
- Force-regenerate — admin bypass for the staleness check (comparing `Job.updatedAt` vs. latest `PodSlip.createdAt`) that currently blocks regeneration when no changes have occurred
- `pdfHash` dedup — field exists on `PodSlip`, not yet used to prevent redundant regeneration
- Auto-archive delay for cancelled jobs
- Google OAuth
- CSV import/export