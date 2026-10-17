# ShopRight API memory

The API runs on Render Starter, which kills the process at 512 MB (exit 143).

## What was using the memory

`PUT /visits` is the autosave path. Every authenticated request calls `get_user_id`, and that used `httpx.get()`. The httpx helpers construct a **new** `httpx.Client` per call. Each client loads the CA bundle into a new SSL context, about **0.7 MB**, and the client, pool, and context form a reference cycle.

During a shopping session those cycles sit in generation 2. Automatic collection does not keep up with autosave, and while the objects are still referenced `malloc_trim` returns almost nothing. RSS therefore climbs about 0.7 MB per save and stays there through quiet gaps. On Oct 15 2026 it went from about 90 MB to the 512 MB limit between 11:45 AM and 1:30 PM PT, under roughly one request per second of `PUT /visits`, with only 3 threads. The keep-alive log freed 0.1–0.5 MB on each trim while RSS was 160–510 MB. After the shopper stopped, a later trim returned ~179 MB in one shot — the memory was uncollected garbage, not a pool that had to stay.

Measured with garbage collection suspended, 3000 real `PUT /visits` through FastAPI (auth and PostgREST pointed at a local TLS stub). Collection is suspended so a tight loop cannot hide the leak the way production does not collect in time. Each new-code request uses a distinct token, so the auth cache cannot skip the network call.

| | start | end | after gc + trim | requests | elapsed |
|---|---:|---:|---:|---:|---:|
| Old (`httpx.get` per request) | 61.1 MB | 2295.3 MB | 172.9 MB | 3000 | 203.9 s |
| New (shared client) | 68.8 MB | 215.1 MB | 198.4 MB | 3000 | 16.8 s |

The old slope is 0.745 MB/request, the same as production. The new slope is 0.049 MB/request (146.4 MB across 3000 saves) while collection is off: ordinary request and JSON objects, plus glibc arena fragmentation. `gc.collect()` and `malloc_trim` only brought RSS back to 198.4 MB. A separate tracemalloc of 800 saves showed the Python heap barely moved — the 256-entry token cache was the largest delta, about 43 KiB — so the resident remainder is allocator fragmentation, not another client per request. With collection left on, the process plateaus after warmup. The regression test allows 250 MB of growth with collection off, which the old client fails before 500 requests and this run (146 MB) passes.

The Oct 3 HTTP/2 fix (one Supabase client, HTTP/1, no 430 MB self-kill) addressed a different leak. This one is the per-request client in token verification, plus the same pattern in geocoding, route matrix calls, template download, and the Anthropic call.

## What the code does now

- One process-wide `httpx.Client` (`db.outbound`), created on first use, closed on shutdown.
- Successful token checks are reused for 3 minutes, never past the token's own `exp`, and the cache is capped at 256 entries. Failures are not cached.
- The assessment page waits ~2.5 seconds after the last edit before saving, and flushes on blur, navigation, hide, and submit, so a shopping day no longer sends a PUT per keystroke.

## Optional: `MALLOC_ARENA_MAX=2`

**Not set by this change.** Do not add it to the repo or to a deploy script. If a shopping day still climbs after this fix, Eli can set it on the `shopright-api` service in the Render dashboard (Environment → `MALLOC_ARENA_MAX` = `2`) and redeploy once so the process picks it up.

glibc gives each thread its own malloc arena, up to 8 per CPU by default. Freed blocks stay in the arena that allocated them, so `malloc_trim` — which the keep-alive already calls — often cannot return pages to the OS even after Python has dropped the objects. On the fixed code, 3000 saves with collection suspended grew RSS by 146 MB, and a full `gc.collect()` plus `malloc_trim` only brought it back to 198 MB from a 69 MB start. tracemalloc showed almost no Python heap growth, so that remainder is fragmentation. Capping arenas at 2 makes freed memory reusable across the process and makes `malloc_trim` effective. It does not remove a live leak, and it would not have stopped the Oct 15 climb on its own: those SSL clients were still referenced, which is why trim freed a fraction of a megabyte until a later collection. Two arenas is the usual value for a small Python service on a 512 MB instance.
