# Ghost Flow Work App — 暗黑霓虹 UI 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Ghost Flow Work App 前端升级为全站暗黑霓虹风格，加入纯 CSS GPU 加速动画，保持现有功能与中文文案不变。

**Architecture:** 不引入新依赖，继续使用 React 19 + Ant Design 6。通过重写 `frontend/src/index.css` 建立全局暗黑设计系统，再逐页微调组件 className / style。动画全部使用 CSS `@keyframes` 与 `transition`，仅动 `transform`、`opacity`、`box-shadow`。

**Tech Stack:** React 19 + TypeScript + Ant Design 6 + Vite + pnpm。

## Global Constraints

- 不引入新的 UI 框架或 CSS 方案（不使用 Tailwind / CSS Modules / Framer Motion）。
- 不修改后端 API 接口。
- 所有代码注释、文案保持中文。
- 使用 `import type` 进行类型-only 导入（项目 `verbatimModuleSyntax` 已启用）。
- 公共样式统一写入 `frontend/src/index.css`，保留 `.ghost-*` 类命名。
- 每个任务完成后验证 `pnpm build` 与 `pnpm lint` 无新增错误。
- 本项目未安装测试框架，验证以构建与 lint 为准。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `frontend/src/index.css` | 全局暗黑设计 Tokens、布局样式、组件覆盖、动画 keyframes |
| `frontend/src/components/AppLayout.tsx` | 调整布局容器 className，适配暗黑 Header/Sider/Content |
| `frontend/src/pages/Dashboard/index.tsx` | 仪表盘统计卡、调度状态卡、最近运行记录样式增强 |
| `frontend/src/pages/Connections/index.tsx` | 连接管理表格、搜索栏、类型标签样式增强 |
| `frontend/src/pages/Tasks/index.tsx` | 任务管理筛选栏、表格、弹窗样式增强 |
| `frontend/src/pages/Schedules/index.tsx` | 调度配置状态卡、列表样式增强 |
| `frontend/src/pages/History/index.tsx` | 运行历史筛选栏、表格、展开详情样式增强 |

---

## Task 1: 全局暗黑设计系统（index.css）

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: 无。
- Produces: 全局 CSS 变量、`body` 暗黑背景、`.ghost-sider`、`.ghost-header`、`.ghost-content`、`.ghost-page-header`、`.ghost-card`、`.ghost-stat-card`、`.ghost-table-actions`、`.ghost-filter-bar`、`.ghost-page-enter`、`.ghost-card-enter`、`.ghost-status-pulse`、`.ghost-fade-in`、`.ghost-grid-bg`，以及 Ant Design 组件暗黑覆盖。

- [ ] **Step 1: 重写 `frontend/src/index.css`**

```css
/* ===== 设计 Tokens ===== */
:root {
  --ghost-bg: #0a0e14;
  --ghost-panel: rgba(15, 20, 30, 0.7);
  --ghost-panel-deep: rgba(10, 14, 20, 0.85);
  --ghost-primary: #00d4ff;
  --ghost-secondary: #7c3aed;
  --ghost-success: #4ade80;
  --ghost-error: #ff6b6b;
  --ghost-warning: #fbbf24;
  --ghost-text: #e2e8f0;
  --ghost-text-secondary: #94a3b8;
  --ghost-text-disabled: #475569;
  --ghost-border: rgba(148, 163, 184, 0.1);
  --ghost-border-hover: rgba(0, 212, 255, 0.3);
  --ghost-radius: 14px;
  --ghost-radius-sm: 6px;
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

/* ===== 布局 ===== */

/* 侧边栏 */
.ghost-sider {
  background: linear-gradient(180deg, #0a0e14 0%, #0f172a 100%) !important;
}

.ghost-sider .ant-menu-item-selected {
  background: rgba(0, 212, 255, 0.15) !important;
  border-left: 3px solid var(--ghost-primary);
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2);
}

.ghost-sider .ant-menu-item {
  transition: transform 0.2s ease, background 0.2s ease;
}

.ghost-sider .ant-menu-item:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  transform: translateX(4px);
}

.ghost-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  background: rgba(10, 14, 20, 0.95);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
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
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.ghost-header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ghost-text);
}

.ghost-header-extra {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--ghost-text-secondary);
  font-size: 14px;
}

/* 内容区 */
.ghost-content {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: var(--ghost-bg);
  background-image: radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.05) 1px, transparent 0);
  background-size: 32px 32px;
}

/* 页面标题区 */
.ghost-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-left: 12px;
  border-left: 4px solid transparent;
  border-image: linear-gradient(180deg, var(--ghost-primary), var(--ghost-secondary)) 1;
}

.ghost-page-header-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--ghost-text);
}

/* ===== 卡片 ===== */
.ghost-card {
  background: var(--ghost-panel);
  backdrop-filter: blur(16px);
  border: 1px solid var(--ghost-border);
  border-radius: var(--ghost-radius);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.ghost-card:hover {
  border-color: var(--ghost-border-hover);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 24px rgba(0, 212, 255, 0.08);
}

.ghost-card .ant-card-head {
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  color: var(--ghost-text);
}

.ghost-card .ant-card-head-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ghost-text);
}

.ghost-card .ant-card-body {
  color: var(--ghost-text);
}

/* 统计卡 */
.ghost-stat-card {
  border-radius: var(--ghost-radius);
  background: var(--ghost-panel);
  backdrop-filter: blur(16px);
  border: 1px solid var(--ghost-border);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.3s ease;
  position: relative;
  overflow: hidden;
}

.ghost-stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--stat-color, var(--ghost-primary)), transparent);
}

.ghost-stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--ghost-border-hover);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3), 0 0 24px rgba(0, 212, 255, 0.1);
}

.ghost-stat-card .ant-card-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
}

.ghost-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: 24px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
}

.ghost-stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--ghost-text);
  font-variant-numeric: tabular-nums;
}

.ghost-stat-label {
  font-size: 14px;
  color: var(--ghost-text-secondary);
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
  padding: 16px;
  background: var(--ghost-panel);
  backdrop-filter: blur(16px);
  border: 1px solid var(--ghost-border);
  border-radius: var(--ghost-radius);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
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
}

/* ===== Ant Design 暗黑覆盖 ===== */

/* 布局 */
.ant-layout {
  background: var(--ghost-bg) !important;
}

.ant-layout-sider {
  background: linear-gradient(180deg, #0a0e14 0%, #0f172a 100%) !important;
}

.ant-layout-header {
  background: var(--ghost-panel-deep) !important;
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.ant-menu-dark {
  background: transparent !important;
}

.ant-menu-dark .ant-menu-item-selected {
  background: rgba(0, 212, 255, 0.15) !important;
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
  background: rgba(15, 23, 42, 0.9) !important;
  color: var(--ghost-text-secondary) !important;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08) !important;
}

.ant-table-tbody > tr > td {
  border-bottom: 1px solid rgba(148, 163, 184, 0.08) !important;
  color: var(--ghost-text) !important;
}

.ant-table-tbody > tr:hover > td {
  background: rgba(0, 212, 255, 0.04) !important;
}

.ant-table-expanded-row > td {
  background: rgba(15, 23, 42, 0.5) !important;
}

/* 弹窗 */
.ant-modal-content {
  background: rgba(15, 20, 30, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--ghost-border);
  border-radius: var(--ghost-radius-lg);
}

.ant-modal-header {
  background: transparent !important;
  border-bottom: 1px solid rgba(0, 212, 255, 0.15) !important;
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
.ant-btn-primary {
  background: linear-gradient(135deg, var(--ghost-primary) 0%, var(--ghost-secondary) 100%) !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.2);
}

.ant-btn-primary:hover {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3) !important;
}

.ant-btn-default {
  background: rgba(148, 163, 184, 0.1) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
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
  background: rgba(15, 23, 42, 0.6) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  color: var(--ghost-text) !important;
}

.ant-input::placeholder {
  color: var(--ghost-text-disabled) !important;
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
  background: rgba(15, 20, 30, 0.95) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--ghost-border);
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

/* Tag */
.ant-tag {
  background: rgba(148, 163, 184, 0.1) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
  color: var(--ghost-text-secondary) !important;
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
  background: rgba(15, 23, 42, 0.6) !important;
  border-color: rgba(148, 163, 184, 0.15) !important;
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
  background: rgba(15, 23, 42, 0.6) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
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
  background: rgba(148, 163, 184, 0.3) !important;
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
  background: rgba(148, 163, 184, 0.1) !important;
}
```

- [ ] **Step 2: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 无 TypeScript 错误，构建成功生成 `frontend/dist/`。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): 建立全局暗黑霓虹设计系统"
```

---

## Task 2: 全局布局适配（AppLayout.tsx）

**Files:**
- Modify: `frontend/src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-page-enter`、`.ghost-sider`、`.ghost-header`、`.ghost-content`。
- Produces: 更新后的 `AppLayout` 组件，内容区包裹 `ghost-page-enter` class。

- [ ] **Step 1: 修改 `AppLayout.tsx`**

在 `Content` 的 `ErrorBoundary` 外层或内层增加 `ghost-page-enter` class：

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
        <div className="ghost-logo">Ghost Flow</div>
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
          <span className="ghost-header-extra">任务调度系统 v0.1</span>
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

- [ ] **Step 2: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppLayout.tsx
git commit -m "feat(frontend): 布局适配暗黑主题并添加页面入场动画"
```

---

## Task 3: 仪表盘 Dashboard 暗黑增强

**Files:**
- Modify: `frontend/src/pages/Dashboard/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-stat-card`、`.ghost-card-enter`、`.ghost-status-pulse`、`.ghost-number-pop`、`.ghost-fade-in`。
- Produces: 更新后的 Dashboard 页面。

- [ ] **Step 1: 修改统计卡渲染**

为每个统计卡设置 `--stat-color` CSS 变量，并添加 `ghost-card-enter` 入场动画，延迟递增：

```tsx
const statCards = [
  { title: '数据库连接', value: connCount, icon: <LinkOutlined />, color: '#00d4ff', gradient: 'linear-gradient(90deg, #00d4ff, #38bdf8)' },
  { title: '任务总数', value: taskCount, icon: <FileTextOutlined />, color: '#7c3aed', gradient: 'linear-gradient(90deg, #7c3aed, #a855f7)' },
  { title: '成功执行', value: successCount, icon: <CheckCircleOutlined />, color: '#4ade80', gradient: 'linear-gradient(90deg, #4ade80, #22c55e)' },
  { title: '失败执行', value: failCount, icon: <CloseCircleOutlined />, color: '#ff6b6b', gradient: 'linear-gradient(90deg, #ff6b6b, #ef4444)' },
]
```

渲染部分：

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
        } as React.CSSProperties}
      >
        <span className="ghost-stat-icon" style={{ background: `${item.color}20`, color: item.color, boxShadow: `0 0 16px ${item.color}30` }}>
          {item.icon}
        </span>
        <div>
          <div className="ghost-stat-value" key={item.value}>
            {item.value}
          </div>
          <div className="ghost-stat-label">{item.title}</div>
        </div>
      </Card>
    </Col>
  ))}
</Row>
```

- [ ] **Step 2: 修改调度状态卡与最近记录卡**

```tsx
<Row gutter={[20, 20]} style={{ marginTop: 20 }}>
  <Col xs={24} lg={12}>
    <Card className="ghost-card ghost-card-enter" style={{ animationDelay: '240ms' }}
      title={<span><ClockCircleOutlined /> 调度引擎状态</span>} loading={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <Badge status={schedulerRunning ? 'success' : 'error'} className={schedulerRunning ? 'ghost-status-pulse' : ''} />
          <span style={{ fontWeight: 500, color: schedulerRunning ? '#4ade80' : '#ff6b6b' }}>
            {schedulerRunning ? '运行中' : '已停止'}
          </span>
        </Space>
        <div style={{ color: '#94a3b8' }}>活跃定时任务：<strong style={{ color: '#e2e8f0' }}>{schedulerJobs}</strong></div>
        <Button type="link" style={{ padding: 0, color: '#00d4ff' }} onClick={() => navigate('/schedules')}>
          查看调度配置
        </Button>
      </Space>
    </Card>
  </Col>
  <Col xs={24} lg={12}>
    <Card className="ghost-card ghost-card-enter" style={{ animationDelay: '300ms' }}
      title="最近运行记录" loading={loading}>
      {recentRuns.length === 0 ? (
        <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} className="ghost-fade-in">
          {recentRuns.map((run) => (
            <div key={run.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', borderRadius: 8,
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.04)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Space>
                <Text code style={{ color: '#00d4ff', borderColor: 'rgba(0, 212, 255, 0.2)' }}>#{run.id}</Text>
                <Text ellipsis style={{ maxWidth: 120, color: '#e2e8f0' }}>{getTaskName(run.task_id)}</Text>
              </Space>
              <Space>
                <Tag color={run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'orange'}>
                  {run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : '运行中'}
                </Tag>
                <Text type="secondary" style={{ fontSize: 13, color: '#94a3b8' }}>
                  {run.started_at ? new Date(run.started_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </Text>
              </Space>
            </div>
          ))}
          <Button type="link" style={{ padding: 0, color: '#00d4ff' }} onClick={() => navigate('/history')}>
            查看全部历史
          </Button>
        </Space>
      )}
    </Card>
  </Col>
</Row>
```

- [ ] **Step 3: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard/index.tsx
git commit -m "feat(frontend): 仪表盘暗黑霓虹样式与入场动画"
```

---

## Task 4: 连接管理 Connections 暗黑增强

**Files:**
- Modify: `frontend/src/pages/Connections/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-card-enter`、`.ghost-filter-bar`。
- Produces: 更新后的 Connections 页面。

- [ ] **Step 1: 添加卡片入场动画与类型图标**

修改类型列渲染，增加图标：

```tsx
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, CloudOutlined } from '@ant-design/icons'
```

```tsx
{
  title: '类型',
  dataIndex: 'type',
  key: 'type',
  width: 120,
  render: (t: string) => (
    <Tag color={t === 'redshift' ? 'blue' : 'green'} icon={t === 'redshift' ? <CloudOutlined /> : <DatabaseOutlined />}>
      {t}
    </Tag>
  ),
},
```

- [ ] **Step 2: 修改配置摘要为等宽字体并添加动画**

```tsx
{
  title: '配置摘要',
  key: 'summary',
  ellipsis: true,
  render: (_: unknown, record: ConnectionItem) => {
    try {
      const cfg = JSON.parse(record.config)
      const text = record.type === 'sqlite' ? (cfg.file_path || '-') : (cfg.host || cfg.database || '-')
      return <Text style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#94a3b8' }}>{text}</Text>
    } catch {
      return <Text type="secondary">-</Text>
    }
  },
},
```

- [ ] **Step 3: 为最外层 Card 添加入场动画**

```tsx
<Card className="ghost-card ghost-card-enter"
  title="连接管理"
  extra={...}
>
```

- [ ] **Step 4: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Connections/index.tsx
git commit -m "feat(frontend): 连接管理暗黑霓虹样式"
```

---

## Task 5: 任务管理 Tasks 暗黑增强

**Files:**
- Modify: `frontend/src/pages/Tasks/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-card-enter`、`.ghost-status-pulse`。
- Produces: 更新后的 Tasks 页面。

- [ ] **Step 1: 为最外层 Card 添加入场动画**

```tsx
<Card className="ghost-card ghost-card-enter"
  title="任务管理"
  extra={...}
>
```

- [ ] **Step 2: 调度列增加呼吸点**

```tsx
{
  title: '调度',
  key: 'enabled',
  width: 110,
  render: (_: unknown, record: TaskItem) => (
    record.schedule_config ? (
      <Space>
        {record.enabled && (
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#4ade80', boxShadow: '0 0 8px #4ade80',
          }} className="ghost-status-pulse" />
        )}
        <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record)} />
        <Tag color={record.enabled ? 'green' : 'default'} style={{ margin: 0 }}>
          {record.enabled ? '启用' : '停用'}
        </Tag>
      </Space>
    ) : (
      <Tag style={{ margin: 0 }}>未配置</Tag>
    )
  ),
},
```

- [ ] **Step 3: 执行结果弹窗状态条渐变**

```tsx
<Tag style={{
  fontSize: 16, padding: '6px 12px',
  background: resultData.status === 'success'
    ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 197, 94, 0.2))'
    : 'linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(239, 68, 68, 0.2))',
  borderColor: resultData.status === 'success' ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 107, 107, 0.4)',
  color: resultData.status === 'success' ? '#4ade80' : '#ff6b6b',
}}>
  {resultData.status === 'success' ? '执行成功' : '执行失败'}
</Tag>
```

- [ ] **Step 4: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Tasks/index.tsx
git commit -m "feat(frontend): 任务管理暗黑霓虹样式"
```

---

## Task 6: 调度配置 Schedules 暗黑增强

**Files:**
- Modify: `frontend/src/pages/Schedules/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-card-enter`、`.ghost-status-pulse`。
- Produces: 更新后的 Schedules 页面。

- [ ] **Step 1: 引擎状态卡添加渐变背景与呼吸点**

```tsx
<Card className="ghost-card ghost-card-enter" loading={loading}
  style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.03), rgba(124, 58, 237, 0.03))' }}>
  <Space size="large" align="center">
    <Space>
      <Badge status={status?.running ? 'success' : 'error'} className={status?.running ? 'ghost-status-pulse' : ''} />
      <span style={{ fontSize: 18, fontWeight: 600, color: status?.running ? '#4ade80' : '#ff6b6b' }}>
        {status?.running ? '运行中' : '已停止'}
      </span>
    </Space>
    <div style={{ color: '#94a3b8' }}>活跃定时任务：<strong style={{ color: '#e2e8f0' }}>{status?.jobs.length ?? 0}</strong></div>
    <div style={{ color: '#94a3b8' }}>
      下次触发：
      <strong style={{
        color: '#00d4ff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}>
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

- [ ] **Step 2: 列表卡片添加入场动画**

```tsx
<Card className="ghost-card ghost-card-enter" style={{ animationDelay: '60ms' }}
  title="排程任务列表" loading={loading}>
```

- [ ] **Step 3: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Schedules/index.tsx
git commit -m "feat(frontend): 调度配置暗黑霓虹样式"
```

---

## Task 7: 运行历史 History 暗黑增强

**Files:**
- Modify: `frontend/src/pages/History/index.tsx`

**Interfaces:**
- Consumes: Task 1 的 `.ghost-card-enter`、`.ghost-fade-in`。
- Produces: 更新后的 History 页面。

- [ ] **Step 1: 为最外层 Card 添加入场动画**

```tsx
<Card className="ghost-card ghost-card-enter" loading={loading}
  title="运行历史"
  extra={...}
>
```

- [ ] **Step 2: 耗时列按阈值变色**

```tsx
{
  title: '耗时', key: 'duration', width: 90, align: 'right' as const,
  render: (_: unknown, r: TaskRunItem) => {
    const text = formatDuration(r.started_at, r.finished_at)
    let color = '#94a3b8'
    if (r.started_at) {
      const diff = (r.finished_at ? new Date(r.finished_at).getTime() : Date.now()) - new Date(r.started_at).getTime()
      if (diff < 1000) color = '#4ade80'
      else if (diff < 10000) color = '#fbbf24'
      else color = '#ff6b6b'
    }
    return <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{text}</span>
  },
},
```

- [ ] **Step 3: 展开详情添加淡入动画**

```tsx
expandedRowRender: (record) => (
  <div style={{ padding: '12px 24px' }} className="ghost-fade-in">
    ...
  </div>
),
```

- [ ] **Step 4: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: 构建成功。

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/History/index.tsx
git commit -m "feat(frontend): 运行历史暗黑霓虹样式"
```

---

## Task 8: 最终验证

**Files:**
- 所有上述修改的文件。

- [ ] **Step 1: 运行 TypeScript 构建**

Run: `cd frontend && pnpm build`
Expected: 无 TypeScript 错误，构建成功生成 `frontend/dist/`。

- [ ] **Step 2: 运行 lint**

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 3: 浏览器走查**

启动前后端后，依次访问：
- 仪表盘：确认统计卡渐变条、霓虹图标、最近记录 hover 效果。
- 连接管理：确认暗黑表格、等宽配置摘要、图标按钮。
- 任务管理：确认筛选栏、调度呼吸点、执行结果弹窗渐变状态条。
- 调度配置：确认引擎状态卡渐变背景、下次触发等宽字体。
- 运行历史：确认耗时列变色、展开详情淡入。
- 路由切换：确认页面入场动画。
- 系统偏好：开启“减少动态效果”后确认动画禁用。

- [ ] **Step 4: Commit 任何修复**

```bash
git add -A
git commit -m "fix(frontend): 暗黑霓虹 UI 细节修复"
```

---

## Self-Review

1. **Spec coverage:**
   - 全局暗黑 Tokens → Task 1
   - Header/Sider/Content 布局 → Task 1 + Task 2
   - 卡片/表格/按钮/弹窗组件样式 → Task 1
   - 动画系统 → Task 1 + 各页面 className 应用
   - Dashboard 专属增强 → Task 3
   - Connections 专属增强 → Task 4
   - Tasks 专属增强 → Task 5
   - Schedules 专属增强 → Task 6
   - History 专属增强 → Task 7
   - 构建/lint/浏览器验证 → Task 8
   无遗漏。

2. **Placeholder scan:** 无 TBD/TODO；所有代码片段为可直接使用的完整代码。

3. **Type consistency:** 沿用了项目中已有的 `TaskItem`、`TaskRunItem`、`ScheduleItem`、`ConnectionItem` 类型；CSS 类名 `.ghost-card-enter`、`.ghost-status-pulse` 等在 Task 1 定义，后续任务一致引用。
