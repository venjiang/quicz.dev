---
title: Status
description: Current state, coverage, milestones, and out-of-scope for quicz
---

quicz's current status, coverage, and scope, sourced from the project README,
the feature matrix, and the transport task matrix.

## Current state

Transport and application layers are **production-ready** (from the README):

- **40/41 features**, **1820 unit tests**, zero leaks.
- **Bidirectional interop matrix 7/7** against quic-go, quiche, s2n-quic, and
  quinn — certificate-verified TLS 1.3 with a proper CA chain.
- **Full HTTP/3** (SETTINGS, GOAWAY, stream state machine), **QPACK** static +
  dynamic table, **WebTransport**, **HTTP Datagrams** (RFC 9297).
- Public APIs may still evolve.

## Coverage

| Metric | quicz |
| --- | --- |
| Transport (19 items) | 19/19 |
| Congestion (8 items) | 7/8 (BBR removed) |
| Cipher suites (5 items) | 5/5 |
| Application layer (6 items) | 6/6 |
| Platform (3 items) | 1/3 |
| **Total (41 items)** | **40/41** |

Full row-by-row comparison on the [feature comparison](/comparisons/) page.

## Milestones

The transport task matrix tracks these as its definition of done:

1. Standard matrix and documentation stay current.
2. RFC 8999 / 9000 packet, frame, transport-parameter, and error-code support complete.
3. Connection state machine, packet-number spaces, and protected datagram APIs available.
4. RFC 9001 TLS integration and packet protection establish local 1-RTT.
5. RFC 9000 transport behavior covers streams, flow control, connection IDs, Retry/token, path validation, close/reset.
6. RFC 9002 recovery and congestion control pass controlled-clock tests.
7. Layered examples and at least one external interop path available.

## Out of scope

- **BBR** — deliberately removed in favor of CUBIC (2026-08).
- **FIPS 140-3** — quic-go only.
- **XDP zero-copy I/O** — s2n-quic only.

## Evidence & tracking

- [Transport task matrix](https://github.com/venjiang/quicz/blob/main/docs/en/quic_transport_tasks.md) — the per-feature ledger.
- [Threat model](/security/) — trust boundary and defenses.
- [Performance](/performance/) — first-party benchmark numbers.
- [Examples](/examples/) — runnable probes and interop commands.

> The task matrix's historical RFC-status section predates the current
> production-ready state and is being reconciled; the feature matrix and README
> reflect the current code.