---
title: Feature comparison
description: How quicz stacks up against quic-go, quiche, and s2n-quic, feature by feature
---

Updated 2026-07-27. Sources: project READMEs, source code inspection, RFC
compliance tracking. Mirrors the standalone
[feature_comparison.md](https://github.com/venjiang/quicz/blob/main/docs/en/feature_comparison.md).

| Feature | RFC | quic-go | quiche | s2n-quic | quicz | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| QUIC v1 transport | 9000 | ✅ | ✅ | ✅ | ✅ | — |
| QUIC v2 | 9369 | ✅ | ❌ | ❌ | ✅ | quiche/s2n-quic V1 only |
| TLS 1.3 | 9001 | ✅(Go crypto/tls) | ✅(BoringSSL) | ✅(s2n-tls/rustls) | ✅(pure Zig) | — |
| 0-RTT (early data) | 9001 | ✅ | ✅ | ✅ | ✅ | — |
| Loss detection & recovery | 9002 | ✅ | ✅ | ✅ | ✅ | — |
| Connection migration | 9000 | ✅ | ✅ | ✅ | ✅ | — |
| Path validation | 9000 | ✅ | ✅ | ✅ | ✅ | — |
| Retry + address validation | 9000 | ✅ | ✅ | ✅ | ✅ | — |
| Stateless reset | 9000 | ✅ | ✅ | ✅ | ✅ | — |
| Key update | 9001 | ✅ | ✅ | ✅ | ✅ | — |
| Version negotiation | 9368 | ✅ | ✅ | ✅ | ✅ | — |
| DATAGRAM extension | 9221 | ✅ | ✅ | ✅(unstable) | ✅ | — |
| Multipath | draft | ✅ | ❌ | ❌ | ✅ | — |
| ECN | 9000 | ✅ (rx only) | ✅ | ✅ | ✅ | quiche does not send ECN |
| PMTU discovery | 8899 | ✅ | ✅ | ✅ | ✅ | — |
| GSO/GRO | — | ✅ | ❌ | ✅ | ✅ | quiche defers to app-layer I/O |
| Connection pool | — | ✅ | ❌ | ❌ | ✅ | — |
| qlog | draft | ✅ | ✅(feature-gated) | ❌(event subscriber) | ✅ | — |
| Fuzz targets | — | ✅(OSS-Fuzz) | ✅ | ✅ | ✅ | — |
| NewReno | 9002 | ✅ | ✅ | ❌ | ✅ | s2n-quic: CUBIC+BBR only |
| CUBIC | 9438 | ✅ | ✅ | ✅ | ✅ | — |
| BBR | — | ✅ | ✅ | ✅ | ✅ | — |
| Packet pacing | 9002 | ✅ | ✅ | ✅ | ✅ | — |
| AES-128-GCM | 9001 | ✅ | ✅ | ✅ | ✅ | — |
| AES-256-GCM | 9001 | ✅ | ✅ | ✅ | ✅ | — |
| ChaCha20-Poly1305 | 9001 | ✅ | ✅ | ✅ | ✅ | — |
| X25519 ECDH | 8446 | ✅ | ✅ | ✅ | ✅ | — |
| X25519Kyber768 (PQ) | draft | ✅ | ✅ | ✅ | ✅ | — |
| HTTP/3 | 9114 | ✅ | ✅ | ❌ | ✅ | full connection mgmt, SETTINGS, GOAWAY, stream state machine |
| QPACK static table | 9204 | ✅ | ✅ | ❌ | ✅ | — |
| QPACK dynamic table | 9204 | ✅ | ✅ | ❌ | ✅ | dynamic table + encoder/decoder instructions + header block |
| HTTP Datagrams | 9297 | ✅ | ❌ | ❌ | ✅ | Quarter Stream ID + payload frame format |
| WebTransport | draft | ✅ | ❌ | ❌ | ✅ | full session mgmt, uni/bidi frames, CLOSE capsule, datagram |
| Stream reset partial delivery | draft | ✅ | ❌ | ❌ | ✅ | opt-in enable_reset_partial_delivery |
| External interop | — | — | — | — | ✅ all three | — |
| Pure-language TLS (no C) | — | ✅ | ❌ | ❌ | ✅ | — |
| FIPS 140-3 | — | ✅(Go 1.26+) | ❌ | ❌ | ❌ | quic-go only |
| XDP zero-copy I/O | — | ❌ | ❌ | ✅(unstable) | ❌ | s2n-quic only |

## Coverage summary

| Metric | quic-go | quiche | s2n-quic | quicz |
| --- | --- | --- | --- | --- |
| Transport (19 items) | 19/19 | 14/19 | 14/19 | 19/19 |
| Congestion (4 items) | 4/4 | 4/4 | 3/4 | 4/4 |
| Cipher suites (5 items) | 5/5 | 5/5 | 5/5 | 5/5 |
| Application layer (6 items) | 6/6 | 3/6 | 0/6 | 6/6 |
| Platform (3 items) | 2/3 | 0/3 | 1/3 | 1/3 |
| **Total (37 items)** | **36/37** | **26/37** | **23/37** | **36/37** |

## Gap analysis

**Mandatory gaps (all three have) — ALL CLOSED:**

1. ~~AES-256-GCM~~ — DONE (675e7ca)
2. ~~X25519Kyber768~~ — DONE (675e7ca)

**Recommended (2/3 have) — ALL CLOSED:**

3. ~~QPACK dynamic table~~ — DONE (c8e605c)
4. ~~Complete HTTP/3 connection management~~ — DONE (a15d22d)

**Optional (1/3 or fewer):**

5. ~~HTTP Datagrams (RFC 9297)~~ — DONE (da6a670)
6. ~~Complete WebTransport session~~ — DONE (a961f3e)
7. ~~Stream reset partial delivery~~ — DONE (8d0ef2c)
8. FIPS 140-3 — quic-go only
9. XDP zero-copy I/O — s2n-quic only

## Performance

Loopback UDP, single-stream upload, ReleaseFast build:

| Implementation | Language | Throughput | Platform | Notes |
| --- | --- | --- | --- | --- |
| msquic | C | 1.5–2.5 GB/s | Linux | XDP/GSO, kernel bypass |
| **quicz** | **Zig** | **1.4 GB/s** | **macOS** | **Threaded std.Io, CUBIC, no GSO** |
| s2n-quic | Rust | ~800 MB/s | Linux | GSO/GRO |
| quic-go | Go | ~400–600 MB/s | Linux | GSO |
| quiche | Rust | ~300–500 MB/s | Linux | — |
| quinn | Rust | ~300–500 MB/s | Linux | tokio async |

These figures are indicative, not a controlled head-to-head (different harnesses
and OSes). For the throughput chart, echo latency (P50 20.2 μs), methodology, and
caveats, see [Performance](/performance/).
