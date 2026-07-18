import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Card, Table, Button, Space, Modal, Tag, message, Popconfirm, Typography, Switch, Tooltip, Alert, Input, Select,
} from 'antd'
import {
  PlusOutlined, PlayCircleOutlined, EyeOutlined, DownloadOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { listTasks, deleteTask, runTask, previewTask, exportTaskCsv, toggleTask, downloadTaskCsv } from '../../api/tasks'
import type { TaskItem, RunResult, PreviewData, PythonResult } from '../../api/tasks'
import TaskForm from './TaskForm'
import DataPreview from './DataPreview'

const { Text } = Typography

export default function Tasks() {
  const [data, setData] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [searchTag, setSearchTag] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'all' | 'sql' | 'python'>('all')
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled' | 'unscheduled'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaskItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [resultData, setResultData] = useState<RunResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: { q?: string; tag?: string } = {}
      if (searchQ) params.q = searchQ
      if (searchTag.length > 0) params.tag = searchTag[searchTag.length - 1]
      setData(await listTasks(params))
    } finally {
      setLoading(false)
    }
  }, [searchQ, searchTag])

  useEffect(() => { load() }, [load])

  const displayedData = useMemo(() => {
    return data.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (filterEnabled === 'enabled') return t.enabled
      if (filterEnabled === 'disabled') return t.schedule_config && !t.enabled
      if (filterEnabled === 'unscheduled') return !t.schedule_config
      return true
    })
  }, [data, filterType, filterEnabled])

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id)
      message.success('删除成功')
      load()
    } catch (e: any) {
      message.error(e.message || '删除失败')
    }
  }

  const handleToggle = async (task: TaskItem) => {
    try {
      const result = await toggleTask(task.id)
      message.success(result.enabled ? '调度已启用' : '调度已停用')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleRun = async (task: TaskItem) => {
    const hide = message.loading('执行中...')
    try {
      const result = await runTask(task.id)
      setResultData(result)
      setResultOpen(true)
      message.success(result.status === 'success' ? '执行成功' : '执行失败')
    } catch (e: any) {
      message.error(e.message)
    } finally {
      hide()
    }
  }

  const handlePreview = async (task: TaskItem) => {
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      setPreviewData(await previewTask(task.id))
    } catch (e: any) {
      message.error(e.message)
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleExport = async (task: TaskItem) => {
    const hide = message.loading('导出中...')
    try {
      const result = await exportTaskCsv(task.id)
      message.success(`导出成功: ${result.file_path} (${result.row_count} 行)`)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      hide()
    }
  }

  const allTags = [...new Set(data.flatMap((t) => (t.tags ? t.tags.split(',').map((s) => s.trim()) : [])))]

  const getPrereqName = (id: number | null) => {
    if (!id) return '-'
    const task = data.find((t) => t.id === id)
    return task ? `#${id} ${task.name}` : `#${id} (已删除)`
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: TaskItem) => (
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
      render: (t: string) => (
        <Tag color={t === 'sql' ? 'geekblue' : 'purple'}>{t === 'sql' ? 'SQL' : 'Python'}</Tag>
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 180,
      render: (_: unknown, r: TaskItem) => {
        if (!r.tags) return <Text type="secondary">-</Text>
        const tags = r.tags.split(',').map((t) => t.trim()).filter(Boolean)
        return (
          <Space size={4} wrap style={{ maxWidth: 160, lineHeight: '22px' }}>
            {tags.slice(0, 3).map((t) => <Tag key={t}>{t}</Tag>)}
            {tags.length > 3 && (
              <Tooltip title={tags.slice(3).join(', ')}>
                <Tag>+{tags.length - 3}</Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
    {
      title: '前置任务',
      key: 'prerequisite',
      width: 140,
      render: (_: unknown, r: TaskItem) => {
        if (!r.prerequisite_task_id) return <Text type="secondary">无</Text>
        return <Tag>{getPrereqName(r.prerequisite_task_id)}</Tag>
      },
    },
    {
      title: '调度',
      key: 'enabled',
      width: 140,
      render: (_: unknown, record: TaskItem) => (
        record.schedule_config ? (
          <Space size={8}>
            <span className={`ghost-status-dot ${record.enabled ? 'ghost-status-dot--success ghost-status-pulse' : 'ghost-status-dot--idle'}`} />
            <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record)} />
            <span style={{ fontSize: 13, color: record.enabled ? 'var(--ghost-text)' : 'var(--ghost-text-dim)' }}>
              {record.enabled ? '已启用' : '已停用'}
            </span>
          </Space>
        ) : (
          <span className="ghost-dim" style={{ fontSize: 13 }}>未配置</span>
        )
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: TaskItem) => (
        <Space size="small" wrap className="ghost-table-actions">
          <Tooltip title="运行"><Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)} /></Tooltip>
          {record.type === 'sql' && (
            <Tooltip title="预览"><Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)} /></Tooltip>
          )}
          {record.type === 'sql' && record.output_path && (
            <Tooltip title="导出"><Button size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record)} /></Tooltip>
          )}
          {record.type === 'sql' && (
            <Tooltip title="下载"><Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTaskCsv(record.id)} /></Tooltip>
          )}
          <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(record); setFormOpen(true) }} /></Tooltip>
          <Tooltip title="删除">
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Card className="ghost-card ghost-card-enter"
      title="任务管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setFormOpen(true) }}>
          新建任务
        </Button>
      }
    >
      <div className="ghost-filter-bar">
        <Input prefix={<SearchOutlined />} placeholder="搜索任务名称/代码..." allowClear
          value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={{ width: 260 }} />
        <Select mode="multiple" placeholder="按标签筛选" allowClear
          value={searchTag} onChange={(v: string[]) => setSearchTag(v)} style={{ minWidth: 160 }}>
          {allTags.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
        </Select>
        <Select value={filterType} onChange={(v) => setFilterType(v as typeof filterType)} style={{ width: 120 }}>
          <Select.Option value="all">全部类型</Select.Option>
          <Select.Option value="sql">SQL</Select.Option>
          <Select.Option value="python">Python</Select.Option>
        </Select>
        <Select value={filterEnabled} onChange={(v) => setFilterEnabled(v as typeof filterEnabled)} style={{ width: 140 }}>
          <Select.Option value="all">全部状态</Select.Option>
          <Select.Option value="enabled">已启用</Select.Option>
          <Select.Option value="disabled">已停用</Select.Option>
          <Select.Option value="unscheduled">未配置</Select.Option>
        </Select>
      </div>
      <Table rowKey="id" columns={columns} dataSource={displayedData} loading={loading}
        pagination={{ pageSize: 20 }} size="middle" />

      <Modal title={editing ? '编辑任务' : '新建任务'} open={formOpen}
        onCancel={() => setFormOpen(false)} footer={null} destroyOnClose width={800}>
        <TaskForm initial={editing} onSuccess={() => { setFormOpen(false); load() }} />
      </Modal>

      <Modal title="数据预览" open={previewOpen} footer={null}
        onCancel={() => { setPreviewOpen(false); setPreviewData(null) }}
        width="80%" destroyOnClose>
        {previewLoading ? null : previewData && <DataPreview data={previewData} />}
      </Modal>

      <Modal title="执行结果" open={resultOpen} footer={null}
        onCancel={() => { setResultOpen(false); setResultData(null) }}
        width={800} destroyOnClose>
        {resultData && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Tag style={{
              fontSize: 16, padding: '6px 12px',
              background: resultData.status === 'success'
                ? 'linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(34, 197, 94, 0.2))'
                : 'linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(239, 68, 68, 0.2))',
              borderColor: resultData.status === 'success' ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 107, 107, 0.4)',
              color: resultData.status === 'success' ? '#4ade80' : '#ff6b6b',
            }}>
              {resultData.status === 'success' ? '执行成功' : '执行失败'}
            </Tag>
            {resultData.error_message && (
              <Alert type="error" message={resultData.error_message} showIcon />
            )}
            {resultData.result_preview && 'columns' in resultData.result_preview ? (
              <Card className="ghost-card" size="small" title="数据预览">
                <DataPreview data={resultData.result_preview as PreviewData} />
              </Card>
            ) : resultData.result_preview && 'stdout' in resultData.result_preview ? (
              <Card className="ghost-card" size="small" title="Python 输出">
                <pre style={{
                  background: '#f6ffed', padding: 12, borderRadius: 4,
                  maxHeight: 400, overflow: 'auto', margin: 0,
                }}>
                  <Text>{(resultData.result_preview as PythonResult).stdout || '(无输出)'}</Text>
                </pre>
                {(resultData.result_preview as PythonResult).stderr && (
                  <pre style={{
                    background: '#fff2f0', padding: 12, borderRadius: 4,
                    maxHeight: 200, overflow: 'auto', marginTop: 12, color: '#ff4d4f',
                  }}>
                    {(resultData.result_preview as PythonResult).stderr}
                  </pre>
                )}
              </Card>
            ) : null}
          </Space>
        )}
      </Modal>
    </Card>
  )
}
