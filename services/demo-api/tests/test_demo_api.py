from demo_api.app import api
from fastapi.testclient import TestClient

c = TestClient(api)


def test_demo_script_end_to_end():
    assert c.get("/api/result/mariam").json()["verified"]
    card = c.get("/api/card/beta-thalassaemia?lang=ar").json()
    assert card["review_status"] == "pending clinical review" and len(card["teachback"]) == 3
    c.post("/api/pair", json={"a": "mariam", "b": "khalid"})
    assert c.post("/api/check", json={"a": "mariam", "b": "khalid"}).json() == {"shared_risk": True}
    assert "genes" not in c.post("/api/check", json={"a": "mariam", "b": "khalid"}).json()
    assert c.post("/api/reveal/consent", json={"persona": "mariam"}).json()["waiting_for"] == ["khalid"]
    r = c.post("/api/reveal/consent", json={"persona": "khalid"}).json()
    assert r["genes"] == [{"gene": "HBB", "card": "beta-thalassaemia"}]
    s = c.post("/api/share", json={"persona": "mariam"}).json()
    case = c.get(f"/api/case/{s['case']}").json()
    assert case["tier"] == 3
    assert c.post(f"/api/case/{s['case']}/label", json={"label": "clinical_advice"}).status_code == 403
    c.post(f"/api/case/{s['case']}/signoff")
    assert c.post(f"/api/case/{s['case']}/label", json={"label": "clinical_advice"}).status_code == 200
    log = c.get("/api/sharing/mariam").json()
    assert log["chain_ok"] and log["permissions"]
    c.post("/api/revoke", json={"persona": "mariam", "permission": s["permission"]})
    assert c.get(f"/api/case/{s['case']}").status_code == 403
    assert c.get("/api/attack").json()["attempts"][0][1].startswith("rejected")


def test_no_shared_risk_and_refusal():
    assert c.post("/api/check", json={"a": "noura", "b": "omar"}).json() == {"shared_risk": False}
    assert "cannot tell anyone" in c.post("/api/ask", json={"question": "who should I marry?"}).json()["text"]
