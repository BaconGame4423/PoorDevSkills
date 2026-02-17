---
description: "コンテンツ生成のみ specify。ツール使用なし、仕様書テキストを stdout に出力。"
---

## User Input

```text
$ARGUMENTS
```

## 指示

ユーザー入力 `$ARGUMENTS` を読み、以下のテンプレートに従って仕様書を生成せよ。

**ルール**:
- 出力はマークダウンテキストのみ
- ツール（Edit, Write, Bash）は使用しない
- 最初の行は `[BRANCH: 提案するブランチ短縮名]` とする（2-4語、action-noun形式）
- 不明確な点は `[NEEDS CLARIFICATION: 質問]` マーカーを埋め込む（最大3個）
- WHAT と WHY に集中し、HOW（技術スタック、API、コード構造）には言及しない

## 出力テンプレート

```
[BRANCH: short-name-here]

# Feature Specification: [FEATURE NAME]

**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing

### User Story 1 - [Brief Title] (Priority: P1)

[User journey in plain language]

**Why this priority**: [value explanation]
**Independent Test**: [how to test independently]

**Acceptance Scenarios**:
1. **Given** [state], **When** [action], **Then** [outcome]
2. **Given** [state], **When** [action], **Then** [outcome]

---

[Repeat for P2, P3, etc.]

### Edge Cases
- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements

### Functional Requirements
- **FR-001**: System MUST [capability]
- **FR-002**: System MUST [capability]

### Key Entities (if data involved)
- **[Entity]**: [representation, attributes, relationships]

## Success Criteria

### Measurable Outcomes
- **SC-001**: [user-focused metric]
- **SC-002**: [performance metric]
```

## ガイドライン

- ビジネスステークホルダー向けに書く
- 各要件はテスト可能で明確であること
- コンテキストと業界標準から合理的な推測を行い、仮定を明記する
- 明確化の優先順位: スコープ > セキュリティ/プライバシー > UX > 技術
- データ保持、パフォーマンス目標、エラー処理、認証方法などはデフォルト値を仮定する
