---
title: Examples
description: Runnable probes — practical demos, interop, and the full loopback catalogue
---

Every command runs from the repo root; `zig build` is implicit in each `run-*`
step. This page covers the practical demos and the interop probes; the
exhaustive core-transport / TLS / UDP-loopback catalogue (60+ probes) lives in
[the examples guide](https://github.com/venjiang/quicz/blob/main/examples/README.md),
and `zig build --help` is the authoritative generated index.

## Practical examples (real UDP / network)

| Command | Source | What it demonstrates |
| --- | --- | --- |
| `run-quic-echo-server` | `quic_echo_server.zig` | Multi-connection QUIC echo server, TLS 1.3 on real UDP. |
| `run-quic-echo-client` | `quic_echo_client.zig` | QUIC echo client: handshake, stream write/read, close. |
| `run-h3-server` | `h3_server.zig` | HTTP/3 server on the production runtime (`runtime.Server.serveH3`, QPACK dynamic). |
| `run-datagram-echo -- --server` | `datagram_echo.zig` | QUIC DATAGRAM (RFC 9221) echo server — unreliable datagrams. |
| `run-datagram-echo -- --client` | `datagram_echo.zig` | QUIC DATAGRAM echo client. |
| `run-post-quantum-echo -- --server` | `post_quantum_echo.zig` | X25519Kyber768 post-quantum KEX + QUIC echo server. |
| `run-post-quantum-echo -- --client` | `post_quantum_echo.zig` | Post-quantum KEX + QUIC echo client. |
| `run-zero-rtt-echo` | `zero_rtt_echo.zig` | 0-RTT session resumption state machine (PSK, early data, replay protection). |
| `run-congestion-bench` | `congestion_bench.zig` | Congestion control comparison: NewReno vs CUBIC under simulated loss. |
| `run-connection-migration` | `connection_migration.zig` | PATH_CHALLENGE / PATH_RESPONSE round-trip and route update. |

### Echo server + client

```sh
# Terminal 1
zig build run-quic-echo-server
# Terminal 2
zig build run-quic-echo-client
```

### DATAGRAM echo (RFC 9221)

```sh
zig build run-datagram-echo -- --server
zig build run-datagram-echo -- --client
```

### Post-quantum echo

```sh
zig build run-post-quantum-echo -- --server
zig build run-post-quantum-echo -- --client
```

### Standalone demos (no network)

```sh
zig build run-zero-rtt-echo         # 0-RTT state machine walkthrough
zig build run-congestion-bench      # NewReno / CUBIC cwnd comparison
zig build run-connection-migration  # PATH_CHALLENGE / RESPONSE demo
```

## Entry points and interoperability

| Command | Source | What it demonstrates |
| --- | --- | --- |
| `run-server` | `echo_server.zig` | Minimal frame-payload echo server. |
| `run-client` | `echo_client.zig` | Minimal frame-payload echo client. |
| `run-tls13-process-interop` | `tls13_process_echo_{client,server}.zig` | Separate pure-Zig TLS/QUIC processes, two FIN streams, routing and close cleanup. |
| `run-interop-external-client -- <ip> <port> <ca> [name] [version-negotiation]` | `interop_external_client.zig` | Certificate-verified IPv4 peer probe; optional mode proves v2-to-v1 Version Negotiation. |
| `run-interop-client -- <host> <port> [testcase]` | `interop_client.zig` | QUIC-Interop-Runner-style client and local fallback probe. |
| `run-interop-event-loopback -- [case]` | `interop_event_loopback.zig` | TLS-owned UDP event-loop scenarios (handshake, loss, key-update, stream-control, …). |
| Go client | `interop/go_echo_client/main.go` | quic-go FIN echo client with `-expect-*` flags for matching server modes. |
| Go server | `interop/go_echo_client/echo_server/main.go` | quic-go peer; generates a local CA PEM, echoes two FIN streams, optional `-v1-only`. |
| Rust client | `interop/rust_echo_client/src/main.rs` | quinn/rustls client sending FIN streams 0 and 4 to the Zig server. |

The Go/Rust clients need the local test CA and a running Zig server:

```sh
zig-out/bin/quicz-tls13-process-echo-server 127.0.0.1 4443 2 concurrent-retry
(cd examples/interop/go_echo_client && go run . -addr 127.0.0.1:4443 -ca ../testdata/quicz-echo-ca.pem -server-name localhost)
(cd examples/interop/rust_echo_client && cargo run -- 127.0.0.1:4443 ../testdata/quicz-echo-ca.pem localhost)
```

External Zig client against the independent Go peer:

```sh
(cd examples/interop/go_echo_client && go run ./echo_server -addr 127.0.0.1:4433 -ca-out /absolute/path/to/go-echo-ca.pem)
zig build run-interop-external-client -- 127.0.0.1 4433 /absolute/path/to/go-echo-ca.pem localhost
```

## Beyond this page

Core transport state (codec, flow control, stream reset, retry, CID lifecycle,
loss/PTO recovery, …), TLS integrations (pure-Zig loopbacks, C-ABI and OpenSSL
adapters), and the UDP lifecycle loopbacks are all registered build steps. The
async `std.Io` runtime is exercised by `examples/io_echo.zig` and
`examples/multi_conn_test.zig`. See
[the examples guide](https://github.com/venjiang/quicz/blob/main/examples/README.md)
for the full tables, or run `zig build --help`.
