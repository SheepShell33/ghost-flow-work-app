import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from '../App'
import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../contexts/theme.types'

function getAntdTheme(current: Theme) {
  const isDark = current === 'dark'
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: isDark
      ? {
          colorPrimary: '#00d4ff',
          colorBgLayout: '#07090d',
          colorBgContainer: '#0c0f16',
          colorBgElevated: '#11151f',
          colorBorder: 'rgba(255, 255, 255, 0.12)',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.07)',
          colorText: '#e6eaf2',
          colorTextSecondary: '#8b94a7',
          borderRadius: 10,
        }
      : {
          colorPrimary: '#00a3cc',
          colorBgLayout: '#f8fafc',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: 'rgba(0, 0, 0, 0.08)',
          colorBorderSecondary: 'rgba(0, 0, 0, 0.06)',
          colorText: '#1e293b',
          colorTextSecondary: '#64748b',
          borderRadius: 10,
        },
    components: {
      Tag: {
        defaultBg: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 163, 204, 0.1)',
        defaultColor: isDark ? '#8b94a7' : '#475569',
      },
    },
  }
}

export function ThemedConfig() {
  const { theme: currentTheme } = useTheme()
  return (
    <ConfigProvider locale={zhCN} theme={getAntdTheme(currentTheme)}>
      <App />
    </ConfigProvider>
  )
}
