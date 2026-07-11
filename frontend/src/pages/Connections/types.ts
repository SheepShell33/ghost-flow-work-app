export type ConnectionType = 'sqlite' | 'redshift'
export type AuthType = 'iam' | 'okta'

export interface SQLiteConfig {
  file_path: string
}

export interface RedshiftConfig {
  host: string
  port: number
  database: string
  user: string
  auth_type: AuthType
  password?: string
  aws_access_key_id?: string
  aws_secret_access_key?: string
  region?: string
  cluster_identifier?: string
  idp_tenant?: string
  client_id?: string
  plugin_name?: string
}

export type ConnectionConfig = SQLiteConfig | RedshiftConfig
