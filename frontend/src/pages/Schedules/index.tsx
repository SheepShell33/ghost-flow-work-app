import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Empty, Switch, message, Alert, Typography } from 'antd'
import { listSchedules, getSchedulerStatus } from '../../api/schedules'
import type { ScheduleItem, SchedulerStatus } from '../../api/schedules'
import { toggleTask } from '../../api/tasks'

const { Text } = Typography

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

  const handleToggle = async (taskId: number) => {
    try {
      const result = await toggleTask(taskId)
      message.success(result.enabled ? '调度已启用' : '调度已停用')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ScheduleItem) => (
        <Space>
          <Text strong>{name}</Text>
          <Text className="ghost-mono ghost-dim" style={{ fontSize: 12 }}>#{record.id}</Text>
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
          return <span className="ghost-mono" style={{ color: 'var(--ghost-primary)', fontSize: 13 }}>{cfg.cron || '-'}</span>
        } catch { return <span className="ghost-dim">-</span> }
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
        return <span className="ghost-mono" style={{ fontSize: 13 }}>{rel}（{abs}）</span>
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

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card className="ghost-card ghost-card-enter" loading={loading}
        style={{ background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.04), rgba(124, 58, 237, 0.04))' }}>
        <Space size="large" align="center">
          <Space>
            <span className={`ghost-status-dot ${status?.running ? 'ghost-status-dot--success ghost-status-pulse' : 'ghost-status-dot--error'}`} />
            <span style={{ fontSize: 18, fontWeight: 600, color: status?.running ? 'var(--ghost-success)' : 'var(--ghost-error)' }}>
              {status?.running ? '运行中' : '已停止'}
            </span>
          </Space>
          <div style={{ color: 'var(--ghost-text-secondary)' }}>
            活跃定时任务：<strong className="ghost-mono" style={{ color: 'var(--ghost-text)' }}>{status?.jobs.length ?? 0}</strong>
          </div>
          <div style={{ color: 'var(--ghost-text-secondary)' }}>
            下次触发：
            <strong className="ghost-mono" style={{ color: 'var(--ghost-primary)' }}>
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

      <Card className="ghost-card ghost-card-enter" style={{ animationDelay: '60ms' }}
        title="排程任务列表" loading={loading}>
        {data.length === 0 ? (
          <Empty description="暂无排程任务，在任务编辑中配置 Cron 表达式即可创建定时调度" />
        ) : (
          <Table rowKey="id" columns={columns} dataSource={data} pagination={false} />
        )}
      </Card>
    </Space>
  )
}
