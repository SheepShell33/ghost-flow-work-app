import client from './client'

export interface TaskRunItem {
  id: number
  task_id: number
  status: string
  error_message: string | null
  result_preview: string | null
  row_count: number | null
  started_at: string
  finished_at: string | null
}

export const listTaskRuns = (taskId?: number) =>
  client.get<TaskRunItem[]>('/task-runs', { params: taskId ? { task_id: taskId } : {} }).then((r) => r.data)
