#!/usr/bin/env node
// 可执行入口。刻意只有这几行：一切逻辑在 lib/front/cli.mjs，
// 入口本身不该有任何可测的东西，否则它就成了第二个门面。
//
// 用 process.exitCode 而不是 process.exit()：后者会在管道未 flush 时截断 stdout，
// `vima next --json | jq` 会偶发拿到半截 JSON。
import { main } from '../lib/front/cli.mjs';

process.exitCode = await main(process.argv.slice(2));
