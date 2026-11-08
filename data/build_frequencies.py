"""Build packs/abu-dhabi/frequencies.csv: per-gene pathogenic allele frequency from gnomAD v4 x ClinVar.

For each panel gene: take ClinVar GRCh38 variants classified Pathogenic / Likely pathogenic with at least one-star
review (criteria provided, not conflicting), find the same variants in gnomAD v4, and sum their allele frequencies:
  q_mid     Middle Eastern group (the closest public stand-in for Arab populations; small sample)
  q_global  all gnomAD populations pooled
This UNDER-estimates true carrier frequency: it only counts variants that are both in ClinVar and seen in gnomAD,
and gnomAD under-represents Arab and consanguineous populations. Exome counts are used when present, else genome.

Filter: variants with a pooled allele frequency above MAX_AF (2%) are dropped as too common for a rare recessive
disease. This removes sequencing artefacts (e.g. VPS13B c.9331-1G>T, 11%) and variable-penetrance alleles
(e.g. CFTR 5T, 2.9%). Dropped variants are listed in data/raw/gnomad_excluded.txt.
"""
import csv
import gzip
import json
import statistics
from pathlib import Path

BAD_REVIEW = {"no assertion criteria provided", "no assertion provided", "no classification provided",
              "no classification for the single variant", "conflicting classifications of pathogenicity",
              "conflicting interpretations of pathogenicity"}
MAX_AF = 0.02
SIG = {"Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"}
with open("packs/abu-dhabi/panel-clinvar.csv") as _f:
    panel = list(csv.DictReader(ln for ln in _f if not ln.startswith("#")))
genes = {r["gene"] for r in panel}

clinvar: dict[str, set[str]] = {g: set() for g in genes}
with gzip.open("data/raw/variant_summary.txt.gz", "rt") as f:
    for r in csv.DictReader(f, delimiter="\t"):
        if r["Assembly"] != "GRCh38" or r["ClinicalSignificance"] not in SIG or r["ReviewStatus"].lower() in BAD_REVIEW:
            continue
        if r["ReferenceAlleleVCF"] in ("", "na") or r["AlternateAlleleVCF"] in ("", "na"):
            continue
        vid = f'{r["Chromosome"]}-{r["PositionVCF"]}-{r["ReferenceAlleleVCF"]}-{r["AlternateAlleleVCF"]}'
        for g in r["GeneSymbol"].split(";"):
            if g in clinvar:
                clinvar[g].add(vid)

rows, excluded = [], []
for p in panel:
    g = p["gene"]
    path = Path("data/raw/gnomad") / f"{g}.json"
    if not path.exists():
        continue
    data = json.loads(path.read_text())
    q_mid = q_all = 0.0
    n = 0
    mid_an = []
    for v in data["variants"] or []:
        if v["variant_id"] not in clinvar[g]:
            continue
        cs = v["exome"] or v["genome"]
        if not cs or not cs["an"]:
            continue
        if cs["ac"] / cs["an"] > MAX_AF:
            excluded.append(f"{g}\t{v['variant_id']}\t{cs['ac'] / cs['an']:.4f}")
            continue
        n += 1
        q_all += cs["ac"] / cs["an"]
        mid = next((x for x in cs["populations"] if x["id"] == "mid"), None)
        if mid and mid["an"]:
            q_mid += mid["ac"] / mid["an"]
            mid_an.append(mid["an"])
    rows.append({"gene": g, "condition_code": p["condition_code"], "q_mid": f"{q_mid:.6g}", "q_global": f"{q_all:.6g}",
                 "n_variants": n, "mid_median_an": int(statistics.median(mid_an)) if mid_an else 0})

with open("packs/abu-dhabi/frequencies.csv", "w", newline="") as f:
    f.write("# source: gnomAD v4 (GRCh38) x ClinVar pathogenic/likely pathogenic, see data/build_frequencies.py for limits\n")
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)
Path("data/raw/gnomad_excluded.txt").write_text("\n".join(excluded) + "\n")
print(f"excluded {len(excluded)} too-common variants;", end=" ")
print(f"{len(rows)} genes; with q_mid>0: {sum(float(r['q_mid']) > 0 for r in rows)}; with q_global>0: {sum(float(r['q_global']) > 0 for r in rows)}")
