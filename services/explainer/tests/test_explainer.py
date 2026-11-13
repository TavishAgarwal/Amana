import json
from pathlib import Path

from explainer.core import (
    REFUSAL,
    CardStore,
    TeachBack,
    answer,
    draft_case_summary,
    explain,
    fact_check,
    has_directive,
    key_points,
    numbers,
    sentences,
)

STORE = CardStore("content/cards")
ALL_SENTENCES = {l: {s for c in [*STORE.cards.values(), STORE.basics] for s in sentences(c.text[l])} for l in ("ar", "en")}


def _verbatim(r: dict, lang: str) -> bool:
    """Every sentence shown is copied word for word from a reviewed card, after the optional refusal."""
    body = r["text"].removeprefix(REFUSAL[lang]).strip()
    return all(s in ALL_SENTENCES[lang] for s in r["sentences"]) and body == " ".join(r["sentences"])
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
        assert _verbatim(r, lang), p


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


class FakeLLM:
    """A model that misbehaves on purpose: invented sentence numbers, its own text, failures."""
    name = "fake"

    def __init__(self, reply):
        self.reply = reply

    def chat_json(self, system, user):
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply

    def chat(self, system, user):
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply.get("text", "")


def test_ai_only_selects_sentences_and_bad_output_is_dropped():
    q = "what does HBB mean for my children?"
    for reply in [{"sentences": [99, -3, "1", 4.0]}, {"sentences": "all"}, {"text": "You will be fine."},
                  {"sentences": [1, 1, 2, 3, 4, 5]}, RuntimeError("model down")]:
        r = answer(STORE, q, "en", llm=FakeLLM(reply))
        assert r["card"] == "beta-thalassaemia" and _verbatim(r, "en") and len(r["sentences"]) <= 3
        assert "fine" not in r["text"]


def test_decision_questions_never_reach_the_model():
    boom = FakeLLM(RuntimeError("must not be called"))
    for q, lang in [("Should we get married if we are both carriers of HBB?", "en"), ("هل نتزوج إذا كنا نحمل HBB؟", "ar")]:
        r = answer(STORE, q, lang, llm=boom)
        assert r["text"].startswith(REFUSAL[lang]) and r["selected_by"] == "rules" and _verbatim(r, lang)


def test_key_points_always_keep_numbers_and_choice():
    for code in STORE.cards:
        for lang in ("en", "ar"):
            k = key_points(STORE.cards[code], lang, llm=FakeLLM({"sentences": [1, 2]}))
            assert any("4" in s for s in k["sentences"]) and _verbatim(k, lang)
            assert any(w in k["text"] for w in ("decision is yours", "القرار قرارك"))


def test_case_draft_blocked_if_directive_or_new_number():
    card = STORE.cards["beta-thalassaemia"]
    for bad in ["- They should not marry.", "- There is a 25% risk."]:
        assert draft_case_summary(3, "incompatible", card, FakeLLM({"text": bad})).startswith("DRAFT for counsellor")
    ok = draft_case_summary(3, "incompatible", card, FakeLLM({"text": "- Explain the 1 in 4 chance neutrally."}))
    assert ok.startswith("DRAFT prepared by AI (fake)")


def test_card_lookup_handles_arabic_names_and_punctuation():
    assert STORE.find("ما هو الثلاسيميا بيتا؟").code == "beta-thalassaemia"
    assert STORE.find("هل should we marry مع SMN1؟").code == "spinal-muscular-atrophy"
    assert STORE.find("what is cystic fibrosis").code == "cystic-fibrosis"


def test_general_question_on_a_condition_page_uses_the_basics_card():
    store = STORE
    a = answer(store, "Can my children be affected if only I carry it?", "en", None, "hereditary-hearing-loss")
    assert a["card"] == "carrier-basics" and "only one parent" in a["text"]
    b = answer(store, "What is hereditary hearing loss?", "en", None, "hereditary-hearing-loss")
    assert b["card"] == "hereditary-hearing-loss"


def test_phone_index_is_up_to_date():
    """The wallet answers questions on the phone from apps/wallet/public/ask/index.json. It must hold
    the same cards and rules as this service; rebuild it with scripts/build_ask_index.py if not."""
    import importlib.util

    root = Path(__file__).resolve().parents[3]
    spec = importlib.util.spec_from_file_location("build_ask_index", root / "scripts/build_ask_index.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    shipped = json.loads((root / "apps/wallet/public/ask/index.json").read_text(encoding="utf-8"))
    assert shipped["version"] == mod.build()["version"], "run scripts/build_ask_index.py"
