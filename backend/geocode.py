"""Address -> (lat, lon) for the Route Planner.

HERE (the key the optimizer already uses) is tried first; Nominatim is the fallback.
Nominatim alone failed intermittently from Render's shared IPs, which showed shoppers
"Could not geocode start address" for addresses that had worked before.
"""
import os
import re
import threading
from collections import OrderedDict

from db import outbound

NOMINATIM_UA = "ShopRight/1.0 (shopright-api.onrender.com)"
_CACHE_MAX = 512
_cache = OrderedDict()
_lock = threading.Lock()


def _key(address):
    return re.sub(r"[\s,]+", " ", address).strip().lower()


def _parse_latlon(address):
    """A "lat,lon" string (GPS start) needs no lookup."""
    parts = address.split(",")
    if len(parts) != 2:
        return None
    try:
        lat, lon = float(parts[0].strip()), float(parts[1].strip())
    except ValueError:
        return None
    if -90 <= lat <= 90 and -180 <= lon <= 180:
        return lat, lon
    return None


def _here(address):
    key = os.environ.get("HERE_API_KEY")
    if not key:
        return None
    try:
        r = outbound.get(
            "https://geocode.search.hereapi.com/v1/geocode",
            params={"q": address, "in": "countryCode:USA,CAN", "limit": 1, "apiKey": key},
            timeout=10,
        )
        if r.status_code != 200:
            print(f"[geocode] HERE status={r.status_code}")
            return None
        items = r.json().get("items") or []
        if items:
            pos = items[0]["position"]
            return float(pos["lat"]), float(pos["lng"])
    except Exception as e:
        print(f"[geocode] HERE error: {type(e).__name__}")
    return None


def _nominatim(address):
    try:
        r = outbound.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1, "countrycodes": "us,ca"},
            headers={"User-Agent": NOMINATIM_UA},
            timeout=10,
        )
        if r.status_code != 200:
            print(f"[geocode] Nominatim status={r.status_code}")
            return None
        results = r.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"[geocode] Nominatim error: {type(e).__name__}")
    return None


def geocode(address):
    """Return (lat, lon) or None. Successful lookups are cached for the process."""
    if not address or not address.strip():
        return None
    direct = _parse_latlon(address)
    if direct:
        return direct
    k = _key(address)
    with _lock:
        if k in _cache:
            _cache.move_to_end(k)
            return _cache[k]
    result = _here(address) or _nominatim(address)
    if result:
        with _lock:
            _cache[k] = result
            while len(_cache) > _CACHE_MAX:
                _cache.popitem(last=False)
    return result
