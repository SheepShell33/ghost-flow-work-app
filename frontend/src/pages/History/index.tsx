import { useEffect, useState, useMemo } from 'react'
import { Card, Table, Tag, Empty, Typography, Space, Descriptions, Tooltip, message, Select } from 'antd'
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
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 30

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t.name])), [tasks])

  const load = async () => {
    setLoading(true)
    try {
      const [runs, allTasks] = await Promise.all([
        listTaskRuns({ task_id: filterTaskId, page, page_size: pageSize }),
        listTasks(),
      ])
      setData(runs)
      setTasks(allTasks)
      setTotal(runs.length < pageSize ? (page - 1) * pageSize + runs.length : page * pageSize + 1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterTaskId, page])

  const getTaskName = (taskId: number) => taskMap.get(taskId) || `#${taskId}`

  const columns = [
    {
      title: 'Run ID', dataIndex: 'id', key: 'id', width: 90, fixed: 'left' as const,
      render: (id: number) => (
        <Space size={4}>
          <Text code strong style={{ fontSize: 13 }}>#{id}</Text>
          <Tooltip title="复制 Run ID">
            <CopyOutlined
              style={{ cursor: 'pointer', color: '#999', fontSize: 12 }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(String(id))
                  message.success('已复制 Run ID')
                } catch { message.error('复制失败') }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '任务', key: 'task', width: 180,
      render: (_: unknown, r: TaskRunItem) => (
        <Space size={4}>
          <Tag style={{ margin: 0 }}>{r.task_id}</Tag>
          <Text ellipsis style={{ maxWidth: 120 }}>{getTaskName(r.task_id)}</Text>
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => {
        const color = s === 'success' ? 'green' : s === 'failed' ? 'red' : 'orange'
        const label = s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'
        return <Tag color={color}>{label}</Tag>
      },
    },
    { title: '行数', dataIndex: 'row_count', key: 'row_count', width: 70, render: (v: number | null) => v ?? '-' },
    {
      title: '开始时间', dataIndex: 'started_at', key: 'started_at', width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '结束时间', dataIndex: 'finished_at', key: 'finished_at', width: 170,
      render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '错误信息', dataIndex: 'error_message', key: 'error_message',
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
  ]

  return (
    <Card className="ghost-card" loading={loading}
      title="运行历史"
      extra={
        <Space>
          <Select
            placeholder="按任务筛选" allowClear style={{ width: 200 }}
            value={filterTaskId}
            onChange={(v) => { setFilterTaskId(v); setPage(1) }}
            options={tasks.map((t) => ({ value: t.id, label: `#${t.id} ${t.name}` }))}
          />
          <Tooltip title="刷新"><ReloadOutlined onClick={load} /></Tooltip>
        </Space>
      }>
      {data.length === 0 ? (
        <Empty description="暂无运行记录，执行任务后这里会显示历史" />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={data}
          pagination={{ current: page, pageSize, total, onChange: setPage, showSizeChanger: false }}
          size="middle" scroll={{ x: 900 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '12px 24px' }}>
                <Title level={5} style={{ marginBottom: 12 }}>
                  运行详情 — Run #{record.id}
                </Title>
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
                  <Descriptions.Item label="错误信息" span={2}>
                    {record.error_message || '无'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            ),
            rowExpandable: () => true,
          }}
        />
      )}
    </Card>
  )
}
