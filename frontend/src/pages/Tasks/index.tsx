import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Modal, Tag, message,
  Popconfirm, Typography, Spin, Alert, Switch,
} from 'antd'
import {
  PlusOutlined, PlayCircleOutlined, EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { listTasks, deleteTask, runTask, previewTask, exportTaskCsv, toggleTask } from '../../api/tasks'
import type { TaskItem, RunResult, PreviewData } from '../../api/tasks'
import TaskForm from './TaskForm'
import DataPreview from './DataPreview'

const { Text } = Typography

export default function Tasks() {
  const [data, setData] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaskItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [resultData, setResultData] = useState<RunResult | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setData(await listTasks())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    await deleteTask(id)
    message.success('删除成功')
    load()
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
      if (result.status === 'success') {
        message.success('执行成功')
      } else {
        message.error('执行失败')
      }
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

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => (
        <Tag color={t === 'sql' ? 'geekblue' : 'purple'}>
          {t === 'sql' ? 'SQL' : 'Python'}
        </Tag>
      ),
    },
    {
      title: '调度',
      key: 'enabled',
      render: (_: unknown, record: TaskItem) => (
        record.schedule_config ? (
          <Space>
            <Switch checked={record.enabled} size="small"
              onChange={() => handleToggle(record)} />
            <Tag color={record.enabled ? 'green' : 'default'} style={{ margin: 0 }}>
              {record.enabled ? '已启用' : '已停用'}
            </Tag>
          </Space>
        ) : (
          <Tag style={{ margin: 0 }}>未配置</Tag>
        )
      ),
    },
    {
      title: '操作', key: 'action', width: 320,
      render: (_: unknown, record: TaskItem) => (
        <Space size="small" wrap>
          <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)}>
            执行
          </Button>
          {record.type === 'sql' && (
            <Button type="link" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>
              预览
            </Button>
          )}
          {record.type === 'sql' && record.output_path && (
            <Button type="link" icon={<DownloadOutlined />} onClick={() => handleExport(record)}>
              导出
            </Button>
          )}
          <Button type="link" onClick={() => { setEditing(record); setFormOpen(true) }}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="任务管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setFormOpen(true) }}>
          新建任务
        </Button>
      }
    >
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />

      <Modal title={editing ? '编辑任务' : '新建任务'} open={formOpen}
        onCancel={() => setFormOpen(false)} footer={null} destroyOnClose width={800}>
        <TaskForm initial={editing} onSuccess={() => { setFormOpen(false); load() }} />
      </Modal>

      <Modal title="数据预览" open={previewOpen} footer={null}
        onCancel={() => { setPreviewOpen(false); setPreviewData(null) }}
        width="80%" destroyOnClose>
        {previewLoading ? <Spin /> : previewData && <DataPreview data={previewData} />}
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
                <Text>{resultData.result_preview.stdout || '(无输出)'}</Text>
                {resultData.result_preview.stderr && (
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
