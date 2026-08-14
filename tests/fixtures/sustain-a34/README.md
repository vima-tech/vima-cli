# Sustain A34 发布硬门夹具

本夹具固定 D-A34-25 的四页样本、旧版 commit、Claude Design 原型哈希、路由、viewport、
mock 档位与场景 ID。它不是一组会随评审会话变化的“参考页号”。

在已启动、已装载 `sustain-dense-clinical-v1` 数据且可登录的 Sustain 实例上运行：

```bash
VIMA_PLAYWRIGHT_PATH=/absolute/path/to/playwright \
node tests/acceptance/sustain-a34.mjs \
  --project-root /absolute/path/to/Sustain \
  --base-url http://127.0.0.1:5173 \
  --storage-state /absolute/path/to/admin-storage-state.json
```

门禁同时检查：基线来源未漂移、四页没有 CRUD 化、批准稿视觉误差阈值、页面可达与场景元数据。
浏览器截图与报告写入 Sustain 项目的 `.vima/reports/sustain-a34/`。任一页缺冻结稿、缺稳定结构、
命中降级选择器或视觉 RMSE 超阈值都 exit 2；不会用“缺稿所以跳过”伪装成功。
