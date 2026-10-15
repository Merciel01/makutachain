import pytest
from mithimbochain.block import Block, genesis
from mithimbochain.blockchain import Blockchain
from mithimbochain.protocol import canonical, digest, ValidationError

def test_genesis_reproducible():
    assert genesis().to_dict() == genesis().to_dict()
    assert genesis().transactions == ()
    assert genesis().hash == "3458fa49f8e8188fbe53b00b8494d64ec637e1d65d522b8e8a257c7361d3c826"
    assert Blockchain().validate()

def test_canonical_order_and_utf8():
    assert canonical({"b": 1, "a": "é"}) == b'{"a":"\xc3\xa9","b":1}'
    assert digest({"b": 1, "a": 2}) == digest({"a": 2, "b": 1})

@pytest.mark.parametrize("value", [1.5, float("nan"), (1, 2)])
def test_noncanonical_types(value):
    with pytest.raises(ValidationError):
        canonical(value)

def test_block_roundtrip():
    block = genesis()
    assert Block.from_dict(block.to_dict()) == block

def test_modified_block():
    data = genesis().to_dict()
    data["nonce"] += 1
    with pytest.raises(ValidationError):
        Block.from_dict(data)

def test_invalid_genesis():
    with pytest.raises(ValidationError):
        Blockchain([Block.create(0, "0" * 64, 1, [])])
