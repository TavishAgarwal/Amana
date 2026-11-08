"""Ed25519 helpers over canonical JSON. Thin wrapper on PyNaCl; no custom crypto."""
import json
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def generate_keypair() -> tuple[bytes, bytes]:
    sk = SigningKey.generate()
    return bytes(sk), bytes(sk.verify_key)


def sign(secret_key: bytes, obj: Any) -> str:
    return SigningKey(secret_key).sign(canonical(obj)).signature.hex()


def verify(public_key: bytes, obj: Any, signature_hex: str) -> bool:
    try:
        VerifyKey(public_key).verify(canonical(obj), bytes.fromhex(signature_hex))
        return True
    except (BadSignatureError, ValueError):
        return False
