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
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import mock_signin
import yaml
from consent_ledger.cases import CaseDesk, load_pack
from consent_ledger.core import Denied, Ledger
from explainer.core import CardStore, TeachBack, answer, draft_case_summary, explain, key_points
from explainer.llm import LLM
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas import signing
from schemas.models import SignedPermission

from sim.eval import attack_demo
from sim.eval.study import synthetic_rows
from sim.eval.world import World

# The labs' synthetic database: who carries what, and the programme's couple result if the person
# has been through premarital screening. Only ever sent to that person's own device.
#   mariam + khalid: not yet screened as a couple; they use the private check (both carry HBB).
#   noura + omar:    programme says compatible; Noura is a PAH carrier and gets her own card.
#   layla + yousef:  programme says incompatible (both GJB2); routed to Tier 3.
LAB_RECORDS: dict[str, tuple[list[str], str | None]] = {
    "mariam": (["HBB", "GJB2"], None), "khalid": (["HBB", "PAH"], None),
    "noura": (["PAH"], "compatible"), "omar": ([], "compatible"),
    "layla": (["GJB2"], "incompatible"), "yousef": (["GJB2", "HBA1"], "incompatible"),
}
COUNSELLOR = "c-001"  # default console account
FRESH_SECONDS = 120
STUDY_CARD = "beta-thalassaemia"


class Demo:
    def __init__(self):
        self.world = World(now=time.time())
        self.cards = CardStore("content/cards")
        self.gene_card = {c.gene: c.code for c in self.cards.cards.values()}
        self.ledger = Ledger()
        self.desk = CaseDesk(self.ledger, load_pack("packs/abu-dhabi/pack.yaml"))
        self.teach = TeachBack()
        self.enrolments = 0
        self.llm = LLM.from_env()  # off unless AMANA_LLM_URL is set
        self.directory = yaml.safe_load(Path("packs/abu-dhabi/directory.yaml").read_text())
        self.counsellors = {c["id"]: c for c in self.directory["counsellors"]}
        self.booked: set[tuple[str, int]] = set()
        self.invites: dict[str, bool] = {}  # invite id -> accepted; no sender, no gene


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
    genes, couple_result = LAB_RECORDS[persona]
    cred = lab.issue(e.id_token["sub"], genes, couple_result)
    ts = w.svc.issue(lab.lab_id, lab.api_key, cred, genes, e.holder_pk)
    period = ts.token_set.period
    D.enrolments += 1
    return {
        "name": e.id_token["name"],
        "credential": cred.model_dump(), "token_set": ts.model_dump(),
        "genes": [{"gene": g, "token": w.svc.token(g, period), "card": D.gene_card.get(g)} for g in genes],
        "lab_pk": lab.public_key.hex(), "national_pk": w.svc.public_key.hex(), "period": period,
    }


def _card(code: str):
    c = D.cards.cards.get(code) or (D.cards.basics if code == "carrier-basics" else None)
    if not c:
        raise HTTPException(404, "no_card")
    return c


@api.get("/api/pack")
def pack():
    p = D.desk.pack
    rows = Path("packs/abu-dhabi") / p["panel"]
    return {"name": p["name"], "default_language": p["default_language"], "languages": p["languages"],
            "panel_size": len([x for x in rows.read_text().splitlines() if x.strip() and not x.startswith("#")]) - 1}


@api.get("/api/ai")
def ai():
    return {"enabled": D.llm is not None, "model": D.llm.name if D.llm else None,
            "role": "selects reviewed sentences; drafts counsellor notes for sign-off"}


@api.get("/api/card/{code}")
def card(code: str, lang: str = "en"):
    c = _card(code)
    return {**explain(c, lang), "teachback": c.teachback.get(lang, [])}


@api.get("/api/card/{code}/key")
def card_key(code: str, lang: str = "en"):
    """Key points for low reading comfort: reviewed sentences only (AI picks, never writes)."""
    return key_points(_card(code), lang, D.llm)


class TB(BaseModel):
    card: str
    q: int
    correct: bool
    lang: str
    literacy: str
    stage: str = "after"
    attempt: str = ""  # random id made fresh for each quiz; never a person or device id


@api.post("/api/teachback")
def teachback(t: TB):
    if t.stage not in ("before", "after") or t.literacy not in ("low", "mid", "high"):
        raise HTTPException(400, "bad_answer")
    D.teach.record(t.card, t.q, t.correct, "ar" if t.lang == "ar" else "en", t.literacy, t.stage,
                   t.attempt[:32])
    return {"ok": True}


@api.get("/api/study")
def study(lang: str = "en"):
    """Understanding study: 'before' = a typical lab letter, 'after' = the AMANA card. Same 3 questions."""
    lang = "ar" if lang == "ar" else "en"
    c = _card(STUDY_CARD)
    return {"letter": Path(f"content/study/letter-{lang}.md").read_text().strip(),
            "card": explain(c, lang), "questions": c.teachback.get(lang, [])}


@api.post("/api/study/synthetic")
def study_synthetic():
    """Fills the dashboard with SYNTHETIC answers to show the pipeline. Labelled; never mixed with live."""
    return {"added_people": synthetic_rows(D.teach), "source": "synthetic"}


def _slots(cid: str, now: float) -> list[int]:
    s = D.directory["slots"]
    tz = timezone(timedelta(hours=s["utc_offset_hours"]))
    day = datetime.fromtimestamp(now, tz).replace(minute=0, second=0, microsecond=0)
    out, d = [], 0
    while len(out) < s["days_ahead"] * len(s["hours"]):
        d += 1
        date = day + timedelta(days=d)
        if date.weekday() >= 5:  # UAE weekend: Saturday, Sunday
            continue
        out += [int(date.replace(hour=h).timestamp()) for h in s["hours"]]
    return [t for t in out if (cid, t) not in D.booked]


@api.get("/api/directory")
def directory(lang: str = "ar"):
    now = time.time()
    return {"counsellors": [{**c, "slots": _slots(c["id"], now)[:6]} for c in D.counsellors.values()
                            if lang in c["languages"]] or list(D.counsellors.values())}


class Ask(BaseModel):
    question: str
    lang: str = "en"
    card: str | None = None


@api.post("/api/ask")
def ask(a: Ask):
    lang = "ar" if a.lang == "ar" else "en"
    return answer(D.cards, a.question[:500], lang, D.llm, a.card)


class ConsentIn(BaseModel):
    signed: SignedPermission
    couple_result: str | None = None
    question: bool = False
    question_text: str | None = None
    condition_code: str | None = None  # shared only if the person ticked it
    source: str = "self"  # programme | private_check | self
    language: str = "ar"
    slot_at: int | None = None  # one-to-one booking


@api.post("/api/consent")
def consent(c: ConsentIn):
    """Record a permission signed by the holder's device key (check, reveal, share, invite)."""
    p = c.signed.permission
    _pk(p.holder_pk)
    now = time.time()
    if p.type == "share_counsellor":
        if p.grantee not in D.counsellors:
            raise HTTPException(400, "unknown_counsellor")
        if c.couple_result not in (None, "compatible", "incompatible") or c.source not in (
                "programme", "private_check", "self"):
            raise HTTPException(400, "bad_scope")
        if c.slot_at is not None and c.slot_at not in _slots(p.grantee, now):
            raise HTTPException(409, "slot_taken")
    if p.type == "family_invite" and p.grantee != "relative":
        raise HTTPException(400, "bad_invite")
    try:
        D.ledger.grant(c.signed)
    except Denied as e:
        raise HTTPException(403, str(e)) from e
    out = {"permission": p.id}
    if p.type == "family_invite":
        D.invites[p.id] = False
        out["invite"] = p.id
    if p.type == "share_counsellor":
        card = D.cards.cards.get(c.condition_code or "")
        if c.slot_at is not None:
            D.booked.add((p.grantee, c.slot_at))
        case = D.desk.open_case(p.holder_pk, p.grantee, c.couple_result, True,
                                c.question or bool(c.question_text), now,
                                card.code if card else None, (c.question_text or "")[:500] or None,
                                c.source, "ar" if c.language == "ar" else "en", c.slot_at)
        out["case"] = case.id
        if D.llm is not None:  # the case appears at once; the AI draft replaces the template when ready
            threading.Thread(target=_draft, args=(case.id, card), daemon=True).start()
    return out


def _draft(case_id: str, card) -> None:
    c = D.desk.cases[case_id]
    c.summary = draft_case_summary(c.tier, c.result, card, D.llm)


def _invite_live(iid: str) -> bool:
    sp = D.ledger.permissions.get(iid)
    return bool(sp and sp.permission.type == "family_invite" and iid not in D.ledger.revoked
                and sp.permission.expires_at > time.time())


@api.get("/api/invite/{iid}")
def invite(iid: str):
    """What a relative sees: no sender, no gene, no condition. Only whether the link still works."""
    return {"valid": _invite_live(iid)}


@api.post("/api/invite/{iid}/accept")
def invite_accept(iid: str):
    if not _invite_live(iid):
        raise HTTPException(404, "invite_not_valid")
    D.invites[iid] = True  # counted only in totals
    return {"ok": True}


@api.post("/api/my-cases")
def my_cases(s: SignedReq):
    """The person's own cases. The counsellor's note appears only after sign-off."""
    _authed(s, "my_cases")
    return [{"id": c.id, "tier": c.tier, "slot_at": c.slot_at, "counsellor": D.counsellors[c.counsellor]["name"],
             "signed_off": bool(c.signed_off_by), "label": c.label, "note": c.note if c.signed_off_by else None}
            for c in D.desk.for_holder(s.holder_pk)]


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


@api.get("/api/counsellors")
def counsellors():
    return list(D.counsellors.values())


@api.get("/api/cases")
def cases(counsellor: str = COUNSELLOR):
    """Queue rows: tier, timing, language, source and scope only. No names, genes or questions."""
    now = time.time()
    return [{"id": c.id, "tier": c.tier, "created_at": c.created_at, "due_at": c.due_at,
             "slot_at": c.slot_at, "language": c.language, "source": c.source, "scope": c.scope,
             "signed_off": bool(c.signed_off_by)}
            for i, c in D.desk.cases.items()
            if c.counsellor == counsellor and D.ledger.allowed(counsellor, "share_counsellor", D.desk.holders[i], now)]


@api.get("/api/case/{cid}/status")
def case_status(cid: str, counsellor: str = COUNSELLOR):
    """For the console to wait for the AI draft without reading (and logging) the case each time."""
    c = D.desk.cases.get(cid)
    if not c or not D.ledger.allowed(counsellor, "share_counsellor", D.desk.holders[cid], time.time()):
        raise HTTPException(404, "no_case")
    return {"ai_draft_ready": c.summary.startswith("DRAFT prepared by AI"), "signed_off": bool(c.signed_off_by)}


@api.get("/api/case/{cid}")
def case(cid: str, counsellor: str = COUNSELLOR):
    try:
        c = D.desk.view(cid, counsellor, time.time())
    except Denied as e:
        raise HTTPException(403, str(e)) from e
    except KeyError as e:
        raise HTTPException(404, "no_case") from e
    card = D.cards.cards.get(c.condition_code or "")  # desk.view above wrote this access to the audit log
    return {**c.model_dump(), "card": explain(card, c.language) if card else None,
            "ai_draft": D.llm is not None and c.summary.startswith("DRAFT prepared by AI")}


class SignOff(BaseModel):
    note: str | None = None
    reviewed: bool = True


@api.post("/api/case/{cid}/signoff")
def signoff(cid: str, body: SignOff | None = None, counsellor: str = COUNSELLOR):
    body = body or SignOff()
    if not body.reviewed:
        raise HTTPException(400, "review_required")
    try:
        D.desk.view(cid, counsellor, time.time())
        return D.desk.sign_off(cid, counsellor, (body.note or "")[:4000] or None).model_dump()
    except Denied as e:
        raise HTTPException(403, str(e)) from e
    except KeyError as e:
        raise HTTPException(404, "no_case") from e


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
    cs = list(D.desk.cases.values())
    return {**res,
            "understanding": {"live": D.teach.report("live"), "synthetic": D.teach.report("synthetic")},
            "invites": {"sent": len(D.invites), "accepted": sum(D.invites.values())},
            "cases_live": {"total": len(cs), "by_tier": {t: sum(c.tier == t for c in cs) for t in (1, 2, 3)},
                           "signed_off": sum(bool(c.signed_off_by) for c in cs)},
            "enrolments": D.enrolments,
            "cards": {"total": len(D.cards.cards), "reviewed": sum(
                c.status == "reviewed" for c in D.cards.cards.values())}}
