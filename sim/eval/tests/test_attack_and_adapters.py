from lab_issuer.core import LabIssuer
from records_exchange import RecordsExchange

from sim.eval import attack_demo


def test_attack_rejected_with_reasons_and_plain_matching_leaks():
    r = attack_demo.run()
    assert r["attempts"] == [("token_service_all_genes", "rejected:gene_not_in_credential"),
                             ("forged_all_genes_set", "rejected:forged_token_set")]
    assert r["plain_hash_matching_leaks"] == ["HBB", "PAH"] and r["amana_leaks"] == []


def test_records_exchange_returns_valid_fhir_bundle():
    b = RecordsExchange(LabIssuer("lab-x")).fetch_bundle("synthetic-mariam", ["HBB"])
    assert b["resourceType"] == "Bundle" and b["signature"]["data"]
