"""Fetch per-gene allele counts by population from the public gnomAD v4 GraphQL API (GRCh38).

One request per panel gene, one second apart. Output: data/raw/gnomad/<GENE>.json (git-ignored), trimmed to
variant_id and allele counts per population. Safe to re-run: genes already fetched are skipped.
"""
import csv
import json
import ssl
import sys
import time
import urllib.request

import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
from pathlib import Path

API = "https://gnomad.broadinstitute.org/api"
Q = """query($g:String!){ gene(gene_symbol:$g, reference_genome:GRCh38){ variants(dataset:gnomad_r4){
  variant_id exome{ac an populations{id ac an}} genome{ac an populations{id ac an}} } } }"""
out = Path("data/raw/gnomad"); out.mkdir(parents=True, exist_ok=True)
with open("packs/abu-dhabi/panel-clinvar.csv") as _f:
    genes = [r["gene"] for r in csv.DictReader(ln for ln in _f if not ln.startswith("#"))]
for g in genes:
    f = out / f"{g}.json"
    if f.exists():
        continue
    body = json.dumps({"query": Q, "variables": {"g": g}}).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(API, body, {"content-type": "application/json", "user-agent": "amana-research/0.1"})
            data = json.load(urllib.request.urlopen(req, timeout=120, context=CTX))
            gene = (data.get("data") or {}).get("gene")
            f.write_text(json.dumps({"gene": g, "variants": gene["variants"] if gene else None}))
            print(g, len(gene["variants"]) if gene else "not-found", flush=True)
            break
        except Exception as e:  # noqa: BLE001
            print(g, "retry", attempt, e, file=sys.stderr, flush=True)
            time.sleep(5 * (attempt + 1))
    time.sleep(1)
