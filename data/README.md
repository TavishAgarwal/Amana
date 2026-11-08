# data/

`raw/` holds public ClinVar downloads (git-ignored, ~630 MB). Re-download:

- https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/gene_specific_summary.txt
- https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz
- https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz

Then run `python3 data/build_panel.py` from the repo root to rebuild `packs/abu-dhabi/panel-clinvar.csv`.
