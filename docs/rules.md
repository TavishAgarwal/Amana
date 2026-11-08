# AMANA: Rules

> What to use and what to avoid while building AMANA. These rules apply to code, content, data, design and the pitch.
> If a rule blocks you, raise it at standup and record any exception in `docs/decisions.md`. Don't silently break it.
> **Related docs:** `PRD.md` · `architecture.md` · `phases.md` · `design.md`.

---

## 1. Non-negotiable rules (breaking one is a release blocker)

1. **No real genetic or health data.** Ever. Synthetic data only, every public source declared.
2. **No custom cryptography.** Use the listed libraries and standard primitives only.
3. **Genes never leave the device unscrambled.** The only exceptions are the lab and the national token service at issue time.
4. **No gene names or tokens in logs**, analytics, error reports or screenshots in the repo.
5. **The AI never states a medical fact** that is not on a reviewed card.
6. **AMANA never tells anyone whom or whether to marry.**
7. **Nothing is shared by default.** Every share needs an explicit, signed, revocable permission.
8. **Nothing is labelled clinical advice** without counsellor sign-off.
9. **Secrets never go in the repo.** Keys in Azure Key Vault; local values in an uncommitted `.env`.
10. **Cancelled marriages are never counted as success** in any metric, slide or sentence.

---

## 2. Tech: use and avoid

| Area | Use | Avoid | Why |
|---|---|---|---|
| Private check | OpenMined PSI 2.0.6 (`psi.js`, `openmined.psi`) | Writing your own set-intersection maths; plain hash comparison of gene names | Hashes of a few hundred gene names can be reversed by trying them all |
| Signatures | Ed25519 via WebCrypto (fallback `@noble/ed25519`) and PyNaCl | RSA with homemade padding; JWT `none` algorithm; unsigned credentials | Standard, hard to misuse |
| Keyed tokens | HMAC-SHA256 with the national key | Plain SHA-256 of gene names; per-lab token keys | Per-lab keys break cross-lab matching |
| Device storage | WebCrypto AES-GCM with a non-exportable key, IndexedDB | `localStorage` for anything sensitive; storing keys next to data | `localStorage` is readable by any script on the page |
| Randomness | `crypto.getRandomValues`, Python `secrets` | `Math.random`, Python `random` for anything security-related | Predictable |
| Web apps | Next.js + TypeScript (strict mode) + Tailwind | Plain JavaScript; a second frontend framework | One stack, typed |
| Styling for right-to-left | Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) | `left`/`right`, `ml-`/`mr-` | Breaks Arabic layout |
| Strings | `next-intl` message files (`ar.json`, `en.json`) | Hard-coded text in components; string concatenation for sentences | Arabic word order and gender differ |
| Backend | Python 3.12 + FastAPI + Pydantic | Untyped request handling; raw SQL built from strings | Validation and injection safety |
| Database access | Parameterised queries / ORM | String-built SQL | Injection |
| Relay | Node + `ws`, in-memory sessions | Writing sessions or messages to disk or a database | Relay must store nothing |
| AI | Azure OpenAI, rewording only, low temperature, fixed prompt | Free-form chat; letting the model answer medical questions directly; BiMediX2 or any non-commercial-licence model | Safety and licence |
| Dependencies | Well-maintained, permissive licences (MIT, Apache-2.0, BSD) | GPL/AGPL in shipped code without a decision; non-commercial licences; abandoned packages | IP stays with the team; commercial path |
| Versions | Pinned in lockfiles (`pnpm-lock.yaml`, `uv.lock`) | Floating `latest` | Reproducible builds |
| Hosting | Azure UAE North | Regions outside the UAE without a recorded reason | Data residency story |

---

## 3. Data rules

- **Use:** ClinVar, gnomAD v4 (Middle Eastern group), CTGA (cite, don't redistribute), our synthetic population.
- **Check before use:** the licence of the Greater Middle East Variome data. Don't use it until checked.
- **Avoid:** scraping sites with unclear terms; any real person's genome or results; real names, Emirates ID numbers or phone numbers in test data.
- **Raw downloads** go in `sim/data/` and are **not committed**.
- **Every source** goes in `docs/data-map.md` with link, licence and how we use it.
- **Analytics:** no identifiers. Report language and literacy bands only; hide any group under 5 people.
- **User test:** participants use persona cards, never their own genetic data. Signed consent form; answers stored without names.

---

## 4. Security rules

- **Use:** TLS everywhere; rate limits on the relay and token service; signature checks before any check runs; short-lived one-time QR sessions (5 minutes default).
- **Use:** least-privilege service identities in Azure; separate keys for staging and demo.
- **Use:** a log scrubber that removes gene names and token values; a CI test that scans logs for them.
- **Avoid:** debug endpoints in staging or demo; admin routes without sign-in; CORS set to `*` on services that hold data.
- **Avoid:** putting personal data in URLs or query strings.
- **Avoid:** turning off signature checks "just for the demo". The demo must run the real checks.
- **Review:** any change to crypto, tokens, permissions or the relay needs a second reviewer, with B or C as one of the two.

---

## 5. AI and content rules

- **Use:** reviewed condition cards as the only source of medical content.
- **Use:** the fact-checker on every reworded output; on any mismatch, show the original card.
- **Use:** a fixed system prompt kept in the repo and versioned; changes need red-team re-run.
- **Avoid:** directive words such as "you should", "must not marry", "safe" or "unsafe" about a couple.
- **Avoid:** blame or stigma about cousin marriage, carriers or women. "Carrier" never means "ill".
- **Avoid:** celebratory or alarming wording for results ("Great news!", "Warning!").
- **Avoid:** inventing statistics. Every number on a card has a source.
- **Always** offer the full range of options neutrally, including continuing without any intervention.
- **Cards** carry a review status: `reviewed` or `pending clinical review`. Pending cards are labelled in the UI.
- **Arabic content** is written or checked by a native speaker; gender-aware forms are used where Arabic needs them.

---

## 6. Code rules

- **Language:** TypeScript strict mode; Python with type hints, checked in CI.
- **Lint and format:** ESLint + Prettier; Ruff. CI fails on errors.
- **Structure:** follow the folder layout in `architecture.md` §7. New top-level folders need a decision log entry.
- **Shared shapes:** credential, token set, permission and case shapes live in `packages/schemas` only. Don't redefine them in apps.
- **Errors:** user-facing errors are friendly and translated; technical detail goes to logs (scrubbed).
- **No dead code or commented-out code** in `main`.
- **Feature flags:** stretch features sit behind flags, off by default.
- **Comments:** explain *why*, not *what*.

---

## 7. Git and teamwork rules

- `main` is always demo-able. Never push directly to `main`.
- One branch per feature, named by ID: `feat/I-F4-pairing`, `fix/I-F5-revoke`.
- Every pull request: linked feature ID, short description, test evidence, one reviewer.
- Commit messages: present tense, short, feature ID first (`I-F12: add period rotation`).
- Daily 15-minute standup. Blockers older than 1 day go to the whole team.
- Decisions go in `docs/decisions.md`: date, decision, reason, owner.
- After feature freeze (see `phases.md`): bug fixes, docs and pitch only.

---

## 8. Testing rules

- **Every feature** has its acceptance test from `PRD.md` §6, automated where possible.
- **Privacy tests are mandatory in CI:** forged token rejected, all-genes attack rejected, revoke blocks access, audit tamper detected, relay log scan clean.
- **Safety red-team** re-runs whenever cards, prompts or the model change.
- **End-to-end:** the demo script runs as an automated test against staging every night.
- **Devices:** test on one mid-range Android phone and one iPhone before each gate.
- **No skipped or disabled tests in `main`** without a decision log entry.

---

## 9. Design and accessibility rules

- **Use:** the tokens and components in `design.md`; WCAG 2.2 AA; 44 × 44 px minimum touch targets.
- **Use:** the same layout for "shared risk found" and "no shared risk found", so the screen itself doesn't judge.
- **Avoid:** red/green for results; colour as the only signal; tiny text; motion that can't be turned off.
- **Avoid:** showing results on a screen that others can glance at without the app lock passing first.

---

## 10. Performance budgets

| Item | Budget |
|---|---|
| Wallet first load on 4G, mid-range phone | under 3 s (measure, then report) |
| One private check end to end | under 3 s (measure, then report) |
| New case visible in console after consent | under 5 s |
| Wallet JavaScript bundle | keep under 300 KB compressed, excluding the private-check library |

---

## 11. Pitch and claims rules

- **Every number** in the deck has a source in `blaze/sources.md`. Re-check before use: Saudi 37.1%, the signed-input paper, the 1994–95 consanguinity figure.
- **Say what is mocked** (national ID, records exchange) and what is synthetic.
- **Don't claim** novelty for the cryptography itself. Claim the integration, the Arabic understanding results and the counselling design.
- **Don't name** real government apps or partners as partners unless they have agreed.
- **Mention** the patent check needed before any commercial pilot.

---

## 12. Definition of done

A feature is done when all of these are true:
- [ ] Its acceptance test in `PRD.md` §6 passes (automated where possible).
- [ ] Privacy tests in CI still pass.
- [ ] It works on staging, not only locally.
- [ ] Arabic and English both work, right-to-left checked.
- [ ] It meets the accessibility rules on its screens.
- [ ] Docs updated (`architecture.md` if structure changed; `limitations.md` if anything is mocked or cut).
- [ ] Reviewed and merged to `main`.
