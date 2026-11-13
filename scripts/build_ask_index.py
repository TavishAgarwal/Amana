"""Builds apps/wallet/public/ask/index.json: everything the phone needs to answer questions offline.

Reviewed card sentences (both languages), name keys, and the safety rules (decision refusal, etc.),
taken from services/explainer so the phone and the server use the same rules.
Run after any card change:  PYTHONPATH=services/explainer uv run python scripts/build_ask_index.py
"""
import hashlib
import json
import re
from pathlib import Path

import yaml
from explainer import core

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/wallet/public/ask/index.json"


def card(c: core.Card, keys: set[str]) -> dict:
    return {"code": c.code, "gene": c.gene, "status": c.status, "sources": c.sources, "keys": sorted(keys),
            "sentences": {lang: core.sentences(c.text[lang]) for lang in ("en", "ar")},
            "what": {lang: [s for sec in core.card_sections(c, lang) if sec["key"] == "what" for s in sec["sentences"]]
                     for lang in ("en", "ar")},
            "section": {lang: [section_of(s, i) for i, s in enumerate(core.sentences(c.text[lang]))] for lang in ("en", "ar")}}


def section_of(s: str, i: int) -> str:
    """Same classification as core.card_sections, per sentence; 'source' for the sources line."""
    if core._is_source(s):
        return "source"
    if i == 0 and ":" in s:
        s = s.split(":", 1)[1]
    return ("both" if core._BOTH.search(s) else "options" if core._OPTIONS.search(s)
            else "carrier" if core._CARRIER.search(s) else "what")


def build() -> dict:
    store = core.CardStore(ROOT / "content/cards")
    data = {
        "cards": [card(c, store.keys[c.code]) for c in store.cards.values()],
        "basics": card(store.basics, set()),
        "rules": {k: {"pattern": getattr(core, k).pattern, "flags": "i" if getattr(core, k).flags & re.IGNORECASE else ""}
                  for k in ("DECISION", "_BASICS", "_GENERAL", "_KEEP", "_TOK")},
        "stop": sorted(core._STOP),
        "directive": core.DIRECTIVE,
        "refusal": core.REFUSAL,
        "anchors": yaml.safe_load((ROOT / "content/ask/anchors.yaml").read_text(encoding="utf-8")),
    }
    body = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    data["version"] = hashlib.sha256(body.encode()).hexdigest()[:12]
    return data


def main() -> None:
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(data['cards'])} cards + basics, version {data['version']}, "
          f"{OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
