---
title: 状态
description: quicz 的当前状态、覆盖率、里程碑与范围
---

quicz 的当前状态、覆盖率与范围，取自项目 README、功能矩阵与传输任务矩阵。

## 当前状态

传输层与应用层**生产可用**（来自 README）：

- **40/41 功能**、**1820 个单元测试**、零泄漏。
- **双向互通矩阵 7/7**：对 quic-go、quiche、s2n-quic、quinn —— 启用证书校验的 TLS 1.3，
  正规 CA 链。
- **完整 HTTP/3**（SETTINGS、GOAWAY、stream 状态机）、**QPACK** 静态 + 动态表、
  **WebTransport**、**HTTP Datagrams** (RFC 9297)。
- 公开 API 仍可能演进。

## 覆盖率

| 指标 | quicz |
| --- | --- |
| 传输层（19 项） | 19/19 |
| 拥塞控制（8 项） | 7/8（BBR 已移除） |
| 密码套件（5 项） | 5/5 |
| 应用层（6 项） | 6/6 |
| 平台（3 项） | 1/3 |
| **合计（41 项）** | **40/41** |

逐行对比见[功能对比](/zh-cn/comparisons/)页。

## 里程碑

传输任务矩阵将其作为完成定义：

1. 标准矩阵和文档保持最新。
2. RFC 8999 / 9000 的 packet、frame、transport parameter 和 error-code 支持完成。
3. 连接状态机、packet number spaces 和 protected datagram API 可用。
4. RFC 9001 TLS 集成与 packet protection 可建立本地 1-RTT。
5. RFC 9000 transport 行为覆盖 stream、flow control、connection ID、Retry/token、path validation、close/reset。
6. RFC 9002 recovery 与 congestion control 通过可控时钟测试。
7. 分层 examples 和至少一个外部互通路径可用。

## 不在范围内

- **BBR** —— 2026-08 主动移除，改用 CUBIC。
- **FIPS 140-3** —— 仅 quic-go。
- **XDP 零拷贝 I/O** —— 仅 s2n-quic。

## 证据与追踪

- [传输任务矩阵](https://github.com/venjiang/quicz/blob/main/docs/zh-CN/quic_transport_tasks.md) —— 逐功能台账。
- [威胁模型](/zh-cn/security/) —— 信任边界与防御。
- [性能](/zh-cn/performance/) —— quicz 一手基准数字。
- [示例](/zh-cn/examples/) —— 可运行探针与互通命令。

> 任务矩阵的历史 RFC 状态表早于当前生产可用状态，正在对齐中；功能矩阵与 README
> 反映当前代码。