from .block import Block
from .protocol import DIFFICULTY, ValidationError

def verify_pow(block):
    if block.calculated_hash() != block.hash or not block.hash.startswith("0" * DIFFICULTY):
        raise ValidationError("Preuve de travail insuffisante")

def mine_block(index, previous_hash, timestamp, transactions):
    nonce = 0
    while True:
        block = Block.create(index, previous_hash, timestamp, transactions, nonce)
        if block.hash.startswith("0" * DIFFICULTY):
            return block
        nonce += 1
