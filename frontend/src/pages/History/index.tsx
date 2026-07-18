import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, Table, Tag, Empty, Typography, Space, Descriptions, Tooltip, message, Select, Alert } from 'antd'
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import { listTaskRuns } from '../../api/task-runs'
import type { TaskRunItem } from '../../api/task-runs'
import { listTasks } from '../../api/tasks'
import type { TaskItem } from '../../api/tasks'

const { Text, Title } = Typography

export default function History() {
  const [data, setData] = useState<TaskRunItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTaskId, setFilterTaskId] = useState<number | undefined>()
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'running'>('all')
  const [filterRange, setFilterRange] = useState<'24h' | '7d' | '30d' | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 30

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t.name])), [tasks])

  const isFiltered = filterStatus !== 'all' || filterRange !== 'all'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [runs, allTasks] = await Promise.all([
        listTaskRuns({
          task_id: filterTaskId,
          page: isFiltered ? 1 : page,
          page_size: isFiltered ? 9999 : pageSize,
        }),
        listTasks(),
      ])
      setData(runs)
      setTasks(allTasks)
      if (!isFiltered) {
        setTotal(runs.length < pageSize ? (page - 1) * pageSize + runs.length : page * pageSize + 1)
      }
    } finally {
      setLoading(false)
    }
  }, [filterTaskId, page, isFiltered])

  useEffect(() => { load() }, [load])

  const getTaskName = (taskId: number) => taskMap.get(taskId) || `#${taskId}`

  const filteredData = useMemo(() => {
    return data.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterRange !== 'all' && r.started_at) {
        const start = new Date(r.started_at).getTime()
        const now = Date.now()
        const limits = { '24h': 24 * 60 * 60_000, '7d': 7 * 24 * 60 * 60_000, '30d': 30 * 24 * 60 * 60_000 }
        if (now - start > limits[filterRange]) return false
      }
      return true
    })
  }, [data, filterStatus, filterRange])

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return '-'
    const s = new Date(start).getTime()
    const e = end ? new Date(end).getTime() : Date.now()
    const diff = e - s
    if (diff < 1000) return `${diff}ms`
    return `${(diff / 1000).toFixed(1)}s`
  }

  const columns = [
    {
      title: 'Run ID', dataIndex: 'id', key: 'id', width: 100, fixed: 'left' as const,
      render: (id: number) => (
        <Space size={4}>
          <Text className="ghost-mono" strong style={{ fontSize: 13, color: 'var(--ghost-primary)' }}>#{id}</Text>
          <Tooltip title="复制 Run ID">
            <CopyOutlined style={{ cursor: 'pointer', color: 'var(--ghost-text-dim)', fontSize: 12 }}
              onClick={async () => {
                try { await navigator.clipboard.writeText(String(id)); message.success('已复制 Run ID') }
                catch { message.error('复制失败') }
              }} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '任务', key: 'task', width: 180,
      render: (_: unknown, r: TaskRunItem) => (
        <Space size={4}>
          <span className="ghost-mono ghost-dim" style={{ fontSize: 13 }}>#{r.task_id}</span>
          <Text ellipsis style={{ maxWidth: 120 }}>{getTaskName(r.task_id)}</Text>
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 110,
      render: (s: string) => {
        const dotClass = s === 'success' ? 'ghost-status-dot--success' : s === 'failed' ? 'ghost-status-dot--error' : 'ghost-status-dot--running'
        const label = s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'
        return (
          <Space size={6}>
            <span className={`ghost-status-dot ${dotClass}`} />
            <span style={{ fontSize: 13 }}>{label}</span>
          </Space>
        )
      },
    },
    { title: '行数', dataIndex: 'row_count', key: 'row_count', width: 70, align: 'right' as const, render: (v: number | null) => v ?? '-' },
    {
      title: '开始时间', dataIndex: 'started_at', key: 'started_at', width: 140,
      render: (v: string) => v
        ? <span className="ghost-mono" style={{ fontSize: 13 }}>{new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        : '-',
    },
    {
      title: '耗时', key: 'duration', width: 90, align: 'right' as const,
      render: (_: unknown, r: TaskRunItem) => {
        const text = formatDuration(r.started_at, r.finished_at)
        // 按耗时阈值变色：<1s 绿色，<10s 黄色，其余红色
        let color = 'var(--ghost-text-secondary)'
        if (r.started_at) {
          const diff = (r.finished_at ? new Date(r.finished_at).getTime() : Date.now()) - new Date(r.started_at).getTime()
          if (diff < 1000) color = 'var(--ghost-success)'
          else if (diff < 10000) color = 'var(--ghost-warning)'
          else color = 'var(--ghost-error)'
        }
        return <span className="ghost-mono" style={{ color, fontSize: 13 }}>{text}</span>
      },
    },
  ]

  return (
    <Card className="ghost-card ghost-card-enter" loading={loading}
      title="运行历史"
      extra={
        <Tooltip title="刷新"><ReloadOutlined onClick={load} /></Tooltip>
      }>
      <div className="ghost-filter-bar" style={{ marginTop: -8, marginBottom: 16 }}>
        <Select placeholder="按任务筛选" allowClear style={{ width: 220 }}
          value={filterTaskId} onChange={(v) => { setFilterTaskId(v); setPage(1) }}
          options={tasks.map((t) => ({ value: t.id, label: `#${t.id} ${t.name}` }))} />
        <Select value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1) }} style={{ width: 120 }}>
          <Select.Option value="all">全部状态</Select.Option>
          <Select.Option value="success">成功</Select.Option>
          <Select.Option value="failed">失败</Select.Option>
          <Select.Option value="running">运行中</Select.Option>
        </Select>
        <Select value={filterRange} onChange={(v) => { setFilterRange(v); setPage(1) }} style={{ width: 140 }}>
          <Select.Option value="24h">近 24 小时</Select.Option>
          <Select.Option value="7d">近 7 天</Select.Option>
          <Select.Option value="30d">近 30 天</Select.Option>
          <Select.Option value="all">全部</Select.Option>
        </Select>
      </div>
      {filteredData.length === 0 ? (
        <Empty description="暂无运行记录，执行任务后这里会显示历史" />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={filteredData}
          pagination={{ current: page, pageSize, total: isFiltered ? filteredData.length : total, onChange: setPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
          size="middle" scroll={{ x: 900 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '12px 24px' }} className="ghost-fade-in">
                <Title level={5} style={{ marginBottom: 12 }}>运行详情 — Run #{record.id}</Title>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="Run ID"><Text code>#{record.id}</Text></Descriptions.Item>
                  <Descriptions.Item label="关联任务">
                    <Space><Tag>#{record.task_id}</Tag>{getTaskName(record.task_id)}</Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={record.status === 'success' ? 'green' : record.status === 'failed' ? 'red' : 'orange'}>
                      {record.status === 'success' ? '成功' : record.status === 'failed' ? '失败' : '运行中'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="影响行数">{record.row_count ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="开始时间">
                    {record.started_at ? new Date(record.started_at).toLocaleString('zh-CN') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="结束时间">
                    {record.finished_at ? new Date(record.finished_at).toLocaleString('zh-CN') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="耗时">
                    {formatDuration(record.started_at, record.finished_at)}
                  </Descriptions.Item>
                </Descriptions>
                {record.error_message && (
                  <Alert type="error" message="错误信息" description={record.error_message}
                    style={{ marginTop: 16 }} showIcon />
                )}
              </div>
            ),
            rowExpandable: () => true,
          }}
        />
      )}
    </Card>
  )
}
