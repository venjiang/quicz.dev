---
title: Quick start
description: Add quicz to a Zig app and run your first QUIC / HTTP/3 endpoint
---

`quicz` is a QUIC / HTTP/3 implementation in pure [Zig](https://ziglang.org/).
Transport and application layer are production-ready (40/41 features, 1820
tests, three-implementation interop verified). Public APIs may still evolve.

The recommended production API is the **async `std.Io` runtime**
(`quicz.runtime`): an event-driven server with per-connection handlers and an
async client. The `Endpoint → Connection → Stream` API and the low-level packet
API remain available.

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

## I/O runtime (async, `std.Io`)

`quicz.runtime` provides an event-driven server/client on Zig 0.16 `std.Io`
(threaded). The server spawns an independent handler task per connection
(std.http model); the client drives an async session.

### Server (echo)

```zig
const std = @import("std");
const quicz = @import("quicz");
const Server = quicz.runtime.server.Server;

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var threaded = std.Io.Threaded.init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var server = try Server.init(allocator, io, .{
        .port = 4433,
        .alpn = &.{"hq-interop"},
        .cert_der = &cert_der,
        .private_key = &key,
    });
    defer server.deinit();
    try server.serve(&echoHandler); // fn(ServerConnection) std.Io.Cancelable!void
}

fn echoHandler(conn: quicz.runtime.server.ServerConnection) std.Io.Cancelable!void {
    while (true) {
        var stream = (try conn.acceptStream()) orelse break;
        var buf: [4096]u8 = undefined;
        const n = try stream.receive(&buf);
        try stream.send(buf[0..n], .{ .fin = true });
    }
}
```

### Client

```zig
const std = @import("std");
const quicz = @import("quicz");
const Client = quicz.runtime.client.Client;

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var threaded = std.Io.Threaded.init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    var client = try Client.init(allocator, io, .{
        .server_port = 4433,
        .server_name = "localhost",
        .alpn = &.{"hq-interop"},
    });
    defer client.deinit();
    const ok = try client.runEchoSession("hello");
}
```

Handler signature: `fn (ServerConnection) std.Io.Cancelable!void`. Per-connection
`ServerConnection.acceptStream()` returns a `Stream` with `receive(buf)` /
`send(data, fin)`. See `examples/io_echo.zig` and `examples/multi_conn_test.zig`.

## Endpoint API (alternative)

The three-layer `Endpoint → Connection → Stream` API (`quicz.api`) mirrors
quic-go / s2n-quic and works without the async runtime.

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
| `max_streams_uni` | `100` | Max unidirectional streams per connection |
| `max_idle_timeout_ms` | `30000` | Idle timeout in milliseconds |
| `max_datagram_size` | `1350` | Max UDP payload size |
| `initial_max_data` | `1048576` | Connection-level flow control window |
| `initial_max_stream_data` | `262144` | Per-stream flow control window |
| `enable_datagrams` | `false` | Enable QUIC DATAGRAM extension (RFC 9221) |
| `max_datagram_frame_size` | `0` | Max DATAGRAM frame size (0 = disabled) |
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
const cubic = quicz.cubic;                 // congestion control (NewReno + CUBIC)
const h3 = quicz.h3; const qpack = quicz.qpack; const webtransport = quicz.webtransport;
const qlog = quicz.qlog;
```

See the [architecture](/architecture/) doc and the interop server/client in the
repo for the full low-level wiring.

## Build and run the probes

```sh
zig build                                  # build the library
zig build test --summary all               # 1820 unit tests
zig build run-tls13-udp-loopback           # TLS 1.3 UDP loopback
zig build run-interop-client-standalone    # interop self-test
zig build run-quic-bench                   # throughput / latency benchmarks
zig fmt --check build.zig src examples     # format check
```

For runnable demos (echo, DATAGRAM, post-quantum, 0-RTT, congestion bench,
connection migration) see the [examples guide](/examples/). Numbers behind the
benchmarks live on the [performance](/performance/) page.

## Interop testing

quicz passes a full **bidirectional interop matrix (7/7)** against quic-go,
quiche, s2n-quic, and quinn. All tests use certificate-verified TLS 1.3 with a
proper CA + CA-signed leaf, so strict webpki clients (s2n-quic, rustls/quinn)
accept the trust chain.

| Direction | Peer | Result |
| --- | --- | --- |
| Forward (quicz client → server) | quic-go / quiche / s2n-quic | echo_bytes=19, cert verified |
| Reverse (client → quicz server) | quic-go / quinn / quiche / s2n-quic | echo_streams=2, echo_bytes=10 |

```sh
# Start the quicz runtime server
zig build && zig-out/bin/quicz-interop-runtime-server 4433 cert.pem key.pem

# Forward: quicz client → external server
zig-out/bin/quicz-interop-runtime-client 127.0.0.1 4433 quicz-echo-ca.pem localhost

# Reverse matrix (external clients → quicz server), all four peers
examples/interop/run_reverse_interop.sh all 4433
```

## Security

[`THREAT_MODEL.md`](https://github.com/venjiang/quicz/blob/main/THREAT_MODEL.md)
documents the trust boundary and the defenses against in-scope attacks
(amplification, packet injection, stateless reset token guessing, version
downgrade, hostile transport parameters, Retry token forgery), each with code
and test references. See the [threat model](/security/) page.

## Development map

| Need | Start here |
| --- | --- |
| Async I/O runtime | [`src/runtime/`](https://github.com/venjiang/quicz/tree/main/src/runtime) |
| Public high-level API | [`src/quic/api.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/api.zig) |
| Connection state machine | [`src/quic/connection.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/connection.zig) |
| Pure-Zig TLS 1.3 | [`src/tls/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/tls13.zig) |
| Post-quantum KEX | [`src/tls/pq_kex.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/pq_kex.zig) |
| Endpoint routing / lifecycle | [`src/quic/endpoint.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/endpoint.zig) |
| HTTP/3 / QPACK / WebTransport | [`src/h3/`](https://github.com/venjiang/quicz/tree/main/src/h3) |
| Runnable examples | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| Protocol status & evidence | [status](/status/) |

## License

MIT.