# PHASE 17 REPORT — Android Application

## 1. What was built
Capacitor configuration wrapping the existing built frontend (`dist/`) as an installable Android app — same backend, same API, same auth/RBAC, same business logic, per the master prompt's explicit "do not create a separate financial system inside the Android application." No native code was written; Capacitor is a thin native shell around the same web app already built in Phase 4/16.

## 2. Files created
`frontend/capacitor.config.json`, this report.

## 3. Files modified
`frontend/package.json` (added `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, and `cap:*` scripts).

## Steps to actually produce the internal test APK (cannot be executed in this environment — no Android SDK, no network)
```bash
cd frontend
npm install
npm run build              # produces dist/
npm run cap:add:android    # scaffolds the android/ native project
npm run cap:sync           # copies dist/ into the native project
npm run cap:open:android   # opens Android Studio
# In Android Studio: Build > Build Bundle(s)/APK(s) > Build APK(s)
```
The resulting debug APK is for internal testing only, exactly as the master prompt specifies — no Play Store submission at this stage.

## 4-5. Database / API changes
None — this phase packages the existing frontend, it doesn't add functionality.

## 6-8. Tests
None possible in this environment (no Android SDK, no device/emulator, no network to fetch Capacitor's Gradle dependencies). **Explicitly BLOCKED**, not skipped.

## 9. Security issues discovered
One worth naming even though it's a Phase 15 configuration concern, not a Phase 17 code issue: `capacitor.config.json`'s `androidScheme: "https"` is set correctly, but the actual `VITE_API_URL` the built app talks to must point at a real HTTPS backend before this APK is handed to a real worker.

## 10. Problems encountered
No Android build tooling available in this sandbox at all — this phase is necessarily "prepared, not executed," more so than any prior phase.

## 11. Remaining work
Run the build steps above on a machine with Android Studio installed, install the resulting APK on a real Android tablet, and confirm login, deposit, and withdrawal-request flows work end-to-end against a real deployed backend.

## 12. Exact next phase
**Phase 18 — Offline Mode (design review only — see that phase's report for why it is not being implemented).**
