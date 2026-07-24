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
description: obsidian文章自动发布到astro博客
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

# Obsidian to Astro Sync

将 Obsidian Vault 中的笔记自动校验、转换并同步到 Astro 博客的 本地Git 仓库1。

## 功能概览

- **增量同步**：基于文件 mtime 与上次同步时间戳，仅处理变更文件
- **Frontmatter 校验**：Pydantic 严格 Schema 校验（title / description / path / slug 等）
- **Markdown 转换**：Wiki Links → Markdown Links、Embeds → 超链接、高亮 → `<mark>`、Callouts → Blockquote、Obsidian 注释移除
- **图片资源处理**：自动拷贝到 Astro 资源目录并重写引用路径
- **Git 集成**：自动 add → commit → push（使用 GitPython，非 os.system）
- **Obsidian 集成**：支持插件一键触发，自动通知，错误写入 `.sync_errors.md`

## 前置条件

- Python 3.10+
- Git（已配置好 push 权限的 Astro 博客仓库）
- Obsidian（可选，用于插件触发模式）

## 安装

### 终端安装

```bash
# 克隆或下载脚本到本地
# 安装依赖
pip install -r requirements.txt

# 测试用依赖（可选）
pip install pytest
```

### Obsidian 内安装

若使用 Obsidian Python 插件（如 PyScript / Python Scripter），需在其虚拟环境中安装依赖：

```bash
# 1. 找到 Obsidian Python 插件的虚拟环境路径
#    通常在 ~/.local/share/obsidian/python/ 或插件设置中可见

# 2. 在该虚拟环境中安装依赖
/path/to/obsidian-python/bin/pip install pyyaml pydantic python-frontmatter

# 3. 将 obsidian_to_astro_sync.py 和 config.yaml 放入 Vault 根目录

# 4. 在插件中配置调用：run_sync_from_obsidian()
```

> **注意**：Obsidian Python 插件环境可能不支持 GitPython / rich 等重型库。
> 核心转换逻辑仅依赖 stdlib，Git 操作需要在完整 Python 环境中运行。

## 配置

1. 复制 `config.example.yaml` 为 `config.yaml`
2. 填入实际路径和参数（详见配置文件内注释）
3. 确认 Astro 仓库的 Git remote `origin` 指向正确的远程仓库

### 环境变量

| 变量 | 说明 |
|------|------|
| `OBSIDIAN_VAULT_PATH` | 覆盖 config.yaml 中的 `obsidian_vault_path`；QuickAdd / Shell Commands 可通过 `%vault_path%` 动态注入 |
| `OBSIDIAN_SYNC_CONFIG` | 指定 config.yaml 的绝对路径 |

## 使用

### CLI 模式

```bash
# 使用默认 config.yaml（当前目录或脚本目录）
python obsidian_to_astro_sync.py

# 指定配置文件
python obsidian_to_astro_sync.py --config /path/to/config.yaml

# 详细日志
python obsidian_to_astro_sync.py -v
```

### Obsidian 插件模式

```python
from obsidian_to_astro_sync import run_sync_from_obsidian
run_sync_from_astro_sync()
```

或通过 Shell Commands 插件：

```bash
python "%vault_path%/obsidian_to_astro_sync.py"
```

## Frontmatter Schema

每篇文章的 frontmatter 必须满足以下 Schema：

```yaml
title: "文章标题"          # str, max 60 chars, required
description: "摘要"        # str, max 160 chars, required
publishDate: 2024-01-01    # datetime (ISO8601 / YYYY-MM-DD / YYYY/MM/DD), required
updatedDate: 2024-06-01    # datetime, optional
tags: [python, web]        # list[str], auto dedupe & lowercase
slug: my-article           # str, regex ^[a-z0-9]+(?:-[a-z0-9]+)*$, optional
draft: false               # bool, default false (draft=true 的文件会被跳过)
path: /2024/my-article     # str, must start with /, no whitespace, required
comment: true              # bool, default true
```

额外字段（如 `heroImage.src`）不会被删除，原样保留。

## Markdown 转换规则

| Obsidian 语法 | Astro 输出 |
|---|---|
| `[[target\|display]]` | `[display](../target-slug.md)` |
| `[[target]]` | `[target](../target-slug.md)` |
| `![[note]]` | `[📄 note](https://blog.maojiaoyu.com/blog/note-slug)` |
| `%%comment%%` | *(移除)* |
| `==highlight==` | `<mark>highlight</mark>` |
| `> [!type] title` | `> **title**` |
| `![[image.png\|alt]]` | `![alt](/src/assets/images/slug/image.png)` |

## 退出码

| 码 | 含义 |
|----|------|
| 0 | 成功（无文章或全部同步完成） |
| 1 | 校验 / 转换错误（跳过 Git 提交） |
| 2 | 配置错误 |

## 常见问题

### Q: 首次运行没有同步任何文件？

检查 `obsidian_vault_path` 和 `obsidian_subfolder` 是否正确，确保子目录下存在 `.md` 文件。

### Q: Git push 超时？

在 `config.yaml` 中增大 `git_push_timeout`（默认 30 秒）。检查网络连接和 Git 凭据。

### Q: Wiki Link 目标找不到？

确保目标文章也在 `obsidian_subfolder` 下（slug 索引仅扫描该子目录）。目标文章的文件名（不含 `.md`）必须与 `[[...]]` 中的名称一致。

### Q: 日期解析失败？

支持格式：ISO8601（含时区）、`YYYY-MM-DD`、`YYYY/MM/DD`、`YYYY-MM-DD HH:MM:SS`。
不支持的格式会报告 Schema 校验错误。

### Q: 如何在 Obsidian 内运行？

1. 安装 Python 插件（如 PyScript）
2. 在 Vault 根目录放置 `config.yaml`
3. 在插件中调用：

```python
import sys
sys.path.insert(0, '/path/to/script/dir')
from obsidian_to_astro_sync import run_sync_from_obsidian
run_sync_from_obsidian()
```

## 测试

```bash
pip install pytest
pytest tests/ -v
```

## License

MIT
