import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Badge, Space } from 'antd'
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
      listConnections().then((d) => setConnCount(d.length)).catch(() => {}),
      listTasks().then((d) => setTaskCount(d.length)).catch(() => {}),
      getSchedulerStatus().then((s) => { setSchedulerRunning(s.running); setSchedulerJobs(s.jobs.length) }).catch(() => {}),
      listTaskRuns().then((runs) => {
        setSuccessCount(runs.filter((r) => r.status === 'success').length)
        setFailCount(runs.filter((r) => r.status === 'failed').length)
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="数据库连接" value={connCount} prefix={<LinkOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="任务总数" value={taskCount} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="成功执行" value={successCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="失败执行" value={failCount} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="调度引擎" loading={loading} size="small">
            <Space>
              <Badge status={schedulerRunning ? 'success' : 'error'} />
              <span>{schedulerRunning ? '运行中' : '已停止'}</span>
              <span style={{ color: '#8c8c8c' }}>|</span>
              <ClockCircleOutlined />
              <span>活跃定时任务：{schedulerJobs}</span>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
