import argparse
import json
import os
from pathlib import Path
import secrets
from .protocol import ValidationError

def main():
    parser = argparse.ArgumentParser(description='MithimboChain — outils locaux')
    sub = parser.add_subparsers(dest='command', required=True)
    wallet = sub.add_parser('wallet'); wallet.add_argument('path')
    sign = sub.add_parser('sign')
    sign.add_argument('--wallet', required=True); sign.add_argument('--recipient', required=True)
    sign.add_argument('--amount', type=int, required=True); sign.add_argument('--nonce', type=int, required=True)
    serve = sub.add_parser('serve')
    serve.add_argument('--data', default='data/chain.json'); serve.add_argument('--port', type=int, default=5000)
    serve.add_argument('--token-file', default='data/api.token')
    args = parser.parse_args()
    try:
        if args.command in ('wallet', 'sign'):
            from .wallet import Wallet
            if args.command == 'wallet':
                target = Path(args.path)
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                wallet = Wallet(); wallet.save(target)
                print(json.dumps({'address': wallet.address, 'public_key': wallet.public_key}))
            else:
                tx = Wallet.load(args.wallet).sign(args.recipient, args.amount, args.nonce)
                print(json.dumps(tx, sort_keys=True))
        else:
            import fcntl
            from .api import create_app
            path = Path(args.data)
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            # Un processus serveur par fichier de chaîne.
            with open(str(path) + '.lock', 'a') as process_lock:
                try:
                    fcntl.flock(process_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    raise ValidationError(
                        'Un serveur MithimboChain utilise déjà ce fichier de chaîne. '
                        'Ouvrez son interface dans le navigateur ou arrêtez-le avec Ctrl+C '
                        'dans son terminal avant de relancer. Changer seulement le port '
                        'ne libère pas ce verrou.'
                    ) from None
                token_path = Path(args.token_file)
                token_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                if not token_path.exists():
                    fd = os.open(token_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(fd, 'w') as stream:
                        stream.write(secrets.token_hex(32))
                if token_path.stat().st_mode & 0o077:
                    raise ValidationError('Le fichier jeton doit être protégé (chmod 600)')
                token = token_path.read_text().strip()
                app = create_app(path, token)
                print(f'Interface : http://127.0.0.1:{args.port} — jeton local : {token_path}')
                app.run(host='127.0.0.1', port=args.port, debug=False, use_reloader=False, threaded=True)
    except (OSError, ValueError) as error:
        # Les erreurs de protocole ne contiennent pas de secrets ; les erreurs E/S restent génériques.
        parser.exit(1, (str(error) if isinstance(error, ValidationError) else 'Échec local : vérifier chemins, permissions et serveur déjà actif') + '\n')

if __name__ == '__main__':
    main()
