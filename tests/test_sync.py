import shutil
import subprocess
import pytest


def test_balance_synchronization_and_request_races():
    if not shutil.which('node'):
        pytest.skip('Node requis pour le contrôle des requêtes concurrentes')
    result = subprocess.run(['node', 'tests/sync_cases.mjs'], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert '# tests 8' in result.stdout
    assert '# pass 8' in result.stdout
