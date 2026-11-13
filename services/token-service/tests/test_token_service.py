import time

import pytest
from lab_issuer.core import LabIssuer, verify_credential
from token_service.core import PERIOD_SECONDS, Refused, new_service


@pytest.fixture
def world():
    svc = new_service()
    a, b = LabIssuer("lab-a"), LabIssuer("lab-b")
    for lab in (a, b):
        svc.register_lab(lab.lab_id, lab.public_key, lab.api_key)
    return svc, a, b


def test_same_gene_two_labs_same_token(world):
    svc, a, b = world
    ca, cb = a.issue("p1", ["HBB", "CFTR"]), b.issue("p2", ["HBB"])
    ta = svc.issue("lab-a", a.api_key, ca, ["HBB"], "pk1", now=1000)
    tb = svc.issue("lab-b", b.api_key, cb, ["HBB"], "pk2", now=1000)
    assert ta.token_set.tokens == tb.token_set.tokens


def test_unregistered_lab_refused(world):
    svc, _, _ = world
    rogue = LabIssuer("rogue")
    with pytest.raises(Refused, match="unregistered_lab"):
        svc.issue("rogue", rogue.api_key, rogue.issue("p", ["HBB"]), ["HBB"], "pk")


def test_gene_not_in_credential_refused(world):
    svc, a, _ = world
    with pytest.raises(Refused, match="gene_not_in_credential"):
        svc.issue("lab-a", a.api_key, a.issue("p", ["HBB"]), ["HBB", "CFTR"], "pk")


def test_tampered_credential_and_wrong_key(world):
    svc, a, _ = world
    c = a.issue("p", ["HBB"])
    assert verify_credential(a.public_key, c)
    c.credential.carrier_genes.append("CFTR")
    assert not verify_credential(a.public_key, c)
    with pytest.raises(Refused, match="bad_credential_signature"):
        svc.issue("lab-a", a.api_key, c, ["CFTR"], "pk")
    with pytest.raises(Refused, match="bad_api_key"):
        svc.issue("lab-a", "nope", a.issue("p", ["HBB"]), ["HBB"], "pk")


def test_one_changed_byte_fails():
    lab = LabIssuer("x")
    c = lab.issue("p", ["HBB"])
    c.signature = ("0" if c.signature[0] != "0" else "1") + c.signature[1:]
    assert not verify_credential(lab.public_key, c)


def test_tokens_change_each_period_and_old_rejected(world):
    svc, a, _ = world
    c = a.issue("p", ["HBB"])
    t1 = svc.issue("lab-a", a.api_key, c, ["HBB"], "pk", now=1000)
    t2 = svc.issue("lab-a", a.api_key, c, ["HBB"], "pk", now=1000 + PERIOD_SECONDS)
    assert t1.token_set.tokens != t2.token_set.tokens
    assert svc.verify_token_set(t1, now=1000)
    assert not svc.verify_token_set(t1, now=1000 + PERIOD_SECONDS)


def test_rate_limit(world):
    svc, a, _ = world
    svc.rate_per_minute = 3
    c = a.issue("p", ["HBB"])
    with pytest.raises(Refused, match="rate_limited"):
        for _ in range(10):
            svc.issue("lab-a", a.api_key, c, ["HBB"], "pk", now=5)


def test_issue_1000_under_30s_and_fhir(world):
    _, a, _ = world
    t = time.time()
    creds = [a.issue(f"p{i}", ["HBB", "CFTR"]) for i in range(1000)]
    assert time.time() - t < 30
    assert a.fhir_bundle(creds[0])["resourceType"] == "Bundle"


def test_copies_built_from_the_same_keys_issue_the_same_tokens(tmp_path):
    """Several workers or replicas, and a restart, must all issue matching tokens."""
    import hashlib
    import json

    from token_service.core import from_env

    lab = LabIssuer("lab-a")
    reg = tmp_path / "labs.json"
    reg.write_text(json.dumps([{"lab_id": "lab-a", "public_key": lab.public_key.hex(),
                                "api_key_sha256": hashlib.sha256(lab.api_key.encode()).hexdigest()}]))
    env = {"NATIONAL_TOKEN_KEY_FILE": str(tmp_path / "key.json"), "LAB_REGISTRY": str(reg)}
    one, two = from_env(env), from_env(env)  # the second reads the file the first created
    assert (tmp_path / "key.json").stat().st_mode & 0o777 == 0o600
    cred = lab.issue("p1", ["HBB"])
    a = one.issue("lab-a", lab.api_key, cred, ["HBB"], "pk", now=1000)
    b = two.issue("lab-a", lab.api_key, cred, ["HBB"], "pk", now=1000)
    assert a.token_set.tokens == b.token_set.tokens and one.public_key == two.public_key
    assert two.verify_token_set(a, now=1000)
    with pytest.raises(Refused, match="bad_api_key"):
        two.issue("lab-a", "wrong", cred, ["HBB"], "pk", now=1000)


def test_production_refuses_to_start_without_national_keys():
    from token_service.core import from_env

    with pytest.raises(RuntimeError, match="national keys missing"):
        from_env({"AMANA_ENV": "production"})
