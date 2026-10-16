"""API locale, sans création ou manipulation de clés privées."""
from pathlib import Path
from threading import RLock
import hmac
import secrets
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
from .blockchain import Blockchain
from .protocol import CHAIN_ID, DIFFICULTY, MAX_SUPPLY, ValidationError
from .storage import Storage

WEB = Path(__file__).resolve().parent.parent / 'web'

def create_app(storage_path='data/chain.json', token=None):
    if type(token) is not str or len(token) < 32:
        raise ValueError('Un jeton local de 32 caractères minimum est requis')
    app = Flask(__name__, static_folder=None)
    app.config['MAX_CONTENT_LENGTH'] = 32 * 1024
    storage = Storage(storage_path)
    state = {'chain': storage.load()}
    browser_capability = secrets.token_hex(32)
    lock = RLock()
    app.extensions['mithimbo_state'] = state

    @app.before_request
    def protect():
        host = request.host.split(':')[0]
        if host not in ('localhost', '127.0.0.1') or request.remote_addr not in ('127.0.0.1', '::1'):
            return jsonify(error={'code': 'local_only', 'message': 'Accès local requis'}), 403
        if request.method == 'POST':
            origin = request.headers.get('Origin')
            if origin and origin != request.host_url.rstrip('/'):
                return jsonify(error={'code': 'origin', 'message': 'Origine refusée'}), 403
            web_request = (origin == request.host_url.rstrip('/')
                           and request.headers.get('X-Mithimbo-Client') == 'web'
                           and request.headers.get('Sec-Fetch-Site', 'same-origin') == 'same-origin')
            if request.path == '/api/session':
                if not web_request or not request.is_json:
                    return jsonify(error={'code': 'origin', 'message': 'Ouvrez la session depuis le site local'}), 403
                return None
            supplied = request.headers.get('Authorization', '')
            cookie = request.cookies.get('mithimbo_session', '')
            cookie_authorized = web_request and hmac.compare_digest(
                cookie.encode('utf-8'), browser_capability.encode('utf-8'))
            if not cookie_authorized and not hmac.compare_digest(supplied.encode('utf-8'), ('Bearer ' + token).encode('utf-8')):
                return jsonify(error={'code': 'unauthorized', 'message': 'Jeton local requis'}), 401
            if not request.is_json:
                return jsonify(error={'code': 'json_required', 'message': 'JSON requis'}), 415

    @app.after_request
    def headers(response):
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Referrer-Policy'] = 'no-referrer'
        return response

    @app.errorhandler(ValidationError)
    def invalid(error):
        return jsonify(error={'code': 'invalid', 'message': str(error)}), 400

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error={'code': 'http_error', 'message': error.name}), error.code

    @app.errorhandler(Exception)
    def internal_error(error):
        # Ne pas journaliser les corps, jetons, clés ou traces d'exception.
        app.logger.error('Échec interne de traitement')
        return jsonify(error={'code': 'internal', 'message': 'Opération impossible'}), 500

    def body():
        data = request.get_json()
        if type(data) is not dict:
            raise ValidationError('Objet JSON requis')
        return data

    def change(operation):
        with lock:
            candidate = Blockchain.from_snapshot(state['chain'].snapshot())
            result = operation(candidate)
            storage.save(candidate)
            state['chain'] = candidate
            return result

    @app.post('/api/session')
    def browser_session():
        if body() != {}:
            raise ValidationError('Requête de session invalide')
        response = jsonify(connected=True)
        response.set_cookie('mithimbo_session', browser_capability, httponly=True,
                            samesite='Strict', secure=False, path='/api', max_age=28800)
        return response

    @app.get('/')
    def home():
        return send_from_directory(WEB, 'index.html')

    @app.get('/makutawallet')
    def wallet_guide():
        return send_from_directory(WEB, 'makutawallet.html')

    @app.get('/makutawallet/download')
    def wallet_download():
        return send_from_directory(WEB.parent / 'dist', 'makutawallet.zip', as_attachment=True)

    @app.get('/assets/<path:name>')
    def asset(name):
        if name not in ('app.js', 'style.css', 'wallet.mjs', 'interface.mjs', 'sync.mjs'):
            return jsonify(error={'code': 'not_found', 'message': 'Introuvable'}), 404
        return send_from_directory(WEB, name)

    @app.get('/api/chain')
    def chain():
        with lock:
            return jsonify(chain_id=CHAIN_ID, blocks=state['chain'].snapshot()['blocks'])

    @app.get('/api/blocks')
    def blocks():
        with lock:
            return jsonify(blocks=state['chain'].snapshot()['blocks'])

    @app.get('/api/blocks/<int:index>')
    def block(index):
        with lock:
            items = state['chain'].blocks
            if index >= len(items):
                return jsonify(error={'code': 'not_found', 'message': 'Bloc introuvable'}), 404
            return jsonify(items[index].to_dict())

    @app.get('/api/transactions')
    def transactions():
        with lock:
            snapshot = state['chain'].snapshot()
            return jsonify(pending=snapshot['mempool'], confirmed=[tx for b in snapshot['blocks'] for tx in b['transactions']])

    @app.post('/api/transactions')
    def submit():
        tx = body()
        result = change(lambda chain: chain.submit(tx))
        return jsonify(transaction=result), 201

    @app.get('/api/balance/<address>')
    def balance(address):
        with lock:
            chain = state['chain']
            return jsonify(**chain.balance(address), chain_id=CHAIN_ID,
                           height=len(chain.blocks)-1, latest_hash=chain.blocks[-1].hash)

    @app.post('/api/mine')
    def mine():
        data = body()
        if set(data) != {'recipient'}:
            raise ValidationError('Seul recipient est accepté')
        result = change(lambda chain: chain.mine(data['recipient']).to_dict())
        return jsonify(block=result), 201

    @app.get('/api/validate')
    def validate():
        with lock:
            return jsonify(valid=state['chain'].validate())

    @app.get('/api/stats')
    def stats():
        with lock:
            chain = state['chain']
            return jsonify(chain_id=CHAIN_ID, height=len(chain.blocks)-1, latest_hash=chain.blocks[-1].hash,
                           circulating=chain.supply, max_supply=MAX_SUPPLY, pending=len(chain.mempool.transactions),
                           unit='1 unité = 1 MTC', difficulty=DIFFICULTY, mode='prototype local')
    return app
