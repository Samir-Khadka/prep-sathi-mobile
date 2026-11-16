# Changelog

## v0.1.0 — 2026-11-16

First mobile build. Full parity with the PrepSathi web app through
Phase 4 (web main `16dfee58`).

- React Native 0.88.1 (new architecture, Hermes, edge-to-edge) + React
  19.3.1 + TypeScript 6.0.3 strict + React Navigation 7 + TanStack Query
  5 + Zustand 5 + react-native-mmkv 4 + Reanimated 4.
- Auth (email + password, JWT), dashboard, target-band tracking.
- Listening (4 tests, 160 questions), Reading (4 Academic + 1 GT, 200
  questions), Writing (20 prompts + feedback by the four criteria),
  Speaking (15 sets, on-device recording + playback history),
  Vocabulary (250 words, spaced repetition).
- Full mock sittings in test order with server-side-equivalent local
  clocks; overall band with IELTS rounding.
- Feedback loop, official-resources hub (links only), privacy note.
- Offline-first: bundled content, on-device scoring, attempts queued
  in MMKV and synced when online; API base URL configurable.
- CI: typecheck + ESLint flat config + Jest on every push; Android
  debug APK built in GitHub Actions, attached to releases on `v*` tags.
