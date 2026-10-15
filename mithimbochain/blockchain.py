from copy import deepcopy
from threading import RLock
import time
from .block import Block, genesis
from .consensus import verify_pow, mine_block
from .mempool import Mempool
from .protocol import MAX_SUPPLY, REWARD, ValidationError
from .transaction import validate_transfer, reward, address_valid

class Blockchain:
    def __init__(self, blocks=None):
        self.lock = RLock()
        self.blocks = [genesis()] if blocks is None else list(blocks)
        self.mempool = Mempool()
        self.balances, self.nonces, self.supply = self._replay()

    def _replay(self):
        if not self.blocks or self.blocks[0].to_dict() != genesis().to_dict():
            raise ValidationError("Genesis incorrect")
        balances, nonces, seen, supply = {}, {}, set(), 0
        for index, block in enumerate(self.blocks):
            Block.from_dict(block.to_dict())
            if block.index != index:
                raise ValidationError("Index incorrect")
            if index == 0:
                continue
            previous = self.blocks[index - 1]
            if block.previous_hash != previous.hash or block.timestamp < previous.timestamp:
                raise ValidationError("Lien ou horodatage incorrect")
            verify_pow(block)
            expected_reward = min(REWARD, MAX_SUPPLY - supply)
            transactions = list(block.transactions)
            if expected_reward:
                if not transactions or type(transactions[0]) is not dict:
                    raise ValidationError("Récompense manquante")
                first = transactions.pop(0)
                if first != reward(first.get("recipient"), expected_reward, index):
                    raise ValidationError("Récompense incorrecte")
            elif any(tx.get("kind") == "reward" for tx in transactions if type(tx) is dict):
                raise ValidationError("Plafond atteint")
            # Les transferts ne peuvent dépenser ni la récompense du bloc ni ses entrées.
            spent = {}
            for tx in transactions:
                validate_transfer(tx)
                sender = tx["sender"]
                if tx["id"] in seen or tx["nonce"] != nonces.get(sender, 0) + 1:
                    raise ValidationError("Replay ou nonce incorrect")
                spent[sender] = spent.get(sender, 0) + tx["amount"]
                if spent[sender] > balances.get(sender, 0):
                    raise ValidationError("Solde confirmé insuffisant")
                nonces[sender] = tx["nonce"]
                seen.add(tx["id"])
            for tx in transactions:
                balances[tx["sender"]] = balances.get(tx["sender"], 0) - tx["amount"]
                balances[tx["recipient"]] = balances.get(tx["recipient"], 0) + tx["amount"]
            if expected_reward:
                recipient = first["recipient"]
                balances[recipient] = balances.get(recipient, 0) + expected_reward
                supply += expected_reward
            if sum(balances.values()) != supply or supply > MAX_SUPPLY:
                raise ValidationError("Invariant monétaire violé")
        return balances, nonces, supply

    def validate(self):
        with self.lock:
            state = self._replay()
            if state != (self.balances, self.nonces, self.supply):
                raise ValidationError("État divergent")
            pool = Mempool()
            for tx in self.mempool.transactions:
                pool.add(tx, state[0], state[1])
            return True

    def submit(self, tx):
        with self.lock:
            self.mempool.add(tx, self.balances, self.nonces)
            return deepcopy(tx)

    def balance(self, address):
        address_valid(address)
        with self.lock:
            confirmed = self.balances.get(address, 0)
            pending = [tx for tx in self.mempool.transactions if tx["sender"] == address]
            reserved = sum(tx["amount"] for tx in pending)
            return {"address": address, "confirmed": confirmed, "reserved": reserved, "available": confirmed - reserved,
                    "next_nonce": self.nonces.get(address, 0) + len(pending) + 1}

    def mine(self, recipient):
        address_valid(recipient)
        with self.lock:
            height = len(self.blocks)
            amount = min(REWARD, MAX_SUPPLY - self.supply)
            transactions = ([reward(recipient, amount, height)] if amount else []) + deepcopy(self.mempool.transactions)
            block = mine_block(height, self.blocks[-1].hash, max(int(time.time()), self.blocks[-1].timestamp), transactions)
            candidate = Blockchain([*self.blocks, block])
            self.blocks = candidate.blocks
            self.balances, self.nonces, self.supply = candidate.balances, candidate.nonces, candidate.supply
            self.mempool = Mempool()
            return block

    def snapshot(self):
        with self.lock:
            return {"version": 1, "blocks": [b.to_dict() for b in self.blocks], "mempool": deepcopy(self.mempool.transactions)}

    @classmethod
    def from_snapshot(cls, data):
        if type(data) is not dict or set(data) != {"version", "blocks", "mempool"} or type(data["version"]) is not int or data["version"] != 1:
            raise ValidationError("Format de stockage invalide")
        if type(data["blocks"]) is not list or type(data["mempool"]) is not list:
            raise ValidationError("Format de stockage invalide")
        chain = cls([Block.from_dict(b) for b in data["blocks"]])
        for tx in data["mempool"]:
            chain.submit(tx)
        return chain
