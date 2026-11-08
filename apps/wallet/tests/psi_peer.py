"""Python side of the browser-PSI interop test. Stateless: each call reads and writes files."""
import json
import sys
from pathlib import Path

import private_set_intersection.python as psi
from private_set_intersection.python import DataStructure

FPR, PAD_TO = 1e-9, 128  # same parameters as sim/eval/protocol.py
cmd, d = sys.argv[1], Path(sys.argv[2])
reveal = json.loads((d / "reveal.json").read_text())
if cmd == "server-respond":  # Python server: setup + response for a request made by the JS client
    server = psi.server.CreateWithNewKey(reveal)
    items = json.loads((d / "server_items.json").read_text())
    setup = server.CreateSetupMessage(FPR, PAD_TO, items, DataStructure.GCS)
    req = psi.Request()
    req.ParseFromString((d / "request.bin").read_bytes())
    resp = server.ProcessRequest(req)
    (d / "setup.bin").write_bytes(setup.SerializeToString())
    (d / "response.bin").write_bytes(resp.SerializeToString())
elif cmd == "client-request":  # Python client, step 1
    client = psi.client.CreateWithNewKey(reveal)
    items = json.loads((d / "client_items.json").read_text())
    (d / "request.bin").write_bytes(client.CreateRequest(items).SerializeToString())
    (d / "client_key.bin").write_bytes(client.GetPrivateKeyBytes())
elif cmd == "client-finish":  # Python client, step 2: reads the JS server's setup and response
    client = psi.client.CreateFromKey((d / "client_key.bin").read_bytes(), reveal)
    setup, resp = psi.ServerSetup(), psi.Response()
    setup.ParseFromString((d / "setup.bin").read_bytes())
    resp.ParseFromString((d / "response.bin").read_bytes())
    out = {"size": client.GetIntersectionSize(setup, resp)} if not reveal else {"idx": sorted(client.GetIntersection(setup, resp))}
    (d / "result.json").write_text(json.dumps(out))
