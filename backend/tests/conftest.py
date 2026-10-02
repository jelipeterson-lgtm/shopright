import os
import sys

# db.py builds a Supabase client at import time; it only needs well-formed values, never connects.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test.service.key")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
