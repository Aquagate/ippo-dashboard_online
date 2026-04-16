# Case Study: Ippo Dashboard Future - 進化の記録

## 1. Overview
本プロジェクトでは、「一歩の可視化」をテーマに、過去のシミュレーション結果と現在の行動ログを比較し、未来への軌道がどう変化したか（Trajectory Shift）を AI に分析させる機能を実装した。
また、開発過程で遭遇した深刻な同期バグ（ゾンビ復活バグ）の解決を通じて、SEED Framework の同期メカニズムを大幅に強化した。

## 2. Key Challenges & Solutions

### 🧟 ゾンビ復活バグ (Zombie Resurrect Bug)
**現象**: 履歴を削除しても、OneDrive との同期（mergeData）時に削除したはずのデータが復活してしまう。
**原因**: 
1. `updatedAt` が同一の場合、既存（論理削除済み）のデータを Incoming（未削除の状態）で上書きしていた。
2. 正規化（normalize）が不十分で、マージ時に `deleted` フラグが欠落していた。
**解決策**:
- **Strict Newer Wins**: `mergeData` 内での比較を `s.updatedAt >= existing.updatedAt` から `s.updatedAt > existing.updatedAt` に変更。同一時刻の場合はローカルの変更（削除状態）を優先する。
- **Deep Normalization**: `normalizeSimulationV2` を用意し、全てのフィールド（`deleted`, `assetCommits`, `memoedStepIndices`）が確実に保持されるようにした。

### 📌 資産名のエスケープ問題 (Asset Quote Issue)
**現象**: 資産名にシングルクォート（例: `Ippo's Tool`）が含まれる場合、ボタンの `onclick` ハンドラが構文エラーで動作しなくなる。
**原因**: 文字列展開時にエスケープを行わずに `onclick='func("${key}")'` としていたため。
**解決策**: `onclick` 内で引数を渡す際は `encodeURIComponent(JSON.stringify(obj))` を使用するか、エスケープ処理を徹底する。SEED 武器庫には「安全な属性展開」のガイドラインを追加。

## 3. Architecture Decisions
- **Logical Deletion vs Physical Deletion**: 完全な物理削除ではなく `deleted` フラグによる論理削除を採用。これにより、オフライン環境や同期遅延がある環境でも「削除した」という状態を確実に伝播させることが可能になった。
- **Trajectory Context Injection**: プロンプトに過去の結果を「JSONそのまま」ではなく「要約テキスト」として注入。トークン節約と AI の理解度向上を両立。

## 4. Unsolved Issues
- **Asset Logic Refinement**: 現在は資産の「生成プロンプト」止まりだが、これをより自動化・構造化する余地がある。
- **Undo Logic**: 論理削除の仕組みがあるため、UI 側で「元に戻す（Restore）」機能を実装する準備は整っている。

## 5. Evolution Highlights (To SEED)
1. **Weapon**: `normalizeSimulationV2` パターン（堅牢なデータ正規化・保持ロジック）。
2. **Architecture**: 論理削除対応の `mergeData` ロジック。
3. **Prompt**: `Trajectory Shift Analysis` プロンプト。
