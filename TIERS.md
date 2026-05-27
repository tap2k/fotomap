# Fotomap — Tier-Based Pricing

## Tier Structure

| | Free | Starter $5/mo | Pro $20/mo | Enterprise |
|--|------|------------------|---------------|------------|
| **Storage** | 250MB | 5GB | 50GB | Custom |
| **Channels** | 5 | 25 | Unlimited | Unlimited |
| **Per-file limit** | 20MB | 100MB | 1GB | Custom |
| **Tileset picker** | Default only | Yes | Yes | Yes |
| **Custom marker colors** | No | Yes | Yes | Yes |
| **Custom marker icons** | No | Yes | Yes | Yes |
| **Map overlays** | No | Yes | Yes | Yes |
| **Collaboration** | View-only | Owner + editors | Owner + editors | Owner + editors |
| **Video generation** | No | No | Yes | Yes |
| **API access** | No | No | No | Yes |
| **Custom branding** | No | No | No | Yes |
| **Custom domains** | No | No | No | Yes |
| **SSO** | No | No | No | Yes |
| **Support** | Email | Email | Email (priority) | Email (SLA) |
| **Annual discount** | — | 20% ($4/mo) | 20% ($16/mo) | Custom |

---

## Enforcement Rules

### Soft Warning at 80%
- Banner/notification shown when storage usage reaches 80% of limit
- Upload and channel creation still allowed
- "Upgrade" link displayed

### Hard Block at 110%
- New uploads blocked
- New channel creation blocked
- Existing content remains fully accessible (read-only freeze)
- Persistent upgrade prompt

### Downgrade Behavior
- All existing content is preserved — nothing is deleted
- New uploads and channel creation blocked until usage is under the new limit
- Users can delete content themselves to get under the limit, or re-upgrade
- Over-limit banner shown with upgrade CTA
- *Note: Over-limit content on downgraded accounts is preserved indefinitely. If storage abuse becomes material, add a 90-day retention policy (content archived, not deleted, restorable on re-upgrade).*

---

## Feature Gating Details

### Storage
- Measured as total across all channels owned by the user (recursive, includes children)
- Includes: media files, audio files, overlays, asset bundles, channel pictures
- Enforcement checks the **channel owner's** plan, not the uploading user's (editors upload to someone else's channel)

### Channels
- Count of all channels where user is the owner
- Limit applies to creation only — existing channels are never removed on downgrade

### Per-file Limit
- Checked on each upload, both client-side (UX) and server-side (enforcement)
- Applies to all upload paths: authenticated, privateID, and public submission

### Tileset Picker
- Free users get the default tileset only (no dropdown in map view)
- Starter+ users see the tileset selection dropdown
- Server-side enforcement prevents tileset changes via API for Free users

### Custom Marker Colors
- Free users get default marker colors only (color dropdown hidden in tag editor)
- Starter+ users can set marker colors per tag
- Server-side enforcement strips markercolor changes from tag update requests for Free users
- Existing custom colors remain visible on downgrade — only editing is blocked

### Custom Marker Icons
- Free users cannot upload custom marker icons (thumbnail upload hidden in tag editor)
- Starter+ users can upload custom icon thumbnails per tag
- Server-side enforcement strips thumbnail uploads from tag update requests for Free users
- Existing custom icons remain visible on downgrade — only uploading new ones is blocked

### Map Overlays
- Free users cannot upload overlays (overlay button hidden in map view)
- Starter+ users see the overlay button and can upload/manage overlays
- Server-side enforcement blocks overlay upload requests for Free users
- Existing overlays remain visible on downgrade — only new uploads are blocked

### Collaboration
- Free: view-only access via public links (uniqueID)
- Starter+: can add editors to channels, full owner + editor permission model
- Server-side enforcement prevents adding editors for Free users

### Video Generation
- Boolean gate: Pro and Enterprise only
- Not metered — unlimited use within tier
- Fire-and-forget to external video service, no tracking
- Server-side enforcement via JWT check on makevideo API route

### API Access
- Enterprise only
- Implementation deferred

### SSO
- Enterprise only
- Implementation deferred — listed in pricing table only

---

## Billing

### Payment Provider
- Stripe (Checkout + Customer Portal + Webhooks)

### Pricing (in cents for Stripe)
| Plan | Monthly | Annual (per month) | Annual (total) |
|------|---------|-------------------|----------------|
| Free | 0 | 0 | 0 |
| Starter | 500 | 400 | 4800 |
| Pro | 2000 | 1600 | 19200 |
| Enterprise | Custom | Custom | Custom |

### Stripe Integration Points
- `POST /api/createCheckout` — creates Stripe checkout session for new subscriptions
- `POST /api/createPortal` — opens Stripe customer portal for billing management
- `POST /api/stripeWebhook` — handles Stripe events (subscription changes, payments, cancellations)

### Webhook Events Handled
- `checkout.session.completed` → activate plan
- `customer.subscription.updated` → update plan on change
- `customer.subscription.deleted` → downgrade to Free
- `invoice.payment_failed` → log warning

---

## Data Model

### User Schema (Strapi)
New fields added to `users-permissions` user:
- `plan` — enum: free/starter/pro/enterprise (default: "free")
- `stripeCustomerId` — string (private)
- `stripeSubscriptionId` — string (private)
- `billingInterval` — enum: monthly/annual (default: "monthly")
- `planOverrides` — JSON (Enterprise custom limits, e.g. `{"storageMB": 500000}`)

### Tier Config (Strapi)
Single source of truth at `strapi/config/tiers.js` — defines all limits, prices, and feature flags per tier.

### Client Config (Express)
Tier display data is defined inline in `express/components/pricingtable.js` — human-readable limits and prices for the pricing table UI.

---

## Deployment Modes

### Cloud (Hosted)
The default. Users sign up on the hosted platform, tiers enforced per-user via Stripe billing.

### Self-Hosted (GitHub)
Anyone can clone the repo and run it. **All features are unlocked with no tier enforcement** when Stripe is not configured. Each app checks its own env var:
- **Strapi:** `TIER_ENFORCEMENT` — when unset, `checkTierLimit()` returns null and all server-side limits are skipped
- **Express:** `STRIPE_SECRET_KEY` — when unset, the video generation tier check is skipped

**Implementation:** No license keys, no deployment modes. Self-hosters simply don't set these env vars.

### Enterprise (Cloud)
Enterprise is manually managed:
1. Set user's `plan` to "enterprise" via Strapi admin panel
2. Set custom limits via `planOverrides` JSON field (e.g. `{"storageMB": 500000, "maxFileSizeMB": 5000}`)
3. Stripe subscription managed separately or via custom invoicing
4. "Contact Us" flow on marketing page (email link)

### Enterprise (Self-Hosted / On-Prem)
Deferred until first customer requests it. Would use a license key instead of Stripe — the instance runs as Enterprise for all users, no per-user billing. See Key Design Decisions for notes.

---

## Environment Variables

### Strapi (`strapi/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `TIER_ENFORCEMENT` | Cloud only | Set to `true` to enable tier limit checks. Omit for self-hosted (all features unlocked). |

### Express (`express/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Cloud only | Stripe secret key (`sk_test_...` or `sk_live_...`). Used for checkout, portal, and webhooks. Also gates the video generation tier check. |
| `STRIPE_WEBHOOK_SECRET` | Cloud only | Stripe webhook signing secret (`whsec_...`). Used to verify webhook payloads. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Cloud only | Stripe publishable key (`pk_test_...` or `pk_live_...`). Exposed to the browser for Stripe.js. |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | Cloud only | Stripe Price ID for Starter monthly plan. |
| `STRIPE_STARTER_ANNUAL_PRICE_ID` | Cloud only | Stripe Price ID for Starter annual plan. |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Cloud only | Stripe Price ID for Pro monthly plan. |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Cloud only | Stripe Price ID for Pro annual plan. |

---

## Stripe Setup

### 1. Create a Stripe Account
- Sign up at [dashboard.stripe.com](https://dashboard.stripe.com)
- Use **Test Mode** during development (toggle in top-right of dashboard)

### 2. Create Products and Prices
In the Stripe Dashboard → Products → Add Product:

**Starter Plan:**
- Name: "Starter"
- Monthly price: $5/month (recurring)
- Annual price: $48/year ($4/month equivalent, recurring)
- Copy both Price IDs (`price_...`) → set as `STRIPE_STARTER_MONTHLY_PRICE_ID` and `STRIPE_STARTER_ANNUAL_PRICE_ID`

**Pro Plan:**
- Name: "Pro"
- Monthly price: $20/month (recurring)
- Annual price: $192/year ($16/month equivalent, recurring)
- Copy both Price IDs → set as `STRIPE_PRO_MONTHLY_PRICE_ID` and `STRIPE_PRO_ANNUAL_PRICE_ID`

### 3. Get API Keys
- Dashboard → Developers → API keys
- Copy the **Secret key** → `STRIPE_SECRET_KEY`
- Copy the **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### 4. Set Up Webhooks
- Dashboard → Developers → Webhooks → Add endpoint
- Endpoint URL: `https://your-domain.com/api/stripeWebhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`

### 5. Configure Customer Portal
- Dashboard → Settings → Billing → Customer portal
- Enable: subscription cancellation, plan switching, payment method updates
- This powers the `/api/createPortal` endpoint

### 6. Test Cards
Use these in test mode:
- `4242 4242 4242 4242` — successful payment
- `4000 0000 0000 0341` — payment declined
- Any future expiry, any 3-digit CVC, any billing ZIP

---

## Implementation Phases

### Phase 1: Tier Configuration & Data Model — DONE
- [x] Tier config: `strapi/config/tiers.js` (server), inline in `components/pricingtable.js` (client)
- [x] User schema extended: plan, stripeCustomerId, stripeSubscriptionId, billingInterval, planOverrides
- [x] Helper functions: getUserTierConfig, calculateUserTotalStorage, countUserChannels, getUserWithPlan, checkTierLimit

### Phase 2: Server-Side Enforcement — DONE
- [x] `getUserPlan` endpoint (`strapi/src/api/user/`)
- [x] Channel creation limit (maxChannels check)
- [x] Upload enforcement (storage limit + per-file size limit)
- [x] Video generation gating (Pro+ only, checked in `express/pages/api/makevideo.js`)
- [x] Collaboration gating (addEditor blocked for Free)
- [x] Tileset picker gating (stripped for Free in updateChannel)
- [x] Custom marker colors/icons gating (stripped for Free in tag updates)

### Phase 3: Stripe Integration — DONE
- [x] Install Stripe, configure env vars
- [x] `POST /api/createCheckout` — Stripe checkout session (`express/pages/api/createCheckout.js`)
- [x] `POST /api/createPortal` — Stripe customer portal (`express/pages/api/createPortal.js`)
- [x] `POST /api/stripeWebhook` — handle subscription events (`express/pages/api/stripeWebhook.js`)
- [x] Strapi endpoints: updateUserPlan (`strapi/src/api/user/`), called by webhook handler
- [x] Wire PricingTable `onSelectPlan` to checkout flow

### Phase 4: Frontend — Marketing Page, Pricing & Usage Display — DONE
- [x] Pricing table with monthly/annual toggle (`components/pricingtable.js`)
- [x] Usage banner on dashboard (`components/usagebanner.js`) — plan badge opens pricing modal
- [x] Landing hero + features grid for logged-out users (`components/landinghero.js`)
- [x] Pricing table shown below hero for logged-out users
- [x] Google OAuth CTA on hero and pricing table (logged-out "Get Started" buttons)
- [x] Use cases section on marketing page (participatory mapping, design probes, photovoice, oral history)
- [x] Footer with GitHub links (frontend + backend repos), privacy, terms, contact
- [x] Favicon (teal "E" on rounded square)
- [x] Privacy policy page (`pages/privacy.js`)
- [x] Terms of service page (`pages/terms.js`)
- [x] Checkout/portal hooks (`hooks/createcheckout.js`, `hooks/createportal.js`)

### Phase 5: Frontend Feature Gating — DONE
- [x] Tileset picker hidden for Free (`components/mapper.js`)
- [x] Overlay button hidden for Free (`components/mapper.js`)
- [x] Video generation button hidden below Pro (`components/addmenu.js`)
- [x] Custom marker colors hidden for Free (`components/tageditor.js`)
- [x] Custom marker icons hidden for Free (`components/tageditor.js`)
- [x] Channel creation disabled at limit (`components/myreels.js`)
- [x] Client-side file size validation (`components/fileuploader.js`)

### Phase 6: Navigation & Polish — DONE
- [x] Pricing modal triggered from UsageBanner plan badge
- [x] Over-limit warnings (storage + channels) in UsageBanner
- [x] Contact email: fotomap@represent.org (Enterprise)

---

## Key Design Decisions

1. Enforcement checks the **channel owner's** plan, not the uploading user's
2. `calculateChannelSize` returns MB (KB/1024) — tier config uses MB to match
3. Downgrade = read-only freeze, no data deletion
4. Enterprise is manual (Strapi admin + planOverrides JSON)
5. Video generation is boolean (Pro+), not metered
6. Client-side validation is convenience only — server-side is the real gate
7. SSO listed as Enterprise feature, implementation deferred
8. Marketing page replaces logged-out index — no separate /pricing route
9. Sample maps on marketing page reuse existing Mapper component or screenshots + links
10. **Self-hosted = fully unlocked** — no Stripe config means no enforcement, all features available. Standard open-source model.
11. **Enterprise on-prem** deferred — would use license key for support/SLA tracking, but features are already unlocked
