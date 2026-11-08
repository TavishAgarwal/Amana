"""Counsellor cases: tier routing, consent-gated view, copilot summary, mandatory sign-off."""
import uuid
from dataclasses import dataclass, field

import yaml
from schemas.models import Case

from .core import Denied, Ledger


def load_pack(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def route_tier(pack: dict, couple_result: str | None, is_carrier: bool = True, question: bool = False) -> int:
    rules = pack["tier_rules"]
    if couple_result == "incompatible":
        return rules["incompatible"]
    if question:
        return rules["question_asked"]
    return rules["carrier_in_compatible_couple"]  # carriers get their own card (Tier 1)


@dataclass
class CaseDesk:
    ledger: Ledger
    pack: dict
    cases: dict[str, Case] = field(default_factory=dict)
    holders: dict[str, str] = field(default_factory=dict)  # case id -> holder_pk

    def open_case(self, holder_pk: str, counsellor: str, couple_result: str | None,
                  is_carrier: bool, question: bool, now: float) -> Case:
        """Called when a share_counsellor permission is granted; appears at once (< 5 s)."""
        if not self.ledger.check(counsellor, "share_counsellor", holder_pk, now):
            raise Denied("no_permission")
        tier = route_tier(self.pack, couple_result, is_carrier, question)
        hours = self.pack["time_targets_hours"].get(tier)
        case = Case(id=uuid.uuid4().hex[:8], holder_ref=holder_pk[:8], tier=tier,
                    created_at=int(now), due_at=int(now + hours * 3600) if hours else None,
                    summary=self.copilot_summary(tier, couple_result))
        self.cases[case.id], self.holders[case.id] = case, holder_pk
        return case

    @staticmethod
    def copilot_summary(tier: int, couple_result: str | None) -> str:
        # Template draft for the counsellor to edit; never shown to the couple as advice.
        return (f"DRAFT for counsellor review. Tier {tier}. Result: {couple_result or 'n/a'}. "
                "Offer all options neutrally, including continuing without intervention.")

    def view(self, case_id: str, counsellor: str, now: float) -> Case:
        if not self.ledger.check(counsellor, "share_counsellor", self.holders[case_id], now):
            raise Denied("permission_revoked_or_expired")
        return self.cases[case_id]

    def sign_off(self, case_id: str, counsellor: str) -> Case:
        c = self.cases[case_id]
        c.signed_off_by = counsellor
        return c

    def set_label(self, case_id: str, label: str) -> Case:
        c = self.cases[case_id]
        if label == "clinical_advice" and not c.signed_off_by:
            raise Denied("sign_off_required")
        c.label = label  # type: ignore[assignment]
        return c
