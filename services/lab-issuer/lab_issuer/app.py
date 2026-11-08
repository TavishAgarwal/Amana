from fastapi import FastAPI
from pydantic import BaseModel

from .core import LabIssuer

issuer = LabIssuer(lab_id="lab-demo")
api = FastAPI(title="AMANA lab issuer")


class IssueRequest(BaseModel):
    subject: str
    carrier_genes: list[str]
    couple_result: str | None = None


@api.get("/pubkey")
def pubkey():
    return {"lab_id": issuer.lab_id, "public_key": issuer.public_key.hex()}


@api.post("/issue")
def issue(req: IssueRequest):
    return issuer.issue(req.subject, req.carrier_genes, req.couple_result)
