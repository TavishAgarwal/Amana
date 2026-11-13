"""Writes docs/review/cards-review.csv: one row per card sentence, both languages, for clinical and
Arabic review. Re-run after any card edit:  python3 -I scripts/review_sheet.py"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLIT = re.compile(r"(?<=[.؟?!])\s+")


def cards():
    for d in sorted((ROOT / "content/cards").iterdir()):
        if d.is_dir():
            yield d.name, d
    yield "carrier-basics", ROOT / "content/basics"


def main() -> None:
    out = ROOT / "docs/review/cards-review.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    rows = 0
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["card", "lang", "n", "sentence", "clinically_correct (Y/N)", "plain_and_non_directive (Y/N)",
                    "arabic_matches_english (Y/N, ar only)", "suggested_change", "reviewer_initials"])
        for code, d in cards():
            for lang in ("en", "ar"):
                text = (d / f"{lang}.md").read_text(encoding="utf-8").strip()
                for i, s in enumerate(x for x in SPLIT.split(text) if x):
                    w.writerow([code, lang, i + 1, s, "", "", "" if lang == "ar" else "n/a", "", ""])
                    rows += 1
    print(f"{rows} sentences -> {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
