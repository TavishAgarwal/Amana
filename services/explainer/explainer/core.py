"""Explainer: reviewed cards are the only medical source. AI may only reword; a fact-checker gates it."""
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .llm import LLM_ERRORS

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
    aliases: list[str] = field(default_factory=list)


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
                yaml.safe_load((d / "teachback.yaml").read_text()), meta.get("aliases") or [])

        basics = Path(root).parent / "basics"
        self.basics: Card | None = None
        if (basics / "meta.yaml").exists():
            meta = yaml.safe_load((basics / "meta.yaml").read_text())
            self.basics = Card("carrier-basics", "", meta["review_status"], meta["sources"],
                               {l: (basics / f"{l}.md").read_text().strip() for l in ("ar", "en")}, {})
        self.keys = {c.code: _name_keys(c) for c in self.cards.values()}

    def find(self, question: str) -> Card | None:
        """Keyword match on gene symbol or condition name, in English or Arabic."""
        q = _norm(question)
        qwords = set(_TOK.findall(q))
        best, score = None, 0
        for c in self.cards.values():
            s = sum(1 for k in self.keys[c.code] if (k in qwords if len(k) <= 5 else k in q))
            if s > score:
                best, score = c, s
        return best

    def titles(self, lang: str) -> dict[str, str]:
        return {c.code: c.text[lang].split(":")[0] for c in self.cards.values()}


Rewriter = Callable[[str, str], str]  # (card text, language) -> simpler text


def explain(card: Card, lang: str, rewriter: Rewriter | None = None) -> dict:
    original = card.text[lang]
    text, reworded = original, False
    if rewriter:
        candidate = rewriter(original, lang)
        if fact_check(original, candidate):
            text, reworded = candidate, True
    return {"text": text, "reworded": reworded, "review_status": card.status,
            "sources": card.sources, "card": card.code, "gene": card.gene,
            "title": original.split(":")[0], "sections": card_sections(card, lang)}


_BOTH = re.compile(r"both parents|when both|1 in 4|الوالدان|كلا الوالدين|1 من كل 4", re.IGNORECASE)
_OPTIONS = re.compile(r"decision|options|counsellor|القرار|الخيارات|مستشار", re.IGNORECASE)
SECTION_ORDER = ("what", "carrier", "both", "options")


def card_sections(card: "Card", lang: str) -> list[dict]:
    """Splits the reviewed card into the design's sections. Sentences are kept word for word."""
    out: dict[str, list[str]] = {k: [] for k in SECTION_ORDER}
    for i, s in enumerate(sentences(card.text[lang])):
        if _is_source(s):
            continue
        if i == 0 and ":" in s:
            s = s.split(":", 1)[1].strip()
            s = s[:1].upper() + s[1:]
        key = ("both" if _BOTH.search(s) else "options" if _OPTIONS.search(s)
               else "carrier" if _CARRIER.search(s) else "what")
        out[key].append(s)
    return [{"key": k, "sentences": v} for k, v in out.items() if v]


def _norm(text: str) -> str:
    t = text.lower().replace("thalassemia", "thalassaemia").replace("β", "beta")
    return re.sub(r"[ًٌٍَُِّْ]", "", t)  # Arabic diacritics


def _name_keys(c: "Card") -> set[str]:
    """Gene symbol, card code words and title words (both languages) used to find a card."""
    keys = {c.gene.lower(), *(a.lower() for a in c.aliases)}
    keys |= {w for w in c.code.split("-") if len(w) >= 6}
    for lang in ("en", "ar"):
        title = _norm(c.text[lang].split(":")[0])
        for w in _TOK.findall(title):
            keys |= {p for p in [w, *w.split("-")] if len(p) >= 4 and p not in _STOP}
    return keys


_TOK = re.compile(r"[A-Za-z0-9\u0621-\u064A\u0660-\u0669αβ-]+")  # words without punctuation (incl. ؟)
_STOP = {"hereditary", "familial", "deficiency", "congenital", "الوراثي", "الوراثية", "العائلية", "نقص"}
DECISION = re.compile(
    r"\b(should (we|i)|marry|marriage|married|wedding|engagement|cancel|call it off|abort|termination|"
    r"is it (safe|ok|okay)|what do you recommend|recommend|what would you do)\b|"
    r"تزوج|نتزوج|الزواج|زواج|الخطوبة|هل يجب|هل ينبغي|نلغي|إلغاء|إجهاض|ننصح|تنصح|ماذا تفعل",
    re.IGNORECASE)
_BASICS = re.compile(r"\b(carrier|carriers|recessive|inherit|inheritance|cousin|cousins|relatives|1 in 4|"
                     r"brother|brothers|sister|sisters|siblings?)\b|"
                     r"حامل|حاملين|وراث|أقارب|ابن العم|أبناء العم|1 من كل 4|أخي|أختي|إخوتي|أخواتي", re.IGNORECASE)
_KEEP = re.compile(r"\d|decision|options|القرار|الخيارات")
# General inheritance questions (who else, only one parent) are answered from the carrier-basics card.
_GENERAL = re.compile(r"\bonly (one|i|me)\b|\bjust (one|me)\b|one parent|cousins?|relatives|siblings?|sister|brother|"
                      r"children|kids|inherit|أحد الوالدين|أحدنا فقط|واحد منا|أقارب|ابن العم|أبناء|أطفال|إخوة|أختي|أخي", re.IGNORECASE)
_CARRIER = re.compile(r"carrier|حمل تغيير|حامل", re.IGNORECASE)


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.؟?!])\s+", text.strip()) if s]


def _is_source(s: str) -> bool:
    return s.startswith(("Sources", "المصادر"))


def _valid_ids(raw, n: int, skip: set[int], limit: int) -> list[int]:
    """Only real sentence numbers survive: anything the model invents is dropped."""
    out: list[int] = []
    for x in raw if isinstance(raw, list) else []:
        i = x - 1 if isinstance(x, int) else -1
        if 0 <= i < n and i not in skip and i not in out:
            out.append(i)
    return out[:limit]


def _numbered(ss: list[str]) -> str:
    return "\n".join(f"{i + 1}. {s}" for i, s in enumerate(ss))


SELECT_SYS = ("You choose which numbered sentences from a reviewed medical information card answer a "
              "person's question. Reply only with JSON {\"sentences\": [numbers]} listing 1 to 3 sentence "
              "numbers, or an empty list if no sentence answers it. Never write your own text.")
PICK_SYS = ("You route a person's question to an information card. Reply only with JSON {\"card\": code} "
            "using one code from the list, \"basics\" for general questions about being a carrier, "
            "inheritance or relatives, or \"none\" if the question is about something else. "
            "Never answer the question yourself.")
KEY_SYS = ("You choose sentences for a reader with low reading comfort. From the numbered sentences, pick "
           "the 2 that best explain what the condition is and what being a carrier means. Reply only "
           "with JSON {\"sentences\": [numbers]}.")
_cache: dict[tuple, list[int]] = {}


def _result(card: "Card", lang: str, idx: list[int], by: str, prefix: str = "") -> dict:
    ss = sentences(card.text[lang])
    picked = [ss[i] for i in sorted(set(idx))]
    text = (prefix + " " if prefix else "") + " ".join(picked)
    return {"text": text.strip(), "sentences": picked, "card": card.code, "selected_by": by,
            "reworded": False, "review_status": card.status, "sources": card.sources}


def key_points(card: "Card", lang: str, llm=None) -> dict:
    """The sentences a low-literacy reader needs. Numbers, decision and options sentences are always kept."""
    ss = sentences(card.text[lang])
    skip = {i for i, s in enumerate(ss) if _is_source(s)}
    must = [i for i, s in enumerate(ss) if i not in skip and _KEEP.search(s)]
    rest = set(range(len(ss))) - skip - set(must)
    extra, by = [], "rules"
    if llm is not None:
        key = ("key", card.code, lang, llm.name)
        try:
            if key not in _cache:
                _cache[key] = _valid_ids(llm.chat_json(KEY_SYS, _numbered(ss)).get("sentences"),
                                         len(ss), skip | set(must), 2)
            extra, by = _cache[key], "ai"
        except LLM_ERRORS:
            extra = []
    if not extra:
        by = "rules"
        extra = [0] + [i for i in sorted(rest) if _CARRIER.search(ss[i])][:1]
    return _result(card, lang, must + [i for i in extra if i in rest or i == 0], by)


def answer(store: CardStore, question: str, lang: str, llm=None, card_hint: str | None = None) -> dict:
    """Answers only with sentences copied word for word from reviewed cards, or the neutral refusal.

    The AI (when on) only routes the question to a card and picks sentence numbers; every
    number it returns is checked, and nothing it writes is ever shown.
    """
    named = store.find(question)
    card = store.cards.get(card_hint or "") or named
    if card is not None and named is None and store.basics and _GENERAL.search(question):
        card = store.basics  # a general inheritance question asked from a condition's page
    by = "rules"
    if card is None and llm is not None:
        try:
            titles = store.titles(lang)
            code = llm.chat_json(PICK_SYS, "\n".join(f"{k}: {v}" for k, v in titles.items())
                                 + f"\n\nQuestion: {question}").get("card")
            card = store.cards.get(code) or (store.basics if code == "basics" else None)
            by = "ai" if card else by
        except LLM_ERRORS:
            card = None
    if card is None and store.basics and _BASICS.search(question):
        card = store.basics
    if DECISION.search(question):
        if card is None:
            return {"text": REFUSAL[lang], "sentences": [], "reworded": False, "card": None, "selected_by": "rules"}
        ss = sentences(card.text[lang])
        keep = [i for i, s in enumerate(ss) if not _is_source(s) and _KEEP.search(s)]
        return _result(card, lang, keep, "rules", prefix=REFUSAL[lang])
    if card is None:
        return {"text": REFUSAL[lang], "sentences": [], "reworded": False, "card": None, "selected_by": by}
    ss = sentences(card.text[lang])
    skip = {i for i, s in enumerate(ss) if _is_source(s)}
    idx: list[int] = []
    if llm is not None:
        key = ("ask", card.code, lang, question.strip().lower(), llm.name)
        try:
            if key not in _cache:
                _cache[key] = _valid_ids(llm.chat_json(SELECT_SYS, _numbered(ss) + f"\n\nQuestion: {question}")
                                         .get("sentences"), len(ss), skip, 3)
            idx, by = _cache[key], "ai"
        except LLM_ERRORS:
            idx = []
    if not idx:
        qw = _words(question)
        scored = sorted(((len(qw & _words(s)), i) for i, s in enumerate(ss) if i not in skip), reverse=True)
        idx = [0] + [i for sc, i in scored[:2] if sc > 0 and i != 0][:1]  # definition first
        by = "rules" if by != "ai" else by
    return _result(card, lang, idx, by)


def draft_case_summary(tier: int, result: str | None, card: "Card | None", llm=None) -> str:
    """Counsellor-facing draft. The AI may write here because a counsellor must sign off, but the
    draft is still blocked if it has directive wording or a number not in its inputs."""
    template = (f"DRAFT for counsellor review. Tier {tier}. Result: {result or 'n/a'}. "
                + (f"Shared condition: {card.code}. " if card else "")
                + "Offer all options neutrally, including continuing without intervention.")
    if llm is None:
        return template
    facts = f"Tier {tier}. Result: {result or 'not given'}."
    if card:
        facts += f" Condition card: {card.text['en']}"
    try:
        out = llm.chat(
            "You draft a short preparation note for a genetic counsellor before a session. Use at most "
            "4 short bullet points. Use only the facts given. The couple is usually planning to marry and "
            "is not pregnant, so do not assume a pregnancy. Do not recommend any decision. Remind the "
            "counsellor to present all options neutrally, including continuing without intervention, "
            "and to check understanding.", facts)
    except LLM_ERRORS:
        return template
    allowed = numbers(facts)
    if has_directive(out.replace("Do not recommend", "")) or not numbers(out) <= allowed:
        return template
    return f"DRAFT prepared by AI ({llm.name}) for counsellor review. Check before use.\n{out}"


@dataclass
class TeachBack:
    """Answers stored without identity: card, question, correct, language, literacy band, stage,
    a random per-quiz attempt id (not linked to any person or device) and the data source."""
    rows: list[tuple] = field(default_factory=list)

    def record(self, card: str, q: int, correct: bool, lang: str, literacy: str, stage: str,
               attempt: str = "", source: str = "live") -> None:
        self.rows.append((card, q, correct, lang, literacy, stage, attempt or f"row{len(self.rows)}", source))

    def score(self, stage: str, min_group: int = 5) -> dict:
        groups: dict[tuple, list[bool]] = {}
        for _, _, ok, lang, lit, st, *_ in self.rows:
            if st == stage:
                groups.setdefault((lang, lit), []).append(ok)
        return {k: sum(v) / len(v) for k, v in groups.items() if len(v) >= min_group}

    def report(self, source: str = "live", min_group: int = 5) -> dict:
        """Share of correct answers before (lab letter) and after (AMANA card), by language and by
        literacy band, for one data source (never mixed). A group with fewer than `min_group`
        people is hidden, not shown as a number."""
        rows = [r for r in self.rows if r[7] == source]

        def by(col: int) -> tuple[dict, int]:
            g: dict[str, dict[str, list]] = {}
            for r in rows:
                cell = g.setdefault(r[col], {}).setdefault(r[5], [[], set()])
                cell[0].append(r[2])
                cell[1].add(r[6])
            out, hidden = {}, 0
            for key, stages in sorted(g.items()):
                row = {}
                for st in ("before", "after"):
                    ok, people = stages.get(st, [[], set()])
                    if not people:
                        row[st] = {"n": 0, "rate": None}
                    elif len(people) < min_group:
                        row[st] = {"n": None, "rate": None, "hidden": True}
                        hidden += 1
                    else:
                        row[st] = {"n": len(people), "rate": round(sum(ok) / len(ok), 3)}
                out[key] = row
            return out, hidden

        lang, h1 = by(3)
        lit, h2 = by(4)
        return {"by_language": lang, "by_literacy": lit, "hidden_cells": h1 + h2,
                "people": len({r[6] for r in rows}), "answers": len(rows),
                "source": source, "min_group": min_group}

