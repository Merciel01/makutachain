from copy import deepcopy
from .transaction import validate_transfer
from .protocol import ValidationError

class Mempool:
    def __init__(self):
        self.transactions = []

    def add(self, tx, balances, nonces):
        validate_transfer(tx)
        if len(self.transactions) >= 100:
            raise ValidationError("Mempool plein")
        sender = tx["sender"]
        pending = [item for item in self.transactions if item["sender"] == sender]
        if tx["nonce"] != nonces.get(sender, 0) + len(pending) + 1:
            raise ValidationError("Nonce incompatible")
        available = balances.get(sender, 0) - sum(item["amount"] for item in pending)
        if tx["amount"] > available:
            raise ValidationError("Solde confirmé disponible insuffisant")
        self.transactions.append(deepcopy(tx))
