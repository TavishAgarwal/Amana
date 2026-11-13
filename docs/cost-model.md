# Cost per couple per year (AED) — estimate, not a quote

**Status:** an estimate built from measured load and clearly labelled assumptions. Exact UAE North prices were not available to me (Azure's pricing pages did not show rates), so the cloud prices below are **assumptions to replace** with figures from the [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/) set to UAE North.

## Measured
- 46.2 ms of CPU per two-way private check on one core (`sim/eval/results.json`, 10,000 checks, 0 errors; re-run 9 Nov 2026 after the check moved onto the devices).
- **Since 9 Nov this work runs on the two phones**, so the server only relays messages; the figures below are an upper bound for server compute.
- 100,000 checks ≈ 1.28 core-hours (extrapolated, not measured at 100,000).
- Server side, measured 10 Nov 2026 (`loadtest/results.json`): one token-service worker issues about 3,000
  token sets a second, and one relay process passes about 3,000 couple checks a second. Server compute is
  therefore not what sets the cost; the always-on containers are.

## Assumptions (change these)
| Item | Assumed monthly cost (USD) | Basis |
|---|---|---|
| App hosting (Container Apps) | 0–25 | 0–10 if everything scales to zero (`alwaysOn=false` in `infra/azure/main.bicep`): free monthly grant of 180,000 vCPU-s, 360,000 GiB-s and 2 M requests. Up to about 25 with the default `alwaysOn=true` (wallet, relay and API kept warm, about 2 vCPU mostly idle; idle rate assumed) |
| PostgreSQL Flexible Server, Burstable B1ms | 15–20 | Third-party estimate of about 12 USD/month in East US, plus an allowance for UAE North |
| Key Vault, storage, container registry | 5–8 | Small fixed items |
| Logs and monitoring | 5–10 | Scrubbed logs only; capped retention |
| **Total** | **25–63** | |

Currency: AED is pegged at **3.6725 per USD**.

## Result
Fixed cost dominates, because compute for a check is tiny.

| Item | Low | High |
|---|---|---|
| Monthly (AED) | 92 | 231 |
| Yearly (AED) | ~1,100 | ~2,800 |
| Per couple at 10,000 couples/year | **0.11** | **0.28** |
| Per couple at 100,000 couples/year | **0.011** | **0.028** |

## Not included
Staff, clinical review, counsellor time, lab integration work, the national token service's own hosting, support, security audit and any Azure OpenAI use (the rewriter is off). The real cost of running the programme is far larger than the hosting cost above.
