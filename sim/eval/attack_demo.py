"""'Claim all 570 genes' attack, side by side with plain matching that leaks."""
import hashlib

from generator import load_panel
from schemas.models import SignedCredential
from token_service.core import Refused

from sim.eval.protocol import CheckError, Relay, run_check
from sim.eval.world import World


class _P:
    def __init__(self, i, g):
        self.id, self.carrier_genes = i, g


def run() -> dict:
    genes = load_panel("packs/abu-dhabi/panel.csv")
    w = World()
    victim = w.wallet("victim", _P("victim", ["HBB", "PAH"]))
    attacker = w.wallet("attacker", _P("attacker", []), 1)
    lab = w.labs[1]
    out = {"attempts": []}

    # 1. Ask the token service for all 570 tokens on a credential that holds none of them.
    cred: SignedCredential = lab.issue("attacker", [])
    try:
        w.svc.issue(lab.lab_id, lab.api_key, cred, genes, attacker.pk.hex(), now=w.now)
        out["attempts"].append(("token_service_all_genes", "ACCEPTED"))
    except Refused as e:
        out["attempts"].append(("token_service_all_genes", f"rejected:{e.reason}"))

    # 2. Self-made token set covering every gene, signed with the attacker's own key.
    attacker.token_set = w.forged(attacker, genes)
    try:
        run_check(victim, attacker, Relay(), w.period)
        out["attempts"].append(("forged_all_genes_set", "ACCEPTED"))
    except CheckError as e:
        out["attempts"].append(("forged_all_genes_set", f"rejected:{e}"))

    # Side by side: plain private-looking matching (SHA-256 of gene names) leaks everything.
    victim_hashes = {hashlib.sha256(g.encode()).hexdigest() for g in ["HBB", "PAH"]}
    guessed = [g for g in genes if hashlib.sha256(g.encode()).hexdigest() in victim_hashes]
    out["plain_hash_matching_leaks"] = sorted(guessed)
    out["amana_leaks"] = []
    return out


if __name__ == "__main__":
    r = run()
    for name, res in r["attempts"]:
        print(f"{name:28s} {res}")
    print("plain hash matching reveals:", r["plain_hash_matching_leaks"])
    print("AMANA reveals:", r["amana_leaks"] or "nothing")
