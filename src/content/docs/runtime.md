---
title: Runtime design
description: Why the I/O runtime exists, its streaming model, and what it is not
---

The quicz protocol layer is a **state-machine library**: `Connection`,
`EndpointConnectionLifecycle`, and `EndpointConnectionRegistry` hold no socket,
I/O, or thread — the caller drives I/O. The **I/O runtime** is the layer that
owns the socket, drives connections, manages lifecycle, and exposes a
**streaming application interface**. Mirrors the repo's
[io_runtime_design.md](https://github.com/venjiang/quicz/blob/main/docs/zh-CN/io_runtime_design.md).

**Positioning**: the I/O runtime is **library-completeness infrastructure, not a
throughput optimization**. Measured throughput is bounded by single-core
per-packet CPU (~900 MB/s server capacity); changing the I/O model
(sync/async/partitioned) yields only ~1.2×. Linear scaling requires multi-core
parallel packet processing (multi-worker partitioning).

## Design

quicz already has `Tls13ServerEndpoint` / `Tls13ClientEndpoint` (wrapping
handshake + DCID routing); the runtime adds a **streaming shell**:

- **I/O layer** — `std.Io` (cross-platform; Linux io_uring/sendmmsg, macOS
  kqueue; no third-party deps).
- **Drive model** — `std.Io` async (`Group.concurrent` tasks + `Condition`
  coordination).
- **Application interface** — a **streaming model** (`accept` / `receive` /
  `send`); apps handle connections through streaming APIs, **not callbacks**.

```zig
const Server = struct {
    pub fn init(alloc, io, config) !Server;
    pub fn drive(self) Cancelable!void;             // connection drive task
    pub fn accept(self) !u64;                       // accept a connection, returns id
    pub fn receiveStreamData(self, conn_id, buf) !usize;
    pub fn sendStreamData(self, conn_id, stream_id, data) !void;
};

const Client = struct {
    pub fn init(alloc, io, config) !Client;
    pub fn connect(self) !void;                     // handshake
    pub fn send(self, data, fin) !u64;              // open stream, send, return id
    pub fn receive(self, stream_id, buf) !?usize;
    pub fn runEchoSession(self, payload) !bool;
};
```

**Coordination**: the drive task runs on `Group.concurrent` (std.Io thread
pool), processes packets (sync, CPU-bound), then pushes accepted connections /
stream data into per-connection-id queues and `Condition.signal`s; the
application's `accept` / `receiveStreamData` `Condition.wait` on those queues,
concurrently with the drive task.

## Connection drive task

```
drive() (Group.concurrent task, loop):
1. recv: std.Io receiveTimeout collects datagrams
2. routeAndProcess: feedDatagram routes by DCID; new-connection handshake accept, existing process
3. push: recvOnStream data pushed to the connection queue, Condition.signal wakes the app
4. send: drain the connection's output packets (ACK/data) to the peer
```

## Components reused

| Component | Source |
| --- | --- |
| I/O | `std.Io` (stdlib, cross-platform) |
| Connection state machine | `Connection` |
| Connection registry / routing | `EndpointConnectionRegistry` + `EndpointConnectionLifecycle` |
| TLS | `Tls13Backend` |

## Implementation phases

- **Phase 0 (done)** — async streaming single-connection server/client
  (`Server.drive` + `accept` / `receiveStreamData` / `sendStreamData`), verified real handshake + echo.
- **Phase 1 (multi-connection)** — per-connection-id queues,
  `EndpointConnectionRegistry` routes and accepts many connections; full
  bidirectional stream handles.
- **Phase 2 (multi-worker partitioning, scaling)** — partition connections
  across std.Io workers to process packets in parallel. This is the key to
  linear scaling, not the I/O runtime itself.

## Relation to throughput (measured, avoid the trap)

- The I/O runtime (async/partitioned) is only a ~1.2× gain (measured
  `Group.concurrent` vs thread-per-connection).
- Throughput is bounded by single-core per-packet CPU (~900 MB/s capacity).
- Linear scaling = multi-core packet-processing partitioning; loopback tests
  barely reflect the real gain.