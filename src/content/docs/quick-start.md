---
title: Quick start
description: Add quicz to a Zig application and send your first QUIC frame
---

`quicz` is an experimental IETF QUIC transport implementation in
[Zig](https://ziglang.org/). It targets a usable QUIC v1 transport rather than
every optional QUIC extension.

## Requirements

- Zig **0.16.0** (see the repo's `.zigversion`)

## Add the dependency

While the package is experimental, the easiest route is a local checkout. Add
`quicz` to your application's `build.zig.zon`:

```zig
.dependencies = .{
    .quicz = .{ .path = "../quicz" },
},
```

Then expose the dependency to the executable in `build.zig`:

```zig
const quicz_dep = b.dependency("quicz", .{
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("quicz", quicz_dep.module("quicz"));
```

## Minimal connection and frame

```zig
const std = @import("std");
const quicz = @import("quicz");

pub fn main() !void {
    var connection = try quicz.Connection.init(std.heap.page_allocator, .client, .{
        .initial_max_data = 65_536,
        .initial_max_stream_data = 65_536,
        .initial_max_streams_bidi = 16,
    });
    defer connection.deinit();

    const stream_id = try connection.openStream();
    try connection.sendOnStream(stream_id, "hello", true);

    var frame_buffer: [1350]u8 = undefined;
    const frame_payload = (try connection.pollTx(0, &frame_buffer)) orelse
        return error.NoPendingFrame;
    _ = frame_payload;
}
```

:::note
`pollTx` returns pending QUIC frame payload for the connection state machine;
it is **not** a protected UDP datagram. For a TLS-owned, protected UDP
transport loop, start from
[`tls13_udp_loopback.zig`](https://github.com/venjiang/quicz/blob/main/examples/tls13_udp_loopback.zig)
or the separate-process echo programs in the [examples guide](/examples/).
:::

## Build and run the probes

```sh
zig build
zig build test --summary all
zig build run-tls13-udp-loopback
zig build run-tls13-process-interop
```

- `run-tls13-udp-loopback` — pure-Zig TLS handshake and stream path over loopback UDP.
- `run-tls13-process-interop` — independent Zig client and server processes over loopback UDP.

`zig build --help` lists every build step.

## Development map

| Need | Start here |
| --- | --- |
| Public connection API | [`src/lib.zig`](https://github.com/venjiang/quicz/blob/main/src/lib.zig) |
| TLS 1.3 implementation | [`src/quic/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/tls13.zig) |
| Endpoint routing and timers | [`src/quic/endpoint_lifecycle.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/endpoint_lifecycle.zig) |
| Runnable probes | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| Protocol status and acceptance evidence | [transport task matrix](https://github.com/venjiang/quicz/blob/main/docs/en/quic_transport_tasks.md) |

The API is evolving. `Connection` is the primary public handle; detailed
lifecycle helpers are documented in the [architecture](/architecture/) doc and
task matrix rather than enumerated here.

## License

MIT.
