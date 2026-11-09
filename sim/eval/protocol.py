"""Reference implementation of the wallet side of the private check, plus an in-process relay.

Same protocol as the browser wallet (apps/wallet/lib/check.ts):
- The hello carries a national attestation (period + device key) and a signature over the session id.
  It never carries tokens, so a partner cannot match tokens directly and skip the consent steps.
- The check runs in both directions: each wallet is PSI client once and computes its own result,
  so neither side has to trust the other's answer.
- Step 1 is count-only (shown as yes/no). Step 2 (intersection) is answered by a wallet only after
  it has consented, so each wallet protects its own set.
The relay mirrors services/relay (sessions, 5-minute expiry, no storage, scrubbed logs).
"""
import os
import secrets
from dataclasses import dataclass, field

import private_set_intersection.python as psi
from private_set_intersection.python import DataStructure
from schemas import signing
from schemas.logscrub import scrub
from schemas.models import SignedTokenSet, attestation

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

    @property
    def tokens(self) -> list[str]:
        return self.token_set.token_set.tokens

    def hello(self, sid: str) -> dict:
        ts = self.token_set.token_set
        return {"period": ts.period, "holder_pk": ts.holder_pk,
                "attestation": self.token_set.attestation_signature,
                "proof": signing.sign(self.sk, {"sid": sid})}

    def verify_partner(self, hello: dict, sid: str, period: int) -> str:
        """Returns the partner's device key. Tokens are never part of the hello."""
        att = attestation(hello["period"], hello["holder_pk"])
        if not signing.verify(self.national_pk, att, hello["attestation"]):
            raise CheckError("forged_token_set")
        if hello["period"] != period:
            raise CheckError("expired_token_set")
        if not signing.verify(bytes.fromhex(hello["holder_pk"]), {"sid": sid}, hello["proof"]):
            raise CheckError("replayed_token_set")
        return hello["holder_pk"]

    def padded(self, tokens: list[str]) -> list[str]:
        if len(tokens) > PAD_TO:
            raise CheckError("too_many_tokens")
        return tokens + [os.urandom(16).hex() for _ in range(PAD_TO - len(tokens))]


def _round(client_w: Wallet, server_w: Wallet, relay: Relay, sid: str, reveal: bool,
           to_client: str, to_server: str):
    """One PSI run: client_w learns the count (or, in reveal mode, its own shared tokens)."""
    if reveal and not server_w.consent_reveal:
        raise CheckError("reveal_needs_both_consents")  # the serving wallet protects its own set
    client = psi.client.CreateWithNewKey(reveal)
    items = client_w.padded(client_w.tokens)
    req = client.CreateRequest(items)
    relay.send(sid, to_server, "request", req.SerializeToString())
    server = psi.server.CreateWithNewKey(reveal)
    setup = server.CreateSetupMessage(FPR, PAD_TO, server_w.padded(server_w.tokens), DataStructure.GCS)
    resp = server.ProcessRequest(req)
    relay.send(sid, to_client, "setup", setup.SerializeToString())
    relay.send(sid, to_client, "response", resp.SerializeToString())
    if not reveal:
        return client.GetIntersectionSize(setup, resp)
    return sorted(client_w.token_to_gene[items[i]] for i in client.GetIntersection(setup, resp)
                  if items[i] in client_w.token_to_gene)


def run_check(a: Wallet, b: Wallet, relay: Relay, period: int, reveal: bool = False) -> dict:
    """Both wallets verify each other, then each runs PSI as client once and gets its own result."""
    if reveal and not (a.consent_reveal and b.consent_reveal):
        raise CheckError("reveal_needs_both_consents")
    sid = relay.create()
    relay.join(sid)
    relay.send(sid, "b", "hello", a.hello(sid))
    relay.send(sid, "a", "hello", b.hello(sid))
    a.verify_partner(relay.recv(sid, "a")[1], sid, period)
    b.verify_partner(relay.recv(sid, "b")[1], sid, period)
    a_view = _round(a, b, relay, sid, reveal, "a", "b")
    b_view = _round(b, a, relay, sid, reveal, "b", "a")
    relay.close(sid)
    if reveal:
        return {"shared_risk": bool(a_view), "genes": a_view,
                "b_shared_risk": bool(b_view), "b_genes": b_view}
    return {"shared_risk": a_view > 0, "b_shared_risk": b_view > 0}
