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
    audio. The playback pipeline (Phase 5.2) is built — on-demand
    download + offline cache + player — and renders whenever a part's
    `audio_url` is set; until then the transcript fallback stands.
14. **No Play Store listing.** Debug APK installs directly; the $25
    store listing is Samir's later tap.
15. **Band estimates are always labelled** "practice estimate, not an
    official score", same as the web app. Writing feedback is guidance
    only and says what it cannot judge.
16. **Partner Speaking practice is deferred** (needs real learner
    demand first), same as the web app's Phase 4 decision.
17. **compileSdk is 36, not 37 (fixed 2026-11-16).** The first push set
    compileSdk 37, but Google's SDK repository has no `platforms;android-37`
    yet (highest platform is android-36, verified against
    dl.google.com/android/repository/repository2-1.xml on 2026-11-16), so
    the Gradle build could never resolve it. buildTools 37.0.0 and NDK
    27.1.12297006 do exist and are kept. Revisit 37 when Google ships it.
18. **No `android-actions/setup-android` in CI (fixed 2026-11-16).** The
    action runs `sdkmanager tools` and the `tools` package no longer exists
    in Google's SDK repository, so the step fails with "Failed to find
    package 'tools'" (CI run 43899834228). The ubuntu runner already ships
    an Android SDK, so CI installs the exact packages it needs with
    sdkmanager directly (`platform-tools`, `platforms;android-36`,
    `build-tools;37.0.0`, `ndk;27.1.12297006`).
19. **react-native-nitro-modules is a direct dependency (fixed 2026-11-16).**
    `react-native-audio-recorder-player` 4.5.0 declares it only as a peer
    dependency, so React Native autolinking never registered it as a Gradle
    project and CI failed with "Project with path ':react-native-nitro-modules'
    could not be found" (run 43901109792). It is now pinned as a direct
    dependency (0.37.2, the version already resolved in the lockfile).
    Note: audio-recorder-player 4.5.0 is deprecated upstream in favour of
    react-native-nitro-sound — a future switch is possible but not needed
    while this one builds and works.
20. **Audio library swapped: react-native-nitro-sound 0.2.20 replaces
    react-native-audio-recorder-player 4.5.0 (fixed 2026-11-16).** The old
    library is deprecated upstream and its nitrogen-generated
    `HybridAudioRecorderPlayerSpec.kt` references `updateNative`, which
    nitro-modules 0.37.2 no longer defines — CI failed at
    `:react-native-audio-recorder-player:compileDebugKotlin` with
    "Unresolved reference 'updateNative'" (run 43902912717). Downgrading
    nitro was rejected: it would re-break other things and strand the
    app on an old Nitro. nitro-sound is the author's own recommended
    successor; its peer requirement (`nitro-modules >=0.36.5`) is
    satisfied by the installed 0.37.2, which stays a direct dependency
    (see item 19). Verified from the library's own source before
    rewriting: Android metering is dB (-160 silent to 0 loud,
    `20 * log10(maxAmplitude / 32767)` in `Sound.kt`), identical to the
    old library — so `meteringDbToLevel` and the fluency math are
    unchanged. `setSubscriptionDuration` takes SECONDS (spec declares
    `sec: number`; native does `(sec * 1000)`), despite the README's
    methods table saying "ms" — 0.1 still means 100 ms sampling.
    `stopRecorder` is idempotent (extra calls resolve with the string
    "recorder already stopped"), so the screens only accept a returned
    value that looks like a file path. Recording stays MPEG-4/AAC, so
    the `.m4a` file names are unchanged. Playback now clears the
    playing state via `addPlaybackEndListener` when a recording ends
    naturally (the old code left the Play button stuck on "Stop").
