import { useEffect, useState } from 'react'
import {
  Form, Input, Select, Button, message, Switch, Collapse, Space, Upload, Modal,
  Typography, Spin, Tag,
} from 'antd'
import { InboxOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { createTask, updateTask, testTask } from '../../api/tasks'
import { listConnections } from '../../api/connections'
import { listTasks } from '../../api/tasks'
import type { TaskItem, TaskFormData, PreviewData, PythonResult } from '../../api/tasks'
import type { ConnectionItem } from '../../api/connections'
import DataPreview from './DataPreview'

const { TextArea } = Input
const { Dragger } = Upload
const { Text } = Typography

interface Props {
  initial?: TaskItem | null
  onSuccess: () => void
}

export default function TaskForm({ initial, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [connections, setConnections] = useState<ConnectionItem[]>([])
  const [allTasks, setAllTasks] = useState<TaskItem[]>([])
  const [testResult, setTestResult] = useState<PreviewData | PythonResult | null>(null)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const taskType = Form.useWatch('type', form)

  useEffect(() => {
    Promise.all([
      listConnections().then(setConnections).catch(() => {}),
      listTasks().then(setAllTasks).catch(() => {}),
    ])
  }, [])

  useEffect(() => {
    if (initial) {
      const values: Record<string, unknown> = { ...initial }
      if (initial.tags) {
        values.tags = initial.tags.split(',').map((t) => t.trim()).filter(Boolean)
      }
      if (initial.schedule_config) {
        try {
          const cfg = JSON.parse(initial.schedule_config)
          values.cron_expr = cfg.cron || ''
          values.cron_tz = cfg.timezone || 'Asia/Shanghai'
        } catch { /* ignore */ }
      }
      form.setFieldsValue(values)
    }
  }, [initial, form])

  const handleSubmit = async (values: Record<string, unknown>) => {
    const data: Record<string, unknown> = { ...values }
    if (Array.isArray(data.tags)) {
      data.tags = (data.tags as string[]).join(',')
    }
    if (data.cron_expr && String(data.cron_expr).trim()) {
      data.schedule_config = JSON.stringify({
        cron: String(data.cron_expr).trim(),
        timezone: data.cron_tz || 'Asia/Shanghai',
      })
    } else {
      data.schedule_config = null
    }
    delete data.cron_expr
    delete data.cron_tz

    try {
      if (initial) {
        await updateTask(initial.id, data as unknown as Partial<TaskFormData>)
        message.success('更新成功')
      } else {
        await createTask(data as unknown as TaskFormData)
        message.success('创建成功')
      }
      onSuccess()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleFileDrop = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'sql' && ext !== 'py') {
      message.error('仅支持 .sql 和 .py 文件')
      return
    }
    const name = file.name.replace(/\.(sql|py)$/, '')
    form.setFieldValue('name', name)
    form.setFieldValue('type', ext === 'sql' ? 'sql' : 'python')
    try {
      const text = await file.text()
      form.setFieldValue('content', text)
      message.success(`已加载文件: ${file.name}`)
    } catch {
      message.error('文件读取失败')
    }
  }

  const handleTestRun = async () => {
    if (!initial) {
      message.warning('请先保存任务后再测试')
      return
    }
    setTestLoading(true)
    setTestModalOpen(true)
    try {
      const result = await testTask(initial.id)
      setTestResult(result)
    } catch (e: any) {
      message.error(e.message)
      setTestModalOpen(false)
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <>
      <Form form={form} layout="vertical" onFinish={handleSubmit}
        initialValues={{ type: 'sql', enabled: false, cron_tz: 'Asia/Shanghai' }}>
        <Form.Item label="上传文件（可选）">
          <Dragger
            accept=".sql,.py"
            showUploadList={false}
            beforeUpload={(file) => { handleFileDrop(file); return false }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p>点击或拖拽 .sql / .py 文件到此区域</p>
          </Dragger>
        </Form.Item>

        <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
          <Input placeholder="例如：每日销售报表" />
        </Form.Item>

        <Form.Item name="type" label="任务类型" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="sql">SQL 查询</Select.Option>
            <Select.Option value="python">Python 脚本</Select.Option>
          </Select>
        </Form.Item>

        {taskType === 'sql' && (
          <Form.Item name="connection_id" label="数据库连接" rules={[{ required: true }]}>
            <Select placeholder="选择已保存的数据库连接" notFoundContent="暂无连接，请先在「连接管理」中创建">
              {connections.map((c) => (
                <Select.Option key={c.id} value={c.id}>{c.name} ({c.type})</Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item name="content" label={taskType === 'sql' ? 'SQL 代码' : 'Python 代码'}
          rules={[{ required: true }]}>
          <TextArea rows={10}
            placeholder={taskType === 'sql' ? 'SELECT * FROM my_table LIMIT 100' : '# Python 代码\nprint("hello")'} />
        </Form.Item>

        <Form.Item name="output_path" label="CSV 导出路径（可选）">
          <Input placeholder="例如：/data/report.csv" />
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Select mode="tags" placeholder="输入标签后回车" tokenSeparators={[',']} />
        </Form.Item>

        <Form.Item name="prerequisite_task_id" label="前置任务">
          <Select placeholder="无前置任务" allowClear notFoundContent="暂无其他任务">
            {allTasks
              .filter((t) => t.id !== initial?.id)
              .map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  #{t.id} {t.name} ({t.type})
                </Select.Option>
              ))}
          </Select>
        </Form.Item>

        <Collapse ghost items={[{
          key: 'schedule',
          label: '定时调度配置',
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="cron_expr" label="Cron 表达式">
                <Input placeholder="例如：0 9 * * *（每天早上9点）" />
              </Form.Item>
              <Form.Item name="cron_tz" label="时区">
                <Select>
                  <Select.Option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</Select.Option>
                  <Select.Option value="UTC">UTC</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="enabled" label="启用调度" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Space>
          ),
        }]} />

        <Space style={{ width: '100%' }} direction="vertical">
          <Button type="primary" htmlType="submit" block>
            {initial ? '更新' : '创建'}
          </Button>
          {initial && (
            <Button block icon={<PlayCircleOutlined />} onClick={handleTestRun}>
              测试运行
            </Button>
          )}
        </Space>
      </Form>

      <Modal title="测试运行结果" open={testModalOpen}
        onCancel={() => { setTestModalOpen(false); setTestResult(null) }}
        footer={null} width={800} destroyOnClose>
        {testLoading ? <Spin /> : testResult ? (
          'columns' in testResult ? (
            <DataPreview data={testResult as PreviewData} />
          ) : (
            <pre style={{
              background: '#f5f5f5', padding: 12, borderRadius: 4,
              maxHeight: 400, overflow: 'auto',
            }}>
              <Text>{(testResult as PythonResult).stdout || '(无输出)'}</Text>
              {(testResult as PythonResult).stderr && (
                <div><Text type="danger">{(testResult as PythonResult).stderr}</Text></div>
              )}
              <Tag color={(testResult as PythonResult).success ? 'green' : 'red'} style={{ marginTop: 8 }}>
                exit code: {(testResult as PythonResult).exit_code}
              </Tag>
            </pre>
          )
        ) : null}
      </Modal>
    </>
  )
}
