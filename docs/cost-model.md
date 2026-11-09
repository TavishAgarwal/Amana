# Cost per couple per year (AED) — estimate, not a quote

**Status:** an estimate built from measured load and clearly labelled assumptions. Exact UAE North prices were not available to me (Azure's pricing pages did not show rates), so the cloud prices below are **assumptions to replace** with figures from the [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/) set to UAE North.

## Measured
- 45.7 ms of CPU per two-way private check on one core (`sim/eval/results.json`, 10,000 checks, 0 errors; re-run 9 Nov 2026 after the check moved onto the devices).
- **Since 9 Nov this work runs on the two phones**, so the server only relays messages; the figures below are an upper bound for server compute.
- 100,000 checks ≈ 1.27 core-hours (extrapolated, not measured at 100,000).

## Assumptions (change these)
| Item | Assumed monthly cost (USD) | Basis |
|---|---|---|
| App hosting (Container Apps, scale to zero) | 0–10 | Free monthly grant of 180,000 vCPU-s, 360,000 GiB-s and 2 M requests; 100,000 checks use at most ~4,600 vCPU-s (less in practice: the check runs on the phones) |
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
