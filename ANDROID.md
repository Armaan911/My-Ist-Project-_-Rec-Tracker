# Build the Android app (.apk) for your team

This project includes a native **Android wrapper** (Capacitor). It produces a real `.apk` you can install directly on your team's Android phones — no Play Store.

## How it works (read this first)

Your app is server-rendered (Next.js), so the Android app is a **native full-screen shell that loads your deployed site** in a WebView. Practical consequences:

- The phone needs **internet** (same as the app already does for its database).
- You **deploy the web app to Vercel once**, then point the Android app at that URL.
- When you change the app later, you usually **just redeploy to Vercel — the installed app updates automatically**. You only rebuild the `.apk` if you change the app icon, app name, or the URL it points to.

## What you need (one-time)

- A computer (Windows, Mac, or Linux) with **[Android Studio](https://developer.android.com/studio)** installed.
- **JDK 17** (Android Studio bundles one).
- ~20 minutes the first time. After that, a rebuild is a couple of minutes.

> I cannot produce the `.apk` for you — Android requires it to be compiled with the Android SDK, which only Android Studio provides. Everything up to that final compile step is done; the steps below are the standard Capacitor build.

## Steps

**1. Deploy the web app to Vercel** (if you haven't) and copy its HTTPS URL, e.g. `https://recruit-tracker-yourteam.vercel.app`.

**2. Point the Android app at that URL.** Open `capacitor.config.ts` and replace the placeholder:

```ts
server: {
  url: "https://YOUR-APP.vercel.app",   // <-- your real Vercel URL
  cleartext: false,
},
```

**3. Install dependencies** (in the project folder):

```bash
npm install
```

**4. Sync the change into the Android project:**

```bash
npx cap sync android
```

(If `npx` errors on your machine, use `./node_modules/.bin/cap sync android`.)

**5. Open it in Android Studio:**

```bash
npx cap open android
```

Let Android Studio finish "Gradle sync" the first time (it downloads build tools — a few minutes).

**6. Build the APK.** In Android Studio: **Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)**.
When it finishes, click **locate** — the file is:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Or skip Android Studio and run from a terminal:

```bash
cd android
./gradlew assembleDebug      # Windows: gradlew.bat assembleDebug
```

**7. Put it on the phones.** Send `app-debug.apk` to each phone (email / USB / Google Drive / WhatsApp). On the phone: open the file → if prompted, allow **"Install unknown apps"** for that source → Install. The Recruit Tracker icon appears on the home screen.

## Debug vs. signed release

- The **debug APK** above is perfectly fine for sideloading onto your own team's phones. Simplest path — use it.
- A **signed release APK** is only needed for the Play Store or stricter distribution. If you ever want one: in Android Studio, **Build ▸ Generate Signed Bundle / APK**, create a keystore (keep the file + passwords safe), and build a `release` APK. Or `./gradlew assembleRelease` after configuring signing in `android/app/build.gradle`.

## Updating the app later

- **Changed app features/screens?** Just redeploy to Vercel. Installed apps pick it up on next open — no rebuild, no reinstall.
- **Changed the icon, app name, or the Vercel URL?** Re-run `npx cap sync android` and rebuild the APK (steps 4–7), then redistribute.

## App identity (change before first build if you want)

In `capacitor.config.ts`:
- `appId` — `com.recruittracker.app` (the package id; pick your own reverse-domain if you prefer)
- `appName` — `Recruit Tracker` (the name under the icon)

The app icon is already set (the indigo bars mark, in `android/app/src/main/res/mipmap-*`).

## Honest limitations

- Needs a connection — it loads your live site; there's no offline-bundled mode (that would require rewriting the app as a client-only SPA).
- Camera / photo upload works through the WebView.
- Push notifications aren't wired up. The daily reminder stays **email** (works on every phone). Adding true Android push is a later add-on if you need it.
