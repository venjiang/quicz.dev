---
title: 示例
description: 可运行探针 —— loopback、独立进程 echo、Go/Rust 互通
---

[`examples/`](https://github.com/venjiang/quicz/tree/main/examples) 下的每个探针
都可以在仓库根目录用一条 `zig build` 步骤运行。完整目录、用途与命令见
[examples 指南](https://github.com/venjiang/quicz/blob/main/examples/README_zh-CN.md)。

## UDP loopback（纯 Zig）

在单进程内、loopback UDP 上验证纯 Zig TLS 1.3 握手与 stream 路径：

```sh
zig build run-tls13-udp-loopback
```

改握手或 packet protection 时先跑这个 —— 不需要第二个进程，也不用管证书。

## 独立进程 Zig 互通

构建独立的 client 与 server 二进制，在 loopback UDP 上互相打：

```sh
zig build run-tls13-process-interop
```

能抓到进程内 loopback 掩盖的假设（序列化、timer、真实 socket 行为）。

## Echo server + Go/Rust 客户端

线路级证据：独立实现的客户端，**开启**证书校验，与 quicz echo server 对话。

构建项目后，先启动本地 Zig echo server：

```sh
zig-out/bin/quicz-tls13-process-echo-server 127.0.0.1 4443 2 concurrent-retry
```

再使用本地测试 CA 运行任一独立实现的客户端：

```sh
(cd examples/interop/go_echo_client && \
   go run . -addr 127.0.0.1:4443 -ca ../testdata/quicz-echo-ca.pem -server-name localhost)

(cd examples/interop/rust_echo_client && \
   cargo run -- 127.0.0.1:4443 ../testdata/quicz-echo-ca.pem localhost)
```

两个客户端只有在 stream 0 和 4 分别完成带 FIN 的 `hello`、`world` echo 后
才会报告成功。仓库内 PEM 只是本地测试信任锚，不是部署凭据。

## 外部协议栈（quic-go、quinn）

quicz 作为 **client** 也与外部 server 通过启用证书校验的互通，并通过
QUIC-Interop-Runner 自测（handshake、transfer、retry）：

```sh
# interop runner 自测
zig build run-interop-client-standalone

# 对接外部 quic-go 或 quinn server
zig build run-interop-external -- SERVER_IP PORT /path/to/cert.pem localhost
```

互通 server 定义位于
[`examples/interop/`](https://github.com/venjiang/quicz/tree/main/examples/interop)：
`go_echo_client`、`quic_go_server`、`quiche_server`、`rust_echo_client`、
`s2n_quic_server`。
