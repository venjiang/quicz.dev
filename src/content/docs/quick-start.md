---
title: Quick start
description: Add quicz to a Zig app and run your first QUIC / HTTP/3 endpoint
---

`quicz` is a QUIC / HTTP/3 implementation in pure [Zig](https://ziglang.org/).
Transport and application layer are production-ready (36/37 features, 1793
tests, three-implementation interop verified). Public APIs may still evolve.

## Requirements

- Zig **0.16.0**

## Add the dependency

```sh
zig fetch --save git+https://github.com/venjiang/quicz
```

Then expose the module in your `build.zig`:

```zig
const quicz_dep = b.dependency("quicz", .{ .target = target, .optimize = optimize });
exe.root_module.addImport("quicz", quicz_dep.module("quicz"));
```

## High-level API

The recommended entry point is the three-layer `Endpoint → Connection → Stream`
API (`quicz.api`), which mirrors quic-go / s2n-quic.

### Server (echo)

```zig
const std = @import("std");
const quicz = @import("quicz");
const api = quicz.api;

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var ep = try api.Endpoint.listen(.{
        .allocator = allocator,
        .address = "0.0.0.0",
        .port = 4433,
        .cert_pem = cert_pem_bytes,
        .key_pem = key_pem_bytes,
        .alpn = &.{"hq-interop"},
    });
    defer ep.deinit();

    while (true) {
        _ = try ep.poll(100);
        var conn = (try ep.accept()) orelse continue;

        while (true) {
            var stream = (try conn.acceptStream()) orelse break;
            var buf: [4096]u8 = undefined;
            const n = try stream.read(&buf);
            try stream.write(buf[0..n], .{ .fin = true });
            stream.close();
        }
    }
}
```

### Client

```zig
const std = @import("std");
const quicz = @import("quicz");
const api = quicz.api;

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var ep = try api.Endpoint.bind(.{ .allocator = allocator });
    defer ep.deinit();

    var conn = try ep.connect(.{
        .address = "127.0.0.1",
        .port = 4433,
        .server_name = "localhost",
        .alpn = &.{"hq-interop"},
    });

    var stream = try conn.openStream();
    try stream.write("GET /index.html", .{ .fin = true });

    var buf: [8192]u8 = undefined;
    const n = try stream.read(&buf);
    std.debug.print("received {d} bytes\n", .{n});

    conn.close(0, "done");
}
```

Callers never touch packet-number spaces, traffic secrets, or CRYPTO frames.
The allocator is passed explicitly, `close` is idempotent, and every resource
has a deterministic `deinit` path.

### EndpointConfig options

| Field | Default | Description |
| --- | --- | --- |
| `address` | `"0.0.0.0"` | Bind address |
| `port` | `0` | Bind port (0 = ephemeral) |
| `cert_pem` / `key_pem` | `null` | TLS certificate and private key (server) |
| `ca_cert_pem` | `null` | CA certificate for verification (client) |
| `insecure_skip_verify` | `false` | Skip certificate verification (testing only) |
| `alpn` | `&.{}` | ALPN protocol identifiers |
| `max_connections` | `0` | Max concurrent connections (0 = unlimited) |
| `max_streams_bidi` | `100` | Max bidirectional streams per connection |
| `max_idle_timeout_ms` | `30000` | Idle timeout in milliseconds |
| `max_datagram_size` | `1350` | Max UDP payload size |
| `initial_max_data` | `1048576` | Connection-level flow control window |
| `initial_max_stream_data` | `262144` | Per-stream flow control window |
| `enable_datagrams` | `false` | Enable QUIC DATAGRAM extension (RFC 9221) |
| `require_retry` | `false` | Require Retry for address validation (server) |
| `ipv6` | `false` | Use IPv6 dual-stack socket |

### ConnectConfig options

| Field | Default | Description |
| --- | --- | --- |
| `address` | *(required)* | Server address |
| `port` | *(required)* | Server port |
| `server_name` | `"localhost"` | TLS SNI |
| `alpn` | `&.{}` | ALPN protocol identifiers |
| `ca_cert_pem` | `null` | CA certificate for verification |
| `insecure_skip_verify` | `false` | Skip certificate verification |
| `handshake_timeout_ms` | `10000` | Handshake timeout |

## Low-level API

For fine-grained packet processing, TLS-backend driving, or custom endpoint
routing, the internal modules are public too:

```zig
const quicz = @import("quicz");

var conn = try quicz.Connection.init(allocator, .client, .{
    .initial_max_data = 65_536,
    .initial_max_streams_bidi = 16,
});
defer conn.deinit();

const tls13 = quicz.tls13;                 // pure-Zig TLS 1.3
const protection = quicz.protection;       // AES-GCM, ChaCha20-Poly1305
const cubic = quicz.cubic; const bbr = quicz.bbr; // congestion control
const h3 = quicz.h3; const qpack = quicz.qpack; const webtransport = quicz.webtransport;
const qlog = quicz.qlog;
```

See the [architecture](/architecture/) doc and the interop server/client in the
repo for the full low-level wiring.

## Build and run the probes

```sh
zig build                                  # build the library
zig build test --summary all               # 1793 unit tests
zig build run-tls13-udp-loopback           # TLS 1.3 UDP loopback
zig build run-interop-client-standalone    # interop self-test
zig fmt --check build.zig src examples     # format check
```

For runnable demos (echo, DATAGRAM, post-quantum, 0-RTT, congestion bench,
connection migration) see the [examples guide](/examples/).

## Interop testing

quicz passes certificate-verified interop against quic-go, quiche, and s2n-quic:

```sh
examples/interop/run_external_interop.sh all        # requires Go + Rust toolchains
examples/interop/run_external_interop.sh quic-go
examples/interop/run_external_interop.sh quiche
examples/interop/run_external_interop.sh s2n-quic
```

## Development map

| Need | Start here |
| --- | --- |
| Public high-level API | [`src/quic/api.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/api.zig) |
| Connection state machine | [`src/quic/connection.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/connection.zig) |
| Pure-Zig TLS 1.3 | [`src/tls/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/tls13.zig) |
| Post-quantum KEX | [`src/tls/pq_kex.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/pq_kex.zig) |
| Endpoint routing / lifecycle | [`src/quic/endpoint.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/endpoint.zig) |
| HTTP/3 / QPACK / WebTransport | [`src/h3/`](https://github.com/venjiang/quicz/tree/main/src/h3) |
| Runnable examples | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| Protocol status & evidence | [transport task matrix](https://github.com/venjiang/quicz/blob/main/docs/en/quic_transport_tasks.md) |

## License

MIT.
