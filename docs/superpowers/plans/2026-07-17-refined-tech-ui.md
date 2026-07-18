# Ghost Flow Work App — 精致工程工具风 UI 升级计划

**Goal:** 参考市面上同类工具（Linear / Vercel / Grafana / Airflow 3 / CI/CD 工具）的前端设计，将现有暗黑霓虹 UI 升级为「精致工程工具风」：保持现有青蓝 `#00d4ff` + 紫 `#7c3aed` 霓虹配色不变，通过背景分层、边框纪律、统一状态点语言、等宽字体数据呈现、终端日志风格等元素增强科技感，克制使用装饰元素（无扫描线、无 HUD 角标）。

**Architecture:** 不引入新依赖，继续使用 React 19 + Ant Design 6（`darkAlgorithm` 已启用）。重写 `frontend/src/index.css` 的设计 Tokens 与组件样式（玻璃质感 → 近平黑分层平面质感），新增 `HeaderExtras` 布局组件，逐页精化 className 与数据呈现方式。动画沿用现有 CSS keyframes，仅新增光标闪烁动画。

**Tech Stack:** React 19 + TypeScript + Ant Design 6 + Vite + pnpm。

## 市场调研结论（设计依据）

| 工具 | 可借鉴的设计语言 |
|---|---|
| Linear | 近黑分层底色、细边框代替重阴影、单一强调色纪律、克制的 hover 反馈 |
| Vercel | 蓝图网格背景（双层：细点 + 主网格线）、几何感图标容器（方形圆角） |
| Grafana | 深色优先、数据密集的仪器面板、状态色编码、`tabular-nums` 数字 |
| Airflow 3 / Cronitor | 统一状态点语言（运行/成功/失败/闲置）、实时状态存在感 |
| CI/CD 工具（GitHub Actions 等） | 终端日志风格记录（等宽时间戳 + `[ OK ]/[FAIL]` 状态符号）、技术数据一律等宽字体 |

映射到本项目的 6 条设计决策：

1. **背景分层**：玻璃模糊面板 → Linear 式近平黑四层（页面 `#07090d` / 卡片 `#0c0f16` / 嵌入 `#11151f` / hover `#171c28`），仅 Header 与 Modal 保留 `backdrop-filter`。
2. **边框纪律**：卡片去掉 `0 4px 24px rgba(0,0,0,0.4)` 重阴影与 hover 光晕，改为 `rgba(255,255,255,0.07)` 细边框，hover 仅提亮边框。
3. **统一状态点**：新增 `.ghost-status-dot--success/error/running/idle` 8px 状态点系统，替换各页面散落的 Badge/Tag 状态表达（参考 CI/CD 状态语言）。
4. **等宽数据**：Run ID、Cron、耗时、时间戳、文件路径、时钟一律 `var(--ghost-font-mono)` + `tabular-nums`。
5. **终端化点缀**：侧边栏 Logo 改为 `ghost@flow:~$` + 闪烁光标的终端 prompt 风格；Dashboard 最近运行记录改为终端日志行（等宽时间戳 + `[ OK ]/[FAIL]`）；Header 右侧增加调度器实时状态点 + 单秒时钟。
6. **蓝图网格**：内容区点阵网格上叠加 160px 主网格线（极淡青色），呼应 Vercel Blueprint Grid。

## Global Constraints

- 不引入新的 UI 框架或 CSS 方案（不使用 Tailwind / CSS Modules / Framer Motion）。
- 不修改后端 API 接口。
- 所有代码注释、文案保持中文。
- 使用 `import type` 进行类型-only 导入（项目 `verbatimModuleSyntax` 已启用）。
- 公共样式统一写入 `frontend/src/index.css`，保留 `.ghost-*` 类命名。
- 保持现有霓虹配色：`#00d4ff`（主）、`#7c3aed`（辅）、`#4ade80`（成功）、`#ff6b6b`（失败）。
- **禁止**对 Ant Design 预设色组件（如 `.ant-tag`）使用 `!important` 三属性全覆盖（上次教训：会抹平语义色并压过内联 style）。
- 每个任务完成后验证 `pnpm build` 与 `pnpm lint` 无新增错误。
- 本项目未安装测试框架，验证以构建与 lint 为准。
- 每个任务单独 commit，commit message 遵循 `feat(frontend):` / `fix(frontend):` 中文描述。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `frontend/src/index.css` | 新设计 Tokens（背景分层/边框/字体）、蓝图网格、状态点系统、终端日志行、工具类（`.ghost-mono`/`.ghost-dim`）、光标闪烁动画、antd 覆盖值更新 |
| `frontend/src/main.tsx` | ConfigProvider token 与新 Tokens 对齐（底色/边框/文字/圆角） |
| `frontend/src/components/HeaderExtras.tsx` | 新建：Header 右侧调度器状态点 + 单秒时钟 + 版本号 |
| `frontend/src/components/AppLayout.tsx` | Logo 终端化、接入 HeaderExtras |
| `frontend/src/pages/Dashboard/index.tsx` | 统计卡仪器化（英文 micro 标签 + 方形图标）、状态卡用状态点、最近运行记录终端日志化 |
| `frontend/src/pages/Tasks/index.tsx` | 调度列状态点化、ID 等宽化 |
| `frontend/src/pages/Schedules/index.tsx` | 引擎状态卡状态点化、Cron/下次执行等宽化 |
| `frontend/src/pages/Connections/index.tsx` | ID 等宽化、配置摘要字体 token 化 |
| `frontend/src/pages/History/index.tsx` | 状态列状态点化、Run ID/时间/耗时等宽化 |

---

## Task 1: 设计系统精化（index.css + main.tsx）

**Files:**
- Modify: `frontend/src/index.css`（整体重写）
- Modify: `frontend/src/main.tsx`
- Create: `docs/superpowers/plans/2026-07-17-refined-tech-ui.md`（本计划的归档副本）

**Interfaces:**
- Consumes: 无。
- Produces: `--ghost-bg / --ghost-panel / --ghost-inset / --ghost-hover / --ghost-panel-deep / --ghost-primary / --ghost-secondary / --ghost-success / --ghost-error / --ghost-warning / --ghost-text / --ghost-text-secondary / --ghost-text-dim / --ghost-border / --ghost-border-strong / --ghost-border-accent / --ghost-font-mono / --ghost-radius / --ghost-radius-lg`；`.ghost-mono`、`.ghost-dim`、`.ghost-status-dot`（+`--success/--error/--running/--idle`）、`.ghost-log-line`（+`.ghost-log-time`/`.ghost-log-name`/`.ghost-log-status`+`--ok/--fail/--run`）、`.ghost-cursor`、`.ghost-stat-micro`、`.ghost-header-status`；保留 `.ghost-sider/.ghost-logo/.ghost-header/.ghost-header-extra/.ghost-content/.ghost-card/.ghost-stat-card/.ghost-stat-icon/.ghost-stat-value/.ghost-stat-label/.ghost-table-actions/.ghost-filter-bar/.ghost-card-enter/.ghost-page-enter/.ghost-status-pulse/.ghost-fade-in/.ghost-number-pop`。

- [ ] **Step 0: 归档计划副本**

将本计划文件复制为 `docs/superpowers/plans/2026-07-17-refined-tech-ui.md` 并纳入本次 commit。

- [ ] **Step 1: 重写 `frontend/src/index.css`**

```css
/* ===== 设计 Tokens ===== */
:root {
  /* 背景层次 — Linear 式近平黑分层 */
  --ghost-bg: #07090d;
  --ghost-panel: #0c0f16;
  --ghost-inset: #11151f;
  --ghost-hover: #171c28;
  --ghost-panel-deep: rgba(8, 11, 16, 0.85);

  /* 霓虹强调 */
  --ghost-primary: #00d4ff;
  --ghost-secondary: #7c3aed;
  --ghost-success: #4ade80;
  --ghost-error: #ff6b6b;
  --ghost-warning: #fbbf24;

  /* 文字 */
  --ghost-text: #e6eaf2;
  --ghost-text-secondary: #8b94a7;
  --ghost-text-dim: #525b6e;

  /* 边框纪律 — 细边框优先于阴影 */
  --ghost-border: rgba(255, 255, 255, 0.07);
  --ghost-border-strong: rgba(255, 255, 255, 0.12);
  --ghost-border-accent: rgba(0, 212, 255, 0.35);

  /* 字体 */
  --ghost-font-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;

  /* 圆角 */
  --ghost-radius: 10px;
  --ghost-radius-lg: 12px;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: var(--ghost-text);
  background: var(--ghost-bg);
}

#root {
  min-height: 100vh;
}

/* ===== 工具类 ===== */

/* 等宽技术数据 */
.ghost-mono {
  font-family: var(--ghost-font-mono);
  font-variant-numeric: tabular-nums;
}

/* 弱化文字 */
.ghost-dim {
  color: var(--ghost-text-dim);
}

/* ===== 状态点 — 统一状态语言 ===== */
.ghost-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ghost-status-dot--success {
  background: var(--ghost-success);
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

.ghost-status-dot--error {
  background: var(--ghost-error);
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.5);
}

.ghost-status-dot--running {
  background: var(--ghost-primary);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
}

.ghost-status-dot--idle {
  background: var(--ghost-text-dim);
}

/* ===== 布局 ===== */

/* 侧边栏 */
.ghost-sider {
  background: #080b10 !important;
  border-right: 1px solid var(--ghost-border);
}

.ghost-sider .ant-menu-item-selected {
  background: rgba(0, 212, 255, 0.12) !important;
  border-left: 3px solid var(--ghost-primary);
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.15);
}

.ghost-sider .ant-menu-item {
  transition: transform 0.2s ease, background 0.2s ease;
}

.ghost-sider .ant-menu-item:not(.ant-menu-item-selected) {
  border-left: 3px solid transparent;
}

.ghost-sider .ant-menu-item:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  transform: translateX(4px);
}

/* 终端风格 Logo */
.ghost-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  font-family: var(--ghost-font-mono);
  font-size: 15px;
  letter-spacing: 0.5px;
  background: #07090d;
  border-bottom: 1px solid var(--ghost-border);
}

.ghost-logo-user {
  color: var(--ghost-primary);
  font-weight: 600;
}

.ghost-logo-path {
  color: var(--ghost-text-secondary);
}

.ghost-cursor {
  color: var(--ghost-primary);
  margin-left: 4px;
}

/* 顶部 Header */
.ghost-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background: var(--ghost-panel-deep);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ghost-border);
}

.ghost-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ghost-text);
}

.ghost-header-extra {
  display: flex;
  align-items: center;
  gap: 20px;
  color: var(--ghost-text-secondary);
  font-size: 14px;
}

.ghost-header-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 内容区 — 蓝图网格（细点 + 主网格线） */
.ghost-content {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: var(--ghost-bg);
  background-image:
    radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.06) 1px, transparent 0),
    linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
  background-size: 32px 32px, 160px 160px, 160px 160px;
}

/* ===== 卡片 ===== */
.ghost-card {
  background: var(--ghost-panel);
  border: 1px solid var(--ghost-border);
  border-radius: var(--ghost-radius);
  transition: border-color 0.2s ease;
}

.ghost-card:hover {
  border-color: var(--ghost-border-strong);
}

.ghost-card .ant-card-head {
  border-bottom: 1px solid var(--ghost-border);
  color: var(--ghost-text);
  min-height: 52px;
}

.ghost-card .ant-card-head-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ghost-text);
}

.ghost-card .ant-card-body {
  color: var(--ghost-text);
}

/* 统计卡 — 仪器面板 */
.ghost-stat-card {
  border-radius: var(--ghost-radius);
  background: var(--ghost-panel);
  border: 1px solid var(--ghost-border);
  transition: transform 0.2s ease, border-color 0.2s ease;
  position: relative;
  overflow: hidden;
}

.ghost-stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--stat-color, var(--ghost-primary)), transparent);
}

.ghost-stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--ghost-border-strong);
}

.ghost-stat-card .ant-card-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
}

/* 方形圆角图标容器 — 几何感 */
.ghost-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  font-size: 20px;
}

.ghost-stat-value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--ghost-text);
  font-variant-numeric: tabular-nums;
}

.ghost-stat-label {
  font-size: 13px;
  color: var(--ghost-text-secondary);
}

/* 英文 micro 标签 */
.ghost-stat-micro {
  font-family: var(--ghost-font-mono);
  font-size: 10px;
  letter-spacing: 1.5px;
  color: var(--ghost-text-dim);
  margin-top: 2px;
}

/* 表格操作列 */
.ghost-table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ghost-table-actions .ant-btn:hover {
  background: rgba(0, 212, 255, 0.1) !important;
}

/* 筛选栏 */
.ghost-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
  background: var(--ghost-panel);
  border: 1px solid var(--ghost-border);
  border-radius: var(--ghost-radius);
}

/* ===== 终端日志行 ===== */
.ghost-log-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  font-family: var(--ghost-font-mono);
  font-size: 13px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.ghost-log-line:hover {
  background: var(--ghost-hover);
}

.ghost-log-time {
  color: var(--ghost-text-dim);
}

.ghost-log-name {
  color: var(--ghost-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ghost-log-status {
  width: 56px;
  text-align: center;
  flex-shrink: 0;
}

.ghost-log-status--ok {
  color: var(--ghost-success);
}

.ghost-log-status--fail {
  color: var(--ghost-error);
}

.ghost-log-status--run {
  color: var(--ghost-primary);
}

/* ===== 动画 ===== */
@media (prefers-reduced-motion: no-preference) {
  /* 页面入场 */
  @keyframes ghostPageEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ghost-page-enter {
    animation: ghostPageEnter 300ms ease-out forwards;
  }

  /* 卡片入场 */
  @keyframes ghostCardEnter {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .ghost-card-enter {
    animation: ghostCardEnter 400ms ease-out forwards;
    opacity: 0;
  }

  /* 状态脉冲 */
  @keyframes ghostStatusPulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4);
    }
    50% {
      box-shadow: 0 0 0 6px rgba(74, 222, 128, 0);
    }
  }

  .ghost-status-pulse {
    animation: ghostStatusPulse 2s ease-in-out infinite;
  }

  /* 运行中状态点脉冲 */
  .ghost-status-dot--running {
    animation: ghostStatusPulse 2s ease-in-out infinite;
  }

  /* 淡入 */
  @keyframes ghostFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .ghost-fade-in {
    animation: ghostFadeIn 300ms ease-out forwards;
  }

  /* 数字回弹 */
  @keyframes ghostNumberPop {
    0% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }

  .ghost-number-pop {
    animation: ghostNumberPop 200ms ease-out forwards;
  }

  /* 终端光标闪烁 */
  @keyframes ghostBlink {
    0%, 49% {
      opacity: 1;
    }
    50%, 100% {
      opacity: 0;
    }
  }

  .ghost-cursor {
    animation: ghostBlink 1.1s step-end infinite;
  }
}

/* ===== Ant Design 暗黑覆盖 ===== */

/* 布局 */
.ant-layout {
  background: var(--ghost-bg) !important;
}

.ant-layout-sider {
  background: #080b10 !important;
}

.ant-layout-header {
  background: var(--ghost-panel-deep) !important;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--ghost-border) !important;
}

.ant-menu-dark {
  background: transparent !important;
}

.ant-menu-dark .ant-menu-item-selected {
  background: rgba(0, 212, 255, 0.12) !important;
}

/* 卡片 */
.ant-card {
  background: var(--ghost-panel) !important;
  border-color: var(--ghost-border) !important;
  color: var(--ghost-text) !important;
}

.ant-card-bordered {
  border: 1px solid var(--ghost-border) !important;
}

/* 表格 */
.ant-table {
  background: transparent !important;
  color: var(--ghost-text) !important;
}

.ant-table-thead > tr > th {
  background: var(--ghost-inset) !important;
  color: var(--ghost-text-secondary) !important;
  border-bottom: 1px solid var(--ghost-border) !important;
  font-size: 12px;
  font-weight: 600;
}

.ant-table-tbody > tr > td {
  border-bottom: 1px solid var(--ghost-border) !important;
  color: var(--ghost-text) !important;
}

.ant-table-tbody > tr:hover > td {
  background: rgba(0, 212, 255, 0.04) !important;
}

.ant-table-expanded-row > td {
  background: var(--ghost-inset) !important;
}

/* 弹窗 */
.ant-modal-content {
  background: rgba(12, 15, 22, 0.97) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--ghost-border-strong);
  border-radius: var(--ghost-radius-lg);
}

.ant-modal-header {
  background: transparent !important;
  border-bottom: 1px solid var(--ghost-border) !important;
}

.ant-modal-title {
  color: var(--ghost-text) !important;
}

.ant-modal-body {
  color: var(--ghost-text);
}

.ant-modal-mask {
  background: rgba(0, 0, 0, 0.7) !important;
  backdrop-filter: blur(4px);
}

/* 按钮 */
.ant-btn-primary:not(:disabled) {
  background: linear-gradient(135deg, var(--ghost-primary) 0%, var(--ghost-secondary) 100%) !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.2);
}

.ant-btn-primary:not(:disabled):hover {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3) !important;
}

.ant-btn-default {
  background: var(--ghost-inset) !important;
  border-color: var(--ghost-border-strong) !important;
  color: var(--ghost-text) !important;
}

.ant-btn-default:hover {
  border-color: var(--ghost-primary) !important;
  color: var(--ghost-primary) !important;
}

/* 输入框 */
.ant-input,
.ant-input-affix-wrapper,
.ant-select-selector,
.ant-picker {
  background: var(--ghost-inset) !important;
  border-color: var(--ghost-border-strong) !important;
  color: var(--ghost-text) !important;
}

.ant-input::placeholder {
  color: var(--ghost-text-dim) !important;
}

.ant-input:hover,
.ant-input-affix-wrapper:hover,
.ant-select-selector:hover {
  border-color: var(--ghost-primary) !important;
}

.ant-input:focus,
.ant-input-affix-wrapper:focus,
.ant-input-focused,
.ant-select-focused .ant-select-selector {
  border-color: var(--ghost-primary) !important;
  box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.1) !important;
}

/* Select 下拉 */
.ant-select-dropdown {
  background: var(--ghost-inset) !important;
  border: 1px solid var(--ghost-border-strong);
}

.ant-select-item {
  color: var(--ghost-text) !important;
}

.ant-select-item-option-selected {
  background: rgba(0, 212, 255, 0.15) !important;
}

.ant-select-item-option-active {
  background: rgba(0, 212, 255, 0.08) !important;
}

/* 描述列表 */
.ant-descriptions-item-label {
  color: var(--ghost-text-secondary) !important;
}

.ant-descriptions-item-content {
  color: var(--ghost-text) !important;
}

/* 警告提示 */
.ant-alert {
  background: var(--ghost-inset) !important;
  border-color: var(--ghost-border-strong) !important;
}

.ant-alert-info {
  border-color: rgba(0, 212, 255, 0.2) !important;
}

.ant-alert-error {
  border-color: rgba(255, 107, 107, 0.2) !important;
}

/* 空状态 */
.ant-empty-description {
  color: var(--ghost-text-secondary) !important;
}

/* 分页 */
.ant-pagination-item {
  background: var(--ghost-inset) !important;
  border-color: var(--ghost-border-strong) !important;
}

.ant-pagination-item a {
  color: var(--ghost-text) !important;
}

.ant-pagination-item-active {
  border-color: var(--ghost-primary) !important;
}

.ant-pagination-item-active a {
  color: var(--ghost-primary) !important;
}

/* 开关 */
.ant-switch {
  background: var(--ghost-hover) !important;
}

.ant-switch-checked {
  background: var(--ghost-success) !important;
}

/* 加载 */
.ant-spin-dot-item {
  background: var(--ghost-primary) !important;
}

/* 骨架屏 */
.ant-skeleton-content .ant-skeleton-title,
.ant-skeleton-content .ant-skeleton-paragraph > li {
  background: var(--ghost-inset) !important;
}
```

- [ ] **Step 2: 对齐 `frontend/src/main.tsx` 的 ConfigProvider token**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#00d4ff',
            colorBgLayout: '#07090d',
            colorBgContainer: '#0c0f16',
            colorBgElevated: '#11151f',
            colorBorder: 'rgba(255, 255, 255, 0.12)',
            colorBorderSecondary: 'rgba(255, 255, 255, 0.07)',
            colorText: '#e6eaf2',
            colorTextSecondary: '#8b94a7',
            borderRadius: 10,
          },
          components: {
            Tag: {
              defaultBg: 'rgba(148, 163, 184, 0.1)',
              defaultColor: '#8b94a7',
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 无 TypeScript 错误，构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/main.tsx docs/superpowers/plans/2026-07-17-refined-tech-ui.md
git commit -m "feat(frontend): 精化设计系统——近平黑分层/边框纪律/状态点/蓝图网格"
```

---

## Task 2: 布局精化（AppLayout + HeaderExtras）

**Files:**
- Create: `frontend/src/components/HeaderExtras.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-logo-user`、`.ghost-logo-path`、`.ghost-cursor`、`.ghost-header-status`、`.ghost-status-dot--running/--error`、`.ghost-mono`、`.ghost-dim`；`getSchedulerStatus` API（返回 `{ running: boolean; jobs: { next_run_time: string | null }[] }`）。
- Produces: `HeaderExtras` 默认导出组件（无 props）。

- [ ] **Step 1: 新建 `frontend/src/components/HeaderExtras.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { getSchedulerStatus } from '../api/schedules'

/** Header 右侧区域：调度器实时状态 + 单秒时钟 + 版本号 */
export default function HeaderExtras() {
  const [running, setRunning] = useState<boolean | null>(null)
  const [jobs, setJobs] = useState(0)
  const [now, setNow] = useState(() => new Date())

  // 单秒时钟，独立组件内更新避免整块布局重渲染
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    getSchedulerStatus()
      .then((s) => { setRunning(s.running); setJobs(s.jobs.length) })
      .catch(() => setRunning(null))
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return (
    <span className="ghost-header-extra">
      {running !== null && (
        <span className="ghost-header-status">
          <span className={`ghost-status-dot ${running ? 'ghost-status-dot--running' : 'ghost-status-dot--error'}`} />
          <span className="ghost-mono" style={{ color: 'var(--ghost-text-secondary)', fontSize: 13 }}>
            {running ? `调度器运行中 · ${jobs} 任务` : '调度器已停止'}
          </span>
        </span>
      )}
      <span className="ghost-mono ghost-dim" style={{ fontSize: 13 }}>{clock}</span>
      <span style={{ color: 'var(--ghost-text-dim)', fontSize: 13 }}>v0.1</span>
    </span>
  )
}
```

- [ ] **Step 2: 修改 `AppLayout.tsx`**

Logo 终端化 + Header 右侧接入 `HeaderExtras`，其余结构不变：

```tsx
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Result, Button } from 'antd'
import {
  DashboardOutlined, LinkOutlined, FileTextOutlined,
  ClockCircleOutlined, HistoryOutlined,
} from '@ant-design/icons'
import Dashboard from '../pages/Dashboard'
import Connections from '../pages/Connections'
import Tasks from '../pages/Tasks'
import Schedules from '../pages/Schedules'
import History from '../pages/History'
import ErrorBoundary from './ErrorBoundary'
import HeaderExtras from './HeaderExtras'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/connections', icon: <LinkOutlined />, label: '连接管理' },
  { key: '/tasks', icon: <FileTextOutlined />, label: '任务管理' },
  { key: '/schedules', icon: <ClockCircleOutlined />, label: '调度配置' },
  { key: '/history', icon: <HistoryOutlined />, label: '运行历史' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentLabel = menuItems.find((i) => i.key === location.pathname)?.label || 'Ghost Flow Work App'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220} breakpoint="lg" collapsedWidth={64} className="ghost-sider">
        <div className="ghost-logo">
          <span className="ghost-logo-user">ghost@flow</span>
          <span className="ghost-logo-path">:~$</span>
          <span className="ghost-cursor">▍</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout>
        <Header className="ghost-header">
          <span className="ghost-header-title">{currentLabel}</span>
          <HeaderExtras />
        </Header>
        <Content className="ghost-content">
          <div className="ghost-page-enter" key={location.pathname}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/connections" element={<Connections />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/schedules" element={<Schedules />} />
                <Route path="/history" element={<History />} />
                <Route path="*" element={
                  <Result status="404" title="404" subTitle="页面不存在"
                    extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>} />
                } />
              </Routes>
            </ErrorBoundary>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
```

- [ ] **Step 3: 验证构建与 lint**

Run: `cd frontend && pnpm build` — Expected: 构建成功。
Run: `cd frontend && pnpm lint` — Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HeaderExtras.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(frontend): Logo 终端化，Header 增加调度器状态与实时时钟"
```

---

## Task 3: Dashboard 仪器面板化

**Files:**
- Modify: `frontend/src/pages/Dashboard/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-stat-micro`、`.ghost-log-line` 系列、`.ghost-status-dot` 系列、`.ghost-mono`、`.ghost-dim`、`.ghost-card-enter`、`.ghost-status-pulse`、`.ghost-number-pop`、`.ghost-fade-in`。
- Produces: 更新后的 Dashboard 页面。

- [ ] **Step 1: 统计卡增加英文 micro 标签**

`statCards` 增加 `micro` 字段：

```tsx
const statCards = [
  { title: '数据库连接', micro: 'CONNECTIONS', value: connCount, icon: <LinkOutlined />, color: '#00d4ff' },
  { title: '任务总数', micro: 'TASKS', value: taskCount, icon: <FileTextOutlined />, color: '#7c3aed' },
  { title: '成功执行', micro: 'SUCCEEDED', value: successCount, icon: <CheckCircleOutlined />, color: '#4ade80' },
  { title: '失败执行', micro: 'FAILED', value: failCount, icon: <CloseCircleOutlined />, color: '#ff6b6b' },
]
```

渲染部分（图标容器改为无发光、标签下加 micro 行）：

```tsx
<Row gutter={[20, 20]}>
  {statCards.map((item, index) => (
    <Col xs={24} sm={12} lg={6} key={item.title}>
      <Card
        className="ghost-stat-card ghost-card-enter"
        loading={loading}
        bordered={false}
        style={{
          '--stat-color': item.color,
          animationDelay: `${index * 60}ms`,
        } as CSSProperties}
      >
        <span className="ghost-stat-icon" style={{ background: `${item.color}18`, color: item.color }}>
          {item.icon}
        </span>
        <div>
          <div className="ghost-stat-value ghost-number-pop" key={item.value}>
            {item.value}
          </div>
          <div className="ghost-stat-label">{item.title}</div>
          <div className="ghost-stat-micro">{item.micro}</div>
        </div>
      </Card>
    </Col>
  ))}
</Row>
```

- [ ] **Step 2: 调度引擎状态卡改用状态点**

```tsx
<Card className="ghost-card ghost-card-enter" style={{ animationDelay: '240ms' }}
  title={<span><ClockCircleOutlined /> 调度引擎状态</span>} loading={loading}>
  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <Space>
      <span className={`ghost-status-dot ${schedulerRunning ? 'ghost-status-dot--success ghost-status-pulse' : 'ghost-status-dot--error'}`} />
      <span style={{ fontWeight: 600, fontSize: 16, color: schedulerRunning ? 'var(--ghost-success)' : 'var(--ghost-error)' }}>
        {schedulerRunning ? '运行中' : '已停止'}
      </span>
    </Space>
    <div style={{ color: 'var(--ghost-text-secondary)' }}>
      活跃定时任务：<strong className="ghost-mono" style={{ color: 'var(--ghost-text)' }}>{schedulerJobs}</strong>
    </div>
    <Button type="link" style={{ padding: 0, color: 'var(--ghost-primary)' }} onClick={() => navigate('/schedules')}>
      查看调度配置
    </Button>
  </Space>
</Card>
```

注意：移除 `Badge` 导入（如不再使用）。

- [ ] **Step 3: 最近运行记录终端日志化**

```tsx
<Card className="ghost-card ghost-card-enter" style={{ animationDelay: '300ms' }}
  title="最近运行记录" loading={loading}>
  {recentRuns.length === 0 ? (
    <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : (
    <div className="ghost-fade-in">
      {recentRuns.map((run) => {
        const time = run.started_at ? new Date(run.started_at) : null
        const pad = (n: number) => String(n).padStart(2, '0')
        const hhmmss = time ? `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}` : '--:--:--'
        const statusClass = run.status === 'success' ? 'ghost-log-status--ok' : run.status === 'failed' ? 'ghost-log-status--fail' : 'ghost-log-status--run'
        const statusText = run.status === 'success' ? '[ OK ]' : run.status === 'failed' ? '[FAIL]' : '[RUN ]'
        return (
          <div key={run.id} className="ghost-log-line">
            <span className="ghost-log-time">{hhmmss}</span>
            <span className="ghost-dim">#{run.id}</span>
            <span className="ghost-log-name">{getTaskName(run.task_id)}</span>
            <span className={`ghost-log-status ${statusClass}`}>{statusText}</span>
          </div>
        )
      })}
      <Button type="link" style={{ padding: '8px 0 0', color: 'var(--ghost-primary)' }} onClick={() => navigate('/history')}>
        查看全部历史
      </Button>
    </div>
  )}
</Card>
```

- [ ] **Step 4: 验证构建与 lint**

Run: `cd frontend && pnpm build` — Expected: 构建成功。
Run: `cd frontend && pnpm lint` — Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard/index.tsx
git commit -m "feat(frontend): 仪表盘仪器面板化与终端日志风最近运行"
```

---

## Task 4: Tasks + Schedules 状态系统统一

**Files:**
- Modify: `frontend/src/pages/Tasks/index.tsx`
- Modify: `frontend/src/pages/Schedules/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-status-dot` 系列、`.ghost-mono`、`.ghost-dim`、`.ghost-status-pulse`。
- Produces: 更新后的 Tasks / Schedules 页面。

- [ ] **Step 1: Tasks 名称列 ID 等宽化**

名称列 render 中的 `#id` 改为：

```tsx
<Text className="ghost-mono ghost-dim" style={{ fontSize: 12 }}>#{record.id}</Text>
```

- [ ] **Step 2: Tasks 调度列状态点化（替换呼吸点 + Tag）**

```tsx
{
  title: '调度',
  key: 'enabled',
  width: 140,
  render: (_: unknown, record: TaskItem) => (
    record.schedule_config ? (
      <Space size={8}>
        <span className={`ghost-status-dot ${record.enabled ? 'ghost-status-dot--success ghost-status-pulse' : 'ghost-status-dot--idle'}`} />
        <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record)} />
        <span style={{ fontSize: 13, color: record.enabled ? 'var(--ghost-text)' : 'var(--ghost-text-dim)' }}>
          {record.enabled ? '已启用' : '已停用'}
        </span>
      </Space>
    ) : (
      <span className="ghost-dim" style={{ fontSize: 13 }}>未配置</span>
    )
  ),
},
```

- [ ] **Step 3: Schedules 引擎状态卡状态点化**

```tsx
<Card className="ghost-card ghost-card-enter" loading={loading}
  style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.04), rgba(124, 58, 237, 0.04))' }}>
  <Space size="large" align="center">
    <Space>
      <span className={`ghost-status-dot ${status?.running ? 'ghost-status-dot--success ghost-status-pulse' : 'ghost-status-dot--error'}`} />
      <span style={{ fontSize: 18, fontWeight: 600, color: status?.running ? 'var(--ghost-success)' : 'var(--ghost-error)' }}>
        {status?.running ? '运行中' : '已停止'}
      </span>
    </Space>
    <div style={{ color: 'var(--ghost-text-secondary)' }}>
      活跃定时任务：<strong className="ghost-mono" style={{ color: 'var(--ghost-text)' }}>{status?.jobs.length ?? 0}</strong>
    </div>
    <div style={{ color: 'var(--ghost-text-secondary)' }}>
      下次触发：
      <strong className="ghost-mono" style={{ color: 'var(--ghost-primary)' }}>
        {status?.jobs.length
          ? new Date(Math.min(...status.jobs.map((j) => new Date(j.next_run_time!).getTime()))).toLocaleString('zh-CN')
          : '-'}
      </strong>
    </div>
  </Space>
  <Alert
    type="info"
    showIcon
    message="提示"
    description="定时调度在「任务管理」页面配置 Cron 表达式后自动生效。"
    style={{ marginTop: 16 }}
  />
</Card>
```

注意：Schedules 页面移除 `Badge` 导入（如不再使用）。

- [ ] **Step 4: Schedules 列表等宽化**

名称列 `#id` 改为：

```tsx
<Text className="ghost-mono ghost-dim" style={{ fontSize: 12 }}>#{record.id}</Text>
```

Cron 表达式列改为纯等宽文本（去掉 Tag）：

```tsx
{
  title: 'Cron 表达式',
  key: 'cron',
  width: 150,
  render: (_: unknown, r: ScheduleItem) => {
    try {
      const cfg = JSON.parse(r.schedule_config)
      return <span className="ghost-mono" style={{ color: 'var(--ghost-primary)', fontSize: 13 }}>{cfg.cron || '-'}</span>
    } catch { return <span className="ghost-dim">-</span> }
  },
},
```

下次执行列的时间文本包上 `ghost-mono`：

```tsx
return <span className="ghost-mono" style={{ fontSize: 13 }}>{rel}（{abs}）</span>
```

- [ ] **Step 5: 验证构建与 lint**

Run: `cd frontend && pnpm build` — Expected: 构建成功。
Run: `cd frontend && pnpm lint` — Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Tasks/index.tsx frontend/src/pages/Schedules/index.tsx
git commit -m "feat(frontend): 任务与调度页统一状态点语言，技术数据等宽化"
```

---

## Task 5: Connections + History 精化

**Files:**
- Modify: `frontend/src/pages/Connections/index.tsx`
- Modify: `frontend/src/pages/History/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-status-dot` 系列、`.ghost-mono`、`.ghost-dim`。
- Produces: 更新后的 Connections / History 页面。

- [ ] **Step 1: Connections 名称列 ID 等宽化**

```tsx
<Text className="ghost-mono ghost-dim" style={{ fontSize: 12 }}>#{record.id}</Text>
```

- [ ] **Step 2: Connections 配置摘要字体 token 化**

将配置摘要 render 中的 `fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'` 改为：

```tsx
return <Text className="ghost-mono" style={{ color: 'var(--ghost-text-secondary)' }}>{text}</Text>
```

（即移除内联 fontFamily，改用 `.ghost-mono` 类；颜色用 token。）

- [ ] **Step 3: History 状态列状态点化（替换 Tag）**

```tsx
{
  title: '状态', dataIndex: 'status', key: 'status', width: 110,
  render: (s: string) => {
    const dotClass = s === 'success' ? 'ghost-status-dot--success' : s === 'failed' ? 'ghost-status-dot--error' : 'ghost-status-dot--running'
    const label = s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'
    return (
      <Space size={6}>
        <span className={`ghost-status-dot ${dotClass}`} />
        <span style={{ fontSize: 13 }}>{label}</span>
      </Space>
    )
  },
},
```

- [ ] **Step 4: History 技术数据等宽化**

Run ID 列：

```tsx
<Text className="ghost-mono" strong style={{ fontSize: 13, color: 'var(--ghost-primary)' }}>#{id}</Text>
```

任务列 `#task_id` 由 Tag 改为等宽弱化文本：

```tsx
<span className="ghost-mono ghost-dim" style={{ fontSize: 13 }}>#{r.task_id}</span>
```

开始时间列 render 加 `ghost-mono`：

```tsx
render: (v: string) => v
  ? <span className="ghost-mono" style={{ fontSize: 13 }}>{new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
  : '-',
```

耗时列 span 增加 `ghost-mono` class：

```tsx
return <span className="ghost-mono" style={{ color, fontSize: 13 }}>{text}</span>
```

（移除原内联 `fontVariantNumeric`。）

- [ ] **Step 5: 验证构建与 lint**

Run: `cd frontend && pnpm build` — Expected: 构建成功。
Run: `cd frontend && pnpm lint` — Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Connections/index.tsx frontend/src/pages/History/index.tsx
git commit -m "feat(frontend): 连接与历史页状态点化，技术数据等宽化"
```

---

## Task 6: 最终验证（含真实浏览器走查）

**Files:**
- 所有上述修改的文件。

- [ ] **Step 1: 运行 TypeScript 构建**

Run: `cd frontend && pnpm build`
Expected: 无 TypeScript 错误，构建成功生成 `frontend/dist/`。

- [ ] **Step 2: 运行 lint**

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 3: dev server 冒烟验证**

```bash
cd frontend && pnpm dev &
sleep 5
curl -s http://localhost:5173 | head -20
```

Expected: 返回 HTML 且包含 root 挂载点。随后检查构建产物包含新样式：

```bash
grep -o "ghost-status-dot" frontend/dist/assets/*.css | head -1
grep -o "ghost-log-line" frontend/dist/assets/*.css | head -1
grep -o "ghost-cursor" frontend/dist/assets/*.css | head -1
```

Expected: 三条 grep 均有输出（证明新 CSS 已打包）。

- [ ] **Step 4: 浏览器走查（用户确认）**

向用户说明：请启动前后端（`cd backend && uv run uvicorn app.main:app --port 8000`，`cd frontend && pnpm dev`）并强制刷新（Ctrl+F5），依次确认：

- 整体：近黑分层背景 + 蓝图网格、无玻璃模糊卡片、细边框。
- 侧边栏：终端风 `ghost@flow:~$` Logo + 闪烁光标；选中项青色竖线不跳动。
- Header：右侧调度器状态点 + 单秒时钟走动 + 版本号。
- 仪表盘：统计卡方形图标 + 英文 micro 标签；调度状态为彩色状态点；最近运行为终端日志行（等宽时间戳 + `[ OK ]/[FAIL]`）。
- 任务管理：调度列状态点 + Switch；ID 等宽。
- 调度配置：状态卡状态点；Cron 为青色等宽文本；下次执行等宽。
- 运行历史：状态列彩色状态点；Run ID/时间/耗时等宽。
- 连接管理：ID 等宽；配置摘要等宽。
- 系统「减少动态效果」开启时：光标不闪烁、动画禁用。

- [ ] **Step 5: Commit 任何修复**

```bash
git add -A
git commit -m "fix(frontend): 精致工程工具风细节修复"
```

---

## Self-Review

1. **Spec coverage（设计决策 → 任务）：**
   - 背景分层（决策 1）→ Task 1（tokens + `.ghost-card`/antd 覆盖去玻璃化）。
   - 边框纪律（决策 2）→ Task 1（`.ghost-card`/`.ghost-stat-card` 去重阴影与光晕）。
   - 统一状态点（决策 3）→ Task 1 定义 `.ghost-status-dot`；Task 3 Dashboard、Task 4 Tasks/Schedules、Task 5 History 逐页应用；Task 2 Header 应用。
   - 等宽数据（决策 4）→ Task 1 定义 `.ghost-mono`；Task 2 时钟；Task 3 日志行/活跃任务数；Task 4 Cron/ID/下次执行；Task 5 Run ID/时间/耗时/配置摘要。
   - 终端化点缀（决策 5）→ Task 2 Logo/HeaderExtras；Task 3 最近运行日志化。
   - 蓝图网格（决策 6）→ Task 1 `.ghost-content`。
   - 构建/lint/真实走查 → 各 Task 验证步 + Task 6（含 dev server 冒烟与用户走查清单）。
   无遗漏。

2. **Placeholder scan:** 无 TBD/TODO；所有代码片段为可直接使用的完整代码。

3. **Type consistency:** `.ghost-status-dot--*`、`.ghost-log-*`、`.ghost-mono`、`.ghost-dim`、`.ghost-cursor`、`.ghost-stat-micro`、`.ghost-header-status` 在 Task 1 定义，后续任务一致引用；`getSchedulerStatus` 签名与 `frontend/src/api/schedules.ts` 现有导出一致（`SchedulerStatus { running: boolean; jobs: ... }`）；`HeaderExtras` 无 props，AppLayout 直接引用。

4. **风险记录：**
   - `.ant-tag` 预设色不得再加 `!important` 覆盖（沿用上次修复后的 ConfigProvider token 方案）。
   - History 展开详情内的状态 Tag 保留（Tag 预设色在 darkAlgorithm + token 下正常显示），仅列表状态列改状态点——保持改动最小。
   - Tasks 执行结果弹窗的渐变状态 Tag 不在本次范围内，保持现状。
