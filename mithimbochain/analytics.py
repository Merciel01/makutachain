"""Indicateurs publics calculés depuis un instantané unique de la chaîne."""
from statistics import median
import time

from .protocol import MAX_SUPPLY

def dashboard(snapshot, *, valid, now=None):
    now = int(time.time()) if now is None else int(now)
    blocks = snapshot['blocks']
    pending = snapshot['mempool']
    accounts, recent_addresses, history = {}, set(), []
    supply = transfers = volume = recent_volume = recent_count = future_blocks = 0
    mined = [block for block in blocks if block['index'] > 0]
    for block in blocks:
        count = amount = 0
        recent = block['index'] > 0 and now - 86400 <= block['timestamp'] <= now
        if block['index'] > 0 and block['timestamp'] > now:
            future_blocks += 1
        for tx in block['transactions']:
            recipient = tx['recipient']
            accounts[recipient] = accounts.get(recipient, 0) + tx['amount']
            if tx['kind'] == 'reward':
                supply += tx['amount']
            else:
                accounts[tx['sender']] = accounts.get(tx['sender'], 0) - tx['amount']
                transfers += 1
                volume += tx['amount']
                count += 1
                amount += tx['amount']
                if recent:
                    recent_addresses.update((tx['sender'], recipient))
                    recent_volume += tx['amount']
                    recent_count += 1
        if block['index'] > 0:
            history.append({'height': block['index'], 'volume': amount,
                            'transfers': count, 'supply': supply})
    funded = sorted(((address, balance) for address, balance in accounts.items() if balance > 0),
                    key=lambda item: (-item[1], item[0]))
    intervals = [right['timestamp'] - left['timestamp']
                 for left, right in zip(mined, mined[1:])]
    return {
        'as_of': now, 'valid': bool(valid),
        'height': blocks[-1]['index'], 'latest_hash': blocks[-1]['hash'],
        'latest_timestamp': mined[-1]['timestamp'] if mined else None,
        'future_blocks': future_blocks,
        'supply': supply, 'max_supply': MAX_SUPPLY,
        'remaining': MAX_SUPPLY - supply,
        'emission_percent': supply * 100 / MAX_SUPPLY,
        'transfers': transfers, 'volume': volume,
        'average_transfer': volume / transfers if transfers else None,
        'volume_24h': recent_volume, 'transfers_24h': recent_count,
        'active_addresses_24h': len(recent_addresses),
        'funded_addresses': len(funded),
        'pending': len(pending), 'pending_capacity': 100,
        'pending_volume': sum(tx['amount'] for tx in pending),
        'median_block_seconds': median(intervals) if intervals else None,
        'top5_percent': sum(balance for _, balance in funded[:5]) * 100 / supply if supply else None,
        'holders': [{'address': address, 'balance': balance,
                     'percent': balance * 100 / supply} for address, balance in funded[:5]],
        'history': history[-20:],
    }
