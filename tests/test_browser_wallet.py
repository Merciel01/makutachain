import json
import shutil
import subprocess
import pytest
from mithimbochain.blockchain import Blockchain
from mithimbochain.transaction import validate_transfer


def test_webcrypto_vault_and_python_consensus(tmp_path):
    if not shutil.which('node'):
        pytest.skip('Node requis pour le contrôle croisé WebCrypto/Python')
    result = subprocess.run(['node', 'tests/web_crypto.mjs'], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    tx = data['tx']
    assert validate_transfer(tx)
    chain = Blockchain()
    chain.mine(tx['sender'])
    chain.submit(tx)
    chain.mine(data['bob'])
    assert chain.balance(tx['sender'])['confirmed'] == 6
    assert chain.balance(data['bob'])['confirmed'] == 14
    assert chain.validate()

    from mithimbochain.api import create_app
    client = create_app(tmp_path / 'chain.json', 'test-token-000000000000000000000000000000').test_client()
    headers = {'Origin': 'http://localhost', 'X-Mithimbo-Client': 'web'}
    assert client.post('/api/session', json={}, headers=headers).status_code == 200
    assert client.post('/api/mine', json={'recipient': tx['sender']}, headers=headers).status_code == 201
    assert client.post('/api/transactions', json=tx, headers=headers).status_code == 201
    assert client.post('/api/mine', json={'recipient': data['bob']}, headers=headers).status_code == 201
    assert client.get('/api/balance/' + tx['sender']).json['confirmed'] == 6
    assert client.get('/api/balance/' + data['bob']).json['confirmed'] == 14
