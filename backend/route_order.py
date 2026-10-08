"""Stop ordering for the Route Planner (pure logic, no I/O).

Matrix convention (matches routers/route.py): origin 0 is the start, origin k+1 is store k;
destination k is store k, destination n is the end. drive[(origin, dest)] is minutes.

Every stop in the route is paid regardless of order, so the best hourly rate is the order with
the least total drive time from start, through every stop, to the end.
"""

UNREACHABLE = 9999
EXACT_LIMIT = 12  # Held-Karp is exact and fast up to here; larger lists use 2-opt


def _leg(drive, origin, dest):
    return drive.get((origin, dest), UNREACHABLE)


def path_minutes(order, drive, n):
    """Drive minutes for start -> order... -> end."""
    if not order:
        return 0
    total = _leg(drive, 0, order[0])
    for a, b in zip(order, order[1:]):
        total += _leg(drive, a + 1, b)
    return total + _leg(drive, order[-1] + 1, n)


def _exact(stops, drive, n):
    k = len(stops)
    full = (1 << k) - 1
    inf = float("inf")
    cost = [[inf] * k for _ in range(1 << k)]
    prev = [[-1] * k for _ in range(1 << k)]
    for i in range(k):
        cost[1 << i][i] = _leg(drive, 0, stops[i])
    for mask in range(1, full + 1):
        row = cost[mask]
        for last in range(k):
            c = row[last]
            if c == inf:
                continue
            origin = stops[last] + 1
            for nxt in range(k):
                bit = 1 << nxt
                if mask & bit:
                    continue
                nc = c + _leg(drive, origin, stops[nxt])
                if nc < cost[mask | bit][nxt]:
                    cost[mask | bit][nxt] = nc
                    prev[mask | bit][nxt] = last
    best_last = min(range(k), key=lambda i: cost[full][i] + _leg(drive, stops[i] + 1, n))
    order, mask, last = [], full, best_last
    while last != -1:
        order.append(stops[last])
        mask, last = mask ^ (1 << last), prev[mask][last]
    return order[::-1]


def _heuristic(stops, drive, n):
    order, here, left = [], 0, list(stops)
    while left:
        nxt = min(left, key=lambda s: _leg(drive, here, s))
        order.append(nxt)
        left.remove(nxt)
        here = nxt + 1
    best = path_minutes(order, drive, n)
    improved = True
    while improved:
        improved = False
        for i in range(len(order) - 1):
            for j in range(i + 1, len(order)):
                cand = order[:i] + order[i:j + 1][::-1] + order[j + 1:]
                c = path_minutes(cand, drive, n)
                if c < best - 1e-9:
                    order, best, improved = cand, c, True
    return order


def shortest_order(stops, drive, n):
    """Order the given store indices for the least total drive time."""
    stops = list(stops)
    if len(stops) <= 1:
        return stops
    if len(stops) <= EXACT_LIMIT:
        return _exact(stops, drive, n)
    return _heuristic(stops, drive, n)


def total_minutes(order, drive, n, est_minutes):
    return path_minutes(order, drive, n) + sum(est_minutes[i] for i in order)


def plan_route(earnings, est_minutes, drive, max_minutes=None):
    """Return (route, overflow): store indices to visit in order, and those that don't fit."""
    n = len(earnings)
    everything = list(range(n))
    order = shortest_order(everything, drive, n)
    if max_minutes is None or total_minutes(order, drive, n, est_minutes) <= max_minutes:
        return order, []

    # Too much for the time window: drop the stop that pays least per minute it costs,
    # re-ordering after each drop, until the rest fits.
    keep = everything
    while keep:
        order = shortest_order(keep, drive, n)
        if total_minutes(order, drive, n, est_minutes) <= max_minutes:
            break
        full = total_minutes(order, drive, n, est_minutes)

        def value(i):
            without = [s for s in order if s != i]
            saved = full - total_minutes(without, drive, n, est_minutes)
            return earnings[i] / max(saved, 1)

        drop = min(order, key=value)
        keep = [s for s in keep if s != drop]
    else:
        order = []
    kept = set(order)
    return order, [i for i in everything if i not in kept]
