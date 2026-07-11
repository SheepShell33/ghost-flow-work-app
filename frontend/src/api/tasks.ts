import client from './client'

export interface TaskItem {
  id: number
  name: string
  type: 'sql' | 'python'
  content: string
  connection_id: number | null
  output_path: string | null
  schedule_config: string | null
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

export const listTasks = () =>
  client.get<TaskItem[]>('/tasks').then((r) => r.data)

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

export const previewTask = (id: number) =>
  client.get<PreviewData>(`/execute/tasks/${id}/preview`).then((r) => r.data)

export const exportTaskCsv = (id: number) =>
  client.post<{ message: string; file_path: string; row_count: number }>(
    `/execute/tasks/${id}/export`,
  ).then((r) => r.data)

export const toggleTask = (id: number) =>
  client.post<{ id: number; enabled: boolean }>(`/tasks/${id}/toggle`).then((r) => r.data)
