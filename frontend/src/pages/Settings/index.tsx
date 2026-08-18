import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, message, Space, Table, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getInstalledPackages, getSettings, testSettings, updateSettings } from '../../api/settings'
import type { InstalledPackage } from '../../api/settings'

export default function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState({ python_ok: false, uv_ok: false })
  const [packages, setPackages] = useState<InstalledPackage[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packagesError, setPackagesError] = useState('')

  useEffect(() => {
    const load = async () => {
      const data = await getSettings()
      form.setFieldsValue({ python_executable_path: data.python_executable_path || '' })
      setSaved({ python_ok: data.python_ok, uv_ok: data.uv_ok })
    }
    load()
  }, [form])

  const loadPackages = async () => {
    setPackagesLoading(true)
    setPackagesError('')
    try {
      const data = await getInstalledPackages()
      if (data.error) {
        setPackagesError(data.error)
      } else {
        setPackages(data.packages)
      }
    } catch (e) {
      setPackagesError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setPackagesLoading(false)
    }
  }

  useEffect(() => {
    loadPackages()
  }, [])

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
      loadPackages()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="系统设置" className="ghost-card ghost-card-enter">
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

      <Card
        title="已安装 Python 包"
        size="small"
        className="ghost-card"
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="text"
            icon={<ReloadOutlined />}
            loading={packagesLoading}
            onClick={loadPackages}
          >
            刷新
          </Button>
        }
      >
        {packagesError ? (
          <Tag color="error">{packagesError}</Tag>
        ) : (
          <Table
            rowKey="name"
            size="small"
            loading={packagesLoading}
            dataSource={packages}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columns={[
              { title: '包名', dataIndex: 'name', key: 'name' },
              { title: '版本', dataIndex: 'version', key: 'version', width: 120 },
            ]}
          />
        )}
      </Card>
    </Card>
  )
}
