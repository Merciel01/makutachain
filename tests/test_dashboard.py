import pytest

from mithimbochain.analytics import dashboard
from mithimbochain.api import create_app
from mithimbochain.blockchain import Blockchain
from mithimbochain.wallet import Wallet


def test_dashboard_genesis_has_no_invented_activity():
    chain = Blockchain()
    result = dashboard(chain.snapshot(), valid=chain.validate(), now=100)
    assert result['supply'] == result['volume'] == result['pending'] == 0
    assert result['active_addresses_24h'] == result['funded_addresses'] == 0
    assert result['average_transfer'] is None
    assert result['top5_percent'] is None
    assert result['median_block_seconds'] is None
    assert result['latest_timestamp'] is None
    assert result['history'] == []
    assert result['valid']


def test_dashboard_distinguishes_rewards_pending_and_confirmed(monkeypatch):
    monkeypatch.setattr('mithimbochain.blockchain.time.time', lambda: 100)
    chain = Blockchain()
    alice, bob = Wallet(), Wallet()
    chain.mine(alice.address)
    chain.submit(alice.sign(bob.address, 4, 1))
    waiting = dashboard(chain.snapshot(), valid=True, now=100)
    assert waiting['supply'] == 10
    assert waiting['volume'] == waiting['transfers'] == 0
    assert waiting['pending'] == 1 and waiting['pending_volume'] == 4
    assert waiting['holders'] == [{'address': alice.address, 'balance': 10, 'percent': 100}]
    monkeypatch.setattr('mithimbochain.blockchain.time.time', lambda: 160)
    chain.mine(bob.address)
    result = dashboard(chain.snapshot(), valid=True, now=200)
    assert result['supply'] == 20 and result['remaining'] == 9980
    assert result['volume'] == result['volume_24h'] == result['average_transfer'] == 4
    assert result['transfers'] == result['transfers_24h'] == 1
    assert result['active_addresses_24h'] == result['funded_addresses'] == 2
    assert result['pending'] == result['pending_volume'] == 0
    assert [item['balance'] for item in result['holders']] == [14, 6]
    assert result['top5_percent'] == 100
    assert result['median_block_seconds'] == 60
    assert result['history'] == [
        {'height': 1, 'volume': 0, 'transfers': 0, 'supply': 10},
        {'height': 2, 'volume': 4, 'transfers': 1, 'supply': 20},
    ]
    assert chain.balance(alice.address)['confirmed'] == 6


@pytest.mark.parametrize('now,expected', [(159, 0), (160, 4), (86560, 4), (86561, 0)])
def test_dashboard_24h_window_and_future_blocks(monkeypatch, now, expected):
    monkeypatch.setattr('mithimbochain.blockchain.time.time', lambda: 100)
    chain = Blockchain()
    alice, bob = Wallet(), Wallet()
    chain.mine(alice.address)
    chain.submit(alice.sign(bob.address, 4, 1))
    monkeypatch.setattr('mithimbochain.blockchain.time.time', lambda: 160)
    chain.mine(bob.address)
    result = dashboard(chain.snapshot(), valid=True, now=now)
    assert result['volume_24h'] == expected
    assert result['volume'] == 4
    assert result['future_blocks'] == (1 if now < 160 else 0)


def test_dashboard_history_is_bounded_but_totals_are_not(monkeypatch):
    monkeypatch.setattr('mithimbochain.blockchain.time.time', lambda: 100)
    chain = Blockchain()
    alice = Wallet()
    for _ in range(23):
        chain.mine(alice.address)
    result = dashboard(chain.snapshot(), valid=True, now=100)
    assert len(result['history']) == 20
    assert result['history'][0]['height'] == 4
    assert result['supply'] == result['history'][-1]['supply'] == 230
    assert result['median_block_seconds'] == 0
    assert result['volume'] == 0


def test_dashboard_route_is_read_only_and_integrated(tmp_path):
    app = create_app(tmp_path / 'chain.json', 'a' * 64)
    client = app.test_client()
    before = client.get('/api/chain').json
    data = client.get('/api/dashboard')
    assert data.status_code == 200
    assert data.json['valid'] and data.json['height'] == 0
    assert data.json['latest_hash'] == before['blocks'][0]['hash']
    assert client.get('/api/chain').json == before
    assert client.post('/api/dashboard', json={}).status_code in (401, 405)
    html = client.get('/').get_data(as_text=True)
    assert 'data-page="tableau-de-bord"' in html
    assert 'id="page-tableau-de-bord"' in html
    assert client.get('/assets/dashboard.mjs').status_code == 200
