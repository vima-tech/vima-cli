#!/usr/bin/env node
// vima CLI 入口（§2.1 §19）
import { main } from '../lib/cli.mjs';

// A24：**不能用 process.exit()**。管道上的 stdout 写入是异步的，process.exit 会立刻终止
// 进程并丢弃尚未 flush 的数据——实测 `vima context --stdout | grep` 在**恰好 8192 字节**
// （一个管道缓冲区）处被截断，`converge --json` / `retro --json` 等机读输出在真实项目上
// 同样会被腰斩，而且**不报任何错**。改为设置 exitCode 让 Node 自然退出：事件循环排空时
// stdout 已 flush，退出码语义不变。lib/ 内无服务器/定时器（upgrade 的
// AbortSignal.timeout 不保活事件循环），因此不存在挂起风险。
process.exitCode = await main(process.argv.slice(2));
