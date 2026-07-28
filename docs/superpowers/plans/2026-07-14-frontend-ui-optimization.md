# 前端 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于现有设计文档 `docs/superpowers/specs/2026-07-12-frontend-ui-optimization-design.md`，对 Ghost Flow Work App 前端进行统一的 UI/UX 改造，使其符合现代 SaaS 管理后台风格。

**Architecture:** 不引入新依赖，继续使用 Ant Design 6。改造范围包括全局布局（Header/Sider/Content）、公共样式类扩展、以及 5 个业务页面（Dashboard / Connections / Tasks / Schedules / History）的卡片化与信息密度优化。

**Tech Stack:** React 19 + TypeScript + Ant Design 6 + Vite。

## Global Constraints

- 不引入新的 UI 框架或 CSS 方案（不使用 Tailwind / CSS Modules）。
- 不修改后端 API 接口。
- 所有代码注释、文案保持中文。
- 使用 `import type` 进行类型-only 导入（项目 `verbatimModuleSyntax` 已启用）。
- 公共样式统一写入 `frontend/src/index.css`，新增 `.ghost-*` 工具类。
- 每次任务完成后需验证 `pnpm build` 与 `pnpm lint` 无新增错误（最终任务统一跑也可以，但建议每任务后检查）。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `frontend/src/index.css` | 全局样式入口，扩展 `.ghost-page-header`、`.ghost-card`、`.ghost-stat-card`、`.ghost-table-actions`、`.ghost-filter-bar` |
| `frontend/src/components/AppLayout.tsx` | 全局布局：白色 Header（页面标题 + 右侧版本/刷新）、深色 Sider（Logo + 菜单）、灰色 Content 内容区 |
| `frontend/src/pages/Dashboard/index.tsx` | 仪表盘：4 列统计卡、调度状态卡、最近 5 条运行记录 |
| `frontend/src/pages/Connections/index.tsx` | 连接管理：搜索框、类型 Tag、配置摘要、图标操作列 |
| `frontend/src/pages/Tasks/index.tsx` | 任务管理：筛选栏、表格列优化、图标操作列、执行结果弹窗改造 |
| `frontend/src/pages/Schedules/index.tsx` | 调度配置：引擎状态卡、排程任务列表优化 |
| `frontend/src/pages/History/index.tsx` | 运行历史：筛选栏、耗时列、展开详情聚焦、分页优化 |

---

## Task 1: 全局布局与公共样式改造

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: Ant Design `Layout`, `Menu`，以及项目既有路由结构。
- Produces: 改造后的 `.ghost-header`（白色背景）、`.ghost-sider`（深色精致菜单）、`.ghost-content`（#f5f7fa 背景）、`.ghost-page-header`、`.ghost-card`、`.ghost-stat-card`、`.ghost-table-actions`、`.ghost-filter-bar`。

- [ ] **Step 1: 扩展 `frontend/src/index.css` 公共样式**

将文件内容替换为以下完整样式（保留既有 body / #root 重置，覆盖旧的渐变 Header 与 Logo）：

```css
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #262626;
}

#root {
  min-height: 100vh;
}

/* 侧边栏 Logo */
.ghost-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  background: #001529;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* 顶部 Header */
.ghost-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
}

.ghost-header-title {
  font-size: 18px;
  font-weight: 600;
  color: #262626;
}

.ghost-header-extra {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #595959;
  font-size: 14px;
}

/* 内容区 */
.ghost-content {
  padding: 24px;
  min-height: calc(100vh - 64px);
  background: #f5f7fa;
}

/* 页面标题区 */
.ghost-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.ghost-page-header-title {
  font-size: 20px;
  font-weight: 600;
  color: #262626;
}

/* 统一卡片 */
.ghost-card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
}

.ghost-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.ghost-card .ant-card-head {
  border-bottom: 1px solid #f0f0f0;
}

.ghost-card .ant-card-head-title {
  font-size: 16px;
  font-weight: 600;
}

/* 统计卡 */
.ghost-stat-card {
  border-radius: 12px;
  background: #ffffff;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ghost-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
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
}

.ghost-stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: #262626;
}

.ghost-stat-label {
  font-size: 14px;
  color: #595959;
}

/* 表格操作列 */
.ghost-table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 筛选栏 */
.ghost-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* 侧边栏菜单选中态 */
.ghost-sider .ant-menu-item-selected {
  background: rgba(22, 119, 255, 0.15) !important;
  border-left: 3px solid #1677ff;
}

.ghost-sider .ant-menu-item:hover {
  background: rgba(255, 255, 255, 0.08) !important;
}
```

- [ ] **Step 2: 改造 `frontend/src/components/AppLayout.tsx`**

使用 `Layout.Header`，将 Header 改为白色 SaaS 风格，Sider 增加 `ghost-sider` className，Content 背景由 CSS 控制。完整替换文件内容：

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
        </Content>
      </Layout>
    </Layout>
  )
}
```

- [ ] **Step 3: 验证布局渲染**

启动前后端（如未启动）：

```bash
# 后端
uv run uvicorn app.main:app --reload --port 8000
# 前端
cd frontend && pnpm dev
```

访问 http://localhost:5173，确认：
- Header 为白色，左侧显示当前页面标题，右侧显示版本。
- Sider 为深色，Logo 区无渐变。
- 内容区背景为浅灰色 #f5f7fa。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/AppLayout.tsx
git commit -m "feat(frontend): 改造全局布局与公共样式"
```

---

## Task 2: 仪表盘 Dashboard 改造

**Files:**
- Modify: `frontend/src/pages/Dashboard/index.tsx`

**Interfaces:**
- Consumes: `listConnections`, `listTasks`, `getSchedulerStatus`, `listTaskRuns` API。
- Produces: 统计卡使用 `.ghost-stat-card` + `.ghost-stat-icon/value/label` 结构；调度状态卡单独成卡；新增最近运行记录卡片。

- [ ] **Step 1: 改造统计卡布局**

将 `statCards` 渲染改为左侧圆形图标 + 右侧数字/标签：

```tsx
<Row gutter={[20, 20]}>
  {statCards.map((item) => (
    <Col xs={24} sm={12} lg={6} key={item.title}>
      <Card className="ghost-stat-card" loading={loading} bordered={false}>
        <span className="ghost-stat-icon" style={{ background: `${item.color}15`, color: item.color }}>
          {item.icon}
        </span>
        <div>
          <div className="ghost-stat-value">{item.value}</div>
          <div className="ghost-stat-label">{item.title}</div>
        </div>
      </Card>
    </Col>
  ))}
</Row>
```

- [ ] **Step 2: 新增最近 5 条运行记录**

在组件 state 中新增 `recentRuns`：

```tsx
const [recentRuns, setRecentRuns] = useState<TaskRunItem[]>([])
```

在 `useEffect` 加载时使用 `listTaskRuns({ page: 1, page_size: 5 })` 获取最近 5 条：

```tsx
listTaskRuns({ page: 1, page_size: 5 }).then((runs) => {
  setRecentRuns(runs)
  setSuccessCount(runs.filter((r) => r.status === 'success').length)
  setFailCount(runs.filter((r) => r.status === 'failed').length)
}).catch(() => { msg.error('加载运行历史失败') }),
```

注意：这里 success/fail 统计从全部运行改为最近 5 条不太合理，应保持原逻辑或改为单独请求。推荐保留原 `page_size: 200` 的计数请求，同时新增 `recentRuns` 的 5 条请求。为减少请求，也可以只请求一次 200 条并取前 5 条。本计划采用**一次请求 200 条，同时用于计数和最近记录**。

- [ ] **Step 3: 渲染调度状态卡与最近记录卡**

在第二行 `Row` 中放置两张卡片：

```tsx
<Row gutter={[20, 20]}>
  <Col xs={24} lg={12}>
    <Card className="ghost-card" title={<span><ClockCircleOutlined /> 调度引擎状态</span>} loading={loading}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <Badge status={schedulerRunning ? 'success' : 'error'} />
          <span style={{ fontWeight: 500 }}>{schedulerRunning ? '运行中' : '已停止'}</span>
        </Space>
        <div>活跃定时任务：<strong>{schedulerJobs}</strong></div>
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/schedules')}>
          查看调度配置
        </Button>
      </Space>
    </Card>
  </Col>
  <Col xs={24} lg={12}>
    <Card className="ghost-card" title="最近运行记录" loading={loading}>
      {recentRuns.length === 0 ? (
        <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {recentRuns.map((run) => (
            <div key={run.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Text code>#{run.id}</Text>
                <Text ellipsis style={{ maxWidth: 120 }}>{getTaskName(run.task_id)}</Text>
              </Space>
              <Space>
                <Tag color={run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'orange'}>
                  {run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : '运行中'}
                </Tag>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {run.started_at ? new Date(run.started_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </Text>
              </Space>
            </div>
          ))}
          <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/history')}>
            查看全部历史
          </Button>
        </Space>
      )}
    </Card>
  </Col>
</Row>
```

需要新增 `useNavigate` 导入以及任务名称映射（可简单从 `listTasks` 获取）。为简化，最近记录卡中只显示 `#task_id` 即可，无需任务名，避免额外请求。设计文档要求显示任务名，因此需要同时获取 tasks。推荐在 `useEffect` 中同时请求 `listTasks()`。

- [ ] **Step 4: 完整文件替换并验证**

使用上述片段组装完整文件后，确认：
- 4 个统计卡横向排列，图标为圆形底色。
- 调度状态卡包含运行状态、活跃任务数、查看调度配置链接。
- 最近运行记录显示 5 条。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Dashboard/index.tsx
git commit -m "feat(frontend): 改造仪表盘 UI"
```

---

## Task 3: 连接管理 Connections 改造

**Files:**
- Modify: `frontend/src/pages/Connections/index.tsx`

**Interfaces:**
- Consumes: `listConnections`, `deleteConnection` API，`ConnectionItem` 类型。
- Produces: 表格增加搜索过滤、配置摘要、图标操作列。

- [ ] **Step 1: 添加搜索过滤 state**

```tsx
const [searchQ, setSearchQ] = useState('')
const filteredData = useMemo(() => {
  if (!searchQ.trim()) return data
  return data.filter((c) => c.name.toLowerCase().includes(searchQ.toLowerCase()))
}, [data, searchQ])
```

- [ ] **Step 2: 改造表格列**

- 移除 ID 列（或折叠为窄列）。
- 类型 Tag：SQLite 用 `green`，Redshift 用 `blue`。
- 配置摘要：
  - SQLite：解析 config JSON，显示 `file_path`，超长省略。
  - Redshift：显示 `host` 或 `database`，隐藏敏感信息。
- 操作列：使用图标按钮 + Tooltip（查看/编辑/删除）。

```tsx
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record: ConnectionItem) => (
      <Space>
        <Text strong>{name}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>#{record.id}</Text>
      </Space>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (t: string) => <Tag color={t === 'redshift' ? 'blue' : 'green'}>{t}</Tag>,
  },
  {
    title: '配置摘要',
    key: 'summary',
    ellipsis: true,
    render: (_: unknown, record: ConnectionItem) => {
      try {
        const cfg = JSON.parse(record.config)
        if (record.type === 'sqlite') return cfg.file_path || '-'
        if (record.type === 'redshift') return cfg.host || cfg.database || '-'
        return '-'
      } catch {
        return '-'
      }
    },
  },
  {
    title: '操作',
    key: 'action',
    width: 140,
    render: (_: unknown, record: ConnectionItem) => (
      <Space size="small">
        <Tooltip title="编辑">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => { setEditing(record); setModalOpen(true) }}
          />
        </Tooltip>
        <Tooltip title="删除">
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
]
```

- [ ] **Step 3: 添加搜索框到卡片标题区下方**

由于 Ant Design `Card` 的 `title` 与 `extra` 无法直接放搜索框，可在 Card 内部、Table 上方放置一个 `.ghost-filter-bar`：

```tsx
<div className="ghost-filter-bar" style={{ marginTop: -8, marginBottom: 16 }}>
  <Input.Search
    placeholder="搜索连接名称..."
    allowClear
    value={searchQ}
    onChange={(e) => setSearchQ(e.target.value)}
    style={{ width: 320 }}
  />
</div>
```

- [ ] **Step 4: 验证并 Commit**

确认：
- 表格不再直接展示 JSON。
- 搜索框实时过滤。
- 操作列为图标按钮。

```bash
git add frontend/src/pages/Connections/index.tsx
git commit -m "feat(frontend): 改造连接管理 UI"
```

---

## Task 4: 任务管理 Tasks 改造

**Files:**
- Modify: `frontend/src/pages/Tasks/index.tsx`

**Interfaces:**
- Consumes: `listTasks`, `deleteTask`, `runTask`, `previewTask`, `exportTaskCsv`, `toggleTask`，`downloadTaskCsv` API。
- Produces: 筛选栏规范化、表格列折叠 ID、操作列图标化、执行结果弹窗优化。

- [ ] **Step 1: 扩展筛选栏**

增加类型筛选和调度状态筛选：

```tsx
const [filterType, setFilterType] = useState<'all' | 'sql' | 'python'>('all')
const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled' | 'unscheduled'>('all')
```

在 `load` 中保持后端只按 `q` 和 `tag` 过滤，前端本地过滤类型与调度状态：

```tsx
const displayedData = useMemo(() => {
  return data.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterEnabled === 'enabled') return t.enabled
    if (filterEnabled === 'disabled') return t.schedule_config && !t.enabled
    if (filterEnabled === 'unscheduled') return !t.schedule_config
    return true
  })
}, [data, filterType, filterEnabled])
```

- [ ] **Step 2: 改造表格列**

- 移除 ID 列，将 `#id` 小标签放入名称列。
- 标签最多显示 2 行，超出用 Tooltip（可用 `ellipsis` 或限制显示数量）。
- 前置任务显示为可点击 Tag（点击可跳转编辑，但本页无编辑跳转，仅展示即可）。
- 调度列：Switch + 状态 Tag。
- 操作列：运行、预览、导出/下载、编辑、删除全部使用图标按钮 + Tooltip。

```tsx
import {
  PlusOutlined, PlayCircleOutlined, EyeOutlined, DownloadOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons'

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    render: (name: string, record: TaskItem) => (
      <Space>
        <Text strong>{name}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>#{record.id}</Text>
      </Space>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    render: (t: string) => (
      <Tag color={t === 'sql' ? 'geekblue' : 'purple'}>{t === 'sql' ? 'SQL' : 'Python'}</Tag>
    ),
  },
  {
    title: '标签',
    key: 'tags',
    width: 180,
    render: (_: unknown, r: TaskItem) => {
      if (!r.tags) return <Text type="secondary">-</Text>
      const tags = r.tags.split(',').map((t) => t.trim()).filter(Boolean)
      return (
        <Space size={4} wrap style={{ maxWidth: 160, lineHeight: '22px' }}>
          {tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
          {tags.length > 3 && (
            <Tooltip title={tags.slice(3).join(', ')}>
              <Tag>+{tags.length - 3}</Tag>
            </Tooltip>
          )}
        </Space>
      )
    },
  },
  {
    title: '前置任务',
    key: 'prerequisite',
    width: 140,
    render: (_: unknown, r: TaskItem) => {
      if (!r.prerequisite_task_id) return <Text type="secondary">无</Text>
      return <Tag>{getPrereqName(r.prerequisite_task_id)}</Tag>
    },
  },
  {
    title: '调度',
    key: 'enabled',
    width: 110,
    render: (_: unknown, record: TaskItem) => (
      record.schedule_config ? (
        <Space>
          <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record)} />
          <Tag color={record.enabled ? 'green' : 'default'} style={{ margin: 0 }}>
            {record.enabled ? '启用' : '停用'}
          </Tag>
        </Space>
      ) : (
        <Tag style={{ margin: 0 }}>未配置</Tag>
      )
    },
  },
  {
    title: '操作',
    key: 'action',
    width: 220,
    render: (_: unknown, record: TaskItem) => (
      <Space size="small" wrap className="ghost-table-actions">
        <Tooltip title="运行"><Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)} /></Tooltip>
        {record.type === 'sql' && (
          <Tooltip title="预览"><Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)} /></Tooltip>
        )}
        {record.type === 'sql' && record.output_path && (
          <Tooltip title="导出"><Button size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record)} /></Tooltip>
        )}
        {record.type === 'sql' && (
          <Tooltip title="下载"><Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTaskCsv(record.id)} /></Tooltip>
        )}
        <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); setFormOpen(true) }} /></Tooltip>
        <Tooltip title="删除">
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
]
```

- [ ] **Step 3: 改造筛选栏为 `.ghost-filter-bar`**

```tsx
<div className="ghost-filter-bar">
  <Input prefix={<SearchOutlined />} placeholder="搜索任务名称/代码..." allowClear
    value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={{ width: 260 }} />
  <Select mode="multiple" placeholder="按标签筛选" allowClear
    value={searchTag} onChange={(v: string[]) => setSearchTag(v)} style={{ minWidth: 160 }}>
    {allTags.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
  </Select>
  <Select value={filterType} onChange={(v) => setFilterType(v)} style={{ width: 120 }}>
    <Select.Option value="all">全部类型</Select.Option>
    <Select.Option value="sql">SQL</Select.Option>
    <Select.Option value="python">Python</Select.Option>
  </Select>
  <Select value={filterEnabled} onChange={(v) => setFilterEnabled(v)} style={{ width: 140 }}>
    <Select.Option value="all">全部状态</Select.Option>
    <Select.Option value="enabled">已启用</Select.Option>
    <Select.Option value="disabled">已停用</Select.Option>
    <Select.Option value="unscheduled">未配置</Select.Option>
  </Select>
</div>
```

- [ ] **Step 4: 优化执行结果弹窗**

顶部状态大标签、错误信息用 Alert、SQL 结果用卡片包裹、Python 输出用 Code 样式块：

```tsx
<Modal title="执行结果" open={resultOpen} footer={null}
  onCancel={() => { setResultOpen(false); setResultData(null) }}
  width={800} destroyOnClose>
  {resultData && (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Tag style={{ fontSize: 16, padding: '6px 12px' }}
        color={resultData.status === 'success' ? 'green' : 'red'}>
        {resultData.status === 'success' ? '执行成功' : '执行失败'}
      </Tag>
      {resultData.error_message && (
        <Alert type="error" message={resultData.error_message} showIcon />
      )}
      {resultData.result_preview && 'columns' in resultData.result_preview ? (
        <Card className="ghost-card" size="small" title="数据预览">
          <DataPreview data={resultData.result_preview as PreviewData} />
        </Card>
      ) : resultData.result_preview && 'stdout' in resultData.result_preview ? (
        <Card className="ghost-card" size="small" title="Python 输出">
          <pre style={{
            background: '#f6ffed', padding: 12, borderRadius: 4,
            maxHeight: 400, overflow: 'auto', margin: 0,
          }}>
            <Text>{(resultData.result_preview as any).stdout || '(无输出)'}</Text>
          </pre>
          {(resultData.result_preview as any).stderr && (
            <pre style={{
              background: '#fff2f0', padding: 12, borderRadius: 4,
              maxHeight: 200, overflow: 'auto', marginTop: 12, color: '#ff4d4f',
            }}>
              {(resultData.result_preview as any).stderr}
            </pre>
          )}
        </Card>
      ) : null}
    </Space>
  )}
</Modal>
```

- [ ] **Step 5: 验证并 Commit**

确认：
- 表格列不再拥挤。
- 筛选栏包含搜索、标签、类型、调度状态。
- 操作列全为图标按钮。
- 执行结果弹窗层次清晰。

```bash
git add frontend/src/pages/Tasks/index.tsx
git commit -m "feat(frontend): 改造任务管理 UI"
```

---

## Task 5: 调度配置 Schedules 改造

**Files:**
- Modify: `frontend/src/pages/Schedules/index.tsx`

**Interfaces:**
- Consumes: `listSchedules`, `getSchedulerStatus`，`toggleTask` API。
- Produces: 引擎状态卡突出、排程列表展示 Cron/下次执行/启用开关。

- [ ] **Step 1: 改造引擎状态卡**

使用大字号 Badge + 三列信息：

```tsx
<Card className="ghost-card" loading={loading}>
  <Space size="large" align="center">
    <Space>
      <Badge status={status?.running ? 'success' : 'error'} />
      <span style={{ fontSize: 18, fontWeight: 600 }}>
        {status?.running ? '运行中' : '已停止'}
      </span>
    </Space>
    <div>活跃定时任务：<strong>{status?.jobs.length ?? 0}</strong></div>
    <div>
      下次触发：
      <strong>
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

- [ ] **Step 2: 优化排程任务列表**

- Cron 表达式用 `Tag` + 等宽字体。
- 下次执行时间格式化为“相对时间 + 绝对时间”。
- 操作列只保留 Switch。
- 移除状态列，Switch 本身已表达状态。

```tsx
const columns = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record: ScheduleItem) => (
      <Space>
        <Text strong>{name}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>#{record.id}</Text>
      </Space>
    ),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 80,
    render: (t: string) => <Tag color={t === 'sql' ? 'geekblue' : 'purple'}>{t}</Tag>,
  },
  {
    title: 'Cron 表达式',
    key: 'cron',
    width: 150,
    render: (_: unknown, r: ScheduleItem) => {
      try {
        const cfg = JSON.parse(r.schedule_config)
        return <Tag style={{ fontFamily: 'monospace' }}>{cfg.cron || '-'}</Tag>
      } catch { return '-' }
    },
  },
  {
    title: '下次执行',
    key: 'next_run',
    width: 220,
    render: (_: unknown, r: ScheduleItem) => {
      if (!status?.jobs || !r.enabled) return '-'
      const job = status.jobs.find((j) => j.id === `task_${r.id}`)
      if (!job?.next_run_time) return '-'
      const dt = new Date(job.next_run_time)
      const abs = dt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      const diff = dt.getTime() - Date.now()
      let rel = ''
      if (diff < 0) rel = '已过期'
      else if (diff < 60_000) rel = '即将执行'
      else if (diff < 60 * 60_000) rel = `${Math.round(diff / 60_000)} 分钟后`
      else if (diff < 24 * 60 * 60_000) rel = `${Math.round(diff / (60 * 60_000))} 小时后`
      else rel = `${Math.round(diff / (24 * 60 * 60_000))} 天后`
      return <span>{rel}（{abs}）</span>
    },
  },
  {
    title: '启用',
    key: 'toggle',
    width: 80,
    render: (_: unknown, r: ScheduleItem) => (
      <Switch checked={r.enabled} size="small" onChange={() => handleToggle(r.id)} />
    ),
  },
]
```

- [ ] **Step 3: 验证并 Commit**

确认：
- 引擎状态卡信息层次清晰。
- Cron 用等宽字体 Tag。
- 下次执行显示相对时间。

```bash
git add frontend/src/pages/Schedules/index.tsx
git commit -m "feat(frontend): 改造调度配置 UI"
```

---

## Task 6: 运行历史 History 改造

**Files:**
- Modify: `frontend/src/pages/History/index.tsx`

**Interfaces:**
- Consumes: `listTaskRuns`, `listTasks` API。
- Produces: 筛选栏（任务/状态/时间范围）、耗时列、展开详情聚焦、分页 `showTotal`。

- [ ] **Step 1: 增加状态和时间范围筛选 state**

```tsx
const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'running'>('all')
const [filterRange, setFilterRange] = useState<'24h' | '7d' | '30d' | 'all'>('all')
```

- [ ] **Step 2: 前端本地过滤数据**

```tsx
const filteredData = useMemo(() => {
  return data.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterRange !== 'all' && r.started_at) {
      const start = new Date(r.started_at).getTime()
      const now = Date.now()
      const limits = { '24h': 24 * 60 * 60_000, '7d': 7 * 24 * 60 * 60_000, '30d': 30 * 24 * 60 * 60_000 }
      if (now - start > limits[filterRange]) return false
    }
    return true
  })
}, [data, filterStatus, filterRange])
```

- [ ] **Step 3: 新增耗时列并优化时间格式**

```tsx
const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start) return '-'
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const diff = e - s
  if (diff < 1000) return `${diff}ms`
  return `${(diff / 1000).toFixed(1)}s`
}

const columns = [
  {
    title: 'Run ID', dataIndex: 'id', key: 'id', width: 100, fixed: 'left' as const,
    render: (id: number) => (
      <Space size={4}>
        <Text code strong style={{ fontSize: 13 }}>#{id}</Text>
        <Tooltip title="复制 Run ID">
          <CopyOutlined style={{ cursor: 'pointer', color: '#999', fontSize: 12 }}
            onClick={async () => {
              try { await navigator.clipboard.writeText(String(id)); message.success('已复制 Run ID') }
              catch { message.error('复制失败') }
            }} />
        </Tooltip>
      </Space>
    ),
  },
  {
    title: '任务', key: 'task', width: 180,
    render: (_: unknown, r: TaskRunItem) => (
      <Space size={4}>
        <Tag style={{ margin: 0 }}>#{r.task_id}</Tag>
        <Text ellipsis style={{ maxWidth: 120 }}>{getTaskName(r.task_id)}</Text>
      </Space>
    ),
  },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 90,
    render: (s: string) => {
      const color = s === 'success' ? 'green' : s === 'failed' ? 'red' : 'orange'
      const label = s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'
      return <Tag color={color}>{label}</Tag>
    },
  },
  { title: '行数', dataIndex: 'row_count', key: 'row_count', width: 70, align: 'right' as const, render: (v: number | null) => v ?? '-' },
  {
    title: '开始时间', dataIndex: 'started_at', key: 'started_at', width: 140,
    render: (v: string) => v ? new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-',
  },
  {
    title: '耗时', key: 'duration', width: 90, align: 'right' as const,
    render: (_: unknown, r: TaskRunItem) => formatDuration(r.started_at, r.finished_at),
  },
]
```

- [ ] **Step 4: 改造筛选栏和分页**

```tsx
<div className="ghost-filter-bar" style={{ marginTop: -8, marginBottom: 16 }}>
  <Select placeholder="按任务筛选" allowClear style={{ width: 220 }}
    value={filterTaskId} onChange={(v) => { setFilterTaskId(v); setPage(1) }}
    options={tasks.map((t) => ({ value: t.id, label: `#${t.id} ${t.name}` }))} />
  <Select value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1) }} style={{ width: 120 }}>
    <Select.Option value="all">全部状态</Select.Option>
    <Select.Option value="success">成功</Select.Option>
    <Select.Option value="failed">失败</Select.Option>
    <Select.Option value="running">运行中</Select.Option>
  </Select>
  <Select value={filterRange} onChange={(v) => { setFilterRange(v); setPage(1) }} style={{ width: 140 }}>
    <Select.Option value="24h">近 24 小时</Select.Option>
    <Select.Option value="7d">近 7 天</Select.Option>
    <Select.Option value="30d">近 30 天</Select.Option>
    <Select.Option value="all">全部</Select.Option>
  </Select>
</div>
```

分页增加 `showTotal`：

```tsx
pagination={{
  current: page, pageSize, total,
  onChange: setPage, showSizeChanger: false,
  showTotal: (t) => `共 ${t} 条`,
}}
```

- [ ] **Step 5: 简化展开详情**

移除错误信息列（已放入展开详情），展开详情保留关键信息：

```tsx
expandable={{
  expandedRowRender: (record) => (
    <div style={{ padding: '12px 24px' }}>
      <Title level={5} style={{ marginBottom: 12 }}>运行详情 — Run #{record.id}</Title>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Run ID"><Text code>#{record.id}</Text></Descriptions.Item>
        <Descriptions.Item label="关联任务">
          <Space><Tag>#{record.task_id}</Tag>{getTaskName(record.task_id)}</Space>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={record.status === 'success' ? 'green' : record.status === 'failed' ? 'red' : 'orange'}>
            {record.status === 'success' ? '成功' : record.status === 'failed' ? '失败' : '运行中'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="影响行数">{record.row_count ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {record.started_at ? new Date(record.started_at).toLocaleString('zh-CN') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {record.finished_at ? new Date(record.finished_at).toLocaleString('zh-CN') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="耗时">
          {formatDuration(record.started_at, record.finished_at)}
        </Descriptions.Item>
      </Descriptions>
      {record.error_message && (
        <Alert type="error" message="错误信息" description={record.error_message}
          style={{ marginTop: 16 }} showIcon />
      )}
    </div>
  ),
  rowExpandable: () => true,
}}
```

- [ ] **Step 6: 验证并 Commit**

确认：
- 表格增加耗时列。
- 筛选栏包含任务、状态、时间范围。
- 分页显示总条数。
- 展开详情聚焦关键信息。

```bash
git add frontend/src/pages/History/index.tsx
git commit -m "feat(frontend): 改造运行历史 UI"
```

---

## Task 7: 最终验证

**Files:**
- 所有上述修改的文件。

- [ ] **Step 1: 运行 TypeScript 构建**

```bash
cd frontend
pnpm build
```

Expected: 无 TypeScript 错误，构建成功生成 `frontend/dist/`。

- [ ] **Step 2: 运行 lint**

```bash
cd frontend
pnpm lint
```

Expected: 无新增严重问题（oxlint 可能已有既有问题，确认无新增错误）。

- [ ] **Step 3: 浏览器走查**

启动前后端后，依次访问：
- 仪表盘：确认统计卡、调度状态卡、最近运行记录。
- 连接管理：确认搜索、配置摘要、图标操作列。
- 任务管理：确认筛选栏、图标操作列、执行结果弹窗。
- 调度配置：确认引擎状态卡、Cron 标签、下次执行时间。
- 运行历史：确认筛选栏、耗时列、分页、展开详情。

- [ ] **Step 4: Commit 任何修复**

如果验证中发现小问题，单独 commit：

```bash
git add -A
git commit -m "fix(frontend): UI 优化细节修复"
```

---

## Self-Review

1. **Spec coverage:**
   - 统一标题栏 + 内容卡片布局 → Task 1 + 各页面 `ghost-page-header` / `ghost-card`。
   - Header 白色 SaaS 风格、Sidebar 深色 → Task 1。
   - 仪表盘统计卡、调度状态卡、最近运行记录 → Task 2。
   - 连接管理表格可读性、配置不展示 JSON → Task 3。
   - 任务管理操作列、筛选栏 → Task 4。
   - 调度配置引擎状态、信息层次 → Task 5。
   - 运行历史耗时列、筛选栏、展开详情 → Task 6。
   - `pnpm build` / `pnpm lint` → Task 7。
   无遗漏。

2. **Placeholder scan:** 无 TBD/TODO；所有代码片段为可直接使用的示例。

3. **Type consistency:** 沿用了项目中已有的 `TaskItem`、`TaskRunItem`、`ScheduleItem`、`ConnectionItem` 类型；函数/属性名与现有代码一致。
