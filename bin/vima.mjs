#!/usr/bin/env node
// vima CLI 入口（§2.1 §19）
import { main } from '../lib/cli.mjs';

process.exit(await main(process.argv.slice(2)));
