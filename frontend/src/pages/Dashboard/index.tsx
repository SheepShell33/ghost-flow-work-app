import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Col, Row, Button, Empty, Space, message as msg,
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
    { title: '数据库连接', micro: 'CONNECTIONS', value: connCount, icon: <LinkOutlined />, color: '#00d4ff' },
    { title: '任务总数', micro: 'TASKS', value: taskCount, icon: <FileTextOutlined />, color: '#7c3aed' },
    { title: '成功执行', micro: 'SUCCEEDED', value: successCount, icon: <CheckCircleOutlined />, color: '#4ade80' },
    { title: '失败执行', micro: 'FAILED', value: failCount, icon: <CloseCircleOutlined />, color: '#ff6b6b' },
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
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
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
        </Col>
        <Col xs={24} lg={12}>
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
        </Col>
      </Row>
    </Space>
  )
}
