# Install Blackout Messenger as a PWA

**Progressive Web App (PWA)** lets you install Blackout Messenger directly to your home screen or desktop like a native app — no App Store, no Google Play, no middlemen.

Once installed:
- Launches in full screen (no browser address bar or tabs on mobile)
- Uses the slim retro 1990s title bar with the glowing "B" glyph
- Feels like a real encrypted messenger from the dial-up era
- Camera QR scanner, stickers, and on-chain messaging work exactly the same
- Works offline for previously loaded screens (chain data still needs internet)

The app is fully adapted for mobile with 42px+ touch targets, safe-area insets for notches, and bottom-sheet sticker picker.

---

## iOS (iPhone / iPad) — Safari

1. Open Safari and go to the Blackout Messenger URL.
2. Tap the **Share** button (square with upward arrow) at the bottom of the screen.
3. Scroll down and tap **Add to Home Screen**.
4. (Optional) Edit the name — "Blackout" or "Blackout Messenger" both look good with the retro icon.
5. Tap **Add** in the top-right corner.

The app now appears on your home screen with the Blackout logo. Tap it to launch full-screen.

**Important for iOS:**
- Must use Safari. Chrome, Firefox, or other browsers on iOS cannot install PWAs.
- The site must be served over HTTPS (production) or localhost (development).
- If the "Add to Home Screen" option is missing, try refreshing the page or clearing Safari cache for the site.

---

## Android (Chrome / Edge / Firefox)

### Chrome (recommended)

1. Open Chrome and navigate to the Blackout Messenger URL.
2. Tap the **three-dot menu** ⋮ in the top-right corner.
3. Tap **Install app** (or "Add to Home screen" on older versions).
4. Confirm the app name and icon preview.
5. Tap **Install**.

A shortcut is added to your home screen and app drawer. It opens in its own window without browser chrome.

### Edge / Firefox

- Look for an **install** icon in the address bar (usually a small computer or + symbol).
- Or open the browser menu → **Install Blackout Messenger**.

Android will also offer an "Add to Home screen" banner the first few times you visit.

---

## Desktop (Windows / macOS / Linux)

### Chrome or Microsoft Edge

1. Visit the site in Chrome/Edge.
2. Look for the **install icon** in the address bar (a small monitor with a down arrow) or the ⋮ menu.
3. Click **Install Blackout Messenger**.
4. The app installs and can be launched from your Start menu / Applications folder / Dock.

It runs in its own dedicated window with the full retro UI — perfect for keeping a permanent encrypted chat window open.

### Firefox

Firefox has more limited PWA support. You can use the "Install" option from the address bar menu in recent versions, or pin the tab.

---

## What Happens After Install?

- **Full-screen retro experience**: The desktop window chrome (minimize/maximize/close buttons) disappears on mobile. You get the authentic slim 1990s title bar with the Fhenix branding.
- **Home screen icon**: Uses the official Blackout logo (the glowing "B" on dark background).
- **Standalone mode**: No browser UI. Feels like a real app from 1999 that somehow survived the apocalypse.
- **Notifications**: Background message polling works when the app is closed (if you granted notification permission in the app).
- **Updates**: The PWA auto-updates in the background when you open it and there's a new version deployed.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Add to Home Screen" missing on iOS | Use Safari, not a wrapper browser. Make sure you're on HTTPS. Hard-refresh the page (pull down or Cmd+Shift+R). |
| Install option not appearing on Android | Visit the site a couple times. Try Chrome instead of another browser. Clear site data for the domain. |
| Icon looks wrong or low-res | The manifest uses `/logo.png`. For production, replace with properly sized 192×192 and 512×512 PNGs (maskable icons are even better). |
| App opens in browser instead of standalone | Re-install after clearing the site's data/cookies. Some browsers cache the non-PWA version. |
| Camera / QR scanner doesn't work | Grant camera permission when prompted. On iOS the PWA must be launched from the home screen icon for full camera access in some cases. |
| Dev mode (localhost) | PWAs work on localhost, but some features (like camera in certain browsers) are stricter. Use a tunnel (ngrok, etc.) with HTTPS for realistic testing. |

---

## For Developers: How the PWA Was Enabled

Blackout Messenger uses a standard web app manifest + meta tags:

- `public/manifest.json` — name, short_name, icons, start_url, display: "standalone", theme_color, background_color, orientation.
- `index.html` — viewport-fit=cover, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, theme-color, link to manifest, apple-touch-icon.
- Mobile CSS in `src/styles.css` — safe-area-insets, 640px/480px breakpoints, touch targets, bottom-sheet sticker UI, full-bleed layout on phones.

To customize further:
- Update icons in `public/` and reference them in `manifest.json`.
- Change colors, name, or add shortcuts in the manifest.
- Test with Chrome DevTools → Application → Manifest and Lighthouse PWA audit.

The retro 90s aesthetic is deliberately preserved — the PWA just removes the modern browser shell around it.

---

**Blackout Messenger** — The encrypted messenger nobody can read.  
Now installable. No cloud. No witnesses. Just you, the chain, and Fhenix CoFHE.

If the instructions above are outdated for your browser version, the core flow (Share → Add to Home Screen / Install) has been stable for years across iOS and Android.