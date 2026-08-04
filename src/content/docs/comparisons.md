---
title: Feature comparison
description: How quicz stacks up against quic-go, quiche, and s2n-quic, feature by feature
---

Updated 2026-07-28 (rows reconciled to the current README / source, 2026-08).
Sources: project READMEs, source code inspection, RFC compliance tracking.
Mirrors the standalone
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
| Async I/O runtime (multi-conn) | — | ✅(goroutine) | ✅(tokio) | ✅(tokio) | ✅(std.Io) | std.http model: accept + per-conn handler |
| qlog | draft | ✅ | ✅(feature-gated) | ❌(event subscriber) | ✅ | — |
| Fuzz targets | — | ✅(OSS-Fuzz) | ✅ | ✅ | ✅ | — |
| NewReno | 9002 | ✅ | ✅ | ❌ | ✅ | s2n-quic: CUBIC+BBR only |
| CUBIC | 9438 | ✅ | ✅ | ✅ | ✅ | — |
| BBR | — | ✅ | ✅ | ✅ | ❌ | removed 2026-08 in favor of CUBIC (see README) |
| HyStart++ | draft | ❌ | ❌ | ✅ | ✅ | slow-start RTT-monitor early exit |
| PTO jitter | 9002 | ❌ | ❌ | ✅ | ✅ | avoids timeout synchronization |
| Fast retransmission | 9002 | ✅ | ✅ | ✅ | ✅ | — |
| App-limited (RFC 8312 §5.8) | 8312 | ✅ | ✅ | ✅ | ✅ | 3×MTU threshold |
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
| Congestion (8 items) | 6/8 | 6/8 | 7/8 | 7/8 |
| Cipher suites (5 items) | 5/5 | 5/5 | 5/5 | 5/5 |
| Application layer (6 items) | 6/6 | 3/6 | 0/6 | 6/6 |
| Platform (3 items) | 2/3 | 0/3 | 1/3 | 1/3 |
| **Total (41 items)** | **38/41** | **28/41** | **27/41** | **40/41** |

quicz ships every transport, cipher, and application-layer feature; the open
items are BBR (deliberately removed) plus the platform-only FIPS / XDP rows.

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

Test conditions: loopback UDP, single-stream upload, ReleaseFast build, 8.9 KB
datagram, 100 μs timeout. Sources are attributed per row; figures are indicative,
not a controlled head-to-head.

| Implementation | Language | Throughput | Platform | Source |
| --- | --- | --- | --- | --- |
| msquic | C | ~7–8 Gbps | Windows, XDP | secnetperf dashboard |
| msquic | C | ~3 Gbps | Linux, no XDP | Aalto 2025 thesis |
| msquic | C | ~1 Gbps | macOS, loopback | secnetperf |
| quic-go | Go | ~4 Gbps | Linux, GSO, multi-stream | KIT 2025 |
| quic-go | Go | ~1.1 Gbps | Linux, GSO | quic-go#3670 |
| s2n-quic | Rust | ~800 MB/s | Linux, GSO/GRO | TQUIC benchmark |
| **quicz** | **Zig** | **~390 MB/s (single) / ~380 MB/s (4-stream)** | **macOS, loopback** | this repo (real handshake, CUBIC, no GSO) |
| quiche | Rust | ~300–500 MB/s | Linux, no GSO | TQUIC benchmark |
| quinn | Rust | ~300–500 MB/s | Linux, tokio | KIT 2025 / ETH thesis |
| TQUIC | Rust | ~1–2 Gbps | Linux, GSO | TQUIC benchmark |
| lsquic | C | ~2–4 Gbps | Linux, GSO | KIT 2025 |
| picoquic | C | ~1–2 Gbps | Linux | KIT 2025 |

quicz's ~390 MB/s is measured with a **real TLS 1.3 handshake** on macOS (no
GSO/XDP); the high numbers elsewhere lean on Linux GSO/GRO (3–10×) or XDP
kernel bypass. Full per-run detail on the [Performance](/performance/) page.

## Production tuning

See [Production tuning](/tuning/) for recommended configuration values,
PTO-jitter guidance, congestion-control selection, and initial-RTT tuning per
deployment.
