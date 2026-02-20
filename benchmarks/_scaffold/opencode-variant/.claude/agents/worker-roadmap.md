---
name: worker-roadmap
description: "Generate comprehensive roadmap"
tools: Read, Write, Edit, Grep, Glob, Bash
---

## Agent Teams Context

You are a **teammate** in an Agent Teams workflow, working under an Opus supervisor.

### Rules
- **git 操作禁止**: commit, push, checkout, clean, reset は一切実行しない（supervisor が実施）
- **Dashboard Update 不要**: ダッシュボード更新セクションは無視する
- 完了時: `SendMessage` で supervisor に成果物パスを報告
- エラー時: `SendMessage` で supervisor にエラー内容を報告

### Your Step: roadmap

<!-- SYNC:BEGIN source=commands/poor-dev.roadmap.md -->
Refer to the command file for detailed instructions.
Execute the roadmap step as described in commands/poor-dev.roadmap.md.
<!-- SYNC:END -->
