# AI-Powered WhatsApp Real Estate CRM

## Requirements, Architecture, Workflows, APIs, and Deployment Plan

**Project type:** Single-agency real estate CRM with WhatsApp
automation\
**Primary goal:** Capture buyer requirements and seller property
submissions through WhatsApp, match buyers with properties on the
existing website, and let the agency owner manage the complete workflow
from one dashboard.\
**Preferred approach:** Reuse the existing website and property database
wherever practical; build only the missing CRM and automation
capabilities.

------------------------------------------------------------------------

## 1. Executive Summary

Build a system that connects four parts:

1.  **WhatsApp Business Platform:** the customer-facing conversation
    channel.
2.  **AI conversation engine:** understands customer intent and extracts
    structured requirements from natural-language messages.
3.  **Real estate data and CRM:** stores buyer requests, seller
    submissions, conversations, messages, property matches, and
    follow-up tasks.
4.  **Owner dashboard:** a single private interface to manage leads,
    property listings, conversations, approvals, matching, and
    follow-ups.

The existing website's property inventory must remain the source of
truth. The WhatsApp bot should query the same inventory that the website
uses, rather than maintaining a separate copy of listings.

The first release is for **one agency**, with one owner account (and
optional staff accounts later). Avoid multi-tenant SaaS complexity until
the agency's workflow is proven.

## 2. Goals and Scope

### 2.1 Core goals

-   Detect whether an incoming customer is looking to buy, sell, rent,
    or ask a general question.
-   Ask relevant follow-up questions over multiple WhatsApp messages.
-   Remember collected answers and ask only for missing information.
-   Accept corrections and information in any order.
-   Save buyer requirements as structured buyer requests.
-   Search the agency's existing published property inventory.
-   Send relevant property links through WhatsApp.
-   Save seller submissions and photos for review.
-   Require owner approval before a submitted property is published.
-   Provide one dashboard for conversations, buyer leads, seller leads,
    listings, matches, and follow-ups.
-   Make message handling reliable, secure, and observable.

### 2.2 Out of scope for the first release

-   Multi-agency / multi-tenant SaaS.
-   Automated property valuation or legal verification.
-   Automatic public publication of unreviewed seller submissions.
-   Payments, commissions, or deal-closing workflows.
-   Complex AI agents with unrestricted database access.
-   Separate mobile applications.
-   Guaranteed zero-cost production operation.

## 3. Users and Permissions

### Customer

-   Sends messages to the agency's WhatsApp business number.
-   Shares requirements or property details.
-   Receives matching property links and relevant follow-up questions.
-   Can request a human agent or opt out of automated messaging.

### Agency owner / administrator

-   Views all leads and conversations.
-   Replies manually and pauses/resumes bot automation.
-   Reviews and approves seller submissions.
-   Creates, edits, publishes, archives, and updates property listings.
-   Assigns lead statuses and follow-up tasks.
-   Views operational analytics and message delivery failures.

### Optional staff user

-   Can be introduced later with permissions to assigned leads,
    conversations, and tasks.
-   Must not receive unrestricted access to sensitive records unless
    authorized.

------------------------------------------------------------------------

## 4. Recommended Architecture

### 4.1 Logical architecture

``` text
Customer on WhatsApp
        |
        v
WhatsApp Business Platform / Cloud API
        |
        v
Webhook endpoint
  - verify request
  - deduplicate event
  - persist event
  - acknowledge quickly
        |
        v
Message processing worker / job queue
        |
        v
Conversation workflow engine
  - load conversation state
  - classify intent
  - extract structured fields
  - validate fields
  - determine next action
        |
        +---------------------------+
        |                           |
        v                           v
Buyer service                 Seller service
- search inventory            - collect property details
- rank matches                - collect photos
- create match records        - create pending submission
- send property URLs          - notify owner for review
        |                           |
        +-------------+-------------+
                      |
                      v
             Shared CRM database
                      |
          +-----------+------------+
          |                        |
          v                        v
 Existing property website    Owner dashboard
 - canonical listings         - inbox
 - public search pages        - buyer requests
 - published properties       - seller submissions
                              - properties
                              - follow-ups
                              - analytics
```

### 4.2 Preferred technology stack

  -----------------------------------------------------------------------
  Layer                   Recommended choice      Notes
  ----------------------- ----------------------- -----------------------
  Web UI                  Existing website        Avoid rewriting a
                          framework; Next.js if   working website without
                          building/rebuilding     a reason.

  Backend/API             TypeScript with Next.js Use a modular monolith
                          Route Handlers or       initially.
                          existing backend        

  CRM database            Existing PostgreSQL if  Avoid unnecessary
                          suitable; otherwise     migration.
                          Supabase PostgreSQL     

  Authentication          Existing auth or        Owner-only dashboard at
                          Supabase Auth           launch.

  Messaging               Official WhatsApp       Avoid unofficial
                          Business Platform Cloud WhatsApp Web automation
                          API                     libraries for
                                                  production.

  AI                      Gemini API or another   Verify current quotas,
                          suitable LLM behind a   terms, and data
                          provider adapter        handling.

  Validation              Zod or equivalent       Never trust model
                          schema validation       output without
                                                  validation.

  File storage            Existing image storage  Store object paths and
                          or private object       metadata in the
                          storage / Supabase      database.
                          Storage                 

  Jobs                    PostgreSQL-backed job   Durable retries are
                          table initially, or     required.
                          managed queue           

  Hosting                 Existing                Confirm commercial-use
                          commercial-capable      terms and execution
                          host, existing VPS, or  limits.
                          a compatible            
                          alternative             

  Monitoring              Structured logs and     Add delivery and
                          basic error alerts      worker-failure
                                                  monitoring before
                                                  launch.
  -----------------------------------------------------------------------

**Important hosting note:** verify the current terms of any free hosting
plan. For example, Vercel Hobby has personal/non-commercial
restrictions; do not assume it is appropriate for a commercial agency
deployment. A free tier may be suitable for development or a prototype
but not necessarily production.

### 4.3 Existing website integration decision

Before implementation, identify: - Framework and runtime. - Database
engine and schema. - How published properties and canonical URLs are
represented. - Current admin authentication and listing approval
logic. - Image storage provider and access model. - Whether the existing
website exposes a secure internal API.

Then choose one of these integration patterns:

1.  **Same application and database:** best if the current application
    is maintainable and supports the CRM.
2.  **Separate CRM application using a secure property API:** useful if
    the existing website uses a different framework or deployment.
3.  **Controlled synchronization:** only if direct access or an API is
    unavailable. Define which system owns each field and how changes are
    reconciled.

Do not copy the property inventory into a second database unless there
is a clear operational reason. If the existing database is
MySQL/WordPress, do not migrate to PostgreSQL solely to use Supabase;
integrate through a secure backend adapter or API.

Create a repository abstraction such as:

``` ts
export interface PropertyRepository {
  findById(id: string): Promise<Property | null>;
  search(criteria: PropertySearchCriteria): Promise<Property[]>;
  createDraft(input: CreatePropertyInput): Promise<Property>;
}
```

Implement the adapter against the actual existing database or API.

------------------------------------------------------------------------

## 5. Functional Requirements

### 5.1 WhatsApp conversation handling

The system must: - Receive messages from the official WhatsApp
webhook. - Support text initially and images where required for seller
submissions. - associate messages with the correct customer using
normalized phone numbers. - Persist incoming and outgoing messages. -
Maintain a durable workflow state across multiple messages and server
restarts. - Handle customer corrections and messages that answer several
questions at once. - Avoid asking for information already provided. -
Support an explicit request for a human agent. - Pause bot responses
while a human is handling the conversation. - Track outgoing delivery
status where available. - Retry transient failures safely. - Respect
applicable WhatsApp customer-service windows, approved template
requirements, opt-outs, and platform policies.

### 5.2 Buyer workflow

Capture relevant fields, depending on the property type: - Property
type: house, apartment/flat, plot, commercial, or other. - Purchase or
rental intent. - Preferred locations and nearby areas. - Minimum/maximum
budget. - Bedroom count or other property-specific needs. - Land area /
built-up area if relevant. - Preferred amenities and non-negotiable
requirements. - Purchase timeline, if useful. - Customer name and
contact details. - Lead status, notes, and assigned owner/staff member.

When sufficient information is available: 1. Save or update the buyer
request. 2. Search published, available listings in the existing website
inventory. 3. Apply hard constraints first and rank remaining candidates
by preference fit. 4. Generate canonical URLs from trusted database
records. 5. Send a concise list of results through WhatsApp. 6. Record
which property links were sent. 7. Ask whether the customer wants
alternatives, a call, or a site visit. 8. Create a follow-up task if
appropriate.

If there are no exact matches, do not invent listings. Relax only
optional filters where sensible and ask whether the customer would like
to see alternatives.

### 5.3 Seller workflow

Capture, where applicable: - Property type. - Location / address or
locality. - Asking price, if known. - Land area and built-up area. -
Bedrooms, bathrooms, and other features. - Description and key selling
points. - Road access and relevant facilities. - Property photos. -
Seller name and contact information. - Permission to contact the seller
about the submission.

Workflow: 1. Detect sell intent. 2. Ask for missing required details in
a conversational manner. 3. Accept photos and text in separate messages.
4. Validate and save the submission as pending review. 5. Notify the
owner through the dashboard (and optionally a notification channel). 6.
Let the owner edit and approve the submission. 7. Create or update a
draft listing using the website's existing property service. 8. Publish
only after explicit owner approval. 9. Link the approved listing back to
the seller submission. 10. Notify the seller of the next step when
appropriate.

### 5.4 Owner dashboard

Required pages: - **Dashboard overview:** counts and summaries of buyer
leads, seller leads, active listings, conversations needing attention,
follow-ups due, and message failures. - **Inbox:** message history,
customer details, current intent, workflow status, manual reply,
pause/resume automation. - **Buyer requests:** search, filters, status,
budget, locations, property matches, sent links, notes, and follow-up. -
**Seller submissions:** property details, images, review status, edit,
approve, reject, and convert to listing. - **Properties:** create/edit
drafts, publish, mark unavailable, archive, and view associated leads. -
**Follow-ups:** due dates, callbacks, site visits, task status, and
notes. - **Settings:** WhatsApp connection status, AI provider
configuration, default questions, workflow rules, and notification
preferences. - **Audit / operational logs:** important owner actions and
processing errors.

Suggested lead statuses: - `new` - `contacted` -
`requirements_collected` - `matching` - `visit_scheduled` -
`negotiation` - `won` - `lost` - `on_hold`

Suggested seller review statuses: - `incomplete` - `pending_review` -
`needs_more_information` - `approved` - `rejected` -
`converted_to_listing`

### 5.5 General enquiry and handover

The bot should handle greetings and general questions safely. If it
cannot answer confidently, the customer requests an agent, or the query
involves negotiation or sensitive details, it should hand the
conversation to the owner rather than fabricate an answer.

------------------------------------------------------------------------

## 6. AI Design and Conversation State

### 6.1 Core principle

Use a **stateful workflow engine with AI-assisted extraction**, not a
free-form LLM that independently decides what database operations to
execute.

The model may classify intent, extract fields, identify ambiguity, and
draft a reply. Application code validates fields, chooses the next
workflow action, runs database queries, and controls publication and
messaging.

### 6.2 Example buyer state

``` json
{
  "intent": "buy",
  "workflow_status": "collecting_requirements",
  "requirements": {
    "property_type": "house",
    "locations": ["Pala"],
    "budget_max": 7000000,
    "bedrooms_min": 3
  },
  "missing_fields": ["timeline"]
}
```

This is illustrative. Store normalized values in dedicated columns where
appropriate; JSONB may be used for flexible metadata, not as a
substitute for a well-designed schema.

### 6.3 Message-processing pipeline

1.  Receive and verify the webhook.
2.  Deduplicate the provider event/message ID.
3.  Persist the inbound event and message.
4.  Load the customer, conversation, current state, and automation-pause
    flag.
5.  If human takeover is active, do not send an automated response;
    leave the message visible to the agent.
6.  Call the AI adapter for intent/field extraction where necessary.
7.  Validate output with a strict schema.
8.  Apply valid corrections and persist the updated request and
    conversation state.
9.  Determine the next action:
    -   ask a clarifying question;
    -   ask for missing details;
    -   search properties;
    -   create/update seller submission;
    -   escalate to the owner.
10. Create an outbound message/job with an idempotency key.
11. Send through WhatsApp and update status.
12. Log failures and retry transient errors with backoff.

### 6.4 AI safety rules

-   Do not let the LLM execute arbitrary SQL or use unrestricted
    database credentials.
-   Do not trust model-generated prices, property IDs, availability,
    addresses, or URLs.
-   Only send property details retrieved from the existing inventory.
-   Validate and normalize currency, location, area units, and property
    types.
-   Ask clarification when a value is ambiguous.
-   Support corrections, such as a revised budget.
-   Do not publish a property based solely on AI interpretation.
-   Never expose one customer's request to another customer.
-   Review the AI provider's data handling and retention terms before
    sending real customer conversations.

### 6.5 Property matching

Use deterministic database filtering for hard constraints, then
optionally rank candidates for soft preferences.

Example SQL for a PostgreSQL inventory (adjust table/column names to
match the real website schema):

``` sql
SELECT id, title, price, location, bedrooms, slug
FROM properties
WHERE status = 'published'
  AND property_type = 'house'
  AND price <= 7000000
  AND bedrooms >= 3
  AND location ILIKE '%Pala%'
ORDER BY price ASC
LIMIT 5;
```

This query is a starting example, not a universal schema. For
production, prefer normalized location IDs or geospatial matching
instead of `ILIKE` if nearby areas need to be supported. Ensure `price`
uses the same unit as the supplied budget.

Create canonical property URLs using the website's trusted URL builder.
Never allow the LLM to construct arbitrary links.

------------------------------------------------------------------------

## 7. Database Schema

The following is a logical schema. Adapt IDs, columns, and relationships
to the existing website database before writing migrations.

### 7.1 Core tables

  -----------------------------------------------------------------------
  Table                               Purpose / important fields
  ----------------------------------- -----------------------------------
  `customers`                         `id`, `name`, `phone_e164`
                                      (unique), `whatsapp_opt_in_at`,
                                      `created_at`, `updated_at`

  `conversations`                     `id`, `customer_id`, `intent`,
                                      `workflow_status`,
                                      `automation_paused`, `assigned_to`,
                                      `last_message_at`, `created_at`

  `messages`                          `id`, `conversation_id`,
                                      `provider_message_id` (unique when
                                      present), `direction`,
                                      `message_type`, `body`,
                                      `provider_status`, `created_at`

  `buyer_requests`                    `id`, `customer_id`,
                                      `conversation_id`, `property_type`,
                                      `location_preferences`,
                                      `budget_min`, `budget_max`,
                                      `bedrooms_min`, `purpose`,
                                      `timeline`, `requirements_json`,
                                      `status`, `created_at`,
                                      `updated_at`

  `seller_submissions`                `id`, `customer_id`,
                                      `conversation_id`, `property_type`,
                                      `location`, `land_area`,
                                      `built_up_area`, `bedrooms`,
                                      `asking_price`, `description`,
                                      `approval_status`, `reviewed_by`,
                                      `reviewed_at`, `property_id`,
                                      `created_at`, `updated_at`

  `seller_submission_images`          `id`, `submission_id`,
                                      `storage_path`, `mime_type`,
                                      `size_bytes`, `sort_order`,
                                      `created_at`

  `property_matches`                  `id`, `buyer_request_id`,
                                      `property_id`, `match_score`,
                                      `match_reason`, `sent_at`,
                                      `feedback`, `created_at`

  `follow_up_tasks`                   `id`, `customer_id`,
                                      `buyer_request_id`,
                                      `seller_submission_id`,
                                      `assigned_to`, `due_at`,
                                      `task_type`, `status`, `notes`,
                                      `created_at`

  `webhook_events`                    `id`, `provider_event_id` (unique
                                      where stable), `received_at`,
                                      `processed_at`, `status`,
                                      `retry_count`, `last_error`

  `job_queue`                         `id`, `job_type`, `payload`,
                                      `status`, `attempts`,
                                      `available_at`, `locked_at`,
                                      `completed_at`, `last_error`

  `audit_logs`                        `id`, `actor_id`, `action`,
                                      `entity_type`, `entity_id`,
                                      `metadata`, `created_at`
  -----------------------------------------------------------------------

The existing `properties` table remains authoritative for listings.
`property_id` in CRM tables should use the existing property ID type.

### 7.2 Relationships

-   One customer can have many conversations.
-   One conversation can have many messages.
-   One customer can have multiple buyer requests and seller
    submissions.
-   One buyer request can match many properties.
-   One property can match many buyer requests.
-   One seller submission may link to a resulting property listing after
    approval.
-   Follow-up tasks may relate to a customer, buyer request, seller
    submission, or more than one of these as the business rules require.

### 7.3 Data conventions and constraints

-   Use UUIDs for new CRM entities unless the existing system has a
    consistent ID strategy.
-   Normalize phone numbers to E.164 format and enforce uniqueness.
-   Choose a single money convention: `NUMERIC(14,2)` in rupees is
    readable; alternatively use integer paise. Do not mix units.
-   Use enums or `CHECK` constraints for status values.
-   Add indexes on customer phone, conversation status, message
    timestamps, buyer status, seller review status, follow-up due dates,
    and foreign keys.
-   Add unique constraints for provider message/event IDs to support
    idempotency.
-   Store file paths and metadata in the database, not raw image
    binaries.
-   Keep public listing fields separate from private lead and seller
    information.
-   Use transactions for multi-table updates that must succeed together.

### 7.4 Database security

-   Owner dashboard routes must require authentication.
-   Enforce authorization server-side for every mutation.
-   If using Supabase client-side access, enable and test Row Level
    Security (RLS).
-   Keep service-role keys and provider tokens server-side only.
-   Never expose buyer requests, seller submissions, phone numbers, or
    private images through public website queries.
-   Log important approval, publication, and manual data changes.

------------------------------------------------------------------------

## 8. API Endpoints

Use `/api/v1` for application endpoints. The WhatsApp webhook has a
provider-configured path.

### 8.1 Webhook and conversation APIs

  --------------------------------------------------------------------------------------
  Method                  Endpoint                               Purpose
  ----------------------- -------------------------------------- -----------------------
  `GET`                   `/api/webhooks/whatsapp`               Complete Meta webhook
                                                                 verification challenge

  `POST`                  `/api/webhooks/whatsapp`               Receive messages and
                                                                 delivery/status events

  `GET`                   `/api/v1/conversations`                List and filter
                                                                 conversations

  `GET`                   `/api/v1/conversations/:id/messages`   Fetch conversation
                                                                 history

  `POST`                  `/api/v1/conversations/:id/reply`      Send a manual agent
                                                                 reply

  `POST`                  `/api/v1/conversations/:id/pause`      Pause bot replies for
                                                                 human takeover

  `POST`                  `/api/v1/conversations/:id/resume`     Resume automation after
                                                                 agent handover
  --------------------------------------------------------------------------------------

### 8.2 Buyer APIs

  ------------------------------------------------------------------------------------------
  Method                  Endpoint                               Purpose
  ----------------------- -------------------------------------- ---------------------------
  `GET`                   `/api/v1/buyer-requests`               List/filter buyer leads

  `GET`                   `/api/v1/buyer-requests/:id`           View buyer request and
                                                                 activity

  `PATCH`                 `/api/v1/buyer-requests/:id`           Update
                                                                 requirements/status/notes

  `POST`                  `/api/v1/buyer-requests/:id/matches`   Find and save matching
                                                                 properties

  `GET`                   `/api/v1/buyer-requests/:id/matches`   View matches and send
                                                                 history
  ------------------------------------------------------------------------------------------

### 8.3 Seller APIs

  ------------------------------------------------------------------------------------------
  Method                  Endpoint                                   Purpose
  ----------------------- ------------------------------------------ -----------------------
  `GET`                   `/api/v1/seller-submissions`               List/filter seller
                                                                     leads

  `GET`                   `/api/v1/seller-submissions/:id`           View seller submission

  `PATCH`                 `/api/v1/seller-submissions/:id`           Edit submission or
                                                                     review status

  `POST`                  `/api/v1/seller-submissions/:id/approve`   Approve and
                                                                     create/update a draft
                                                                     listing

  `POST`                  `/api/v1/seller-submissions/:id/reject`    Reject with reason

  `POST`                  `/api/v1/seller-submissions/:id/publish`   Publish through the
                                                                     existing listing
                                                                     service after approval
  ------------------------------------------------------------------------------------------

### 8.4 Property, task, and dashboard APIs

  -----------------------------------------------------------------------------
  Method                  Endpoint                      Purpose
  ----------------------- ----------------------------- -----------------------
  `GET`                   `/api/v1/properties`          Search existing
                                                        property inventory

  `GET`                   `/api/v1/properties/:id`      Fetch property details

  `POST`                  `/api/v1/properties`          Create an
                                                        owner-authorized draft,
                                                        if supported

  `PATCH`                 `/api/v1/properties/:id`      Update listing

  `GET`                   `/api/v1/follow-ups`          Retrieve due/upcoming
                                                        tasks

  `POST`                  `/api/v1/follow-ups`          Create follow-up task

  `PATCH`                 `/api/v1/follow-ups/:id`      Update task
                                                        status/details

  `GET`                   `/api/v1/dashboard/summary`   Retrieve dashboard
                                                        metrics

  `POST`                  `/api/v1/media/upload-url`    Generate a restricted
                                                        signed upload URL
  -----------------------------------------------------------------------------

All dashboard APIs must enforce authentication and authorization. Public
property search should return only published listings and safe public
fields.

### 8.5 Webhook reliability requirements

-   Validate Meta's webhook signature on incoming POST events using the
    app secret.
-   Use the GET verification challenge during setup.
-   Persist event/message IDs and deduplicate repeated events.
-   Acknowledge webhook requests promptly; do not wait for a long AI
    call before responding.
-   Process work through a durable job table or managed queue.
-   Retry transient errors with exponential backoff and a maximum
    attempt count.
-   Track outbound message IDs and delivery events.
-   Make outbound jobs idempotent where possible.
-   Surface persistent failures in the dashboard.

For images, download media through the official WhatsApp media API,
validate file type/size, upload to private object storage, and store the
object path. Do not expose private media until approved.

------------------------------------------------------------------------

## 9. Repository Structure

For a new Next.js implementation:

``` text
real-estate-crm/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   └── properties/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── inbox/
│   │   │   ├── buyer-requests/
│   │   │   ├── seller-leads/
│   │   │   ├── properties/
│   │   │   ├── follow-ups/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── webhooks/whatsapp/route.ts
│   │       └── v1/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── inbox/
│   │   ├── properties/
│   │   └── forms/
│   ├── lib/
│   │   ├── db/
│   │   ├── auth/
│   │   ├── whatsapp/
│   │   ├── ai/
│   │   ├── workflows/
│   │   ├── property-matching/
│   │   ├── storage/
│   │   └── validation/
│   └── types/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── workers/
│   └── message-worker/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── webhook-fixtures/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

If the existing site is already a suitable Next.js application, add
these modules to its existing repository. If it uses another framework,
retain it and expose a secure property API or repository adapter rather
than rebuilding the public website unnecessarily.

### Environment variable template

``` dotenv
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=
META_APP_SECRET=

GEMINI_API_KEY=
APP_BASE_URL=
```

Use only variables required by the selected architecture. Never commit
actual secrets or expose privileged keys to browser code. Store
production secrets in the hosting provider's secret manager and rotate
them if exposed.

------------------------------------------------------------------------

## 10. Dashboard Requirements

### Overview page

-   New buyer requests.
-   New seller submissions awaiting review.
-   Active/published property count.
-   Conversations needing attention.
-   Follow-ups due today.
-   Message or worker failures.

### Inbox

-   Customer profile and WhatsApp number.
-   Conversation history and timestamps.
-   Current intent and workflow state.
-   Buyer/seller request summary.
-   Manual reply box.
-   Pause/resume automation.
-   Assignment, notes, and escalation.

### Buyer requests

-   Filters by status, location, budget, property type, and date.
-   Detailed requirements and missing fields.
-   Matched properties and match rationale.
-   Property links already sent.
-   Follow-up history and next action.
-   Mark as qualified, visit scheduled, won, lost, or on hold.

### Seller submissions

-   Seller contact information.
-   Property details and photos.
-   Missing information indicators.
-   Approve, request more details, or reject.
-   Convert approved submission to a draft listing.
-   Link to the resulting property record.

### Property management

-   Existing listing search.
-   Create/edit draft.
-   Publish/unpublish/archive.
-   Mark unavailable or sold/rented.
-   View buyer requests matched to a property.
-   Ensure the website and bot use the same listing status.

### Follow-ups

-   Callbacks and site visits.
-   Due dates and assigned staff.
-   Completion status and notes.
-   Reminder notifications, if configured.

------------------------------------------------------------------------

## 11. Deployment Plan

### Phase 1: Discovery and integration design

1.  Inspect the existing website framework and database.
2.  Map the existing property schema and canonical URL generation.
3.  Identify authentication, admin roles, image storage, and listing
    statuses.
4.  Decide whether CRM tables belong in the current database or a
    separate PostgreSQL database.
5.  Define a `PropertyRepository` adapter and test it against the real
    inventory.

**Deliverable:** documented integration plan and data mapping.

### Phase 2: Database and dashboard foundation

1.  Add migrations for CRM tables.
2.  Add indexes, foreign keys, constraints, and access policies.
3.  Implement owner authentication.
4.  Build buyer requests, seller submissions, and property-management
    pages.
5.  Add test data and verify access boundaries.

**Deliverable:** functioning CRM without live WhatsApp automation.

### Phase 3: WhatsApp integration

1.  Create/configure the Meta developer app and WhatsApp product.
2.  Register the new business number and complete required setup.
3.  Configure webhook verification and message/status subscriptions.
4.  Implement inbound event persistence and deduplication.
5.  Implement outbound messaging and status tracking.
6.  Test using Meta's test environment before production activation.

**Deliverable:** reliable inbound/outbound messaging with a
deterministic, non-AI test flow.

### Phase 4: Conversation engine

1.  Implement intent classification and field extraction.
2.  Validate AI output with schemas.
3.  Persist conversation state and corrections.
4.  Implement missing-field prompts.
5.  Add human takeover and safe escalation.
6.  Test English, Malayalam, and mixed-language messages that reflect
    actual customer usage.

**Deliverable:** stateful buyer/seller conversation flows.

### Phase 5: Property matching and seller approvals

1.  Implement deterministic inventory filtering.
2.  Add ranking for soft preferences.
3.  Generate canonical property URLs from trusted records.
4.  Record sent matches.
5.  Process seller photos safely.
6.  Implement review, approval, draft creation, and publication.

**Deliverable:** end-to-end buyer matching and seller listing workflows.

### Phase 6: Production hardening

1.  Configure production hosting and secrets.
2.  Set up database backups and test restoration.
3.  Add worker retries, backoff, dead-letter/error handling, and alerts.
4.  Verify authorization, privacy, and rate limits.
5.  Test webhook retries and duplicate events.
6.  Review WhatsApp policies, consent, templates, and message costs.
7.  Train the owner on inbox and manual takeover.

**Deliverable:** production-ready single-agency CRM.

------------------------------------------------------------------------

## 12. Hosting and Recurring Costs

Actual costs depend on the current website stack, hosting plan, message
volume, model choice, and whether paid reliability features are needed.
Prices and free-tier terms can change, so verify them before deployment.

  -----------------------------------------------------------------------
  Component               Initial low-cost        Main caveat
                          approach                
  ----------------------- ----------------------- -----------------------
  Frontend and API        Reuse current hosting   Check commercial-use
                          or a suitable           rules and execution
                          free/low-cost tier      limits

  Database                Existing database or    Free projects can have
                          Supabase Free           inactivity and capacity
                                                  limits; production
                                                  backups may require
                                                  paid service

  AI API                  Eligible provider free  Quotas, model
                          tier during development availability, privacy
                                                  terms, and commercial
                                                  limits vary

  WhatsApp                Official Cloud API      Charges depend on
                                                  message category,
                                                  recipient market, and
                                                  current rate card

  Images                  Existing storage or     Capacity, egress,
                          free-tier object        access control, and
                          storage                 backup requirements

  Worker                  Existing VPS or         A durable worker must
                          supported managed job   actually run;
                          service                 serverless background
                                                  promises are not enough

  Domain                  Reuse existing          New domain may cost
                          domain/subdomain        extra

  Monitoring/backups      Free tools/manual       Paid monitoring and
                          backups for prototype   managed backups are
                                                  preferable for critical
                                                  production data
  -----------------------------------------------------------------------

### Practical budgeting guidance

-   **Prototype:** can often be built and tested for ₹0 using mocked
    messages and eligible free tiers.
-   **Low-volume production:** may have very low infrastructure cost if
    existing hosting/database are reused, but WhatsApp and AI usage can
    still be chargeable.
-   **Business-critical production:** budget for dependable hosting,
    backups, monitoring, and potentially paid database/AI plans. Do not
    assume that every free tier permits commercial use.

Before estimating monthly costs, calculate: - incoming enquiries per
month; - average incoming and outgoing messages per enquiry; - template
messages and follow-up campaigns; - expected AI tokens per
conversation; - image storage and monthly transfer; - whether the
existing host and database already have spare capacity.

Check the official WhatsApp pricing page and the selected AI provider's
current pricing before committing to a quote.

------------------------------------------------------------------------

## 13. Privacy, Security, and Reliability

Required safeguards: - Owner-only dashboard authentication and
server-side authorization. - Database RLS where applicable. - No
privileged database/API keys in client bundles. - Webhook signature
verification. - Idempotent message/event processing. - Rate limiting and
input validation. - Safe file type and size checks for uploaded
images. - Private storage for unapproved seller photos. - Explicit owner
approval before publication. - Audit records for approvals and material
changes. - Opt-out handling and appropriate consent for communication. -
Limited retention and access to personal customer data. - AI provider
data-use review before processing real customer conversations. -
Database backup and tested restore procedure. - Logs that exclude
secrets and avoid unnecessarily exposing sensitive message content.

Do not let the bot promise property availability, negotiate binding
terms, give legal assurances, or claim that a seller owns a property
unless the relevant facts have been verified.

------------------------------------------------------------------------

## 14. Testing and Acceptance Criteria

The first release is acceptable when all of the following work:

### Buyer tests

-   A customer can state type, location, budget, and bedrooms in one
    message.
-   The bot extracts all fields and avoids asking the same questions
    again.
-   A buyer can provide missing details over several messages.
-   A buyer can correct the budget or location later.
-   The system returns only real published property records and
    canonical links.
-   No-match cases are handled honestly and alternatives are offered
    appropriately.
-   Sent property links are recorded against the request.

### Seller tests

-   The bot collects seller details across multiple messages.
-   Photos are accepted, validated, and stored privately.
-   Incomplete submissions are flagged.
-   Submissions appear in the seller dashboard.
-   No submission is published without owner approval.
-   Approval creates/updates a draft through the existing property
    service.
-   Duplicate webhook events do not create duplicate submissions.

### Operational tests

-   Invalid webhook signatures are rejected.
-   Repeated webhooks are deduplicated.
-   Transient WhatsApp/API failures are retried safely.
-   Manual takeover pauses automated replies.
-   The bot can be resumed by the owner.
-   Unauthorized users cannot view private buyer/seller data.
-   Worker failures appear in logs or the dashboard.
-   Database backups can be restored.

------------------------------------------------------------------------

## 15. Recommended Build Order

Implement in this order:

1.  Existing website and database discovery.
2.  Property repository adapter.
3.  CRM schema and migrations.
4.  Owner authentication and dashboard.
5.  Buyer request and seller submission CRUD.
6.  WhatsApp webhook with mocked/deterministic responses.
7.  Durable message queue/worker and retries.
8.  AI extraction and conversation state.
9.  Buyer property matching and link delivery.
10. Seller photo collection and approval flow.
11. Manual takeover, follow-ups, and analytics.
12. Production security, backups, monitoring, and launch.

This order gives the agency useful CRM functionality before the AI and
WhatsApp integrations are fully complete.

## 16. Decisions to Confirm Before Coding

-   What framework and database does the existing website use?
-   Can the CRM access the existing property database directly, or must
    it use an API?
-   Does the website already have a listing approval workflow?
-   Is there an existing domain/subdomain and hosting plan?
-   Will only the owner log in initially, or will staff accounts be
    required?
-   Which languages should the bot support at launch?
-   Should rental enquiries be supported alongside buy/sell?
-   Which fields are mandatory for each property type?
-   How should the agent receive new-lead notifications?
-   What is the expected monthly conversation volume?

## Final Recommendation

Build a **single-agency modular monolith** with the existing website's
inventory as the source of truth, a durable WhatsApp webhook/worker
pipeline, a stateful AI-assisted workflow engine, and a private owner
dashboard.

Use free tiers for development where their terms allow it, but make
hosting, data retention, WhatsApp charges, and backup requirements
explicit before production. Prioritize reliable workflow state, verified
property data, approval gates, human takeover, and idempotent message
processing over adding more AI features.
