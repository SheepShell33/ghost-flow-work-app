import { useEffect, useState } from 'react'
import { Card, Table, Tag, Badge, Space, Empty } from 'antd'
import { listSchedules, getSchedulerStatus } from '../../api/schedules'
import type { ScheduleItem, SchedulerStatus } from '../../api/schedules'

export default function Schedules() {
  const [data, setData] = useState<ScheduleItem[]>([])
  const [status, setStatus] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [items, st] = await Promise.all([listSchedules(), getSchedulerStatus()])
      setData(items)
      setStatus(st)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (t: string) => <Tag color={t === 'sql' ? 'geekblue' : 'purple'}>{t}</Tag>,
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled',
      render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? '运行中' : '已停用'} />,
    },
    {
      title: 'Cron 表达式',
      key: 'cron',
      render: (_: unknown, r: ScheduleItem) => {
        try {
          const cfg = JSON.parse(r.schedule_config)
          return <Tag>{cfg.cron || '-'}</Tag>
        } catch { return '-' }
      },
    },
    {
      title: '下次执行',
      key: 'next_run',
      render: (_: unknown, r: ScheduleItem) => {
        if (!status?.jobs || !r.enabled) return '-'
        const job = status.jobs.find((j) => j.id === `task_${r.id}`)
        return job?.next_run_time ? new Date(job.next_run_time).toLocaleString('zh-CN') : '-'
      },
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card size="small">
        <Space>
          <Badge status={status?.running ? 'success' : 'error'} />
          <span>调度引擎：{status?.running ? '运行中' : '已停止'}</span>
          <span style={{ color: '#8c8c8c' }}>|</span>
          <span>活跃任务：{status?.jobs.length ?? 0}</span>
        </Space>
      </Card>

      <Card title="排程任务列表" loading={loading}>
        {data.length === 0 ? (
          <Empty description="暂无排程任务，在任务编辑中配置 Cron 表达式即可创建定时调度" />
        ) : (
          <Table rowKey="id" columns={columns} dataSource={data} pagination={false} />
        )}
      </Card>
    </Space>
  )
}
