---
title: Network benchmarking
description: How to benchmark quicz over a real network (cross-host, lossy, congested)
---

Guidance for benchmarking quicz over a real network (cross-host, lossy,
congested) rather than the loopback measurements on the [performance](/performance/)
page. These runs require Linux hosts and are executed outside the loopback
environment. Mirrors the repo's
[network-benchmark.md](https://github.com/venjiang/quicz/blob/main/docs/en/network-benchmark.md).

## Tools

| Tool | Purpose |
| --- | --- |
| `examples/multi_client_bench.zig` (`run-multi-client-bench`) | N concurrent clients vs one server: handshake latency + aggregate throughput |
| `examples/quic_bench_hs.zig` (`run-quic-bench-hs`) | Real-handshake throughput + echo latency |
| `tc` / `netem` (Linux) | Emulate packet loss, delay, jitter, bandwidth |
| `iperf3` | Sanity-check raw TCP/UDP link capacity for fair comparison |

Build in **ReleaseFast** — the Debug build is a measurement artifact (compiler
codegen, not library logic):

```bash
zig build -Doptimize=ReleaseFast
zig build run-multi-client-bench -Doptimize=ReleaseFast
```

## Cross-host: client on host A, server on host B

The server listens on loopback by default. To accept remote clients, bind all
interfaces:

```zig
var server = try Server.init(allocator, io, .{
    .port = 4433,
    .alpn = &.{"hq-interop"},
    .cert_der = &certificate_der,
    .private_key = &server_private_key,
    .bind_addr = .{0, 0, 0, 0},   // listen on all interfaces
});
```

Host B (server): `zig build run-io-echo -Doptimize=ReleaseFast` (or
`run-h3-server` for H3). Host A (client) points `Client.Config.server_host` at
B's IP:

```zig
var client = try Client.init(allocator, io, .{
    .server_host = .{ 10, 0, 0, 2 },   // host B
    .server_port = 4433,
    .server_name = "host-b",
    .alpn = &.{"hq-interop"},
});
```

> **Linux x86_64**: use an **RSA certificate** (Zig 0.16 `std.crypto` has a
> known codegen bug for P-256/P-384/Ed25519 signature verification on x86_64).

## Docker cross-host validation (validated 2026-08-08)

Two quicz Linux containers on the same Docker bridge network act as separate
hosts (distinct network namespaces, real non-loopback path):

```bash
zig build-exe -target x86_64-linux-musl --dep quicz \
    -Mroot=examples/multi_client_bench.zig -Mquicz=src/lib.zig \
    -OReleaseFast -lc --name qmc-bench-x64

docker run -d --name bench-server --network bridge --entrypoint sleep <img> infinity
docker run -d --name bench-client --network bridge --entrypoint sleep <img> infinity
docker cp qmc-bench-x64 bench-server:/root/ && docker cp qmc-bench-x64 bench-client:/root/

docker exec -d bench-server /root/qmc-bench-x64 server
docker exec bench-client /root/qmc-bench-x64 client <bench-server-IP>
```

Validated (2 containers, Linux x86_64, ReleaseFast, ECDSA cert):

```
multi-client bench: ok=8/8 avg_connect=320 ms  aggregate=1.1 Mbit/s (host=192.168.215.2)
```

8/8 concurrent cross-host handshakes + echo succeed. The low aggregate reflects
the container bridge network (small cwnd × handshake RTT + docker's software
forwarding), not a protocol defect — re-run on bare metal for production numbers.

## Emulating loss / delay / congestion with netem

`tc` / `netem` shape the egress interface:

```bash
# 10 ms one-way delay, 1% loss, 4 MB/s bandwidth
tc qdisc add dev eth0 root netem delay 10ms loss 1% rate 4mbit
tc qdisc del dev eth0 root   # reset
```

Under 1% loss quicz recovers (8/8 concurrent cross-host handshakes complete);
`error.UnknownConnectionId` lines are server-side retransmissions toward a
reaped/unknown connection — the connection still completes. The 5%-loss +
20 ms case is bounded by the benchmark's lack of a per-client handshake timeout,
not a protocol defect.

### Loss vs recovery

```bash
for loss in 0 0.5 1 3 5; do
    tc qdisc add dev eth0 root netem loss "${loss}%"
    zig build run-quic-bench-hs -Doptimize=ReleaseFast 2>&1 | tee /tmp/hs_loss${loss}.log
    tc qdisc del dev eth0 root
done
```

### Delay-bound RTT

With a fixed delay, aggregate throughput is bounded by `cwnd / RTT`. Raise
`initial_max_data` / `initial_max_stream_data` and let the congestion window
grow.

## Multi-client concurrency (cross-host)

```bash
zig build run-multi-client-bench -Doptimize=ReleaseFast
```

Loopback reference:

```
multi-client bench: ok=8/8 avg_connect=3 ms  aggregate=628.6 Mbit/s
```

Across a real network, `avg_connect` becomes RTT-bound (≈1.5× RTT for the
handshake) and aggregate reflects the path's `cwnd/RTT` limits.

## Recording results

Log each run with platform + commit metadata, mirroring the loopback suite's
`bench_results/<UTC timestamp>_<commit>.log` convention:

```bash
BENCH_DIR=bench_results/$(date -u +%Y%m%dT%H%M%SZ)_$(git rev-parse --short HEAD)
mkdir -p "$BENCH_DIR"
```

## Checklist before trusting a number

1. Build `-Doptimize=ReleaseFast` (never Debug).
2. Sanity-check the raw path with `iperf3`; quicz should land within a
   reasonable factor of the link's UDP/TCP ceiling per connection.
3. On Linux x86_64 use an RSA certificate.
4. Disable competing traffic; pin CPUs if comparing across runs.
5. Report loss/delay/RTT explicitly — "throughput" is meaningless without the
   path attributes.