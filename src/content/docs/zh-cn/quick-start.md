---
title: 快速开始
description: 把 quicz 加入 Zig 应用，跑起第一个 QUIC / HTTP/3 端点
---

`quicz` 是纯 [Zig](https://ziglang.org/)（0.16）实现的 QUIC / HTTP/3。传输层与应用层
已生产可用（40/41 功能、1820 测试、三实现互通验证）。公开 API 仍可能演进。

## 环境要求

- Zig **0.16.0**

## 添加依赖

```sh
zig fetch --save git+https://github.com/venjiang/quicz
```

然后在 `build.zig` 中暴露模块：

```zig
const quicz_dep = b.dependency("quicz", .{ .target = target, .optimize = optimize });
exe.root_module.addImport("quicz", quicz_dep.module("quicz"));
```

## 高层 API

推荐入口是三层 `Endpoint → Connection → Stream` API（`quicz.api`），与 quic-go /
s2n-quic 同模式。

### 服务端（echo）

```zig
const quicz = @import("quicz");
const api = quicz.api;

pub fn main() !void {
    var ep = try api.Endpoint.listen(.{
        .allocator = gpa,
        .address = "0.0.0.0",
        .port = 4433,
        .cert_pem = cert_bytes,
        .key_pem = key_bytes,
        .alpn = &.{"h3"},
    });
    defer ep.deinit();

    while (true) {
        _ = try ep.poll(100);
        var conn = (try ep.accept()) orelse continue;
        var stream = (try conn.acceptStream()) orelse continue;

        var buf: [4096]u8 = undefined;
        const n = try stream.read(&buf);
        try stream.write(buf[0..n], .{ .fin = true });
        stream.close();
    }
}
```

### 客户端

```zig
const quicz = @import("quicz");
const api = quicz.api;

pub fn main() !void {
    var ep = try api.Endpoint.bind(.{ .allocator = gpa });
    defer ep.deinit();

    var conn = try ep.connect(.{
        .address = "127.0.0.1",
        .port = 4433,
        .server_name = "localhost",
        .alpn = &.{"h3"},
    });

    var stream = try conn.openStream();
    try stream.write("GET /", .{ .fin = true });

    var buf: [4096]u8 = undefined;
    const n = try stream.read(&buf);
    std.debug.print("{s}\n", .{buf[0..n]});

    conn.close(0, "done");
}
```

调用方不接触 packet number space、traffic secret 或 CRYPTO frame。allocator 显式传入；
`close` 幂等；所有资源有确定性 deinit 路径。

### API 设计

三层 API 与主流 QUIC 实现采用相同模式：

| 层级 | quicz | quic-go (Go) | s2n-quic (Rust) | endel/quic-zig (Zig) |
| --- | --- | --- | --- | --- |
| 端点 | `Endpoint.listen/bind/connect/accept/poll` | `Transport.Listen/Dial` | `Server::builder().start()` | `Server(Handler).run()` |
| 连接 | `Connection.openStream/acceptStream/close` | `Conn.OpenStream/AcceptStream` | `connection.open_bidirectional_stream` | `Connection.openStream` |
| 流 | `Stream.read/write/reset/close` | `Stream.Read/Write/Close` | `stream.send/receive` | `ReceiveStream.read / SendStream.write` |

## I/O 运行时（async，`std.Io`）

`quicz.runtime` 提供基于 Zig 0.16 `std.Io`（线程化）的事件驱动 server/client。server 按
连接 spawn 独立 handler task（std.http 模型）；client 驱动 async 会话。

```zig
const std = @import("std");
const quicz = @import("quicz");
const Server = quicz.runtime.server.Server;
const Client = quicz.runtime.client.Client;

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var threaded = std.Io.Threaded.init(allocator, .{});
    defer threaded.deinit();
    const io = threaded.io();

    // Server：serve(handler) 启动 driving task + 每连接 handler。
    var server = try Server.init(allocator, io, .{
        .port = 4433,
        .alpn = &.{"hq-interop"},
        .cert_der = &cert_der,
        .private_key = &key,
    });
    defer server.deinit();
    try server.serve(&echoHandler); // fn(ServerConnection) std.Io.Cancelable!void

    // Client：connect、send、receive 通过 async 会话。
    var client = try Client.init(allocator, io, .{
        .server_port = 4433,
        .server_name = "localhost",
        .alpn = &.{"hq-interop"},
    });
    defer client.deinit();
    const ok = try client.runEchoSession("hello");
}
```

handler 签名：`fn (ServerConnection) std.Io.Cancelable!void`。每连接
`ServerConnection.acceptStream()` 返回 `Stream`，提供 `receive(buf)` / `send(data, fin)`。
见 `examples/io_echo.zig` 和 `examples/multi_conn_test.zig`。

## 低层 API

需要更精细控制时，内部模块同样公开：

```zig
const quicz = @import("quicz");

var conn = try quicz.Connection.init(allocator, .client, .{...});  // 包级连接状态机（11K 行）
const tls13 = quicz.tls13;                 // 纯 Zig TLS 1.3（9.4K 行）
const protection = quicz.protection;       // 包保护：AES-GCM、ChaCha20-Poly1305
const cubic = quicz.cubic;                 // 拥塞控制（NewReno + CUBIC）
const h3 = quicz.h3; const qpack = quicz.qpack; const webtransport = quicz.webtransport;
const qlog = quicz.qlog;
```

完整低层接线见[架构](/zh-cn/architecture/)与仓库内 interop server/client。

## 构建与运行探针

```sh
zig build                                  # 构建库
zig build test --summary all               # 1820 个单元测试
zig build run-tls13-udp-loopback           # TLS 1.3 UDP 回环
zig build run-interop-client-standalone    # 互通自测
zig build run-quic-bench                   # 吞吐 / 延迟基准
zig fmt --check build.zig src examples     # 格式检查
```

可运行演示（echo、DATAGRAM、后量子、0-RTT、拥塞对比、连接迁移）见[示例](/zh-cn/examples/)；
基准数字见[性能](/zh-cn/performance/)页。

## 互通测试

quicz 通过启用证书校验的 quic-go / quiche / s2n-quic 互通：

```sh
examples/interop/run_external_interop.sh all        # 需要 Go + Rust 工具链
examples/interop/run_external_interop.sh quic-go
examples/interop/run_external_interop.sh quiche
examples/interop/run_external_interop.sh s2n-quic
```

## 开发入口

| 需求 | 入口 |
| --- | --- |
| 公开高层 API | [`src/quic/api.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/api.zig) |
| 异步 I/O 运行时 | [`src/runtime/`](https://github.com/venjiang/quicz/tree/main/src/runtime) |
| 连接状态机 | [`src/quic/connection.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/connection.zig) |
| 纯 Zig TLS 1.3 | [`src/tls/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/tls13.zig) |
| 后量子 KEX | [`src/tls/pq_kex.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/pq_kex.zig) |
| 端点路由 / 生命周期 | [`src/quic/endpoint.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/endpoint.zig) |
| HTTP/3 / QPACK / WebTransport | [`src/h3/`](https://github.com/venjiang/quicz/tree/main/src/h3) |
| 可运行示例 | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| 协议状态与验收证据 | [传输任务矩阵](https://github.com/venjiang/quicz/blob/main/docs/zh-CN/quic_transport_tasks.md) |

## 许可证

MIT。
