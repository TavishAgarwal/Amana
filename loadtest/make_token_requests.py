"""Builds inputs for loadtest/token-load.mjs: a lab registry, a national key file and signed requests.

Everything is synthetic. Output goes to loadtest/.out/ (git-ignored). Each request is a real
credential signed by one of two labs, for 1-3 genes from the panel, bound to a fresh device key.
"""
import hashlib
import json
import random
import sys
from pathlib import Path

from lab_issuer.core import LabIssuer
from schemas import signing

N = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
out = Path("loadtest/.out")
out.mkdir(parents=True, exist_ok=True)
rows = [r for r in Path("packs/abu-dhabi/panel.csv").read_text().splitlines() if not r.startswith("#")]
genes = [r.split(",")[0] for r in rows[1:]]  # rows[0] is the header
labs = [LabIssuer("lab-a"), LabIssuer("lab-b")]
(out / "labs.json").write_text(json.dumps([
    {"lab_id": lab.lab_id, "public_key": lab.public_key.hex(),
     "api_key_sha256": hashlib.sha256(lab.api_key.encode()).hexdigest()} for lab in labs]))
rng = random.Random(7)
reqs = []
for i in range(N):
    lab = labs[i % 2]
    carried = sorted(rng.sample(genes, rng.randint(1, 3)))
    _, holder = signing.generate_keypair()
    cred = lab.issue(f"synthetic-{i}", carried)
    reqs.append({"lab_id": lab.lab_id, "api_key": lab.api_key, "credential": cred.model_dump(),
                 "genes": carried, "holder_pk": holder.hex()})
(out / "requests.json").write_text(json.dumps(reqs))
print(f"{N} requests, {len(genes)} panel genes -> {out}")
