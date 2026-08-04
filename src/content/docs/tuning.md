---
title: Production tuning
description: Recommended ConnectionConfig values for deploying quicz in production
---

Recommended configuration for deploying quicz in production. All parameters are
set via `ConnectionConfig` (`src/quic/connection_config.zig`). Mirrors the repo's
[production_tuning.md](https://github.com/venjiang/quicz/blob/main/docs/en/production_tuning.md).

## Quick reference

| Parameter | Default | Recommended (production) | Notes |
| --- | --- | --- | --- |
| `pto_jitter_percentage` | 0 | 20–30 | Prevents synchronized PTO timeouts across many concurrent connections. Range 0–50; enable for servers with 100+ connections. |
| `congestion_algorithm` | `.new_reno` | `.cubic` | CUBIC (RFC 9438) with HyStart++ gives better throughput on high-BDP paths. |
| `initial_rtt_ns` | 333 ms | per environment | Data center 1–5 ms; WAN 50–100 ms. Lower values speed initial window growth. |
| `max_ack_delay_ns` | 25 ms | 25 ms | RFC 9000 default; do not change unless the peer negotiates differently. |

## PTO jitter

PTO jitter adds ±percentage random variation to the base Probe Timeout before
exponential backoff, decorrelating timeout storms when many connections share a
path (behind a NAT or load balancer).

- **0% (default)** — deterministic PTO; fine for single connections and tests.
- **20–30% (servers)** — breaks synchronization without meaningfully delaying recovery.
- **50% (max)** — aggressive; may delay recovery on lossy paths.

The result is clamped to the RFC 9002 kGranularity floor (1 ms).

```zig
var conn = try Connection.init(allocator, .server, .{
    .congestion_algorithm = .cubic,
    .pto_jitter_percentage = 25,
    .initial_rtt_ns = 5_000_000, // 5 ms for a data center
});
```

## Congestion control

### CUBIC + HyStart++ (recommended)

quicz's CUBIC (RFC 9438) includes:

- **HyStart++ slow start** — monitors RTT increases to exit slow start early (Conservative Slow Start, ÷4 growth, ≤5 rounds).
- **Fast retransmission** — immediate retransmit on a congestion event, no PTO wait.
- **App-limited detection (RFC 8312 §5.8)** — excludes app-limited periods from the CUBIC epoch; 3×MTU threshold avoids loopback false positives.
- **PTO jitter** — optional randomized PTO (above).

### NewReno

The default. Simpler but less efficient on high-bandwidth, high-latency paths;
fine for low-throughput control channels.

### BBR

Removed in 2026-08 in favor of CUBIC (the repo guide predates the removal and
still describes BBR as "available but not hardened"). Use CUBIC for production.

## Initial RTT

| Environment | Recommended `initial_rtt_ns` |
| --- | --- |
| Data center (same rack) | 100_000–500_000 (0.1–0.5 ms) |
| Data center (cross-rack) | 1_000_000–5_000_000 (1–5 ms) |
| Metro / CDN edge | 10_000_000–30_000_000 (10–30 ms) |
| WAN / intercontinental | 50_000_000–150_000_000 (50–150 ms) |
| Unknown / public internet | 333_000_000 (333 ms, default) |

## Related

- [Feature comparison](/comparisons/) — capability matrix vs other QUIC stacks.
- [Performance](/performance/) — throughput and latency numbers.
- [Architecture](/architecture/) — module layout and design decisions.
