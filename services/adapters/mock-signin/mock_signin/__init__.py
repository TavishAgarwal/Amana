"""Mock national-ID sign-in (OIDC-shaped). Swap for a real provider by changing ISSUER config."""
import os
import time

from fastapi import FastAPI, HTTPException
from schemas import signing

ISSUER = os.environ.get("SIGNIN_ISSUER", "http://localhost:9000")
PERSONAS = {"mariam": "Mariam (synthetic)", "khalid": "Khalid (synthetic)",
            "noura": "Noura (synthetic)", "omar": "Omar (synthetic)"}  # no real IDs
_sk, _pk = signing.generate_keypair()
_codes: dict[str, str] = {}
api = FastAPI(title="Mock sign-in")


@api.get("/authorize")
def authorize(persona: str):
    if persona not in PERSONAS:
        raise HTTPException(404, "unknown_persona")
    code = f"code-{persona}-{int(time.time())}"
    _codes[code] = persona
    return {"code": code}


@api.post("/token")
def token(code: str):
    persona = _codes.pop(code, None)
    if not persona:
        raise HTTPException(400, "invalid_code")
    claims = {"iss": ISSUER, "sub": f"synthetic-{persona}", "name": PERSONAS[persona],
              "exp": int(time.time()) + 600}
    return {"id_token": claims, "signature": signing.sign(_sk, claims)}


@api.get("/jwks")
def jwks():
    return {"public_key": _pk.hex()}
