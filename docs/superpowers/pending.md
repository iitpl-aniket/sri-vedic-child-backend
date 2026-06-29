# Kundli Migration Status

Date: 2026-06-23

## Done

- Wrote and committed the kundli subdomain disconnect design spec.
- Detached main-domain `/kundli`, `/name-correction`, and `/name-correction-new`.
- Redirected those main-domain routes to the kundli subdomain.
- Updated main homepage kundli and name-correction CTAs to use subdomain handoff.
- Added subdomain wrapper routes for `/kundli` and `/name-correction`.
- Ported the working kundli page into `kundli-srivedicpuja-frontend`.
- Centralized subdomain frontend API base handling in `lib/utils/env.ts`.
- Updated subdomain name-correction auth and API consumers to use shared env helpers.
- Created `kundli-srivedicpuja-backend` with health endpoint and API surface.
- Added passthroughs for `/api/user/get-profile` and `/api/puja/allServices`.
- Extracted real subdomain handlers for `/api/kundli/generate`.
- Extracted real subdomain handlers for `/api/name/name-correction`.
- Copied Swiss Ephemeris files, auth middleware, DB config, and service-limit middleware.
- Installed backend dependencies for the kundli backend.
- Verified frontend linting with warnings only, no blocking errors.
- Verified kundli backend `/health` endpoint works.
- Verified extracted kundli generation works end to end on subdomain backend.
- Verified unauthenticated profile route returns `401` as expected.

## Pending

- Run authenticated end-to-end verification for subdomain name-correction submission.
- Verify subdomain frontend against running `kundli-srivedicpuja-backend` in browser.
- Point deployment envs so subdomain frontend uses `kundli-srivedicpuja-backend` by default.
- Fix Gemini model configuration in copied GPT analysis flow.
- Confirm whether `/api/user/get-profile` should remain proxied or be fully extracted.
- Confirm whether `/api/puja/allServices` should remain proxied or be fully extracted.
- Decide whether subdomain `/kundli` should keep current UI or be further simplified.
- Replace temporary `/name-correction` wrapper with dedicated subdomain page if needed.
- Add proper git tracking/commit flow for `kundli-srivedicpuja-frontend` if required.
- Add proper git tracking/commit flow for `kundli-srivedicpuja-backend` if required.
- Clean up any leftover local-only defaults after deployment envs are finalized.
