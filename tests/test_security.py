from copy import deepcopy
import json
import pytest
from mithimbochain.block import Block, genesis
from mithimbochain.blockchain import Blockchain
from mithimbochain.consensus import mine_block
from mithimbochain.protocol import ValidationError
from mithimbochain.transaction import reward
from mithimbochain.wallet import Wallet
from mithimbochain.storage import Storage

def test_confirmed_funds_only():
    alice, bob, carol = Wallet(), Wallet(), Wallet()
    chain = Blockchain(); chain.mine(alice.address)
    chain.submit(alice.sign(bob.address, 10, 1))
    with pytest.raises(ValidationError): chain.submit(bob.sign(carol.address, 1, 1))
    txs = [reward(carol.address,10,2), alice.sign(bob.address,10,1), bob.sign(carol.address,1,1)]
    block = mine_block(2,chain.blocks[-1].hash,chain.blocks[-1].timestamp,txs)
    with pytest.raises(ValidationError): Blockchain([*chain.blocks,block])

def test_reward_cannot_be_spent_same_block():
    alice,bob=Wallet(),Wallet()
    block=mine_block(1,genesis().hash,1,[reward(alice.address,10,1),alice.sign(bob.address,1,1)])
    with pytest.raises(ValidationError): Blockchain([genesis(),block])

def test_spend_twice_between_blocks():
    alice,bob=Wallet(),Wallet()
    chain=Blockchain();chain.mine(alice.address)
    chain.submit(alice.sign(bob.address,10,1));chain.mine(bob.address)
    with pytest.raises(ValidationError): chain.submit(alice.sign(bob.address,1,2))
    block=mine_block(3,chain.blocks[-1].hash,chain.blocks[-1].timestamp,[reward(bob.address,10,3),alice.sign(bob.address,1,2)])
    with pytest.raises(ValidationError): Blockchain([*chain.blocks,block])

@pytest.mark.parametrize('field,value',[('nonce',True),('index',-1),('timestamp',1.0),('previous_hash','g'*64),('transactions',{}),('chain_id','evil'),('hash','0'*64)])
def test_malformed_block(field,value):
    data=genesis().to_dict();data[field]=value
    with pytest.raises(ValidationError):Block.from_dict(data)

def test_rehashed_tampering_still_rejected():
    alice,bob=Wallet(),Wallet()
    chain=Blockchain();chain.mine(alice.address)
    chain.submit(alice.sign(bob.address,4,1));chain.mine(bob.address)
    txs=deepcopy(list(chain.blocks[-1].transactions));txs[1]['amount']=5
    changed=mine_block(2,chain.blocks[1].hash,chain.blocks[2].timestamp,txs)
    with pytest.raises(ValidationError):Blockchain([*chain.blocks[:2],changed])

def test_snapshot_mempool_revalidated(tmp_path):
    alice,bob=Wallet(),Wallet();chain=Blockchain();chain.mine(alice.address)
    chain.submit(alice.sign(bob.address,8,1))
    data=chain.snapshot();data['mempool'].append(alice.sign(bob.address,8,2))
    path=tmp_path/'chain.json';path.write_text(json.dumps(data))
    with pytest.raises(ValidationError):Storage(path).load()

def test_block_payload_detached():
    transactions=[reward(Wallet().address,10,1)]
    block=Block.create(1,genesis().hash,1,transactions)
    transactions[0]['amount']=50
    output=block.to_dict();output['transactions'][0]['amount']=60
    assert block.transactions[0]['amount']==10

def test_nonce_persists_after_restart(tmp_path):
    alice,bob=Wallet(),Wallet();chain=Blockchain();chain.mine(alice.address)
    chain.submit(alice.sign(bob.address,1,1));chain.mine(bob.address)
    store=Storage(tmp_path/'chain.json');store.save(chain);reloaded=store.load()
    assert reloaded.balance(alice.address)['next_nonce']==2
    with pytest.raises(ValidationError):reloaded.submit(alice.sign(bob.address,1,1))
    reloaded.submit(alice.sign(bob.address,1,2))

def test_storage_failed_replace_preserves_previous(tmp_path,monkeypatch):
    import os
    store=Storage(tmp_path/'chain.json');chain=Blockchain();store.save(chain)
    before=store.path.read_bytes();chain.mine(Wallet().address)
    def fail(*args):raise OSError('write failure')
    monkeypatch.setattr(os,'replace',fail)
    with pytest.raises(OSError):store.save(chain)
    assert store.path.read_bytes()==before
    assert not list(tmp_path.glob('.chain-*'))
