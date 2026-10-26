"""Outbound HTTPS must not trust the eMudhra/emSign roots compromised in Oct 2026."""
import certifi

from routers.payments import _stripe


def _version(v):
    return tuple(int(x) for x in v.split("."))


def test_certifi_is_patched():
    assert _version(certifi.__version__) >= (2026, 10, 19)


def test_stripe_uses_certifi_bundle():
    assert _stripe().ca_bundle_path == certifi.where()
