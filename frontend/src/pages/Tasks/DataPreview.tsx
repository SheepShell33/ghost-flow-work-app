import { Table, Tag, Typography } from 'antd'
import type { PreviewData } from '../../api/tasks'

const { Text } = Typography

interface Props {
  data: PreviewData
  loading?: boolean
}

export default function DataPreview({ data, loading }: Props) {
  const columns = data.columns.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    render: (val: unknown) => {
      if (val === null || val === undefined) return <Text type="secondary">NULL</Text>
      return String(val)
    },
  }))

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Tag color="blue">{data.total_rows} 行</Tag>
        <Tag>{data.columns.length} 列</Tag>
        {data.total_rows > data.preview_rows && (
          <Text type="secondary">（仅显示前 {data.preview_rows} 行）</Text>
        )}
      </div>
      <Table
        rowKey={(_, i) => String(i)}
        columns={columns}
        dataSource={data.rows}
        loading={loading}
        pagination={data.preview_rows > 50 ? { pageSize: 50 } : false}
        scroll={{ x: 'max-content', y: 400 }}
        size="small"
      />
    </div>
  )
}
