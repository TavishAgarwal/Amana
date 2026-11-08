# Candidates, filter & kill log (2026-11-03)

Sources for every claim: notes/research_track_*.md. Rubric fixed in notes/brief.md (6 criteria, 17/17/17/17/16/16).

## Shortlist (survived prior-art kill check, feasibility ≥3, trap screen)

### S1 — AMANA (F3 Inherited Disease Risk)  "Know your couple risk, keep your genome"
Private, user-held carrier wallet + couple compatibility check via private set intersection (PSI) that reveals only "shared-gene risk: yes/no (+ which condition, only if both consent)", never either partner's full carrier list. Three disclosure tiers (self / partner / named relative) as signed, expiring, revocable consent tokens with an audit log. Bilingual Arabic/English explainer (rule-templated core + LLM paraphrase guarded by a fact-check) with teach-back comprehension quiz. Every "shared risk" result auto-routes to a counsellor queue with a counsellor copilot (pre-filled case summary, CTGA condition facts, options list). Consented cascade: carrier → invite siblings/cousins to test without revealing who triggered it.
- Core insight: Abu Dhabi programme only flags couples where both carry the same mutation (565/11,748); ~95% "compatible" couples still contain carriers who get no follow-up, and compatibility is discovered late (after engagement). Early, private, user-controlled checks reduce stigma; cryptography makes "no one else sees my carrier list" provable, not promised.
- Closest prior art: Dor Yeshorim (central trusted DB, no self-knowledge), Baldi 2011 (academic PSI, no UX), QOMPLX US12373600 (homomorphic encryption, US, no counselling; confirmed no PSI in summary), Invitae Gia (English rule bot), Nucleus (DTC, eugenics criticism).
- Feasibility 4/5: OpenMined PSI (Apache-2.0, JS+Python), ClinVar+CTGA gene lists, synthetic carrier panels; no wet-lab or real genomes needed. Riskiest: Arabic explainer correctness + clinical credibility → mitigate with templated facts and a "reviewed by" placeholder for a genetic counsellor advisor.
- Trap screen: data OK (synthetic from public variant DBs); regulatory: decision-support only, non-directive; demo in 3 min ✓; wow not dependent on unproven model ✓; all 6 MUSTs addressable ✓. Ethical risk: perceived as enabling marriage "filtering" → non-directive design, outcome metric = comprehension + counselling uptake, never cancelled marriages (PS item 6).

### S2 — HEATLEDGER (P4 Climate-Resilient Worker Health)
No-wearable-required personal heat-strain estimate: ISO 7933 Predicted Heat Strain (pythermalcomfort) driven by live Open-Meteo weather + task workload + PPE + acclimatisation day count; optional consented wearable HR. Multilingual (Urdu/Hindi/Bengali/Malayalam/Arabic/English) graded voice+icon alerts on offline PWA; worker-held data, employer sees only k-anonymised crew heat load + signed "rest-break owed/taken" attestations.
- Insight: UAE rule is calendar-based (12:30–15:00, Jun 15–Sep 15) while 51.6°C hit Dubai in May (HRW); physiology-based thresholds close the gap without surveillance.
- Prior art: Kenzen/SlateSafety (wearable, enterprise), OSHA-NIOSH app (heat index only).
- Feasibility 5/5 (live data, open model). Risk: no validation data for alert accuracy; wearable vendors dominate commercial story.

### S3 — CLOSURE (P2 Screening-to-Care Loop)
FHIR R4 state machine (ServiceRequest/Task/Appointment/Communication) per actionable result with NHS-failsafe-style owner + SLA timers; closure only with evidence (attended appointment, repeat result, or documented informed refusal); hash-chained audit; bilingual patient acknowledgement; human-approved escalation; "unresolved results" + time-to-care metrics. Demo on Synthea cohort with injected drop-offs.
- Insight: local hook — reported 30.5% follow-up colonoscopy after positive FIT among Emiratis (source blocked, UNVERIFIED).
- Prior art: Inflo, Eon (US radiology, single system).
- Feasibility 4/5. Risk: low wow; enterprise integration story vs Malaffi; incumbents.

### S4 — RAJUL (F1 Male Reproductive Health)
Anonymous-first men's reproductive front door: Arabic/English explainable risk intake (lifestyle, varicocele/infection/metabolic red flags), at-home kit result interpretation, triage to self-care/PCP/andrology/urgent with human review, privacy vault.
- Prior art: home kits (YO, Legacy, Fellow), Altibbi telehealth.
- Feasibility 4/5. Risk: no validated risk model (UCI n=100 too small) → rule-based guideline engine; "chatbot + questionnaire" looks overdone.

## Killed
| Idea | Reason |
|---|---|
| W2 crisis-escalation fuzzing / counsellor-load exchange | W2 very high competition; synthetic crisis replay can't prove safety; high harm risk |
| W1 synaptic-homeostasis habit plans | Very crowded (fitness/habit apps); outcome "sustained change" unprovable in 17 days |
| P5 voice Arabic cognitive probe | No validated Arabic speech data accessible; clinical validity unprovable; false-positive harm |
| P3 quorum-sensing / prediction-market early warning | Needs real multi-signal data; synthetic anomalies unconvincing (pophealth track) |
| P1 slot-auction outreach / household cascade | P1 crowded; auction framing hard to justify clinically; household nudging risks privacy breach |
| F2 anti-score trend card | Needs longitudinal hormone/semen data we don't have; overlaps S4; thin wow |
| P2 obligation clearing house / re-auction | Merged into S3 (re-auction to other clinics unrealistic under DoH referral rules) |
| P4 heat futures desk | Merged into S2 (pricing framing distracts from worker-first) |
| F3 conjugation plasmids / option market | Merged into S1 as consent tokens |

Candidates generated: 30 (adhd 5 frames × 6) + 2 remix (Dor Yeshorim→PSI; NHS failsafe→FHIR). Shortlisted 4, killed/merged 26.
