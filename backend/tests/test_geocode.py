import pytest

import geocode as g


class Resp:
    def __init__(self, status, data):
        self.status_code = status
        self._data = data

    def json(self):
        return self._data


class FakeOutbound:
    def __init__(self, here=None, nominatim=None):
        self.here = here
        self.nominatim = nominatim
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append(url)
        if "hereapi" in url:
            if isinstance(self.here, Exception):
                raise self.here
            return self.here
        if isinstance(self.nominatim, Exception):
            raise self.nominatim
        return self.nominatim


HERE_OK = Resp(200, {"items": [{"position": {"lat": 40.58, "lng": -105.11}}]})
NOM_OK = Resp(200, [{"lat": "40.5", "lon": "-105.0"}])
ADDR = "2424 W Mulberry St Fort Collins, CO 80521"


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    g._cache.clear()
    monkeypatch.setenv("HERE_API_KEY", "test-key")


def use(monkeypatch, fake):
    monkeypatch.setattr(g, "outbound", fake)
    return fake


def test_here_is_used_first(monkeypatch):
    fake = use(monkeypatch, FakeOutbound(here=HERE_OK, nominatim=NOM_OK))
    assert g.geocode(ADDR) == (40.58, -105.11)
    assert len(fake.calls) == 1


def test_nominatim_blocked_still_geocodes_via_here(monkeypatch):
    use(monkeypatch, FakeOutbound(here=HERE_OK, nominatim=Resp(403, "<html>blocked</html>")))
    assert g.geocode(ADDR) == (40.58, -105.11)


@pytest.mark.parametrize("here", [Resp(401, {}), Resp(200, {"items": []}), TimeoutError()])
def test_falls_back_to_nominatim_when_here_fails(monkeypatch, here):
    use(monkeypatch, FakeOutbound(here=here, nominatim=NOM_OK))
    assert g.geocode(ADDR) == (40.5, -105.0)


def test_no_here_key_uses_nominatim(monkeypatch):
    monkeypatch.delenv("HERE_API_KEY")
    fake = use(monkeypatch, FakeOutbound(here=HERE_OK, nominatim=NOM_OK))
    assert g.geocode(ADDR) == (40.5, -105.0)
    assert all("hereapi" not in c for c in fake.calls)


def test_both_fail_returns_none_and_is_not_cached(monkeypatch):
    use(monkeypatch, FakeOutbound(here=Resp(500, {}), nominatim=Resp(429, "slow down")))
    assert g.geocode(ADDR) is None
    use(monkeypatch, FakeOutbound(here=HERE_OK, nominatim=NOM_OK))
    assert g.geocode(ADDR) == (40.58, -105.11)


def test_success_is_cached_regardless_of_spacing_and_case(monkeypatch):
    fake = use(monkeypatch, FakeOutbound(here=HERE_OK, nominatim=NOM_OK))
    g.geocode(ADDR)
    g.geocode("  2424 w mulberry st,  fort collins, co 80521 ")
    assert len(fake.calls) == 1


def test_gps_lat_lon_needs_no_lookup(monkeypatch):
    fake = use(monkeypatch, FakeOutbound())
    assert g.geocode("40.585, -105.084") == (40.585, -105.084)
    assert fake.calls == []


def test_blank_address(monkeypatch):
    use(monkeypatch, FakeOutbound())
    assert g.geocode("   ") is None
