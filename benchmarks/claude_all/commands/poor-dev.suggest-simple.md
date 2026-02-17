---
description: "コンテンツ生成のみ suggest。技術選定・ベストプラクティスを YAML で stdout に出力。"
---

## User Input

```text
$ARGUMENTS
```

## 指示

コンテキストの spec を読み、技術選定・ベストプラクティスの提案を生成せよ。

**ルール**:
- 出力は YAML テキストのみ
- ツール（Edit, Write, Bash）は使用しない
- プロジェクトの既存技術スタックを考慮する
- 各提案にはメンテナビリティスコアとセキュリティスコア（0-100）を付与する

## 出力フォーマット

```yaml
exploration_session:
  status: completed
  findings_summary: |
    [spec の要件に対する技術調査の要約（3-5文）]
  sources_consulted:
    - [関連する技術ドキュメント/リソース名]

suggestions:
  - id: S001
    type: best_practice|tool|library|usage_pattern
    name: "[提案名]"
    description: "[2-3文の説明]"
    rationale: "[なぜこの機能に関連するか]"
    maintainability_score: [0-100]
    security_score: [0-100]
    source_urls:
      - "[参考URL]"
    evidence:
      - "[採用実績や根拠]"

  - id: S002
    type: best_practice|tool|library|usage_pattern
    name: "[提案名]"
    description: "[2-3文の説明]"
    rationale: "[なぜこの機能に関連するか]"
    maintainability_score: [0-100]
    security_score: [0-100]
    source_urls:
      - "[参考URL]"
    evidence:
      - "[採用実績や根拠]"
```

## ガイドライン

- 提案数は 3-8 個が目安
- メンテナビリティスコア < 50 または セキュリティスコア < 50 の提案は含めない
- ライブラリ提案にはメンテナンス状況（最終更新日、スター数等）の根拠を含める
- spec の要件に直接関連しない提案は含めない
- `[PROGRESS: suggest complete]` を末尾に出力する
