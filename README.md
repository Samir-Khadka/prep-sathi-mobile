# PrepSathi — mobile app

Free IELTS-format practice for Nepali phone-first learners, as a native
Android app. Full parity with the [PrepSathi web app](https://github.com/Samir-Khadka/prep-sathi)
through Phase 4. All practice content is original, written to the
official IELTS format; no Cambridge copyrighted material is included
anywhere. Every band shown is labelled
**"practice estimate, not an official score"**.

## Features (web parity, Phase 1–4)

- **Auth** — email + password signup/login, JWT (7-day, same as the web app).
- **Dashboard** — latest band per module, overall estimate, target-band tracking, recent attempts.
- **Listening** — 4 timed tests (32:00), 40 questions each, transcripts shown (audio is pending real recordings — no TTS, no fake audio), auto scoring with the published Listening band table.
- **Reading** — 4 Academic + 1 General Training timed tests (60:00), 40 questions each, evidence-linked explanations, separate Academic/GT band tables.
- **Writing** — 20 prompts with original model answers + band-7 commentary, plus automated feedback by the four official criteria with estimated ranges and plain limits (it cannot judge ideas, argument quality, or factual accuracy).
- **Speaking** — 15 sets (Part 1, Part 2 cue with 60s prep / 120s talk, Part 3), on-device recording, playback history (max 20, oldest dropped, delete per-recording + delete-all, nothing uploaded).
- **Vocabulary** — 250 words with spaced-repetition review (correct: interval doubles to 60 days max; wrong: resets to 1 day).
- **Full mock sittings** — Listening → Reading → Writing in one timed session in test order, no breaks, no going back to a closed section; Speaking as a separate slot; overall band = average of four with IELTS rounding.
- **Feedback** — in-app form (bug / content / feature / other) with your past feedback and open/resolved status.
- **Resources** — links only to IELTS.org, British Council and IDP free material (never mirrored).
- **Privacy** — recordings stay on-device, no third-party trackers/ads, no data selling.

## Offline-first

Practice content is bundled in the app (`src/content/`, copied from the
web repo at web main `16dfee58`, v0.4.0), so all practice works with no
connection. Attempts are scored on-device and queued locally, then
synced to the server when the device is online and signed in. The API
base URL is configurable in Settings (default
`https://prepsathi-api.onrender.com` — the same API the web app uses;
it runs once Render's free services resume on 1 Dec 2026).

## Stack (latest stable, verified with npm at setup, Nov 2026)

| Piece | Version |
|---|---|
| React Native (new architecture, Hermes, edge-to-edge) | 0.88.1 |
| React | 19.3.1 |
| TypeScript (strict) | 6.0.3 |
| React Navigation | 7.5.2 (+ native-stack 7.21.1) |
| TanStack Query (server state) | 5.107.1 |
| Zustand (client state) | 5.1.0 |
| react-native-mmkv (storage) | 4.3.2 |
| react-native-reanimated | 4.7.1 (+ worklets 0.13.1) |
| react-native-screens / safe-area-context | 4.30.1 / 5.11.1 |
| react-native-nitro-sound (Speaking) | 0.2.20 |
| @dr.pogodin/react-native-fs (recording files) | 2.41.0 |
| @react-native-community/netinfo | 12.0.1 |
| Jest + React Native Testing Library | 29.6.3 + 14.1.0 |
| ESLint (flat config) | 9.39.5 |
| Android | target SDK 36, compile SDK 36, Gradle 9.4.1, Kotlin 2.2.0 |

See [DECISIONS.md](DECISIONS.md) for the version choices that differ
from the first draft of the brief (TypeScript 6 not 5.9, SDK 36/37 not
35, Groovy build files not Kotlin DSL) and why.

## Project structure

```
src/
  features/   auth, dashboard, listening, reading, writing, speaking,
              vocab, mock, feedback, resources, settings
  api/        typed client for the PrepSathi backend + TanStack Query hooks
  lib/        band tables + scoring, spaced repetition, fluency,
              writing feedback, mock rotation, time helpers
  store/      Zustand stores (auth, settings, offline sync) on MMKV
  components/ shared UI primitives (light premium theme)
  theme/      design tokens (ivory #FAF6ED, violet #5B3EA8, gold #B08D2E)
  content/    bundled practice JSONs (copied from the web repo)
  navigation/ typed stack navigator
```

Absolute imports use `@/` (e.g. `@/lib/scoring`).

## Develop

```sh
npm ci --ignore-scripts   # install (native builds need --ignore-scripts here)
npm start                 # Metro dev server
npm run android           # run on an emulator / device (needs Android SDK)
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint flat config
npm test                  # Jest
npm run bundle:android    # Metro JS bundle check (no Android SDK needed)
```

## CI

GitHub Actions (`.github/workflows/ci.yml`): on every push, typecheck +
lint + Jest, then a Gradle `assembleDebug` build. The debug APK is
uploaded as an artifact on every push and attached to a GitHub release
on a `v*` tag. No signing keys are needed for a debug APK — install it
directly on the phone. No Play Store listing exists (that is a later
tap: $25 one-time fee).

## Status

v0.1.0 — first mobile build, all Phase 1–4 web features. Not yet
installed on a real device: the sandbox has no Android SDK, so the APK
is verified by CI only. Real-mic recording, a real 2.5-hour timed mock
and a real-device run are still to verify on Samir's Galaxy A24.
