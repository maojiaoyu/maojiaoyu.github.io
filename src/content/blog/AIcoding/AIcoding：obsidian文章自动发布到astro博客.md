---
aliases: null
tags:
- 发表
- aicoding
- obsidian
简介: null
Next: null
进度: null
创建时间: null
修改时间: null
title: AIcoding：obsidian文章自动发布到astro博客
description: 自动把 Obsidian 笔记校验、转换并同步到 Astro 博客 Git 仓库的命令行 / Obsidian 插件工具。
publishDate: '2026-07-22T00:00:00'
updatedDate: '2026-07-22T00:00:00'
heroImage:
  src: /src/content/blog/default.jpg
  alt: 猫角域blog
language: zh
slug: aicoding-obsidian-auto-published-to-astro
draft: false
comment: true
path: /AIcoding
---

## Obsidian -> Astro Sync

> 自动把 Obsidian 笔记校验、转换并同步到 Astro 博客 Git 仓库的命令行 / Obsidian 插件工具。

详情访问[https://github.com/maojiaoyu/obsidian_to_astro_sync](https://github.com/maojiaoyu/obsidian_to_astro_sync)

支持 Frontmatter 严格校验、Obsidian 专属语法转 Markdown、图片资源自动拷贝、增量同步与 Git 自动提交，让「在 Obsidian 写 → 在 Astro 发布」形成一条无需手动复制粘贴的稳定流水线。

---

## 目录

- [核心特性](#核心特性)
- [项目逻辑](#项目逻辑)
- [Markdown 转换规则](#markdown-转换规则)
- [Frontmatter Schema](#frontmatter-schema)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [使用方法](#使用方法)
- [配置参考](#配置参考)
- [运行测试](#运行测试)
- [常见问题](#常见问题)
- [发布历史](#发布历史)
- [许可证](#许可证)

---

## 核心特性

- **Frontmatter 严格校验**：基于 Pydantic v2，缺字段 / 格式错误会立即报错并跳过该文件。
- **Obsidian 语法转换**：Wiki Link、Note Embed、高亮、Callout、注释，全部转为 Markdown / HTML。
- **图片资源自动处理**：扫描引用、从 Vault 全局查找、拷贝到 Astro 资源目录并重写路径。
- **代码区域保护**：代码块与行内代码中的示例不会被误转换。
- **增量同步**：基于 `.sync_state.json` 的时间戳，只处理上次同步后修改过的文件。
- **Git 自动提交**：处理成功后自动 `add → commit → push` 到 `origin/main`；任意文件出错都会中止提交。
- **双入口**：既可作为 CLI 运行，也可在 Obsidian Python 插件中零参数调用。
- **错误隔离**：单篇文件失败不影响其它文件，错误汇总输出并写入 `.sync_errors.md`。

---

## 项目逻辑

整个同步流程由 `AstroSync.run()` 统一编排，分为五个阶段：

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. 发现     │ -> │  2. 校验      │ -> │  3. 转换     │ -> │  4. 写入      │ -> │  5. Git 提交  │
│  增量扫描    │    │  Frontmatter │    │  Markdown   │    │  目标文件     │    │  add/commit  │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### 1. 发现（`discover_changed_files`）
- 读取 Vault 子目录（`obsidian_vault_path / obsidian_subfolder`）下所有 `.md` 文件。
- 读取 `.sync_state.json` 中的 `last_sync_timestamp`，仅保留 `mtime` 大于该时间戳的文件。
- 状态文件不存在或解析失败时，自动退化为全量扫描。

### 2. 校验（`process_file` → `ArticleFrontmatter`）
- 用 `python-frontmatter` 解析文件头。
- `draft: true` 的文章直接跳过。
- 把 metadata 喂给 Pydantic 模型做严格校验，失败则记录错误、跳过该文件。

### 3. 转换（`convert_markdown`）
按固定顺序执行，避免规则互相冲突：

1. **保护代码区域** —— 把代码块 / 行内代码替换为占位符。
2. **移除注释** —— `%%...%%`（可跨行）。
3. **重写图片路径** —— 先于 embed，避免 `![[a.png]]` 被当成笔记 embed。
4. **转换 embed** —— `![[note]]` → 笔记超链接。
5. **转换 wiki link** —— `[[target|display]]` → Markdown 链接。
6. **转换高亮** —— `==text==` → `<mark>text</mark>`。
7. **转换 callout** —— `> [!type] title` → `> **title**`。
8. **恢复代码区域** —— 把占位符换回原文。

转换前会先扫描整个子目录构建 `slug_index`（笔记名 → slug 映射），用于 wiki link 与 embed 的目标解析。

### 4. 写入（`_target_path_with_title`）
- 输出路径：`{astro_repo_path}/src/content/blog/{path}/{title}.md`。
- `frontmatter.path` 若带 `src/content/blog/` 或 `blog/` 前缀会被剥离，避免重复嵌套。
- 文件名取 `title`，其中的 `/ \ : * ? " < > |` 会被替换成 `-`。
- 同时把引用到的图片拷贝到 `{astro_repo_path}/src/assets/images/{slug}/`。
- 旧版路径残留文件会被自动清理（`_legacy_target_path`）。

### 5. Git 提交（`git_commit_and_push`）
- `git add` 目标文件 + `src/assets/images` 目录。
- 提交信息：`docs: sync obsidian notes (YYYY-MM-DD HH:MM)` + 变更文件清单。
- `git push origin main`，带 `kill_after_timeout` 超时保护（默认 30 秒）。
- **重要**：只要存在任意错误，整个 Git 阶段都会被跳过，本地 commit 也不会产生。
- 全程无错误时才更新 `.sync_state.json` 的时间戳。

### 状态与错误处理

| 文件 | 位置 | 作用 |
| --- | --- | --- |
| `.sync_state.json` | Vault 根目录 | 记录上次成功同步时间戳 |
| `sync_errors.log` | Vault 根目录 | 完整错误日志（含 DEBUG） |
| `.sync_errors.md` | Vault 根目录 | Obsidian 模式下的人读错误摘要 |

### 入口

| 入口 | 函数 | 说明 |
| --- | --- | --- |
| CLI | `main()` | 支持 `--config` / `--verbose`，自动解析配置路径 |
| Obsidian 插件 | `run_sync_from_obsidian()` | 零参数调用，自动定位 config.yaml，通过 `obsidian.notice` 回显结果 |

配置文件解析顺序（`_resolve_config_path`）：`--config` 参数 → `OBSIDIAN_SYNC_CONFIG` 环境变量 → 当前目录 `config.yaml` → 脚本所在目录 `config.yaml` → `OBSIDIAN_VAULT_PATH` 下的 `config.yaml`。

---

## Markdown 转换规则

| Obsidian 语法 | 转换结果 | 说明 |
| --- | --- | --- |
| `%%comment%%` | （移除） | 支持跨行 |
| `==text==` | `<mark>text</mark>` | |
| `> [!note] Title` | `> **Title**` | type 丢弃；title 为空则只留 `>` |
| `[[Target\|display]]` | `[display](../{target_slug}.md)` | 找不到目标时保留原文并报错 |
| `[[Target]]` | `[Target](../{target_slug}.md)` | display 缺省取 target 文件名 |
| `![[Note]]` | `[📄 Note]({blog_base_url}/{note_slug})` | 笔记 embed 转超链接 |
| `![[image.png\|alt]]` | `![alt](/src/assets/images/{slug}/image.png)` | 同时拷贝图片 |
| `![alt](image.png)` | `![alt](/src/assets/images/{slug}/image.png)` | 本地路径重写 |
| `![alt](https://...)` | （不变） | 远程 URL 跳过 |

> 代码块（``` ``` / `~~~`）与行内代码（`` ` ``）中的内容**不会**被转换。

---

## Frontmatter Schema

由 `ArticleFrontmatter`（Pydantic v2）严格校验。校验失败的文章会被跳过并记录错误。

### 必填字段

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `title` | string | 最大 60 字符 |
| `description` | string | 最大 160 字符 |
| `publishDate` | datetime | 支持多种格式（见下） |
| `path` | string | 必须以 `/` 开头，不能含空白字符 |

### 可选字段

| 字段 | 类型 | 默认 | 约束 |
| --- | --- | --- | --- |
| `updatedDate` | datetime | `None` | 同 publishDate 格式 |
| `tags` | list[string] | `[]` | 自动去空、去重、转小写 |
| `slug` | string | `None` | 须匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `draft` | bool | `false` | `true` 时跳过同步 |
| `comment` | bool | `true` | |

> 模型 `extra="allow"`：未定义的额外字段（如 `heroImage`）会被原样保留输出。

### 支持的日期格式

```
2024-01-01
2024-01-01 12:00:00
2024/01/01
2024-01-01T12:00:00
2024-01-01T12:00:00+08:00   （含时区 / Z 后缀也支持）
```

### slug 命名规则

- 资源目录命名优先用 `frontmatter.slug`；未提供时取 `path` 的末段。
- 图片会落到 `src/assets/images/{slug}/` 下。

### Frontmatter 示例

```yaml
---
title: 我的第一篇文章
description: 这是测试文章
publishDate: 2024-01-01
tags: [blog, test]
slug: my-first-post
path: /2024/my-first-post
comment: true
draft: false
---
```

---

## 项目结构

```
obsidian_to_astro_sync/
├── obsidian_to_astro_sync.py   # 主程序（转换、校验、同步、入口）
├── config.example.yaml         # 配置模板（提交到仓库）
├── config.yaml                 # 实际配置（已 gitignore，含个人路径）
├── requirements.txt            # 依赖列表
├── .gitignore
├── README.md
└── tests/
    └── test_conversion.py      # 转换规则与目标路径单元测试
```

运行时会在 **Vault 根目录**下自动产生：`.sync_state.json`、`sync_errors.log`、`.sync_errors.md`（均已被 gitignore）。

---

## 快速开始

### 环境要求

- Python ≥ 3.10
- Git
- 一个 Obsidian Vault
- 一个本地 Astro 博客仓库（已 `git init` 且 `remote origin` 指向 GitHub）

### 1. 克隆项目

仓库地址：https://github.com/maojiaoyu/obsidian_to_astro_sync

```bash
git clone https://github.com/maojiaoyu/obsidian_to_astro_sync.git
cd obsidian_to_astro_sync
```

### 2. 创建虚拟环境

Linux / macOS：

```bash
python -m venv .venv
source .venv/bin/activate
```

Windows：

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

跑测试可再装：

```bash
pip install pytest
```

### 4. 配置

```bash
cp config.example.yaml config.yaml
```

编辑 `config.yaml`（字段说明见 [配置参考](#配置参考)）：

```yaml
obsidian_vault_path: "/home/yourname/Obsidian/Vault"
obsidian_subfolder: "blog"
astro_repo_path: "/home/yourname/projects/my-blog"
```

### 5. 首次运行

```bash
python obsidian_to_astro_sync.py --config config.yaml
```

- 有新文章 → 输出 `OK ... -> ...` 并在最后 `Git push complete`
- 无变化 → `No changes to sync.`
- 配置有误 → 直接报错并退出码 2

---

## 使用方法

### 命令行（CLI）

```bash
python obsidian_to_astro_sync.py --config config.yaml
```

| 参数 | 说明 |
| --- | --- |
| `-c, --config <path>` | 指定 config.yaml 路径（不传则按 [入口](#入口) 中的顺序自动查找） |
| `-v, --verbose` | 开启 DEBUG 级别日志 |

退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 同步成功（含「无变更」） |
| `1` | 同步过程中出现错误（已跳过 Git 提交） |
| `2` | 配置错误（找不到 config / 路径不存在） |

环境变量：

| 变量 | 作用 |
| --- | --- |
| `OBSIDIAN_SYNC_CONFIG` | 指定 config.yaml 路径 |
| `OBSIDIAN_VAULT_PATH` | 覆盖 config 中的 `obsidian_vault_path` |

### Obsidian Python 插件

脚本会自动检测运行环境（`importlib.util.find_spec("obsidian")`）。在 Obsidian 插件中调用：

```python
from obsidian_to_astro_sync import run_sync_from_obsidian

run_sync_from_obsidian()
```

特点：
- 零 CLI 参数，自动按 [入口](#入口) 顺序查找 config.yaml。
- 禁止交互式输入，避免 Obsidian UI 阻塞。
- 成功 / 失败通过 `obsidian.notice(...)` 弹出通知。
- 失败时在 Vault 根目录写入 `.sync_errors.md` 供查看。

### 自动化建议

配合 cron / 系统计划任务定期运行 CLI 即可实现无人值守同步：

```bash
0 * * * *  cd /path/to/repo && .venv/bin/python obsidian_to_astro_sync.py -c config.yaml >> /tmp/obsidian-sync.log 2>&1
```

---

## 配置参考

`config.example.yaml` 全部字段：

```yaml
# Obsidian Vault 路径（绝对路径推荐；可用环境变量 OBSIDIAN_VAULT_PATH 覆盖）
obsidian_vault_path: "/absolute/path/to/your/obsidian/vault"

# 仅扫描该子文件夹下的 .md 文件（相对 vault 根目录；留空扫描整个 vault）
obsidian_subfolder: "blog"

# Astro 博客仓库本地路径
astro_repo_path: "/absolute/path/to/your/astro/blog/repo"

# 文章 URL 模板（{slug} 占位，用于 Note Embed 链接生成）
blog_base_url: "https://blog.maojiaoyu.com/blog/{slug}"

# 同步状态文件（相对 vault 根目录）
state_file: ".sync_state.json"

# 错误日志文件（相对 vault 根目录）
error_log: "sync_errors.log"

# Git push 超时保护（秒），避免网络问题导致 Obsidian UI 假死
git_push_timeout: 30
```

> 所有路径建议用**绝对路径**。`state_file` / `error_log` 若给相对路径，会自动落在 Vault 根目录下。

---

## 运行测试

```bash
pip install pytest
pytest tests/ -v
```

测试覆盖：注释、高亮、Callout、Wiki Link、Embed、图片重写、代码区域保护、目标路径生成、`process_file` 端到端写入。

---

## 常见问题

### `Config file not found`
没有 `config.yaml`。执行 `cp config.example.yaml config.yaml` 并填写路径。

### 运行后没有文件被同步
检查以下几点：
- `obsidian_vault_path` / `obsidian_subfolder` 是否正确
- 子目录下是否真的有 `.md` 文件
- 文件是否带了正确的 Frontmatter（必填字段见 [Frontmatter Schema](#frontmatter-schema)）
- 文件是否被设为 `draft: true`
- 之前是否已经同步过（`.sync_state.json` 存在且文件未被改动 → 增量扫描会跳过）

### Wiki Link / Embed 报 “target not found”
`slug_index` 是按 Vault 子目录下的 **文件名（stem）** 索引的。确认目标笔记确实在该子目录中，且文件名与引用一致。

### `Git push` 超时
在 `config.yaml` 调大：

```yaml
git_push_timeout: 60
```

### Git push 被中止
只要有任意一篇文章处理失败，程序会输出 `Aborting git push due to N error(s)` 并跳过提交。查看 `.sync_errors.md` 或控制台错误表，修正后重跑即可。本地文件可能已写入但未提交，下次成功时会一并提交。

### 日期格式不对
支持的格式见 [Frontmatter Schema → 支持的日期格式](#支持的日期格式)。

### 想强制全量重新同步
删除 Vault 根目录下的 `.sync_state.json` 后重跑，即可触发全量扫描。

---

## 发布历史

### v1.0.0

- 从 Obsidian Vault 读取 Markdown 文件
- Frontmatter 校验与规范化（Pydantic v2）
- Obsidian 注释 / 高亮 / Callout / Wiki Link / Embed 转换
- 图片资源拷贝与路径重写
- 代码区域保护（fenced + inline）
- 增量同步（基于 state file 时间戳）
- 自动 Git add / commit / push，错误时中止提交
- CLI 与 Obsidian 插件双入口

---

## 许可证

MIT
