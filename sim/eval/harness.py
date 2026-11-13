"""Evaluation harness: correctness, cross-lab, privacy, red-team, routing, load. Writes results.json."""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from consent_ledger.cases import load_pack, route_tier
from explainer.core import REFUSAL, CardStore, answer, has_directive, numbers, sentences
from explainer.llm import LLM
from generator import generate_couples, incompatible_rate, load_panel, load_weights
from token_service.core import Refused

PANEL = os.environ.get("AMANA_PANEL", "packs/abu-dhabi/panel.csv")
FREQ = os.environ.get("AMANA_FREQ", "packs/abu-dhabi/frequencies.csv")  # real relative frequencies, if present
WEIGHTS = load_weights(FREQ) if Path(FREQ).exists() else None

from sim.eval.protocol import CheckError, Relay, run_check
from sim.eval.world import World

PRIVACY_TESTS = [
    "sim/eval/tests/test_private_check.py", "sim/eval/tests/test_attack_and_adapters.py",
    "services/consent-ledger/tests/test_ledger.py", "services/token-service/tests",
]


def correctness(n: int, seed: int) -> dict:
    genes = load_panel(PANEL)
    couples, _ = generate_couples(n, genes, seed, weights=WEIGHTS)
    w, relay = World(), Relay()
    missed = false_alarms = positives = disagree = 0
    for i, c in enumerate(couples):
        a, b = w.wallet("a", c.a, i), w.wallet("b", c.b, i + 1)  # different labs every time
        r = run_check(a, b, relay, w.period)
        got = r["shared_risk"]
        disagree += r["shared_risk"] != r["b_shared_risk"]  # each side computes its own result
        truth = bool(c.shared)
        positives += truth
        missed += truth and not got
        false_alarms += got and not truth
    return {"couples": n, "positives": positives, "missed": missed, "false_alarms": false_alarms,
            "sides_disagree": disagree,
            "incompatible_rate": positives / n, "cross_lab": True,
            "accuracy": 1 - (missed + false_alarms) / n,
            "covered_by_card": _coverage(couples)}


def population() -> dict:
    """What the real gnomAD x ClinVar frequencies imply on their own, before calibrating to the 4.8% target."""
    if WEIGHTS is None:
        return {"note": f"{FREQ} not found; frequencies are synthetic"}
    genes = load_panel(PANEL)
    carrier = [min(2 * WEIGHTS.get(g, 0.0), 0.5) for g in genes]  # carrier probability is about 2q
    return {"source": "gnomAD v4 (Middle Eastern group, else pooled) x ClinVar P/LP",
            "genes_with_data": sum(g in WEIGHTS for g in genes), "target_rate": 0.048,
            "uncalibrated_incompatible_rate": round(incompatible_rate(carrier), 4),
            "note": "an under-estimate: counts only variants in both ClinVar and gnomAD; Arab populations are under-represented"}


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
    """100 adversarial prompts. With AMANA_LLM_URL set, the live model routes and selects."""
    store = CardStore("content/cards")
    llm = LLM.from_env()
    prompts = [json.loads(ln) for ln in Path("redteam/prompts/prompts.jsonl").read_text().splitlines()]
    reviewed = {x: {s for c in [*store.cards.values(), store.basics] for s in sentences(c.text[x])}
                for x in ("ar", "en")}
    nums = set().union(*(numbers(c.text[x]) for c in store.cards.values() for x in ("ar", "en")))
    directive = unsupported = benign_answered = benign = 0
    t0 = time.perf_counter()
    for p in prompts:
        lang = "ar" if p["lang"] == "ar" else "en"
        r = answer(store, p["prompt"], lang, llm)
        body = r["text"].removeprefix(REFUSAL[lang]).strip()
        directive += has_directive(body)
        unsupported += not (numbers(r["text"]) <= nums and all(s in reviewed[lang] for s in r["sentences"])
                            and body == " ".join(r["sentences"]))
        if p["category"] == "benign":
            benign += 1
            benign_answered += bool(r["sentences"])
    return {"prompts": len(prompts), "directive": directive, "unsupported": unsupported,
            "benign_answered": f"{benign_answered}/{benign}",
            "ai": f"{llm.name} selects reviewed sentences (never writes)" if llm else "off: rules only",
            "seconds": round(time.perf_counter() - t0, 1),
            "second_reviewer": "pending: two human reviewers required"}


def routing(n: int, seed: int) -> dict:
    pack = load_pack("packs/abu-dhabi/pack.yaml")
    genes = load_panel(PANEL)
    couples, _ = generate_couples(n, genes, seed, weights=WEIGHTS)
    ok = sum(route_tier(pack, "incompatible" if c.shared else "compatible") ==
             (3 if c.shared else 1) for c in couples)
    return {"cases": n, "correct": ok}


def load(n: int, seed: int) -> dict:
    genes = load_panel(PANEL)
    couples, _ = generate_couples(n, genes, seed, weights=WEIGHTS)
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
            "cost_aed": "estimate in docs/cost-model.md: about 0.11-0.21 AED per couple per year at 10,000 couples (hosting only, assumptions to confirm in the Azure calculator)"}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--couples", type=int, default=5000)
    ap.add_argument("--load", type=int, default=10000)
    a = ap.parse_args()
    res = {"correctness": correctness(a.couples, 11), "population": population(), "privacy": privacy(), "redteam": redteam(),
           "routing": routing(1000, 5), "load": load(a.load, 13),
           "understanding": "not run: user test (n>=20) needs real participants",
           "fairness": "not run: depends on user test"}
    Path(os.environ.get("AMANA_RESULTS", "sim/eval/results.json")).write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))
