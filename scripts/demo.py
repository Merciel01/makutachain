"""Démonstration isolée : aucune clé privée n'est écrite dans le projet."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from mithimbochain.api import create_app
from mithimbochain.blockchain import Blockchain
from mithimbochain.protocol import ValidationError
from mithimbochain.storage import Storage
from mithimbochain.wallet import Wallet

def demo():
    with TemporaryDirectory(prefix='mithimbo-demo-') as directory:
        path=Path(directory)/'chain.json'
        token='demonstration-only-token-00000000000000000000'
        client=create_app(path,token).test_client()
        headers={'Authorization':'Bearer '+token}
        alice,bob=Wallet(),Wallet()
        def post(route,data):
            response=client.post(route,json=data,headers=headers)
            assert response.status_code==201,(response.status_code,response.json)
        post('/api/mine',{'recipient':alice.address})
        post('/api/transactions',alice.sign(bob.address,4,1))
        post('/api/mine',{'recipient':bob.address})
        assert client.get('/api/balance/'+alice.address).json['confirmed']==6
        assert client.get('/api/balance/'+bob.address).json['confirmed']==14
        persisted=Storage(path).load();assert persisted.validate()
        modified=persisted.snapshot();modified['blocks'][1]['transactions'][0]['amount']=9999
        try:
            Blockchain.from_snapshot(modified)
        except ValidationError:
            rejected=True
        else:
            raise AssertionError('Falsification acceptée')
        return {'alice':client.get('/api/balance/'+alice.address).json,
                'bob':client.get('/api/balance/'+bob.address).json,
                'stats':client.get('/api/stats').json,'restart_valid':True,'tampering_rejected':rejected}

if __name__=='__main__':
    print(json.dumps(demo(),ensure_ascii=False,indent=2))
