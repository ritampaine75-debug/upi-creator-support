# Supportly — UPI Creator Support

A polished, mobile-first static HTML prototype for a creator-support platform designed around direct UPI payments. Creators can publish a support page, share a short link, receive UPI handoffs, collect a UTR / transaction ID for review, and keep payment states clearly separated from verification.

> **Important:** This repository is a front-end prototype. It does not process real payments, store real UTRs, authenticate users, or verify transactions. Connect a trusted backend before production use.

## Product idea

**Support creators directly with UPI.**

The interface is intentionally simpler than a wallet or payout platform:

- Support goes directly to the creator's UPI ID.
- No bank account, IFSC, card, or net-banking details are requested.
- A UTR submission is a review signal, not proof that money was received.
- New submissions stay **Pending** until the creator or an approved reviewer verifies them.
- UTRs and payment details are not exposed on the public creator page.

## Included in the prototype

- Responsive creator dashboard with overview metrics and quick actions.
- Public creator page at the conceptual route `@username`.
- Support amount selector with custom INR amounts.
- UPI deep-link handoff preview and QR fallback preview.
- UTR / transaction ID submission flow.
- Submission result with a safe `Pending verification` state and Support ID.
- Payment review table with Pending, Verified, Rejected, and Flagged states.
- Payment detail modal with state transition actions.
- Analytics screen that separates support attempts, submitted payments, and verified payments.
- Creator profile, UPI, amount, and visibility settings screen.
- Mobile navigation, keyboard focus states, reduced-motion support, inline SVG icons, and empty / success / error / offline-oriented trust messaging.
- Lightweight PWA shell, manifest, `robots.txt`, and sitemap placeholder.

## Run locally

This is plain HTML, CSS, and JavaScript. No package installation is required.

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173> in a browser.

You can also open `index.html` directly, but a local HTTP server gives the best experience for the PWA service worker and share APIs.

## File structure

```text
.
├── index.html              # App shell and inline SVG icon sprite
├── styles.css              # Responsive design system and component styles
├── app.js                  # Demo state, routing, UI interactions, and flows
├── manifest.webmanifest    # PWA metadata
├── sw.js                   # Static offline shell cache
├── icon-192.svg            # PWA icon
├── icon-512.svg            # PWA icon
├── robots.txt
├── sitemap.xml
├── LICENSE
└── README.md
```

## Static routing

The prototype uses hash routes so it works on static hosts without a server rewrite:

- `#overview`
- `#payments`
- `#analytics`
- `#settings`
- `#public`

The public page displays the conceptual URL `https://supportly.example/@ritam`. Replace this placeholder with the deployed domain before sharing it publicly.

## Production handoff checklist

Before accepting real payments or identity data, replace the demo state with a secure backend and complete the following:

1. **Authentication** — Firebase Authentication with Google sign-in and/or email verification.
2. **Database** — Firebase Realtime Database or another trusted datastore with creator-specific payment indexes.
3. **Server-side validation** — Validate username ownership, UPI format, amount limits, duplicate UTR signals, and payment state transitions outside the browser.
4. **Authorization** — Enforce creator isolation and verified admin authorization in security rules and trusted server functions.
5. **Payment model** — Keep direct UPI handoff. Do not introduce bank payouts or a platform wallet unless the product and compliance model changes.
6. **Verification** — Never change a payment to Verified merely because a supporter entered a UTR. Use the permitted review process and keep an audit trail.
7. **Privacy** — Keep UTRs, supporter contact data, and moderation notes private. Do not include them in public feeds, OG metadata, analytics URLs, or logs.
8. **Abuse controls** — Add App Check, rate limiting, input sanitization, duplicate detection, maximum amounts, report workflows, and audit logs.
9. **QR generation** — Replace the illustrative QR preview with a trusted, correctly encoded UPI QR generator.
10. **Notifications** — Add secure creator/supporter notifications only after server-side state changes.
11. **Legal pages** — Add Terms of Service, Privacy Policy, Community Guidelines, and Contact / Report pages before launch.
12. **Testing** — Test security rules, creator isolation, state transitions, duplicate UTR handling, accessibility, offline behavior, UPI fallback, and small-screen layouts.

## Suggested production data model

The original build brief recommends creator-scoped indexes rather than downloading a global payment collection to the browser:

```text
users/{uid}
creators/{uid}
usernames/{username}
payments/{paymentId}
creatorPayments/{creatorUid}/{paymentId}
supporterPayments/{supporterUid}/{paymentId}
utrIndex/{utrKey}
notifications/{uid}/{notificationId}
reports/{reportId}
analytics/{creatorUid}
admins/{uid}
adminAuditLogs/{logId}
system/maintenance
```

Production rules must never use public read/write access. Sensitive verification fields such as `verifiedBy`, `verifiedAt`, `role`, and admin permissions must not be trusted when supplied only by the browser.

## GitHub Pages deployment

This repository is static-host friendly. For a repository named `upi-creator-support`:

1. Push the contents of this folder to the `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select `main` and folder `/ (root)`.
5. Save and wait for the Pages build.
6. Update `og:url`, `sitemap.xml`, the public-link placeholder, and any canonical URLs to your real domain.

The first-party GitHub Pages URL will normally be:

```text
https://ritampaine75-debug.github.io/upi-creator-support/
```

## License

Released under the MIT License. See [LICENSE](LICENSE).
