# Supportly — UPI Creator Support

Supportly is a Firebase-backed creator-support platform for YouTubers, streamers, developers, artists, educators, and other independent creators. It keeps the existing Supportly visual identity—rounded cards, purple creator workspace, responsive sidebar, mobile navigation, and direct UPI support flow—while connecting the interface to real authentication, Realtime Database data, trusted Cloud Functions, notifications, analytics, and admin review.

## Product rules

- Supporters pay **directly to the creator's UPI ID**.
- Supportly does not hold money, operate a wallet, or create platform payouts.
- The app never requests bank account numbers, IFSC codes, card details, or net-banking credentials.
- A submitted UTR / transaction ID always starts as `pending`.
- A UTR is a duplicate-detection and review signal; it is not proof of payment.
- Only an authorized creator/admin Cloud Function can change a payment to `verified`, `rejected`, or `flagged`.
- UTRs and other private payment fields are never included on public creator pages.

## Firebase project

The browser uses the supplied Firebase web configuration in `js/config.js` and `js/firebase.js`:

- Firebase Authentication
- Firebase Realtime Database
- Firebase callable Cloud Functions in `us-central1`
- Optional Firebase App Check with a reCAPTCHA v3 site key
- No Firestore

The Firebase web configuration is public client configuration. Service-account credentials are not shipped to the browser or committed to this repository.

## What is functional

- Google Sign-In with popup and mobile/blocked-popup redirect fallback.
- Email/password sign-up, sign-in, persistent local session, password reset, and sign-out.
- User profile synchronization at `/users/{uid}`.
- Creator onboarding and settings saved through the trusted `saveCreatorProfile` function.
- Atomic username claiming at `/usernames/{username}` with reserved-word and format validation.
- Creator profile loading at `/{@username}` and `/{@username}/support`.
- Direct UPI intent generation using `pa`, `pn`, `am`, and `cu=INR`.
- QR-code fallback for the UPI intent; the QR library is loaded only when the fallback is opened.
- Optional supporter name and message collection.
- Trusted UTR normalization, SHA-256 duplicate index, and payment creation through `submitPayment`.
- Payment history using creator payment indexes rather than a public global download.
- Pending, verified, rejected, and flagged status views.
- Trusted creator/admin review through `reviewPayment`, including rejection reasons and audit logs.
- Realtime notifications with unread badge, mark-one-read, and mark-all-read actions.
- Creator analytics loaded from trusted aggregate values.
- Admin dashboard, user/creator/payment/report/log views, and server-authorized payment review.
- Client-side avatar compression to a 512px maximum dimension with a strict Realtime Database size limit.
- Centralized validation and friendly Firebase error messages.
- Loading, empty, error, offline, and unauthorized states.
- Real static URLs for all main pages plus `404.html` dynamic resolver support for `@username` routes.
- PWA manifest and a static-only service-worker shell. Firebase data is not cached by the service worker.

## Project tree

```text
.
├── index.html
├── 404.html
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml
├── styles.css
├── sw.js
├── icon-192.svg
├── icon-512.svg
├── components/
│   └── shell.html
├── css/
│   └── README.md
├── js/
│   ├── app.js
│   ├── analytics.js
│   ├── auth.js
│   ├── bootstrap.js
│   ├── config.js
│   ├── database.js
│   ├── firebase.js
│   ├── notifications.js
│   ├── qr.js
│   ├── router.js
│   ├── security.js
│   └── utils.js
├── functions/
│   ├── index.js
│   └── package.json
├── firebase/
│   └── database.rules.json
├── firebase.json
├── .firebaserc
├── .github/workflows/deploy-pages.yml
├── LICENSE
└── README.md
```

The original design stylesheet remains the visual source of truth in `styles.css`; the `components/shell.html` file is shared by every route so layout and navigation do not drift between pages.

## Routes

Static directories are included so direct opening and refreshing works on GitHub Pages:

```text
/
/login/
/signup/
/forgot-password/
/dashboard/
/payments/
/analytics/
/settings/
/notifications/
/help/
/about/
/privacy/
/terms/
/@username
/@username/support
/payment/pending/
/payment/success/
/payment/failed/
/admin/
/admin/users/
/admin/creators/
/admin/payments/
/admin/reports/
/admin/logs/
/admin/settings/
```

`404.html` detects the configured repository base path and lets the app render dynamic `@username` and `@username/support` routes instead of showing a GitHub Pages 404 screen.

## Realtime Database structure

```text
root/
  users/{uid}
    displayName
    email
    photoURL
    role
    provider
    createdAt
    updatedAt

  creators/{uid}
    username
    displayName
    bio
    avatar
    youtube/{channelId, channelName, channelUrl}
    payment/{upiId, currency}
    supportAmounts[]
    thankYouMessage
    isPublic
    showRecentSupport
    createdAt
    updatedAt

  usernames/{username}
    uid

  payments/{paymentId}
    creatorId
    supporterId
    supporterName
    amount
    currency
    utr
    status
    message
    createdAt
    verifiedAt
    verifiedBy
    rejectionReason

  creatorPayments/{creatorUid}/{paymentId}: true
  supporterPayments/{supporterUid}/{paymentId}: true

  utrIndex/{utrHash}
    paymentId
    createdAt

  notifications/{uid}/{notificationId}
    type
    title
    message
    paymentId
    read
    createdAt

  analytics/{creatorUid}
    profileViews
    supportPageViews
    supportAttempts
    submittedPayments
    verifiedPayments
    pendingPaymentCount
    rejectedPayments
    flaggedPayments
    verifiedAmount
    totalSubmittedAmount

  admins/{uid}
    role
    isActive
    createdAt

  adminAuditLogs/{logId}
    adminId
    action
    targetId
    timestamp
    metadata

  reports/{reportId}
    reporterUid
    targetType
    targetId
    reason
    description
    status
    createdAt
    resolvedAt
    resolvedBy

  system/maintenance
    enabled
    message
    updatedAt
```

## Security Rules

`firebase/database.rules.json` is production-oriented and intentionally does not use public root reads or writes. It enforces:

- authenticated ownership for user records;
- public read only for creator profiles where `isPublic` is true;
- creator/supporter/admin ownership for payment reads;
- no direct client writes to payments, creator indexes, UTR indexes, analytics, admins, reports, or audit logs;
- notification ownership with read-only state changes;
- admin-only reads for admin collections.

Payment creation, username claiming, profile saves, review transitions, reports, analytics increments, notifications, and audit logs are implemented in trusted Cloud Functions. Deploy the rules before using the production database.

## Firebase Console setup

Complete these steps in the Firebase project `hiiii-72d78`:

1. Enable **Authentication → Sign-in method → Google**.
2. Add the production GitHub Pages domain to **Authentication → Settings → Authorized domains**:
   `ritampaine75-debug.github.io`.
3. Enable **Email/password** authentication.
4. Confirm the Realtime Database instance matches the supplied `databaseURL`.
5. Deploy `firebase/database.rules.json` before allowing users into the app.
6. Create the first admin record through a trusted process only:

   ```json
   /admins/ADMIN_UID
   {
     "role": "admin",
     "isActive": true,
     "createdAt": 1710000000000
   }
   ```

7. Configure Firebase App Check for the web app with reCAPTCHA v3. Then set the site key in `js/config.js` or inject `window.SUPPORTLY_APP_CHECK_SITE_KEY` before the app module loads.
8. Set `ENFORCE_APP_CHECK=true` in the Cloud Functions environment after App Check has been tested.
9. Replace the starter Terms, Privacy Policy, and Community Guidelines copy with counsel-reviewed production documents.

If Google authentication is disabled, the UI reports: **Google Sign-In is currently unavailable. Please enable Google authentication in Firebase Console.**

## Deploy Cloud Functions and rules

Install the Firebase CLI, authenticate with an account that has access to the project, and run from this repository:

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase use hiiii-72d78
firebase deploy --only database,functions
```

The browser calls these trusted functions:

- `saveCreatorProfile`
- `submitPayment`
- `reviewPayment`
- `recordProfileView`
- `createReport`

The client will show a configuration error instead of pretending a sensitive action succeeded when a required function is not deployed.

## GitHub Pages deployment

The repository is configured for GitHub Pages with `.github/workflows/deploy-pages.yml`. The live repository deployment uses the `main` branch and GitHub Actions Pages artifacts.

1. Push changes to `main`.
2. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the source.
3. Confirm the `Deploy static site to GitHub Pages` workflow succeeds.
4. The repository deployment URL is:

   ```text
   https://ritampaine75-debug.github.io/upi-creator-support/
   ```

5. For a custom domain at the domain root, set `BASE_PATH` to `/` in `js/config.js` and update the base-path detector in `404.html` if needed.
6. Update `robots.txt`, `sitemap.xml`, canonical metadata, and social metadata to the final domain.

All route pages use relative asset loading, while `js/config.js` centralizes navigation URLs. The service worker caches only static application assets and never caches Firebase responses.

## Functional audit

The following previously static interactions are now connected to real actions:

- Home / Overview loads Firebase-backed creator metrics and recent payments.
- Payments loads indexed creator records, filters, search, sort, CSV export, detail review, verify, reject, and flag actions.
- My Page loads `/usernames/{username}` and `/creators/{uid}` dynamically.
- Support button opens the real UPI flow with amount, supporter details, UPI intent, QR fallback, UTR submission, duplicate protection, and pending status.
- Insights loads analytics aggregates.
- Settings validates and saves creator profile, YouTube, UPI, support amounts, visibility, thank-you message, and compressed avatar.
- Notifications loads realtime notifications, unread badges, mark-read, and mark-all-read.
- Sidebar, mobile navigation, breadcrumbs, profile menu, notification button, hamburger menu, share, copy-link, help, and sign-out all have actions and accessible semantics.
- Login, Google Sign-In, signup, password reset, persistent auth, and protected-route redirects are implemented.
- Admin pages check `/admins/{uid}` and sensitive review writes go through trusted functions and audit logs.

## License

MIT. See [LICENSE](LICENSE).
