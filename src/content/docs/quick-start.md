---
title: Quick start
description: Build real QUIC / HTTP/3 apps with quicz's async I/O runtime
---

`quicz` is a QUIC / HTTP/3 implementation in pure [Zig](https://ziglang.org/)
(40/41 features, 1820 tests, three-implementation interop verified). The
recommended production API is the **async `std.Io` runtime** (`quicz.runtime`):
an event-driven server with per-connection handlers and an async client. This
guide walks through the HTTP/3 path (recommended for most apps) and the
low-level stream-echo path (for custom protocols). Public APIs may still evolve.

## Requirements

- Zig **0.16.0** — the library is pure Zig, no C dependencies.

## Add the dependency

```sh
zig fetch --save git+https://github.com/venjiang/quicz
```

In `build.zig`:

```zig
const quicz_dep = b.dependency("quicz", .{ .target = target, .optimize = optimize });
exe.root_module.addImport("quicz", quicz_dep.module("quicz"));
```

Then `const quicz = @import("quicz");`.

## Common setup: the event loop

Both server and client run on a Zig `std.Io` instance. The `Threaded` backend
executes async I/O on a thread pool; your app drives streams from async tasks.

```zig
var threaded = std.Io.Threaded.init(allocator, .{});
defer threaded.deinit();
const io = threaded.io();
```

## HTTP/3 server

`runtime.Server` owns the socket, endpoint, and connection lifecycle. Use
`serveH3` with a synchronous request handler.

```zig
const Server = quicz.runtime.server.Server;

fn handleRequest(req: quicz.h3_request.DecodedRequest) quicz.h3_request.Response {
    if (std.mem.eql(u8, req.path, "/")) {
        return .{ .status = 200, .body = "Hello from quicz HTTP/3!" };
    }
    // Streamed (chunked) response body — sent as multiple DATA frames.
    if (std.mem.eql(u8, req.path, "/stream")) {
        return .{
            .status = 200,
            .body_stream = quicz.h3_request.ResponseBody.fromRepeating(allocator, 'S', 65536) catch unreachable,
        };
    }
    return .{ .status = 404, .body = "not found" };
}

var server = try Server.init(allocator, io, .{
    .port = 4433,
    .alpn = &.{"h3"},
    .cert_der = &certificate_der,       // DER certificate
    .private_key = &server_private_key, // matching private key
});
defer server.deinit();
try server.serveH3(.{}, handleRequest); // options: qpack_max_table_capacity, qpack_blocked_streams

// Block until killed (serveLoop runs as a concurrent task).
server.drive_group.await(io) catch {};
```

Test with `curl --http3-prior https://127.0.0.1:4433/ -k -v` (a curl build with
HTTP/3 support).

### Response variants

| Field | Meaning |
| --- | --- |
| `.body = slice` | Single contiguous body, encoded as one DATA frame |
| `.body_stream = ResponseBody` | Chunked body (takes precedence over `body`) |
| neither | Bodyless response (HEADERS + fin) |

Request bodies are aggregated up to `max_request_body_size` (1 MiB default);
inside the handler `req.body` holds the full body (or `null`). Oversized bodies
are rejected with 413 + STOP_SENDING.

## HTTP/3 client

```zig
const Client = quicz.runtime.client.Client;
const H3Client = quicz.runtime.h3_client.H3Client;

var client = try Client.init(allocator, io, .{
    .server_port = 4433,
    .server_name = "localhost",
    .alpn = &.{"h3"},
    .insecure_skip_verify = true, // null ca_bundle also skips verification
});
defer client.deinit();
try client.connect();

var h3cli = H3Client.init(allocator, &client, 4096, 8); // qpack cap, blocked streams
defer h3cli.deinit();
try h3cli.run(); // waits for the server SETTINGS

// Send a GET request.
const stream = try h3cli.sendRequest(.{
    .method = "GET",
    .path = "/",
    .authority = "localhost",
});
const resp = try h3cli.receiveResponse(stream);
if (resp.isSuccess()) {
    // resp.body is the aggregated response body (or null).
}
client.close();
```

### Streamed request body

For large uploads, `sendRequestStreamed` sends the body as bounded DATA frames,
blocking until fully drained (flow-control credit is awaited):

```zig
const body = try quicz.h3_request.ResponseBody.fromRepeating(allocator, 'A', 20 * 1024);
const stream = try h3cli.sendRequestStreamed(.{
    .method = "POST",
    .path = "/echo",
    .authority = "localhost",
}, body);
const resp = try h3cli.receiveResponse(stream);
```

## Low-level stream echo (custom protocols)

For non-HTTP protocols, use `Server.serve` with a per-connection handler
(std.http model). Each connection gets its own handler task.

```zig
const ServerConnection = quicz.runtime.server.ServerConnection;

fn echoHandler(conn: ServerConnection) std.Io.Cancelable!void {
    var c = conn;
    var stream = c.acceptStream() catch return;
    var buf: [65536]u8 = undefined;
    while (true) {
        const n = stream.receive(&buf) catch return;
        if (n == 0) break; // EOF
        stream.send(buf[0..n], false) catch return;
    }
}

var server = try Server.init(allocator, io, .{
    .port = 4433,
    .alpn = &.{"hq-interop"},
    .cert_der = &certificate_der,
    .private_key = &server_private_key,
});
defer server.deinit();
try server.serve(&echoHandler);
```

Client side: `connect()` then `send` / `receive` on a stream:

```zig
try client.connect();
const sid = try client.send("hello", false);
var buf: [4096]u8 = undefined;
const n = try client.receive(sid, &buf); // 0 = EOF
```

## Certificates

The examples bundle a local test-only P-256 key pair. For production:

- **macOS / arm64**: ECDSA P-256 certificates work.
- **Linux x86_64**: Zig 0.16's `std.crypto` has a known codegen bug for
  P-256/P-384/Ed25519 signature verification. Use **RSA certificates** and a
  **Release** build (`-Doptimize=ReleaseFast`). An OpenSSL-generated RSA
  certificate verifies correctly on Linux.

`Server.Config` supports `bind_addr` (default `127.0.0.1`); set it to
`.{0,0,0,0}` to listen on all interfaces.

## Common patterns

- **Per-connection handler task** — `Server.serve` / `serveH3` spawn one task per
  connection; each connection's resources are single-owner (no refcounting).
- **Non-blocking multistream** — poll with `tryAcceptStreamId` /
  `tryReceiveStreamData` / `connStreamIds` and park on `waitStreamActivity`
  instead of blocking on one stream.
- **Concurrency** — `std.Io.Group.concurrent` runs independent client/server
  tasks; `examples/multi_client_bench.zig` shows N concurrent clients.

## Build and run the probes

```sh
zig build                                  # build the library
zig build test --summary all               # 1820 unit tests
zig build run-tls13-udp-loopback           # TLS 1.3 UDP loopback
zig build run-interop-client-standalone    # interop self-test
zig build run-quic-bench                   # throughput / latency benchmarks
zig fmt --check build.zig src examples     # format check
```

Runnable demos (echo, DATAGRAM, post-quantum, 0-RTT, H3 server, congestion,
connection migration) on the [examples](/examples/) page; benchmark numbers on
the [performance](/performance/) page.

## Interop testing

quicz passes a full **bidirectional interop matrix (7/7)** against quic-go,
quiche, s2n-quic, and quinn — certificate-verified TLS 1.3 with a proper CA
chain.

| Direction | Peer | Result |
| --- | --- | --- |
| Forward (quicz client → server) | quic-go / quiche / s2n-quic | echo_bytes=19, cert verified |
| Reverse (client → quicz server) | quic-go / quinn / quiche / s2n-quic | echo_streams=2, echo_bytes=10 |

```sh
zig build && zig-out/bin/quicz-interop-runtime-server 4433 cert.pem key.pem
zig-out/bin/quicz-interop-runtime-client 127.0.0.1 4433 quicz-echo-ca.pem localhost
examples/interop/run_reverse_interop.sh all 4433
```

## Security

[`THREAT_MODEL.md`](https://github.com/venjiang/quicz/blob/main/THREAT_MODEL.md)
documents the trust boundary and defenses against in-scope attacks, each with
code and test references. See the [threat model](/security/) page.

## Development map

| Need | Start here |
| --- | --- |
| Async I/O runtime | [`src/runtime/`](https://github.com/venjiang/quicz/tree/main/src/runtime) |
| Runtime API reference | [`/api/`](/api/) |
| Connection state machine | [`src/quic/connection.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/connection.zig) |
| Pure-Zig TLS 1.3 | [`src/tls/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/tls13.zig) |
| HTTP/3 / QPACK / WebTransport | [`src/h3/`](https://github.com/venjiang/quicz/tree/main/src/h3) |
| Runnable examples | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| Protocol status & evidence | [status](/status/) |

## License

MIT.