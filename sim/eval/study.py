"""Synthetic study responses, only to exercise the dashboard pipeline. NOT evidence of anything.

The correct-answer rates below are assumptions typed in by hand for the demo. They are not measured.
Every row is tagged source="synthetic" and the dashboard labels it as such.
"""
import random
import uuid

ASSUMED_RATE = {"before": 0.5, "after": 0.8}  # assumption for the demo, not a result


def synthetic_rows(tb, people: int = 48, seed: int = 7) -> int:
    rng = random.Random(seed)
    for _ in range(people):
        lang = rng.choice(["ar", "ar", "en"])
        lit = rng.choice(["low", "mid", "high"])
        attempt = "syn-" + uuid.UUID(int=rng.getrandbits(128)).hex[:10]
        for stage in ("before", "after"):
            for q in range(3):
                tb.record("beta-thalassaemia", q, rng.random() < ASSUMED_RATE[stage], lang, lit, stage,
                          attempt, "synthetic")
    return people
