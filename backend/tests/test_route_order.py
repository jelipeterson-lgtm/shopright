import itertools
import math
import random

from route_order import EXACT_LIMIT, path_minutes, plan_route, shortest_order, total_minutes

HOME = (45.5236, -122.7830)  # NW Leahy Rd, Cedar Mill
# Kelsey's stores on 10/08/26: (name, lat, lon, vendors)
STORES = [
    ("Costco #111 Tigard", 45.4307473, -122.771933, 2),
    ("Costco #9 Aloha", 45.4942838, -122.867045, 1),
    ("Fred Meyer #225 Salem", 44.9682627, -123.0300801, 1),
    ("Costco #1492 Salem", 44.8834041, -123.0081722, 1),
    ("Costco #682 Albany", 44.6391755, -123.0685835, 1),
]


def miles(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


def matrix(points, start, end):
    """drive[(origin, dest)] in minutes: origins [start]+points, destinations points+[end]."""
    origins = [start] + points
    dests = points + [end]
    return {(i, j): miles(o, d) * 2.0 for i, o in enumerate(origins) for j, d in enumerate(dests)}


def earnings(vendors):
    return 50 + 15 * (vendors - 1)


def minutes(vendors):
    return 20 + 7.5 * (vendors - 1)


def brute_force(n, drive):
    return min(itertools.permutations(range(n)), key=lambda p: path_minutes(list(p), drive, n))


def test_kelseys_route_no_longer_backtracks_from_home():
    points = [(lat, lon) for _, lat, lon, _ in STORES]
    drive = matrix(points, HOME, HOME)
    order, overflow = plan_route(
        [earnings(v) for *_, v in STORES], [minutes(v) for *_, v in STORES], drive
    )
    assert overflow == []
    assert path_minutes(order, drive, 5) == path_minutes(list(brute_force(5, drive)), drive, 5)
    # The old optimizer went Tigard -> back to Aloha -> Salem; the first stop is now Aloha,
    # the closest store, with Tigard picked up on the loop instead of a zig-zag.
    assert order[0] == 1
    old_order = [0, 1, 2, 3, 4]  # what the app planned on 10/08/26
    assert path_minutes(old_order, drive, 5) - path_minutes(order, drive, 5) > 10


def test_starting_at_a_store_gives_the_same_order_as_starting_at_home_would_after_it():
    points = [(lat, lon) for _, lat, lon, _ in STORES]
    drive = matrix(points, HOME, HOME)
    order = shortest_order(range(5), drive, 5)
    assert path_minutes(order, drive, 5) == min(
        path_minutes(list(p), drive, 5) for p in itertools.permutations(range(5))
    )


def test_more_vendors_does_not_pull_a_store_out_of_geographic_order():
    # A 4-vendor store far north must not be visited first when the route runs south.
    points = [(45.60, -122.70), (45.40, -122.70), (45.30, -122.70)]
    drive = matrix(points, (45.45, -122.70), (45.25, -122.70))
    order, _ = plan_route([95, 50, 50], [42.5, 20, 20], drive)
    assert path_minutes(order, drive, 3) == path_minutes(list(brute_force(3, drive)), drive, 3)


def test_exact_matches_brute_force_on_random_asymmetric_matrices():
    rng = random.Random(7)
    for n in range(1, 8):
        for _ in range(5):
            drive = {(i, j): rng.uniform(1, 60) for i in range(n + 1) for j in range(n + 1)}
            got = shortest_order(range(n), drive, n)
            assert sorted(got) == list(range(n))
            assert math.isclose(path_minutes(got, drive, n),
                                path_minutes(list(brute_force(n, drive)), drive, n))


def test_large_lists_use_heuristic_and_visit_everything_once():
    rng = random.Random(3)
    n = EXACT_LIMIT + 8
    points = [(45 + rng.random(), -123 + rng.random()) for _ in range(n)]
    drive = matrix(points, HOME, HOME)
    order = shortest_order(range(n), drive, n)
    assert sorted(order) == list(range(n))
    # Never worse than plain nearest-neighbour.
    nn, here, left = [], 0, list(range(n))
    while left:
        nxt = min(left, key=lambda s: drive[(here, s)])
        nn.append(nxt)
        left.remove(nxt)
        here = nxt + 1
    assert path_minutes(order, drive, n) <= path_minutes(nn, drive, n) + 1e-9


def test_time_window_keeps_route_inside_it_and_lists_the_rest_as_overflow():
    points = [(lat, lon) for _, lat, lon, _ in STORES]
    drive = matrix(points, HOME, HOME)
    earn = [earnings(v) for *_, v in STORES]
    mins = [minutes(v) for *_, v in STORES]
    order, overflow = plan_route(earn, mins, drive, max_minutes=150)
    assert total_minutes(order, drive, 5, mins) <= 150
    assert sorted(order + overflow) == list(range(5))
    assert overflow  # the whole day does not fit in 2.5 hours
    assert 4 in overflow  # Albany, the farthest stop, is the first to go


def test_window_too_small_for_anything():
    drive = {(0, 0): 30, (1, 1): 30}
    assert plan_route([50], [20], drive, max_minutes=10) == ([], [0])


def test_no_stores():
    assert plan_route([], [], {}) == ([], [])
