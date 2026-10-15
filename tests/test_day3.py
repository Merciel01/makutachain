import pytest
from mithimbochain.block import Block
from mithimbochain.blockchain import Blockchain
from mithimbochain.consensus import mine_block
from mithimbochain.storage import Storage
from mithimbochain.wallet import Wallet
from mithimbochain.transaction import reward
from mithimbochain.protocol import ValidationError

def test_transfer_restart_and_replay(tmp_path):
    alice, bob = Wallet(), Wallet()
    chain = Blockchain()
    chain.mine(alice.address)
    tx = alice.sign(bob.address, 4, 1)
    chain.submit(tx)
    store = Storage(tmp_path / 'chain.json')
    store.save(chain)
    chain = store.load()
    assert chain.balance(alice.address)['available'] == 6
    with pytest.raises(ValidationError):
        chain.submit(tx)
    chain.mine(bob.address)
    store.save(chain)
    chain = store.load()
    assert chain.balance(alice.address)['confirmed'] == 6
    assert chain.balance(bob.address)['confirmed'] == 14
    assert chain.supply == 20
    with pytest.raises(ValidationError):
        chain.submit(tx)
    assert chain.validate()

@pytest.mark.parametrize('kind', ['extra_reward', 'wrong_reward', 'bad_link', 'no_reward', 'bad_index', 'no_pow', 'overspend', 'replay'])
def test_invalid_blocks(kind):
    alice, bob = Wallet(), Wallet()
    chain = Blockchain()
    chain.mine(alice.address)
    txs = [reward(alice.address, 10, 2)]
    previous, index = chain.blocks[-1].hash, 2
    if kind == 'extra_reward': txs.append(reward(bob.address, 10, 2))
    if kind == 'wrong_reward': txs = [reward(alice.address, 11, 2)]
    if kind == 'no_reward': txs = []
    if kind == 'bad_link': previous = 'f'*64
    if kind == 'bad_index': index = 3
    if kind == 'overspend': txs.append(alice.sign(bob.address, 11, 1))
    if kind == 'replay': txs += [alice.sign(bob.address, 1, 1)] * 2
    block = mine_block(index, previous, 1, txs)
    # Horodatage valide pour isoler le défaut visé.
    block = mine_block(index, previous, chain.blocks[-1].timestamp, txs)
    if kind == 'no_pow':
        nonce = 0
        while True:
            block = Block.create(index, previous, chain.blocks[-1].timestamp, txs, nonce)
            if not block.hash.startswith('00'): break
            nonce += 1
    with pytest.raises(ValidationError):
        Blockchain([*chain.blocks, block])

def test_supply_cap():
    alice = Wallet()
    chain = Blockchain()
    for _ in range(1000):
        chain.blocks.append(mine_block(len(chain.blocks), chain.blocks[-1].hash, 1, [reward(alice.address, 10, len(chain.blocks))]))
    chain = Blockchain(chain.blocks)
    assert chain.supply == 10000
    chain.mine(alice.address)
    assert chain.supply == 10000 and chain.blocks[-1].transactions == ()
    extra = mine_block(len(chain.blocks), chain.blocks[-1].hash, chain.blocks[-1].timestamp, [reward(alice.address, 10, len(chain.blocks))])
    with pytest.raises(ValidationError):
        Blockchain([*chain.blocks, extra])

def test_corruption(tmp_path):
    store = Storage(tmp_path / 'chain.json')
    store.save(Blockchain())
    store.path.write_text('{invalid')
    with pytest.raises(ValidationError): store.load()
