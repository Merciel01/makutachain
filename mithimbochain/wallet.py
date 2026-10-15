"""Clés et signature exclusivement locales ; aucun import par l'API."""
import os
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption
from .protocol import CHAIN_ID, canonical, digest
from .transaction import public_address, validate_transfer

class Wallet:
    def __init__(self, key=None):
        self._key = key if key is not None else Ed25519PrivateKey.generate()
        self.public_key = self._key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
        self.address = public_address(self.public_key)

    def sign(self, recipient, amount, nonce):
        tx = {"chain_id": CHAIN_ID, "kind": "transfer", "sender": self.address,
              "recipient": recipient, "amount": amount, "nonce": nonce, "public_key": self.public_key}
        tx["signature"] = self._key.sign(canonical(tx)).hex()
        tx["id"] = digest(tx)
        validate_transfer(tx)
        return tx

    def save(self, path):
        raw = self._key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
        fd = os.open(Path(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())

    @classmethod
    def load(cls, path):
        return cls(Ed25519PrivateKey.from_private_bytes(Path(path).read_bytes()))
