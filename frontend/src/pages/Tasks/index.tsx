import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Button, Space, Modal, Tag, message, Popconfirm, Typography, Switch, Tooltip, Alert, Input, Row, Col, Select,
} from 'antd'
import {
  PlusOutlined, PlayCircleOutlined, EyeOutlined, DownloadOutlined, SearchOutlined,
} from '@ant-design/icons'
import { listTasks, deleteTask, runTask, previewTask, exportTaskCsv, toggleTask, downloadTaskCsv } from '../../api/tasks'
import type { TaskItem, RunResult, PreviewData } from '../../api/tasks'
import TaskForm from './TaskForm'
import DataPreview from './DataPreview'

const { Text } = Typography

export default function Tasks() {
  const [data, setData] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [searchTag, setSearchTag] = useState<string[]>([])
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
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '标签', key: 'tags', width: 160, ellipsis: true,
      render: (_: unknown, r: TaskItem) => r.tags
        ? r.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
          <Tag key={t} style={{ marginBottom: 2 }}>{t}</Tag>
        ))
        : <Text type="secondary">-</Text>,
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: (t: string) => (
        <Tag color={t === 'sql' ? 'geekblue' : 'purple'}>{t === 'sql' ? 'SQL' : 'Python'}</Tag>
      ),
    },
    {
      title: '前置任务', key: 'prerequisite', width: 140, ellipsis: true,
      render: (_: unknown, r: TaskItem) => {
        if (!r.prerequisite_task_id) return <Text type="secondary">无</Text>
        return <Tag>{getPrereqName(r.prerequisite_task_id)}</Tag>
      },
    },
    {
      title: '调度', key: 'enabled', width: 120,
      render: (_: unknown, record: TaskItem) => (
        record.schedule_config ? (
          <Space>
            <Switch checked={record.enabled} size="small" onChange={() => handleToggle(record)} />
            <Tag color={record.enabled ? 'green' : 'default'} style={{ margin: 0 }}>
              {record.enabled ? '启用' : '停用'}
            </Tag>
          </Space>
        ) : (
          <Tag style={{ margin: 0 }}>未配置</Tag>
        )
      ),
    },
    {
      title: '操作', key: 'action', width: 400,
      render: (_: unknown, record: TaskItem) => (
        <Space size="small" wrap>
          <Tooltip title="运行任务并记录">
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)}>运行</Button>
          </Tooltip>
          {record.type === 'sql' && (
            <Tooltip title="预览前100行数据">
              <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>预览</Button>
            </Tooltip>
          )}
          {record.type === 'sql' && record.output_path && (
            <Tooltip title="导出CSV到指定路径">
              <Button size="small" icon={<DownloadOutlined />} onClick={() => handleExport(record)}>导出</Button>
            </Tooltip>
          )}
          {record.type === 'sql' && (
            <Tooltip title="下载 CSV 到本地">
              <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTaskCsv(record.id)}>下载</Button>
            </Tooltip>
          )}
          <Button size="small" onClick={() => { setEditing(record); setFormOpen(true) }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card className="ghost-card"
      title="任务管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setFormOpen(true) }}>
          新建任务
        </Button>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input prefix={<SearchOutlined />} placeholder="搜索任务名称/代码..." allowClear
            value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
        </Col>
        <Col span={6}>
          <Select mode="multiple" placeholder="按标签筛选" allowClear
            value={searchTag}
            onChange={(v: string[]) => setSearchTag(v)}
            style={{ width: '100%' }}>
            {allTags.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
          </Select>
        </Col>
      </Row>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
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
          <div>
            <Tag color={resultData.status === 'success' ? 'green' : 'red'}>
              {resultData.status === 'success' ? '成功' : '失败'}
            </Tag>
            {resultData.error_message && (
              <Alert type="error" message={resultData.error_message} style={{ marginTop: 12 }} />
            )}
            {resultData.result_preview && 'columns' in resultData.result_preview ? (
              <div style={{ marginTop: 12 }}>
                <DataPreview data={resultData.result_preview as PreviewData} />
              </div>
            ) : resultData.result_preview && 'stdout' in resultData.result_preview ? (
              <pre style={{
                background: '#f5f5f5', padding: 12, borderRadius: 4,
                maxHeight: 400, overflow: 'auto', marginTop: 12,
              }}>
                <Text>{(resultData.result_preview as any).stdout || '(无输出)'}</Text>
                {(resultData.result_preview as any).stderr && (
                  <Text type="danger">{(resultData.result_preview as any).stderr}</Text>
                )}
              </pre>
            ) : null}
          </div>
        )}
      </Modal>
    </Card>
  )
}
