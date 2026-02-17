---
description: "コンテンツ生成のみ plan。実装計画をマークダウンで stdout に出力。"
---

## User Input

```text
$ARGUMENTS
```

## 指示

コンテキストの spec と suggestions を読み、実装計画を生成せよ。

**ルール**:
- 出力はマークダウンテキストのみ
- ツール（Edit, Write, Bash）は使用しない
- suggestions が存在しない場合は spec のみで計画を生成する
- `constitution.md` が存在する場合はその制約を考慮する

## 出力テンプレート

```markdown
# Implementation Plan: [FEATURE]

**Date**: [DATE]
**Input**: Feature specification from spec.md

## Summary

[主要要件 + 技術的アプローチの要約]

## Technical Context

**Language/Version**: [e.g., Python 3.11]
**Primary Dependencies**: [e.g., FastAPI]
**Storage**: [if applicable]
**Testing**: [e.g., pytest]
**Target Platform**: [e.g., Linux server]

## Project Structure

```text
[提案するディレクトリ構造]
```

**Structure Decision**: [選択した構造の理由]

## Architecture

### Component Overview
[主要コンポーネントと責務]

### Data Flow
[データの流れと変換]

### Contracts & Interfaces
[コンポーネント間の境界定義]

## Implementation Approach

### Phase 0: Research (if needed)
[未知の技術要素の調査結果]

### Phase 1: Design
[設計決定事項とトレードオフ]

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| [リスク] | [影響] | [対策] |
```

## ガイドライン

- spec の User Stories の優先順位を尊重する
- suggestions から採用された技術をアーキテクチャに反映する
- 並列実装可能な境界を明示する
- `[PROGRESS: plan complete]` を末尾に出力する
