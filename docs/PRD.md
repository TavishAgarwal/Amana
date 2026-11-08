# AMANA: Product Requirements Document (PRD)

> **Product:** AMANA (Arabic for "trust"): a private carrier wallet for premarital genetic screening.
> **For:** Future Health Digital Innovation Challenge, Abu Dhabi. Challenge F3, *Understanding and Reducing Inherited Disease Risk*.
> **Prototype due:** Fri 20 Nov 2026 (we submit Thu 19 Nov).
> **Status:** prototype requirements. Source spec: `blaze/idea/IDEA.md`. Build schedule: `docs/phases.md`.
> **Related docs:** `architecture.md` (how it's built) · `rules.md` (what to use and avoid) · `design.md` (UI).

---

## 1. Summary

AMANA lets an engaged or soon-to-be-engaged couple find out whether they share a genetic risk **without either of them, their families, or the AMANA operator seeing the other person's full carrier results**. It explains results in plain Arabic or English, checks that people understood, and routes them to the right level of counselling. It works alongside Abu Dhabi's mandatory premarital genetic programme, not against it.

**One-liner:** a private carrier wallet that lets two people learn only whether they share risk in the same gene, explains it in plain Arabic or English, and connects them to a counsellor.

---

## 2. Problem

| Fact | Source |
|---|---|
| Abu Dhabi's premarital genetic test is mandatory and covers 570 genes and 840+ recessive disorders | Gulf News, Oct 2026 |
| 11,748 couples tested from 2022 to Jul 2026; 565 (about 5%) flagged incompatible | Gulf News, 3 Oct 2026 |
| About half of UAE marriages were consanguineous in the last national study (1994–95) | UAEU study (re-check before pitching) |

**What goes wrong today:**
1. **Late.** The result comes at the marriage-contract stage, when families are already committed and a bad result is socially costly.
2. **Yes/no only.** "Compatible" couples (about 95%) get no follow-up, even when one or both partners are carriers. Their relatives may carry the same change and never learn it.
3. **Fear of exposure.** Genetic results reveal family information. The challenge requires avoiding exposure of one family member's information to another without permission.
4. **Hard to understand.** "Carrier", "recessive" and "25% per pregnancy" are hard ideas, and no Arabic genetic-counselling assistant exists.
5. **Limited counsellors.** Results are delivered by a limited pool of trained physicians.

---

## 3. Goals and non-goals

### Goals
- **G1.** Let a couple check for shared-gene risk early and privately, revealing only that one fact.
- **G2.** Give **every** tested person (including carriers in "compatible" couples) an understandable explanation of their own result.
- **G3.** Measurably improve understanding (teach-back score), in Arabic and English, across literacy levels.
- **G4.** Get people to the right counselling faster, using counsellor time where it matters most.
- **G5.** Give people full control over who sees what, with an audit log they can check.
- **G6.** Show it can scale: any accredited lab, the whole UAE, then other Gulf countries.

### Non-goals
- AMANA **does not** tell anyone whom to marry or whether to marry.
- AMANA **does not** diagnose. It supports decisions; counsellors give clinical advice.
- AMANA **does not** replace the national programme or its lab test.
- The prototype **does not** use real genetic data or connect to real government systems.

---

## 4. Target users

| Persona | Who | What they need | What they fear |
|---|---|---|---|
| **Mariam** (primary) | 26, Emirati, recently tested, may be a carrier | Understand her own result; check compatibility early; control who knows | Her family or her partner's family learning her results; stigma as a woman carrier |
| **Khalid** (primary) | 29, Mariam's prospective partner | A quick, private, trustworthy answer: "do we share a risk?" | Being exposed or judged; a late surprise |
| **Counsellor** (secondary) | Trained family physician or genetic counsellor | Cases that arrive prepared, prioritised and consented | Too many cases; giving advice on incomplete information |
| **Relatives** (secondary) | Siblings and cousins of a carrier | To know testing is worth it, without being told who carries what | Family conflict |
| **Programme manager** (buyer) | DoH / Abu Dhabi Public Health Centre staff | Better outcomes from the existing programme, with measurable results and data in the UAE | Privacy incidents; extra cost; integration burden |
| **Lab staff** (operator) | Accredited screening lab | Issue results digitally with little extra work | New systems to learn |

---

## 5. User stories

### Mariam / Khalid (wallet)
- **US-1.** As a tested person, I want to sign in with my national digital ID so I don't create a new account.
- **US-2.** As a tested person, I want to see my own carrier result explained in my language so I understand it.
- **US-3.** As a tested person, I want a short check that confirms I understood, so I know I got it right.
- **US-4.** As a tested person in programme mode, I want my official couple result explained, including "compatible but carrier".
- **US-5.** As a couple, we want to scan each other's QR code and learn only "shared risk: yes or no".
- **US-6.** As a couple with a shared risk, we want to see which condition only if we both agree.
- **US-7.** As a person, I want to book a counsellor and share only what I choose.
- **US-8.** As a person, I want to see and revoke every permission I gave, and see who viewed what.
- **US-9.** As a carrier, I want to invite relatives to get tested without revealing that it was me or which gene.
- **US-10.** As a person, I want to delete all my data from the app.

### Counsellor (console)
- **US-11.** As a counsellor, I want cases sorted by tier and time target so I see urgent ones first.
- **US-12.** As a counsellor, I want a prepared summary of only what the couple shared.
- **US-13.** As a counsellor, I want to sign off before anything is shown to the couple as clinical advice.

### Programme manager (dashboard)
- **US-14.** As a programme manager, I want to see understanding, time to counselling and privacy incidents, broken down by language and literacy, without identifying anyone.
- **US-15.** As a programme manager, I want evidence that the system handles national volume and what it costs per couple.

### Lab (issuer)
- **US-16.** As a lab, I want to issue a signed digital result and get the person's tokens from one national service.

---

## 6. Features

Priority: **MVP** = must ship by 19 Nov · **Lite** = MVP in reduced form · **Mock** = MVP with simulated external system · **Stretch** = only if ahead of schedule.

| ID | Feature | Priority | Stories | Acceptance criterion (testable) |
|---|---|---|---|---|
| I-F1 | **Lab issuer**: signs a person's carrier credential (carrier genes + programme couple result) | MVP | US-16 | Signature verifies with the lab public key; one changed byte fails verification; 1,000 synthetic people issued in under 30 s |
| I-F12 | **National token service**: one national key makes per-gene tokens; only registered labs may call it | MVP | US-16 | Same gene from Lab A and Lab B gives the same token; unregistered lab refused; request for a gene not in the credential refused; tokens change each period |
| I-F2 | **Synthetic population** (consanguinity-aware) | MVP | — | Incompatible-couple rate within ±1.5 points of 4.8% at a stated cousin-marriage mix; reproducible from seed |
| I-F3 | **Wallet app** (Arabic right-to-left + English), encrypted on device | MVP | US-1, 2, 10 | Stored credential unreadable without the device key; installable; no English text on core Arabic screens |
| I-F13 | **Programme mode** | MVP | US-4 | A carrier in a "compatible" couple gets their own carrier card; an "incompatible" result routes to Tier 3 |
| I-F4 | **Private couple check** over a relay with QR pairing | MVP | US-5 | 1,000 synthetic couples: every shared-gene couple found, no false alarms; relay logs hold no gene names; forged tokens rejected |
| I-F5 | **Two-step consent reveal + tamper-evident audit log** | MVP | US-6, 8 | Revoked or expired permission blocks access; editing any log entry breaks the chain check |
| I-F6 | **Explainer + teach-back** | MVP | US-2, 3 | 0 unsupported claims and 0 directive statements on a 100-prompt red-team set; each card shows sources and review status |
| I-F7 | **Counsellor console** with 3 tiers, copilot summary, mandatory sign-off | MVP | US-7, 11–13 | Case appears within 5 s of consent; 1,000 simulated cases routed to the right tier; nothing visible without permission; "clinical advice" label impossible without sign-off |
| I-F8 | **Attack demo**: "claim every gene on the panel" is rejected | MVP | — | Scripted attack fails with a logged reason; side-by-side with plain private matching shows the leak AMANA prevents |
| I-F14 | **Integration adapters**: national-ID sign-in; health-records exchange (FHIR) | Mock | US-1 | Swapping mock for real needs config only; result arrives as a valid FHIR bundle |
| I-F10 | **Evaluation + scale dashboard** | MVP | US-14, 15 | Understanding before/after, fairness by language/literacy (groups under 5 hidden), privacy and safety results, 100,000-couple load test, cost per couple |
| I-F15 | **Content pipeline** | Lite | — | 25 reviewed cards; dashboard shows share of simulated incompatible matches covered |
| I-F16 | **Country packs** | Lite | US-15 | Switching packs changes panel, default language and directory with no code change |
| I-F9 | **Anonymous family invites** | Stretch | US-9 | Invite page shows no sender and no gene |
| I-F11 | **Arabic read-aloud** of cards | Stretch | US-2 | Every card playable |

---

## 7. Functional requirements

### 7.1 Credentials and tokens
- **FR-1.** The lab issuer signs every credential; the wallet rejects unsigned or tampered credentials.
- **FR-2.** Tokens are issued only by the national token service, only to registered labs, and only for genes in the person's lab-signed credential.
- **FR-3.** Tokens expire at the end of each period; old tokens cannot be used in a check.

### 7.2 Private check
- **FR-4.** Pairing uses a one-time QR code valid for a short time (default 5 minutes).
- **FR-5.** Each wallet verifies the partner's token-set signature before the check runs.
- **FR-6.** Step 1 returns only "shared risk: yes or no". Step 2 (which condition) runs only after **both** consent.
- **FR-7.** The relay stores nothing and never sees gene names or unscrambled tokens.

### 7.3 Consent and audit
- **FR-8.** Permission types: check only · reveal condition · share with a named counsellor · family invite.
- **FR-9.** Every permission is signed, has an expiry, and can be revoked at any time; revocation takes effect immediately.
- **FR-10.** Every access is written to a tamper-evident log the person can view.
- **FR-11.** Default is **no sharing**. Nothing is shared without an explicit action.

### 7.4 Explainer
- **FR-12.** All medical content comes from reviewed condition cards with sources.
- **FR-13.** The AI may only reword a card to a simpler reading level. It may not add facts, numbers or advice.
- **FR-14.** A fact-checker compares every number and claim in the reworded text with the card; on mismatch, the original card text is shown.
- **FR-15.** Each card has a 3-question teach-back; answers are stored without identity.

### 7.5 Counselling
- **FR-16.** Cases are routed to Tier 1 (self-serve), Tier 2 (group or on-demand chat) or Tier 3 (one-to-one with a time target).
- **FR-17.** Counsellors see only consented data.
- **FR-18.** Nothing is labelled clinical advice until a counsellor signs off.

### 7.6 Data control
- **FR-19.** The person can delete all app data from their device and withdraw all permissions in one action.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| **Privacy** | Genetic data stays on the device. Servers hold hashes, permissions and audit entries only. No identifiers in analytics. |
| **Security** | No custom cryptography. Keys in managed key storage. All traffic over TLS. Rate limits on relay and token service. |
| **Performance** | One private check completes in under 3 s on a mid-range phone on 4G (to be measured). Console shows a new case within 5 s of consent. |
| **Scale** | Relay handles 100,000 simulated couple checks in a load test with error rate reported. |
| **Availability (demo)** | Full demo runs offline on a laptop hotspot. Recorded backup video exists. |
| **Localisation** | Arabic (right-to-left) and English at parity on every core screen. Gender-aware Arabic wording. |
| **Accessibility** | WCAG 2.2 AA on core screens; works with screen readers in both languages; text resizes to 200%. |
| **Data residency** | Hosted in Azure UAE North where the service exists; exceptions documented. |
| **Fairness** | Outcomes reported by language and literacy band; groups under 5 people hidden. |

---

## 9. Success metrics

| Metric | Target for prototype | How measured |
|---|---|---|
| Check correctness | 100% on 5,000 synthetic couples | Evaluation harness vs ground truth |
| Cross-lab matching | 100% | Couples issued by two different labs |
| Unauthorised disclosures | 0 | Privacy test suite + relay log scan |
| Unsupported or directive AI statements | 0 on 100 red-team prompts | Two reviewers |
| Understanding | Teach-back score higher after the explainer than with a plain lab letter | User test, n ≥ 20, Arabic + English, mixed education |
| Time to counselling (simulated) | Shorter than the current path (assumption documented) | Simulation |
| Reach | Share of carriers in "compatible" couples who receive education | Simulation |
| Scale | Time per check and error rate at 100,000 checks; cost per couple per year (AED) | Load test |

**Never counted as success:** cancelled or avoided marriages.

---

## 10. Constraints and assumptions

- **Team:** 4 people assumed (A: ML/LLM · B: full-stack wallet · C: full-stack backend · D: design + clinical content + pitch).
- **Time:** about 12 days from 8 Nov; part-time.
- **Budget:** free tiers + Azure credits.
- **Data:** public or synthetic only, every source declared (organisers provide none).
- **Assumed:** the screening lab is the credential issuer. Whether Emirati Genome Programme participants can get their own carrier results is **not verified**; treated as phase 2.

---

## 11. Out of scope for the prototype

- Real patients, real genetic data, real lab integrations.
- Real national-ID or health-records exchange connections (mocks only).
- Fully malicious-secure private matching (we assume honest-but-curious phones plus lab-signed inputs).
- Legal patent clearance (flagged before any pilot).
- Payments, billing, multi-tenant admin.

---

## 12. Dependencies

| Dependency | Used for | Risk if unavailable |
|---|---|---|
| OpenMined PSI library | Private check | Fallback: helper service per wallet |
| Azure OpenAI | Card rewording | Fallback: reviewed cards only |
| ClinVar, gnomAD, CTGA | Synthetic population and condition list | Use cached exports |
| Clinical genetics advisor | Card review | Cards marked "pending clinical review" |
| Test participants (≥ 20) | Understanding study | Report as feasibility pilot + simulated cases |

---

## 13. How AMANA meets the challenge

| Challenge expectation | How AMANA meets it |
|---|---|
| Explain inherited risk clearly | Reviewed cards, reading-level rewording, teach-back, Arabic + English |
| Avoid exposing one family member's information to another without permission | Private check reveals one fact; two-step reveal; signed revocable permissions; anonymous family invites |
| Human oversight and escalation | Counsellor tiers; mandatory sign-off |
| Screening is not diagnosis | Decision-support only; counsellor gives advice |
| Cultural and linguistic fit | Arabic-first, gender-aware wording, non-directive content, consanguinity framed without stigma |
| Fairness across groups | Outcomes by language and literacy |
| Measured outcomes on realistic or simulated cases | Synthetic population calibrated to 4.8%; user test; evaluation dashboard |

---

## 14. Open questions

1. Which real system would issue credentials first: the screening lab, Malaffi, or the Emirati Genome Programme?
2. Which DoH app would host AMANA as a module?
3. Do we have a named clinical advisor for card review?
4. Is the needed Azure OpenAI model available in UAE North?
