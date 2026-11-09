"""Builds labs, the token service and wallets for tests and the evaluation harness."""
from lab_issuer.core import LabIssuer
from schemas import signing
from schemas.models import SignedTokenSet, TokenSet, attestation
from token_service.core import new_service

from sim.eval.protocol import Wallet


class World:
    def __init__(self, now: float = 1_000_000.0, n_labs: int = 2):
        self.now = now
        self.svc = new_service(rate_per_minute=10**9)  # limiter has its own unit test
        self.labs = [LabIssuer(f"lab-{i}") for i in range(n_labs)]
        for lab in self.labs:
            self.svc.register_lab(lab.lab_id, lab.public_key, lab.api_key)
        self.period = self.svc.period_of(now)

    def wallet(self, name: str, person, lab_idx: int = 0):
        lab = self.labs[lab_idx % len(self.labs)]
        w = Wallet(name, self.svc.public_key)
        cred = lab.issue(person.id, person.carrier_genes, now=int(self.now))
        ts = self.svc.issue(lab.lab_id, lab.api_key, cred, person.carrier_genes,
                            w.pk.hex(), now=self.now)
        w.load(ts, {self.svc.token(g, self.period): g for g in person.carrier_genes})
        return w

    def forged(self, w, genes: list[str]) -> SignedTokenSet:
        """Attacker-built token set signed with the attacker's own key."""
        sk, _ = signing.generate_keypair()
        ts = TokenSet(period=self.period, holder_pk=w.pk.hex(),
                      tokens=sorted(self.svc.token(g, self.period) for g in genes))
        return SignedTokenSet(token_set=ts, signature=signing.sign(sk, ts.model_dump()),
                              attestation_signature=signing.sign(sk, attestation(ts.period, ts.holder_pk)))
