# quicz.dev

[quicz](https://github.com/venjiang/quicz) 的官方站点源码，部署在 [quicz.dev](https://quicz.dev)。

基于 [Astro Starlight](https://starlight.astro.build/) 构建，静态输出，托管于 Cloudflare Pages。

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

## 结构

```
src/content/docs/       英文内容（root locale）
src/content/docs/zh-cn/ 中文内容
astro.config.mjs        站点配置（locales、sidebar、social）
```

内容与 [venjiang/quicz](https://github.com/venjiang/quicz) 仓库的 `docs/` 保持同步：
架构与规范文档从该仓库迁移而来，quicz 侧更新后应同步到本站。

## 本地开发

```sh
npm install
npm run dev        # localhost:4321
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建产物
```

## 部署

推送 `main` 分支后由 Cloudflare Pages 自动构建：
build command `npm run build`，output directory `dist`，自定义域名 `quicz.dev`。
