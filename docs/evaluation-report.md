# AMANA: Evaluation report

Source: `sim/eval/results.json` (harness `sim/eval/harness.py`, seeds fixed). Re-run on 9 Nov 2026 after the check moved onto the devices (two-way check, no tokens in the hello). Every number below is copied from that file; if they ever disagree, the file is right. Gene panel is the real 111-gene ClinVar-based list; relative gene frequencies come from gnomAD v4 (Middle Eastern group) x ClinVar, scaled to the 4.8% target; couples are still simulated.

| Area | Result |
|---|---|
| Correctness | 5,000 couples, every one issued by two different labs: 271 incompatible, **0 missed, 0 false alarms** (100%); both sides computed the same answer on all 5,000 |
| Simulated incompatible rate | 5.42% (271 of 5,000; target 4.8%, within the ±1.5 point tolerance) |
| Privacy/security suite | 26 tests passed (forged token, all-genes attack, replay, expiry, revoke, audit tamper, relay log scan, no tokens in the hello, each side computes its own result, no reveal without the serving side's consent). Browser side: two wallets over the real relay, one request per session, no token in anything relayed (`apps/wallet/tests/check.test.mjs`) |
| Red-team | 100 prompts (Arabic, English, mixed): 0 directive, 0 unsupported. Automated check only; **two human reviewers still needed**. Rewording is off, so this tests card retrieval and refusal, not an LLM |
| Routing | 1,000 of 1,000 cases to the expected tier |
| Load | 10,000 real two-way checks (two PSI runs each), 0 errors, 45.7 ms per check on one core (457 s in total). 100,000 is **extrapolated** (about 1.27 core-hours), not measured. In the product this work runs on the two phones, not on a server This times the Python wallet logic, not the relay, phones or network |
| Cost per couple (AED) | **Estimate** about 0.11–0.21 AED per couple per year at 10,000 couples (hosting only; see `docs/cost-model.md`; prices are assumptions until checked in the Azure calculator) |
| Card coverage | **51.7%** of simulated incompatible couples (15 cards over a 111-gene panel) share a gene that has a reviewed card (2.3% with the original placeholder panel). Indicative only: frequencies are scaled to the target, not measured |
| Real-frequency check | Using the gnomAD Middle Eastern x ClinVar frequencies **without** calibration (35% first-cousin mix), the implied incompatible-couple rate is **3.98%**, against the 4.8% target. It is an under-estimate by construction (see `docs/limitations.md`), so the target is plausible but not confirmed |
| Understanding before/after, fairness | Not run: needs the user test with real participants |
| Time to counselling, reach | Not measured |
