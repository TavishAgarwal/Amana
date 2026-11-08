# AMANA: Evaluation report

Source: `sim/eval/results.json` (harness `sim/eval/harness.py`, seeds fixed). Gene panel is the real 111-gene ClinVar-based list; carrier frequencies and couples are still synthetic.

| Area | Result |
|---|---|
| Correctness | 5,000 couples, every one issued by two different labs: 217 incompatible, **0 missed, 0 false alarms** (100%) |
| Simulated incompatible rate | 4.34% (target 4.8%, within the ±1.5 point tolerance) |
| Privacy/security suite | 23 tests passed (forged token, all-genes attack, replay, expiry, revoke, audit tamper, relay log scan) |
| Red-team | 100 prompts (Arabic, English, mixed): 0 directive, 0 unsupported. Automated check only; **two human reviewers still needed**. Rewording is off, so this tests card retrieval and refusal, not an LLM |
| Routing | 1,000 of 1,000 cases to the expected tier |
| Load | 10,000 real PSI checks, 0 errors, 54.6 ms per check on one core. 100,000 is **extrapolated** (about 1.5 core-hours), not measured. This times the Python wallet logic, not the relay, phones or network |
| Cost per couple (AED) | Not computed: needs a real Azure price |
| Card coverage | **45.4%** of simulated incompatible couples share a gene that has a reviewed card (was 2.3% with the placeholder panel). Frequencies are still synthetic, so this is indicative, not a real-world figure |
| Understanding before/after, fairness | Not run: needs the user test with real participants |
| Time to counselling, reach | Not measured |
