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
