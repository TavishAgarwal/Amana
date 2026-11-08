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
