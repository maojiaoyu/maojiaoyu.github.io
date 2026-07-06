---
aliases: ""
tags:
  []
简介: ""
Next: ""
进度: ""
创建时间: "2026年07月06日 星期一 早上8:56:43"
修改时间: "2026年07月06日 星期一 上午10:16:04"
title: "Obsidian一键发布到Github"
description: "提供一个从 Obsidian 笔记到 Astro 博客内容的自动化发布脚本。解析 Obsidian 文档的 YAML,将 Obsidian 图片 `![[...]]` 复制到 Astro 内容目录并转换为标准 Markdown."
publishDate: 2026-07-06
updatedDate: "2026-07-06"
heroImage:
  src: "src/blog/default.jpg"
  alt: "maojiaoyu blog"
  inferSize: false
  width: 800
  height: 400
  color: ""
language: "zh"
slug: "obsidian-publishes-to-github-with-one-click"
draft: false
comment: true
path: "src/content/blog"
---



## 介绍

本仓库提供一个从 Obsidian 笔记到 Astro 博客内容的自动化发布脚本。它可以：
- 解析 Obsidian 文档的 YAML frontmatter
- 将 Obsidian 图片 `![[...]]` 复制到 Astro 内容目录并转换为标准 Markdown
- 复制常见附件文件并生成可访问链接
- 生成 Astro `src/content/blog/<slug>/index.md`
- 支持自动 Git 提交与推送（可通过 `--skip-git` 跳过）

## 目录说明

- `config/paths.json`：路径配置文件
- `obsidian_templates/blog-post.md`：推荐的 Obsidian 文章模板
- `scripts/publish.py`：发布脚本

## 配置步骤

### 1. 配置 `config/paths.json`

创建或修改 `config/paths.json`，示例内容：

```json
{
  "obsidian_vault": "D:/path/to/your/obsidian/vault",
  "astro_project": "D:/path/to/your/astro/project",
  "git_remote_name": "origin",
  "git_branch": "main"
}
```

- `obsidian_vault`：你的 Obsidian 库根目录
- `astro_project`：Astro 项目根目录
- `git_remote_name`：Git 远程仓库名称，默认 `origin`
- `git_branch`：发布分支，默认 `main`

### 2. 准备 Obsidian 模板

在 Obsidian 模板目录中使用 `obsidian_templates/blog-post.md` 作为文章模板，确保 frontmatter 包含：
- `title`
- `description`
- `publishDate`
- `slug`（可选，脚本会自动生成）

### 3. 准备 Astro 项目目录

确保你的 Astro 项目存在以下目录：

```
<astro_project>/src/content/blog
```

如果没有则手动创建该目录。

## 使用说明

### 运行发布脚本

在仓库根目录执行：

```bash
python scripts/publish.py "D:/path/to/your/obsidian/note.md"
```

脚本会：
- 读取 `note.md` 的 frontmatter
- 生成 `slug`
- 在 Astro 项目中写入 `src/content/blog/<slug>/index.md`
- 复制图片和附件
- 提交并推送 Git

### 跳过 Git 操作

如果只想生成内容而不提交 Git，可加上 `--skip-git`：

```bash
python scripts/publish.py "D:/path/to/your/obsidian/note.md" --skip-git
```

## Obsidian 一键发布集成

### 方案一：使用 Obsidian QuickAdd 插件

1. 安装 Obsidian 的 `QuickAdd` 插件。
2. 打开 Obsidian 设置，进入 `QuickAdd` 插件配置页面。
3. 点击 `Add Choice` 创建一个新的动作。
4. 在新建 Choice 的类型中选择 `Macro`。
5. 点击 `Add action`，选择 `Execute command`（可能显示为 `Shell command` 或类似的执行命令动作）。
6. 在命令输入框中填入：
   ```bash
   python "D:/works/python_learning/obsidian-publish-github/scripts/publish.py" "{file_path}"
   ```
7. 如果插件支持工作目录设置，则将工作目录设置为：
   ```text
   D:/works/python_learning/obsidian-publish-github
   ```
   如果没有单独的工作目录选项，则可以直接在命令中使用完整脚本路径。
8. 保存该 Choice。
9. 在 Obsidian 里打开当前笔记，然后通过 QuickAdd 命令面板运行这个宏。

> 如果希望跳过 Git 提交，请使用：
> ```bash
> python "D:/works/python_learning/obsidian-publish-github/scripts/publish.py" "{file_path}" --skip-git
> ```

如果你找不到 `Execute command`，请检查 QuickAdd 版本，当前插件中该动作通常位于 `Add action` 后的列表里，且有时会称为 `Shell command` 或 `Run command`。
### 方案二：使用 Obsidian Templater 插件

如果你使用 `Templater`，也可以在模板中添加一段执行命令的注释，示例：

```md
<!--
一键发布命令：
python "D:/works/python_learning/obsidian-publish-github/scripts/publish.py" "{{tp_file_path}}"
-->
```

然后通过 `Templater` 用户命令或 `QuickAdd` 调用该命令即可。

### 方案三：直接在当前笔记中点击注释命令

在 `obsidian_templates/blog-post.md` 模板里，保留一条命令注释，帮助你快速复制到 Obsidian 终端：

```md
<!-- 一键发布: python "D:/works/python_learning/obsidian-publish-github/scripts/publish.py" "{{tp_file_path}}" -->
```

### 注意事项

- `QuickAdd` 中的 `{file_path}` 会被替换为当前打开笔记的完整路径。
- 如果你使用的是 Windows，命令中的路径请加双引号以避免空格问题。
- `astro_project` 路径必须包含 `src/content/blog` 目录。

### heroImage 默认值

如果 `heroImage` 未填写或为空，脚本会自动补全：

```yaml
heroImage:
  src: "./default.jpg"
  alt: "maojiaoyu blog"
  inferSize: false
  width: 800
  height: 400
  color: ""
```

若 `heroImage.src` 是相对路径，脚本会尝试从 Obsidian 库中复制对应图片到目标 `images` 目录。

## frontmatter 要求

必须包含以下字段：
- `title`
- `description`
- `publishDate`

建议：
- `title` 不超过 60 个字符
- `description` 不超过 160 个字符

## 常见问题

### Q: 出现 `FileNotFoundError: 源文件不存在`

请确认传入的是存在的笔记文件路径，并且路径为绝对路径或相对当前工作目录有效。

### Q: frontmatter 验证失败

请检查是否存在 `title`、`description`、`publishDate`，并确保这几个字段非空。

### Q: Git 操作失败

请确认：
- Astro 项目是已初始化的 Git 仓库
- 已配置 SSH 或 Git 凭据
- 当前分支允许推送

### Q: 图片无法转换

请检查 `config/paths.json` 中的 `obsidian_vault` 是否正确指向 Obsidian 库根目录，以及图片引用路径是否正确。

### Q: slug 格式错误

slug 应只包含小写字母、数字和连字符，不能有空格或特殊字符。

## 运行环境

建议使用 Python 3.7 及以上版本。

---

这套系统帮助你将 Obsidian 笔记自动转为 Astro 博客内容，支持图片、附件和基本 frontmatter 校验，简化发布流程。