import { message } from 'antd'
import client from './client'

export interface TaskItem {
  id: number
  name: string
  type: 'sql' | 'python'
  content: string
  connection_id: number | null
  output_path: string | null
  schedule_config: string | null
  prerequisite_task_id: number | null
  tags: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface TaskFormData {
  name: string
  type: 'sql' | 'python'
  content: string
  connection_id?: number | null
  output_path?: string | null
  schedule_config?: string | null
  prerequisite_task_id?: number | null
  tags?: string | null
  enabled?: boolean
}

export interface RunResult {
  run_id: number
  status: string
  error_message: string | null
  result_preview: PreviewData | PythonResult | null
  row_count: number | null
}

export interface PreviewData {
  columns: string[]
  rows: Record<string, unknown>[]
  total_rows: number
  preview_rows: number
}

export interface PythonResult {
  exit_code: number
  stdout: string
  stderr: string
  success: boolean
}

export const listTasks = (params?: { q?: string; tag?: string }) =>
  client.get<TaskItem[]>('/tasks', { params }).then((r) => r.data)

export const getTask = (id: number) =>
  client.get<TaskItem>(`/tasks/${id}`).then((r) => r.data)

export const createTask = (data: TaskFormData) =>
  client.post<TaskItem>('/tasks', data).then((r) => r.data)

export const updateTask = (id: number, data: Partial<TaskFormData>) =>
  client.put<TaskItem>(`/tasks/${id}`, data).then((r) => r.data)

export const deleteTask = (id: number) =>
  client.delete(`/tasks/${id}`).then((r) => r.data)

export const runTask = (id: number) =>
  client.post<RunResult>(`/execute/tasks/${id}/run`).then((r) => r.data)

export const testTask = (id: number) =>
  client.post<PreviewData | PythonResult>(`/execute/tasks/${id}/test`).then((r) => r.data)

export const previewTask = (id: number) =>
  client.get<PreviewData>(`/execute/tasks/${id}/preview`).then((r) => r.data)

export const exportTaskCsv = (id: number) =>
  client.post<{ message: string; file_path: string; row_count: number }>(
    `/execute/tasks/${id}/export`,
  ).then((r) => r.data)

export const toggleTask = (id: number) =>
  client.post<{ id: number; enabled: boolean }>(`/tasks/${id}/toggle`).then((r) => r.data)

export const downloadTaskCsv = (id: number) =>
  client.get(`/execute/tasks/${id}/download`, { responseType: 'blob' }).then((r) => {
    const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `task_${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('CSV 已下载')
  })

export const uploadTaskFile = (
  file: File,
  name: string,
  extras?: { connection_id?: number; output_path?: string; prerequisite_task_id?: number },
) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('name', name)
  if (extras?.connection_id) fd.append('connection_id', String(extras.connection_id))
  if (extras?.output_path) fd.append('output_path', extras.output_path)
  if (extras?.prerequisite_task_id) fd.append('prerequisite_task_id', String(extras.prerequisite_task_id))
  return client.post<TaskItem>('/tasks/upload', fd).then((r) => r.data)
}
