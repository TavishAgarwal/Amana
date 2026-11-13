# AMANA: Assumptions, dependencies, limitations

## What was built (verified by tests in this repo)
Lab issuer, national token service, synthetic population (calibrated to 4.8%), private check with OpenMined PSI 2.0.6 (count-only and intersection mode), in-process and Node relays, attack demo, consent ledger with hash-chained audit (memory and Postgres), case routing and sign-off rules, mock adapters, explainer with fact-checker, 15 cards, 100-prompt red-team set, evaluation harness, country-pack config swap.

## Apps (built; browser-tested on desktop and at phone size)
`apps/wallet` (Arabic right-to-left and English, light/dark, installable) and `apps/console`, backed by
`services/demo-api` and `services/relay`. Screens follow `docs/design.md`: bottom tab bar (My result,
Check together, Sharing, Help), PrivacyNote, same-layout result panel, condition card in sections with the
four-children inheritance diagram, consent sheets that list what, who, how long and how to undo.

Built and checked on 9 Nov 2026 in two browser tabs with separate storage (`localhost` and `127.0.0.1`)
against the real relay and the local AI:
- **Private check between devices.** Each phone holds its own lab-signed result and national tokens,
  bound to a non-extractable device key, encrypted in IndexedDB. The check runs in the browser
  (`psi.js` 2.0.6) over the relay. Mariam + Khalid: both phones computed "shared"; after both agreed,
  each saw HBB only.
- **Programme mode** (I-F13): the lab-signed credential can carry the programme's couple result.
  "Compatible" shows the person's own carrier cards; "not compatible" offers a counsellor (Tier 3).
- **Help**: self-serve cards and questions (Tier 1), "ask a counsellor a question" (Tier 2, 24 h), and
  one-to-one booking with slots from the country pack's directory (Tier 3, 48 h). The person may
  also share the condition name, unticked by default. The counsellor's note appears to the person only
  after sign-off, labelled as clinical advice.
- **Anonymous family invites** (I-F9): a link whose page shows no sender, no gene and no condition;
  only totals are counted; the sender can revoke it.
- **Counsellor console**: queue with tier, status and language filters and a time-left bar; case
  detail shows only the consented scope, the shared card, the question, neutral options and the
  AI draft (labelled); sign-off needs a "reviewed" tick. Opening a case is written to the person's log;
  the queue's polling is not (it returns no personal data).
- **Understanding study** (`/study`) and dashboard: before (lab letter) vs after (card), by language and
  reading comfort, groups under 5 hidden; synthetic demo answers are kept in a separate, labelled source.
- **AI**: questions and "simpler words" are answered **on the phone** and never sent. Every phone gets
  rules (~40 KB); phones with 1 GB of memory or more can add a 4.9 MB multilingual model after agreeing
  to the download (37/40 relevance against 13/40 for rules). On the server, local `llama3.1:8b` drafts
  counsellor notes and runs the server copy of the question path (`docs/model-card.md`).

- **Check codes renew**: national tokens change every 7 days. A wallet with last week's codes says so
  and renews them by signing in again, instead of failing; a partner with old codes gets a clear message.
- **Containers and deploy files**: Dockerfiles for every service, `docker-compose.stack.yml` for the whole
  demo, an Azure Container Apps template limited to UAE regions, and a manual deploy workflow
  (`docs/deployment-guide.md`). Not deployed.
- **Load test** (`loadtest/`, results in `loadtest/results.json`): national token service and relay on
  one 10-core laptop (`docs/evaluation-report.md`).
- **UAE rules map** (`docs/compliance.md`) and an automated accessibility check (`scripts/a11y.mjs`).

Tests: `apps/wallet/tests` (28, incl. on-device answer safety and tokenizer parity, two wallets over
the real relay and Python–browser signing interop), `services/relay/tests` (6, incl. `wss://`), Python
suite (57).

## NOT built or NOT done
- **Two real phones not yet tested.** `scripts/two-phones.sh` starts the whole setup over Wi-Fi with
  HTTPS and `wss://` in one command (`docs/lan-testing.md`), and the automated two-browser test passes
  through it at the laptop's Wi-Fi address (`node scripts/e2e.mjs https://<ip>:3443`). The run with two
  physical phones and the camera has not been done.
- **On-device answers not tested on real low-end phones.** The weak-phone path (rules only) is chosen
  from what the browser reports (`navigator.deviceMemory`, storage estimate); Safari reports neither,
  so iPhones are always offered the model. Memory and timing figures are from a laptop.
- **End-to-end test covers the couple check only** (`scripts/e2e.mjs`: two browsers sign in, pair with
  the text code, check, reveal; also asserts no gene name reaches the API). Booking, sharing, invites
  and the console are checked by hand and by the accessibility run, not by an end-to-end test. It is not
  in CI yet (it needs the running stack and Chrome).
- **Accessibility:** `scripts/a11y.mjs` (axe-core 4.14, WCAG 2.2 A/AA rules) found **0 violations on 58
  screens** (wallet at phone width and console, English and Arabic, light and dark), no sideways
  scrolling at 200% text, and no control under 44 × 44 px (`docs/review/a11y-results.json`, 10 Nov
  2026). Automated rules find only part of the problems: no manual screen-reader test
  (VoiceOver/TalkBack) yet. No read-aloud. Arabic copy is not yet gender-aware (masculine/neutral forms
  only).
- **Study not run**: no real participants yet (`docs/study-kit.md`). The dashboard's "synthetic" source
  is made-up data with an assumed effect, only to show the pipeline.
- **Azure:** nothing deployed (student credit conserved); no Key Vault. The AI runs locally (Ollama).
- **Human work not done:** clinical advisors, native-speaker review of Arabic (`docs/review-packet.md`),
  user test, two-reviewer red-team review, video, deck.
- Demo API keeps everything in memory (restart resets it); counsellor sign-in is a mock selector.
- The partner check cannot stop a person from running many checks with different partners over time;
  each session answers one count and one reveal request, and only within that session.
- Load test (`loadtest/results.json`): token service and relay measured on one laptop, with the load
  client on the same machine, so the top figures are limited by the laptop, not the services. Not run
  on Azure or with phones on real networks. One relay copy only: more copies would need shared
  sessions. The older k6 scenario (`loadtest/scenarios/`) was not run; `loadtest/relay-load.mjs`
  replaces it.
- **Panel size:** the real Abu Dhabi programme screens 570 genes; the prototype panel has **111**. The official 570-gene list was not available, so how far the two overlap is unknown. Say "111 genes" for anything the prototype does.
- Gene panel is now real (111 autosomal-recessive genes with ≥5 ClinVar pathogenic/likely-pathogenic alleles; inheritance is a hand-curated list, not read from ClinVar, and needs clinical review). Frequencies: relative gene frequencies now come from gnomAD v4 (Middle Eastern group) x ClinVar pathogenic/likely-pathogenic variants (`packs/abu-dhabi/frequencies.csv`), scaled so couples hit the 4.8% target; couples are still simulated. These are **under-estimates**: they count only variants present in both ClinVar and gnomAD, the Middle Eastern group is small (about 2,900 people) so rare genes are noisy (10 genes have none and fall back to pooled frequency), gnomAD under-represents Arab and consanguineous populations, and variants above 2% pooled frequency are dropped as artefacts or low-penetrance alleles. **CTGA is not used**: it is a catalogue of variants reported in Arab populations, not carrier frequencies, and no download terms were found; real Arab-population frequencies need a data-sharing agreement with the Center for Arab Genomic Studies or a national genome programme; cards are `pending clinical review`; understanding and fairness metrics unavailable.
- Honest-but-curious assumption; patent check and Emirati Genome Programme status not verified.
- Deviations: Python packages named `token_service` etc. instead of `app/`; own tiny i18n and plain CSS instead of next-intl/Tailwind; demo-api added.
