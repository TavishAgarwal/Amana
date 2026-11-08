"""Evaluation harness: correctness, cross-lab, privacy, red-team, routing, load. Writes results.json."""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from consent_ledger.cases import load_pack, route_tier
from explainer.core import REFUSAL, CardStore, answer, has_directive, numbers
from generator import generate_couples, load_panel
from token_service.core import Refused

PANEL = os.environ.get("AMANA_PANEL", "packs/abu-dhabi/panel.csv")

from sim.eval.protocol import CheckError, Relay, run_check
from sim.eval.world import World

PRIVACY_TESTS = [
    "sim/eval/tests/test_private_check.py", "sim/eval/tests/test_attack_and_adapters.py",
    "services/consent-ledger/tests/test_ledger.py", "services/token-service/tests",
]


def correctness(n: int, seed: int) -> dict:
    genes = load_panel(PANEL)
    couples, _ = generate_couples(n, genes, seed)
    w, relay = World(), Relay()
    missed = false_alarms = positives = 0
    for i, c in enumerate(couples):
        a, b = w.wallet("a", c.a, i), w.wallet("b", c.b, i + 1)  # different labs every time
        got = run_check(a, b, relay, w.period)["shared_risk"]
        truth = bool(c.shared)
        positives += truth
        missed += truth and not got
        false_alarms += got and not truth
    return {"couples": n, "positives": positives, "missed": missed, "false_alarms": false_alarms,
            "incompatible_rate": positives / n, "cross_lab": True,
            "accuracy": 1 - (missed + false_alarms) / n,
            "covered_by_card": _coverage(couples)}


def _coverage(couples) -> float:
    store = CardStore("content/cards")
    covered = {c.gene for c in store.cards.values()}
    inc = [c for c in couples if c.shared]
    return sum(bool(c.shared & covered) for c in inc) / len(inc) if inc else 0.0


def privacy() -> dict:
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", *PRIVACY_TESTS],
                       capture_output=True, text=True, check=False)
    return {"passed": r.returncode == 0, "summary": r.stdout.strip().splitlines()[-1]}


def redteam() -> dict:
    store = CardStore("content/cards")
    prompts = [json.loads(ln) for ln in Path("redteam/prompts/prompts.jsonl").read_text().splitlines()]
    nums = set().union(*(numbers(c.text[x]) for c in store.cards.values() for x in ("ar", "en")))
    texts = {x: {c.text[x] for c in store.cards.values()} for x in ("ar", "en")}
    directive = unsupported = 0
    for p in prompts:
        lang = "ar" if p["lang"] == "ar" else "en"
        t = answer(store, p["prompt"], lang)["text"]
        directive += has_directive(t)
        unsupported += not (numbers(t) <= nums and (t == REFUSAL[lang] or t in texts[lang]))
    return {"prompts": len(prompts), "directive": directive, "unsupported": unsupported,
            "rewording": "off (no Azure OpenAI configured; fallback R2)",
            "second_reviewer": "pending: two human reviewers required"}


def routing(n: int, seed: int) -> dict:
    pack = load_pack("packs/abu-dhabi/pack.yaml")
    genes = load_panel(PANEL)
    couples, _ = generate_couples(n, genes, seed)
    ok = sum(route_tier(pack, "incompatible" if c.shared else "compatible") ==
             (3 if c.shared else 1) for c in couples)
    return {"cases": n, "correct": ok}


def load(n: int, seed: int) -> dict:
    genes = load_panel(PANEL)
    couples, _ = generate_couples(n, genes, seed)
    w, relay, errors = World(), Relay(), 0
    t0 = time.perf_counter()
    for i, c in enumerate(couples):
        try:
            run_check(w.wallet("a", c.a, i), w.wallet("b", c.b, i + 1), relay, w.period)
        except (CheckError, Refused):
            errors += 1
    dt = time.perf_counter() - t0
    return {"checks": n, "errors": errors, "seconds": round(dt, 1),
            "ms_per_check_single_core": round(1000 * dt / n, 1),
            "projected_100k_core_hours": round(dt / n * 100_000 / 3600, 2),
            "projection": "extrapolated from this run, not measured at 100,000",
            "cost_aed": "not computed: needs Azure UAE North price for the chosen SKU (assumption)"}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--couples", type=int, default=5000)
    ap.add_argument("--load", type=int, default=10000)
    a = ap.parse_args()
    res = {"correctness": correctness(a.couples, 11), "privacy": privacy(), "redteam": redteam(),
           "routing": routing(1000, 5), "load": load(a.load, 13),
           "understanding": "not run: user test (n>=20) needs real participants",
           "fairness": "not run: depends on user test"}
    Path(os.environ.get("AMANA_RESULTS", "sim/eval/results.json")).write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))
