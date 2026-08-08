---
title: HTTP/3 运行时数据路径
description: HTTP/3 + QPACK 如何接入异步运行时、请求体与流式响应
---

HTTP/3 + QPACK 如何接入生产 I/O 运行时（`runtime.Server` / `runtime.Client`，底层
`std.Io.Threaded`），含请求体读取与流式响应数据路径。镜像自仓库
[h3-runtime-design.md](https://github.com/venjiang/quicz/blob/main/docs/en/h3-runtime-design.md)。

状态：已完成（2026-08-08 —— runtime 接线 + 完整数据路径；`run-h3-runtime-loopback`
round1-4 + 1883/1883 单测通过）。

## H3 是与传输无关的状态机

与 quic-zig、zttp 一致，quicz 的 H3 是「贴着 QUIC connection 的状态机」，由 transport 事件
驱动，不自己跑网络循环。生产 H3 的正确形态是**事件驱动 pull API**；阻塞在单个流上会饿死并发
到达的 QPACK/control 流。

`src/h3/server.zig` / `src/h3/client.zig` 已是传输无关状态机（函数指针 `openUniStream` /
`sendOnStream` / `recvOnStream`），QPACK 动态表、SETTINGS/GOAWAY、blocked stream、section ack
已闭环。runtime 补的是 H3 状态机需要的**非阻塞读 + 等任意流活动 + 按流缓冲**原语。

## 请求体读取（server）

`H3Server.feedRequestData(sid, data, fin)` 是流式主入口：headers 阶段累积 `RequestStream.wire`
直到完整 HEADERS 帧，QPACK 解码（blocked 时 `rs.blocked` 累积，encoder 流推进后重试）；body
阶段把 DATA 帧 payload 聚合进 `rs.body`（跨 feed 半帧存 `body_wire`）。超 `max_request_body_size`
（1 MiB）返回 `RequestBodyTooLarge` → runtime 回 413 + STOP_SENDING(H3_EXCESSIVE_LOAD)。

## 流式/分块响应（server）

`Response.body_stream: ?ResponseBody`（vtable pull 迭代器 `{ctx, next_fn, deinit_fn}`，提供
`fromChunks`/`fromRepeating`）优先于 `body`。`startResponse` 只发 HEADERS（bodyless 时 fin=true
直发）；有 body 注册 `ResponseStream`。`pumpResponses` 遍历响应，每流每次 ≤ `max_chunks_per_pump`(8)
个 ≤ `max_response_chunk_payload`(8 KiB) DATA 帧；`FlowControlBlocked` 时下次重试不推进 offset；
body 耗尽后空帧 fin 收尾并 `streamDone` 释放请求条目。

## client 对称

- 收响应：`feedResponseData` 聚合多 DATA 帧（镜像 server `feedRequestData`），`releaseResponse`
  释放；runtime `receiveResponse` 走它。
- 发请求体：`sendRequestStreamed(request, body)` 发 HEADERS(fin=false) + 分块 DATA；
  `FlowControlBlocked` 存 `pending_sends`，`pumpSends` 重试并空帧 fin（credit 到达后）；runtime
  透传并阻塞等 body 发完。

## 设计要点

- 状态机自持全部请求/响应字节副本（`wire`/`body_wire`/`body`）；runtime 驱动只当字节搬运工，
  按 `consumed` 收缩自己的缓冲。
- handler 仍是同步回调（`fn(DecodedRequest) Response`）；`next_fn` 必须非阻塞；`deinit_fn` 由
  状态机在发完或 cancel 时调用——为未来异步（producer-task）body 留 seam。
- `DecodedRequest`/`DecodedResponse` 借用状态机缓冲；保持流存活到响应 fin，不可提前释放。

## 不变量

- 既有 `runtime.Server` / `runtime.Client` 的 echo/multi-conn 成功路径不变；新增方法不改变现有
  API 语义。
- 状态机侧 SETTINGS 先行、QPACK capacity 协商、blocked stream 限额、section ack/KRC 推进全部保留。
- 每连接仍单 owner；H3 驱动在 handler 任务内同步驱动，不新增引用计数。
- 写路径只经 `runtime.sendStreamData` / `openUniStreamRequest` / drive 任务，不绕过 runtime。

## 验证

- `zig build test --summary all` —— 1883/1883 单测。
- `zig build run-h3-runtime-loopback` —— `runtime.Server` + `runtime.Client` 真实 UDP，
  round1-4 全 200（GET 动态 QPACK、POST echo 流式请求体、GET /stream 65536 B 分块响应）、
  KRC 追平、pending/protected 归零。
- `zig build run-h3-loopback` —— 低层 UDP pump 回归。
- `zig build run-fuzz` —— 100000 iterations 无崩溃。