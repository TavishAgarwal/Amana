# AMANA: Commercial case and pilot proposal

Status: a reasoned case with **sourced volumes** and **assumed prices**. Every assumption is marked; none
is a quote or a signed commitment.

## 1. Who pays, and why
| Buyer | Pain today | What AMANA gives them |
|---|---|---|
| Programme owner (Abu Dhabi DoH / ADPHC; MOHAP for the other emirates) | Results reach couples late (at the marriage-contract stage) and as a binary "compatible / not"; carriers in compatible couples get little follow-up; counsellor time is scarce | Every screened person gets their own result and card; couples can check privately earlier; counsellor time goes to Tier 3 first; a dashboard of understanding and fairness |
| Screening labs | Delivering results and explaining them costs staff time | Signed results delivered once to the person's phone; fewer "what does this mean?" calls |
| Payers / health system | Cost of care for children born with severe recessive conditions | Earlier, informed choices (never measured as cancelled marriages) |

The person never pays. The product is licensed to the programme.

## 2. Volumes (sourced)
| Market | Figure | Source |
|---|---|---|
| Abu Dhabi premarital genetic test | 11,748 couples tested 2022–Jul 2026; 565 (≈5%) incompatible | Gulf News, 3 Oct 2026 ([link](https://gulfnews.com/uae/health/abu-dhabi-genetic-screening-flags-565-incompatible-cases-among-couples-1.500697261)) |
| Abu Dhabi panel | 570 genes, 840+ conditions; mandatory for Emirati couples | Abu Dhabi Media Office ([link](https://www.mediaoffice.abudhabi/en/health/doh-to-expand-pre-marital-screening-for-570-genetic-medical-conditions/)) |
| UAE-wide | Genetic testing mandatory in premarital screening for Emiratis from January 2025 | MOHAP ([link](https://mohap.gov.ae/en/w/mohap-announces-mandatory-genetic-testing-as-part-of-premarital-screening-for-emiratis-starting-early-january-2025)). Yearly volume **not published**; to request from MOHAP |
| Saudi Arabia | Mandatory premarital screening since 2004; about 150,000 marriages a year (secondary figure) | PMC7898212 ([link](https://pmc.ncbi.nlm.nih.gov/articles/PMC7898212)) |
| Consanguinity (why this matters here) | 50.5% of UAE marriages consanguineous, 26.2% first cousin (1994–95; no recent national figure) | UAEU ([link](https://research.uaeu.ac.ae/en/publications/consanguineous-marriages-in-the-united-arab-emirates/)) |

Abu Dhabi's 11,748 couples over about 4.5 years average roughly 2,600 couples a year, higher since the
test became mandatory (the yearly split is not published).

## 3. Cost to serve (from `docs/cost-model.md`)
Hosting is about **0.11–0.28 AED per couple per year** at 10,000 couples (estimate; Azure UAE North prices
to confirm). The private check runs on the phones, so compute barely grows with volume. The real costs are
people: clinical content review, Arabic review, support, and security audits.

| Yearly cost item (assumption) | AED |
|---|---|
| Hosting, monitoring, backups (10,000 couples) | 1,100–2,800 |
| Clinical + Arabic content review (part-time) | 120,000 |
| Product, security and support (2 FTE) | 600,000 |
| External security / privacy audit | 80,000 |
| **Total (assumed)** | **≈ 800,000** |

## 4. Pricing (assumption to test in the pilot)
**Per screened person per year, licensed to the programme**, with a fixed platform fee:

| Scenario | Screened people / year | Price (AED / person) | Platform fee (AED) | Revenue (AED) |
|---|---|---|---|---|
| Abu Dhabi only | 6,000 (≈3,000 couples) | 40 | 250,000 | 490,000 |
| UAE-wide | 20,000 (assumed; volume to obtain) | 35 | 400,000 | 1,100,000 |
| UAE + Saudi Arabia | 320,000 (UAE above + ≈150,000 Saudi couples) | 15 | 1,000,000 | 5,800,000 |

Abu Dhabi alone does not cover the assumed costs; **it is the pilot and the reference site**. The
business case depends on a second programme (UAE-wide or Saudi Arabia). Country packs
(`packs/`) make that a configuration change: panel, language, counsellor directory and tier rules.

## 5. Why a programme would choose this
- **Privacy that can be checked**, not promised: partners learn only "shared risk yes/no"; the server
  never sees genes; each consent is signed on the phone; the audit log is tamper-evident.
- **Non-directive by construction:** the AI cannot write patient text; decision questions are refused;
  options always include continuing without intervention.
- **Measurable:** understanding before/after, fairness by language and reading comfort, time to
  counselling, all on the dashboard with small groups hidden.
- **Cheap to run:** cents per couple in hosting.

## 6. Risks to the case
| Risk | Mitigation |
|---|---|
| Programme builds its own app | Offer AMANA as components (wallet SDK, token service, counsellor console) inside their app |
| Seen as enabling "marriage filtering" | Never report cancelled marriages; outcome = understanding and counselling uptake; clinical and ethics review first |
| National token service needs a trusted operator | Run it inside the programme's own tenant (DoH / national lab network) |
| Volumes lower than assumed | Price per person with a platform floor; expand to newborn and adult screening programmes |

---

## 7. Pilot proposal (one page)

The standalone version, with sample-size reasoning, budget and data protection, is
[`pitch/pilot-proposal.md`](../pitch/pilot-proposal.md).

**Title.** AMANA pilot: private, understandable premarital genetic results in Abu Dhabi.

**Partners sought.** Abu Dhabi Public Health Centre (programme owner), one accredited screening lab, one
counselling team (2–3 counsellors), Department of Health ethics committee.

**Aim.** Show that people understand their result better, and reach counselling sooner when needed,
with no unauthorised disclosure.

**Design.** 12 weeks. 200 screened people (100 couples) who choose to take part, recruited at result
delivery. Randomised 1:1: AMANA vs usual letter plus usual physician explanation.

**Measures (pre-registered).**
1. Understanding: 3-question teach-back, after-score and gain (primary).
2. Time from result to first counselling contact for incompatible couples.
3. Unauthorised disclosures (target: 0), measured by audit-log review and an external test.
4. Fairness: (1) and (2) by language and reading comfort, groups under 5 hidden.
5. Counsellor time per Tier 3 case; share of AI drafts used after editing.
Never measured as success: cancelled or changed marriage plans.

**What AMANA provides.** Arabic/English wallet, counsellor console, token service, hosting in UAE North,
clinical content for the pilot's most common genes (reviewed by the pilot's clinicians before launch),
training for counsellors, weekly reports.

**What partners provide.** Lab integration for signed results (the FHIR adapter exists as a mock),
national-ID sign-in access in a test tenant, counsellor time, ethics approval.

**Milestones.** Week 0–4: content review, integration, security review. Week 5–10: enrolment and
use. Week 11–12: analysis and report.

**Go / no-go for scale-up.** After-score ≥ 80% and better than control; no unauthorised disclosure;
no group more than 10 points below the overall score; counsellors willing to keep using the console.
