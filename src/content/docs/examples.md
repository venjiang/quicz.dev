---
title: Examples
description: Runnable probes — loopback, separate-process echo, and Go/Rust interop
---

Every probe in [`examples/`](https://github.com/venjiang/quicz/tree/main/examples)
is runnable from the repo root with a single `zig build` step. The full
catalogue, intent, and commands are in
[the examples guide](https://github.com/venjiang/quicz/blob/main/examples/README.md).

## UDP loopback (pure Zig)

Verifies the pure-Zig TLS 1.3 handshake and the stream path in one process
over loopback UDP:

```sh
zig build run-tls13-udp-loopback
```

Start here when hacking on the handshake or packet protection — no second
process, no certificates to manage.

## Separate-process Zig interop

Builds independent client and server binaries and runs them against each
other over loopback UDP:

```sh
zig build run-tls13-process-interop
```

Catches assumptions that an in-process loopback hides (serialization, timers,
real socket behavior).

## Echo server + Go/Rust clients

The wire-level proof: independently implemented clients, certificate
verification **enabled**, talking to the quicz echo server.

Build the project, then start the local Zig echo server:

```sh
zig-out/bin/quicz-tls13-process-echo-server 127.0.0.1 4443 2 concurrent-retry
```

Run either independently implemented client with the local test CA:

```sh
(cd examples/interop/go_echo_client && \
   go run . -addr 127.0.0.1:4443 -ca ../testdata/quicz-echo-ca.pem -server-name localhost)

(cd examples/interop/rust_echo_client && \
   cargo run -- 127.0.0.1:4443 ../testdata/quicz-echo-ca.pem localhost)
```

Both clients report success only after separate FIN-terminated `hello` and
`world` echoes on streams 0 and 4. The included PEM is a local test trust
anchor, not a deployment credential.

## External stacks (quic-go, quinn)

quicz also passes certificate-verified interop as a **client** against
external servers, plus the QUIC-Interop-Runner self-test (handshake,
transfer, retry):

```sh
# interop runner self-test
zig build run-interop-client-standalone

# against an external quic-go or quinn server
zig build run-interop-external -- SERVER_IP PORT /path/to/cert.pem localhost
```

Interop server definitions live under
[`examples/interop/`](https://github.com/venjiang/quicz/tree/main/examples/interop):
`go_echo_client`, `quic_go_server`, `quiche_server`, `rust_echo_client`,
`s2n_quic_server`.
