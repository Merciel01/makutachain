import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
import pytest
from mithimbochain.api import create_app


def test_extension_package_contains_only_runtime_files(tmp_path):
    output = tmp_path / 'wallet.zip'
    result = subprocess.run([sys.executable, 'scripts/build_makutawallet.py', '--output', str(output)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    with zipfile.ZipFile(output) as archive:
        paths = archive.namelist()
        assert len(paths) == 11
        assert all(p.startswith('makutawallet/') for p in paths)
        manifest = json.loads(archive.read('makutawallet/manifest.json'))
        assert manifest['manifest_version'] == 3
        assert archive.read('makutawallet/wallet.mjs') == Path('web/wallet.mjs').read_bytes()
        assert 'default_popup' not in manifest['action']
        for name in [manifest['background']['service_worker'], 'popup.html', 'window-controller.mjs']:
            assert 'makutawallet/' + name in paths


def test_extension_guide_is_served_without_private_api(tmp_path):
    client = create_app(tmp_path / 'chain.json', 't'*64).test_client()
    response = client.get('/makutawallet')
    assert response.status_code == 200
    assert 'chrome://extensions' in response.get_data(as_text=True)
    assert client.get('/api/private-key').status_code == 404
    assert client.get('/api/wallet').status_code == 404


def test_extension_security_suite():
    if not shutil.which('node'):
        pytest.skip('Node requis pour tester le moteur de l’extension')
    result = subprocess.run(['node', 'tests/test_extension.mjs'], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert '# tests 25' in result.stdout
    assert '# pass 25' in result.stdout

    fixture = next(line.split('# extension-fixture ', 1)[1] for line in result.stdout.splitlines() if '# extension-fixture ' in line)
    data = json.loads(fixture)
    from mithimbochain.transaction import validate_transfer
    from mithimbochain.blockchain import Blockchain
    assert validate_transfer(data['tx'])
    chain = Blockchain()
    chain.mine(data['tx']['sender'])
    chain.submit(data['tx'])
    chain.mine(data['bob'])
    assert chain.balance(data['tx']['sender'])['confirmed'] == 6
    assert chain.balance(data['bob'])['confirmed'] == 14
