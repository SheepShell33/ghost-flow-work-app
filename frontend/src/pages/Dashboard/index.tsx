import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Col, Row, Badge, Button, Empty, Space, Tag, Typography, message as msg,
} from 'antd'
import {
  LinkOutlined, FileTextOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { listConnections } from '../../api/connections'
import { listTasks } from '../../api/tasks'
import type { TaskItem } from '../../api/tasks'
import { getSchedulerStatus } from '../../api/schedules'
import { listTaskRuns } from '../../api/task-runs'
import type { TaskRunItem } from '../../api/task-runs'

const { Text } = Typography

export default function Dashboard() {
  const navigate = useNavigate()
  const [connCount, setConnCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [failCount, setFailCount] = useState(0)
  const [schedulerRunning, setSchedulerRunning] = useState(false)
  const [schedulerJobs, setSchedulerJobs] = useState(0)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [recentRuns, setRecentRuns] = useState<TaskRunItem[]>([])
  const [loading, setLoading] = useState(true)

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t.name])), [tasks])
  const getTaskName = (taskId: number) => taskMap.get(taskId) || `#${taskId}`

  useEffect(() => {
    Promise.all([
      listConnections().then((d) => setConnCount(d.length)).catch(() => { msg.error('加载连接数失败'); return [] }),
      listTasks().then((d) => { setTaskCount(d.length); setTasks(d) }).catch(() => { msg.error('加载任务数失败'); return [] }),
      getSchedulerStatus().then((s) => { setSchedulerRunning(s.running); setSchedulerJobs(s.jobs.length) }).catch(() => { msg.error('加载调度状态失败') }),
      listTaskRuns({ page: 1, page_size: 200 }).then((runs) => {
        setRecentRuns(runs.slice(0, 5))
        setSuccessCount(runs.filter((r) => r.status === 'success').length)
        setFailCount(runs.filter((r) => r.status === 'failed').length)
      }).catch(() => { msg.error('加载运行历史失败') }),
    ]).finally(() => setLoading(false))
  }, [])

  const statCards = [
    { title: '数据库连接', value: connCount, icon: <LinkOutlined />, color: '#00d4ff', gradient: 'linear-gradient(90deg, #00d4ff, #38bdf8)' },
    { title: '任务总数', value: taskCount, icon: <FileTextOutlined />, color: '#7c3aed', gradient: 'linear-gradient(90deg, #7c3aed, #a855f7)' },
    { title: '成功执行', value: successCount, icon: <CheckCircleOutlined />, color: '#4ade80', gradient: 'linear-gradient(90deg, #4ade80, #22c55e)' },
    { title: '失败执行', value: failCount, icon: <CloseCircleOutlined />, color: '#ff6b6b', gradient: 'linear-gradient(90deg, #ff6b6b, #ef4444)' },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={20}>
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
              <span className="ghost-stat-icon" style={{ background: `${item.color}20`, color: item.color, boxShadow: `0 0 16px ${item.color}30` }}>
                {item.icon}
              </span>
              <div>
                <div className="ghost-stat-value ghost-number-pop" key={item.value}>
                  {item.value}
                </div>
                <div className="ghost-stat-label">{item.title}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
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
    </Space>
  )
}
