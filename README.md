# Sales Appointment Capture PWA

Offline-capable sales appointment capture app for Vercel.

## Deploy to Vercel

1. Push this folder to GitHub.
2. In Vercel, create a new project from the GitHub repo.
3. Framework Preset: **Other**.
4. Build Command: leave blank.
5. Output Directory: leave blank / root.
6. Deploy.

## Staff offline setup

Each staff member should:

1. Open the deployed URL once while online.
2. Wait for the app to load.
3. On iPhone/iPad: Safari > Share > Add to Home Screen.
4. On Android: Chrome > Add to Home screen / Install app.
5. Open the home-screen app before leaving the office to confirm it loads.

After the first online load, the app should work offline for filling forms, attaching photos, capturing signatures, and generating PDFs locally.

## User Guide

See [USER_GUIDE.md](USER_GUIDE.md) for detailed instructions on using the app, including auto-fill features, photo capture, sharing via email, drafts, and settings.

## Updating the app

When you change files, also update `CACHE_VERSION` in `service-worker.js`, for example from `v1.0.0` to `v1.0.1`. This helps staff devices pick up the new version.

Staff should open the app while online after an update so the new version can cache.
"# sales_checklist_ia" 
