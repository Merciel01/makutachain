from copy import deepcopy
from dataclasses import dataclass
from .protocol import CHAIN_ID, ZERO_HASH, digest, integer, ValidationError

@dataclass(frozen=True)
class Block:
    index: int
    previous_hash: str
    timestamp: int
    nonce: int
    transactions: tuple
    hash: str

    def header(self):
        return {"chain_id": CHAIN_ID, "index": self.index, "previous_hash": self.previous_hash,
                "timestamp": self.timestamp, "nonce": self.nonce,
                "transactions_hash": digest(list(self.transactions))}

    def calculated_hash(self):
        return digest(self.header())

    def to_dict(self):
        return {**self.header(), "transactions": deepcopy(list(self.transactions)), "hash": self.hash}

    @classmethod
    def create(cls, index, previous_hash, timestamp, transactions, nonce=0):
        block = cls(index, previous_hash, timestamp, nonce, tuple(deepcopy(transactions)), "")
        return cls(index, previous_hash, timestamp, nonce, block.transactions, block.calculated_hash())

    @classmethod
    def from_dict(cls, data):
        expected = {"chain_id", "index", "previous_hash", "timestamp", "nonce", "transactions_hash", "transactions", "hash"}
        if type(data) is not dict or set(data) != expected or data["chain_id"] != CHAIN_ID:
            raise ValidationError("Format de bloc invalide")
        for name in ("index", "timestamp", "nonce"):
            integer(data[name], name)
        for name in ("previous_hash", "transactions_hash", "hash"):
            if type(data[name]) is not str or len(data[name]) != 64 or any(c not in "0123456789abcdef" for c in data[name]):
                raise ValidationError("Hash invalide")
        if type(data["transactions"]) is not list or len(data["transactions"]) > 101:
            raise ValidationError("Liste de transactions invalide")
        block = cls(data["index"], data["previous_hash"], data["timestamp"], data["nonce"], tuple(deepcopy(data["transactions"])), data["hash"])
        if digest(list(block.transactions)) != data["transactions_hash"] or block.calculated_hash() != block.hash:
            raise ValidationError("Bloc modifié")
        return block

def genesis():
    return Block.create(0, ZERO_HASH, 0, [])
