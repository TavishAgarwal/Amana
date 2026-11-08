"""Reference implementation of the wallet side of the private check, plus an in-process relay.

The relay here mirrors services/relay (sessions, 5-minute expiry, no storage, scrubbed logs).
Private check = OpenMined PSI 2.0.6; step 1 count-only, step 2 intersection after both consent.
"""
import os
import secrets
from dataclasses import dataclass, field

import private_set_intersection.python as psi
from private_set_intersection.python import DataStructure
from schemas import signing
from schemas.logscrub import scrub
from schemas.models import SignedTokenSet

PAD_TO = 128  # fixed set size so set sizes leak nothing
FPR = 1e-9
SESSION_TTL = 300


class CheckError(Exception):
    pass


@dataclass
class Relay:
    now: float = 0.0
    sessions: dict = field(default_factory=dict)
    log: list[str] = field(default_factory=list)

    def _log(self, msg: str) -> None:
        self.log.append(scrub(msg))  # event types and session ids only

    def create(self, now: float | None = None) -> str:
        sid = secrets.token_urlsafe(16)
        self.sessions[sid] = {"created": self.now if now is None else now, "q": {}, "used": False}
        self._log(f"session_created {sid[:4]}")
        return sid

    def join(self, sid: str, now: float | None = None) -> None:
        s = self.sessions.get(sid)
        t = self.now if now is None else now
        if not s or s["used"] or t - s["created"] > SESSION_TTL:
            self._log("join_refused")
            raise CheckError("session_invalid_or_expired")
        s["used"] = True

    def send(self, sid: str, to: str, kind: str, payload) -> None:
        self.sessions[sid]["q"].setdefault(to, []).append((kind, payload))
        self._log(f"msg {kind}")

    def recv(self, sid: str, me: str):
        return self.sessions[sid]["q"].get(me, []).pop(0)

    def close(self, sid: str) -> None:
        self.sessions.pop(sid, None)  # nothing retained
        self._log("session_closed")


@dataclass
class Wallet:
    name: str
    national_pk: bytes
    sk: bytes = b""
    pk: bytes = b""
    token_set: SignedTokenSet | None = None
    token_to_gene: dict[str, str] = field(default_factory=dict)
    consent_reveal: bool = False

    def __post_init__(self):
        self.sk, self.pk = signing.generate_keypair()

    def load(self, ts: SignedTokenSet, genes_by_token: dict[str, str]):
        self.token_set, self.token_to_gene = ts, genes_by_token

    def hello(self, sid: str) -> dict:
        return {"set": self.token_set.model_dump(), "proof": signing.sign(self.sk, {"sid": sid})}

    def verify_partner(self, hello: dict, sid: str, period: int) -> list[str]:
        ts = SignedTokenSet.model_validate(hello["set"])
        if not signing.verify(self.national_pk, ts.token_set.model_dump(), ts.signature):
            raise CheckError("forged_token_set")
        if ts.token_set.period != period:
            raise CheckError("expired_token_set")
        if not signing.verify(bytes.fromhex(ts.token_set.holder_pk), {"sid": sid}, hello["proof"]):
            raise CheckError("replayed_token_set")
        return ts.token_set.tokens

    def padded(self, tokens: list[str]) -> list[str]:
        if len(tokens) > PAD_TO:
            raise CheckError("too_many_tokens")
        return tokens + [os.urandom(16).hex() for _ in range(PAD_TO - len(tokens))]


def run_check(a: Wallet, b: Wallet, relay: Relay, period: int, reveal: bool = False) -> dict:
    """A = PSI client, B = PSI server. Step 1 returns only yes/no; step 2 needs both consents."""
    if reveal and not (a.consent_reveal and b.consent_reveal):
        raise CheckError("reveal_needs_both_consents")
    sid = relay.create()
    relay.join(sid)
    relay.send(sid, "b", "hello", a.hello(sid))
    relay.send(sid, "a", "hello", b.hello(sid))
    b_tokens_claimed = a.verify_partner(relay.recv(sid, "a")[1], sid, period)
    b.verify_partner(relay.recv(sid, "b")[1], sid, period)
    del b_tokens_claimed  # verified, but never used for matching: PSI does the matching

    server = psi.server.CreateWithNewKey(reveal)
    client = psi.client.CreateWithNewKey(reveal)
    a_items = a.padded(a.token_set.token_set.tokens)
    setup = server.CreateSetupMessage(FPR, PAD_TO, b.padded(b.token_set.token_set.tokens),
                                      DataStructure.GCS)
    relay.send(sid, "a", "setup", setup.SerializeToString())
    req = client.CreateRequest(a_items)
    relay.send(sid, "b", "request", req.SerializeToString())
    resp = server.ProcessRequest(req)
    relay.send(sid, "a", "response", resp.SerializeToString())
    if reveal:
        idx = client.GetIntersection(setup, resp)
        shared = sorted(a.token_to_gene[a_items[i]] for i in idx if a_items[i] in a.token_to_gene)
        result = {"shared_risk": bool(shared), "genes": shared}
    else:
        n = client.GetIntersectionSize(setup, resp)
        result = {"shared_risk": n > 0}
    relay.send(sid, "b", "result", result["shared_risk"])
    relay.close(sid)
    return result
