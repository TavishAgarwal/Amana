import os
import time

import pytest
from consent_ledger.cases import CaseDesk, load_pack
from consent_ledger.core import Denied, Ledger, PostgresStore, new_permission_id
from schemas import signing
from schemas.models import Permission, SignedPermission

NOW = 1_000_000.0
PACK = load_pack("packs/abu-dhabi/pack.yaml")


def grant(ledger, sk, pk, ptype="share_counsellor", grantee="c-001", ttl=3600, now=NOW):
    p = Permission(id=new_permission_id(), holder_pk=pk.hex(), type=ptype, grantee=grantee,
                   expires_at=int(now + ttl), nonce="n" * 8)
    sp = SignedPermission(permission=p, signature=signing.sign(sk, p.model_dump()))
    ledger.grant(sp, now)
    return p


def test_default_deny_then_grant_revoke_expiry():
    sk, pk = signing.generate_keypair()
    L = Ledger()
    assert not L.check("c-001", "share_counsellor", pk.hex(), NOW)
    p = grant(L, sk, pk)
    assert L.check("c-001", "share_counsellor", pk.hex(), NOW + 10)
    assert not L.check("c-001", "share_counsellor", pk.hex(), NOW + 7200)  # expired
    assert not L.check("c-002", "share_counsellor", pk.hex(), NOW + 10)  # other grantee
    L.revoke(p.id, pk.hex(), signing.sign(sk, {"revoke": p.id}), NOW + 20)
    assert not L.check("c-001", "share_counsellor", pk.hex(), NOW + 21)


def test_forged_permission_rejected_and_chain_tamper_detected():
    sk, pk = signing.generate_keypair()
    other, _ = signing.generate_keypair()
    L = Ledger()
    p = Permission(id="x", holder_pk=pk.hex(), type="check_only", grantee="g",
                   expires_at=int(NOW + 99), nonce="n" * 8)
    with pytest.raises(Denied):
        L.grant(SignedPermission(permission=p, signature=signing.sign(other, p.model_dump())), NOW)
    grant(L, sk, pk)
    L.check("c-001", "share_counsellor", pk.hex(), NOW)
    assert L.verify_chain()
    L.store.all()[1]["actor"] = "someone-else"
    assert not L.verify_chain()


def test_delete_all_withdraws_everything():
    sk, pk = signing.generate_keypair()
    L = Ledger()
    grant(L, sk, pk), grant(L, sk, pk, "check_only")
    assert L.delete_all(pk.hex(), NOW) == 2
    assert not L.check("c-001", "share_counsellor", pk.hex(), NOW)


def test_case_routing_visibility_and_signoff():
    sk, pk = signing.generate_keypair()
    L = Ledger()
    desk = CaseDesk(L, PACK)
    with pytest.raises(Denied):  # nothing visible without permission
        desk.open_case(pk.hex(), "c-001", "incompatible", True, False, NOW)
    p = grant(L, sk, pk)
    t = time.perf_counter()
    c = desk.open_case(pk.hex(), "c-001", "incompatible", True, False, NOW)
    assert time.perf_counter() - t < 5 and c.tier == 3 and c.due_at == NOW + 48 * 3600
    with pytest.raises(Denied, match="sign_off_required"):
        desk.set_label(c.id, "clinical_advice")
    desk.sign_off(c.id, "c-001")
    assert desk.set_label(c.id, "clinical_advice").label == "clinical_advice"
    L.revoke(p.id, pk.hex(), signing.sign(sk, {"revoke": p.id}), NOW + 5)
    with pytest.raises(Denied):
        desk.view(c.id, "c-001", NOW + 6)


def test_routing_rules():
    from consent_ledger.cases import route_tier
    assert route_tier(PACK, "incompatible", True) == 3
    assert route_tier(PACK, "compatible", True) == 1
    assert route_tier(PACK, "compatible", True, question=True) == 2


def test_1000_simulated_cases_routed_correctly():
    sk, pk = signing.generate_keypair()
    L = Ledger()
    grant(L, sk, pk)
    desk = CaseDesk(L, PACK)
    for i in range(1000):
        res = "incompatible" if i % 7 == 0 else "compatible"
        q = i % 5 == 0
        c = desk.open_case(pk.hex(), "c-001", res, True, q, NOW)
        assert c.tier == (3 if res == "incompatible" else 2 if q else 1)


def test_postgres_store_is_append_only_and_chain_verifies():
    import psycopg
    dsn = os.environ.get("DATABASE_URL", "postgresql://amana:change-me-locally@localhost:5433/amana")
    store = PostgresStore(dsn)
    n0 = len(store.all())
    L = Ledger(store=store)
    L._audit("a", "x", "y", NOW)
    with pytest.raises(psycopg.errors.RaiseException):
        store.conn.execute("update audit set actor='z' where seq=%s", (n0,))
    with pytest.raises(psycopg.errors.RaiseException):
        store.conn.execute("delete from audit where seq=%s", (n0,))


def test_audit_append_reads_only_the_last_row():
    """Writing an audit entry must not read the whole log, or writes slow down as it grows."""
    from consent_ledger.core import MemoryStore

    class Counting(MemoryStore):
        reads = 0

        def all(self):
            Counting.reads += 1
            return super().all()

    led = Ledger(store=Counting())
    for i in range(500):
        led._audit("a", "x", str(i), now=1000 + i)
    assert Counting.reads == 0
    assert led.verify_chain() and len(led.store.rows) == 500
