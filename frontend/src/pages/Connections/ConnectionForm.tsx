import { useEffect } from 'react'
import { Form, Input, Select, Button, message, Space, Tooltip } from 'antd'
import { createConnection, updateConnection } from '../../api/connections'
import type { ConnectionItem, ConnectionFormData } from '../../api/connections'

interface Props {
  initial?: ConnectionItem | null
  onSuccess: () => void
}

const SQLITE_TEMPLATE = JSON.stringify({ file_path: "/path/to/database.db" }, null, 2)
const REDSHIFT_IAM_TEMPLATE = JSON.stringify({
  host: "xxx.redshift.amazonaws.com",
  port: 5439,
  database: "dev",
  user: "awsuser",
  auth_type: "iam",
  region: "us-east-1",
  aws_access_key_id: "",
  aws_secret_access_key: "",
}, null, 2)
const REDSHIFT_OKTA_TEMPLATE = JSON.stringify({
  host: "xxx.redshift.amazonaws.com",
  port: 5439,
  database: "dev",
  user: "user@company.com",
  password: "",
  auth_type: "okta",
  idp_tenant: "https://your-org.okta.com",
  client_id: "",
  plugin_name: "com.okta.redshift.okta_credentials_provider",
}, null, 2)

export default function ConnectionForm({ initial, onSuccess }: Props) {
  const [form] = Form.useForm()
  const connectionType = Form.useWatch('type', form)

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        name: initial.name,
        type: initial.type,
        config: initial.config,
      })
    }
  }, [initial, form])

  const handleSubmit = async (values: ConnectionFormData) => {
    try {
      if (initial) {
        await updateConnection(initial.id, values)
        message.success('更新成功')
      } else {
        await createConnection(values)
        message.success('创建成功')
      }
      onSuccess()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const fillTemplate = (tpl: string) => {
    form.setFieldValue('config', tpl)
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ type: 'sqlite' }}>
      <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }]}>
        <Input placeholder="例如：生产 Redshift" />
      </Form.Item>

      <Form.Item name="type" label="数据库类型" rules={[{ required: true }]}>
        <Select>
          <Select.Option value="sqlite">SQLite</Select.Option>
          <Select.Option value="redshift">AWS Redshift</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="config"
        label="连接配置 (JSON)"
        rules={[
          { required: true, message: '请输入 JSON 配置' },
          {
            validator: (_, value) => {
              if (!value) return Promise.resolve()
              try { JSON.parse(value); return Promise.resolve() }
              catch { return Promise.reject(new Error('JSON 格式不正确')) }
            },
          },
        ]}
      >
        <Input.TextArea rows={8} />
      </Form.Item>

      <div style={{ marginBottom: 16 }}>
        <Space size="small" wrap>
          {connectionType === 'sqlite' && (
            <Tooltip title="填入 SQLite 模板">
              <Button size="small" onClick={() => fillTemplate(SQLITE_TEMPLATE)}>SQLite 配置模板</Button>
            </Tooltip>
          )}
          {connectionType === 'redshift' && (
            <>
              <Tooltip title="填入 IAM 认证模板">
                <Button size="small" onClick={() => fillTemplate(REDSHIFT_IAM_TEMPLATE)}>IAM 模板</Button>
              </Tooltip>
              <Tooltip title="填入 Okta SSO 模板">
                <Button size="small" onClick={() => fillTemplate(REDSHIFT_OKTA_TEMPLATE)}>Okta SSO 模板</Button>
              </Tooltip>
            </>
          )}
        </Space>
      </div>

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          {initial ? '更新' : '创建'}
        </Button>
      </Form.Item>
    </Form>
  )
}
