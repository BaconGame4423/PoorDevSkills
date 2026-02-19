/**
 * config-resolver.ts
 *
 * config-resolver.sh の TypeScript 移植。
 * 5段階 CLI/model 解決チェーン。
 *
 * config-resolver.sh 全体参照。
 *
 * 注意: resolveCliModel() は review-setup.ts にも実装済みだが、
 * スタンドアロン版として本ファイルで公開する。
 */

export { resolveCliModel } from "./review-setup.js";
