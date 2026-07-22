import client from './client'

export interface TaskRunItem {
  id: number
  task_id: number
  status: string
  error_message: string | null
  result_preview: string | null
  row_count: number | null
  attempt: number
  parent_run_id: number | null
  started_at: string
  finished_at: string | null
}

export const listTaskRuns = (params?: { task_id?: number; page?: number; page_size?: number }) =>
  client.get<TaskRunItem[]>('/task-runs', { params }).then((r) => r.data)

export const cancelTaskRun = (runId: number) =>
  client.post(`/execute/runs/${runId}/cancel`).then((r) => r.data)
