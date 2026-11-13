# 🛠️ PROJECT REVIEW: AMANA, status on 9 Nov 2026

> **Score if submitted today: 48/100.** Judged on the six official criteria, equal weights (none are published).
> **After fixes 1–2 (9 Nov): about 50/100.** **After fixes 3–4 (9 Nov, uncommitted): about 53/100** (Tech 7 · Demo 4.5 · RAI 6.5; others unchanged). Estimates, not a full re-score. Fix 3's full gain needs real phones, which needs HTTPS and comes with deployment (fix 5).
> **Projected at the deadline if the top 8 fixes land: about 69/100.** The idea was projected at 68.
> **After round 3 (9 Nov, "complete the product", uncommitted): about 63/100** (Impact 6.5 · Tech 7.5 · Demo 5.5 · RAI 7.5 · Scale 5 · Commercial 6). Estimate, not a blind re-score. The remaining big gains need things the user has paused or that need people: deployment + video (C6, about +4), and a user test plus clinician and Arabic review (C7, about +4).
> **After round 5 (10 Nov, code-only path to 80, uncommitted): about 70/100** (Impact 6.5 · Tech 8.5 · Demo 6 · RAI 8 · Scale 6.5 · Commercial 6.5). Estimate, not a blind re-score. The rest of the way to 80 needs the paused deployment + video + deck (about +5) and people: user test, clinician and Arabic review, a partner letter (about +5).
> **Reviewed:** git `main` at `1dae2f8` (23 commits, all 9 Nov 00:41–01:41, about 8,200 lines). Six commits are **not pushed** to `github.com/TavishAgarwal/Amana`.
> **Method:** read the code and docs; ran every test suite, lint and both production builds; started the demo API and probed every endpoint with curl. **Not checked:** the UI in a browser (only API and build checked), real phones, GitHub CI runs (`gh` not installed).

---

## 1. Score

| Criterion | Weight | Score /10 | Points | Why, in one line |
|---|---|---|---|---|
| Health impact & clinical relevance | 17 | 5.5 | 9.4 | Strong, sourced problem; but no user evidence, no clinician, every card "pending clinical review", 111 of 570 genes |
| Technical depth & architecture | 17 | 6.0 | 10.2 | Real, tested cryptography and data pipeline; but the running app doesn't use the on-device design, and the wallet build fails |
| Working solution & demo | 17 | 3.5 | 6.0 | Runs only on a laptop; one device plays both people; QR is decorative; nothing deployed; no video |
| Responsible AI, safety & governance | 17 | 5.5 | 9.4 | Excellent honest docs and safety rules; but no AI is switched on, and the demo server has no sign-in and holds everyone's genes |
| Scalability & deployment | 16 | 4.5 | 7.2 | Good design (national token service, country packs, cost model); nothing deployed, load test single-core and partly extrapolated |
| Commercial viability & path to pilot | 16 | 3.5 | 5.6 | 1-page pilot draft and hosting estimate only; no pricing, market size, deck or partner |
| **Total** | 100 | | **47.7 → 48** | |

---

## 2. What is good (verified)

- **Tests pass:** 33 Python tests (services, privacy suite against Postgres) and 10 JS tests. Ruff lint is clean.
- **Real cryptography, used correctly:**
  - The national token service refuses unregistered labs and genes missing from the credential.
  - Forged token sets are rejected.
  - Replay and expiry tests exist.
  - Sets are padded to 128 items, so their size doesn't leak.
- **The attack demo works** (`GET /api/attack`). Plain hash matching leaks `HBB, PAH`; AMANA leaks nothing; both cheat attempts are rejected with a reason.
- **Browser PSI works.** `psi.js` 2.0.6 was interop-tested against the Python library in both directions, in count and reveal modes.
- **Real data pipeline:** a 111-gene panel built from ClinVar, and gene frequencies from gnomAD v4's Middle Eastern group joined with ClinVar. Licences are respected; CTGA was rightly not scraped.
- **Evaluation numbers:** 5,000 couples, 0 missed, 0 false alarms; every couple issued by two different labs; 1,000 of 1,000 cases routed to the correct tier.
- **Safety rules hold:**
  - Labelling a case "clinical advice" before sign-off returns `sign_off_required`.
  - "Should I marry my cousin?" gets a neutral refusal in English and Arabic.
- **`docs/limitations.md` is unusually honest**, a strong point for the responsible-AI criterion.

---

## 3. Findings, most severe first

| ID | Severity | Finding | Evidence | Hurts |
|---|---|---|---|---|
| **C1** | ✅ Fixed 9 Nov | **The running demo contradicts the core privacy claim.** Both "wallets" live inside one server process, which holds every persona's keys and genes. Anyone can read anyone's carrier genes with no sign-in. | `services/demo-api/demo_api/app.py:24-46`; `curl /api/result/khalid` → `HBB, PAH` | Tech, RAI, Impact |
| **C2** | ✅ Fixed 9 Nov | **Consent can be given on someone else's behalf.** Reveal consent is a persona name in a POST body; anyone can "consent" as Khalid and unlock the reveal. | `app.py:113-127`; `POST /api/reveal/consent {"persona":"khalid"}` → returned genes | RAI |
| **C13** | ✅ Found and fixed 9 Nov | **Protocol flaw: the hello leaked every token to the partner**, letting a partner match directly and skip the count-only step and both consents | old `sim/eval/protocol.py` `Wallet.hello` | Tech, RAI |
| **C3** | ✅ Fixed 9 Nov | **The wallet production build fails**, so the wallet can't be deployed and CI lint fails. | `pnpm -C apps/wallet build` → `lib/psi.ts(9,29): error TS7016` | Demo |
| **C4** | ✅ Fixed 9 Nov (laptop; real phones need HTTPS) | **No two-phone check.** One device chooses both people from a dropdown; the QR code isn't used to join a session; the Node relay (`services/relay/src/server.js`) isn't used by the wallet. Browser PSI exists but isn't wired in. | `apps/wallet/app/[locale]/pair/page.tsx`, `check/page.tsx` | Demo, Tech |
| **C5** | ✅ Fixed 9 Nov (local model) | **No AI is running.** Card rewording is off (no Azure OpenAI), the counsellor "copilot summary" is a fixed template, and the Q&A refuses even "what is thalassaemia?" in English and Arabic. The responsible-AI criterion has no AI to govern. | `docs/model-card.md`; `POST /api/ask` | RAI, Tech |
| **C6** | 🟠 High (paused by the user) | **Nothing deployed; no video, no deck.** Judges can't open a link; `deploy-staging.yml` is a stub. | `docs/deployment-guide.md`, `pitch/` | Demo, Scale |
| **C7** | 🟠 High (kits ready, people needed) | **No human evidence:** no user test, no clinician review, no native-speaker review, no second red-team reviewer. Understanding and fairness, the main impact metrics, are "not run". | `sim/eval/results.json` | Impact, RAI |
| **C8** | ✅ Fixed 9 Nov | **Numbers disagree across docs**, which a judge will notice. The report says 217 incompatible / 4.34% / 54.6 ms; `results.json` says 271 / 5.42% / 24.9 ms. `data-map.md` still says the panel is a placeholder and ClinVar isn't downloaded. | `docs/evaluation-report.md:7-12`, `docs/data-map.md`, `sim/eval/results.json` | Tech, RAI |
| **C9** | ✅ Fixed in docs 9 Nov | **The panel has 111 genes, not 570**, and card coverage is 51.7% of simulated incompatible couples. Fine if stated; wrong if the pitch says "570 genes". | `packs/abu-dhabi/panel.csv` (113 lines) | Impact |
| **C10** | ✅ Fixed 9 Nov (`docs/commercial-case.md`) | **Commercial case is thin:** no price per screened person, no market size, no buyer journey. | `pitch/pilot-proposal.md` | Commercial |
| **C11** | 🟢 Low | **Six commits not pushed**; CI on GitHub hasn't run on the latest code. | `git status` | Demo |
| **C12** | ✅ Fixed 9 Nov | **The step-1 yes/no result passes through the server**, so a cheating client could lie (listed as a known gap). | `docs/threat-model.md` | Tech |
| **C14** | ✅ Found and fixed 10 Nov | **Token service made a new random national key at every start**, so two copies (or one restart) issued tokens that never match: every check in progress would fail | old `token_service/app.py` `new_service()` | Scale, Tech |
| **C15** | ✅ Found and fixed 10 Nov | **Each audit write read the whole audit table**, so writes slow down as the log grows | old `consent_ledger/core.py` `_audit` | Scale |
| **C16** | ✅ Found and fixed 10 Nov | **Relay rate limit behind a load balancer** counted the proxy's address, so all users would share one limit | old `relay/src/server.js` | Scale |
| **C17** | ✅ Found and fixed 10 Nov | **Check codes expire after 7 days with no way to renew**; the check then failed with a raw error | `pair/page.tsx`, `lib/device.ts` | Demo, Impact |
| **C18** | ✅ Found and fixed 10 Nov | **Accessibility:** step counter used a label screen readers may ignore (14 axe findings) | `components/ui.tsx` `Steps` | RAI |

---

## 4. Fixes ranked by points per hour

| # | Fix | Effort | Gain (est.) | Closes |
|---|---|---|---|---|
| 1 | Add a type declaration for `@openmined/psi.js/psi_wasm_web`; build passes; push all commits | 15 min | +1 | C3, C11 |
| 2 | Fix the doc mismatches: regenerate `evaluation-report.md` from `results.json`; update `data-map.md`; say "111 genes" everywhere | 1 h | +1 | C8, C9 |
| 3 | **Move genes off the server:** credential and tokens delivered to the phone and kept in the vault; the browser runs `psi.js` over the Node relay; the QR carries the relay session; two real phones | 1.5–2 days | +5 | C1, C4, C12 |
| 4 | Sign every consent with the device key (or at least require the mock sign-in token) | 0.5 day | +2 | C2 |
| 5 | Deploy (Azure Container Apps, or any free host for the prototype) + record the 3-minute video + backup recording | 1 day | +4 | C6 |
| 6 | Turn on AI: LLM rewording and a real copilot summary, both through the fact-checker; rerun the red-team against the live model; fix the Q&A retrieval | 1 day | +3 | C5 |
| 7 | User test (even n = 10–12 with persona cards); 1 clinician to review the top 5 cards; 1 native speaker to review Arabic | 2–3 days, mostly D | +4 | C7 |
| 8 | Pitch deck + pilot proposal with price per screened person, Abu Dhabi and Gulf market size, named buyer journey | 1 day | +2 | C10 |

**If 1–8 land by 19 Nov:** about 69/100 (Impact 7 · Tech 7.5 · Demo 7.5 · RAI 7.5 · Scale 6 · Commercial 5.5).

---

## 5. Fixes applied (9 Nov, not committed or pushed)

| Fix | What changed | Verified by |
|---|---|---|
| 1 (C3) | Added `apps/wallet/psi-wasm-web.d.ts`, which points `@openmined/psi.js/psi_wasm_web` at the library's own `wasm_web.d.ts` types | `pnpm lint` passes; `pnpm -C apps/wallet build` passes with type-check |
| 2 (C8) | Re-ran the evaluation harness: results reproduced exactly. `evaluation-report.md` now copies `results.json` (271 incompatible, 5.42%, 24.9 ms). `cost-model.md` uses 24.9 ms and 0.69 core-hours. `data-map.md` rewritten: real ClinVar panel, gnomAD frequencies, CTGA not used, and an honest note that the current demo keeps genes on the server | Harness exit 0; numbers grep-checked across `docs/`, `pitch/`, `README.md` |
| 2 (C9) | "570 genes" kept only where it describes the real programme. Prototype wording says "every gene on the panel" or `{n}` from the country pack (111). Test renamed `test_forged_all_panel_genes_rejected`. `limitations.md` states the 111 vs 570 gap | 33 Python tests pass |

| 3 (C1, C4, C12) | Check moved onto the devices. Result and tokens delivered once per device key after mock sign-in, kept encrypted in IndexedDB; browser `psi.js` over the Node relay; the QR carries the relay session; check runs once in each direction so each phone computes its own answer; one count and one reveal request per session. Demo API keeps no wallets; gene endpoints removed | `check.test.mjs` (two wallets over the real relay), `device.test.mjs`, demo-api tests, harness (5,000 couples, both sides agree on all), two-tab browser run: both "shared", reveal HBB only after both agreed, server log shows no check traffic |
| 4 (C2) | Every consent, revoke and log read is signed by the device key (non-extractable Ed25519); the server verifies it | `test_consent_must_be_signed_by_the_holder`, `sign-interop.test.mjs` (Python ↔ browser), forged consent → 403 |
| C13 (new) | Found while doing fix 3: the old hello sent the full token set to the partner, who could match tokens directly and skip the count-only step and both consents. Hello now carries only a national attestation and a session signature | `test_hello_carries_no_tokens`; relay traffic scanned for tokens in `check.test.mjs` |

C11 (unpushed commits) is still open: nothing was pushed.

**Still open after fixes 3–4:** real two-phone test (needs HTTPS + `wss://`, fix 5); count-only PSI lets a partner submit one of its own genes to test it within a session (limited by one request per session and in-person pairing; listed in `docs/threat-model.md`).

## 5b. Round 3 applied (9 Nov, "complete the product"; deck, video and deployment excluded by the user)

| Area | What changed | Verified by |
|---|---|---|
| C5 AI | Local `llama3.1:8b` (Ollama, OpenAI-compatible client). For people, the AI **selects** reviewed sentences (never writes): question answering, "read in simpler words". For counsellors, it **drafts** case notes, gated (no directive words, no new numbers) and labelled; sign-off required. Decision questions never reach the model. Free rewording was tried and dropped: the 8B model lost qualifiers like "for each pregnancy" | `test_explainer.py` (fake misbehaving model), red-team with the live model, browser run |
| Programme mode (I-F13) | Credential carries the lab-signed couple result; same-layout result panel for compatible / not compatible; not compatible routes to Tier 3 | `test_programme_result_is_lab_signed_and_routes_incompatible_to_tier_3`, browser (Layla) |
| Booking, Tier 2 | Help tab: ask a counsellor (Tier 2, 24 h), one-to-one booking with slots from the pack directory (Tier 3, 48 h), optional condition name (unticked by default); note shown to the person only after sign-off | 4 new demo-API tests, browser run end to end |
| Family invites (I-F9) | Invite link page shows no sender, gene or condition; totals only; revocable | `test_family_invite_shows_nothing_about_the_sender_and_can_be_revoked` |
| Study + dashboard (I-F10) | `/study`: lab letter → card, same 3 questions; dashboard paired bars by language and reading comfort, groups under 5 hidden, synthetic data in a separate labelled source | `test_study_hides_small_groups_and_keeps_synthetic_apart`, browser |
| UI to design spec | Bottom tab bar, PrivacyNote, ResultPanel, ConditionCard sections, InheritanceDiagram, ConsentSheet, Ask box, settings (text size, confirm-before-delete), app-switcher blur; console side nav, filters, SLA bar, case scope, sign-off with "reviewed" tick | Both production builds; browser at 375 px (EN + AR RTL) and desktop |
| Privacy fix found in testing | The console's 2 s queue poll wrote "access allowed" into the person's log every time. Now only real case reads are logged; the queue returns no personal data | `test_other_counsellor_cannot_open_the_case_and_opening_is_logged` |
| LAN HTTPS | Relay serves `wss://` with `TLS_CERT`/`TLS_KEY`; `scripts/lan-cert.sh`; wallet `dev:lan`; `docs/lan-testing.md`. Real two-phone run still to do | relay TLS test |
| On-device answers (round 4) | The wallet answers questions and "simpler words" on the phone; questions are never sent. Every phone gets rules (~40 KB index exported from the explainer); phones with 1 GB+ may add a 4.9 MB static multilingual model, only after a yes (size shown, mobile-data warning, SHA-256 checked, cached, removable). Relevance 37/40 vs 13/40 for rules, held-out 19/24 (e5-small, 135 MB: 39/40, 19/24, not shipped). Same 0 directive / 0 unsupported on the red-team set | `apps/wallet/tests/ask.test.mjs` (9 tests incl. tokenizer parity with transformers.js), `test_phone_index_is_up_to_date`, browser at 375 px (EN + AR, download, offline from cache, remove) |
| Docs | `model-card.md`, `study-kit.md`, `review-packet.md` (+ `docs/review/cards-review.csv`, 258 sentences), `commercial-case.md` (pricing, sourced volumes, pilot proposal), architecture API table, data map, threat model | — |

## 5c. Round 5 applied (10 Nov, the code-only fixes toward 80)

| Area | What changed | Verified by |
|---|---|---|
| Scaling fixes (C14–C16) | National keys and lab registry from Key Vault or a 0600 key file (atomic create, so workers starting together agree); production refuses to start without keys; lab API keys stored as hashes. Audit write reads only the last row. Relay: proxy-aware rate limit (`TRUST_PROXY`), `/healthz`, 256 KB message cap, sweep of idle limits and abandoned sessions | 2 token tests, 1 ledger test, 2 relay tests |
| Load test | `loadtest/run.sh`: token service 2,983/s (1 worker) to about 4,900–5,000/s (4–8 workers), p95 20–56 ms; relay up to 3,176 couples/s on one core with real message sizes, p95 41 ms; 0 errors, 0 token mismatches across workers. Client on the same laptop | `loadtest/results.json` |
| Containers + deploy | Dockerfiles (API x86-64 because of the PSI wheels), `docker-compose.stack.yml`, Azure Container Apps template locked to UAE regions with Key Vault secrets, manual OIDC deploy workflow, CI job for infra | 5 images built; stack ran and answered; `az bicep build` clean; nothing deployed |
| Check codes renew (C17) | Old token sets are detected; "Renew check codes" signs in again; a partner with old codes gets a clear message | `device.test.mjs` |
| Accessibility (C18) | `scripts/a11y.mjs`: 58 screens, EN + AR, light + dark: **0 WCAG violations**, no sideways scroll at 200% text, no target under 44 px | `docs/review/a11y-results.json` |
| End-to-end | `scripts/e2e.mjs`: two browsers sign in, pair, check, reveal; no gene name sent to the API; passes on the container stack and over Wi-Fi HTTPS + `wss://` | 2 runs, both ok |
| Two phones | `scripts/two-phones.sh` on its own ports; phone run itself still needs the user | e2e at `https://192.168.1.8:3443` |
| Compliance | `docs/compliance.md`: Law 2/2019, PDPL, Genome law 49/2023, ADHICS, DoH privacy standard, DoH Responsible AI Standard → 25 controls with status; 4 gaps and 5 questions for DoH; incident plan | sources 72–81 |
| Commercial | `pitch/pilot-proposal.md`: standalone proposal with sample-size reasoning, couple-level randomisation, budget (≈272,000 AED, assumed), go/no-go. Hosting range corrected to 0.11–0.28 AED per couple (always-on containers) | — |

## 6. Run log

| Command | Result |
|---|---|
| `uv run ruff check .` | All checks passed |
| `uv run pytest -q` (Postgres up) | 33 passed |
| `pnpm lint` | **Failed**: wallet `tsc` TS7016 |
| `pnpm test` | 10 passed (PSI interop, vault, QR) |
| `pnpm -C apps/wallet build` | **Failed**: TS7016 |
| `pnpm -C apps/console build` | Passed |
| Demo API probes (port 18765) | Results in §3 (C1, C2, C5) and §2 |
| After fixes 1–2, 9 Nov: ruff · pytest · pnpm lint · pnpm test · both builds | All pass (33 Python, 13 JS tests) |
| After fixes 3–4, 9 Nov: same, plus harness re-run and two-tab browser run | All pass (40 Python, 21 JS tests); harness 0 missed, 0 false alarms, 0 disagreements, 45.7 ms per two-way check |
| After round 4 (on-device answers), 9 Nov: ruff · pytest · relay · wallet tests · both tsc · both builds · browser | All pass (54 Python, 4 relay, 27 wallet tests) |
| After round 5, 10 Nov: ruff · pytest · relay · wallet tests · both tsc · both builds · load test · docker build + stack smoke test · `az bicep build` · a11y · e2e (stack and LAN HTTPS) | All pass (57 Python, 6 relay, 28 wallet tests); a11y 0 violations on 58 screens; e2e ok twice |
| After round 3, 9 Nov: ruff · pytest · pnpm lint · pnpm test · both builds · harness with `llama3.1:8b` on · browser run (EN + AR at 375 px, console at desktop, two-origin check + reveal + booking + sign-off) | All pass (53 Python, 22 JS tests); harness 0 missed, 0 false alarms, 0 disagreements, 46.2 ms per two-way check; red-team with the live model 0 directive, 0 unsupported, 22/22 benign answered |
