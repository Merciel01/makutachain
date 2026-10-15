import re
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature
from .protocol import CHAIN_ID, ValidationError, canonical, digest, integer

ADDRESS = re.compile(r"mtc_[0-9a-f]{64}\Z")

def address_valid(value):
    if type(value) is not str or not ADDRESS.fullmatch(value):
        raise ValidationError("Adresse invalide")
    return value

def public_address(public_key):
    if type(public_key) is not str or len(public_key) != 64:
        raise ValidationError("Clé publique invalide")
    try:
        raw = bytes.fromhex(public_key)
    except ValueError:
        raise ValidationError("Clé publique invalide") from None
    if len(raw) != 32 or raw.hex() != public_key:
        raise ValidationError("Clé publique invalide")
    import hashlib
    return "mtc_" + hashlib.sha256(raw).hexdigest()

PAYLOAD_KEYS = {"chain_id", "kind", "sender", "recipient", "amount", "nonce", "public_key"}

def payload(tx):
    return {key: tx[key] for key in PAYLOAD_KEYS}

def validate_transfer(tx):
    if type(tx) is not dict or set(tx) != PAYLOAD_KEYS | {"signature", "id"}:
        raise ValidationError("Format de transaction invalide")
    if tx["chain_id"] != CHAIN_ID or tx["kind"] != "transfer":
        raise ValidationError("Réseau ou type incorrect")
    address_valid(tx["sender"])
    address_valid(tx["recipient"])
    integer(tx["amount"], "amount", 1)
    integer(tx["nonce"], "nonce", 1)
    if tx["amount"] > 10_000 or tx["sender"] == tx["recipient"]:
        raise ValidationError("Montant ou destinataire incorrect")
    if public_address(tx["public_key"]) != tx["sender"]:
        raise ValidationError("Clé et adresse incohérentes")
    if type(tx["signature"]) is not str or len(tx["signature"]) != 128:
        raise ValidationError("Signature invalide")
    try:
        signature = bytes.fromhex(tx["signature"])
        if signature.hex() != tx["signature"]:
            raise ValueError()
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(tx["public_key"])).verify(signature, canonical(payload(tx)))
    except (ValueError, InvalidSignature):
        raise ValidationError("Signature invalide") from None
    if tx["id"] != digest({**payload(tx), "signature": tx["signature"]}):
        raise ValidationError("Identifiant incorrect")
    return True

def reward(recipient, amount, height):
    address_valid(recipient)
    tx = {"chain_id": CHAIN_ID, "kind": "reward", "recipient": recipient, "amount": amount, "height": height}
    return {**tx, "id": digest(tx)}
