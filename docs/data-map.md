# AMANA: Data map

Every data source the prototype uses, its licence, and where data flows. Updated 9 Nov 2026.

## Sources

| Source | Link | Licence | Use | Status |
|---|---|---|---|---|
| Synthetic population | `sim/generator` | ours | All test and evaluation people, families and couples | In use |
| Abu Dhabi gene panel | `packs/abu-dhabi/panel.csv` (same as `panel-clinvar.csv`), built by `data/build_panel.py` | ours, derived from ClinVar | 111 autosomal-recessive genes with at least 5 ClinVar pathogenic / likely-pathogenic alleles (ClinVar release 31 Oct 2026). Inheritance is a hand-curated list | **In use.** Needs clinical review. The real programme screens 570 genes; the official list was not available, so overlap is unknown |
| Gene frequencies | `packs/abu-dhabi/frequencies.csv`, built by `data/build_frequencies.py` | ours, derived from gnomAD and ClinVar | Relative carrier frequency per gene (gnomAD v4 Middle Eastern group, else pooled, × ClinVar P/LP variants), scaled to the 4.8% target | In use. Under-estimates by construction (see `limitations.md`) |
| Synthetic placeholder panel | `packs/abu-dhabi/panel-synthetic.csv`, `packs/demo-country-2/` | ours | Old placeholder panel; second country pack for the config-swap demo | Comparison and demo only |
| ClinVar (NCBI) | https://www.ncbi.nlm.nih.gov/clinvar/ (download URLs in `data/README.md`) | Public NCBI data | Panel genes and pathogenic variants | Downloaded 8 Nov to `data/raw/` (git-ignored, about 630 MB) |
| gnomAD v4 | https://gnomad.broadinstitute.org | Open access (confirm exact licence wording before submission) | Per-gene allele counts, Middle Eastern group | Fetched 9 Nov from the public API to `data/raw/gnomad/` (git-ignored, about 276 MB) |
| GeneReviews, MedlinePlus Genetics | cited on each card | Per site | General inheritance explanations (1 in 4 per pregnancy) | Cited, not redistributed |
| CTGA (Centre for Arab Genomic Studies) | https://cags.org.ae | No terms of use found | Not used: a variant catalogue with no carrier frequencies | Not used, not scraped |
| Greater Middle East Variome | — | Not checked | Not used | Licence not checked |

No real person's data, names, Emirates ID numbers or phone numbers appear anywhere in the repo.

## Data flows

**Designed (target architecture):** genes reach only the lab and the national token service at issue time. The phone holds the credential and tokens. The relay sees only scrambled private-check messages. Servers hold permissions and audit entries.

**Current demo (not yet the design):** `services/demo-api` holds every demo persona's keys, credential and genes in server memory. It runs both sides of the private check in one process. Any caller can read a persona's carrier genes from `/api/result/{persona}` without signing in. Moving this onto the phone is fix 3 in `blaze/project/REPORT.md`.
