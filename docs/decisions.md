# AMANA: Decision log

Format: date, decision, reason, owner.

| Date | Decision | Reason | Owner |
|---|---|---|---|
| 2026-11-08 | Replan to phases.md (12 days); read-aloud and real FHIR server cut | Late start | Team |
| 2026-11-08 | Repo root is the project folder; layout follows architecture.md §7 | Rules §6 | C |
| 2026-11-08 | Azure for Students subscription (Owner) allows `uaenorth` via region policy. Azure OpenAI chat models in UAE North NOT confirmed (docs list UAE North only for fine-tuning). Rewording stays off; no paid Azure resources created, to save student credit | Cost + availability | A |
| 2026-11-08 | Gate 1: use helper-service fallback (Python PSI behind `services/demo-api`); browser `psi.js` untested | Fastest working UI; documented fallback R1 | B |
| 2026-11-08 | New folder `services/demo-api` (wallet helper + console API); apps use a tiny built-in i18n instead of next-intl and plain CSS instead of Tailwind | Fewer dependencies, faster build | C |

## 2026-11-08: Real gene panel from ClinVar
- Downloaded (NCBI ClinVar, public): `gene_specific_summary.txt` (3.3 MB), `clinvar.vcf.gz` (192 MB), `variant_summary.txt.gz` (437 MB) into `data/raw/` (release dated 31 Oct 2026). Not committed-worthy: re-download with the URLs in `data/README.md`.
- `data/build_panel.py` builds `packs/abu-dhabi/panel-clinvar.csv` (copied to `panel.csv`); the old synthetic panel is kept as `panel-synthetic.csv`. `demo-country-2` stays synthetic.
- Genes: hand-curated AR list filtered by ClinVar ≥5 P/LP alleles (111 kept; `MUT` dropped as an outdated symbol, `MMUT` is kept).
- `clinvar.vcf.gz` is downloaded but not used yet (variant-level matching is future work).
- Harness: `AMANA_PANEL` / `AMANA_RESULTS` env vars select panel and output file.

## 2026-11-09: Camera scan, app lock, cost model
- QR scan uses `jsqr` on camera frames in the browser; frames are never uploaded or stored.
- App lock: PIN stretched with PBKDF2 (310,000 iterations) into an AES-GCM key held only in memory; the cached result is stored encrypted in localStorage. This protects data at rest on the device from casual access; it is not a substitute for OS-level device encryption, and a 4-digit PIN is weak against an attacker who copies the storage.
- `psi.js` in the browser is still not used: installing it was declined, so the helper-service PSI stays (Gate 1 decision).
- Service worker is unregistered in dev mode so a leftover production worker cannot serve stale files.
- Cost per couple is an estimate with assumptions in `docs/cost-model.md`, not an Azure quote.

## 2026-11-09: Browser PSI and real frequencies
- `@openmined/psi.js` 2.0.6 added to the wallet (dev dependency; code in `lib/psi.ts`). Same version and parameters as the helper (FPR 1e-9, 128 padded items, GCS). Interop test: `apps/wallet/tests/psi-interop.test.mjs` with `psi_peer.py`. Installing it ran a post-install script that downloaded `protoc-gen-js` from GitHub.
- gnomAD v4 (GRCh38) per-gene allele counts fetched from the public GraphQL API for the 111 panel genes (276 MB in `data/raw/gnomad/`, git-ignored). `data/build_frequencies.py` joins them with ClinVar P/LP (at least one-star review, not conflicting) into `packs/abu-dhabi/frequencies.csv`.
- Variants above 2% pooled frequency are excluded (VPS13B c.9331-1G>T at 11%, a sequencing artefact; CFTR 5T at 2.9%, a variable-penetrance allele).
- The generator uses these as relative weights and still calibrates the absolute scale to the 4.8% target. The uncalibrated implied rate (3.98%) is reported in `results.json` as a cross-check.
- CTGA (cags.org.ae) was looked at but not used or scraped: it is bibliographic, has no frequencies, and no terms of use were found.

## 2026-11-09: Check moved onto the devices (review fixes 3–4)
- Found while moving the check: the old hello sent each wallet's full token set to the partner, who could then match tokens directly and skip the count-only step and both consents. **Fixed:** the hello now carries only a national attestation (period + device key, signed by the token service) and a signature over the session id.
- The check runs once in each direction; each phone computes its own yes/no (closes the "a client could lie" gap).
- Each phone answers at most one count and one reveal request per session.
- Results are delivered once to a device key after mock sign-in, stored encrypted in IndexedDB with a non-extractable AES-GCM key; the device key is non-extractable Ed25519 (WebCrypto).
- Demo API no longer holds wallets; `/api/result`, `/api/check`, `/api/pair`, `/api/reveal/consent`, `/api/share`, `/api/delete` removed. Consents, revokes and log reads must carry a device-key signature.
- Wallet API address is configurable (`AMANA_API`), and the relay address too (`NEXT_PUBLIC_RELAY_URL`, default `ws(s)://<host>:8080`).
- Each check now costs two PSI runs instead of one; evaluation re-run.
