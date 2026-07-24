---
title: Logo & brand
description: The quicz mark, what it means, the single brand color, and usage rules
---

The quicz mark fuses the two things the project is: a **QUIC** transport and a
**Zig** implementation. It is one glyph, one color, identical in light and dark.

## The mark

<div style={{display:'flex', gap:'1rem', flexWrap:'wrap'}}>
  <div style={{background:'#ffffff', border:'1px solid #e3e6ea', padding:'1.75rem', borderRadius:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem', minWidth:'170px'}}>
    <svg width="88" height="88" viewBox="0 0 48 48" role="img" aria-label="quicz mark on light"><path fillRule="evenodd" d="M24 5 L40.6 14.5 L40.6 33.5 L24 43 L7.4 33.5 L7.4 14.5 Z M27 12 L17 26 L23 26 L19 37 L31 22 L25 22 Z" fill="#10a391"/></svg>
    <span style={{color:'#14171c', fontSize:'13px'}}>On light</span>
  </div>
  <div style={{background:'#13161b', padding:'1.75rem', borderRadius:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem', minWidth:'170px'}}>
    <svg width="88" height="88" viewBox="0 0 48 48" role="img" aria-label="quicz mark on dark"><path fillRule="evenodd" d="M24 5 L40.6 14.5 L40.6 33.5 L24 43 L7.4 33.5 L7.4 14.5 Z M27 12 L17 26 L23 26 L19 37 L31 22 L25 22 Z" fill="#10a391"/></svg>
    <span style={{color:'#e7e9ee', fontSize:'13px'}}>On dark</span>
  </div>
</div>

## What it means

- **Hexagon** — a protocol / network node: the QUIC connection.
- **Lightning bolt** — Zig's signature shape, cut as negative space so the mark stays a single color.
- **The bolt as the tail** — reads as a lowercase *q* for *quicz*, and as a packet in flight.
- **One teal** — the same fill on every surface, in every theme. No light/dark variant of the mark.

## Brand color

<div style={{display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'stretch'}}>
  <div style={{background:'#10a391', color:'#ffffff', padding:'1.25rem 1.5rem', borderRadius:'12px', minWidth:'170px', fontFamily:'ui-monospace, monospace'}}>
    <div style={{fontSize:'22px', fontWeight:700}}>#10A391</div>
    <div style={{fontSize:'12px', opacity:.9}}>teal · rgb(16, 163, 145)</div>
  </div>
</div>

`#10a391` is the brand color for the mark, links, focus states, and buttons, in
both themes. It is the brightest teal that still keeps **white text legible on a
solid block** (≈3:1) — push it brighter and white labels wash out. As body link
text on a white background it sits around 3.2:1, the unavoidable cost of using a
single color across light and dark.

## Favicon

The browser tab uses the same mark (`public/favicon.svg`), single color, no
light/dark split.

## Usage

**Do**

- Use the mark exactly as-is, one color, on light or dark.
- Keep clear space around it (at least the height of one hexagon edge).
- Place it on solid, calm backgrounds.

**Don't**

- Don't recolor it per theme — the whole point is one color.
- Don't put the bolt back as a second color; the negative space is intentional.
- Don't stretch, rotate, or add drop shadows / gradients.
- Don't set it on busy photography or low-contrast backgrounds.

## Files

- Mark (light header): [`src/assets/logo-light.svg`](https://github.com/venjiang/quicz.dev/blob/main/src/assets/logo-light.svg)
- Mark (dark header): [`src/assets/logo-dark.svg`](https://github.com/venjiang/quicz.dev/blob/main/src/assets/logo-dark.svg)
- Favicon: [`public/favicon.svg`](https://github.com/venjiang/quicz.dev/blob/main/public/favicon.svg)

Both header files carry the same `#10a391` fill; they exist as a pair only so the
theme switcher has a slot to point at.
