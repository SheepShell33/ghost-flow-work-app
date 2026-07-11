import client from './client'
import type { PreviewData, PythonResult } from './tasks'

export const executeSql = (connectionId: number, sql: string, maxRows = 100) =>
  client.post<PreviewData>('/execute/sql', {
    connection_id: connectionId,
    sql,
    max_rows: maxRows,
  }).then((r) => r.data)

export const executePython = (code: string) =>
  client.post<PythonResult>('/execute/python', { code }).then((r) => r.data)
