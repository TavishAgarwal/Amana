import time
import uuid

from demo_api.app import COUNSELLOR, api
from fastapi.testclient import TestClient
from schemas import signing
from schemas.models import Permission, SignedTokenSet

from sim.eval.protocol import Relay, Wallet, run_check

c = TestClient(api)


class Device:
    """Stands in for a phone: its own key, and its result delivered once to that key."""

    def __init__(self, persona: str):
        self.sk, self.pk = signing.generate_keypair()
        tok = c.post("/api/signin", json={"persona": persona}).json()
        r = c.post("/api/enroll", json={**tok, "holder_pk": self.pk.hex()})
        assert r.status_code == 200, r.text
        self.pkg = r.json()

    def permission(self, ptype: str, grantee: str, sk: bytes | None = None) -> dict:
        p = Permission(id=uuid.uuid4().hex, holder_pk=self.pk.hex(), type=ptype, grantee=grantee,
                       expires_at=int(time.time()) + 3600, nonce=uuid.uuid4().hex[:12])
        return {"permission": p.model_dump(), "signature": signing.sign(sk or self.sk, p.model_dump())}

    def signed(self, op: str, ts: int | None = None) -> dict:
        ts = int(time.time()) if ts is None else ts
        return {"holder_pk": self.pk.hex(), "ts": ts, "sig": signing.sign(self.sk, {"op": op, "ts": ts})}

    def wallet(self) -> Wallet:
        w = Wallet("x", bytes.fromhex(self.pkg["national_pk"]))
        w.sk, w.pk = self.sk, self.pk
        w.load(SignedTokenSet.model_validate(self.pkg["token_set"]),
               {g["token"]: g["gene"] for g in self.pkg["genes"]})
        return w


def test_no_endpoint_serves_genes_or_runs_the_check():
    for path in ["/api/result/khalid", "/api/check", "/api/pair", "/api/reveal/consent", "/api/share"]:
        assert c.get(path).status_code in (404, 405) and c.post(path, json={}).status_code in (404, 405)


def test_enrolment_needs_a_valid_sign_in():
    tok = c.post("/api/signin", json={"persona": "khalid"}).json()
    tok["id_token"]["sub"] = "synthetic-mariam"  # tampered claims
    assert c.post("/api/enroll", json={**tok, "holder_pk": "00" * 32}).status_code == 401


def test_delivered_packages_run_the_private_check_between_devices():
    m, k = Device("mariam"), Device("khalid")
    assert m.pkg["credential"]["credential"]["lab_id"] != k.pkg["credential"]["credential"]["lab_id"]
    r = run_check(m.wallet(), k.wallet(), Relay(), m.pkg["period"])
    assert r["shared_risk"] and r["b_shared_risk"]
    n, o = Device("noura"), Device("omar")
    assert run_check(n.wallet(), o.wallet(), Relay(), n.pkg["period"]) == {
        "shared_risk": False, "b_shared_risk": False}


def test_consent_must_be_signed_by_the_holder():
    m, k = Device("mariam"), Device("khalid")
    forged = k.permission("reveal_condition", "partner", sk=m.sk)  # Mariam signs as Khalid
    assert c.post("/api/consent", json={"signed": forged}).status_code == 403
    assert c.post("/api/consent", json={"signed": k.permission("check_only", "partner")}).status_code == 200


def test_share_case_signoff_revoke_withdraw():
    m = Device("mariam")
    r = c.post("/api/consent", json={"signed": m.permission("share_counsellor", COUNSELLOR),
                                     "couple_result": "incompatible"}).json()
    case = c.get(f"/api/case/{r['case']}").json()
    assert case["tier"] == 3 and "HBB" not in str(case)
    assert c.post(f"/api/case/{r['case']}/label", json={"label": "clinical_advice"}).status_code == 403
    c.post(f"/api/case/{r['case']}/signoff")
    assert c.post(f"/api/case/{r['case']}/label", json={"label": "clinical_advice"}).status_code == 200
    s = c.post("/api/sharing", json=m.signed("list")).json()
    assert s["chain_ok"] and [p["id"] for p in s["permissions"]] == [r["permission"]]
    assert c.post("/api/sharing", json=m.signed("list", ts=int(time.time()) - 600)).status_code == 401
    other = Device("khalid")
    assert c.post("/api/sharing", json={**m.signed("list"), "holder_pk": other.pk.hex()}).status_code == 401
    bad = {"holder_pk": m.pk.hex(), "permission": r["permission"], "sig": signing.sign(other.sk, {"revoke": r["permission"]})}
    assert c.post("/api/revoke", json=bad).status_code == 403
    good = {**bad, "sig": signing.sign(m.sk, {"revoke": r["permission"]})}
    assert c.post("/api/revoke", json=good).status_code == 200
    assert c.get(f"/api/case/{r['case']}").status_code == 403
    assert c.post("/api/withdraw", json=m.signed("withdraw_all")).json()["withdrawn"] == 1


def test_attack_and_refusal():
    assert c.get("/api/attack").json()["attempts"][0][1].startswith("rejected")
    assert "cannot tell anyone" in c.post("/api/ask", json={"question": "who should I marry?"}).json()["text"]
