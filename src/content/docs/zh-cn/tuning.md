---
title: 生产环境调优
description: quicz 生产部署的 ConnectionConfig 推荐配置
---

quicz 生产部署的推荐配置。所有参数通过 `ConnectionConfig`
（`src/quic/connection_config.zig`）设置。镜像自仓库
[production_tuning.md](https://github.com/venjiang/quicz/blob/main/docs/zh-CN/production_tuning.md)。

## 快速参考

| 参数 | 默认值 | 生产建议值 | 说明 |
| --- | --- | --- | --- |
| `pto_jitter_percentage` | 0 | 20–30 | 防止大量并发连接 PTO 超时同步化。范围 0–50；100+ 并发的服务器建议开启。 |
| `congestion_algorithm` | `.new_reno` | `.cubic` | CUBIC (RFC 9438) + HyStart++ 在高带宽-延迟积路径下吞吐更优。 |
| `initial_rtt_ns` | 333 ms | 按环境调整 | 数据中心 1–5 ms；广域网 50–100 ms。较低值加速初始窗口增长。 |
| `max_ack_delay_ns` | 25 ms | 25 ms | RFC 9000 默认；除非对端协商不同值，否则不改。 |

## PTO jitter

PTO jitter 在基础 Probe Timeout 上添加 ±百分比随机抖动（指数退避之前），打散多连接
共享路径时的超时风暴（NAT 或负载均衡器后方）。

- **0%（默认）** —— 确定性 PTO；单连接与测试适用。
- **20–30%（服务器推荐）** —— 足以打破同步化，不明显延迟恢复。
- **50%（上限）** —— 激进；高丢包路径可能延迟恢复。

结果始终钳制到 RFC 9002 kGranularity 下限（1 ms）。

```zig
var conn = try Connection.init(allocator, .server, .{
    .congestion_algorithm = .cubic,
    .pto_jitter_percentage = 25,
    .initial_rtt_ns = 5_000_000, // 数据中心 5ms
});
```

## 拥塞控制

### CUBIC + HyStart++（推荐）

quicz 的 CUBIC (RFC 9438) 包含：

- **HyStart++ 慢启动** —— 监测 RTT 增长提前退出慢启动（保守慢启动 CSS，÷4 增长，≤5 轮）。
- **快速重传** —— 拥塞事件后立即重传，无需等 PTO。
- **App-limited 检测 (RFC 8312 §5.8)** —— 排除应用受限时段；3×MTU 阈值避免 loopback 误判。
- **PTO jitter** —— 可选随机化 PTO（见上）。

### NewReno

默认算法。更简单但高带宽-高延迟路径效率较低；适合低吞吐控制通道。

### BBR

2026-08 已移除，改用 CUBIC（仓库指南早于移除，仍写「可用但未加固」）。生产请用 CUBIC。

## 初始 RTT

| 环境 | 推荐 `initial_rtt_ns` |
| --- | --- |
| 数据中心（同机架） | 100_000–500_000（0.1–0.5 ms） |
| 数据中心（跨机架） | 1_000_000–5_000_000（1–5 ms） |
| 城域 / CDN 边缘 | 10_000_000–30_000_000（10–30 ms） |
| 广域网 / 跨洲 | 50_000_000–150_000_000（50–150 ms） |
| 未知 / 公网 | 333_000_000（333 ms，默认） |

## 相关文档

- [功能对比](/zh-cn/comparisons/) —— 与其它 QUIC 实现的能力矩阵。
- [性能](/zh-cn/performance/) —— 吞吐与延迟数据。
- [架构](/zh-cn/architecture/) —— 模块布局与设计决策。
