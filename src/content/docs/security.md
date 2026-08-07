---
title: Threat model
description: Trust boundary and defenses against in-scope attacks, with code and test references
---

quicz's threat model: the trust boundary, the attack classes that are in scope,
the defense for each (with code + test references), and the security
responsibilities that an integrator must own. The goal is for a security
auditor to verify each layer of defense by following the references. Mirrors
the repo's [THREAT_MODEL.md](https://github.com/venjiang/quicz/blob/main/THREAT_MODEL.md).

## Scope

- **In scope** — QUIC v1/v2 transport (RFC 9000 / 9369), TLS 1.3 handshake and packet protection (RFC 8446 / 9001), loss recovery and congestion control (RFC 9002), HTTP/3 application layer (RFC 9114).
- **Out of scope** — socket lifecycle (runtime / caller), TLS certificate policy (caller-configured), application logic, deployment firewall / network topology.

## Trust boundary

- **Inbound UDP datagram = hostile.** An attacker fully controls the wire input:
  malformed packets, fragmentation, replay, spoofed source addresses, arbitrary
  injection. Every inbound path is treated as untrusted data, strictly parsed
  then authenticated.
- **The caller (the app embedding quicz) = trusted.** App-supplied config,
  certificates, and callbacks are not attack surface.
- **Boundary** — the datagram feed entry point
  (`endpoint.zig` / `endpoint_lifecycle.zig` `processDatagram` /
  `receiveDatagramStep`). Any byte crossing this boundary must first pass
  length-checked parsing + AEAD/key authentication before it may affect
  connection state.

## Defends against

### Amplification (RFC 9000 §8.1)

- **3× anti-amplification budget** — before address validation the server
  sends at most 3× what it received.
  - Code: `src/quic/connection_rules.zig` (`AntiAmplification`),
    `src/quic/connection.zig` (`antiAmplificationLimitRemaining` /
    `recordPeerAddressBytesReceived`).
  - Tests: `connection_tests.zig` "server anti-amplification limit disarms PTO …".
- **Retry address validation** — server verifies the source address via a Retry
  packet + AEAD-authenticated token; no amplification before validation.
  - Code: `src/quic/endpoint.zig` / `endpoint_lifecycle.zig` (Retry construction
    and token validation), `src/quic/protection.zig` (Retry Integrity Tag).
  - Tests: `connection_tests.zig` retry scenarios, `tls13_server_endpoint_tests.zig`.

### Packet injection / spoofing

- **CID routing + TLS 1.3 AEAD packet protection** — short-header packets route
  by server-issued CID; payload accepted only after AEAD authentication, so
  unauthenticated packets cannot inject into a legitimate flow.
  - Code: `src/quic/protection.zig` (`unprotect*`),
    `src/quic/connection.zig` (`processProtectedShortDatagram`).
  - Tests: `connection_tests.zig` injection / tamper scenarios.
- **Initial keys bound to the Original DCID (RFC 9001 §5.2)** — client Initial
  keys derive from the client-chosen DCID the attacker cannot predict/reuse,
  preventing forged Initial prefixes.
  - Code: `src/quic/protection.zig` (`deriveInitialSecrets`),
    `src/quic/tls13_server_transport.zig` (`setOriginalDestinationConnectionId`).
  - Tests: `connection_tests.zig` Initial key derivation.

### Stateless reset token guessing

- 16-byte stateless reset token (2^128 brute force infeasible), negotiated via
  the NEW_CONNECTION_ID transport parameter.
  - Code: `src/quic/packet.zig` (`matchesStatelessReset`),
    `src/quic/connection.zig`, `src/quic/connection_config.zig`.
  - Tests: `connection_tests.zig`; `examples/stateless_reset.zig`,
    `examples/tls13_stateless_reset_loopback.zig`.

### Version-negotiation downgrade

- `version_information` validation of chosen/available/reserved, rejecting
  downgrade attacks (RFC 9369 §3).
  - Code: `src/quic/connection_version.zig`, `src/quic/connection.zig`.
  - Tests: `quic_v2_test.zig`, `connection_tests.zig` version-negotiation / v2.

### Hostile transport parameter values

- Range checks (max_udp_payload / ack_delay / streams), duplicate detection,
  CID length ≤ 20.
  - Code: `src/quic/connection_config.zig`, `src/quic/connection_rules.zig`.
  - Tests: `connection_tests.zig` transport-parameter validation.
- **max_idle_timeout cap (fixed, commit f7c89b4)** — a hostile peer can send an
  extreme max_idle_timeout; without a cap the ms→ns multiply overflows into a
  meaningless/abnormal deadline. Now capped to a safe upper bound.
  - Code: `src/quic/connection_config.zig` (idle-timeout normalization/cap).
  - Tests: `connection_tests.zig` hostile max_idle_timeout overflow protection.

### Retry token forgery

- Retry tokens are AEAD-authenticated (bound to kind/lifetime/address) and
  cannot be forged.
  - Code: `src/quic/endpoint.zig` / `endpoint_lifecycle.zig`,
    `src/quic/protection.zig`.
  - Tests: `connection_tests.zig` retry-token forgery rejection.

### H3 / QPACK application-layer resource exhaustion (RFC 9114 §4.6 / RFC 9204 §3.2)

HTTP/3 runs on QUIC, so inbound HEADERS / SETTINGS / DATA frames and QPACK
header blocks are hostile too. Bounded-resource limits prevent allocation
amplification from header field counts, frame payloads, header name/value
lengths, and SETTINGS parameter counts:

- **Frame payload size cap** — `decodeFrame` enforces `max_frame_payload_size`
  (16 MiB) on the declared length; oversized frames are rejected before any
  downstream allocation (`validateFrameSize`).
  - Code: `src/h3/frame.zig`, `src/h3/limits.zig`.
  - Tests: `frame.zig` "HTTP/3 oversized frame payload is rejected".
- **Header field count cap** — QPACK decoding writes to a fixed `out_fields`
  array; overflow is `error.TooManyFields` (caller request uses `[32]`).
  - Code: `src/h3/qpack.zig` (`decodeHeaderBlock`), `src/h3/request.zig`.
- **Header name/value length + case** — each field is checked by
  `validateHeaderField` (name ≤ 256, value ≤ 8192, no uppercase).
  - Code: `src/h3/request.zig`, `src/h3/limits.zig`.
  - Tests: `request.zig` "HTTP/3 request rejects uppercase header name".
- **SETTINGS parameter count cap** — `decodePayload` enforces
  `max_settings_params` (32), preventing unbounded SETTINGS DoS.
  - Code: `src/h3/connection.zig`, `src/h3/limits.zig` (`validateSettingsCount`).
  - Tests: `connection.zig` "Settings decode rejects oversized parameter count".
- **QPACK static-table / string bounds** — static-table index and string length
  are validated; out-of-range returns an error rather than overflowing.
  - Code: `src/h3/qpack.zig` (`decodeHeaderBlock` / `decodeString`).

## Integrator responsibilities

Not inside the quicz library — owned by the embedder (runtime / app):

- socket bind / timeout / concurrency caps;
- TLS certificate policy (`ca_bundle`, `server_name`, `insecure_skip_verify`);
- idle-timeout, connection-count, stream-count limits;
- deployment-level protection (firewall, DDoS, NAT handling).

## Residual risks

1. **Fuzz surface is wired but OSS-Fuzz is not hooked in** — `fuzzDriveConnectionStateMachine` (1-RTT connection state-machine interaction) + the C ABI `quicz_fuzz_drive` + `.oss-fuzz/` scaffolding exist (`src/quic/fuzz_c_abi.zig`), but actually joining OSS-Fuzz needs a submission to the oss-fuzz project (external queue, not done from inside this repo).
2. **QPACK dynamic table** — `DynamicTable` has a capacity cap + eviction, but the end-to-end decode path of dynamic-table mutations is not under interaction fuzzing.
3. **Certificate policy defaults** — `insecure_skip_verify` or an empty `ca_bundle` skips verification; that is an integrator responsibility, but the library default should err conservative.

## Attack / defense summary

| Attack | Defense layer | Status |
| --- | --- | --- |
| Amplification | anti-amplification 3× + Retry address validation | implemented + tested |
| Packet injection / spoofing | CID routing + AEAD + Initial keys bound to DCID | implemented + tested |
| Stateless reset token guessing | 16-byte token | implemented + tested |
| Version downgrade | `version_information` validation | implemented + tested |
| Hostile transport parameter | range checks + max_idle_timeout cap | implemented + tested |
| Retry token forgery | AEAD-authenticated | implemented + tested |
| H3/QPACK resource exhaustion | frame / header / settings caps | implemented + tested |