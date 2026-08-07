---
title: 快速开始
description: 把 quicz 加入 Zig 应用，跑起第一个 QUIC / HTTP/3 端点
---

`quicz` 是纯 [Zig](https://ziglang.org/)（0.16）实现的 QUIC / HTTP/3。传输层与应用层
已生产可用（40/41 功能、1820 测试、三实现互通验证）。公开 API 仍可能演进。

推荐的生产 API 是**异步 `std.Io` 运行时**（`quicz.runtime`）：事件驱动 server + 每连接
独立 handler、async client 会话。低层 packet API 供精细控制使用。

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

## I/O 运行时（async，`std.Io`）

`quicz.runtime` 提供基于 Zig 0.16 `std.Io`（线程化）的事件驱动 server/client。server 按
连接 spawn 独立 handler task（std.http 模型）；client 驱动 async 会话。

### 服务端（echo）

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

### 客户端

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

quicz 通过完整的**双向互通矩阵（7/7）**，对 quic-go、quiche、s2n-quic、quinn 四实现。
全部使用启用证书校验的 TLS 1.3，证书为正规 CA（`testdata/quicz-echo-ca.pem`）签发的 CA 签名
leaf（`testdata/cert.pem`），因此严格 webpki 客户端（s2n-quic、rustls/quinn）接受信任链。

| 方向 | 对端 | 结果 |
| --- | --- | --- |
| 正向（quicz client → server） | quic-go / quiche / s2n-quic | echo_bytes=19，证书校验通过 |
| 反向（client → quicz server） | quic-go / quinn / quiche / s2n-quic | echo_streams=2，echo_bytes=10 |

```sh
# 启动 quicz runtime server
zig build && zig-out/bin/quicz-interop-runtime-server 4433 cert.pem key.pem

# 正向：quicz client → 外部 server
zig-out/bin/quicz-interop-runtime-client 127.0.0.1 4433 quicz-echo-ca.pem localhost

# 反向矩阵（外部 client → quicz server），四个对端
examples/interop/run_reverse_interop.sh all 4433
```

## 安全

[`THREAT_MODEL.md`](https://github.com/venjiang/quicz/blob/main/THREAT_MODEL.md)
记录信任边界与范围内攻击的防御（放大、包注入、stateless reset token 猜测、版本降级、
敌意 transport parameter、Retry token 伪造），每项附代码与测试引用。见
[威胁模型](/zh-cn/security/)页。

## 开发入口

| 需求 | 入口 |
| --- | --- |
| 异步 I/O 运行时 | [`src/runtime/`](https://github.com/venjiang/quicz/tree/main/src/runtime) |
| 公开高层 API | [`src/quic/api.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/api.zig) |
| 连接状态机 | [`src/quic/connection.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/connection.zig) |
| 纯 Zig TLS 1.3 | [`src/tls/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/tls13.zig) |
| 后量子 KEX | [`src/tls/pq_kex.zig`](https://github.com/venjiang/quicz/blob/main/src/tls/pq_kex.zig) |
| 端点路由 / 生命周期 | [`src/quic/endpoint.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/endpoint.zig) |
| HTTP/3 / QPACK / WebTransport | [`src/h3/`](https://github.com/venjiang/quicz/tree/main/src/h3) |
| 可运行示例 | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| 协议状态与证据 | [状态](/zh-cn/status/) |

## 许可证

MIT。