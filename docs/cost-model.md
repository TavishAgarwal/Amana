# Cost per couple per year (AED) — estimate, not a quote

**Status:** an estimate built from measured load and clearly labelled assumptions. Exact UAE North prices were not available to me (Azure's pricing pages did not show rates), so the cloud prices below are **assumptions to replace** with figures from the [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/) set to UAE North.

## Measured
- 25.1 ms of CPU per private check on one core (`sim/eval/results.json`, 10,000 checks, 0 errors).
- 100,000 checks ≈ 0.7 core-hours (extrapolated, not measured at 100,000).

## Assumptions (change these)
| Item | Assumed monthly cost (USD) | Basis |
|---|---|---|
| App hosting (Container Apps, scale to zero) | 0–10 | Free monthly grant of 180,000 vCPU-s, 360,000 GiB-s and 2 M requests; 100,000 checks use ~2,500 vCPU-s |
| PostgreSQL Flexible Server, Burstable B1ms | 15–20 | Third-party estimate of about 12 USD/month in East US, plus an allowance for UAE North |
| Key Vault, storage, container registry | 5–8 | Small fixed items |
| Logs and monitoring | 5–10 | Scrubbed logs only; capped retention |
| **Total** | **25–48** | |

Currency: AED is pegged at **3.6725 per USD**.

## Result
Fixed cost dominates, because compute for a check is tiny.

| Item | Low | High |
|---|---|---|
| Monthly (AED) | 92 | 176 |
| Yearly (AED) | ~1,100 | ~2,100 |
| Per couple at 10,000 couples/year | **0.11** | **0.21** |
| Per couple at 100,000 couples/year | **0.011** | **0.021** |

## Not included
Staff, clinical review, counsellor time, lab integration work, the national token service's own hosting, support, security audit and any Azure OpenAI use (the rewriter is off). The real cost of running the programme is far larger than the hosting cost above.
