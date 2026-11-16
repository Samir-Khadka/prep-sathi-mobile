# PrepSathi mobile — decisions

For Samir's review. Nothing here is locked; each item names the
default taken and what would change it.

## Stack (verified with npm at setup, 16 Nov 2026)

1. **React Native 0.88.1, React 19.3.1, new architecture on.** The
   template ships Fabric/TurboModules, Hermes and edge-to-edge enabled.
   Change only when a newer stable RN ships.
2. **TypeScript 6.0.3, strict.** The brief first said 5.9, but the RN
   0.88 template ships 6.0.3 and npm's latest is 7.0.2 (the native
   port — too new to trust with RN's toolchain yet). 6.0.3 is the
   template-pinned, known-compatible choice. One TS 6 gotcha, already
   handled: `baseUrl` is deprecated, so `paths` resolve relative to
   the tsconfig (no `baseUrl` key).
3. **React Navigation 7.5.2 + native-stack 7.21.1.** Single stack, no
   bottom tabs in v0.1 — Home is a card hub. Tabs are a later UX call.
4. **TanStack Query 5.107.1 for server state, Zustand 5.1.0 for client
   state.** Queries retry once on network errors, never on 401/404.
5. **react-native-mmkv 4.3.2 for storage (not AsyncStorage).** MMKV v4
   changed its API: `createMMKV({id})` — `MMKV` is now a type only,
   and `delete(key)` is `remove(key)`. Both are already handled in
   `src/store/storage.ts` and `jest.setup.js`.
6. **Reanimated 4.7.1 + worklets 0.13.1.** Babel plugin is
   `react-native-worklets/plugin` and must stay last in
   `babel.config.js`.
7. **Speaking recording: react-native-audio-recorder-player 4.5.0** for
   record/playback + **@dr.pogodin/react-native-fs 2.41.0** for file
   management. The recorder's metering feeds the same fluency math as
   the web app (`src/lib/fluency.ts`).
8. **ESLint 9.39.5 flat config** via `@react-native/eslint-config/flat`
   (the template's `.eslintrc.js` was removed). Prettier stays at the
   template's 2.8.8. Two fixes were needed: (a) the config's export is
   `@react-native/eslint-config/flat`, not `/flat.js` (the package
   exports map); (b) the config bundles `eslint-plugin-ft-flow` 2.x,
   which crashes on ESLint 9 (`context.getAllComments` was removed) —
   `package.json` overrides it to 3.0.11, the current version with
   ESLint 9 support. `no-void` is off: `void` marks intentionally
   fire-and-forget promises.
9. **Android: target SDK 36, compile SDK 37, Gradle 9.4.1, Kotlin
   2.2.0** — all from the RN 0.88 template, newer than the brief's
   "35 / 8.12+" minimums. **Build files stay Groovy, not Kotlin DSL:**
   converting `android/build.gradle` + `android/app/build.gradle` to
   `.kts` could not be verified without an Android SDK locally, and
   the template's Groovy files are the officially supported RN 0.88
   setup. Revisit when a local Android SDK exists to verify the build.
10. **JWT in plain MMKV.** MMKV files live in the app-private
    directory. A future hardening step is react-native-keychain
    (Keychain/Keystore) for the token.

## Product

11. **Android first; iOS stays possible from the same codebase.**
    No iOS build is attempted (needs a Mac + paid Apple account).
12. **Offline-first.** Content JSONs are copied verbatim from the web
    repo (`src/content/`, web main `16dfee58`, v0.4.0 — see
    `CONTENT_VERSION`). Keep them in sync by content version: copy
    again + bump the version when the web repo ships new content.
    Attempts are scored on-device and synced when online.
13. **Listening audio is pending real recordings**, same as the web
    app. Transcripts are shown instead; never ship fake or synthesised
    audio.
14. **No Play Store listing.** Debug APK installs directly; the $25
    store listing is Samir's later tap.
15. **Band estimates are always labelled** "practice estimate, not an
    official score", same as the web app. Writing feedback is guidance
    only and says what it cannot judge.
16. **Partner Speaking practice is deferred** (needs real learner
    demand first), same as the web app's Phase 4 decision.
