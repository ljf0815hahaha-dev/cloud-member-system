# Cloud Member System

Pure CloudBase member balance system for a vehicle film and beauty shop.

## Structure

- `miniprogram/`: customer WeChat Mini Program.
- `staff-h5/`: staff and manager web console. Deploy its contents through CloudBase static hosting.
- `cloudfunctions/`: CloudBase Node.js cloud functions.

## WeChat Mini Program

- AppID: `wxfd38d9b1de5af197`
- WeChat Developer Tools project config: `project.config.json`
- CloudBase environment ID: not configured yet

## Deployment preparation

This repository contains deployment preparation only; it does not deploy automatically.

1. Read `docs/deployment.md` and `docs/deployment-manifest.json`.
2. Replace `YOUR_CLOUDBASE_ENV_ID` in `miniprogram/app.js` and `staff-h5/config.js` with the same real environment ID.
3. Set both `devMode` values to `false` before a production release.
4. Install and verify only the dependencies already declared by each cloud function's `package.json`; do not guess dependency versions.
5. Create the collections and indexes documented in `docs/database.md`.
6. Complete the real-device checks in `docs/test-checklist.md`.

Repository-only preflight before credentials are ready:

```bash
node scripts/preflight.js --allow-placeholder
```

Production preflight after setting the real environment ID and disabling dev mode:

```bash
node scripts/preflight.js
```

`--allow-placeholder` permits the environment ID placeholder and reports `devMode: true` as an expected pre-deployment warning. Without this option, placeholders and development mode are blocking failures. The preflight is read-only and checks configuration placeholders, both `devMode` values, required cloud-function files, H5 UTF-8 charset, and the Mini Program sitemap.

## Money

All currency is stored and calculated in fen. The UI converts fen to yuan only for display.

## Current scope

Customer: phone authorization entry, balance, notices, balance logs, vehicle records, and structured film service records.

Staff: account login and session validation, member and vehicle management, idempotent recharge and mixed payment settlement, and structured film record upload.

Manager: overview data, staff creation/status/role/password management, consume-item creation/editing/sorting/status management, notice image upload/editing/sorting/status management, and transactional balance-log reversal.
