import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Space, Table, Modal, Tag, message, Popconfirm, Tooltip, Input, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, CloudOutlined } from '@ant-design/icons'
import { listConnections, deleteConnection } from '../../api/connections'
import type { ConnectionItem } from '../../api/connections'
import ConnectionForm from './ConnectionForm'

const { Text } = Typography

export default function Connections() {
  const [data, setData] = useState<ConnectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConnectionItem | null>(null)
  const [searchQ, setSearchQ] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const items = await listConnections()
      setData(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredData = useMemo(() => {
    if (!searchQ.trim()) return data
    return data.filter((c) => c.name.toLowerCase().includes(searchQ.toLowerCase()))
  }, [data, searchQ])

  const handleDelete = async (id: number) => {
    try {
      await deleteConnection(id)
      message.success('删除成功')
      load()
    } catch (e: any) {
      message.error(e.message || '删除失败')
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ConnectionItem) => (
        <Space>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>#{record.id}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (t: string) => (
        <Tag color={t === 'redshift' ? 'blue' : 'green'} icon={t === 'redshift' ? <CloudOutlined /> : <DatabaseOutlined />}>
          {t}
        </Tag>
      ),
    },
    {
      title: '配置摘要',
      key: 'summary',
      ellipsis: true,
      render: (_: unknown, record: ConnectionItem) => {
        try {
          const cfg = JSON.parse(record.config)
          const text = record.type === 'sqlite' ? (cfg.file_path || '-') : (cfg.host || cfg.database || '-')
          return <Text style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#94a3b8' }}>{text}</Text>
        } catch {
          return <Text type="secondary">-</Text>
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: ConnectionItem) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => { setEditing(record); setModalOpen(true) }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Card className="ghost-card ghost-card-enter"
      title="连接管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          新建连接
        </Button>
      }
    >
      <div className="ghost-filter-bar" style={{ marginTop: -8, marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索连接名称..."
          allowClear
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{ width: 320 }}
        />
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        pagination={false}
      />
      <Modal
        title={editing ? '编辑连接' : '新建连接'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        <ConnectionForm
          initial={editing}
          onSuccess={() => {
            setModalOpen(false)
            load()
          }}
        />
      </Modal>
    </Card>
  )
}
