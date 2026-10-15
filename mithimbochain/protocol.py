"""Constantes de consensus : changer ces valeurs crée un autre protocole."""
import hashlib
import json

CHAIN_ID = "mithimbochain-local-v1"
MAX_SUPPLY = 10_000
REWARD = 10
DIFFICULTY = 2  # Deux zéros hexadécimaux, fixé par le protocole local.
ZERO_HASH = "0" * 64

class ValidationError(ValueError):
    pass

def integer(value, name, minimum=0):
    if type(value) is not int or value < minimum:
        raise ValidationError(f"{name}: entier >= {minimum} requis")
    return value

def canonical(value):
    def check(item):
        if item is None or type(item) in (str, int, bool):
            return
        if type(item) is list:
            for v in item:
                check(v)
            return
        if type(item) is dict and all(type(k) is str for k in item):
            for v in item.values():
                check(v)
            return
        raise ValidationError("Type non canonique")
    check(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()
