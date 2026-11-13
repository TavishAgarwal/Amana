# AMANA pilot proposal: private, understandable premarital genetic results in Abu Dhabi

> **Draft for discussion, 10 Nov 2026.** No partner has agreed to anything below. Prices and costs are
> assumptions (see `docs/commercial-case.md`); volumes are sourced there. The prototype uses synthetic
> data only.

## The problem in one paragraph
Abu Dhabi tests Emirati couples for 570 genes before marriage. Between 2022 and July 2026, 11,748 couples
were tested and 565 (about 5%) were found incompatible ([Gulf News, 3 Oct 2026](https://gulfnews.com/uae/health/abu-dhabi-genetic-screening-flags-565-incompatible-cases-among-couples-1.500697261)).
Results arrive as "compatible / not compatible". Carriers in compatible couples learn little about their
own result, which matters for their siblings and children. Couples who want to check privately earlier,
before families are involved, have no safe way to do it.

## What AMANA is
- A phone wallet that holds the person's own lab-signed result, in Arabic and English.
- A private couple check: two phones learn only "shared risk: yes / no". No server ever sees a gene.
  Partners see a gene name only if **both** agree.
- Condition cards in plain language, with a 3-question teach-back, and answers to questions on the phone.
- Routing to counselling: a card (Tier 1), a message within 24 h (Tier 2) or an appointment within 48 h
  (Tier 3). A counsellor console with signed-off AI drafts.

## Ask
A **12-week pilot** with:
- the programme owner (Abu Dhabi Public Health Centre / DoH);
- one accredited screening lab;
- one counselling team (2–3 counsellors);
- the DoH research ethics committee.

## Design
| | |
|---|---|
| Who | 200 screened people (100 couples) who choose to take part, recruited when results are delivered |
| Groups | Couples randomised 1:1: AMANA, or the usual letter plus the usual physician explanation. Randomising couples, not people, stops partners mixing the two |
| Length | 12 weeks: weeks 0–4 set-up, 5–10 enrolment and use, 11–12 analysis |
| Primary measure | Understanding: 3-question teach-back score after the result |
| Secondary | Time from result to first counselling contact (incompatible couples); unauthorised disclosures (target 0, by audit-log review and an external test); results by language and reading comfort (groups under 5 hidden); counsellor minutes per Tier 3 case; share of AI drafts kept after editing |
| Never a success measure | Cancelled or changed marriage plans |

**Why 200 people.** To detect a 15-point difference in teach-back score (SD assumed 25), with 5%
significance and 80% power, needs 44 people per group. Partners' answers are related, so allowing a
design effect of 1.5 gives 66 per group; allowing 20% drop-out gives 83. 100 per group leaves a margin.
The SD and effect size are assumptions; the study kit (`docs/study-kit.md`) can measure them in a
small run first.

## Go / no-go for scale-up
- Understanding score of 80% or more, and better than the usual letter.
- No unauthorised disclosure.
- No group (language, reading comfort) more than 10 points below the overall score.
- Counsellors willing to keep using the console.

## Who does what
| AMANA team | Partners |
|---|---|
| Wallet, console and token service, hosted in Azure UAE North | Lab: signed results through the FHIR adapter (a mock exists) |
| Clinical content for the pilot's most common genes, **reviewed by the pilot's clinicians before launch** | National sign-in (UAE PASS) test access |
| Counsellor training (2 hours) and weekly reports | Counsellor time; ethics approval; recruitment at result delivery |
| Security review and penetration test before launch | Programme data owner to approve the data flow (`docs/data-map.md`) |

## Data protection
- Genes never leave the phone during the check; servers hold consents, the audit log and counselling
  cases only, in a UAE region (`docs/compliance.md`, rows L1–L10).
- Every consent is signed on the phone and can be withdrawn at any time; the person can see every access.
- Signed-off counselling notes go to the counselling provider's own record system, which keeps them for
  the legally required 25 years (open point L2, to settle with DoH before launch).
- Open questions for DoH are listed in `docs/compliance.md` §3.

## Pilot budget (assumption)
| Item | AED |
|---|---|
| Product and support team, 2 people × 3 months | 150,000 |
| Clinical and Arabic content review | 30,000 |
| External security and privacy test | 80,000 |
| Hosting and monitoring, UAE North, 3 months | 2,000 |
| Participant thank-you vouchers, 200 × 50 AED | 10,000 |
| **Total** | **≈ 272,000** |

## After the pilot
If the go / no-go is met: Abu Dhabi programme licence (per screened person per year plus a platform
fee, `docs/commercial-case.md` §4), then the UAE-wide programme, then other countries through country
packs (`packs/`).

## Current state (honest)
Working prototype with tests, on-device answers and a measured load test (`loadtest/results.json`).
**Not yet done:** deployment, user testing, clinician review of cards, native-speaker review of Arabic,
an independent red-team review. See `docs/limitations.md`.
