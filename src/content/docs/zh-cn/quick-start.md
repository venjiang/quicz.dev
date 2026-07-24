---
title: 快速开始
description: 把 quicz 加入 Zig 应用，发出第一个 QUIC frame
---

`quicz` 是一个使用 [Zig](https://ziglang.org/) 实现的实验性 IETF QUIC transport。
目标是先完成可用的 QUIC v1 transport，而不是覆盖所有可选扩展。

## 环境要求

- Zig **0.16.0**（见仓库 `.zigversion`）

## 添加依赖

项目仍处于实验阶段，推荐先以本地 checkout 的方式把 `quicz` 加入应用的
`build.zig.zon`：

```zig
.dependencies = .{
    .quicz = .{ .path = "../quicz" },
},
```

再在应用的 `build.zig` 中把依赖暴露给可执行模块：

```zig
const quicz_dep = b.dependency("quicz", .{
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("quicz", quicz_dep.module("quicz"));
```

## 最小的连接与 frame 使用

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
`pollTx` 返回连接状态机待发送的 QUIC frame payload，**并不是**受保护的 UDP
datagram。需要 TLS-owned 的受保护 UDP transport loop 时，请从
[`tls13_udp_loopback.zig`](https://github.com/venjiang/quicz/blob/main/examples/tls13_udp_loopback.zig)
或[示例指南](/zh-cn/examples/)中的独立进程 echo 程序开始。
:::

## 构建并运行探针

```sh
zig build
zig build test --summary all
zig build run-tls13-udp-loopback
zig build run-tls13-process-interop
```

- `run-tls13-udp-loopback` —— loopback UDP 上验证纯 Zig TLS 握手和 stream 路径。
- `run-tls13-process-interop` —— loopback UDP 上运行独立构建的 Zig client/server。

全部 build step 可用 `zig build --help` 查看。

## 开发入口

| 需求 | 入口 |
| --- | --- |
| 公开连接 API | [`src/lib.zig`](https://github.com/venjiang/quicz/blob/main/src/lib.zig) |
| TLS 1.3 实现 | [`src/quic/tls13.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/tls13.zig) |
| Endpoint 路由与 timer | [`src/quic/endpoint_lifecycle.zig`](https://github.com/venjiang/quicz/blob/main/src/quic/endpoint_lifecycle.zig) |
| 可运行探针 | [`examples/`](https://github.com/venjiang/quicz/tree/main/examples) |
| 协议状态与验收证据 | [传输任务矩阵](https://github.com/venjiang/quicz/blob/main/docs/zh-CN/quic_transport_tasks.md) |

API 仍在演进。`Connection` 是主要公开句柄；详细 lifecycle helper 只在[架构](/zh-cn/architecture/)
文档和任务矩阵中说明，不在这里枚举。

## 许可证

MIT。
