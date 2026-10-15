import json
import os
import tempfile
from pathlib import Path
from .blockchain import Blockchain
from .protocol import canonical, ValidationError

class Storage:
    def __init__(self, path):
        self.path = Path(path)

    def load(self):
        if not self.path.exists():
            return Blockchain()
        if self.path.stat().st_size > 64 * 1024 * 1024:
            raise ValidationError("Stockage trop volumineux")
        try:
            return Blockchain.from_snapshot(json.loads(self.path.read_text(encoding="utf-8")))
        except (ValueError, TypeError, KeyError, OverflowError, RecursionError):
            raise ValidationError("Stockage corrompu ou chaîne invalide") from None

    def save(self, chain):
        chain.validate()
        data = canonical(chain.snapshot())
        if len(data) > 64 * 1024 * 1024:
            raise ValidationError("Stockage trop volumineux")
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd, temp = tempfile.mkstemp(prefix=".chain-", dir=self.path.parent)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp, self.path)
            directory = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
