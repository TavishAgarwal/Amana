# 🛠️ PROJECT REVIEW: AMANA, status on 9 Nov 2026

> **Score if submitted today: 48/100.** Judged on the six official criteria, equal weights (none are published).
> **After fixes 1–2 (applied 9 Nov, uncommitted): about 50/100.** Estimate from the fixes' listed gains, not a full re-score.
> **Projected at the deadline if the top 8 fixes land: about 69/100.** The idea was projected at 68.
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
| **C1** | 🔴 Critical | **The running demo contradicts the core privacy claim.** Both "wallets" live inside one server process, which holds every persona's keys and genes. Anyone can read anyone's carrier genes with no sign-in. | `services/demo-api/demo_api/app.py:24-46`; `curl /api/result/khalid` → `HBB, PAH` | Tech, RAI, Impact |
| **C2** | 🔴 Critical | **Consent can be given on someone else's behalf.** Reveal consent is a persona name in a POST body; anyone can "consent" as Khalid and unlock the reveal. | `app.py:113-127`; `POST /api/reveal/consent {"persona":"khalid"}` → returned genes | RAI |
| **C3** | ✅ Fixed 9 Nov | **The wallet production build fails**, so the wallet can't be deployed and CI lint fails. | `pnpm -C apps/wallet build` → `lib/psi.ts(9,29): error TS7016` | Demo |
| **C4** | 🟠 High | **No two-phone check.** One device chooses both people from a dropdown; the QR code isn't used to join a session; the Node relay (`services/relay/src/server.js`) isn't used by the wallet. Browser PSI exists but isn't wired in. | `apps/wallet/app/[locale]/pair/page.tsx`, `check/page.tsx` | Demo, Tech |
| **C5** | 🟠 High | **No AI is running.** Card rewording is off (no Azure OpenAI), the counsellor "copilot summary" is a fixed template, and the Q&A refuses even "what is thalassaemia?" in English and Arabic. The responsible-AI criterion has no AI to govern. | `docs/model-card.md`; `POST /api/ask` | RAI, Tech |
| **C6** | 🟠 High | **Nothing deployed; no video, no deck.** Judges can't open a link; `deploy-staging.yml` is a stub. | `docs/deployment-guide.md`, `pitch/` | Demo, Scale |
| **C7** | 🟠 High | **No human evidence:** no user test, no clinician review, no native-speaker review, no second red-team reviewer. Understanding and fairness, the main impact metrics, are "not run". | `sim/eval/results.json` | Impact, RAI |
| **C8** | ✅ Fixed 9 Nov | **Numbers disagree across docs**, which a judge will notice. The report says 217 incompatible / 4.34% / 54.6 ms; `results.json` says 271 / 5.42% / 24.9 ms. `data-map.md` still says the panel is a placeholder and ClinVar isn't downloaded. | `docs/evaluation-report.md:7-12`, `docs/data-map.md`, `sim/eval/results.json` | Tech, RAI |
| **C9** | ✅ Fixed in docs 9 Nov | **The panel has 111 genes, not 570**, and card coverage is 51.7% of simulated incompatible couples. Fine if stated; wrong if the pitch says "570 genes". | `packs/abu-dhabi/panel.csv` (113 lines) | Impact |
| **C10** | 🟡 Medium | **Commercial case is thin:** no price per screened person, no market size, no buyer journey. | `pitch/pilot-proposal.md` | Commercial |
| **C11** | 🟢 Low | **Six commits not pushed**; CI on GitHub hasn't run on the latest code. | `git status` | Demo |
| **C12** | 🟢 Low | **The step-1 yes/no result passes through the server**, so a cheating client could lie (listed as a known gap). | `docs/threat-model.md` | Tech |

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

C11 (unpushed commits) is still open: nothing was pushed.

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
| After fixes, 9 Nov: ruff · pytest · pnpm lint · pnpm test · both builds | All pass (33 Python, 13 JS tests) |
