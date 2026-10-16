"""Assembler l'extension locale ; aucun secret ni donnée utilisateur dans le ZIP."""
from pathlib import Path
import argparse
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = ('manifest.json', 'background.mjs', 'engine.mjs', 'provider.js', 'bridge.js',
         'popup.html', 'popup.css', 'popup.mjs', 'wallet.mjs', 'window-controller.mjs', 'sync.mjs')

def build(output):
    directory = ROOT / 'extension' / 'makutawallet'
    for name in ('wallet.mjs', 'sync.mjs'):
        shutil.copyfile(ROOT / 'web' / name, directory / name)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            source = directory / name
            if source.is_symlink():
                raise ValueError('Lien symbolique refusé dans le paquet')
            archive.write(source, 'makutawallet/' + name)
    return output

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Assembler MakutaWallet pour installation locale')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'makutawallet.zip')
    print(build(parser.parse_args().output))
