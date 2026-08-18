import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, message, Space, Tag } from 'antd'
import { getSettings, testSettings, updateSettings } from '../../api/settings'

export default function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState({ python_ok: false, uv_ok: false })

  useEffect(() => {
    const load = async () => {
      const data = await getSettings()
      form.setFieldsValue({ python_executable_path: data.python_executable_path || '' })
      setSaved({ python_ok: data.python_ok, uv_ok: data.uv_ok })
    }
    load()
  }, [form])

  const handleTest = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const result = await testSettings({
        python_executable_path: values.python_executable_path || null,
      })
      if (result.python_ok && result.uv_ok) {
        message.success(`${result.message} (${result.python_version}, ${result.uv_version})`)
      } else {
        message.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const data = await updateSettings({
        python_executable_path: values.python_executable_path || null,
      })
      setSaved({ python_ok: data.python_ok, uv_ok: data.uv_ok })
      message.success('保存成功')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="系统设置">
      <Form form={form} layout="vertical">
        <Form.Item
          label="Python 解释器路径"
          name="python_executable_path"
          rules={[{ required: false }]}
          extra="留空表示使用开发模式下的当前解释器；打包版必须配置。"
        >
          <Input placeholder="例如 C:\\Python312\\python.exe" />
        </Form.Item>
        <Space>
          <Button loading={loading} onClick={handleTest}>测试环境</Button>
          <Button type="primary" loading={loading} onClick={handleSave}>保存</Button>
        </Space>
      </Form>
      <div style={{ marginTop: 16 }}>
        <span>当前状态：</span>
        <Tag color={saved.python_ok ? 'success' : 'error'}>
          Python {saved.python_ok ? '可用' : '不可用'}
        </Tag>
        <Tag color={saved.uv_ok ? 'success' : 'error'}>
          uv {saved.uv_ok ? '可用' : '不可用'}
        </Tag>
      </div>
    </Card>
  )
}
