"""Mock health-records exchange: delivers a lab-signed result as a FHIR bundle."""
from lab_issuer.core import LabIssuer


class RecordsExchange:
    def __init__(self, lab: LabIssuer):
        self.lab = lab

    def fetch_bundle(self, subject: str, carrier_genes: list[str]) -> dict:
        return self.lab.fhir_bundle(self.lab.issue(subject, carrier_genes))
