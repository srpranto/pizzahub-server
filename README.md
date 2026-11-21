# PizzaHub Server

The PizzaHub Server is the backend service powering the PizzaHub platform. It handles the core business logic, database persistence, access control, kitchen order fulfillment lifecycles, and billing webhooks for the marketplace.

The service is built with Express and TypeScript, backed directly by MongoDB, and communicates with the Next.js frontend using token-based authentication verified through JSON Web Key Sets (JWKS).

---

## What the Server Handles

The API is responsible for managing data integrity and business operations across the platform:

- **Menu item catalog & moderation**: Enforces data validation for pizza listings, handles vendor creation requests, and provides administrative endpoints to approve, reject, or remove items.
- **Search, filtering, and sorting**: Executes database queries across approved pizzas supporting text searches, category filters, neighborhood location filters, price sorting, and pagination.
- **Customer order processing**: Validates incoming order requests, verifies pizza availability, schedules delivery dates, and manages customer order cancellations.
- **Kitchen order dispatch**: Manages the vendor side of order processing, allowing restaurants to accept or reject orders while updating historical status logs.
- **Account administration**: Enforces role permissions across customer, vendor, and administrator accounts, with administrative tools to inspect user records and toggle account suspension status.
- **Customer reviews & ratings**: Records star ratings and written reviews, linking customer feedback to specific menu items and vendors.
- **Customer favorites**: Manages user wishlists by toggling favorite pizza identifiers on user documents.
- **Vendor subscriptions**: Generates Stripe Checkout sessions for vendors wishing to upgrade their kitchen capacity, records verified transactions, and updates subscription state.
- **Automated email notifications**: Dispatches customer email alerts via Nodemailer whenever a vendor updates the status of an active pizza order.

---

## Business Rules

PizzaHub enforces specific operational rules in code to ensure fair marketplace behavior and prevent conflicting data:

### Vendor Menu Item Limits
- **Free Tier**: Free vendor accounts can maintain up to **3 active menu items** at any given time (any item with a status of `pending` or `approved`).
- **Premium Tier**: Vendors with an active Premium subscription have no listing limit and can publish unlimited active items. Their approved offerings also receive priority ranking in the public catalog.

### Order Integrity and Safeguards
- **No Self-Ordering**: Vendors cannot place orders for menu items published by their own kitchen.
- **Duplicate Order Prevention**: A customer cannot submit duplicate active orders (`pending` or `accepted`) for the same pizza item on the same delivery date. If a customer needs more food, they can adjust the item quantity rather than creating duplicate competing orders.
- **Delivery Date Validation**: Orders must specify a delivery date of today or a date in the future. Past delivery dates are rejected immediately.
- **Customer Cancellation Window**: Customers can only cancel an order while it remains in the `pending` state. Once a kitchen accepts an order, it moves into active preparation and can no longer be cancelled by the customer.

### Kitchen Order Ownership and Immutability
- **Strict Kitchen Boundaries**: Vendors can only view and manage orders assigned specifically to their own kitchen. They cannot access or modify orders belonging to another restaurant.
- **Decision Immutability**: When a vendor makes a decision on a pending order (accepting or rejecting it), that decision is permanent. Orders cannot be flipped back and forth between accepted and rejected once decided.

### Public Visibility and Moderation
- **Approved Items Only**: The public menu catalog only displays items that have been reviewed and approved by an administrator. Newly submitted items remain in a `pending` state until moderated.

### Account Suspension
- **Instant Access Revocation**: When an administrator blocks an account, the authentication middleware intercepts and rejects any subsequent requests from that user across all protected routes.

---

## Authentication and Security

The API uses a decentralized authentication model that separates identity management from business logic:

### Identity Provider Integration
User registration, password hashing, and Google OAuth sessions are managed by Better Auth on the client side. The client issues short-lived JSON Web Tokens (JWTs) representing the authenticated user.

### Cryptographic JWT Verification
When a request arrives with an `Authorization: Bearer <token>` header:
1. The server verifies the token signature against Better Auth's remote JWKS endpoint using the `jose` library (`createRemoteJWKSet`).
2. If the remote JWKS endpoint is unavailable, the server falls back to verifying the token using a shared secret.
3. The server validates that the token has not expired and extracts the subject identifier (`sub`).

### Real-Time Database Verification
The server does not rely solely on claims embedded in the token. For every authenticated request, it queries the MongoDB `users` collection to retrieve the current user record. This guarantees that:
- Account status changes (such as administrative account blocks) take effect immediately, even if the user still holds an unexpired JWT.
- The user's assigned role (`customer`, `vendor`, or `admin`) is always read from the authoritative database record.

### Role-Based Access Control (RBAC)
Endpoints are guarded by a `requireRole` middleware that restricts sensitive routes to authorized account types. For example, kitchen order management requires the `vendor` role, while moderation and user blocking require the `admin` role.

### Safe Search Sanitization
Keyword searches against menu item titles and descriptions escape special regular expression characters before constructing database queries, preventing regular expression injection and Denial of Service (ReDoS).

---

## Payments and Subscriptions

A core distinction in PizzaHub's architecture is how payments are handled:

> **Important**: Customers do not use Stripe to pay for pizza orders. Food ordering operates as a streamlined kitchen scheduling workflow. Stripe is used strictly for vendor Premium subscription upgrades.

### The Vendor Subscription Lifecycle
1. **Checkout Initialization**: A vendor clicks to upgrade to the Premium plan ($29/month). The server creates a Stripe Checkout session in `subscription` mode, embedding the vendor's database ID in the session metadata.
2. **Payment Completion**: The vendor completes checkout on Stripe's hosted payment page and is redirected back to the client application.
3. **Webhook Processing**: Stripe dispatches a `checkout.session.completed` event to the server's webhook endpoint (`/api/webhooks/stripe`).
4. **Signature Verification**: The webhook handler verifies the cryptographic signature from the `stripe-signature` header using Stripe's raw request body parsing, ensuring the event originated from Stripe.
5. **Idempotent Fulfillment**: The server checks whether the transaction has already been recorded using the unique Stripe session ID. If not, it logs the transaction, updates the vendor's account to the `premium` plan, and sets an expiration date 30 days into the future.
6. **Session Verification Fallback**: A dedicated verification endpoint (`/api/stripe/verify-session`) allows the frontend success page to verify the session directly with Stripe, ensuring immediate plan activation even if webhook delivery is delayed.

---

## Search and Sorting

The public menu endpoint (`GET /api/menu`) accepts standard query parameters to filter and paginate results:

| Parameter | Type | Description |
|---|---|---|
| `search` | `string` | Matches keywords against the item name and description. |
| `category` | `string` | Filters by one of the 6 fixed pizza categories. |
| `location` | `string` | Filters items by kitchen city or neighborhood. |
| `sort` | `string` | Supports `price_asc` (lowest first), `price_desc` (highest first), or defaults to `newest`. |
| `page` | `integer` | Page number for pagination (defaults to `1`). |
| `limit` | `integer` | Number of items per page (defaults to `12`, maximum `50`). |

All queries automatically append a status filter of `approved` so unapproved kitchen submissions are never exposed to the public.

---

## Technology

- **Runtime**: Node.js
- **Framework**: Express 4
- **Language**: TypeScript
- **Database**: MongoDB (Native Node Driver)
- **Token Verification**: jose (Remote JWKS & JWT verification)
- **Billing**: Stripe Node SDK
- **Email Delivery**: Nodemailer
- **Testing**: TSX test runner with custom assertions

---

## Related Links

- **Live API Endpoint**: [https://pizzahub-server-shahil.vercel.app](https://pizzahub-server-shahil.vercel.app)
- **Live Application**: [https://pizzahub-client-shahil.vercel.app](https://pizzahub-client-shahil.vercel.app)
- **Server Repository**: [https://github.com/srpranto/pizzahub-server](https://github.com/srpranto/pizzahub-server)
- **Client Repository**: [https://github.com/srpranto/pizzahub-client](https://github.com/srpranto/pizzahub-client)
