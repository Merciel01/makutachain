import json
import subprocess
import sys
from mithimbochain.wallet import Wallet
from mithimbochain.transaction import validate_transfer

def run(*args):
    return subprocess.run([sys.executable,'-m','mithimbochain',*args],capture_output=True,text=True)

def test_cli_wallet_and_sign(tmp_path):
    path=tmp_path/'alice.key'
    result=run('wallet',str(path))
    assert result.returncode==0
    public=json.loads(result.stdout)
    assert set(public)=={'address','public_key'}
    result=run('sign','--wallet',str(path),'--recipient',Wallet().address,'--amount','4','--nonce','1')
    assert result.returncode==0
    assert validate_transfer(json.loads(result.stdout))
    assert 'private_key' not in result.stdout
    before=path.read_bytes()
    assert run('wallet',str(path)).returncode==1
    assert path.read_bytes()==before

def test_cli_invalid_amount(tmp_path):
    path=tmp_path/'alice.key';assert run('wallet',str(path)).returncode==0
    result=run('sign','--wallet',str(path),'--recipient',Wallet().address,'--amount','0','--nonce','1')
    assert result.returncode==1
    assert 'Traceback' not in result.stderr

def test_cli_explains_active_server(tmp_path):
    import fcntl
    path = tmp_path / 'chain.json'
    with open(str(path) + '.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = run('serve', '--data', str(path))
    assert result.returncode == 1
    assert 'utilise déjà ce fichier de chaîne' in result.stderr
    assert 'Changer seulement le port' in result.stderr
    assert 'Traceback' not in result.stderr
