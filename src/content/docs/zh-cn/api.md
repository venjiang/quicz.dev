---
title: API 参考
description: quicz runtime API 与 h3_request 类型参考
---

生产 `runtime` API 与 `h3_request` 类型的参考。所有路径相对 `quicz` 导入根。除非注明，
方法均为 async 内阻塞（挂起调用方 async frame 直到操作完成或连接关闭）。镜像自仓库
[api-reference.md](https://github.com/venjiang/quicz/blob/main/docs/en/api-reference.md)。

## 顶层命名空间（`src/lib.zig`）

```zig
quicz.runtime                      // { server, client, h3_server, h3_client }
quicz.h3_request                   // Request / Response / ResponseBody / decoded types
quicz.h3_server                    // 与传输无关的 H3 服务端状态机
quicz.h3_client                    // 与传输无关的 H3 客户端状态机
quicz.h3 / quicz.qpack / quicz.webtransport / quicz.h3_connection / quicz.h3_limits
quicz.Connection / quicz.Config / quicz.CryptoBackend   // 低层 QUIC
quicz.tls13 / quicz.Tls13ClientEndpoint / quicz.Tls13ServerEndpoint / ...
```

## `runtime.server.Server`

### `Config`

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `port` | `u16` | — | UDP 监听端口（默认 loopback） |
| `alpn` | `[]const []const u8` | — | ALPN 列表，如 `&.{"h3"}` |
| `cert_der` | `[]const u8` | — | DER 证书 |
| `private_key` | `[]const u8` | — | 私钥（`.ecdsa_p256_sha256`；Linux 用 RSA） |
| `prefer_chacha20` | `bool` | `false` | 优先 ChaCha20-Poly1305 |
| `bind_addr` | `?[4]u8` | `null` | 绑定 IPv4；null=`127.0.0.1`，`.{0,0,0,0}`=全部 |

固定 transport params：`initial_max_data`/`stream_data` = 10 MiB，bidi/uni 流 = 128，
`max_datagram_size` = 8192，idle timeout = 30 秒。

### 生命周期

```zig
pub fn init(allocator, io: std.Io, config: Config) !Server
pub fn start(self: *Server) !void              // 幂等；spawn recv+drive 任务
pub fn stop(self: *Server) void                // 置 stopping，唤醒循环
pub fn serve(self: *Server, handler: HandlerFn) !void   // start + 每连接 spawn handler
pub const H3ServeOptions = struct { qpack_max_table_capacity: u64 = 4096, qpack_blocked_streams: u64 = 8 };
pub fn serveH3(self: *Server, options: H3ServeOptions, handler: h3_server.RequestHandler) !void
pub fn deinit(self: *Server) void              // stop + cancel/await drive_group，释放资源
pub const HandlerFn = *const fn (ServerConnection) std.Io.Cancelable!void
pub drive_group: std.Io.Group                   // 字段；await 它阻塞到关闭
```

### 连接 / 流方法（按 `conn_id: u64` 寻址）

| 方法 | 签名 | 语义 |
| --- | --- | --- |
| `accept` | `(self) !ServerConnection` | 阻塞到下一个新连接 |
| `acceptStreamId` | `(self, conn_id) !u64` | 阻塞到流有数据；连接关闭时 `error.ConnectionClosed` |
| `receiveStreamData` | `(self, conn_id, sid, buf) !usize` | 阻塞读；`0`=EOF |
| `tryAcceptStreamId` | `(self, conn_id) !?u64` | 非阻塞；无则 `null` |
| `tryReceiveStreamData` | `(self, conn_id, sid, buf) !?usize` | 非阻塞；`null`=无数据、`0`=EOF、`n`=字节数 |
| `connStreamIds` | `(self, conn_id, out: []u64) usize` | 快照当前接收中的流 id |
| `waitStreamActivity` | `(self, conn_id) !void` | 挂起直到任意流有数据/EOF/新流/连接关闭 |
| `sendStreamData` | `(self, conn_id, sid, data, fin) !void` | 排队发送；drive 任务 drain |
| `stopSendingRequest` | `(self, conn_id, sid, code) !void` | 排队 STOP_SENDING (RFC 9000 §3.5) |
| `openUniStreamRequest` | `(self, conn_id) !u64` | 打开服务端发起的 uni 流 |

错误：`error.NoConnection` / `error.ConnectionClosed` / `error.Canceled`。

### 句柄

```zig
pub const ServerConnection = struct { server: *Server, id: u64 };
pub fn acceptStream(self: ServerConnection) !Stream
pub fn openUniStream(self: ServerConnection) !Stream

pub const Stream = struct { server: *Server, conn_id: u64, id: u64 };
pub fn isUni(self: Stream) bool
pub fn isClientInitiated(self: Stream) bool
pub fn receive(self: Stream, buf: []u8) !usize      // 0 = EOF
pub fn send(self: Stream, data: []const u8, fin: bool) !void
pub fn stopSending(self: Stream, code: u64) !void
```

## `runtime.client.Client`

### `Config`

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `server_host` | `[4]u8` | `{127,0,0,1}` | 远端 IPv4 |
| `server_port` | `u16` | — | 远端端口 |
| `server_name` | `[]const u8` | `"localhost"` | SNI / 证书名 |
| `alpn` | `[]const []const u8` | — | ALPN 列表 |
| `ca_bundle` | `?*const std.crypto.Certificate.Bundle` | `null` | **null = 跳过证书校验** |
| `insecure_skip_verify` | `bool` | `false` | 同样跳过校验 |
| `version` | `quic_packet.Version` | `.v1` | `.v2` 启用 v1+v2 |
| `prefer_chacha20` | `bool` | `false` | 优先 ChaCha20-Poly1305 |

### 方法

```zig
pub fn init(allocator, io: std.Io, config: Config) !Client
pub fn localPort(self: *const Client) u16
pub fn connect(self: *Client) !void        // 启动 recv/drive 任务，阻塞到握手确认
pub fn send(self: *Client, data: []const u8, fin: bool) !u64     // 新建 bidi 流，返回 id
pub fn sendOnStream(self: *Client, sid: u64, data, fin) !void    // 在已有流上发送
pub fn openStream(self: *Client) !u64      // 打开 bidi 流，不带数据
pub fn openUniStream(self: *Client) !u64   // 打开客户端 uni 流（H3 control/QPACK）
pub fn enableH3(self: *Client) void        // 轮询服务端 uni 流（H3 请求前调用）
pub fn initiateKeyUpdate(self: *Client) !void
pub fn receive(self: *Client, sid: u64, buf: []u8) !usize       // 阻塞读，0 = EOF
pub fn tryReceiveStreamData(self: *Client, sid: u64, buf) !?usize  // 非阻塞
pub fn streamIds(self: *Client, out: []u64) usize
pub fn waitStreamActivity(self: *Client) !void
pub fn close(self: *Client) void           // 请求 APPLICATION_CLOSE
pub fn deinit(self: *Client) void          // 停止任务，释放资源
pub fn runEchoSession(self: *Client, payload: []const u8) !bool  // 测试辅助
```

## `runtime.h3_server.H3Server` / `runtime.h3_client.H3Client`

### H3Server（每连接驱动）

```zig
pub fn init(allocator, server: *Server, conn_id: u64, handler: h3_server.RequestHandler,
            qpack_max_table_capacity: u64, qpack_blocked_streams: u64) H3Server
pub fn deinit(self: *H3Server) void
pub fn run(self: *H3Server) std.Io.Cancelable!void   // 服务循环直到连接关闭/取消
```

Body > 1 MiB → 413 + STOP_SENDING(H3_EXCESSIVE_LOAD)。

### H3Client（单连接）

```zig
pub fn init(allocator, client: *Client, qpack_max_table_capacity: u64, qpack_blocked_streams: u64) H3Client
pub fn deinit(self: *H3Client) void
pub fn run(self: *H3Client) !void          // enableH3 + 等 peer SETTINGS
pub fn sendRequest(self: *H3Client, request: h3_request.Request) !u64
pub fn sendRequestStreamed(self: *H3Client, request: Request, body: h3_request.ResponseBody) !u64
pub fn receiveResponse(self: *H3Client, stream_id: u64) !h3_request.DecodedResponse
pub fn drain(self: *H3Client) !void        // drain 服务端 uni 流（decoder ACK 追赶）
```

典型序列：`connect` → `H3Client.init` → `run` → `sendRequest` /
`sendRequestStreamed` → `receiveResponse` → 可选 `drain`。

## `h3_request` 类型

### `Request`

```zig
pub const Request = struct {
    method: []const u8,                 // 必填
    path: []const u8,                   // 必填
    scheme: []const u8 = "https",
    authority: ?[]const u8 = null,
    extra_headers: []const qpack.HeaderField = &.{},
    body: ?[]const u8 = null,           // 单段连续 body
};
```

### `Response`

```zig
pub const Response = struct {
    status: u16,                        // 必填
    extra_headers: []const qpack.HeaderField = &.{},
    body: ?[]const u8 = null,           // 单段 slice → 一个 DATA 帧
    body_stream: ?ResponseBody = null,  // 优先于 body；分块
};
pub fn isSuccess(self: *const Response) bool  // 2xx
```

### `ResponseBody`（拉取迭代器）

```zig
pub const ResponseBody = struct {
    ctx: *anyopaque,
    next_fn: *const fn (ctx: *anyopaque, buf: []u8) anyerror!?usize, // null = 结束；不得阻塞
    deinit_fn: ?*const fn (ctx: *anyopaque) void = null,
    pub fn next(self: ResponseBody, buf: []u8) anyerror!?usize
    pub fn deinit(self: ResponseBody) void
    pub fn fromChunks(allocator, chunks: []const []const u8) !ResponseBody
    pub fn fromRepeating(allocator, byte: u8, total: u64) !ResponseBody
};
```

分块 ≤ 8 KiB（`max_response_chunk_payload`），每流每 pump ≤ 8 块
（`max_chunks_per_pump`）。body 发完或流取消时由服务端调用 `deinit`。

### 解码类型与 handler

```zig
pub const DecodedRequest = struct { method: []const u8, path: []const u8, scheme: []const u8,
                                    authority: ?[]const u8, body: ?[]const u8 };   // 借用状态机缓冲区
pub const DecodedResponse = struct { status: u16, body: ?[]const u8 };
pub fn isSuccess(self: *const DecodedResponse) bool

// h3/server.zig
pub const RequestHandler = *const fn (req: h3_request.DecodedRequest) h3_request.Response;
```

`qpack.HeaderField = struct { name: []const u8, value: []const u8 }`。

## 编码规范

- `DecodedRequest`/`DecodedResponse` 借用状态机缓冲区；保持流存活直到响应 fin 发出。
- 所有协议机非阻塞；`ResponseBody.next_fn` 绝不能阻塞。
- allocator 显式传入；优先 `const`；`defer`/`errdefer` 紧跟在获取之后。