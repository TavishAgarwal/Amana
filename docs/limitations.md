# AMANA: Assumptions, dependencies, limitations

## What was built (verified by tests in this repo)
Lab issuer, national token service, synthetic population (calibrated to 4.8%), private check with OpenMined PSI 2.0.6 (count-only and intersection mode), in-process and Node relays, attack demo, consent ledger with hash-chained audit (memory and Postgres), case routing and sign-off rules, mock adapters, explainer with fact-checker, 15 cards, 100-prompt red-team set, evaluation harness, country-pack config swap.

## Apps (built, browser-tested on desktop only)
`apps/wallet` (Arabic right-to-left and English, light/dark, installable manifest, QR pairing code, my result, card + teach-back, check, two-step reveal, sharing/revoke/audit, withdraw-all) and `apps/console` (tier queue, case + sign-off, dashboard, attack demo), backed by `services/demo-api` (Gate 1 fallback: wallet logic runs in the Python helper). Verified by walking the demo flow in a browser and by `services/demo-api/tests`.

## NOT built or NOT done
- **Tested in the iOS Simulator only** (iPhone 17, iOS Safari and as a home-screen web app: Arabic RTL, English, dark mode, full flow incl. sharing/revoke) — not on real phones. Home-screen install works (manifest + icons, standalone, safe-area padding), and a service worker caches only the app shell and shows a bilingual offline page when there is no connection (verified on iOS with the server stopped; /api and health data are never cached) — the app still needs the helper API for anything real; camera QR scan is built (jsQR; decoding verified with a round-trip test, but a live camera was not tested because the simulator has none; it falls back to the shown code); optional PIN app lock with the cached result encrypted on the device (AES-GCM, PBKDF2 310k iterations, tested), while the real state still lives in the helper API; automated axe-core WCAG 2.1 AA scan found 0 violations on 6 wallet pages (ar + en), but no manual screen-reader (VoiceOver/TalkBack) test, Arabic strings are drafts, no read-aloud, booking screen, or family invites.
- **No automated browser end-to-end tests of the full flow** (the wallet has unit tests for the vault and QR decoding; the flow itself was checked by hand in the simulator).
- **Browser PSI (`psi.js`) was never tested**; the helper-service fallback is used.
- **Azure:** nothing deployed (student credit conserved); no Key Vault; no Azure OpenAI, so no AI rewording.
- **Human work not done:** clinical advisors, native-speaker review of Arabic, user test (n>=20), two-reviewer red-team review, video, deck.
- Load test (`docs/evaluation-report.md`): single-core Python run, 100,000 extrapolated; k6 relay scenario written but not run; no AED cost.
- Gene panel is now real (111 autosomal-recessive genes with ≥5 ClinVar pathogenic/likely-pathogenic alleles; inheritance is a hand-curated list, not read from ClinVar, and needs clinical review). Carrier frequencies and couples are still synthetic (no gnomAD/CTGA frequencies downloaded; the Arab-population frequencies need CTGA data from a data owner); cards are `pending clinical review`; understanding and fairness metrics unavailable.
- Honest-but-curious assumption; patent check and Emirati Genome Programme status not verified.
- Deviations: Python packages named `token_service` etc. instead of `app/`; own tiny i18n and plain CSS instead of next-intl/Tailwind; demo-api added.
