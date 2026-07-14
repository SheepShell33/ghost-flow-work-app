import { useEffect, useMemo, useState } from 'react'
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
    { title: '数据库连接', value: connCount, icon: <LinkOutlined />, color: '#667eea' },
    { title: '任务总数', value: taskCount, icon: <FileTextOutlined />, color: '#764ba2' },
    { title: '成功执行', value: successCount, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { title: '失败执行', value: failCount, icon: <CloseCircleOutlined />, color: '#ff4d4f' },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={20}>
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
    </Space>
  )
}
