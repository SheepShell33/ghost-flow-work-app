import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Select, Space, message } from 'antd'
import { createConnection, testConnection, updateConnection } from '../../api/connections'
import type { ConnectionFormData, ConnectionItem, ConnectionTestResult } from '../../api/connections'

interface Props {
  initial?: ConnectionItem | null
  onSuccess: () => void
}

// 将 db_groups 的逗号分隔输入转为数组
const parseGroups = (raw?: string): string[] =>
  (raw || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)

// 把表单字段组装为连接配置 JSON 字符串（含 auth_type，空的可选字段不写入）
const buildConfig = (values: Record<string, any>): string => {
  if (values.type === 'sqlite') {
    return JSON.stringify({ file_path: values.file_path })
  }

  const config: Record<string, unknown> = { auth_type: values.auth_type }
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') config[key] = value
  }

  put('host', values.host)
  if (values.port) config.port = values.port
  put('database', values.database)

  if (values.auth_type === 'browser_azure') {
    put('cluster_identifier', values.cluster_identifier)
    put('client_id', values.client_id)
    put('idp_tenant', values.idp_tenant)
    put('region', values.region)
    put('db_user', values.db_user)
    const groups = parseGroups(values.db_groups)
    if (groups.length) config.db_groups = groups
  } else if (values.auth_type === 'iam_keys') {
    put('cluster_identifier', values.cluster_identifier)
    put('region', values.region)
    put('user', values.user)
    put('aws_access_key_id', values.aws_access_key_id)
    put('aws_secret_access_key', values.aws_secret_access_key)
    put('session_token', values.session_token)
  } else {
    put('user', values.user)
    put('password', values.password)
  }

  return JSON.stringify(config)
}

export default function ConnectionForm({ initial, onSuccess }: Props) {
  const [form] = Form.useForm()
  const connectionType = Form.useWatch('type', form)
  const authType = Form.useWatch('auth_type', form)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)

  // 编辑时把已有 config JSON 反填进结构化字段
  useEffect(() => {
    if (!initial) return
    let cfg: Record<string, any> = {}
    try {
      cfg = JSON.parse(initial.config)
    } catch {
      cfg = {}
    }
    form.setFieldsValue({
      name: initial.name,
      type: initial.type,
      port: 5439,
      ...cfg,
      db_groups: Array.isArray(cfg.db_groups) ? cfg.db_groups.join(', ') : cfg.db_groups,
    })
  }, [initial, form])

  const handleSubmit = async (values: Record<string, any>) => {
    const data: ConnectionFormData = {
      name: values.name,
      type: values.type,
      config: buildConfig(values),
    }
    try {
      if (initial) {
        await updateConnection(initial.id, data)
        message.success('更新成功')
      } else {
        await createConnection(data)
        message.success('创建成功')
      }
      onSuccess()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleTest = async () => {
    let values: Record<string, any>
    try {
      values = await form.validateFields()
    } catch {
      return // 表单校验失败，antd 已在字段上提示
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection({ type: values.type, config: buildConfig(values) })
      setTestResult(result)
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '测试请求失败' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{ type: 'sqlite', auth_type: 'browser_azure', port: 5439 }}
    >
      <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }]}>
        <Input placeholder="例如：生产 Redshift" />
      </Form.Item>

      <Form.Item name="type" label="数据库类型" rules={[{ required: true, message: '请选择数据库类型' }]}>
        <Select>
          <Select.Option value="sqlite">SQLite</Select.Option>
          <Select.Option value="redshift">AWS Redshift</Select.Option>
        </Select>
      </Form.Item>

      {connectionType === 'sqlite' && (
        <Form.Item
          name="file_path"
          label="SQLite 文件路径"
          rules={[{ required: true, message: '请输入 SQLite 文件路径' }]}
        >
          <Input placeholder="例如：D:/data/app.db" />
        </Form.Item>
      )}

      {connectionType === 'redshift' && (
        <>
          <Form.Item name="auth_type" label="认证方式" rules={[{ required: true, message: '请选择认证方式' }]}>
            <Select>
              <Select.Option value="browser_azure">Azure AD 浏览器 SSO（browser_azure）</Select.Option>
              <Select.Option value="iam_keys">IAM 密钥（iam_keys）</Select.Option>
              <Select.Option value="password">密码（password）</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="host" label="主机地址" rules={[{ required: true, message: '请输入主机地址' }]}>
            <Input placeholder="例如：xxx.abc123.us-east-1.redshift.amazonaws.com" />
          </Form.Item>

          <Form.Item name="port" label="端口" rules={[{ required: true, message: '请输入端口' }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="默认 5439" />
          </Form.Item>

          <Form.Item name="database" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
            <Input placeholder="例如：dev" />
          </Form.Item>

          {authType === 'browser_azure' && (
            <>
              <Form.Item
                name="cluster_identifier"
                label="集群标识"
                rules={[{ required: true, message: '请输入集群标识' }]}
              >
                <Input placeholder="例如：my-cluster" />
              </Form.Item>
              <Form.Item
                name="client_id"
                label="应用（客户端）ID"
                rules={[{ required: true, message: '请输入 Azure AD 应用的 Client ID' }]}
              >
                <Input placeholder="Azure AD 应用注册的 Client ID" />
              </Form.Item>
              <Form.Item
                name="idp_tenant"
                label="租户 ID"
                rules={[{ required: true, message: '请输入 Azure AD 租户 ID' }]}
              >
                <Input placeholder="Azure AD 租户（Tenant）ID" />
              </Form.Item>
              <Form.Item name="region" label="AWS 区域（选填）">
                <Input placeholder="留空则自动从主机地址推导，例如：us-east-1" />
              </Form.Item>
              <Form.Item name="db_user" label="数据库用户（选填）">
                <Input placeholder="Redshift 数据库用户名" />
              </Form.Item>
              <Form.Item name="db_groups" label="数据库用户组（选填）">
                <Input placeholder="多个用户组用逗号分隔，例如：bi, analyst" />
              </Form.Item>
            </>
          )}

          {authType === 'iam_keys' && (
            <>
              <Form.Item
                name="cluster_identifier"
                label="集群标识"
                rules={[{ required: true, message: '请输入集群标识' }]}
              >
                <Input placeholder="例如：my-cluster" />
              </Form.Item>
              <Form.Item name="region" label="AWS 区域" rules={[{ required: true, message: '请输入 AWS 区域' }]}>
                <Input placeholder="例如：us-east-1" />
              </Form.Item>
              <Form.Item name="user" label="数据库用户" rules={[{ required: true, message: '请输入数据库用户' }]}>
                <Input placeholder="Redshift 数据库用户名" />
              </Form.Item>
              <Form.Item
                name="aws_access_key_id"
                label="Access Key ID"
                rules={[{ required: true, message: '请输入 AWS Access Key ID' }]}
              >
                <Input placeholder="例如：AKIA..." />
              </Form.Item>
              <Form.Item
                name="aws_secret_access_key"
                label="Secret Access Key"
                rules={[{ required: true, message: '请输入 AWS Secret Access Key' }]}
              >
                <Input.Password placeholder="AWS Secret Access Key" />
              </Form.Item>
              <Form.Item name="session_token" label="会话令牌（选填）">
                <Input.Password placeholder="临时凭证的 Session Token" />
              </Form.Item>
            </>
          )}

          {authType === 'password' && (
            <>
              <Form.Item name="user" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="数据库用户名" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password placeholder="数据库密码" />
              </Form.Item>
            </>
          )}
        </>
      )}

      {testResult && (
        <Alert
          style={{ marginBottom: 16 }}
          type={testResult.success ? 'success' : 'error'}
          showIcon
          message={testResult.success ? '连接测试成功' : '连接测试失败'}
          description={testResult.message}
        />
      )}

      <Form.Item style={{ marginBottom: 0 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space.Compact block>
            <Button style={{ width: '50%' }} loading={testing} onClick={handleTest}>
              测试连接
            </Button>
            <Button type="primary" htmlType="submit" style={{ width: '50%' }}>
              {initial ? '更新' : '创建'}
            </Button>
          </Space.Compact>
          {connectionType === 'redshift' && authType === 'browser_azure' && (
            <span className="ghost-dim" style={{ fontSize: 12 }}>
              提示：Azure AD SSO 测试会弹出系统浏览器，请在浏览器中完成登录后返回。
            </span>
          )}
        </Space>
      </Form.Item>
    </Form>
  )
}
