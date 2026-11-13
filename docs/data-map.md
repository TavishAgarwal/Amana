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

**Current demo (since 9 Nov, matches the design):** the demo API plays the labs and the national token service. After mock sign-in it sends each person's result and tokens **once**, bound to that device's key; the phone keeps them encrypted. The API keeps no wallets and has no endpoint that returns anyone's genes. The private check runs between the phones over the relay, which forwards scrambled messages only. The synthetic "lab database" (`LAB_RECORDS` in `services/demo-api`) stays on the server, as a real lab's records would.

## What the server stores, and who can see it (demo API, in memory)
| Data | Holds | Never holds | Who can read it |
|---|---|---|---|
| Permissions + audit log | Holder's device public key, type, grantee, expiry, signature; hash-chained log | Genes | The holder (signed request); counsellors only through a live permission |
| Counsellor case | Tier, timing, language, source (programme / private check / self), the scope the person ticked: result type, condition card (only if ticked), question text, slot; counsellor's note | Name, other genes, the partner's result | The named counsellor while the permission is live (each read logged); the person sees the note after sign-off |
| Study answers | Card, question, correct or not, language, reading comfort, stage, random quiz id, source (live / synthetic) | Name, device id, IP | Dashboard aggregates only; groups under 5 hidden |
| Family invites | Random id, accepted yes/no | Sender's name, gene, condition (the sender's key sits on the ledger permission so they can revoke it) | Totals on the dashboard |
| AI calls | Card text and case tier/result/card for counsellor drafts; the question only on the server copy of the question path (`/api/ask`), which the wallet does not call | Names, ids, keys, tokens | Runs on the same machine (Ollama); in production inside the programme's Azure tenant |
| Questions typed in the wallet's Ask box | Nothing: they are answered on the phone from the card index and are never sent | Everything | No one but the person. The phone downloads only the card index and, if the person agrees, the 4.9 MB model; neither request carries the question |
