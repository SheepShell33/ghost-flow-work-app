import { useRef, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Result, Button, Modal } from 'antd'
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
import { useTheme } from '../hooks/useTheme'

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
  const { theme } = useTheme()
  const menuTheme = theme === 'dark' ? 'dark' : 'light'

  // 彩蛋：1.2 秒内连点 logo 5 次，弹出开发者昵称
  const [eggClicks, setEggClicks] = useState(0)
  const [eggOpen, setEggOpen] = useState(false)
  const eggTimer = useRef<number | undefined>(undefined)

  const handleLogoClick = () => {
    window.clearTimeout(eggTimer.current)
    const next = eggClicks + 1
    if (next >= 5) {
      setEggClicks(0)
      setEggOpen(true)
    } else {
      setEggClicks(next)
      eggTimer.current = window.setTimeout(() => setEggClicks(0), 1200)
    }
  }

  const currentLabel = menuItems.find((i) => i.key === location.pathname)?.label || 'Ghost Flow Work App'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme={menuTheme} width={220} breakpoint="lg" collapsedWidth={64} className="ghost-sider">
        <div className="ghost-logo" onClick={handleLogoClick} style={{ cursor: 'pointer', userSelect: 'none' }}>
          <span className="ghost-logo-user">ghost@flow</span>
          <span className="ghost-logo-path">:~$</span>
          <span className="ghost-cursor">▍</span>
        </div>
        <Menu
          theme={menuTheme}
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
      {/* 彩蛋弹窗：仅开发者昵称 + emoji，不含任何个人信息 */}
      <Modal
        open={eggOpen}
        footer={null}
        closable={false}
        centered
        width={300}
        onCancel={() => setEggOpen(false)}
      >
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <div style={{ fontSize: 56, lineHeight: 1.2 }}>👻</div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 12, letterSpacing: 1 }}>windshell</div>
          <div style={{ fontSize: 20, marginTop: 12 }}>✨ 🚀 🌙 ⚡ 🛠️</div>
        </div>
      </Modal>
    </Layout>
  )
}
