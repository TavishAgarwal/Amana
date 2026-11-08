"""National token service: one national key, per-period HMAC tokens, registered labs only."""
import hashlib
import hmac
import time
from dataclasses import dataclass, field

from schemas import signing
from schemas.models import SignedCredential, SignedTokenSet, TokenSet

PERIOD_SECONDS = 7 * 24 * 3600


class Refused(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class _Bucket:
    tokens: float
    updated: float


@dataclass
class TokenService:
    master_key: bytes
    signing_key: bytes
    public_key: bytes
    period_seconds: int = PERIOD_SECONDS
    rate_per_minute: int = 600
    labs: dict[str, tuple[bytes, bytes]] = field(default_factory=dict)  # id -> (pubkey, key hash)
    _buckets: dict[str, _Bucket] = field(default_factory=dict)

    def period_of(self, now: float) -> int:
        return int(now // self.period_seconds)

    def register_lab(self, lab_id: str, lab_public_key: bytes, api_key: str) -> None:
        self.labs[lab_id] = (lab_public_key, hashlib.sha256(api_key.encode()).digest())

    def _period_key(self, period: int) -> bytes:
        return hmac.new(self.master_key, f"period:{period}".encode(), hashlib.sha256).digest()

    def token(self, gene: str, period: int) -> str:
        return hmac.new(self._period_key(period), gene.encode(), hashlib.sha256).hexdigest()

    def _rate_limit(self, lab_id: str, now: float) -> None:
        b = self._buckets.setdefault(lab_id, _Bucket(self.rate_per_minute, now))
        b.tokens = min(self.rate_per_minute, b.tokens + (now - b.updated) * self.rate_per_minute / 60)
        b.updated = now
        if b.tokens < 1:
            raise Refused("rate_limited")
        b.tokens -= 1

    def issue(
        self,
        lab_id: str,
        api_key: str,
        credential: SignedCredential,
        genes: list[str],
        holder_pk: str,
        now: float | None = None,
    ) -> SignedTokenSet:
        now = time.time() if now is None else now
        if lab_id not in self.labs:
            raise Refused("unregistered_lab")
        lab_pk, key_hash = self.labs[lab_id]
        if not hmac.compare_digest(key_hash, hashlib.sha256(api_key.encode()).digest()):
            raise Refused("bad_api_key")
        self._rate_limit(lab_id, now)
        cred = credential.credential
        if cred.lab_id != lab_id:
            raise Refused("credential_from_other_lab")
        if not signing.verify(lab_pk, cred.model_dump(), credential.signature):
            raise Refused("bad_credential_signature")
        if not set(genes) <= set(cred.carrier_genes):
            raise Refused("gene_not_in_credential")
        period = self.period_of(now)
        ts = TokenSet(
            period=period,
            holder_pk=holder_pk,
            tokens=sorted(self.token(g, period) for g in set(genes)),
        )
        return SignedTokenSet(
            token_set=ts, signature=signing.sign(self.signing_key, ts.model_dump())
        )

    def verify_token_set(self, signed: SignedTokenSet, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        ts = signed.token_set
        return ts.period == self.period_of(now) and signing.verify(
            self.public_key, ts.model_dump(), signed.signature
        )


def new_service(**kw) -> TokenService:
    sk, pk = signing.generate_keypair()
    import os

    return TokenService(master_key=os.urandom(32), signing_key=sk, public_key=pk, **kw)
