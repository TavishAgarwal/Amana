"""Demo API behind the wallet and console. Synthetic personas only; in-memory; restart resets it.

What it plays:
- mock national-ID sign-in (services/adapters/mock-signin),
- two accredited labs and the national token service (results delivered once, to a device key),
- the consent ledger and counsellor desk.
What it does NOT do: hold wallets, run the private check, or serve anyone's genes after delivery.
The private check runs between the two phones over services/relay (apps/wallet/lib/check.ts).
Every consent, revoke and log read must be signed by the holder's device key.
"""
import json
import time
from pathlib import Path

import mock_signin
from consent_ledger.cases import CaseDesk, load_pack
from consent_ledger.core import Denied, Ledger
from explainer.core import CardStore, TeachBack, answer, explain
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas import signing
from schemas.models import SignedPermission

from sim.eval import attack_demo
from sim.eval.world import World

# The labs' synthetic database: who carries what. Only ever sent to that person's own device.
LAB_RECORDS = {"mariam": ["HBB", "GJB2"], "khalid": ["HBB", "PAH"], "noura": ["PAH"], "omar": []}
COUNSELLOR = "c-001"
FRESH_SECONDS = 120


class Demo:
    def __init__(self):
        self.world = World(now=time.time())
        self.cards = CardStore("content/cards")
        self.gene_card = {c.gene: c.code for c in self.cards.cards.values()}
        self.ledger = Ledger()
        self.desk = CaseDesk(self.ledger, load_pack("packs/abu-dhabi/pack.yaml"))
        self.teach = TeachBack()
        self.enrolments = 0


D = Demo()
api = FastAPI(title="AMANA demo API")


def _pk(hex_key: str) -> bytes:
    try:
        b = bytes.fromhex(hex_key)
    except ValueError as e:
        raise HTTPException(400, "bad_key") from e
    if len(b) != 32:
        raise HTTPException(400, "bad_key")
    return b


class SignedReq(BaseModel):
    holder_pk: str
    ts: int
    sig: str


def _authed(s: SignedReq, op: str) -> None:
    """Proves the caller holds the device key: signature over {op, ts}, fresh within 2 minutes."""
    if abs(time.time() - s.ts) > FRESH_SECONDS:
        raise HTTPException(401, "stale_request")
    if not signing.verify(_pk(s.holder_pk), {"op": op, "ts": s.ts}, s.sig):
        raise HTTPException(401, "bad_signature")


@api.get("/api/personas")
def personas():
    return [{"id": k, "name": v} for k, v in mock_signin.PERSONAS.items()]


class SignIn(BaseModel):
    persona: str


@api.post("/api/signin")
def signin(s: SignIn):
    """Mock national-ID sign-in: authorize + token in one step. A real provider replaces this."""
    try:
        code = mock_signin.authorize(s.persona)["code"]
    except Exception as e:
        raise HTTPException(404, "unknown_persona") from e
    return mock_signin.token(code)


class Enrol(BaseModel):
    id_token: dict
    signature: str
    holder_pk: str


@api.post("/api/enroll")
def enroll(e: Enrol):
    """Deliver the person's lab-signed result and national tokens, bound to their device key."""
    if not signing.verify(mock_signin._pk, e.id_token, e.signature):
        raise HTTPException(401, "bad_id_token")
    if e.id_token.get("exp", 0) < time.time():
        raise HTTPException(401, "expired_id_token")
    persona = e.id_token["sub"].removeprefix("synthetic-")
    if persona not in LAB_RECORDS:
        raise HTTPException(404, "no_result")
    _pk(e.holder_pk)
    w = D.world
    lab = w.labs[list(LAB_RECORDS).index(persona) % len(w.labs)]  # personas tested at different labs
    genes = LAB_RECORDS[persona]
    cred = lab.issue(e.id_token["sub"], genes)
    ts = w.svc.issue(lab.lab_id, lab.api_key, cred, genes, e.holder_pk)
    period = ts.token_set.period
    D.enrolments += 1
    return {
        "name": e.id_token["name"],
        "credential": cred.model_dump(), "token_set": ts.model_dump(),
        "genes": [{"gene": g, "token": w.svc.token(g, period), "card": D.gene_card.get(g)} for g in genes],
        "lab_pk": lab.public_key.hex(), "national_pk": w.svc.public_key.hex(), "period": period,
    }


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


class ConsentIn(BaseModel):
    signed: SignedPermission
    couple_result: str | None = None
    question: bool = False


@api.post("/api/consent")
def consent(c: ConsentIn):
    """Record a permission signed by the holder's device key (check, reveal, share, invite)."""
    p = c.signed.permission
    _pk(p.holder_pk)
    if p.type == "share_counsellor" and p.grantee != COUNSELLOR:
        raise HTTPException(400, "unknown_counsellor")
    try:
        D.ledger.grant(c.signed)
    except Denied as e:
        raise HTTPException(403, str(e)) from e
    out = {"permission": p.id}
    if p.type == "share_counsellor":
        case = D.desk.open_case(p.holder_pk, COUNSELLOR, c.couple_result, True, c.question, time.time())
        out["case"] = case.id
    return out


@api.post("/api/sharing")
def sharing(s: SignedReq):
    _authed(s, "list")
    pk8 = s.holder_pk[:8]
    perms = [{"id": i, "grantee": sp.permission.grantee, "type": sp.permission.type,
              "revoked": i in D.ledger.revoked}
             for i, sp in D.ledger.permissions.items() if sp.permission.holder_pk == s.holder_pk]
    log = [{"ts": e["ts"], "action": e["action"], "who": e["actor"]} for e in D.ledger.store.all()
           if e["actor"] == pk8 or pk8 in e["detail"]]
    return {"permissions": perms, "audit": log, "chain_ok": D.ledger.verify_chain()}


class Revoke(BaseModel):
    holder_pk: str
    permission: str
    sig: str


@api.post("/api/revoke")
def revoke(r: Revoke):
    try:
        D.ledger.revoke(r.permission, r.holder_pk, r.sig)
    except Denied as e:
        raise HTTPException(403, str(e)) from e
    return {"ok": True}


@api.post("/api/withdraw")
def withdraw(s: SignedReq):
    _authed(s, "withdraw_all")
    return {"withdrawn": D.ledger.delete_all(s.holder_pk)}


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
