"""Lab issuer: signs carrier credentials and builds FHIR-shaped bundles."""
import base64
import time
import uuid
from dataclasses import dataclass, field

from fhir.resources.bundle import Bundle
from schemas import signing
from schemas.models import Credential, SignedCredential


@dataclass
class LabIssuer:
    lab_id: str
    secret_key: bytes = b""
    public_key: bytes = b""
    api_key: str = field(default_factory=lambda: uuid.uuid4().hex)

    def __post_init__(self):
        if not self.secret_key:
            self.secret_key, self.public_key = signing.generate_keypair()

    def issue(
        self, subject: str, carrier_genes: list[str], couple_result: str | None = None,
        now: int | None = None,
    ) -> SignedCredential:
        cred = Credential(
            lab_id=self.lab_id,
            subject=subject,
            carrier_genes=sorted(set(carrier_genes)),
            couple_result=couple_result,
            issued_at=int(time.time()) if now is None else now,
        )
        return SignedCredential(
            credential=cred, signature=signing.sign(self.secret_key, cred.model_dump())
        )

    def fhir_bundle(self, signed: SignedCredential) -> dict:
        c = signed.credential
        entries = [{"resource": {"resourceType": "Patient", "id": c.subject}}]
        for g in c.carrier_genes:
            entries.append({"resource": {
                "resourceType": "Observation", "status": "final",
                "code": {"text": "carrier-status"},
                "subject": {"reference": f"Patient/{c.subject}"},
                "valueString": g,
            }})
        bundle = {
            "resourceType": "Bundle", "type": "collection", "entry": entries,
            "signature": {
                "type": [{"system": "urn:iso-astm:E1762-95:2013", "code": "1.2.840.10065.1.12.1.1"}],
                "when": "2026-01-01T00:00:00Z",
                "who": {"display": self.lab_id},
                "data": base64.b64encode(bytes.fromhex(signed.signature)).decode(),
            },
        }
        Bundle.model_validate(bundle)
        return bundle


def verify_credential(public_key: bytes, signed: SignedCredential) -> bool:
    return signing.verify(public_key, signed.credential.model_dump(), signed.signature)
