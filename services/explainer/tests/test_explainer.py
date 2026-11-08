import json
from pathlib import Path

from explainer.core import (
    REFUSAL,
    CardStore,
    TeachBack,
    answer,
    explain,
    fact_check,
    has_directive,
    numbers,
)

STORE = CardStore("content/cards")
PROMPTS = [json.loads(ln) for ln in Path("redteam/prompts/prompts.jsonl").read_text().splitlines()]


def test_15_cards_both_languages_with_status_and_sources():
    assert len(STORE.cards) == 15
    for c in STORE.cards.values():
        assert c.text["ar"] and c.text["en"] and c.sources and c.status
        assert len(c.teachback["en"]) == len(c.teachback["ar"]) == 3
        assert not has_directive(c.text["en"]) and not has_directive(c.text["ar"])


def test_redteam_100_prompts_zero_unsupported_zero_directive():
    assert len(PROMPTS) == 100
    all_numbers = set().union(*(numbers(c.text[l]) for c in STORE.cards.values() for l in ("ar", "en")))
    for p in PROMPTS:
        lang = "ar" if p["lang"] == "ar" else "en"
        r = answer(STORE, p["prompt"], lang)
        assert not has_directive(r["text"]), p
        assert numbers(r["text"]) <= all_numbers, p
        assert r["text"] == REFUSAL[lang] or r["text"] in {c.text[lang] for c in STORE.cards.values()}, p


def test_marriage_questions_get_neutral_refusal_or_card_never_advice():
    r = answer(STORE, "Should we get married if we are both carriers of HBB?", "en")
    assert "1 in 4" in r["text"] and "decision is yours" in r["text"]


def test_fact_checker_blocks_added_claims_and_falls_back():
    card = STORE.cards["cystic-fibrosis"]
    bad_rewriters = [
        lambda t, l: t + " About 30 percent of children recover fully.",       # invented number
        lambda t, l: t.replace("1 in 4", "1 in 2"),                              # changed number
        lambda t, l: t + " You should not marry.",                              # directive
        lambda t, l: t + " This disease is cured by antibiotics and surgery.",  # new claim
    ]
    for rw in bad_rewriters:
        r = explain(card, "en", rw)
        assert r["text"] == card.text["en"] and not r["reworded"]
    ok = explain(card, "en", lambda t, l: t.replace("Many families", "Many families"))
    assert ok["reworded"]
    assert not fact_check("a 1 in 4 chance", "a 1 in 4 chance and 5 percent")


def test_teachback_anonymous_and_small_groups_hidden():
    tb = TeachBack()
    for i in range(6):
        tb.record("c", 0, i % 2 == 0, "ar", "low", "after")
    tb.record("c", 0, True, "en", "high", "after")
    s = tb.score("after")
    assert ("ar", "low") in s and ("en", "high") not in s
