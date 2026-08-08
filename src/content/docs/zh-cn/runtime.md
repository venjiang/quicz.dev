---
title: 运行时设计
description: I/O 运行时为何存在、其 streaming 模型，以及它不是什么
---

quicz 的协议层是**状态机库**：`Connection` / `EndpointConnectionLifecycle` /
`EndpointConnectionRegistry` 都不持有 socket / I/O / 线程，I/O 由调用方驱动。**I/O 运行时**
是拥有 socket、驱动连接、管理生命周期、提供 **streaming 应用接口**的那一层。镜像自仓库
[io_runtime_design.md](https://github.com/venjiang/quicz/blob/main/docs/zh-CN/io_runtime_design.md)。

**定位**：I/O 运行时是**库完整性基础设施**，不是吞吐优化。实测吞吐受单核包处理 CPU 限制
（服务端容量 ~900 MB/s），I/O 模型变更（同步/异步/分区）仅 ~1.2x 收益；线性扩展需多核并行
包处理（多 worker 分区）。

## 设计

quicz 已有 `Tls13ServerEndpoint`/`Tls13ClientEndpoint`（封装握手 + DCID 路由）；I/O 运行时
给它们加上 **streaming 外壳**：

- **I/O 层** —— `std.Io`（跨平台；Linux io_uring/sendmmsg、macOS kqueue；无第三方依赖）。
- **驱动模型** —— `std.Io` 异步（`Group.concurrent` 任务 + `Condition` 协调）。
- **应用接口** —— **streaming 模型**（`accept` / `receive` / `send`）；应用通过 streaming API
  处理连接，**不是 callback**。

```zig
const Server = struct {
    pub fn init(alloc, io, config) !Server;
    pub fn drive(self) Cancelable!void;             // 连接驱动任务
    pub fn accept(self) !u64;                       // 接纳连接，返回 id
    pub fn receiveStreamData(self, conn_id, buf) !usize;
    pub fn sendStreamData(self, conn_id, stream_id, data) !void;
};

const Client = struct {
    pub fn init(alloc, io, config) !Client;
    pub fn connect(self) !void;                     // 握手
    pub fn send(self, data, fin) !u64;              // 开流并发送，返回 id
    pub fn receive(self, stream_id, buf) !?usize;
    pub fn runEchoSession(self, payload) !bool;
};
```

**协调机制**：驱动任务跑在 `Group.concurrent`（std.Io 线程池），处理包（同步、CPU-bound）
后把接纳的连接/流数据推入按 connection id 分区的队列并 `Condition.signal`；应用的
`accept`/`receiveStreamData` 在队列上 `Condition.wait`，与驱动任务并发。

## 连接驱动任务

```
drive()（Group.concurrent 任务，循环）：
1. recv：std.Io receiveTimeout 收 datagram
2. routeAndProcess：feedDatagram 按 DCID 路由；新连接握手接纳，已有连接 process
3. push：recvOnStream 读到的流数据推入对应连接队列，Condition.signal 唤醒应用
4. send：drain 连接的产出包（ACK/数据）发到对端
```

## 复用的 quicz 组件

| 组件 | 来源 |
| --- | --- |
| I/O | `std.Io`（标准库，跨平台） |
| 连接状态机 | `Connection` |
| 连接注册/路由 | `EndpointConnectionRegistry` + `EndpointConnectionLifecycle` |
| TLS | `Tls13Backend` |

## 实现阶段

- **Phase 0（已完成）** —— async streaming 单连接 server/client（`Server.drive` +
  `accept`/`receiveStreamData`/`sendStreamData`），已验证真实握手 + echo。
- **Phase 1（多连接）** —— 按 connection id 分队列，`EndpointConnectionRegistry` 路由接纳
  多连接；完整双向 stream handle。
- **Phase 2（多 worker 分区，追扩展）** —— 连接分区到多个 std.Io worker 并行**处理包**。
  这是线性扩展的关键，非 I/O 运行时本身。

## 与吞吐的关系（实测结论，避免误区）

- I/O 运行时（异步/分区）仅 ~1.2x 收益（已实测：Group.concurrent vs thread-per-connection）。
- 吞吐受单核包处理 CPU 限制（~900 MB/s 容量）。
- 线性扩展 = 多核包处理分区；loopback 测试难体现真实收益。