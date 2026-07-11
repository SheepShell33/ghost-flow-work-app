import client from './client'

export interface ScheduleItem {
  id: number
  name: string
  type: string
  schedule_config: string
  enabled: boolean
  created_at: string
}

export interface SchedulerStatus {
  running: boolean
  jobs: { id: string; name: string; next_run_time: string | null }[]
}

export const listSchedules = () =>
  client.get<ScheduleItem[]>('/schedules').then((r) => r.data)

export const getSchedulerStatus = () =>
  client.get<SchedulerStatus>('/schedules/status').then((r) => r.data)
