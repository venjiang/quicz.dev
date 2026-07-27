---
title: 示例
description: 可运行探针 —— 实用示例、互通与完整 loopback 目录
---

所有命令在仓库根目录运行；每个 `run-*` step 会自动构建。本页覆盖实用示例与互通探针；
完整的核心 transport / TLS / UDP-loopback 目录（60+ 探针）见
[examples 指南](https://github.com/venjiang/quicz/blob/main/examples/README_zh-CN.md)，
`zig build --help` 是自动生成的权威索引。

## 实用示例（真实 UDP / 网络）

| 命令 | 源文件 | 演示内容 |
| --- | --- | --- |
| `run-quic-echo-server` | `quic_echo_server.zig` | 多连接 QUIC echo 服务端，真实 UDP 上的 TLS 1.3 握手。 |
| `run-quic-echo-client` | `quic_echo_client.zig` | QUIC echo 客户端：握手、流读写、关闭。 |
| `run-h3-server` | `h3_server.zig` | HTTP/3 静态响应服务端（SETTINGS + HEADERS + DATA 帧）。 |
| `run-datagram-echo -- --server` | `datagram_echo.zig` | QUIC DATAGRAM (RFC 9221) echo 服务端 —— 不可靠数据报。 |
| `run-datagram-echo -- --client` | `datagram_echo.zig` | QUIC DATAGRAM echo 客户端。 |
| `run-post-quantum-echo -- --server` | `post_quantum_echo.zig` | X25519Kyber768 后量子密钥交换 + QUIC echo 服务端。 |
| `run-post-quantum-echo -- --client` | `post_quantum_echo.zig` | 后量子密钥交换 + QUIC echo 客户端。 |
| `run-zero-rtt-echo` | `zero_rtt_echo.zig` | 0-RTT 会话恢复状态机（PSK、早期数据、重放保护）。 |
| `run-congestion-bench` | `congestion_bench.zig` | 拥塞控制对比：NewReno vs CUBIC vs BBR 模拟丢包场景。 |
| `run-connection-migration` | `connection_migration.zig` | PATH_CHALLENGE / PATH_RESPONSE 往返与路由路径更新。 |

### echo 服务端 + 客户端

```sh
# 终端 1
zig build run-quic-echo-server
# 终端 2
zig build run-quic-echo-client
```

### DATAGRAM echo (RFC 9221)

```sh
zig build run-datagram-echo -- --server
zig build run-datagram-echo -- --client
```

### 后量子 echo

```sh
zig build run-post-quantum-echo -- --server
zig build run-post-quantum-echo -- --client
```

### 独立演示（无需网络）

```sh
zig build run-zero-rtt-echo         # 0-RTT 状态机完整流程
zig build run-congestion-bench      # NewReno / CUBIC / BBR 拥塞窗口对比
zig build run-connection-migration  # PATH_CHALLENGE / RESPONSE 演示
```

## 入口与互通

| 命令 | 源码 | 演示内容 |
| --- | --- | --- |
| `run-server` | `echo_server.zig` | 最小 frame-payload echo server。 |
| `run-client` | `echo_client.zig` | 最小 frame-payload echo client。 |
| `run-tls13-process-interop` | `tls13_process_echo_{client,server}.zig` | 独立纯 Zig TLS/QUIC 进程、两条 FIN stream、路由和 close cleanup。 |
| `run-interop-external-client -- <ip> <port> <ca> [name] [version-negotiation]` | `interop_external_client.zig` | 启用证书校验的 IPv4 对端探针；可选模式验证 v2 到 v1 Version Negotiation。 |
| `run-interop-client -- <host> <port> [testcase]` | `interop_client.zig` | QUIC-Interop-Runner 风格 client 与本地回退探针。 |
| `run-interop-event-loopback -- [case]` | `interop_event_loopback.zig` | TLS-owned UDP 事件循环（handshake、loss、key-update、stream-control 等）。 |
| Go client | `interop/go_echo_client/main.go` | quic-go FIN echo client，`-expect-*` 配合对应并发模式。 |
| Go server | `interop/go_echo_client/echo_server/main.go` | quic-go peer，生成本地 CA PEM、回显两条 FIN stream，可选 `-v1-only`。 |
| Rust client | `interop/rust_echo_client/src/main.rs` | quinn/rustls client 向 Zig server 发送 stream 0、4 的 FIN 数据。 |

Go/Rust 客户端使用本地测试 CA，先启动 Zig server：

```sh
zig-out/bin/quicz-tls13-process-echo-server 127.0.0.1 4443 2 concurrent-retry
(cd examples/interop/go_echo_client && go run . -addr 127.0.0.1:4443 -ca ../testdata/quicz-echo-ca.pem -server-name localhost)
(cd examples/interop/rust_echo_client && cargo run -- 127.0.0.1:4443 ../testdata/quicz-echo-ca.pem localhost)
```

外部 Zig client 对接独立 Go peer：

```sh
(cd examples/interop/go_echo_client && go run ./echo_server -addr 127.0.0.1:4433 -ca-out /absolute/path/to/go-echo-ca.pem)
zig build run-interop-external-client -- 127.0.0.1 4433 /absolute/path/to/go-echo-ca.pem localhost
```

## 本页之外

核心 transport 状态（codec、flow control、stream reset、retry、CID 生命周期、loss/PTO
recovery 等）、TLS 集成（纯 Zig loopback、C-ABI 与 OpenSSL adapter）、UDP lifecycle
loopback 均为已注册的 build step。完整表格见
[examples 指南](https://github.com/venjiang/quicz/blob/main/examples/README_zh-CN.md)，或
`zig build --help`。
