"""Unit tests run without a database or network: settings read at import time get harmless values."""
import os

for key, value in {"MONGO_URL": "mongodb://127.0.0.1:1", "DB_NAME": "assemble_test", "JWT_SECRET": "test-secret",
                   "DEMO_PASSWORD": "test-demo"}.items():
    os.environ.setdefault(key, value)
