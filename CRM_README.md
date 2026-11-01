# S&N Homes — WhatsApp AI Real Estate CRM

Complete technical documentation for the WhatsApp-powered AI CRM built on top of the S&N Homes website.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [How the System Works — End to End](#3-how-the-system-works--end-to-end)
4. [Admin Dashboard](#4-admin-dashboard)
5. [File Structure](#5-file-structure)
6. [Environment Variables](#6-environment-variables)
7. [Manual Setup Steps](#7-manual-setup-steps)
8. [Running Locally](#8-running-locally)
9. [Running Tests](#9-running-tests)
10. [API Reference](#10-api-reference)
11. [Firestore Collections Reference](#11-firestore-collections-reference)
12. [Production Checklist](#12-production-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. System Overview

S&N Homes CRM is a WhatsApp-first real estate CRM built for a Kerala-based agency. Customers send WhatsApp messages to buy or sell property. The AI (Google Gemini 2.0 Flash) extracts structured requirements from natural conversational text in English or Malayalam, searches the property inventory, sends matches, and creates follow-up tasks — all automatically, without any manual data entry.

**Key capabilities:**

| Capability | Detail |
|---|---|
| AI conversation | Gemini 2.0 Flash extracts structured data from free-form chat |
| Language support | English and Malayalam (bilingual, auto-detected) |
| Buyer workflow | Collects requirements, searches inventory, sends top 5 matches |
| Seller workflow | Collects listing details and photos, routes to owner for review |
| Human handover | "talk to agent" keyword auto-pauses the bot and alerts the owner |
| Durable processing | Job queue with retries and exponential backoff |
| Delivery receipts | Tracks sent/delivered/read/failed per outbound message |
| Duplicate prevention | Outbound idempotency guard prevents double-sends on retry |
| Admin dashboard | Full CRM UI at `/admin/crm` with 8 sections |
| Template messages | Pre-approved Meta templates for proactive outreach after 24h |

---

## 2. Architecture Diagram

```
Customer WhatsApp
        |
        |  HTTPS POST (webhook)
        v
+----------------------------------------------------------+
|               Express Server  (port 3001)                |
|                                                          |
|  +-------------------+    +---------------------------+  |
|  |  Webhook Handler   |--->|    Job Queue Enqueuer     |  |
|  |  (HMAC verified)   |    |    (crm_job_queue)        |  |
|  +-------------------+    +---------------------------+  |
|                                        |                 |
|  +-------------------------------------v---------------+ |
|  |          Job Queue Worker  (polls every 4s)         | |
|  |  Lock -> Process -> Complete / Backoff / Dead-letter| |
|  +-------------------------------------+---------------+ |
|                                        |                 |
|  +-------------------------------------v---------------+ |
|  |              Conversation Engine                    | |
|  |                                                     | |
|  |  1. Dedup check  (crm_webhook_events)               | |
|  |  2. Load / create customer + conversation           | |
|  |  3. Keyword check (opt-out, opt-in, human agent)    | |
|  |  4. Gemini AI extraction  (Zod validated)           | |
|  |  5. Route to buyer or seller workflow               | |
|  |  6. sendWhatsAppMessage  (idempotency guarded)      | |
|  |  7. Save outbound message with wamid                | |
|  +-------------------------------------+---------------+ |
|                                        |                 |
|  +-------------------------------------v---------------+ |
|  |              Firebase Firestore                     | |
|  |  conversation state, messages, tasks, submissions   | |
|  +-----------------------------------------------------+ |
|                                                          |
|  +-----------------------------------------------------+ |
|  |              REST API   /api/v1/*                   | |
|  |       (consumed by the React admin dashboard)       | |
|  +-----------------------------------------------------+ |
+----------------------------------------------------------+
        |
        |  WhatsApp Cloud API
        v
Customer WhatsApp (receives reply)
```

---

## 3. How the System Works — End to End

### 3.1 Inbound Message Flow

**Step 1 — Meta sends a webhook POST**

When a customer sends a WhatsApp message to the business number, Meta's servers POST to `POST /api/webhooks/whatsapp`. The server immediately responds `200 OK` (required within 1 second by Meta).

**Step 2 — HMAC signature verification**

The raw request body is buffered before `express.json()` parses it. The `X-Hub-Signature-256` header is validated against `HMAC-SHA256(META_APP_SECRET, raw_body)`. Requests with invalid signatures are silently dropped.

**Step 3 — Message is enqueued**

The parsed message (`from`, `body`, `mediaId`, `providerId`) is written to the `crm_job_queue` Firestore collection with `status: "pending"`. The webhook handler returns immediately — no AI processing happens synchronously.

**Step 4 — Job worker picks it up**

The job queue worker polls Firestore every 4 seconds:
1. Queries for `status == "pending"` AND `available_at <= now`
2. Atomically sets `status = "locked"` on the first result
3. Calls `processMessage()` from the conversation engine
4. On success: sets `status = "completed"`
5. On failure: increments `attempts`, sets `status = "pending"` with exponential backoff delay. After 5 attempts: sets `status = "dead"` and creates a `crm_notifications` alert for the owner.

**Step 5 — Conversation engine processes the message**

Inside `processMessage()`:

```
1.  Check crm_webhook_events for duplicate provider_message_id -> skip if seen
2.  Write to crm_webhook_events (idempotency record)
3.  getOrCreateCustomer(phone)          -> crm_customers
4.  getOrCreateConversation(customerId) -> crm_conversations
5.  saveMessage(..., 'inbound')         -> crm_messages
6.  If automation_paused               -> stop (human is handling this)
7.  If OPT_IN keyword + opted_out      -> resume and reply
8.  If OPT_OUT keyword                 -> mark opted_out, reply, stop
9.  If opted_out                       -> reminder reply, stop
10. If HUMAN_AGENT keyword             -> pause bot, notify owner, reply
11. Load last 10 messages as history
12. extractWithGemini(conv, body, history) -> structured JSON (Zod validated)
13. Route by intent: buy/rent -> handleBuyerFlow, sell -> handleSellerFlow
14. sendWhatsAppMessage(from, reply)   -> returns wamid
15. saveMessage(..., 'outbound', wamid) -> crm_messages with provider_message_id
```

---

### 3.2 Buyer Workflow

The buyer workflow collects three required fields via multi-turn conversation:
- **Property type** (house / flat / plot / commercial / villa / land)
- **Location(s)** (one or more areas in Kerala)
- **Maximum budget** (in INR — the AI converts "50 lakhs" to 5000000)

Until all three are present, the AI asks the next missing question in the customer's detected language.

**When all fields are collected:**

1. A `crm_buyer_requests` document is saved with the structured requirements
2. `searchProperties()` queries the `properties` collection:
   - Hard filter: `status == "active"`, `propertyType == type`, `price <= budget_max`
   - Optional filter: `bedrooms >= bedrooms_min`
   - If no results: relaxes the bedrooms constraint and retries (soft fallback)
   - Returns top 5 results with title, price, location, and canonical URL
3. Results are sent as a formatted WhatsApp message with follow-up options:
   ```
   Properties matching your requirements:

   1. Sea View Villa
      Kochi — Rs 45.00 L
      https://snhomes.in/property/abc123

   Would you like to:
   1 - Schedule a site visit
   2 - Request a callback
   3 - Not now
   ```
4. All matches are recorded in `crm_property_matches`
5. A `crm_follow_up_tasks` record is created, due in 24h

---

### 3.3 Seller Workflow

**Detection:** If the customer says "sell", "want to sell", "list my property", etc., the AI sets `intent: "sell"`.

The bot collects: property type, location, asking price, land area, built-up area, bedrooms, bathrooms, road access, description, and photos (sent as separate WhatsApp image messages).

**On submission:**
1. A `crm_seller_submissions` document is created with `status: "pending_review"`
2. The owner is notified via a dashboard alert, WhatsApp message, and email (if SendGrid is configured)

**Owner review actions from the admin dashboard:**
- **Approve** — creates a draft listing in `properties`, notifies the seller
- **Reject** — marks the submission rejected with a reason, notifies the seller
- **Request more info** — sends a follow-up question to the seller

---

### 3.4 Human Agent Takeover

If the customer sends any of these keywords:
```
human, agent, talk to agent, speak to agent, talk to human,
call me, real person, manushyan, ejantru  (Malayalam variants also included)
```

The system:
1. Sets `automation_paused: true` on the conversation in Firestore
2. Sends: "A team member will contact you shortly. Automated replies have been paused."
3. Creates a `crm_notifications` record and sends a WhatsApp alert to the owner
4. All future messages are logged but receive no automated reply

The bot remains paused until the owner manually resumes from the Inbox page (`/admin/crm/inbox`).

---

### 3.5 Delivery Status Tracking

When Meta delivers a message to the customer's device, it sends a separate webhook with a `statuses` array:

```json
{ "statuses": [{ "id": "wamid.xxx", "status": "delivered" }] }
```

The webhook handler detects the `statuses` field, queries `crm_messages` by `provider_message_id`, and updates `provider_status` to `"sent"` / `"delivered"` / `"read"` / `"failed"`.

Status progression: `sent` -> `delivered` -> `read`

---

### 3.6 Job Queue Worker

The worker starts automatically with the Express server. It polls Firestore every 4 seconds.

**Backoff schedule:**

| Attempt | Delay |
|---------|-------|
| 1 | 30 seconds |
| 2 | 2 minutes |
| 3 | 8 minutes |
| 4 | 32 minutes |
| 5 | Dead — owner alerted in dashboard |

**Idempotency guard:** Before every outbound WhatsApp send, a SHA-256 hash of `(to + text + 10-minute-slot)` is computed and checked against `crm_outbound_idempotency`. If the hash already exists, the API call is skipped and the existing `wamid` returned. This prevents duplicate messages when a job retries after a partial failure (e.g., the WA send succeeded but the subsequent Firestore write crashed).

**Stuck lock recovery:** On every poll tick, the worker checks for jobs stuck in `"locked"` state for more than 60 seconds and resets them to `"pending"`. This handles server crashes mid-job.

---

### 3.7 Template Messages (Outside 24h Window)

Meta requires pre-approved **message templates** for any outbound message sent more than 24 hours after the customer's last inbound message. Freeform text outside this window is rejected with error `131047`.

`server/templateService.ts` provides:
- `sendTemplateMessage(to, templateName, variables)` — calls the Meta template API
- `isWithin24hWindow(phone)` — checks the last inbound message timestamp
- `smartSend(to, freeform, templateFallback, sendFn)` — automatically uses freeform within the window, falls back to a template outside it

---

## 4. Admin Dashboard

The admin dashboard lives at `/admin/crm` (requires admin login at `/admin-login`).

| Page | URL | Purpose |
|---|---|---|
| Overview | `/admin/crm` | Live stats: open conversations, pending buyers/sellers, overdue tasks, failed jobs |
| Inbox | `/admin/crm/inbox` | All conversations — send manual replies, pause/resume bot |
| Buyer Requests | `/admin/crm/buyers` | All buyer leads with requirements, match history, status |
| Seller Submissions | `/admin/crm/sellers` | Pending listings — approve, reject, request more info |
| Properties | `/admin/crm/properties` | Full property CRUD — create, edit, publish, archive |
| Follow-ups | `/admin/crm/followups` | Overdue and upcoming follow-up tasks |
| Audit Logs | `/admin/crm/audit` | Immutable log of all system and admin actions |
| Settings | `/admin/crm/settings` | Live health check (WA/AI/Firebase), webhook config reference |

---

## 5. File Structure

```
S-N-Homes-Website/
|
+-- server/
|   +-- whatsapp-server.ts      Entry point: webhook + REST API + worker start
|   +-- conversationEngine.ts   AI extraction, buyer/seller flows, sendWhatsAppMessage
|   +-- jobWorker.ts            Durable job queue with backoff retries
|   +-- apiRoutes.ts            All /api/v1/* REST endpoints
|   +-- firebaseAdmin.ts        Firebase Admin SDK init (modular v12)
|   +-- mediaService.ts         WhatsApp media download to Firebase Storage
|   +-- templateService.ts      WhatsApp template sending + 24h window detection
|
+-- src/
|   +-- pages/
|   |   +-- CrmOverview.tsx         Dashboard overview
|   |   +-- CrmInbox.tsx            Conversation inbox
|   |   +-- CrmBuyerRequests.tsx    Buyer leads management
|   |   +-- CrmSellerSubmissions.tsx Seller submission review
|   |   +-- CrmProperties.tsx       Property CRUD
|   |   +-- CrmFollowUps.tsx        Follow-up task management
|   |   +-- CrmAuditLogs.tsx        Audit log viewer
|   |   +-- CrmSettings.tsx         System health + settings
|   +-- services/
|   |   +-- crmService.ts           Frontend API client
|   +-- App.tsx                     Route definitions
|
+-- tests/
|   +-- unit/
|       +-- conversationEngine.test.ts
|       +-- apiRoutes.test.ts
|
+-- firestore.rules             Firestore security rules
+-- .env.example                All required env vars documented
+-- CRM_README.md               This file
```

---

## 6. Environment Variables

Copy `.env.example` to `.env` and fill in all values before starting the server.

```env
# WhatsApp / Meta
WHATSAPP_ACCESS_TOKEN=        # Permanent token from Meta Business Suite
WHATSAPP_PHONE_NUMBER_ID=     # Phone number ID from Meta Developer Console
WHATSAPP_VERIFY_TOKEN=        # Any string — must match what you enter in Meta console
META_APP_SECRET=              # App secret for HMAC webhook verification

# Google Gemini AI
GEMINI_API_KEY=               # From https://aistudio.google.com/app/apikey

# Firebase Admin (backend)
FIREBASE_SERVICE_ACCOUNT_JSON=  # Minified JSON of service account key file
# OR:
GOOGLE_APPLICATION_CREDENTIALS=  # Absolute path to service account key JSON

# Firebase Client SDK (frontend)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Notifications
OWNER_WHATSAPP_PHONE=         # E.164 format: +919876543210
OWNER_EMAIL=                  # owner@snhomes.in
SENDGRID_API_KEY=             # Optional — for email alerts

# App
WEBSITE_BASE_URL=             # https://snhomes.in  (no trailing slash)
PORT=3001
```

---

## 7. Manual Setup Steps

These steps **cannot be automated** and require action in external dashboards.

---

### 7.1 Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. Enable **Firestore Database** (production mode).
3. Enable **Firebase Storage**.
4. Enable **Authentication** with the Email/Password provider.
5. Go to **Project Settings → Service Accounts → Generate new private key** — download the JSON.
6. Minify the JSON and set it as `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`.
7. Copy the web app config into the `VITE_FIREBASE_*` environment variables.
8. Deploy Firestore security rules:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

### 7.2 Meta Developer Console

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App → Business**.
2. Add the **WhatsApp** product.
3. Under **WhatsApp → API Setup**: note the **Phone Number ID**.
4. Generate a permanent **System User access token** with `whatsapp_business_messaging` permission.
5. Copy the **App Secret** from App Settings → Basic.
6. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET` in `.env`.

**Configure the Webhook:**

1. Go to **WhatsApp → Configuration → Webhook**.
2. Set **Callback URL** to `https://yourdomain.com/api/webhooks/whatsapp`.
   > Use `ngrok http 3001` for local development to get a public HTTPS URL.
3. Set **Verify Token** to match `WHATSAPP_VERIFY_TOKEN` in `.env`.
4. Click **Verify and Save**.
5. Subscribe to fields: `messages` and `message_status`.

> The webhook URL must use HTTPS. Self-signed certificates are not accepted by Meta.

---

### 7.3 WhatsApp Message Templates

Templates are required for proactive outbound messages sent more than 24 hours after the customer last messaged you. Without templates, the Meta API will reject those sends with error `131047`.

**Register these 5 templates in Meta Business Manager:**

Go to [business.facebook.com](https://business.facebook.com) → **WhatsApp Manager → Message Templates → Create Template**.

| Template Name | Category | Variables | Example body |
|---|---|---|---|
| `sn_property_followup` | UTILITY | `{{1}}` = name, `{{2}}` = count | "Hi {{1}}, we found {{2}} properties for you." |
| `sn_seller_approved` | UTILITY | `{{1}}` = name, `{{2}}` = property title | "Hi {{1}}, your property '{{2}}' is now listed!" |
| `sn_seller_rejected` | UTILITY | `{{1}}` = name, `{{2}}` = reason | "Hi {{1}}, we cannot list your property. Reason: {{2}}" |
| `sn_visit_confirmation` | UTILITY | `{{1}}` = name, `{{2}}` = date, `{{3}}` = time | "Hi {{1}}, visit confirmed for {{2}} at {{3}}." |
| `sn_new_match_alert` | MARKETING | `{{1}}` = name, `{{2}}` = URL | "Hi {{1}}, a new matching property: {{2}}" |

> Template approval takes 24–48 hours. Do not use in production code until status shows **Approved**.

> After approval, verify the names in `server/templateService.ts` under `WaTemplate` match exactly what Meta approved.

---

### 7.4 Google Gemini API

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Click **Create API Key** and select your Google Cloud project.
3. Set `GEMINI_API_KEY` in `.env`.
4. In [Google Cloud Console](https://console.cloud.google.com), ensure the **Generative Language API** is enabled for your project.

The system uses the `gemini-2.0-flash` model for structured JSON extraction from conversational messages.

---

### 7.5 SendGrid Email (Optional)

Used for email alerts to the owner when a new lead arrives or a job permanently fails.

1. Create an account at [sendgrid.com](https://sendgrid.com).
2. Go to **Settings → API Keys → Create API Key** (Full Access).
3. Set `SENDGRID_API_KEY` in `.env`.
4. Verify the sender domain/email in SendGrid's dashboard.

> If `SENDGRID_API_KEY` is not set, email notifications are silently skipped — everything else still works.

---

### 7.6 Firebase Firestore TTL Policy

The `crm_outbound_idempotency` collection stores short-lived deduplication keys. Enable Firestore's TTL policy to auto-delete expired documents:

1. Go to Firebase Console → **Firestore → Indexes → Single field → Add exemption**.
2. Collection: `crm_outbound_idempotency`, Field: `expires_at`, enable **TTL policy**.
3. Save.

> Firestore deletes TTL-expired documents within 24–72 hours. Without this, the collection grows indefinitely (documents are ~200 bytes each — low impact, but worth configuring).

---

### 7.7 Firestore Scheduled Export (Backup)

Firestore does not auto-backup. Set up a daily export:

1. In Google Cloud Console, enable the **Cloud Firestore API** and **Cloud Scheduler**.
2. Create a Cloud Storage bucket: `gs://sn-homes-firestore-backups`.
3. Create a Cloud Scheduler job:
   - **Schedule:** `0 2 * * *` (2 AM IST daily)
   - **Target type:** HTTP
   - **URL:** `https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default):exportDocuments`
   - **Auth:** OIDC Token (service account with `roles/datastore.importExportAdmin`)
   - **Body:** `{ "outputUriPrefix": "gs://sn-homes-firestore-backups" }`

> Retain at least 30 days of exports. Also consider enabling **Point-in-time recovery (PITR)** in the Firebase console (Firestore → Settings → Point-in-time recovery) for a 7-day rolling recovery window.

---

## 8. Running Locally

**Prerequisites:** Node.js 18+, npm 9+

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in all required values in .env

# 3. Start the backend (Express + job worker)
npm run server

# 4. Start the frontend (Vite dev server)
npm run dev

# 5. For local webhook testing — expose the backend publicly
npx ngrok http 3001
# Use the printed HTTPS URL as the webhook callback URL in Meta console
```

Both servers must run simultaneously. The frontend (port 5173) proxies `/api` requests to the backend (port 3001) via the Vite proxy config.

In production, use `pm2` to manage the backend process and `nginx` as a reverse proxy.

---

## 9. Running Tests

```bash
# Run all 37 tests once
npm test

# Watch mode (re-runs on file change during development)
npm run test:watch

# Generate a coverage report
npm run test:coverage
```

All tests use Firestore mocks — no live credentials are needed.

| Test file | What is tested |
|---|---|
| `tests/unit/conversationEngine.test.ts` | Opt-out keyword detection, human-agent keyword detection, INR formatting, INR text parsing, outbound idempotency key stability |
| `tests/unit/apiRoutes.test.ts` | Single-record buyer/seller/property lookups, signed upload URL, inbound webhook payload parsing, delivery status event detection, job worker backoff formula, property status transitions |

---

## 10. API Reference

All endpoints are prefixed `/api/v1/`. The health check is at `/api/health`.

### Conversations

| Method | Path | Description |
|---|---|---|
| GET | `/conversations` | List all (filter: `?status=`, `?paused=`) |
| GET | `/conversations/:id` | Single conversation + last 50 messages |
| POST | `/conversations/:id/send` | Send a manual message from the dashboard |
| PATCH | `/conversations/:id` | Update `automation_paused`, notes, etc. |

### Buyer Requests

| Method | Path | Description |
|---|---|---|
| GET | `/buyer-requests` | List all buyer requests |
| GET | `/buyer-requests/:id` | Single request + matched properties |
| POST | `/buyer-requests/:id/matches` | Admin-triggered property re-match |
| PATCH | `/buyer-requests/:id` | Update status or notes |

### Seller Submissions

| Method | Path | Description |
|---|---|---|
| GET | `/seller-submissions` | List all submissions |
| GET | `/seller-submissions/:id` | Single submission |
| POST | `/seller-submissions/:id/approve` | Approve and create draft listing |
| POST | `/seller-submissions/:id/reject` | Reject with reason |
| POST | `/seller-submissions/:id/publish` | Publish approved listing to website |
| PATCH | `/seller-submissions/:id` | Update review notes |

### Properties

| Method | Path | Description |
|---|---|---|
| GET | `/properties` | List (filter: `?status=`) |
| GET | `/properties/:id` | Single property |
| POST | `/properties` | Create listing (`title`, `propertyType` required) |
| PATCH | `/properties/:id` | Update fields / change status |

### Follow-ups, Misc

| Method | Path | Description |
|---|---|---|
| GET | `/follow-ups` | List tasks (filter: `?status=`, `?overdue=true`) |
| POST | `/follow-ups` | Create manual task |
| PATCH | `/follow-ups/:id` | Mark complete / update notes |
| GET | `/dashboard/summary` | Aggregated stats for overview page |
| GET | `/customers` | List all customers |
| GET | `/audit-logs` | Audit trail (filter: `?entity=`) |
| POST | `/media/upload-url` | Get signed GCS URL for browser upload |
| GET | `/api/health` | Service health (WA/AI/Firebase status) |

---

## 11. Firestore Collections Reference

| Collection | Purpose |
|---|---|
| `crm_customers` | One document per unique WhatsApp phone number |
| `crm_conversations` | Workflow state per customer — intent, paused flag, language, accumulated buyer/seller data |
| `crm_messages` | Every inbound and outbound message; outbound includes `provider_message_id` (wamid) and `provider_status` |
| `crm_webhook_events` | Raw provider message IDs for inbound deduplication |
| `crm_buyer_requests` | Structured buyer requirements, saved when all required fields are collected |
| `crm_seller_submissions` | Seller property listings pending owner review |
| `crm_property_matches` | Record of which properties were sent to which buyer |
| `crm_follow_up_tasks` | Scheduled owner follow-up tasks |
| `crm_notifications` | Owner alerts — new leads, job failures, human agent requests |
| `crm_audit_logs` | Immutable audit trail of all admin and system actions |
| `crm_job_queue` | Durable message processing jobs with status tracking |
| `crm_outbound_idempotency` | Short-lived keys (1h TTL) preventing duplicate outbound sends |
| `crm_template_messages` | Log of all WhatsApp template messages sent |
| `properties` | Main listing collection shared with the public-facing website |

---

## 12. Production Checklist

### Infrastructure
- [ ] Server behind HTTPS reverse proxy (nginx / Cloud Run)
- [ ] `pm2` managing the backend process (`pm2 start`, `pm2 startup`)
- [ ] Environment variables set in the server environment (not relying on `.env`)

### Meta / WhatsApp
- [ ] Production business phone number added and verified
- [ ] Permanent System User access token generated (not the temporary sandbox token)
- [ ] Webhook registered with correct verify token and HTTPS URL
- [ ] Webhook subscribed to `messages` AND `message_status` fields
- [ ] All 5 message templates registered and showing **Approved** status
- [ ] Meta Business Account verified (required for sending to > 250 unique users/day)

### Firebase
- [ ] Firestore security rules deployed (`firebase deploy --only firestore:rules`)
- [ ] Storage rules applied (seller submission photos are private)
- [ ] TTL policy enabled on `crm_outbound_idempotency.expires_at`
- [ ] Daily Firestore export scheduled to Cloud Storage
- [ ] At least one admin user created in Firebase Authentication

### Monitoring
- [ ] Server logs forwarded to Cloud Logging, Datadog, or Papertrail
- [ ] `OWNER_WHATSAPP_PHONE` set — the owner receives instant WhatsApp alerts for dead-letter jobs and human agent requests
- [ ] Dashboard `crm_notifications` checked regularly

### Go-Live Testing
- [ ] Send a test WhatsApp message and verify the full buyer flow completes
- [ ] Test opt-out with "STOP" and re-subscribe with "START"
- [ ] Test "talk to agent" — verify the bot pauses and the owner is notified
- [ ] Test a seller photo submission end-to-end through approval
- [ ] Confirm delivery receipts appear in `crm_messages.provider_status`
- [ ] Run `npm test` — all 37 tests pass

---

## 13. Troubleshooting

### "Webhook verification failed"
- `WHATSAPP_VERIFY_TOKEN` in `.env` must exactly match the token entered in the Meta console.
- The server must be publicly reachable via HTTPS at the moment you click "Verify and Save".

### "HMAC validation failed — ignoring message"
- `META_APP_SECRET` is wrong. In development, delete `META_APP_SECRET` from `.env` to skip HMAC checking.

### "Missing credentials, skipping send"
- `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` is empty or not loaded. Restart the server after editing `.env`.

### AI extraction returns null / fallback reply sent
- `GEMINI_API_KEY` is invalid or the Generative Language API is not enabled in Google Cloud Console.
- Check server logs for `[Gemini error]` messages.

### Firebase permission denied errors
- The service account key JSON is for the wrong project, or is malformed.
- Firestore security rules are too restrictive. Check the rules file and re-deploy.

### Jobs stuck in "locked" state
- The worker automatically resets locks older than 60 seconds on every poll cycle.
- After a server crash, stuck jobs are recovered within 60 seconds of the server restarting.

### Outbound message fails with error 131047
- The customer's 24-hour service window has closed. You must use a template message.
- Use `smartSend()` or `sendTemplateMessage()` from `server/templateService.ts`.

### Outbound message fails with error 132001
- The template name does not exist or has not been approved yet.
- Check [business.facebook.com -> WhatsApp Manager -> Message Templates](https://business.facebook.com/wa/manage/message-templates/).

### Duplicate messages sent to customer
- The idempotency guard uses a 10-minute time slot. If the same message is sent to the same recipient twice more than 10 minutes apart, it will go through (this is expected).
- If duplicates occur within 10 minutes, the `crm_outbound_idempotency` collection may not have the Firestore TTL policy enabled — check section 7.6.

---

*Documentation generated: October 2025 | S&N Homes CRM v1.0*
