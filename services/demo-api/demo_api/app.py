"""Helper service behind the wallet and console (Gate 1 fallback R1).

Holds each demo persona's wallet logic (keys, token sets, PSI) so the browser UI stays thin.
Synthetic personas only. In-memory state; restart resets the demo.
"""
import json
import time
import uuid
from pathlib import Path

from consent_ledger.cases import CaseDesk, load_pack
from consent_ledger.core import Denied, Ledger, new_permission_id
from explainer.core import CardStore, TeachBack, answer, explain
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas import signing
from schemas.models import Permission, SignedPermission

from sim.eval import attack_demo
from sim.eval.protocol import CheckError, Relay, run_check
from sim.eval.world import World

PERSONAS = {
    "mariam": ("Mariam", ["HBB", "GJB2"]), "khalid": ("Khalid", ["HBB", "PAH"]),
    "noura": ("Noura", ["PAH"]), "omar": ("Omar", []),
}
COUNSELLOR = "c-001"


class _P:
    def __init__(self, i, g):
        self.id, self.carrier_genes = i, g


class Demo:
    def __init__(self):
        self.world = World(now=time.time())
        self.cards = CardStore("content/cards")
        self.gene_card = {c.gene: c.code for c in self.cards.cards.values()}
        self.ledger = Ledger()
        self.desk = CaseDesk(self.ledger, load_pack("packs/abu-dhabi/pack.yaml"))
        self.teach = TeachBack()
        self.wallets = {k: self.world.wallet(k, _P(f"synthetic-{k}", g), i)
                        for i, (k, (_, g)) in enumerate(PERSONAS.items())}
        self.perms: dict[str, list[str]] = {k: [] for k in PERSONAS}
        self.last_check: dict | None = None
        self.consent: set[str] = set()


D = Demo()
api = FastAPI(title="AMANA demo API")


def _w(p: str):
    if p not in D.wallets:
        raise HTTPException(404, "unknown_persona")
    return D.wallets[p]


@api.get("/api/personas")
def personas():
    return [{"id": k, "name": n} for k, (n, _) in PERSONAS.items()]


@api.get("/api/result/{p}")
def result(p: str, lang: str = "en"):
    w = _w(p)
    genes = sorted(w.token_to_gene.values())
    return {"verified": True, "carrier_cards": [
        {"gene": g, "card": D.gene_card.get(g)} for g in genes]}


@api.get("/api/card/{code}")
def card(code: str, lang: str = "en"):
    c = D.cards.cards.get(code)
    if not c:
        raise HTTPException(404, "no_card")
    return {**explain(c, lang), "teachback": c.teachback[lang]}


class TB(BaseModel):
    card: str
    q: int
    correct: bool
    lang: str
    literacy: str
    stage: str = "after"


@api.post("/api/teachback")
def teachback(t: TB):
    D.teach.record(t.card, t.q, t.correct, t.lang, t.literacy, t.stage)
    return {"ok": True}


class Ask(BaseModel):
    question: str
    lang: str = "en"


@api.post("/api/ask")
def ask(a: Ask):
    return answer(D.cards, a.question, a.lang)


class Pair(BaseModel):
    a: str
    b: str


@api.post("/api/pair")
def pair(p: Pair):
    _w(p.a), _w(p.b)
    D.consent.clear()
    return {"qr": "amana://pair/" + uuid.uuid4().hex[:12], "expires_in": 300}


@api.post("/api/check")
def check(p: Pair):
    a, b = _w(p.a), _w(p.b)
    try:
        r = run_check(a, b, Relay(), D.world.period)
    except CheckError as e:
        raise HTTPException(400, str(e)) from e
    D.last_check = {"a": p.a, "b": p.b, **r}
    return {"shared_risk": r["shared_risk"]}  # step 1: yes/no only


class Consent(BaseModel):
    persona: str


@api.post("/api/reveal/consent")
def reveal_consent(c: Consent):
    if not D.last_check:
        raise HTTPException(400, "run_check_first")
    w = _w(c.persona)
    w.consent_reveal = True
    D.consent.add(c.persona)
    pair_ = {D.last_check["a"], D.last_check["b"]}
    if not pair_ <= D.consent:
        return {"waiting_for": sorted(pair_ - D.consent)}
    a, b = _w(D.last_check["a"]), _w(D.last_check["b"])
    r = run_check(a, b, Relay(), D.world.period, reveal=True)
    return {"genes": [{"gene": g, "card": D.gene_card.get(g)} for g in r["genes"]]}


class Share(BaseModel):
    persona: str
    couple_result: str = "incompatible"


@api.post("/api/share")
def share(s: Share):
    w = _w(s.persona)
    p = Permission(id=new_permission_id(), holder_pk=w.pk.hex(), type="share_counsellor",
                   grantee=COUNSELLOR, expires_at=int(time.time()) + 7 * 86400, nonce="n" * 8)
    D.ledger.grant(SignedPermission(permission=p, signature=signing.sign(w.sk, p.model_dump())))
    D.perms[s.persona].append(p.id)
    case = D.desk.open_case(w.pk.hex(), COUNSELLOR, s.couple_result, True, False, time.time())
    return {"permission": p.id, "case": case.id}


@api.get("/api/sharing/{p}")
def sharing(p: str):
    w = _w(p)
    pk8 = w.pk.hex()[:8]
    perms = [{"id": i, "grantee": D.ledger.permissions[i].permission.grantee,
              "type": D.ledger.permissions[i].permission.type, "revoked": i in D.ledger.revoked}
             for i in D.perms[p]]
    log = [{"ts": e["ts"], "action": e["action"], "who": e["actor"]} for e in D.ledger.store.all()
           if e["actor"] == pk8 or pk8 in e["detail"]]
    return {"permissions": perms, "audit": log, "chain_ok": D.ledger.verify_chain()}


class Revoke(BaseModel):
    persona: str
    permission: str


@api.post("/api/revoke")
def revoke(r: Revoke):
    w = _w(r.persona)
    D.ledger.revoke(r.permission, w.pk.hex(), signing.sign(w.sk, {"revoke": r.permission}))
    return {"ok": True}


@api.post("/api/delete/{p}")
def delete(p: str):
    return {"withdrawn": D.ledger.delete_all(_w(p).pk.hex())}


@api.get("/api/cases")
def cases():
    return [c.model_dump() for c in D.desk.cases.values()]  # ids and tiers only, no genes


@api.get("/api/case/{cid}")
def case(cid: str):
    try:
        return D.desk.view(cid, COUNSELLOR, time.time()).model_dump()
    except Denied as e:
        raise HTTPException(403, str(e)) from e
    except KeyError as e:
        raise HTTPException(404, "no_case") from e


@api.post("/api/case/{cid}/signoff")
def signoff(cid: str):
    return D.desk.sign_off(cid, COUNSELLOR).model_dump()


class Label(BaseModel):
    label: str


@api.post("/api/case/{cid}/label")
def label(cid: str, body: Label):
    try:
        return D.desk.set_label(cid, body.label).model_dump()
    except Denied as e:
        raise HTTPException(403, str(e)) from e


@api.get("/api/attack")
def attack():
    return attack_demo.run()


@api.get("/api/dashboard")
def dashboard():
    f = Path("sim/eval/results.json")
    res = json.loads(f.read_text()) if f.exists() else {}
    return {**res, "teachback_after": {f"{k[0]}/{k[1]}": v for k, v in D.teach.score("after").items()},
            "cards": {"total": len(D.cards.cards), "reviewed": sum(
                c.status == "reviewed" for c in D.cards.cards.values())}}
