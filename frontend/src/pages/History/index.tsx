import { useEffect, useState } from 'react'
import { Card, Table, Tag, Empty } from 'antd'
import { listTaskRuns } from '../../api/task-runs'
import type { TaskRunItem } from '../../api/task-runs'

export default function History() {
  const [data, setData] = useState<TaskRunItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setData(await listTaskRuns())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '任务 ID', dataIndex: 'task_id', key: 'task_id', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const color = s === 'success' ? 'green' : s === 'failed' ? 'red' : 'orange'
        const label = s === 'success' ? '成功' : s === 'failed' ? '失败' : '运行中'
        return <Tag color={color}>{label}</Tag>
      },
    },
    { title: '行数', dataIndex: 'row_count', key: 'row_count', width: 80 },
    {
      title: '开始时间', dataIndex: 'started_at', key: 'started_at',
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '结束时间', dataIndex: 'finished_at', key: 'finished_at',
      render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '错误信息', dataIndex: 'error_message', key: 'error_message',
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
  ]

  return (
    <Card title="运行历史" loading={loading}>
      {data.length === 0 ? (
        <Empty description="暂无运行记录，执行任务后这里会显示历史" />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={data} pagination={{ pageSize: 20 }} />
      )}
    </Card>
  )
}
