"""Removes gene names and token values from log lines (rules.md §4)."""
import re

_HEX = re.compile(r"\b[0-9a-f]{32,}\b")


def scrub(line: str, genes: set[str] | frozenset[str] = frozenset()) -> str:
    line = _HEX.sub("[token]", line)
    for g in genes:
        line = re.sub(rf"\b{re.escape(g)}\b", "[gene]", line)
    return line
