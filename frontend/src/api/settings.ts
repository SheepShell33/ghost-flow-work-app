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

export interface InstalledPackage {
  name: string
  version: string
}

export interface InstalledPackagesResult {
  packages: InstalledPackage[]
  error: string | null
}

export const getSettings = () => client.get<Settings>('/settings').then(r => r.data)
export const updateSettings = (data: SettingsUpdate) =>
  client.put<Settings>('/settings', data).then(r => r.data)
export const testSettings = (data: SettingsUpdate) =>
  client.post<SettingsTestResult>('/settings/test', data).then(r => r.data)
export const getInstalledPackages = () =>
  client.get<InstalledPackagesResult>('/settings/packages').then(r => r.data)
