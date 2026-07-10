# Astro Theme maojiaoyu

[English](./README.md) | 简体中文

> [!CAUTION]
> 这个项目正在快速迭代，自动合并可能会覆盖你本地的定制内容。更新时请不要直接使用 `git pull`，而是先执行 `git fetch`，再通过 `git merge --no-commit` 手动检查并控制合并结果。

<div align="center">
  <img src="./logo.png" alt="Astro Theme Iris Logo" width="200">
</div>

---

## 展示图

**示例博客**: [https://maojiaoyu.com/](https://maojiaoyu.com/)

<!-- > [!NOTE]
> 已知问题：Header 与自定义选项仍在开发中，模板目前已暴露可供修改。

<div align="center">
  <img src="./index.png" alt="首页展示" width="100%">
  <p><em>首页全屏展示与动画效果</em></p>
</div>

<div align="center">
  <img src="./search.png" alt="搜索功能展示" width="100%">
  <p><em>强大的搜索预览系统 - 支持分类筛选、实时预览、滚动标记</em></p>
</div>

<div align="center">
  <img src="./function.png" alt="功能展示" width="100%">
  <p><em>双链预览、Graph View 与知识图谱</em></p>
</div> -->

---

## 猫角域模板说明

- 本项目基于 [astro-theme-iris](https://github.com/LemonAdorable/astro-theme-iris) 进行了定制，具备原博主理念：**博客**、**简介**与**知识库**结合，打造一个功能强大的个人知识管理系统。

### 核心特性

#### 🔍 强大的搜索系统

- **FlexSearch 全文搜索**：支持中文、英文等多种语言的高性能搜索
- **三栏预览布局**：搜索结果、内容预览、滚动标记一体化
- **多维度筛选**：支持按时间范围、标签、类型（文章/文档）筛选
- **实时高亮**：搜索结果实时高亮，支持滚动定位

#### 双链系统（Wikilinks）

- **多级预览**：使用 Tippy.js 实现类似 Quartz 的多层预览功能
- **智能定位**：支持反向链接与反向定位引用
- **流畅交互**：支持嵌套预览

#### 知识图谱（Graph View）

- **D3.js 有向图**：可视化页面之间的关联关系
- **本地/全局视图**：支持查看当前页面的局部图谱或全站全局图谱
- **节点类型**：区分文章、文档、标签、目录等不同类型
- **交互式操作**：支持拖拽、缩放、点击跳转

#### 界面优化

- **全屏主页**：沉浸式首页设计，支持动画效果
- **渐变背景**：文章卡片采用淡紫色渐变背景
- **交互动画**：头像与友链的交互动画效果
- **响应式设计**：适配桌面端和移动端

#### 评论系统

- **Giscus 集成**：基于 GitHub Discussions 的评论系统

#### Mermaid 集成

- **Mermaid 支持**：用于绘制流程图和结构图

#### Typst 排版系统

- **Typst 支持**：支持在 MDX 中原生渲染高质量的数学公式、矢量图表与学术排版

### 快速开始

#### 选项 1：作为模板使用（推荐）

1. 直接fork本仓库。
2. 将新仓库克隆到本地。
3. 安装依赖并开始开发：
   ```shell
   bun install # 或 npm install
   bun dev     # 或 npm run dev
   ```

#### 选项 2：手动安装

```shell
# 克隆仓库
git clone https://github.com/maojiaoyu/maojiaoyu.github.io.git
cd maojiaoyu.github.io 

# 安装依赖
bun install # 或 npm install
```

### 🔄 更新主题

要获取 maojiaoyu 主题的最新功能和修复：

```shell
# 添加上游仓库（只需执行一次）
git remote add upstream https://github.com/maojiaoyu/maojiaoyu.github.io.git

# 获取并合并 main 分支更新
git fetch upstream main
git merge upstream/main --allow-unrelated-histories
# 合并后记得删除原来的blog文件
```

> [!TIP]
> `--allow-unrelated-histories` 仅在第一次合并且历史记录不相关时需要。后续更新可以直接使用 `git pull upstream main`。

### 📝 待办事项

- [ ] 英文或多语言支持
- [ ] 首页简历功能
- [ ] 打包主题以及新增的各种组件
- [ ] 更多文档和示例
- [ ] 字体库更改为本地字体库，避免网络原因导致加载失败
- [ ] vercel部署强制跳转https
- [ ] 修正giscus参数传递问题

### 📚 仓库结构

```
Iris Theme (LemonAdorable/astro-theme-iris)
  └── main branch (Upstream)
      ↓ (fetch & merge)
Your Blog Repository
  └── main branch (Your content + Iris components)
```

### 🙏 致谢

本项目基于以下优秀的开源项目：

- **[astro-theme-iris](https://github.com/LemonAdorable/astro-theme-iris)** - 基础主题框架
- **[astro-theme-pure](https://github.com/cworld1/astro-theme-pure)** - 基础主题框架
- **[FlexSearch](https://github.com/nextapps-de/flexsearch)** - 高性能全文搜索引擎
- **[Tippy.js](https://atomiks.github.io/tippyjs/)** - 强大的工具提示库
- **[D3.js](https://d3js.org/)** - 数据可视化库
- **[Quartz](https://quartz.jzhao.xyz/)** - 知识库主题设计理念参考
- **[Obsidian](https://obsidian.md/)** - 双链笔记理念参考

### 📞 联系方式

如有问题或建议，欢迎通过邮件联系。

### 📋 使用说明

#### 搜索功能

- 按 `Ctrl+K` 或 `Cmd+K` 打开搜索框
- 支持中文、英文全文搜索
- 可通过时间范围、标签、类型进行筛选
- 点击搜索结果可跳转到对应页面
- 右侧预览区域支持滚动标记定位

#### 双链预览

- 在文章中使用 `[[链接文本]]` 或 `[[链接|显示文本]]` 创建双链
- 鼠标悬停在双链上可预览链接内容
- 支持多层嵌套预览
- 预览框支持交互，可点击链接跳转

#### 知识图谱

- 文章和文档页面侧边栏显示 Graph View
- 点击节点可跳转到对应页面
- 支持拖拽节点调整布局
- 点击右上角按钮可查看全站全局图谱

### ⚙️ 配置说明

主要配置文件位于 `src/site.config.ts`，可以配置：

- 站点基本信息（标题、描述、作者等）
- 社交链接
- 评论系统（Giscus/Waline）
- 其他主题选项

#### 本地字体

当前项目已改为使用仓库内的本地字体文件，而不是远程 Google Fonts。

- 字体文件位于 `public/fonts/noto-sans/`
- 字体注册规则定义在 `src/assets/styles/global.css`
- 全局字体变量应用在 `src/components/BaseHead.astro`

如果想切换为其他本地字体：

1. 将 `.ttf` 或 `.otf` 字体文件放入 `public/fonts/`
2. 在 `src/assets/styles/global.css` 中添加 `@font-face` 规则
3. 更新 `--font-satoshi` 变量指向新的字体族
4. 重新构建站点：`bun run build`

### 📄 许可证

本项目基于 [Apache 2.0 许可证](https://github.com/maojiaoyu/maojiaoyu.github.io/main/LICENSE) 开源。

### ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=maojiaoyu/maojiaoyu.github.io&type=Date)](https://star-history.com/#maojiaoyu/maojiaoyu.github.io&Date)
