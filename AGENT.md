# PoorDevSkills エージェントワークフロー

**最終更新**: 2026-02-08
**バージョン**: 1.0.0

このドキュメントは、SpecKitとReviewスキルを統合した標準開発フローを定義します。すべてのエージェントはこのワークフローに従ってください。

---

## 目次

1. [概要](#概要)
2. [コマンドリファレンス](#コマンドリファレンス)
3. [標準フロー](#標準フロー)
4. [品質ゲート](#品質ゲート)
5. [レビュー戦略](#レビュー戦略)
6. [Swarm統合](#swarm統合)
7. [憲法コンプライアンス](#憲法コンプライアンス)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

このワークフローは以下の原則に基づいて設計されています：

- **SpecKit**: 仕様化・計画・タスク分解の構造化されたアプローチ
- **Reviewスキル**: 多角的レビューによる品質保証
- **敵対的レビュー**: VDDスタイルの厳密なコードレビュー
- **品質ゲート**: 自動化された検証チェック
- **段階的配信**: MVP優先の漸進的開発

### コア原則

1. **仕様主導**: ユーザー価値から始める
2. **計画レビュー**: 実装前に品質を担保
3. **検証ゲート**: 自動化された品質チェック
4. **敵対的レビュー**: 厳格なコード品質評価
5. **段階的配信**: MVPを優先する

---

## コマンドリファレンス

### SpecKit系コマンド

| コマンド | 用途 | 入力 | 出力 |
|----------|------|------|------|
| `/speckit.specify` | 仕様作成 | 機能説明 | spec.md, チェックリスト |
| `/speckit.plan` | 技術計画 | なし | plan.md, research.md, data-model.md, contracts/, quickstart.md |
| `/speckit.tasks` | タスク分解 | なし | tasks.md |
| `/speckit.implement` | 実装実行 | なし | 実装コード |
| `/speckit.clarify` | 仕様明確化 | なし | 更新されたspec.md |
| `/speckit.analyze` | 整合性分析 | なし | 分析レポート |
| `/speckit.checklist` | チェックリスト作成 | ドメイン | ドメインチェックリスト |

### Review系コマンド（オーケストレータ）

| コマンド | 用途 | ペルソナ（サブエージェント） | 自動ループ |
|----------|------|---------------------------|-----------|
| `/poor-dev.planreview` | 計画レビュー | PM, RISK, VAL, CRIT | Yes |
| `/poor-dev.tasksreview` | タスク分解レビュー | TECHLEAD, SENIOR, DEVOPS, JUNIOR | Yes |
| `/poor-dev.architecturereview` | 設計レビュー | ARCH, SEC, PERF, SRE | Yes |
| `/poor-dev.qualityreview` | 品質レビュー | QA, TESTDESIGN, CODE, SEC + adversarial | Yes |
| `/poor-dev.phasereview` | フェーズ完了レビュー | QA, REGRESSION, DOCS, UX | Yes |

### Review系コマンド（個別ペルソナ）

各ペルソナは `subtask: true` で単体呼び出し可能:

| グループ | コマンド |
|---------|---------|
| Plan | `/poor-dev.planreview-pm`, `-risk`, `-value`, `-critical` |
| Tasks | `/poor-dev.tasksreview-techlead`, `-senior`, `-devops`, `-junior` |
| Architecture | `/poor-dev.architecturereview-architect`, `-security`, `-performance`, `-sre` |
| Quality | `/poor-dev.qualityreview-qa`, `-testdesign`, `-code`, `-security` |
| Phase | `/poor-dev.phasereview-qa`, `-regression`, `-docs`, `-ux` |

### 実装・品質系コマンド

| コマンド | 用途 | 関連ツール |
|----------|------|----------|
| `/swarm` | 並列エージェント実行 | SwarmTools |
| `/finish` | 品質ゲート | 型チェック + テスト |

---

## 標準フロー

### フロー図

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 仕様作成                                                  │
│    /speckit.specify "機能の説明"                             │
│    → spec.md 生成                                           │
│    → requirements.md チェックリスト生成                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 技術計画                                                  │
│    /speckit.plan                                            │
│    → plan.md 生成                                           │
│    → research.md (研究と決定)                              │
│    → data-model.md (データモデル)                           │
│    → contracts/ (API契約)                                  │
│    → quickstart.md (クイックスタートガイド)                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. プランレビュー                                            │
│    /review plan plan.md                                     │
│    → GO / CONDITIONAL / NO-GO                               │
│    → プランの品質と実現可能性を評価                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. タスク分解                                                │
│    /speckit.tasks                                           │
│    → tasks.md 生成                                          │
│    → ユーザーストーリーごとのタスク                         │
│    → 依存関係と並列化の機会                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. タスクレビュー                                            │
│    /review tasks tasks.md                                   │
│    → 依存関係の確認                                          │
│    → 並列化の機会の特定                                      │
│    → タスク網羅性のチェック                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 設計レビュー（必要時）                                    │
│    /review architecture data-model.md                       │
│    → SOLID原則の確認                                         │
│    → 拡張性と保守性の評価                                    │
│    → セキュリティと性能のチェック                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. 実装                                                      │
│    /speckit.implement  または  /swarm "フェーズを実装"      │
│    → swarm-planner → swarm-worker × N                       │
│    → タスクごとの実行                                        │
│    → 進捗の追跡                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. 品質ゲート                                                │
│    /finish                                                  │
│    → 型チェック（例: tsc, mypy, cargo check）                │
│    → リンティング（例: eslint, ruff, clippy）               │
│    → フォーマットチェック（例: prettier, black, fmt）       │
│    → テスト（例: npm test, pytest, cargo test）             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. 品質レビュー                                              │
│    /review quality                                          │
│    → テスト網羅性の確認                                      │
│    → コード品質の評価                                        │
│    → 敵対的レビュー（swarm_adversarial_review）             │
│    → セキュリティチェック                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. フェーズ完了レビュー                                     │
│     /review phase [フェーズ名]                               │
│     → Definition of Doneの確認                             │
│     → リグレッションテスト                                  │
│     → ドキュメントのチェック                                 │
│     → UX評価                                               │
└─────────────────────────────────────────────────────────────┘
```

### クイックリファレンス

| フェーズ | コマンド | 確認事項 |
|----------|----------|----------|
| 仕様 | `/poor-dev.specify` | ユーザー価値、明確な要件 |
| 計画 | `/poor-dev.plan` → `/poor-dev.planreview` | 技術選択、アーキテクチャ |
| タスク | `/poor-dev.tasks` → `/poor-dev.tasksreview` | 依存関係、並列化 |
| 設計 | `/poor-dev.architecturereview` | SOLID、拡張性、セキュリティ |
| 実装 | `/poor-dev.implement` or `/swarm` | 実装の完全性 |
| 品質 | `/finish` → `/poor-dev.qualityreview` | テスト、コード品質 |
| 完了 | `/poor-dev.phasereview` | DoD、統合、文書 |

---

## 品質ゲート

### 自動実行されるゲート

**`/finish`** コマンド実行時に自動チェック:

#### 1. 型チェック

言語ごとの標準コマンド:

```bash
# TypeScript/JavaScript
tsc --noEmit

# Python
mypy . || ruff check

# Rust
cargo check

# Go
go vet ./...

# Java (Maven)
mvn compile
```

#### 2. リンティング

```bash
# TypeScript/JavaScript
eslint . --max-warnings 0

# Python
ruff lint || flake8 . --max-line-length=88

# Rust
cargo clippy -- -D warnings

# Go
golangci-lint run
```

#### 3. フォーマットチェック

```bash
# TypeScript/JavaScript
prettier --check "**/*.{ts,tsx,js,jsx,json,md}"

# Python
black --check .

# Rust
cargo fmt --check

# Go
gofmt -l .
```

#### 4. テスト

```bash
# TypeScript/JavaScript
npm test -- --coverage

# Python
pytest --cov

# Rust
cargo test

# Go
go test ./... -cover
```

### ゲート失敗時の処理

1. **CRITICAL**: ビルドエラー、型エラー
   - 即座に修正が必要
   - 他のゲートをスキップ

2. **HIGH**: リンティング警告、重要なテスト失敗
   - 修正を推奨
   - 理由を文書化すればスキップ可能

3. **MEDIUM**: 軽微なリンティング警告、カバレッジ未達成
   - 改善を推奨
   - 次のスプリントで対応

4. **LOW**: スタイルの問題、ドキュメントの不足
   - タスク完了許可
   - 後で改善

### カバレッジ要件

- **重要パス**: 100% カバレッジ（TDD必須）
- **通常パス**: 80% 以上のカバレッジ
- **全体**: 70% 以上のカバレッジ

---

## レビュー戦略

### アーキテクチャ: サブエージェント分離 + 自動ループ

レビューシステムは以下のアーキテクチャで動作:

1. **ペルソナ分離**: 各ペルソナは独立エージェント定義（`.opencode/agents/`, `.claude/agents/`）
2. **オーケストレータ**: ループ制御・結果集約のみ（ペルソナ定義はゼロ）
3. **自動修正ループ**: issue 0件になるまで Review → Fix → Review を繰り返す
4. **コンテキスト分離**: 毎イテレーションで新規サブエージェントを起動

```
STEP 1: 4x Review sub-agents (parallel, READ-ONLY)
   ↓
STEP 2: Aggregate issues by C/H/M/L
   ↓
STEP 3: Issues > 0 → Fix sub-agent → back to STEP 1
         Issues = 0 → DONE + handoff to next stage
```

**安全策**:
- レビューサブエージェント: read-only（Write/Edit/Bash 禁止）
- 修正サブエージェント: write-enabled（`review-fixer`）
- 10回超で安全弁（ユーザー確認）

### エージェント間通信: 英語コンパクトYAML

トークン効率のため、エージェント間通信は全て英語:

```yaml
p: PM
v: CONDITIONAL
i:
  - H: success metrics not quantitative
  - M: P2 priority rationale unclear
r:
  - add DAU/MAU ratio as metric
```

### レビューの判定

- **GO**: 重大な問題なし、実装を進めてよい
- **CONDITIONAL**: 軽微な問題あり、修正後に進めてよい
- **NO-GO**: 重大な問題あり、修正が必要

### フィードバックの優先順位

- **C (Critical)**: 実装を妨げる重大な問題
- **H (High)**: 品質に影響する重要な問題
- **M (Medium)**: 改善が必要だが致命的ではない
- **L (Low)**: 軽微な改善提案

---

## Swarm統合

### Swarm Mailの使用

**初期化**:
```bash
/swarmmail_init --project_path /path/to/project --agent_name [エージェント名]
```

**メッセージ送信**:
```bash
/swarmmail_send --to [受信者] --subject [件名] --body [本文]
```

**確認**:
```bash
/swarmmail_ack --message_id [メッセージID]
```

**ファイル予約**:
```bash
/swarmmail_reserve --paths [ファイルパス] --exclusive --reason [理由]
```

**ファイル解放**:
```bash
/swarmmail_release --paths [ファイルパス]
```

### セッション管理

**セッション開始**:
```bash
/hive_session_start --active_cell_id [セルID]
```

**セッション終了**:
```bash
/hive_session_end --handoff_notes [引き継ぎノート]
```

### Swarm Planner/Worker

**Swarm Planner**:
- 仕様ファイルから正確な型名・シグネチャを抽出
- サブタスクに「EXACT SPEC」を含める
- 「FORBIDDEN」セクションで禁止事項を明示

**Swarm Worker**:
- EXACT SPECがあればそのまま実装
- 命名・型・可視性の変更禁止
- 仕様に疑問があればblockしてcoordinator確認

**禁止事項（FORBIDDEN）**:
- 命名変更（PortSide → MachinePortSide）
- 型変更（u8 → usize）
- 可視性変更（pub → private）
- 仕様にない機能追加
- 「改善」のための変更

### 敵対的レビュー

**実行**:
```bash
/swarm_adversarial_review --diff [差分] --test_output [テスト出力]
```

**判定**:
- **APPROVED**: コードは優れている
- **NEEDS_CHANGES**: 実際の問題が見つかった
- **HALLUCINATING**: 敵対者が問題を捏造している（コードは優れている）

**3ストライクルール**:
- 3回の拒否後、タスクは失敗してバックログに戻る
- 拒否ごとに理由を文書化
- 修正後に再レビュー

---

## 憲法コンプライアンス

### 憲法第VIII章：検証ゲート

すべてのサブタスク完了は終了前に検証ゲートを通過しなければなりません。

**ゲート**:
1. 型チェック
2. テスト
3. リンティング
4. 敵対的レビュー

**検証をスキップする場合**:
- 明確な正当化が必要
- 理由を文書化
- チームの承認

### 憲法第III章：レビュー主導品質

すべてのコード変更はマージ前に敵対的コードレビューを通過しなければなりません。

**規則**:
- すべてのサブタスク完了には敵対的レビューが必要
- レビューアは敵対的であり、雑学に対してゼロ許容である必要がある
- 3ストライクルール: 3回の拒否後、タスクは失敗し、バックログに戻る

### 憲法第IV章：重要パスのテストファースト

重要なコードパスはTDDを使用しなければなりません。

**重要パスの例**:
- 認証
- 認可
- 支払い処理
- データ整合性

**TDDサイクル**:
1. 失敗するテストを書く
2. テストが失敗することを確認する
3. 実装コードを書く
4. テストをパスする
5. リファクタリング

### 憲法第IX章：メモリと知識管理

学習、決定、パターンは将来の検索のためにHivemindに保存されなければなりません。

**保存**:
```bash
/hivemind_store --information [学習内容] --tags [タグ]
```

**検索**:
```bash
/hivemind_find --query [検索クエリ] --limit 10
```

**検証**:
```bash
/hivemind_validate --id [メモリID]
```

**同期**:
```bash
/hivemind_sync
```

---

## トラブルシューティング

### 品質ゲートの失敗

**問題**: `/finish` で品質ゲートが失敗する

**解決策**:
1. 失敗したゲートを確認
2. 問題を修正
3. ゲートを再実行
4. 全てのゲートがパスするまで繰り返す

### レビューがNO-GO

**問題**: レビューでNO-GO判定

**解決策**:
オーケストレータの自動ループが修正→再レビューを自動実行します。
手動介入が必要な場合は10回超過時にユーザー確認が入ります。

### 敵対的レビューがNEEDS_CHANGES

**問題**: `/swarm_adversarial_review` でNEEDS_CHANGES判定

**解決策**:
1. 発見された問題を確認
2. 問題を修正
3. 再レビューをリクエスト
4. 3回の拒否までチャンスがある

### タスクが不完全

**問題**: `/speckit.tasks` で生成されたタスクが不完全

**解決策**:
1. spec.mdとplan.mdを確認
2. 足りないタスクを追加
3. tasks.mdを更新
4. `/review tasks` で確認

### 依存関係が不明確

**問題**: タスク間の依存関係が不明確

**解決策**:
1. `/speckit.tasks` で依存関係を確認
2. 必要に応じて依存関係を調整
3. `/review tasks` で依存関係を確認
4. 並列化の機会を活用

---

## ベストプラクティス

### 仕様化

- ユーザーの言葉で書く
- 実装詳細を避ける
- 明確な受け入れ基準を定義する
- 優先順位（P1, P2, P3）を付ける

### 計画

- 技術選択の理由を文書化する
- 研究と決定を記録する
- アーキテクチャを明確にする
- リスクを特定する

### タスク分解

- ユーザーストーリーごとに整理する
- タスクを具体的にする
- 並列化の機会を特定する
- 検証ゲートを含める

### 実装

- タスクを順次実行する
- 並列タスクを活用する
- 進捗を報告する
- エラーを即座に報告する

### レビュー

- 早期にレビューを実行する
- 全てのペルソナを活用する
- 建設的なフィードバックを提供する
- 優先順位を明確にする

### 品質保証

- 全ての品質ゲートを通過する
- 敵対的レビューを実行する
- テスト網羅性を確保する
- Definition of Doneを確認する

---

## 用語集

| 用語 | 定義 |
|------|------|
| SpecKit | 仕様化・計画・タスク分解のフレームワーク |
| Reviewスキル | 多角的レビューを行うためのスキルセット |
| 敵対的レビュー | VDDスタイルの厳密なコードレビュー |
| 品質ゲート | 型チェック、リンティング、テスト等の自動検証 |
| ペルソナ | 特定の観点からレビューを行う役割 |
| Definition of Done | タスク完了の基準 |
| 3ストライクルール | 敵対的レビューでの3回の拒否ルール |
| SwarmTools | 並列エージェント実行のためのツールセット |
| Hivemind | 知識管理と意味論検索のためのツール |
| TDD | テスト駆動開発 |

---

## リソース

- [憲法](constitution.md)
- [レビューオーケストレータ](.opencode/command/poor-dev.*review.md)
- [ペルソナエージェント](.opencode/agents/)

---

**最終更新**: 2026-02-08
**次回見直し**: 2026-03-08
