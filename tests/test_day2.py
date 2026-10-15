import pytest
from mithimbochain.wallet import Wallet
from mithimbochain.transaction import validate_transfer
from mithimbochain.mempool import Mempool
from mithimbochain.protocol import ValidationError

def test_signature_and_wallet_file(tmp_path):
    alice, bob = Wallet(), Wallet()
    path = tmp_path / 'key'
    alice.save(path)
    assert path.stat().st_mode & 0o777 == 0o600
    assert Wallet.load(path).address == alice.address
    assert validate_transfer(alice.sign(bob.address, 1, 1))
    with pytest.raises(FileExistsError):
        alice.save(path)

@pytest.mark.parametrize('field,value', [('signature', '00'*64), ('public_key', '00'*32), ('chain_id', 'other'), ('amount', 2)])
def test_forged_transfer(field, value):
    tx = Wallet().sign(Wallet().address, 1, 1)
    tx[field] = value
    with pytest.raises(ValidationError):
        validate_transfer(tx)

@pytest.mark.parametrize('amount', [0, -1, 1.0, True, 10001])
def test_invalid_amount(amount):
    with pytest.raises(ValidationError):
        Wallet().sign(Wallet().address, amount, 1)

def test_reservations_and_nonces():
    alice, bob = Wallet(), Wallet()
    pool = Mempool()
    pool.add(alice.sign(bob.address, 6, 1), {alice.address: 10}, {})
    for amount, nonce in [(5, 2), (1, 1), (1, 3)]:
        with pytest.raises(ValidationError):
            pool.add(alice.sign(bob.address, amount, nonce), {alice.address: 10}, {})
    pool.add(alice.sign(bob.address, 4, 2), {alice.address: 10}, {})
