---
title: 标志与品牌
description: quicz 标志、含义、单一品牌色与使用规范
---

quicz 标志把项目的两重身份合为一体：**QUIC** 传输 + **Zig** 实现。一个图形、一种
颜色，明暗完全相同。

## 标志

<div style={{display:'flex', gap:'1rem', flexWrap:'wrap'}}>
  <div style={{background:'#ffffff', border:'1px solid #e3e6ea', padding:'1.75rem', borderRadius:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem', minWidth:'170px'}}>
    <svg width="88" height="88" viewBox="0 0 48 48" role="img" aria-label="quicz 标志（亮色）"><path fillRule="evenodd" d="M24 5 L40.6 14.5 L40.6 33.5 L24 43 L7.4 33.5 L7.4 14.5 Z M27 12 L17 26 L23 26 L19 37 L31 22 L25 22 Z" fill="#10a391"/></svg>
    <span style={{color:'#14171c', fontSize:'13px'}}>亮色底</span>
  </div>
  <div style={{background:'#13161b', padding:'1.75rem', borderRadius:'12px', display:'flex', flexDirection:'column', alignItems:'center', gap:'.6rem', minWidth:'170px'}}>
    <svg width="88" height="88" viewBox="0 0 48 48" role="img" aria-label="quicz 标志（暗色）"><path fillRule="evenodd" d="M24 5 L40.6 14.5 L40.6 33.5 L24 43 L7.4 33.5 L7.4 14.5 Z M27 12 L17 26 L23 26 L19 37 L31 22 L25 22 Z" fill="#10a391"/></svg>
    <span style={{color:'#e7e9ee', fontSize:'13px'}}>暗色底</span>
  </div>
</div>

## 含义

- **六边形** —— 协议 / 网络节点，即 QUIC 连接。
- **闪电** —— Zig 的标志性形状，以负空间镂空，使标志保持单色。
- **闪电即尾部** —— 读作 *quicz* 的小写 *q*，也像一个在途的 packet。
- **单一 teal** —— 任何表面、任何主题都用同一填充色，标志不分明暗版。

## 品牌色

<div style={{display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'stretch'}}>
  <div style={{background:'#10a391', color:'#ffffff', padding:'1.25rem 1.5rem', borderRadius:'12px', minWidth:'170px', fontFamily:'ui-monospace, monospace'}}>
    <div style={{fontSize:'22px', fontWeight:700}}>#10A391</div>
    <div style={{fontSize:'12px', opacity:.9}}>teal · rgb(16, 163, 145)</div>
  </div>
</div>

`#10a391` 是标志、链接、焦点态与按钮的品牌色，明暗通用。它是**白字在实色块上仍可
读**（约 3:1）的前提下最亮的 teal——再亮白字就发虚。作为白底正文链接约 3.2:1，是
「明暗单色」不可避免的代价。

## Favicon

浏览器标签用同一标志（`public/favicon.svg`），单色，不分明暗。

## 使用规范

**应当**

- 原样使用，单色，亮暗皆可。
- 标志周围留白（至少一个六边形边长）。
- 放在纯净、安静的背景上。

**不要**

- 不要按主题换色——单色正是关键。
- 不要把闪电填回第二种颜色；负空间是刻意的。
- 不要拉伸、旋转，或加投影 / 渐变。
- 不要放在杂乱照片或低对比背景上。

## 源文件

- 标志（亮色 header）：[`src/assets/logo-light.svg`](https://github.com/venjiang/quicz.dev/blob/main/src/assets/logo-light.svg)
- 标志（暗色 header）：[`src/assets/logo-dark.svg`](https://github.com/venjiang/quicz.dev/blob/main/src/assets/logo-dark.svg)
- Favicon：[`public/favicon.svg`](https://github.com/venjiang/quicz.dev/blob/main/public/favicon.svg)

两个 header 文件填充同为 `#10a391`；之所以成对存在，只是给主题切换各留一个引用位。
