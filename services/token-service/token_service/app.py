from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from schemas.models import SignedCredential

from .core import Refused, new_service

svc = new_service()
api = FastAPI(title="AMANA national token service")


class IssueRequest(BaseModel):
    lab_id: str
    api_key: str
    credential: SignedCredential
    genes: list[str]
    holder_pk: str


@api.get("/pubkey")
def pubkey():
    return {"public_key": svc.public_key.hex()}


@api.post("/tokens")
def tokens(req: IssueRequest):
    try:
        return svc.issue(req.lab_id, req.api_key, req.credential, req.genes, req.holder_pk)
    except Refused as e:
        raise HTTPException(403, e.reason) from e
