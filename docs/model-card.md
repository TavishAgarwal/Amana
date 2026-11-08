# AMANA: Model card (explainer)

- **What it does:** shows reviewed condition cards in Arabic or English; may reword a card to a simpler level.
- **Current state:** rewording is **off**. No Azure OpenAI deployment was configured, so cards are shown verbatim (fallback R2). The rewriter interface and fact-checker are built and tested with adversarial rewriters.
- **Fact-checker:** rejects any new number, directive wording, or a sentence with more than 10% words outside the card; on rejection the original card is shown.
- **It may not:** state facts not on a card, give advice, say whom to marry, or label anything clinical advice (needs counsellor sign-off).
- **Red-team:** 100 prompts (Arabic, English, mixed) in `redteam/prompts/`; 0 directive and 0 unsupported outputs in the automated check. **Two human reviewers have not yet reviewed the outputs.**
- **Cards:** all 15 are `pending clinical review`; Arabic is a draft pending native-speaker review.
