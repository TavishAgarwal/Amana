# AMANA: Implementation Plan

> **What this is:** the build plan for AMANA, from today (Wed 4 Nov 2026) to the prototype deadline (Fri 20 Nov 2026). No code here, only what to build, in what order, by whom, and how we know each piece is done.
> **Source spec:** `blaze/idea/IDEA.md` (features I-F1..I-F11). This plan **adds the scalability changes agreed on 4 Nov** (new features I-F12..I-F16) and changes I-F1 so tokens come from one national token service instead of each lab.
> **Team (assumed):** A = ML/LLM · B = full-stack (wallet + private check) · C = full-stack (backend + console + infra) · D = design + clinical content + pitch.
> **Time budget (assumed):** about 250 person-hours in total, about 3.5–4 hours per person per day, part-time. If the team has more time, pull stretch items forward; if less, cut in the order given in §11.

---

## 0. What changed since IDEA.md

| Change | Why | Effect on the plan |
|---|---|---|
| **National token service** (I-F12) replaces per-lab token keys | With one key per lab, two people tested at different labs get non-matching tokens and the check wrongly says "no shared risk" | Issuer split into two parts: lab issuer (signs results) and national token service (makes tokens with one shared key) |
| **Two modes** (I-F13): Programme mode + Private mode | AMANA must help every tested person, not only couples who run the private check | The wallet accepts a second credential type: "programme result" (couple match done by the lab, as today) |
| **Integration adapters** (I-F14): national ID sign-in, health-records exchange | Judges score deployment readiness; reuse existing national systems rather than a new app | Mock sign-in provider and a mock records-exchange adapter, behind clean interfaces |
| **Tiered counselling** (folded into I-F7) | Counsellors, not servers, are the real limit | Console routes cases into 3 tiers |
| **Content pipeline** (I-F15) | 25 hand-made cards don't cover 840+ disorders | Draft → clinician review → publish workflow, with coverage metric |
| **Country packs** (I-F16) | Gulf expansion must be config, not code | Gene panel, languages, rules and directory loaded from one config bundle |
| **Scale panel** (added to I-F10) | Scalability needs numbers | Load test of 100,000 simulated couples; cost per couple; cross-lab test |

---

## 1. Scope

### 1.1 Feature list (MVP = must ship by 19 Nov)

| ID | Feature | MVP / Stretch | Owner | Done when (acceptance) |
|---|---|---|---|---|
| I-F1 | Lab issuer: signs a person's carrier credential (genes + programme result) | MVP | C | Credential signature verifies with the lab public key; a changed byte fails verification |
| I-F12 | National token service: makes per-gene tokens with one national key; only accredited labs can call it | MVP | C | Same gene from Lab A and Lab B gives the same token; an unregistered lab is refused; tokens change when the period (epoch) changes |
| I-F2 | Synthetic population generator (cousin-marriage aware) | MVP | A | Simulated incompatible-couple rate within ±1.5 points of 4.8% at a stated cousin-marriage mix; same seed → same population |
| I-F3 | Wallet web app (Arabic right-to-left + English), encrypted on the device | MVP | B | Stored credential unreadable without the device key; installable as an app; no English text on core Arabic screens |
| I-F13 | Programme mode: wallet shows the lab's official couple result + explainer + next steps | MVP | B | A "compatible" carrier still gets their own carrier card and education; an "incompatible" couple gets routed to Tier 3 |
| I-F4 | Private mode: couple check by private set intersection over a relay, QR pairing | MVP | B | 1,000 synthetic couples: every shared-gene couple found, no false alarms; relay logs hold no gene names; forged tokens rejected |
| I-F5 | Two-step consent reveal + tamper-evident audit log | MVP | C | Revoked permission blocks later access; editing any log entry breaks the chain check |
| I-F6 | Explainer + teach-back (curated cards; AI only rewords; fact-checker) | MVP | A + D | 0 unsupported claims on the 100-prompt red-team set; every card has sources and a reviewer status |
| I-F7 | Counsellor console with 3 tiers, copilot summary, mandatory sign-off | MVP | C | Case appears within 5 s of consent; routed to the right tier; "clinical advice" label impossible without sign-off |
| I-F8 | Attack demo: "claim all 570 genes" is rejected | MVP | B | Scripted attack fails with a logged reason; side-by-side with plain PSI showing the leak |
| I-F14 | Integration adapters: mock national-ID sign-in; mock health-records exchange delivering results in FHIR format | MVP (mock) | C | Sign-in works through the adapter; swapping the mock for a real provider needs config only; result arrives as a valid FHIR bundle |
| I-F10 | Evaluation + scale dashboard | MVP | A | Shows comprehension before/after, fairness by language/literacy (cells <5 hidden), privacy test results, load-test results, cost per couple |
| I-F15 | Content pipeline: draft → review → publish, coverage % | MVP (lite) | D + A | 25 cards reviewed; dashboard shows the share of simulated incompatible matches covered by reviewed cards |
| I-F16 | Country packs (Abu Dhabi live; a second "demo country" pack) | MVP (lite) | C | Switching pack changes gene panel, language default and counsellor directory with no code change |
| I-F9 | Anonymous family invites | Stretch | B | Invite page shows no sender and no gene |
| I-F11 | Arabic read-aloud of cards | Stretch | D | Every card playable |
| — | Real FHIR server (HAPI FHIR) instead of static FHIR bundles | Stretch | C | Results flow through a running FHIR server |

### 1.2 Out of scope (say so in the limitations section)
- Real genetic data or real patients' results.
- Real national ID or real health-records exchange connections (mock only; real ones need government onboarding).
- Fully malicious-secure private set intersection (we assume honest-but-curious phones plus lab-signed inputs).
- Legal patent clearance (flagged for before any pilot).

---

## 2. Ways of working

- **Daily 15-minute standup** (same time every day): yesterday, today, blockers. Blockers older than 1 day go to the whole team.
- **Code hosting:** one GitHub repo, private until submission. `main` is always demo-able. Feature branches; every pull request reviewed by one other person.
- **Definition of done for any feature:** acceptance check in §1.1 passes, it's written up in the docs folder, and it works in the deployed demo environment, not only on one laptop.
- **Decision log:** one file (`docs/decisions.md`) recording each choice with date, reason and owner.
- **Tracking:** one board with columns To do / Doing / Review / Done; card names use feature IDs (I-F4 etc.).
- **Freeze rules:** after 16 Nov, only bug fixes, docs and pitch work.

---

## 3. Repository layout (planned)

```
amana/
├── apps/
│   ├── wallet/            phone web app (Arabic/English), private check client
│   └── console/           counsellor console
├── services/
│   ├── lab-issuer/        signs credentials (simulated accredited lab)
│   ├── token-service/     national token service
│   ├── relay/             stateless message relay for the private check
│   ├── consent-ledger/    permissions + tamper-evident audit log
│   ├── explainer/         cards, AI rewording, fact-checker
│   └── adapters/          mock national-ID sign-in, mock records exchange
├── packs/
│   ├── abu-dhabi/         gene panel, languages, rules, counsellor directory
│   └── demo-country-2/    second pack to show config-only expansion
├── content/cards/         condition cards (Arabic + English) with sources + review status
├── sim/                   synthetic population generator + evaluation harness
├── loadtest/              100,000-couple load test scenarios
├── docs/                  architecture, threat model, model card, data map, decisions, limitations
└── pitch/                 deck, demo script, video, pilot proposal
```

---

## 4. Environments and accounts (day 1)

| Item | Owner | Notes |
|---|---|---|
| Hack2skill team registration | D | **Deadline 10 Nov.** Do it on day 1, not day 6 |
| GitHub repo + board | C | Branch protection on `main` |
| Azure subscription and credits | C | Use the UAE North region where the services exist |
| Azure OpenAI access | A | **Check on day 1** whether the model we need is available in UAE North. If not, use the nearest region and state it; only synthetic data is sent, so no real personal data leaves the UAE |
| Key storage for signing and token keys | C | Azure Key Vault; keys never in the repo |
| Postgres database | C | Azure managed Postgres or a free tier |
| Hosting for the two web apps and services | C | One staging environment and one demo environment |
| Two demo phones + one "attacker" phone + a laptop hotspot | B | For the offline-safe demo |
| Clinical genetics advisor | D | Recruit by 6 Nov. If none by 8 Nov, follow risk R3 |
| Ethics approach for the user test | D | Short consent form; participants use **persona cards, never their own genetic data** |

---

## 5. Component plans

Each component lists purpose, inputs and outputs, key rules, tests, dependencies and owner.

### 5.1 Lab issuer (I-F1), owner C
- **Purpose:** act as an accredited lab that has tested a person and issues their signed result.
- **Input:** a synthetic person (ID, carrier genes, programme couple result if any).
- **Output:** a signed credential containing: person reference, carrier genes, test date, panel version, programme result (compatible / incompatible / not run), lab ID, signature.
- **Endpoints:** issue credential; publish lab public key.
- **Rules:** signing key lives only in key storage; credentials expire with the panel version; every issue is logged.
- **Tests:** signature verifies; tampered credential fails; wrong lab key fails; 1,000 credentials issued in under 30 s.
- **Depends on:** token service (5.2), synthetic population (5.6).

### 5.2 National token service (I-F12), owner C
- **Purpose:** produce the per-gene tokens used in the private check, with **one national key**, so tokens match whichever lab tested you.
- **Input:** a request from a registered lab: person reference + carried genes + current period.
- **Output:** one token per carried gene, plus a signature over the whole token set.
- **Rules:**
  - Only registered labs (by client certificate or signed request) can call it.
  - Tokens only for genes listed in that person's lab-signed credential.
  - Period (epoch) changes on a fixed schedule, so old tokens stop working and can't be used to track people.
  - Key rotation procedure documented; a lab can be switched off instantly.
- **Stated limitation:** this service learns which genes a person carries, as the lab already does. A future version can use an oblivious method so the service learns nothing; listed as roadmap.
- **Tests:** same gene from two labs gives the same token; unregistered lab refused; token request for a gene not in the credential refused; tokens differ across periods.
- **Depends on:** nothing; build first with the lab issuer.

### 5.3 Wallet app (I-F3, I-F13, I-F4 client), owner B
- **Screens:** Welcome + language · Sign in (through the national-ID adapter) · My result · Teach-back · Programme result · Pair (QR) · Check result · Reveal consent · Book counsellor · Sharing & audit log · Invite relatives (stretch) · Settings (language, delete my data).
- **Storage:** credential and tokens encrypted on the device with a device-held key; nothing genetic sent to servers.
- **Programme mode:** shows the official lab couple result, the person's own carrier cards, and a next step for every outcome, including "compatible but carrier".
- **Private mode:** pair by one-time QR code, verify the partner's token-set signature, run the count-only check, then (on mutual consent) the named check.
- **Arabic first:** right-to-left layout everywhere, Arabic numerals choice, all strings in a translation file, no hard-coded English.
- **Tests:** device storage unreadable without key; full Arabic walkthrough with no English leakage; works on a mid-range Android phone and an iPhone; installable.
- **Fallback (risk R1):** if the in-browser private check library fails, run the same check in a small helper service next to each wallet; the screens don't change.

### 5.4 Relay (I-F4), owner B
- **Purpose:** pass scrambled private-check messages between two phones.
- **Rules:** keeps nothing on disk; session lives only as long as the QR pairing (for example 5 minutes); rate-limited per session; messages over a size limit dropped.
- **Tests:** log scan finds no gene names or tokens in plain form; session expires; 100,000-couple load test (5.11).

### 5.5 Consent ledger (I-F5), owner C
- **Permission types:** check only · reveal condition · share with named counsellor · family invite.
- **Each permission:** who gave it, to whom, what scope, expiry, revoked or not, signature.
- **Audit log:** each entry includes the fingerprint of the previous entry, so any edit breaks the chain. Stored in FHIR "Consent" and "AuditEvent" shapes.
- **Tests:** revoked permission blocks access immediately; expired permission blocks access; tampering detected; a person can see their full log.

### 5.6 Synthetic population (I-F2), owner A
- **Steps:**
  1. Build the gene list: genes in the Emirati conditions catalogue (CTGA) that plausibly sit on the 570-gene panel. Record the list and its limits.
  2. For each gene, pull disease-causing variants from ClinVar.
  3. Set carrier frequencies from gnomAD Middle Eastern data (check the licence of the Greater Middle East data before using it).
  4. Generate families, then marriages with a stated mix of unrelated, second-cousin and first-cousin couples; relatives share carrier genes as inheritance predicts.
  5. Calibrate the mix until the incompatible rate is about 4.8% (565 of 11,748).
  6. Export 10,000 people / 5,000 couples, plus a 100,000-couple file for the load test.
- **Tests:** reproducible from seed; rate within ±1.5 points; sensitivity curve from unrelated to first cousins.

### 5.7 Explainer (I-F6), owners A + D
- **Cards:** one per condition, in Arabic and English, with: what it is, what being a carrier means, the 25% figure explained, the full range of options described neutrally, sources, reviewer, version.
- **AI rewording:** only rewrites an approved card to a reading level; never adds facts.
- **Fact-checker:** every number and medical claim in the reworded text must match the card; otherwise show the original card text.
- **Teach-back:** 3 questions per card; answers stored without identity.
- **Red-team set:** 100 prompts (Arabic, English, mixed), including pushy ones ("should I marry him?", "is my child doomed?"). Target: 0 unsupported claims, 0 directive statements, reviewed by 2 people.
- **Fallback (risk R2):** switch off rewording and show reviewed cards only.

### 5.8 Counsellor console (I-F7), owner C
- **Tiers:**
  - Tier 1, self-serve (carriers in compatible couples): education and teach-back only; no counsellor time unless asked.
  - Tier 2, group or on-demand chat (questions, low risk).
  - Tier 3, one-to-one with a time target (shared-gene risk, or incompatible programme result).
- **Case view:** only what the couple consented to share; copilot summary built from the card and the consent scope; neutral options list.
- **Sign-off:** nothing is labelled "clinical advice" until a counsellor signs off.
- **Tests:** routing rules correct on 1,000 simulated cases; no data visible without a permission; sign-off enforced; time-target timer visible.

### 5.9 Integration adapters (I-F14), owner C
- **National ID sign-in:** a mock sign-in provider following the standard OpenID Connect flow, so a real provider can replace it through configuration.
- **Health-records exchange:** the lab issuer's result is also produced as a FHIR bundle (genetic observation + consent) and "delivered" through an adapter. Stretch: run a real open-source FHIR server.
- **Deliverable:** one integration page in the docs: what's mocked, what a real connection needs, and who would provide it.

### 5.10 Content pipeline (I-F15), owners D + A
- **Workflow:** draft from public sources (GeneReviews, MedlinePlus Genetics) → AI-assisted translation draft → clinician review → publish with version number.
- **Priority:** conditions most common among simulated incompatible couples first.
- **Metric:** share of simulated incompatible matches covered by reviewed cards (target: shown honestly, whatever it is).
- **Without a clinician:** cards marked "pending clinical review" (risk R3).

### 5.11 Evaluation and scale dashboard (I-F10), owner A (load test with C)
- **Panels:** correctness (5,000 couples) · privacy tests · safety red-team results · comprehension before/after · fairness by language and literacy (cells under 5 hidden) · scale.
- **Scale panel:**
  - Load test: 100,000 simulated couple checks through the relay, ramping up; report time per check and error rate.
  - Phone timing: one check on a mid-range phone.
  - Cost per couple per year in AED from the measured server use.
  - Cross-lab test result.
  - Rollout map: Abu Dhabi → UAE → Saudi Arabia, with the second country pack shown.
- **Load test tool:** a standard tool such as k6 or Locust (choose on day 8).

### 5.12 Country packs (I-F16), owner C
- **One pack holds:** gene panel and version, default language, legal text, counsellor directory, tier rules, time targets.
- **Demo:** switch from the Abu Dhabi pack to a second demo pack live; panel and directory change with no code change.

---

## 6. Day-by-day schedule

Each day lists every person's tasks and the exit check for the day. "Gate" days have a go/no-go decision (§7).

### Wed 4 Nov (D1): set-up
- **A:** gene list v0 (CTGA × panel); start ClinVar pull; confirm the AI model's availability in UAE North.
- **B:** spike: count-only private check between two browsers with the open-source library.
- **C:** repo, board, environments, key storage; design of credential and token formats (written spec).
- **D:** **register the team**; contact 3 possible clinical advisors; wireframes of the 6 core screens (Arabic + English).
- **Exit check:** registration submitted; two browsers exchange a private-check result.

### Thu 5 Nov (D2)
- **A:** carrier frequencies; family/marriage generator v0.
- **B:** decide browser library vs helper service (**Gate 1**); wallet shell with right-to-left layout and translation file.
- **C:** token service v0 (one national key, epochs); lab issuer v0 (signing).
- **D:** card template; first 5 cards drafted; teach-back question style.
- **Exit check:** Gate 1 decided; a lab issues a signed credential with national tokens.

### Fri 6 Nov (D3)
- **A:** calibrate the generator toward 4.8%; reproducible seed.
- **B:** wallet imports and encrypts a credential; "My result" screen.
- **C:** registered-lab check on the token service; cross-lab test (two labs → same tokens); relay v0.
- **D:** advisor confirmed (or fallback starts 8 Nov); cards 6–10.
- **Exit check:** synthetic person → credential → encrypted in wallet.

### Sat 7 Nov (D4)
- **A:** 10,000-person population exported; sensitivity curve.
- **B:** QR pairing over the relay; count-only check end to end.
- **C:** consent ledger v0: permissions + chained audit log.
- **D:** hi-fi designs for pairing, check result and reveal screens.
- **Exit check:** two phones pair by QR and get "shared risk: yes/no".

### Sun 8 Nov (D5)
- **A:** explainer v0: card store + AI rewording.
- **B:** partner token-set signature check; forged-token rejection.
- **C:** revoke and expiry; tamper check.
- **D:** cards 11–15; user-test protocol and consent form drafted.
- **Exit check:** forged tokens rejected; revoked permission blocks access.

### Mon 9 Nov (D6)
- **A:** fact-checker v0; red-team set v1 (50 prompts).
- **B:** attack demo (claim all 570 genes) plus plain-PSI comparison.
- **C:** national-ID sign-in adapter (mock).
- **D:** reveal and consent copy reviewed for neutral wording; card review with advisor starts.
- **Exit check:** attack demo works; sign-in through the adapter.

### Tue 10 Nov (D7): **registration deadline (should already be done on D1)**
- **A:** red-team set to 100; first run of results.
- **B:** two-step reveal: named check after mutual consent; condition card shown.
- **C:** programme-mode credential type; records-exchange adapter producing FHIR bundles.
- **D:** cards 16–20; recruit user-test participants (target 25, to end with ≥20).
- **Exit check:** registration confirmed on Hack2skill; reveal flow works.

### Wed 11 Nov (D8)
- **A:** evaluation harness: correctness on 5,000 couples; fact-check pass rate.
- **B:** programme-mode screens; "compatible but carrier" path.
- **C:** counsellor console v0: queue, case view, sign-off; tier routing rules.
- **D:** teach-back for all reviewed cards; pick load-test tool with C.
- **Exit check:** 5,000-couple correctness run complete.

### Thu 12 Nov (D9): **Gate 2, demo-able checkpoint (~60%)**
- **All:** full run of the demo script on the staging environment; list of gaps.
- **A:** fix red-team failures.
- **B:** polish pairing and check screens.
- **C:** case appears in the console within 5 s of consent.
- **D:** cards 21–25; pitch outline.
- **Exit check:** Gate 2 decision (§7).

### Fri 13 Nov (D10)
- **A:** dashboard v0: correctness, privacy, safety panels.
- **B:** stretch decision: family invites (only if Gate 2 was green).
- **C:** deploy to demo environment in UAE North; seed data; audit log viewer.
- **D:** user test sessions 1–8 (persona cards, not real data).
- **Exit check:** demo environment live.

### Sat 14 Nov (D11)
- **A:** fairness panel (language, literacy; hide cells under 5).
- **B:** offline demo mode: both wallets + relay on a laptop hotspot.
- **C:** load test: 10,000 then 100,000 couples; cost per couple.
- **D:** user test sessions 9–16.
- **Exit check:** load-test numbers recorded.

### Sun 15 Nov (D12)
- **A:** comprehension results into the dashboard; scale panel.
- **B:** country pack switch on the wallet.
- **C:** second demo country pack; content pipeline status page.
- **D:** user test sessions 17–25; draft pilot proposal (1 page).
- **Exit check:** ≥20 test participants done, or fallback R7 triggered.

### Mon 16 Nov (D13): **feature freeze, Gate 3**
- **All:** bug bash using the demo script and the acceptance list in §1.1.
- **Exit check:** every MVP feature passes its acceptance check or is cut and listed in limitations.

### Tue 17 Nov (D14)
- **A:** model card; final evaluation numbers.
- **B:** recorded backup demo video.
- **C:** architecture doc, threat model, integration page, data map.
- **D:** pitch deck v1; 3-minute video script.

### Wed 18 Nov (D15)
- **A:** limitations and assumptions doc.
- **B:** final mobile testing on 3 devices.
- **C:** deployment guide (how a lab and DoH would onboard).
- **D:** record 3-minute video; Arabic/English proofreading.

### Thu 19 Nov (D16): **submit**
- **All:** final dry run; submit by evening.
- **Exit check:** submission confirmed on Hack2skill.

### Fri 20 Nov: buffer only (official deadline)

---

## 7. Gates (go/no-go)

| Gate | Date | Green means | If not green |
|---|---|---|---|
| Gate 1: private check technology | 5 Nov | In-browser check works on two phones | Switch to helper service for each wallet; no screen changes |
| Gate 2: demo-able | 12 Nov | Credential → wallet → pair → check → reveal → console works end to end on staging | Drop stretch items; move B to help C; cut country-pack demo to config file only |
| Gate 3: feature freeze | 16 Nov | All MVP acceptance checks pass | Cut failing feature, list it in limitations, keep demo path clean |

---

## 8. Testing plan

| Type | What | Owner | When |
|---|---|---|---|
| Unit | Signing, tokens, consent rules, routing rules, fact-checker | each owner | with each feature |
| Integration | Full flow on staging, nightly | C | from 8 Nov |
| Correctness | 5,000 synthetic couples vs ground truth | A | 11 Nov |
| Cross-lab | Same gene, two labs, same token; couple tested at two labs found | C | 6 Nov, again 16 Nov |
| Privacy | Attack demo; relay log scan; revoke; expiry; tamper; forged tokens | B + C | 9 Nov, again 16 Nov |
| Safety | 100-prompt red-team, 2 reviewers | A + D | 10 Nov, again 15 Nov |
| Load | 100,000 couples through relay; phone timing | C + A | 14 Nov |
| Accessibility | Screen reader on core screens; contrast; text size | D | 15 Nov |
| User test | ≥20 adults, Arabic + English, mixed education; teach-back before vs after, compared with plain lab-letter text | D | 13–15 Nov |
| Demo rehearsal | Full script, online and offline | All | 12, 16, 19 Nov |

**User test ethics:** short consent form; no real genetic or health data; no names stored with answers; participants can stop at any time.

---

## 9. Submission package (required: prototype + technical documentation + assumptions, dependencies, limitations)

- [ ] Working prototype URL (demo environment) + test personas
- [ ] 3-minute demo video + recorded backup demo
- [ ] Pitch deck
- [ ] Technical documentation: architecture, threat model, integration page, deployment guide
- [ ] Model card for the explainer (what the AI may and may not do)
- [ ] Data map + every data source declared (ClinVar, gnomAD, CTGA, synthetic)
- [ ] Evaluation report: correctness, privacy, safety, comprehension, fairness, scale
- [ ] Assumptions, dependencies, limitations (including mocked integrations, honest-but-curious assumption, patent check needed, Emirati Genome Programme not verified)
- [ ] 1-page pilot proposal (DoH/ADPHC + one lab)
- [ ] Code repository ready to share if requested
- [ ] Re-check the 3 unopened sources before they appear in the deck (Saudi 37.1%, signed-input paper, 1994–95 cousin-marriage figure)

---

## 10. Risk triggers by date

| Risk | Trigger date | Trigger | Action |
|---|---|---|---|
| R1 private check in browser fails | 5 Nov | Gate 1 red | Helper service per wallet |
| Azure AI model not in UAE North | 4 Nov | Not available | Nearest region, synthetic data only, state in docs |
| R3 no clinical advisor | 8 Nov | Nobody confirmed | Cards from public sources, marked "pending clinical review" |
| R2 explainer unsafe | 15 Nov | Red-team not 100% clean | Turn off AI rewording; cards only |
| R7 too few test users | 15 Nov | Under 20 done | Report as feasibility pilot with ranges; add simulated cases |
| Scope overrun | 12 Nov | Gate 2 red | Cut in §11 order |
| R4 "marriage filtering" perception | 17 Nov | Pitch review flags it | Rework copy; lead with comprehension and counselling outcomes |

---

## 11. Cut order (if time runs short)

Cut from the top first:
1. Arabic read-aloud (I-F11)
2. Real FHIR server (keep static FHIR bundles)
3. Family invites (I-F9)
4. Second country pack live switch (keep the config file + slide)
5. Tier 2 group sessions (keep Tier 1 and Tier 3)
6. Load test at 100,000 (report 10,000 and extrapolate, stated as such)

**Never cut:** private check, lab-signed tokens, attack demo, consent + audit log, reviewed cards with fact-check, counsellor sign-off, programme mode, evaluation numbers.

---

## 12. Decisions to make on day 1

1. Who is A, B, C, D (names on the board).
2. Standup time.
3. Demo phones: which models.
4. Which clinical advisors to approach.
5. Hosting choice inside Azure for the web apps (confirm with credits available).
6. Whether team members can work the assumed ~3.5–4 hours a day; if not, apply §11 cuts now rather than later.
