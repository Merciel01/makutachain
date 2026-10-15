import logging
from concurrent.futures import ThreadPoolExecutor
import pytest
from mithimbochain.api import create_app
from mithimbochain.wallet import Wallet

TOKEN = 'a' * 64
HEADERS = {'Authorization': 'Bearer ' + TOKEN}

@pytest.fixture
def app(tmp_path):
    return create_app(tmp_path / 'chain.json', TOKEN)

def test_api_demo(app):
    client = app.test_client()
    alice, bob = Wallet(), Wallet()
    assert client.get('/').status_code == 200
    assert client.get('/api/stats').json['circulating'] == 0
    assert client.post('/api/mine', json={'recipient': alice.address}, headers=HEADERS).status_code == 201
    tx = alice.sign(bob.address, 4, 1)
    assert client.post('/api/transactions', json=tx, headers=HEADERS).status_code == 201
    assert client.get('/api/balance/' + alice.address).json['available'] == 6
    assert client.post('/api/mine', json={'recipient': bob.address}, headers=HEADERS).status_code == 201
    assert client.get('/api/balance/' + bob.address).json['confirmed'] == 14
    assert client.get('/api/validate').json == {'valid': True}
    assert len(client.get('/api/chain').json['blocks']) == 3
    assert len(client.get('/api/blocks').json['blocks']) == 3
    assert client.get('/api/blocks/2').json['index'] == 2
    assert len(client.get('/api/transactions').json['confirmed']) == 3
    assert client.post('/api/transactions', json=tx, headers=HEADERS).status_code == 400

@pytest.mark.parametrize('path', ['/api/mine','/api/transactions'])
def test_auth(app, path):
    assert app.test_client().post(path, json={}).status_code == 401

@pytest.mark.parametrize('path', ['/api/balance/nope','/api/blocks/99','/absent','/assets/../pyproject.toml'])
def test_bad_get(app, path):
    response = app.test_client().get(path)
    assert response.status_code in (400,404)
    assert 'error' in response.json

@pytest.mark.parametrize('data', [None, [], {'recipient':'bad'}, {'recipient':'bad','private_key':'secret'}, {}])
def test_bad_mine(app, data):
    response = app.test_client().post('/api/mine', data='null' if data is None else None, json=data if data is not None else None, headers={**HEADERS,'Content-Type':'application/json'})
    assert response.status_code == 400
    assert 'secret' not in response.get_data(as_text=True)

def test_origin_host_and_payload_limit(app):
    client = app.test_client()
    assert client.post('/api/mine', json={}, headers={**HEADERS,'Origin':'https://evil.invalid'}).status_code == 403
    assert client.get('/api/stats', headers={'Host':'evil.invalid'}).status_code == 403
    assert client.get('/api/stats', environ_base={'REMOTE_ADDR':'10.0.0.2'}).status_code == 403
    assert client.post('/api/mine', data='x'*40000, headers={**HEADERS,'Content-Type':'application/json'}).status_code == 413
    assert client.post('/api/mine', data='{', headers={**HEADERS,'Content-Type':'application/json'}).status_code == 400
    assert client.post('/api/mine', data='text', headers=HEADERS).status_code == 415

def test_concurrent_double_spend(app):
    alice, bob = Wallet(), Wallet()
    app.test_client().post('/api/mine', json={'recipient':alice.address}, headers=HEADERS)
    tx = alice.sign(bob.address, 8, 1)
    def submit(_):
        return app.test_client().post('/api/transactions', json=tx, headers=HEADERS).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(submit, range(2))) == [201, 400]

def test_disk_failure_rolls_back(app, monkeypatch, caplog):
    from mithimbochain.storage import Storage
    def fail(*args):
        raise OSError('sensitive internal detail')
    monkeypatch.setattr(Storage, 'save', fail)
    with caplog.at_level(logging.ERROR):
        response = app.test_client().post('/api/mine', json={'recipient':Wallet().address}, headers=HEADERS)
    assert response.status_code == 500
    assert app.test_client().get('/api/stats').json['height'] == 0
    assert 'sensitive' not in caplog.text + response.get_data(as_text=True)
    assert TOKEN not in caplog.text + response.get_data(as_text=True)

def test_no_private_key_api(app):
    client = app.test_client()
    for path in ['/api/wallet','/api/sign','/api/private-key']:
        assert client.get(path).status_code == 404
    for path in ['/api/stats','/api/chain','/api/transactions']:
        assert 'private_key' not in client.get(path).get_data(as_text=True)

def test_unicode_auth_is_refused(app):
    response = app.test_client().post('/api/mine', json={}, headers={'Authorization':'Bearer é'})
    assert response.status_code == 401

WEB_HEADERS = {'Origin': 'http://localhost', 'X-Mithimbo-Client': 'web', 'Sec-Fetch-Site': 'same-origin'}

def test_browser_session_and_cookie_only_mining(app):
    client = app.test_client()
    response = client.post('/api/session', json={}, headers=WEB_HEADERS)
    assert response.status_code == 200
    assert response.json == {'connected': True}
    cookie = response.headers['Set-Cookie']
    assert 'HttpOnly' in cookie and 'SameSite=Strict' in cookie and 'Path=/api' in cookie
    assert TOKEN not in cookie
    alice = Wallet()
    mined = client.post('/api/mine', json={'recipient': alice.address}, headers=WEB_HEADERS)
    assert mined.status_code == 201
    assert client.get('/api/balance/' + alice.address).json['confirmed'] == 10
    assert client.post('/api/mine', json={'recipient': alice.address}).status_code == 401
    assert client.post('/api/mine', json={'recipient': alice.address}, headers={**WEB_HEADERS, 'Origin': 'https://evil.invalid'}).status_code == 403

@pytest.mark.parametrize('headers', [{}, {'Origin':'http://localhost'}, {'X-Mithimbo-Client':'web'}, {**WEB_HEADERS,'Origin':'http://evil.invalid'}, {**WEB_HEADERS,'Sec-Fetch-Site':'cross-site'}])
def test_browser_session_rejects_other_origins(app, headers):
    response = app.test_client().post('/api/session', json={}, headers=headers)
    assert response.status_code == 403

def test_browser_session_not_valid_on_another_server(tmp_path):
    first = create_app(tmp_path/'one.json', TOKEN).test_client()
    first.post('/api/session', json={}, headers=WEB_HEADERS)
    capability = first.get_cookie('mithimbo_session', path='/api').value
    other = create_app(tmp_path/'two.json', TOKEN).test_client()
    other.set_cookie('mithimbo_session', capability, path='/api')
    assert other.post('/api/mine', json={'recipient':Wallet().address}, headers=WEB_HEADERS).status_code == 401

def test_new_frontend_assets(app):
    client=app.test_client()
    assert client.get('/assets/wallet.mjs').status_code == 200
    page=client.get('/').get_data(as_text=True)
    for section in ('accueil','portefeuilles','envoyer','recevoir','minage','explorateur'):
        assert 'id="page-'+section+'"' in page
    assert 'id="token"' not in page
    assert 'id="transaction"' not in page
    assert 'type="module"' in page

def test_interface_module_and_bootstrap(app):
    client = app.test_client()
    module = client.get('/assets/interface.mjs')
    assert module.status_code == 200
    assert 'javascript' in module.content_type
    bootstrap = client.get('/assets/app.js').get_data(as_text=True)
    assert "import('./interface.mjs').catch(startupFailure)" in bootstrap
    assert 'Ctrl+C' in bootstrap
