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
