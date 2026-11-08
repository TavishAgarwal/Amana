"""Explainer: reviewed cards are the only medical source. AI may only reword; a fact-checker gates it."""
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import yaml

DIRECTIVE = [
    r"\byou should\b", r"\bmust not\b", r"\bshould not\b", r"\bdo not marry\b", r"\bdon't marry\b",
    r"\bsafe\b", r"\bunsafe\b", r"\bgreat news\b", r"\bwarning\b", r"\bmust\b",
    "يجب", "لا تتزوج", "لا تتزوجا", "غير آمن", "آمن", "تحذير", "أخبار رائعة", "لا ينبغي",
]
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
REFUSAL = {
    "en": "I can only share what is on the reviewed cards, and I cannot tell anyone what to decide "
          "or whom to marry. A genetic counsellor can talk through your options with you.",
    "ar": "يمكنني فقط مشاركة ما ورد في البطاقات المراجعة، ولا أستطيع أن أخبر أحداً بما يقرره أو بمن يتزوج. "
          "يستطيع المستشار الوراثي مناقشة خياراتك معك.",
}


def has_directive(text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in DIRECTIVE)


def numbers(text: str) -> set[str]:
    return set(re.findall(r"\d+(?:\.\d+)?", text.translate(_DIGITS)))


def _words(text: str) -> set[str]:
    return {w.lower() for w in re.findall(r"[\w؀-ۿ]{4,}", text)}


def fact_check(card_text: str, reworded: str) -> bool:
    """Pass only if no new numbers, no directive wording, and every sentence stays inside the card."""
    if has_directive(reworded) or not numbers(reworded) <= numbers(card_text):
        return False
    vocab = _words(card_text)
    for sentence in re.split(r"[.!؟?]\s*", reworded):
        ws = _words(sentence)
        if ws and len(ws - vocab) / len(ws) > 0.1:
            return False
    return True


@dataclass
class Card:
    code: str
    gene: str
    status: str
    sources: list[str]
    text: dict[str, str]
    teachback: dict


class CardStore:
    def __init__(self, root: str | Path = "content/cards"):
        self.cards: dict[str, Card] = {}
        for d in sorted(Path(root).iterdir()):
            if not d.is_dir():
                continue
            meta = yaml.safe_load((d / "meta.yaml").read_text())
            self.cards[d.name] = Card(
                d.name, meta["gene"], meta["review_status"], meta["sources"],
                {l: (d / f"{l}.md").read_text().strip() for l in ("ar", "en")},
                yaml.safe_load((d / "teachback.yaml").read_text()))

    def find(self, question: str) -> Card | None:
        q = question.lower()
        for c in self.cards.values():
            if c.gene.lower() in q or c.code.replace("-", " ") in q:
                return c
        return None


Rewriter = Callable[[str, str], str]  # (card text, language) -> simpler text


def explain(card: Card, lang: str, rewriter: Rewriter | None = None) -> dict:
    original = card.text[lang]
    text, reworded = original, False
    if rewriter:
        candidate = rewriter(original, lang)
        if fact_check(original, candidate):
            text, reworded = candidate, True
    return {"text": text, "reworded": reworded, "review_status": card.status,
            "sources": card.sources, "card": card.code}


def answer(store: CardStore, question: str, lang: str, rewriter: Rewriter | None = None) -> dict:
    """Answers only by showing a card. Anything else gets the neutral refusal."""
    card = store.find(question)
    if card is None:
        return {"text": REFUSAL[lang], "reworded": False, "card": None}
    return explain(card, lang, rewriter)


@dataclass
class TeachBack:
    """Answers stored without identity: card, question, correct, language and literacy band only."""
    rows: list[tuple] = field(default_factory=list)

    def record(self, card: str, q: int, correct: bool, lang: str, literacy: str, stage: str) -> None:
        self.rows.append((card, q, correct, lang, literacy, stage))

    def score(self, stage: str, min_group: int = 5) -> dict:
        groups: dict[tuple, list[bool]] = {}
        for _, _, ok, lang, lit, st in self.rows:
            if st == stage:
                groups.setdefault((lang, lit), []).append(ok)
        return {k: sum(v) / len(v) for k, v in groups.items() if len(v) >= min_group}

