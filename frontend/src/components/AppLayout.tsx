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

const { Sider, Content } = Layout

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220} breakpoint="lg" collapsedWidth={64}>
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
        <div className="ghost-header">
          <span className="ghost-header-title">
            {menuItems.find((i) => i.key === location.pathname)?.label || 'Ghost Flow Work App'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>任务调度系统 v0.1</span>
        </div>
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
