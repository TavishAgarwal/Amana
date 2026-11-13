# AMANA: Model card (explainer and counsellor copilot)

**Rule in one line:** for anything a person reads, the AI **selects** sentences from reviewed cards; it
never writes them. For counsellors, the AI may **draft** a note, which is gated and must be signed off.

There are two places a model runs:
1. **On the person's phone** (the wallet): answering questions and "Read in simpler words". Every phone
   gets answers; better phones can add a small model. Questions never leave the phone.
2. **On the server** (the programme's tenant): counsellor drafts, and the server copy of the question
   path, used for evaluation and by the console.

## 1. On the phone: answers for every phone
Questions about a result are private. They are answered on the phone, from an index of the reviewed
cards (`apps/wallet/public/ask/index.json`, about 40 KB), so nothing the person types is sent anywhere.
A large language model such as `llama3.1:8b` (about 4.7 GB at 4-bit, 6 GB or more of memory) would not
run on most phones, so the phone uses two levels instead:

| Level | Who gets it | Download | How it picks sentences |
|---|---|---|---|
| Rules | Every phone, including phones under 1 GB of memory and phones with no room to store a model | ~40 KB (the index) | Card names and keywords, word overlap, the same decision rule as the server |
| On-device model | Any phone with 1 GB of memory or more and 25 MB free, **after the person agrees** | 4.9 MB, once | Meaning: a static multilingual embedding model; no neural network runs on the phone |

- **Model:** `sentence-transformers/static-similarity-mrl-multilingual-v1` (Apache-2.0; licence and
  changes in `apps/wallet/public/ask/static-64/`). It is a lookup table of token vectors: a text's vector
  is the average of its tokens' vectors. We keep only tokens in Latin, Arabic or Greek script, cut each
  vector to its first 64 dimensions (the model was trained for this) and store them as 8-bit integers.
  Built with `scripts/build-ask-model.mjs`.
- **Tokenizer:** our own WordPiece in TypeScript (`apps/wallet/lib/ask/wordpiece.ts`). A test checks
  that it gives exactly the same tokens as the official tokenizer on English, Arabic and mixed text.
- **Scoring:** meaning similarity, plus a short hint for each card section ("what is it", "carrier",
  "both carriers", "options") and a small bonus for shared words. Weights were tuned on the relevance set
  (`apps/wallet/tests/ask-tune.mjs`) under hard limits: 0 directive, 0 unsupported, every benign
  question answered, every off-topic question refused.
- **Same guards as the server:** the decision rule and the fixed neutral reply, sentences shown word for
  word, "what it is" and "options" sections kept whole (options always come with "The decision is
  yours"). The rules come from `services/explainer` through `scripts/build_ask_index.py`; a Python test
  fails if the phone's index is out of date.
- **Download:** never without a yes. The offer states the size, says when the phone looks to be on
  mobile data or saving data, and gives "Download" and "Not now" equal weight. Files come from the app's
  own server, are checked against SHA-256 sums before use, are kept in the browser's Cache API, and can
  be removed in Settings (also removed by "Delete everything").

**Results** (`apps/wallet/tests/ask-eval.mjs`; held-out set not used for tuning the weights):

| Engine | Size | Relevance, main set (40) | Relevance, held-out (24) | Right card, held-out | Red-team (100) |
|---|---|---|---|---|---|
| Rules (every phone) | ~40 KB | 13/40 | 4/24 | 17/24 | 0 directive, 0 unsupported, 22/22 benign answered, 3/3 off-topic refused |
| On-device model (shipped) | 4.9 MB | 37/40 | 19/24 | 24/24 | same |
| multilingual-e5-small (compared, not shipped) | 135 MB | 39/40 | 19/24 | 24/24 | same |

"Relevance" means the expected sentence is in the answer. On a laptop (Node), the shipped model loads in
about 12 ms and answers in about 0.05 ms per question (first question about 5 ms while card sentences
are encoded). e5-small did no better on the held-out set at 28 times the download, so it is
not shipped. The held-out set was written before tuning but informed one round of rule fixes (siblings,
Arabic "only"), so a fresh set from real users' questions is needed before quoting these as final.

## 2. On the server: model and where it runs
| | Prototype | Production plan |
|---|---|---|
| Model | `llama3.1:8b` (Meta Llama 3.1, 8B, instruct), via Ollama | Azure OpenAI in UAE North (same client: `AMANA_LLM_AUTH=azure`) |
| Where | On the same laptop as the demo API; no data leaves the machine | Inside the programme's Azure tenant |
| Settings | temperature 0, JSON-only replies, 60 s timeout | same |
| Switch | Off unless `AMANA_LLM_URL` is set (e.g. `http://localhost:11434/v1`). With it off, fixed rules do the same jobs | same |

Client: `services/explainer/explainer/llm.py`. Logic and prompts: `services/explainer/explainer/core.py`.

## What the server AI does
The first three jobs are the server copy of what the phone does (`POST /api/ask`, `/api/card/{code}/key`).
The wallet no longer calls them; they are kept for the console, for evaluation with a larger model, and
for comparison.

| Job | Who sees it | What the model returns | Guard |
|---|---|---|---|
| Route a question to a card (`PICK_SYS`) | — | a card code from a fixed list | Unknown codes are ignored; falls back to keyword match |
| Answer a question (`SELECT_SYS`) | The person (server copy) | up to 3 **sentence numbers** from that card | Numbers outside the card are dropped. The shown text is the card's own sentences, word for word |
| "Read in simpler words" (`KEY_SYS`) | The person (server copy) | 2 sentence numbers | Sentences with a number, the decision or the options are **always** kept by rule, whatever the model says |
| Counsellor draft | Counsellor only | free text | Blocked if it contains directive wording or any number not in its inputs; then the template is used. Labelled "Draft prepared by AI. Check before use." Nothing is labelled clinical advice until a counsellor signs off |

**Decision questions never reach the model.** "Should we marry?", "Is it safe?", "Should we cancel the
engagement?" and their Arabic forms are caught by a rule (`DECISION` in `core.py`) and answered with a
fixed, non-directive reply plus the card's options sentence.

## Why selection instead of rewording
We first tried free rewording with a fact-checker (`fact_check`). In testing, the 8B model dropped
qualifiers such as "for **each** pregnancy" and "usually", which changes the meaning while passing a
word-level check. Selection cannot do that: every sentence shown was reviewed. The cost is that
answers are less tailored. The old rewording path remains in the code, off, for comparison.

## Evaluation (`sim/eval/results.json`, `redteam` row)
- 100 red-team prompts (Arabic, English, mixed; jailbreaks, decision pressure, false claims) run with the
  model on and with it off. Result with the model on: see `results.json` (0 directive and 0
  unsupported outputs in our last run; every benign question still received an answer).
- "Unsupported" means a shown sentence that is not on a reviewed card. With selection this is 0 by
  construction; the test checks the construction holds.
- Unit tests with a fake model that misbehaves (invents sentence numbers, writes advice, adds numbers):
  `services/explainer/tests/test_explainer.py`.

## Known limits
- **Two human reviewers have not yet reviewed the red-team outputs.** The automated check is not a substitute.
- All 15 cards are `pending clinical review`; Arabic is a draft pending native-speaker review. The AI
  can only be as right as the cards.
- Selection can pick a true but less relevant sentence (for example, the carrier sentence instead of the
  "only one parent" sentence from the basics card). The person can always ask a counsellor.
- The 8B model is slower on a laptop (about 0.5–3 s per answer). Answers are cached per question.
- On the phone, the rules level answers fewer questions in the person's own words (13 of 40 against 37
  of 40). It never gives a wrong kind of answer: when it is unsure it gives the definition or the fixed
  reply. Phones on rules still get every card in full and the counsellor routes.
- The on-device model still picks a less relevant sentence for some questions (for example "What does
  being a carrier mean?" gets the symptoms sentence). Not yet tested on real low-end phones; memory and
  timing figures are from a laptop browser and Node.
- Counsellor drafts can still be unhelpful or generic; they are drafts, and sign-off is required.
- Not evaluated for bias across dialects of Arabic.
