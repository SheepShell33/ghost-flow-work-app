import client from './client'

export interface Settings {
  python_executable_path: string | null
  python_ok: boolean
  uv_ok: boolean
}

export interface SettingsUpdate {
  python_executable_path?: string | null
}

export interface SettingsTestResult {
  python_ok: boolean
  python_version: string | null
  uv_ok: boolean
  uv_version: string | null
  message: string
}

export const getSettings = () => client.get<Settings>('/settings').then(r => r.data)
export const updateSettings = (data: SettingsUpdate) =>
  client.put<Settings>('/settings', data).then(r => r.data)
export const testSettings = (data: SettingsUpdate) =>
  client.post<SettingsTestResult>('/settings/test', data).then(r => r.data)
