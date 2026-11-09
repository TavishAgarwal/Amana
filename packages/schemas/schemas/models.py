"""Shared data shapes (rules.md §6: defined here only)."""
from typing import Literal

from pydantic import BaseModel, Field


class Credential(BaseModel):
    version: int = 1
    lab_id: str
    subject: str  # pseudonymous id, never an Emirates ID
    carrier_genes: list[str]
    couple_result: Literal["compatible", "incompatible"] | None = None
    issued_at: int


class SignedCredential(BaseModel):
    credential: Credential
    signature: str


class TokenSet(BaseModel):
    period: int
    holder_pk: str  # device public key (hex) the set is bound to
    tokens: list[str]


class SignedTokenSet(BaseModel):
    """Kept only on the holder's device. The tokens are never sent to a partner."""
    token_set: TokenSet
    signature: str  # national signature over the whole set: lets the holder check its delivery
    attestation_signature: str = ""  # national signature over attestation(): the only part a partner sees


def attestation(period: int, holder_pk: str) -> dict:
    """What a partner verifies: this device key holds a national token set for this period."""
    return {"holder_pk": holder_pk, "period": period}


PermissionType = Literal["check_only", "reveal_condition", "share_counsellor", "family_invite"]


class Permission(BaseModel):
    id: str
    holder_pk: str
    type: PermissionType
    grantee: str
    expires_at: int
    nonce: str = Field(min_length=8)


class SignedPermission(BaseModel):
    permission: Permission
    signature: str


Tier = Literal[1, 2, 3]


class Case(BaseModel):
    id: str
    holder_ref: str
    tier: Tier
    created_at: int
    due_at: int | None = None
    summary: str = ""
    label: Literal["information", "clinical_advice"] = "information"
    signed_off_by: str | None = None
