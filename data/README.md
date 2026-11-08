# data/

`raw/` holds public ClinVar downloads (git-ignored, ~630 MB). Re-download:

- https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/gene_specific_summary.txt
- https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
- https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz

Then run `python3 data/build_panel.py` from the repo root to rebuild `packs/abu-dhabi/panel-clinvar.csv`.

## Frequencies (gnomAD x ClinVar)

```bash
uv run python data/fetch_gnomad.py        # ~276 MB from the public gnomAD v4 API, one request per gene, resumable
uv run python data/build_frequencies.py   # writes packs/abu-dhabi/frequencies.csv
```
