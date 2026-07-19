---
name: git-submit
description: >-
  按规范格式提交并推送变更。在暂存文件、撰写 commit message、推送到远程时使用。
  强制 conventional commit 格式。
---

# Git 提交与推送

## Commit Message 格式

```
<type>: <描述>
```

- **type** — 英文，取自：`feat`、`fix`、`refactor`、`chore`、`docs`、`style`、`test`、`perf`
- **描述** — 中文，无句号，祈使语气（如 `新增`、`修复`、`更新`）
- **不要**在沙箱 shell 中包装 git 命令

**示例：**
```
feat: 新增流水线进度事件支持
fix: 修正 preferences-api 的导入路径
refactor: 将 pipelines 目录移至 service 下
chore: 更新依赖
docs: 添加 git-submit skill
```

## 版本号升级（package.json）

提交前更新 `package.json` 的 `version` 字段：

- 查看自上次推送以来的提交：`git log origin/main..HEAD --oneline`
- 若**任意**提交的 type 为 `feat` → 升级 **minor**（如 `1.0.0` → `1.1.0`）
- 否则 → 升级 **patch**（如 `1.0.0` → `1.0.1`）

版本号变更纳入同一次提交。

## 步骤

1. 查看变更文件：`git status`
2. 检查自上次推送以来的提交，并据此升级 `package.json` 版本号
3. 在仓库根目录运行 `npm i`，更新 `package-lock.json`
4. 暂存文件：`git add <files>`（或 `git add -A` 全部暂存）
5. 提交：`git commit -m "<type>: <描述>"`
6. 推送：`git push`
