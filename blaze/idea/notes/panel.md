# Blind panel scores (rubric 17/17/17/17/16/16)
Order of criteria: Impact, Tech depth, Demo, Responsible AI, Scalability, Commercial

## Scorer C — clinician / end-user advocate
| Idea | Imp | Tech | Demo | RAI | Scale | Comm | Total | Feas | Wow | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 AMANA | 7.5 | 7.5 | 7 | 8 | 5.5 | 5.5 | 69 | 4 | 4 | M |
| S2 HEATLEDGER | 8 | 6.5 | 8 | 7 | 7 | 5 | 69 | 5 | 4 | M |
| S3 CLOSURE | 6.5 | 6.5 | 5 | 7 | 7 | 6.5 | 64 | 4 | 2 | L |
| S4 RAJUL | 5 | 4 | 5.5 | 5.5 | 5 | 4.5 | 49 | 4 | 2 | M |
Objections: S1 — inside mandatory programme the lab already sees both results so PSI placement is unclear; marriage-filtering perception; stigma on women carriers; counsellor sign-off needed. S2 — attestations could be used to blame workers; PHS not validated for this workforce. S3 — alert/admin burden, liability. S4 — false reassurance.

## Scorer J — hackathon judge
| Idea | Imp | Tech | Demo | RAI | Scale | Comm | Total | Feas | Wow | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 AMANA | 7 | 8 | 7 | 9 | 6 | 6 | 72 | 4 | 4 | M |
| S2 HEATLEDGER | 8 | 6 | 8 | 7 | 7 | 5 | 69 | 5 | 3 | L |
| S3 CLOSURE | 7 | 6 | 5 | 7 | 7 | 6 | 63 | 4 | 2 | M |
| S4 RAJUL | 5 | 4 | 5 | 6 | 5 | 4 | 48 | 4 | 2 | M |
Notes: S1 affected group modest (565 flagged); Open-Meteo free tier non-commercial (S2).

## Scorer E — senior engineer
| Idea | Imp | Tech | Demo | RAI | Scale | Comm | Total | Feas | Wow | Risk |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 AMANA | 7 | 7 | 8 | 8 | 5 | 5 | 67 | 4 | 5 | M |
| S2 HEATLEDGER | 7 | 6 | 8 | 6 | 7 | 5 | 65 | 5 | 3 | M |
| S3 CLOSURE | 7 | 6 | 5 | 7 | 7 | 6 | 63 | 4 | 2 | M |
| S4 RAJUL | 5 | 4 | 5 | 6 | 5 | 5 | 50 | 4 | 2 | M |
Riskiest: S1 — PSI over a small public gene universe is brute-forceable (need per-couple blinding/salting); Arabic explainer correctness. S2 — individual alert accuracy unvalidated (liability). S3 — demo shows state machine not impact. S4 — unvalidated clinical logic.

## Aggregate (median per criterion)
| Idea | Imp | Tech | Demo | RAI | Scale | Comm | Total | Max spread |
|---|---|---|---|---|---|---|---|---|
| S1 AMANA | 7 | 7.5 | 7 | 8 | 5.5 | 5.5 | **67.75 → 68** | 1.0 |
| S2 HEATLEDGER | 8 | 6 | 8 | 7 | 7 | 5 | **68.5 → 69** | 1.0 |
| S3 CLOSURE | 7 | 6 | 5 | 7 | 7 | 6 | 63 | 0.5 |
| S4 RAJUL | 5 | 4 | 5 | 6 | 5 | 4.5 | 49 | 0.5 |
No criterion spread ≥3 → no adjudication. Avg spread ≤1 → panel confidence High.

## Pick decision
S1 vs S2 differ by 0.75 pts, inside panel noise (per-criterion spread up to 1.0 ≈ ±1.7 pts). Declared a statistical tie; tiebreak on documented secondary factors, fixed before novelty result:
1. Competition density: F3 low vs P4 medium (context track).
2. Wow: S1 mean 4.3 vs S2 3.3.
3. Fixability: S1's low rows (Scale 5.5, Comm 5.5) are positioning/architecture gaps fixable in the spec (complement the mandatory programme; pre-engagement + carrier-cascade + counselling layer; Malaffi-compatible FHIR Consent). S2's low rows are RAI/Impact gaps from an unvalidated individual safety alert; not fixable in 17 days without physiological data, and they carry liability.
4. Tech depth (median 7.5 vs 6): S2 was judged an assembly of existing parts by all 3 scorers.
→ Winner S1 AMANA. Runner-up (pivot) S2 HEATLEDGER (`/blaze idea --pick 2`).
