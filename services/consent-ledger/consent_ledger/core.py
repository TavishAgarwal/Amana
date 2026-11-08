"""Consent ledger: signed, expiring, revocable permissions + hash-chained audit log."""
import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Protocol

from schemas import signing
from schemas.models import SignedPermission

GENESIS = "0" * 64


class Denied(Exception):
    pass


def _h(entry: dict) -> str:
    body = {k: entry[k] for k in ("seq", "ts", "actor", "action", "detail", "prev")}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


class AuditStore(Protocol):
    def append(self, entry: dict) -> None: ...
    def all(self) -> list[dict]: ...


class MemoryStore:
    def __init__(self):
        self.rows: list[dict] = []

    def append(self, entry: dict) -> None:
        self.rows.append(entry)

    def all(self) -> list[dict]:
        return self.rows


class PostgresStore:
    """Append-only table; a trigger rejects UPDATE and DELETE."""

    def __init__(self, dsn: str):
        import psycopg
        self.conn = psycopg.connect(dsn, autocommit=True)
        self.conn.execute("""create table if not exists audit (
            seq int primary key, ts bigint, actor text, action text, detail text,
            prev text, hash text)""")
        self.conn.execute("""create or replace function audit_immutable() returns trigger as $$
            begin raise exception 'audit is append-only'; end $$ language plpgsql""")
        self.conn.execute("drop trigger if exists audit_no_change on audit")
        self.conn.execute("""create trigger audit_no_change before update or delete on audit
            for each row execute function audit_immutable()""")

    def append(self, e: dict) -> None:
        self.conn.execute("insert into audit values (%s,%s,%s,%s,%s,%s,%s)",
                          (e["seq"], e["ts"], e["actor"], e["action"], e["detail"], e["prev"],
                           e["hash"]))

    def all(self) -> list[dict]:
        cur = self.conn.execute("select seq,ts,actor,action,detail,prev,hash from audit order by seq")
        return [dict(zip(("seq", "ts", "actor", "action", "detail", "prev", "hash"), r))
                for r in cur.fetchall()]


@dataclass
class Ledger:
    store: AuditStore = field(default_factory=MemoryStore)
    permissions: dict[str, SignedPermission] = field(default_factory=dict)
    revoked: set[str] = field(default_factory=set)

    def _audit(self, actor: str, action: str, detail: str, now: float) -> None:
        rows = self.store.all()
        entry = {"seq": len(rows), "ts": int(now), "actor": actor, "action": action,
                 "detail": detail, "prev": rows[-1]["hash"] if rows else GENESIS}
        entry["hash"] = _h(entry)
        self.store.append(entry)

    def verify_chain(self) -> bool:
        prev = GENESIS
        for i, e in enumerate(self.store.all()):
            if e["seq"] != i or e["prev"] != prev or e["hash"] != _h(e):
                return False
            prev = e["hash"]
        return True

    def grant(self, sp: SignedPermission, now: float | None = None) -> None:
        now = time.time() if now is None else now
        p = sp.permission
        if not signing.verify(bytes.fromhex(p.holder_pk), p.model_dump(), sp.signature):
            self._audit(p.grantee, "grant_rejected", "bad_signature", now)
            raise Denied("bad_signature")
        if p.expires_at <= now:
            raise Denied("already_expired")
        self.permissions[p.id] = sp
        self._audit(p.holder_pk[:8], "grant", f"{p.type}->{p.grantee}", now)

    def revoke(self, perm_id: str, holder_pk: str, signature: str, now: float | None = None) -> None:
        now = time.time() if now is None else now
        sp = self.permissions.get(perm_id)
        if not sp or sp.permission.holder_pk != holder_pk or not signing.verify(
                bytes.fromhex(holder_pk), {"revoke": perm_id}, signature):
            raise Denied("bad_revoke")
        self.revoked.add(perm_id)  # effective immediately
        self._audit(holder_pk[:8], "revoke", perm_id, now)

    def check(self, grantee: str, ptype: str, holder_pk: str, now: float | None = None) -> bool:
        """Default is no access. Every attempt is audited."""
        now = time.time() if now is None else now
        ok = any(
            p.permission.grantee == grantee and p.permission.type == ptype
            and p.permission.holder_pk == holder_pk and p.permission.expires_at > now
            and pid not in self.revoked
            for pid, p in self.permissions.items()
        )
        self._audit(grantee, "access_allowed" if ok else "access_denied",
                    f"{ptype}:{holder_pk[:8]}", now)
        return ok

    def delete_all(self, holder_pk: str, now: float | None = None) -> int:
        """FR-19: withdraw every permission in one action."""
        now = time.time() if now is None else now
        ids = [i for i, p in self.permissions.items() if p.permission.holder_pk == holder_pk]
        self.revoked.update(ids)
        self._audit(holder_pk[:8], "withdraw_all", str(len(ids)), now)
        return len(ids)


def new_permission_id() -> str:
    return uuid.uuid4().hex
