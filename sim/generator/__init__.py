"""Consanguinity-aware synthetic population. Reproducible from a seed."""
import csv
import math
import random
from dataclasses import dataclass
from pathlib import Path

COUSIN_SHARE = 0.35  # stated mix: share of couples that are first cousins
COUSIN_SHARED_ALLELE = 1 / 8  # P(partner carries carrier's allele by descent), first cousins
TARGET_RATE = 0.048


def load_panel(path: str | Path) -> list[str]:
    with open(path) as f:
        lines = [ln for ln in f if not ln.startswith("#")]
    return [r["gene"] for r in csv.DictReader(lines)]


def _p_both(q: float, cousin: bool) -> float:
    return q * (q + (1 - q) * COUSIN_SHARED_ALLELE) if cousin else q * q


def incompatible_rate(freqs: list[float], cousin_share: float = COUSIN_SHARE) -> float:
    def none(cousin: bool) -> float:
        return math.prod(1 - _p_both(q, cousin) for q in freqs)
    return 1 - ((1 - cousin_share) * none(False) + cousin_share * none(True))


def calibrated_frequencies(
    genes: list[str], seed: int, target: float = TARGET_RATE, cousin_share: float = COUSIN_SHARE
) -> dict[str, float]:
    rng = random.Random(seed)
    base = [math.exp(rng.gauss(0, 1.2)) for _ in genes]  # heavy-tailed relative frequencies
    lo, hi = 0.0, 0.2 / max(base)
    for _ in range(80):
        mid = (lo + hi) / 2
        if incompatible_rate([mid * b for b in base], cousin_share) < target:
            lo = mid
        else:
            hi = mid
    return {g: min(lo * b, 0.5) for g, b in zip(genes, base)}


@dataclass
class Person:
    id: str
    carrier_genes: list[str]
    family: str


@dataclass
class Couple:
    id: str
    a: Person
    b: Person
    cousin: bool

    @property
    def shared(self) -> set[str]:
        return set(self.a.carrier_genes) & set(self.b.carrier_genes)


def generate_couples(
    n: int, genes: list[str], seed: int, cousin_share: float = COUSIN_SHARE
) -> tuple[list[Couple], dict[str, float]]:
    freqs = calibrated_frequencies(genes, seed, cousin_share=cousin_share)
    rng = random.Random(seed + 1)
    items = list(freqs.items())
    couples = []
    for i in range(n):
        cousin = rng.random() < cousin_share
        fam = f"fam-{i:06d}"
        a = [g for g, q in items if rng.random() < q]
        aset = set(a)
        b = [
            g for g, q in items
            if rng.random() < q or (cousin and g in aset and rng.random() < COUSIN_SHARED_ALLELE)
        ]
        couples.append(Couple(
            f"cpl-{i:06d}", Person(f"p-{i:06d}a", a, fam), Person(f"p-{i:06d}b", b,
            fam if cousin else f"fam-{i:06d}b"), cousin))
    return couples, freqs
