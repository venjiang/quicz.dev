---
title: 网络基准
description: 如何在真实网络（跨主机、丢包、拥塞）下对 quicz 做基准
---

在真实网络（跨主机、丢包、拥塞）下对 quicz 做基准的指南，区别于[性能](/zh-cn/performance/)页的
loopback 测量。这些运行需要 Linux 主机，在 loopback 环境之外执行。镜像自仓库
[network-benchmark.md](https://github.com/venjiang/quicz/blob/main/docs/en/network-benchmark.md)。

## 工具

| 工具 | 用途 |
| --- | --- |
| `examples/multi_client_bench.zig`（`run-multi-client-bench`） | N 并发 client vs 单 server：握手延迟 + 聚合吞吐 |
| `examples/quic_bench_hs.zig`（`run-quic-bench-hs`） | 真实握手吞吐 + echo 延迟 |
| `tc` / `netem`（Linux） | 模拟丢包、延迟、抖动、带宽 |
| `iperf3` | 校验原始 TCP/UDP 链路容量以便公平对比 |

务必 **ReleaseFast** 构建——Debug 构建是测量伪影（编译器 codegen，非库逻辑）：

```bash
zig build -Doptimize=ReleaseFast
zig build run-multi-client-bench -Doptimize=ReleaseFast
```

## 跨主机：client 在 A，server 在 B

server 默认监听 loopback。要接受远端 client，绑定所有接口：

```zig
var server = try Server.init(allocator, io, .{
    .port = 4433,
    .alpn = &.{"hq-interop"},
    .cert_der = &certificate_der,
    .private_key = &server_private_key,
    .bind_addr = .{0, 0, 0, 0},   // 监听所有接口
});
```

B（server）：`zig build run-io-echo -Doptimize=ReleaseFast`（或 `run-h3-server` 用 H3）。
A（client）把 `Client.Config.server_host` 指向 B 的 IP：

```zig
var client = try Client.init(allocator, io, .{
    .server_host = .{ 10, 0, 0, 2 },   // 主机 B
    .server_port = 4433,
    .server_name = "host-b",
    .alpn = &.{"hq-interop"},
});
```

> **Linux x86_64**：用 **RSA 证书**（Zig 0.16 `std.crypto` 在 x86_64 上对
> P-256/P-384/Ed25519 签名验证有已知 codegen bug）。

## Docker 跨主机验证（2026-08-08 已验证）

同一 Docker bridge 网络上的两个 quicz Linux 容器充当独立主机（不同网络命名空间、真实非
loopback 路径）：

```bash
zig build-exe -target x86_64-linux-musl --dep quicz \
    -Mroot=examples/multi_client_bench.zig -Mquicz=src/lib.zig \
    -OReleaseFast -lc --name qmc-bench-x64

docker run -d --name bench-server --network bridge --entrypoint sleep <img> infinity
docker run -d --name bench-client --network bridge --entrypoint sleep <img> infinity
docker cp qmc-bench-x64 bench-server:/root/ && docker cp qmc-bench-x64 bench-client:/root/

docker exec -d bench-server /root/qmc-bench-x64 server
docker exec bench-client /root/qmc-bench-x64 client <bench-server-IP>
```

已验证（2 容器，Linux x86_64，ReleaseFast，ECDSA 证书）：

```
multi-client bench: ok=8/8 avg_connect=320 ms  aggregate=1.1 Mbit/s (host=192.168.215.2)
```

8/8 并发跨主机握手 + echo 成功。低聚合反映容器 bridge 网络（小 cwnd × 握手 RTT + docker 软件
转发），非协议缺陷——生产数字请跑裸机。

## 用 netem 模拟丢包 / 延迟 / 拥塞

`tc` / `netem` 塑造出口接口：

```bash
# 单向延迟 10ms，1% 丢包，4 MB/s 带宽
tc qdisc add dev eth0 root netem delay 10ms loss 1% rate 4mbit
tc qdisc del dev eth0 root   # 重置
```

1% 丢包下 quicz 可恢复（8/8 并发跨主机握手完成）；`error.UnknownConnectionId` 日志是
server 对已回收/未知连接的传输重传——连接仍完成。5% 丢包 + 20ms 场景受限于基准缺少每 client
握手超时，而非协议缺陷。

### 丢包 vs 恢复

```bash
for loss in 0 0.5 1 3 5; do
    tc qdisc add dev eth0 root netem loss "${loss}%"
    zig build run-quic-bench-hs -Doptimize=ReleaseFast 2>&1 | tee /tmp/hs_loss${loss}.log
    tc qdisc del dev eth0 root
done
```

### 延迟受限 RTT

固定延迟下，聚合吞吐受 `cwnd / RTT` 限制。调高
`initial_max_data` / `initial_max_stream_data` 并允许拥塞窗口增长。

## 多 client 并发（跨主机）

```bash
zig build run-multi-client-bench -Doptimize=ReleaseFast
```

loopback 参考：

```
multi-client bench: ok=8/8 avg_connect=3 ms  aggregate=628.6 Mbit/s
```

跨真实网络，`avg_connect` 变为 RTT 受限（约 1.5× RTT 握手）且聚合反映路径的 `cwnd/RTT` 上限。

## 记录结果

每次运行记录平台 + commit 元数据，沿用 loopback 套件的 `bench_results/<UTC 时间戳>_<commit>.log`
约定：

```bash
BENCH_DIR=bench_results/$(date -u +%Y%m%dT%H%M%SZ)_$(git rev-parse --short HEAD)
mkdir -p "$BENCH_DIR"
```

## 信任一个数字前的清单

1. `-Doptimize=ReleaseFast` 构建（绝不用 Debug）。
2. 用 `iperf3` 校验原始路径；quicz 每连接应落在链路 UDP/TCP 上限的合理因子内。
3. Linux x86_64 用 RSA 证书。
4. 关闭竞争流量；跨运行对比时固定 CPU。
5. 明确报告丢包/延迟/RTT——没有路径属性，「吞吐」无意义。