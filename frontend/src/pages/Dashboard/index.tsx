import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Badge, Space, message as msg } from 'antd'
import {
  LinkOutlined, FileTextOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { listConnections } from '../../api/connections'
import { listTasks } from '../../api/tasks'
import { getSchedulerStatus } from '../../api/schedules'
import { listTaskRuns } from '../../api/task-runs'

export default function Dashboard() {
  const [connCount, setConnCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [failCount, setFailCount] = useState(0)
  const [schedulerRunning, setSchedulerRunning] = useState(false)
  const [schedulerJobs, setSchedulerJobs] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      listConnections().then((d) => setConnCount(d.length)).catch(() => { msg.error('加载连接数失败'); return [] }),
      listTasks().then((d) => setTaskCount(d.length)).catch(() => { msg.error('加载任务数失败'); return [] }),
      getSchedulerStatus().then((s) => { setSchedulerRunning(s.running); setSchedulerJobs(s.jobs.length) }).catch(() => { msg.error('加载调度状态失败') }),
      listTaskRuns({ page: 1, page_size: 200 }).then((runs) => {
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
          <Col span={6} key={item.title}>
            <Card className="ghost-stat-card" loading={loading}
              style={{ borderTop: `3px solid ${item.color}` }}>
              <Statistic title={item.title} value={item.value}
                prefix={<span style={{ color: item.color }}>{item.icon}</span>} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[20, 20]}>
        <Col span={12}>
          <Card className="ghost-card" title={<span><ClockCircleOutlined /> 调度引擎</span>}
            loading={loading} size="small">
            <Space>
              <Badge status={schedulerRunning ? 'success' : 'error'} />
              <span style={{ fontWeight: 500 }}>{schedulerRunning ? '运行中' : '已停止'}</span>
              <span style={{ color: '#d9d9d9' }}>|</span>
              <span>活跃定时任务：<strong>{schedulerJobs}</strong></span>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
