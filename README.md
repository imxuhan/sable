<p align="center">
  <img src="./resources/icon.png" width="88" height="88" alt="Sable" />
</p>

<h1 align="center">Sable</h1>

<p align="center">基于 Electron、ProseMirror 与 CodeMirror 6 编写的本地桌面 Markdown 编辑器。</p>

做这个项目的初衷是给自己日常写文档和论文准备一个干净的工具。

可以直接在 [Releases](https://github.com/imxuhan/sable/releases) 页面下载打包好的压缩包。

Windows 下解压后直接运行 `Sable.exe`。可以在偏好设置里一键注册系统右键菜单和 `.md` 文件图标，也可以在资源管理器里把 `.md` 默认打开方式设为 `Sable.exe`。

## 功能概览

- **语法与学术扩展**。支持 `GFM` 表格、任务列表、`YAML Front Matter`、`[TOC]` 自动目录、`KaTeX` 数学公式、`Mermaid` 图表，以及脚注 `[^1]`、上标 `^2^`、下标 `H~2~O` 与 `[@cite]` 文献引用高亮。
- **本地图片与目录联动**。截图粘贴或拖入外部图片时自动归档至同级 `.assets` 目录并写入相对路径，支持右键比例缩放与拖拽调整宽度。在侧边栏重命名文档时会自动同步修改 `.assets` 目录名与正文图片链接。
- **搜索与视图辅助**。支持 `Outline` 大纲跳转、`File Tree` 全文检索、实时自动保存、窗口尺寸位置记忆、`Ctrl` 加滚轮无级缩放、`Focus Mode`、`Typewriter Mode`，以及带区分大小写、整词匹配、正则表达式的查找与全部替换。
- **主题与多格式导出**。内置 `GitHub`、`Newsprint`、`Night`、`Minimal` 四套基于 `--sable-*` 变量的主题并支持加载本地 `.css` 文件。支持直接导出矢量 `PDF` 与单文件 `HTML`，本机安装 `Pandoc` 后可配合 `.bib` 导出 `.docx` 与 `.tex`。

## 本地开发

需要 Node.js 20 及以上版本。

```bash
npm install
npm run dev      # 启动开发窗口
npm test         # 运行单元测试
npm run pack     # 构建并生成 release/Sable 独立可执行程序
```

## 许可证

[MIT](./LICENSE)