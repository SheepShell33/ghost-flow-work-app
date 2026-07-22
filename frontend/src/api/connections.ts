import client from './client'

export interface ConnectionItem {
  id: number
  name: string
  type: 'sqlite' | 'redshift'
  config: string
  created_at: string
  updated_at: string
}

export interface ConnectionFormData {
  name: string
  type: 'sqlite' | 'redshift'
  config: string
}

export interface ConnectionTestResult {
  success: boolean
  message: string
}

export const listConnections = () =>
  client.get<ConnectionItem[]>('/connections').then((r) => r.data)

export const getConnection = (id: number) =>
  client.get<ConnectionItem>(`/connections/${id}`).then((r) => r.data)

export const createConnection = (data: ConnectionFormData) =>
  client.post<ConnectionItem>('/connections', data).then((r) => r.data)

export const updateConnection = (id: number, data: Partial<ConnectionFormData>) =>
  client.put<ConnectionItem>(`/connections/${id}`, data).then((r) => r.data)

export const deleteConnection = (id: number) =>
  client.delete(`/connections/${id}`).then((r) => r.data)

// 测试连接（不落库）；SSO 需等待用户在浏览器中登录，超时放宽到 120 秒
export const testConnection = (data: { type: string; config: string }) =>
  client.post<ConnectionTestResult>('/connections/test', data, { timeout: 120000 }).then((r) => r.data)
