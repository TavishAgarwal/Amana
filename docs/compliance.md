# AMANA: UAE rules and how the prototype meets them

> **Status (10 Nov 2026):** written by the team. This is **not legal advice**, and it has **not been reviewed
> by a lawyer, the Department of Health (DoH) or a data protection officer**. Some points come from
> law-firm summaries, not the official text; those are marked *(summary)*. Check every row against
> the official text before a pilot. "Built" means the prototype does it today; "Designed" means it
> is planned in the docs or deploy files but not running; "Gap" means it is not done.

## 1. Which rules apply

| Rule | What it covers | Applies to AMANA? | Source |
|---|---|---|---|
| Federal Law No. 2 of 2019 (ICT in health fields) | Health data across the UAE: confidentiality, storage inside the UAE (Art. 13), keeping records at least 25 years from the last procedure (Art. 20) | **Yes**, for any health data AMANA servers or counsellors hold | [MoHAP text, p. 7](https://www.ehs.gov.ae/app_content/legislations/php-law-en-77/files/basic-html/page7.html); [Al Tamimi](https://tamimi.com/law-update-articles/the-federal-law-regulating-the-use-of-information-and-communication-technology-in-the-uae-healthcare-sector) *(summary)* |
| Federal Decree-Law No. 45 of 2021 (PDPL) | Personal data in general. Art. 2 leaves out health data that has its own law | **Partly**: sign-in identity and contact details; health data falls under Law 2/2019 | [UAE Legislation](https://uaelegislation.gov.ae/en/legislations/1972/download); [Herbert Smith Freehills](https://www.herbertsmithfreehills.com/latest-thinking/new-data-protection-law-introduced-in-the-uae-%E2%80%93-10-key-takeaways) *(summary)* |
| Federal Decree-Law No. 49 of 2023 (human genome) | Genomic screening: informed consent, counselling, right to withdraw (Art. 8), right to know results (Art. 9), licences for genomic services. In force since 1 Dec 2023 | **Yes**: AMANA shows lab genomic results and routes to counselling | [DHA copy of the law](https://dha.gov.ae/uploads/062024/Federal%20Law_49_2023_Regulating%20the%20Use%20of%20the%20Human%20Genome202466484.pdf); [Al Tamimi](https://turtl.tamimi.com/story/law-update-issue-373-healthcare-and-life-sciences-focus/page/8) *(summary)* |
| DoH Abu Dhabi ADHICS standard | Information and cyber security for any entity in Abu Dhabi that stores, processes or sends health information, including technology providers | **Yes**, for the operator of AMANA in Abu Dhabi | [DoH ADHICS (2019 PDF)](https://www.doh.gov.ae/-/media/032019_ADHICS.ashx); [DoH FAQ](https://www.doh.gov.ae/-/media/Feature/Aamen/ADHICS-FAQ.ashx). A version 2 (2024) is reported by vendors, not checked |
| DoH Standard on Patient Healthcare Data Privacy (16 Sep 2020) | Consent before use or disclosure, the patient's right to see and correct data, privacy risk assessment | **Yes** | [Al Tamimi](https://www.tamimi.com/news/abu-dhabi-uae-issues-standard-on-healthcare-data-privacy) *(summary)* |
| DoH Responsible AI Standard (DoH/ST/DDGO/RAI/V1/2025, Oct 2025) | Licensed entities that build, buy or use AI | **Yes**, for the AI that answers questions and drafts counsellor notes | [DoH](https://www.doh.gov.ae/-/media/B84FF5DD027846699C51F36C439A580F.ashx) |

## 2. Requirement → what AMANA does

| # | Requirement | What AMANA does | Where | Status |
|---|---|---|---|---|
| L1 | Health data stored and processed in the UAE (Law 2/2019 Art. 13) | Servers hold no genes. What they do hold (sign-in, consents, audit log, counsellor cases) is deployed only to Azure UAE North or UAE Central: the deploy template refuses any other region. Questions are answered on the phone. The local AI runs on the operator's own server | `infra/azure/main.bicep` (`@allowed` regions); `apps/wallet/lib/ask/`; `docs/data-map.md` | Designed (not deployed) |
| L2 | Keep health records at least 25 years (Law 2/2019 Art. 20) | The lab's own record system stays the record of truth; AMANA's wallet holds the person's copy, which they may delete. **Open:** counsellor case notes written in the console are health records and must be kept 25 years, which "delete everything" must not erase. Plan: write signed-off notes to the counselling provider's own record system (Malaffi or EMR) and keep only routing data in AMANA | `services/adapters/records-exchange/`; `docs/limitations.md` | **Gap** |
| L3 | Only authorised people see health data | Default is no access. Every share is a signed, expiring, revocable permission; every read is checked and logged; a counsellor sees only cases assigned to them | `services/consent-ledger/consent_ledger/core.py` (`check`, `revoke`); `services/demo-api/demo_api/app.py` (`/api/case/{cid}`) | Built |
| L4 | Consent before use or disclosure (DoH privacy standard; PDPL) | Consent sheet lists who, what, how long and how to undo; equal "Agree" and "Not now"; nothing pre-ticked. Every consent is signed by the person's device key and checked by the server | `apps/wallet/components/`; `services/demo-api/demo_api/app.py` (`SignedReq`) | Built |
| L5 | Right to see who accessed data | "Who saw my data" screen reads the person's own audit entries; the log is hash-chained and the table rejects edits | `consent_ledger/core.py` (`verify_chain`, Postgres trigger); `/api/sharing` | Built |
| L6 | Right to withdraw (Genome law Art. 8; PDPL) | One action withdraws every permission; Settings deletes the wallet, the on-device model and the keys | `Ledger.delete_all`; `/api/withdraw`; wallet Settings | Built |
| L7 | Right to know results, and the right not to know | The person sees their own result. The partner's genes are shown only if **both** sign a reveal consent; the default is the yes/no only | `apps/wallet/lib/check.ts` | Built |
| L8 | Counselling with genomic results (Genome law) | Every "shared" result routes to Tier 1 card, Tier 2 message (24 h) or Tier 3 appointment (48 h); "not compatible" programme results go to Tier 3 | `packs/abu-dhabi/pack.yaml`; `consent_ledger/cases.py` | Built (synthetic counsellors) |
| L9 | Licence for genomic services (Genome law) | AMANA does not test. **Open:** whether showing lab results and education counts as a "genomic service" that needs a licence. Ask DoH before a pilot | — | **Gap (question)** |
| L10 | Data minimisation (PDPL principle) | The check sends tokens only, never gene names; hello carries no tokens; sets padded to 128; condition name in a booking is optional and unticked | `apps/wallet/lib/psi.ts`; `docs/threat-model.md` | Built |
| S1 | Access control and strong identity (ADHICS) | Mock national sign-in (UAE PASS in a real pilot); device keys are non-extractable Ed25519; counsellor console scoped per counsellor | `services/adapters/mock-signin/`; `apps/wallet/lib/device.ts` | Built (mock sign-in) |
| S2 | Cryptography and key management (ADHICS) | National keys and lab registry load from Key Vault secrets; the service refuses to start in production without them; lab API keys are stored as hashes only | `services/token-service/token_service/core.py` (`from_env`); `infra/azure/main.bicep` | Built (code) / Designed (Key Vault) |
| S3 | Logging without leaking (ADHICS) | Relay logs event names only and scrubs anything token-like; payloads are never logged | `services/relay/src/server.js` (`scrub`) | Built |
| S4 | Secure development (ADHICS) | CI runs lint, tests and an infra build check; red-team set; privacy tests against Postgres; automated accessibility and end-to-end scripts. No dependency vulnerability scan yet | `.github/workflows/ci.yml`; `redteam/` | Built |
| S5 | Incident handling (ADHICS) | Draft plan in §4 | this file | Designed |
| S6 | Third parties and cloud (ADHICS) | Azure (UAE regions) is the only cloud; no analytics or ad SDKs; no third-party AI API | `docs/architecture.md` | Designed |
| S7 | Privacy risk assessment (DoH privacy standard) | Threat model and data map exist; a formal privacy impact assessment does not | `docs/threat-model.md`, `docs/data-map.md` | **Gap** |
| A1 | Human oversight of AI (DoH Responsible AI) | AI never writes text for people; it only picks reviewed sentences. Counsellor drafts are labelled and need sign-off before anyone sees them | `services/explainer/explainer/core.py`; `/api/case/{cid}/signoff` | Built |
| A2 | Transparency (DoH Responsible AI) | Every answer says whether rules or the on-device model picked it; model card published | `docs/model-card.md`; `apps/wallet/components/card.tsx` | Built |
| A3 | Safety testing (DoH Responsible AI) | 100-prompt red-team: 0 directive, 0 unsupported, decision questions refused in Arabic and English | `docs/evaluation-report.md` | Built (one reviewer) |
| A4 | Independent validation (DoH Responsible AI) | Not done: no second red-team reviewer, no clinician sign-off on cards | `docs/review-packet.md` | **Gap** |
| A5 | Fairness across groups | Study kit compares Arabic and English readers and reading comfort; groups under 5 are hidden | `docs/study-kit.md`; `/api/study` | Designed (not run) |

## 3. Open questions for DoH

1. Does a wallet that shows lab genomic results need a genomic services licence under Decree-Law 49/2023 (L9)?
2. Where must signed-off counsellor notes live to meet the 25-year rule: Malaffi, the provider's EMR, or AMANA (L2)?
3. Which ADHICS level (basic, transitional or advanced) would apply to the AMANA operator?
4. Can the national token service be run by DoH itself, so no private company holds the national key?
5. Is UAE PASS available as a sandbox for the pilot sign-in?

## 4. Incident plan (draft)

| Step | Who | Within |
|---|---|---|
| Detect: alert on audit-chain break, refused-signature spikes, relay rate-limit spikes, token-service refusals | Operator on call | Automatic |
| Contain: rotate the affected key (national, lab or signing) from Key Vault; revoke the lab in the registry; stop the relay replica | Operator | 1 hour |
| Assess: what data could have left. Servers hold no genes, so the main risks are consent records, case notes and sign-in data | Operator + DPO | 24 hours |
| Tell: DoH and affected people, in Arabic and English, through the app's discreet notification | DPO | As the DoH standard requires (to be confirmed) |
| Learn: write up, add a test that would have caught it | Team | 2 weeks |

Rotating the national key changes every token from the next period on; wallets fetch new token sets
at their next sign-in, so a key change needs no action from people.
