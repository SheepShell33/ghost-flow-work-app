import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#00d4ff',
            colorBgLayout: '#07090d',
            colorBgContainer: '#0c0f16',
            colorBgElevated: '#11151f',
            colorBorder: 'rgba(255, 255, 255, 0.12)',
            colorBorderSecondary: 'rgba(255, 255, 255, 0.07)',
            colorText: '#e6eaf2',
            colorTextSecondary: '#8b94a7',
            borderRadius: 10,
          },
          components: {
            Tag: {
              defaultBg: 'rgba(148, 163, 184, 0.1)',
              defaultColor: '#8b94a7',
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
