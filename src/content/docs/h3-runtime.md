---
title: HTTP/3 runtime data path
description: How HTTP/3 + QPACK wire into the async runtime, request bodies, and streamed responses
---

How HTTP/3 + QPACK connect into the production I/O runtime (`runtime.Server` /
`runtime.Client`, backed by `std.Io.Threaded`), including the request-body and
streamed-response data path. Mirrors the repo's
[h3-runtime-design.md](https://github.com/venjiang/quicz/blob/main/docs/en/h3-runtime-design.md).

Status: complete (2026-08-08 — runtime wiring + full data path; `run-h3-runtime-loopback`
rounds 1–4 + 1883/1883 unit tests pass).

## H3 is a transport-agnostic state machine

Like quic-zig and zttp, H3 in quicz is a state machine strapped to the QUIC
connection, driven by transport events — it does not run its own network loop.
The established shape for production H3 is an **event-driven pull API**;
blocking on a single stream starves concurrently-arriving QPACK/control streams.

`src/h3/server.zig` / `src/h3/client.zig` are already transport-agnostic (function
pointers `openUniStream` / `sendOnStream` / `recvOnStream`), with QPACK dynamic
table, SETTINGS/GOAWAY, blocked streams, and section ACK closed. What the runtime
added was the **non-blocking-read + wait-any-stream + per-stream buffering**
primitives the H3 state machine needs.

## Request body (server)

`H3Server.feedRequestData(sid, data, fin)` is the streaming entry point: the
headers phase accumulates `RequestStream.wire` until a complete HEADERS frame,
QPACK-decodes (buffering when blocked, retrying once the encoder stream
advances); the body phase aggregates DATA payloads into `rs.body` (cross-frame
halves in `body_wire`). Bodies over `max_request_body_size` (1 MiB) return
`RequestBodyTooLarge` → runtime replies 413 + STOP_SENDING(H3_EXCESSIVE_LOAD).

## Streamed / chunked response (server)

`Response.body_stream: ?ResponseBody` (a pull iterator `{ctx, next_fn,
deinit_fn}` with `fromChunks` / `fromRepeating`) takes precedence over `body`.
`startResponse` sends only HEADERS (fin=true immediately if bodyless); with a
body it registers a `ResponseStream`. `pumpResponses` walks the responses,
sending ≤ `max_chunks_per_pump`(8) chunks of ≤ `max_response_chunk_payload`
(8 KiB) per stream per pump; on `FlowControlBlocked` it retries next pump
without advancing; when the body is exhausted it sends the empty-fin and
`streamDone` releases the request entry.

## Client symmetry

- Receiving: `feedResponseData` aggregates multiple DATA frames (mirroring the
  server's `feedRequestData`); `releaseResponse` frees; runtime `receiveResponse`
  goes through it.
- Sending a request body: `sendRequestStreamed(request, body)` sends
  HEADERS(fin=false) + chunked DATA; on `FlowControlBlocked` it stores
  `pending_sends`, and `pumpSends` retries with an empty-fin once credit
  arrives (the runtime passes through and blocks until the body is drained).

## Design points

- The state machine owns all request/response byte copies
  (`wire` / `body_wire` / `body`); the runtime driver is a byte mover that
  shrinks its own buffers by `consumed`.
- Handlers stay synchronous (`fn(DecodedRequest) Response`); `next_fn` must be
  non-blocking; `deinit_fn` is called by the state machine when the body is
  fully sent or cancelled — a seam for future async (producer-task) bodies.
- `DecodedRequest` / `DecodedResponse` borrow the state machine's buffers; keep
  the stream alive until the response fin, and never free early.

## Invariants

- Existing `runtime.Server` / `runtime.Client` echo and multi-conn paths are
  unchanged; new methods don't change existing API semantics.
- SETTINGS-first, QPACK capacity negotiation, blocked-stream limits, and
  section-ACK/KRC advancement are preserved on the state-machine side.
- Per-connection single-owner; the H3 driver runs synchronously inside the
  handler task, no refcounting added.
- The write path only goes through `runtime.sendStreamData` /
  `openUniStreamRequest` / the drive task — never bypassing the runtime.

## Verification

- `zig build test --summary all` — 1883/1883 unit tests.
- `zig build run-h3-runtime-loopback` — `runtime.Server` + `runtime.Client` over
  real UDP, rounds 1–4 all 200 (GET dynamic QPACK, POST echo streamed request
  body, GET /stream 65536 B chunked response), KRC caught up, pending/protected
  zeroed.
- `zig build run-h3-loopback` — low-level UDP pump regression.
- `zig build run-fuzz` — 100000 iterations, no crashes.