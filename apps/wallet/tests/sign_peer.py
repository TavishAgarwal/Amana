"""Python side of the signing interop test. Stateless: reads and writes files in a temp dir."""
import json
import sys
from pathlib import Path

from consent_ledger.core import Ledger
from lab_issuer.core import LabIssuer
from schemas import signing
from schemas.models import SignedPermission
from token_service.core import new_service

cmd, d = sys.argv[1], Path(sys.argv[2])
if cmd == "issue":  # national token service issues for a device key made by the JS side
    holder_pk = (d / "holder_pk.txt").read_text().strip()
    svc, lab = new_service(), LabIssuer("lab-a")
    svc.register_lab(lab.lab_id, lab.public_key, lab.api_key)
    cred = lab.issue("synthetic-x", ["HBB", "PAH"])
    ts = svc.issue(lab.lab_id, lab.api_key, cred, ["HBB", "PAH"], holder_pk)
    (d / "issued.json").write_text(json.dumps({
        "national_pk": svc.public_key.hex(), "lab_pk": lab.public_key.hex(),
        "credential": cred.model_dump(), "token_set": ts.model_dump()}))
elif cmd == "verify":  # the ledger accepts a permission signed in the browser code
    sp = SignedPermission.model_validate_json((d / "permission.json").read_text())
    Ledger().grant(sp)  # raises Denied on a bad signature
    req = json.loads((d / "request.json").read_text())
    ok = signing.verify(bytes.fromhex(req["holder_pk"]), {"op": req["op"], "ts": req["ts"]}, req["sig"])
    sys.exit(0 if ok else 3)
