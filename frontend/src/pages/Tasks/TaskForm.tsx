import { useEffect, useState } from 'react'
import { Form, Input, Select, Button, message, Switch, Collapse, Space } from 'antd'
import { createTask, updateTask } from '../../api/tasks'
import { listConnections } from '../../api/connections'
import type { TaskItem, TaskFormData } from '../../api/tasks'
import type { ConnectionItem } from '../../api/connections'

const { TextArea } = Input

interface Props {
  initial?: TaskItem | null
  onSuccess: () => void
}

export default function TaskForm({ initial, onSuccess }: Props) {
  const [form] = Form.useForm()
  const [connections, setConnections] = useState<ConnectionItem[]>([])
  const taskType = Form.useWatch('type', form)

  useEffect(() => {
    listConnections().then(setConnections).catch(() => {})
  }, [])

  useEffect(() => {
    if (initial) {
      const values: Record<string, unknown> = { ...initial }
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

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}
      initialValues={{ type: 'sql', enabled: false, cron_tz: 'Asia/Shanghai' }}>
      <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
        <Input placeholder="例如：每日销售报表" />
      </Form.Item>

      <Form.Item name="type" label="任务类型" rules={[{ required: true }]}>
        <Select>
          <Select.Option value="sql">SQL 查询</Select.Option>
          <Select.Option value="python">Python 脚本</Select.Option>
        </Select>
      </Form.Item>

      {taskType === 'sql' && (
        <Form.Item name="connection_id" label="数据库连接" rules={[{ required: true, message: '请选择数据库连接' }]}>
          <Select placeholder="选择已保存的数据库连接" notFoundContent="暂无连接，请先在「连接管理」中创建">
            {connections.map((c) => (
              <Select.Option key={c.id} value={c.id}>{c.name} ({c.type})</Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}

      <Form.Item name="content" label={taskType === 'sql' ? 'SQL 代码' : 'Python 代码'}
        rules={[{ required: true, message: '请输入代码' }]}>
        <TextArea rows={10}
          placeholder={taskType === 'sql' ? 'SELECT * FROM my_table LIMIT 100' : '# Python 代码\nprint("hello")'} />
      </Form.Item>

      <Form.Item name="output_path" label="CSV 导出路径（可选）">
        <Input placeholder="例如：/data/report.csv" />
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
                <Select.Option value="America/New_York">America/New_York</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="enabled" label="启用调度" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        ),
      }]} />

      <Button type="primary" htmlType="submit" block>
        {initial ? '更新' : '创建'}
      </Button>
    </Form>
  )
}
