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


def _share(d: Device, grantee: str = COUNSELLOR, **scope) -> dict:
    r = c.post("/api/consent", json={"signed": d.permission("share_counsellor", grantee), **scope})
    assert r.status_code == 200, r.text
    return r.json()


def test_programme_result_is_lab_signed_and_routes_incompatible_to_tier_3():
    lay = Device("layla")
    cred = lay.pkg["credential"]["credential"]
    assert cred["couple_result"] == "incompatible"
    case = c.get(f"/api/case/{_share(lay, couple_result='incompatible', source='programme')['case']}").json()
    assert case["tier"] == 3 and case["source"] == "programme" and case["scope"] == ["result"]
    noura = Device("noura")
    assert noura.pkg["credential"]["credential"]["couple_result"] == "compatible"


def test_question_goes_to_tier_2_and_queue_rows_hide_it():
    n = Device("noura")
    cid = _share(n, couple_result="compatible", question_text="Can my sister be a carrier too?",
                 source="programme", language="en")["case"]
    row = next(r for r in c.get("/api/cases").json() if r["id"] == cid)
    assert row["tier"] == 2 and "question" in row["scope"] and "sister" not in str(row)
    full = c.get(f"/api/case/{cid}").json()
    assert full["question"].startswith("Can my sister") and full["card"] is None


def test_booking_a_slot_takes_it_and_a_second_booking_is_refused():
    k = Device("khalid")
    slot = c.get("/api/directory?lang=ar").json()["counsellors"][0]["slots"][0]
    cid = _share(k, couple_result="incompatible", source="private_check", slot_at=slot,
                 condition_code="beta-thalassaemia")["case"]
    case = c.get(f"/api/case/{cid}").json()
    assert case["slot_at"] == slot and case["card"]["gene"] == "HBB" and "one_to_one" in case["scope"]
    again = c.post("/api/consent", json={"signed": Device("mariam").permission("share_counsellor", COUNSELLOR),
                                         "slot_at": slot})
    assert again.status_code == 409
    assert slot not in c.get("/api/directory?lang=ar").json()["counsellors"][0]["slots"]


def test_other_counsellor_cannot_open_the_case_and_opening_is_logged():
    m = Device("mariam")
    cid = _share(m, couple_result="incompatible")["case"]
    assert c.get(f"/api/case/{cid}?counsellor=c-002").status_code == 403
    assert all(r["id"] != cid for r in c.get("/api/cases?counsellor=c-002").json())
    for _ in range(3):
        c.get("/api/cases")  # the queue poll must not flood the person's log
        c.get(f"/api/case/{cid}/status")
    c.get(f"/api/case/{cid}")
    log = c.post("/api/sharing", json=m.signed("list")).json()["audit"]
    assert [e["action"] for e in log if e["who"] == COUNSELLOR] == ["access_allowed"]


def test_person_sees_the_note_only_after_sign_off():
    o = Device("omar")
    cid = _share(o, couple_result="compatible", question_text="What does compatible mean?")["case"]
    mine = c.post("/api/my-cases", json=o.signed("my_cases")).json()
    assert mine[0]["id"] == cid and mine[0]["note"] is None and not mine[0]["signed_off"]
    assert c.post(f"/api/case/{cid}/signoff", json={"note": "Final note.", "reviewed": False}).status_code == 400
    c.post(f"/api/case/{cid}/signoff", json={"note": "Final note.", "reviewed": True})
    mine = c.post("/api/my-cases", json=o.signed("my_cases")).json()
    assert mine[0]["note"] == "Final note." and mine[0]["signed_off"]


def test_family_invite_shows_nothing_about_the_sender_and_can_be_revoked():
    m = Device("mariam")
    before = c.get("/api/dashboard").json()["invites"]
    inv = c.post("/api/consent", json={"signed": m.permission("family_invite", "relative")}).json()["invite"]
    page = c.get(f"/api/invite/{inv}").json()
    assert page == {"valid": True}
    assert c.post(f"/api/invite/{inv}/accept").status_code == 200
    after = c.get("/api/dashboard").json()["invites"]
    assert after["sent"] == before["sent"] + 1 and after["accepted"] == before["accepted"] + 1
    c.post("/api/revoke", json={"holder_pk": m.pk.hex(), "permission": inv,
                                "sig": signing.sign(m.sk, {"revoke": inv})})
    assert c.get(f"/api/invite/{inv}").json() == {"valid": False}


def test_study_hides_small_groups_and_keeps_synthetic_apart():
    s = c.get("/api/study?lang=ar").json()
    assert "HBB" in s["letter"] and len(s["questions"]) == 3 and s["card"]["sections"]
    for i in range(6):
        for stage, ok in (("before", i % 2 == 0), ("after", True)):
            c.post("/api/teachback", json={"card": "beta-thalassaemia", "q": 0, "correct": ok, "lang": "ar",
                                           "literacy": "low", "stage": stage, "attempt": f"t{i}"})
    c.post("/api/teachback", json={"card": "beta-thalassaemia", "q": 0, "correct": True, "lang": "en",
                                   "literacy": "high", "stage": "before", "attempt": "lonely"})
    live = c.get("/api/dashboard").json()["understanding"]["live"]
    assert live["by_language"]["ar"]["after"]["rate"] == 1.0
    assert live["by_language"]["en"]["before"].get("hidden") and live["hidden_cells"] >= 1
    c.post("/api/study/synthetic")
    u = c.get("/api/dashboard").json()["understanding"]
    assert u["synthetic"]["people"] >= 48 and u["live"]["people"] == live["people"]
