---
name: git-submit
description: >-
  按规范格式提交并推送变更。在暂存文件、撰写 commit message、推送到远程时使用。
  强制 conventional commit 格式。优先使用 scripts 程序化执行。
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

## 脚本（优先使用）

脚本位于 `.cursor/skills/git-submit/`，在仓库根目录执行。

### 1. 获取未提交变更文件列表

```bash
node .cursor/skills/git-submit/list-changes.mjs
node .cursor/skills/git-submit/list-changes.mjs --json
```

- 默认：每行输出一个变更文件路径；无变更时输出 `(无未提交变更)`
- `--json`：输出 `{ files, staged, unstaged, untracked }` 结构化 JSON

### 2. 提交并推送

```bash
node .cursor/skills/git-submit/submit.mjs --type feat --message "新增流水线进度事件支持"
node .cursor/skills/git-submit/submit.mjs feat "新增流水线进度事件支持"
```

按顺序自动执行：

1. 根据版本号规则升级 `package.json` 的 `version`
2. `npm i`（更新 `package-lock.json`）
3. `git add -A`
4. `git commit -m "<type>: <描述>"`
5. `git push`

## 版本号升级（package.json）

`submit.mjs` 在提交前自动升级 `package.json` 的 `version` 字段：

- 查看自上次推送以来的提交（相对 `@{upstream}`，回退至 `origin/main` 或 `origin/master`）
- 若**任意**未推送提交或**本次** type 为 `feat` → 升级 **minor**（如 `1.0.0` → `1.1.0`）
- 否则 → 升级 **patch**（如 `1.0.0` → `1.0.1`）

版本号变更纳入同一次提交。

## 手动步骤（脚本不可用时）

1. 查看变更文件：`node .cursor/skills/git-submit/list-changes.mjs`
2. 检查自上次推送以来的提交，并据此升级 `package.json` 版本号
3. 在仓库根目录运行 `npm i`，更新 `package-lock.json`
4. 暂存文件：`git add -A`
5. 提交：`git commit -m "<type>: <描述>"`
6. 推送：`git push`
