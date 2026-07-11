import { useEffect, useState } from 'react'
import { Button, Card, Space, Table, Modal, Tag, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { listConnections, deleteConnection } from '../../api/connections'
import type { ConnectionItem } from '../../api/connections'
import ConnectionForm from './ConnectionForm'

export default function Connections() {
  const [data, setData] = useState<ConnectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConnectionItem | null>(null)

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

  const handleDelete = async (id: number) => {
    await deleteConnection(id)
    message.success('删除成功')
    load()
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag color={t === 'redshift' ? 'blue' : 'green'}>{t}</Tag>,
    },
    {
      title: '配置',
      dataIndex: 'config',
      key: 'config',
      ellipsis: true,
      render: (c: string) => {
        try {
          return JSON.stringify(JSON.parse(c))
        } catch {
          return c
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ConnectionItem) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setEditing(record)
              setModalOpen(true)
            }}
          >
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
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
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
