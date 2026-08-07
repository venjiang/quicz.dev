---
title: Quick start
description: Add quicz to a Zig app and run your first QUIC / HTTP/3 endpoint
---

`quicz` is a QUIC / HTTP/3 implementation in pure [Zig](https://ziglang.org/).
Transport and application layer are production-ready (40/41 features, 1820
tests, three-implementation interop verified). Public APIs may still evolve.

The recommended production API is the **async `std.Io` runtime**
(`quicz.runtime`): an event-driven server with per-connection handlers and an
async client. The low-level packet API remains available for fine-grained
control.

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