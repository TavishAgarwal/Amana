"""Counsellor cases: tier routing, consent-gated view, copilot summary, mandatory sign-off."""
import uuid
from dataclasses import dataclass, field

import yaml
from schemas.models import Case

from .core import Denied, Ledger


def load_pack(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def route_tier(pack: dict, couple_result: str | None, is_carrier: bool = True, question: bool = False,
               one_to_one: bool = False) -> int:
    rules = pack["tier_rules"]
    if couple_result == "incompatible":
        return rules["incompatible"]
    if question or one_to_one:
        return rules["question_asked"]
    return rules["carrier_in_compatible_couple"]  # carriers get their own card (Tier 1)


@dataclass
class CaseDesk:
    ledger: Ledger
    pack: dict
    cases: dict[str, Case] = field(default_factory=dict)
    holders: dict[str, str] = field(default_factory=dict)  # case id -> holder_pk

    def open_case(self, holder_pk: str, counsellor: str, couple_result: str | None,
                  is_carrier: bool, question: bool, now: float,
                  condition_code: str | None = None, question_text: str | None = None,
                  source: str = "self", language: str = "ar", slot_at: int | None = None) -> Case:
        """Called when a share_counsellor permission is granted; appears at once (< 5 s)."""
        if not self.ledger.allowed(counsellor, "share_counsellor", holder_pk, now):  # no data read yet
            raise Denied("no_permission")
        tier = route_tier(self.pack, couple_result, is_carrier, question, slot_at is not None)
        hours = self.pack["time_targets_hours"].get(tier)
        scope = [k for k, v in [("result", couple_result), ("condition", condition_code),
                                ("question", question_text), ("one_to_one", slot_at)] if v]
        case = Case(id=uuid.uuid4().hex[:8], holder_ref=holder_pk[:8], tier=tier,
                    created_at=int(now), due_at=int(now + hours * 3600) if hours else None,
                    summary=self.copilot_summary(tier, couple_result), condition_code=condition_code,
                    result=couple_result, question=question_text, counsellor=counsellor,
                    source=source, language=language, slot_at=slot_at, scope=scope)
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

    def sign_off(self, case_id: str, counsellor: str, note: str | None = None) -> Case:
        c = self.cases[case_id]
        if c.counsellor and c.counsellor != counsellor:
            raise Denied("not_your_case")
        c.note = (note if note is not None else c.note or c.summary).strip()
        c.signed_off_by = counsellor
        return c

    def for_holder(self, holder_pk: str) -> list[Case]:
        return [self.cases[i] for i, h in self.holders.items() if h == holder_pk]

    def set_label(self, case_id: str, label: str) -> Case:
        c = self.cases[case_id]
        if label == "clinical_advice" and not c.signed_off_by:
            raise Denied("sign_off_required")
        c.label = label  # type: ignore[assignment]
        return c
