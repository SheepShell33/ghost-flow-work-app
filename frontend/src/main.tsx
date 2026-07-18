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
          },
          components: {
            Tag: {
              defaultBg: 'rgba(148, 163, 184, 0.1)',
              defaultColor: '#94a3b8',
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
