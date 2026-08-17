# Dark / Light 主题切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留当前暗色主题作为 dark mode 的基础上，新增 light mode，并在顶部 Header 提供可随时切换的主题按钮；用户偏好持久化到 localStorage。

**Architecture:** 新增 `ThemeContext` 管理 `theme: 'dark' | 'light'` 状态，初始化时读取 localStorage，变化时同步 `<html data-theme>` 并回写 localStorage。`main.tsx` 根据 theme 动态为 Ant Design `ConfigProvider` 选择 `theme.darkAlgorithm` 或 `theme.defaultAlgorithm` 及对应 token。`index.css` 按 `[data-theme='dark']` / `[data-theme='light']` 作用域拆分 `--ghost-*` CSS 变量，让现有 `.ghost-*` 工具类与 Ant Design 覆盖自动适配两种主题。

**Tech Stack:** React 19, TypeScript, Ant Design 6, Vite, CSS 变量。

## Global Constraints

- 所有代码注释、文档、沟通使用中文。
- 使用 `import type` 进行 type-only imports（`tsconfig.app.json` 启用 `verbatimModuleSyntax`）。
- 不要为 antd 预设色组件添加 `!important` 覆盖；使用 `ConfigProvider` component tokens 或按 `[data-theme]` 局部覆盖。
- 主题默认值为 `'dark'`，保持现有视觉不变。
- localStorage key 固定为 `ghost-flow-theme`。
- Light 模式主色保持青色 `#00a3cc`，仅在浅色背景下保证对比度。

---

### Task 1: Create ThemeContext

**Files:**
- Create: `frontend/src/contexts/ThemeContext.tsx`
- Test manually via browser DevTools and localStorage panel.

**Interfaces:**
- Produces: `ThemeContextValue` with `theme: 'dark' | 'light'`, `toggleTheme(): void`, `setTheme(theme: Theme): void`
- Produces: `ThemeProvider` React component
- Produces: `useTheme()` hook that returns the context value

- [ ] **Step 1: Create `frontend/src/contexts/ThemeContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'ghost-flow-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (next: Theme) => {
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用')
  }
  return ctx
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && pnpm build`
Expected: passes (no new compile errors from this file).

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/contexts/ThemeContext.tsx
git commit -m "feat(theme): 新增 ThemeContext 管理 dark/light 状态与 localStorage 持久化"
```

---

### Task 2: Wire ThemeProvider into main.tsx and dynamic Ant Design theme

**Files:**
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `ThemeProvider`, `useTheme` from `frontend/src/contexts/ThemeContext.tsx`

- [ ] **Step 1: Modify `frontend/src/main.tsx`**

Wrap the app with `ThemeProvider` outside `BrowserRouter` so theme state is available everywhere. Create a `ThemedConfig` inner component that reads `useTheme()` and passes the correct algorithm/tokens to `ConfigProvider`.

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import { ThemeProvider, useTheme, type Theme } from './contexts/ThemeContext'
import './index.css'

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

function ThemedConfig() {
  const { theme: currentTheme } = useTheme()
  return (
    <ConfigProvider locale={zhCN} theme={getAntdTheme(currentTheme)}>
      <App />
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ThemedConfig />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm build`
Expected: passes.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/main.tsx
git commit -m "feat(theme): main.tsx 接入 ThemeProvider 并动态切换 Ant Design 算法"
```

---

### Task 3: Split index.css into dark and light variable sets

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `<html data-theme>` attribute set by `ThemeContext`
- Produces: `[data-theme='dark']` and `[data-theme='light']` CSS variable blocks

- [ ] **Step 1: Replace `:root` block with scoped theme blocks**

At the top of `frontend/src/index.css`, replace the existing `:root { ... }` block (lines 2-32) with:

```css
/* ===== Dark Mode（当前默认风格）===== */
[data-theme='dark'] {
  --ghost-bg: #07090d;
  --ghost-panel: #0c0f16;
  --ghost-inset: #11151f;
  --ghost-hover: #171c28;
  --ghost-panel-deep: rgba(8, 11, 16, 0.85);
  --ghost-sider-bg: #080b10;

  --ghost-primary: #00d4ff;
  --ghost-secondary: #7c3aed;
  --ghost-success: #4ade80;
  --ghost-error: #ff6b6b;
  --ghost-warning: #fbbf24;

  --ghost-text: #e6eaf2;
  --ghost-text-secondary: #8b94a7;
  --ghost-text-dim: #525b6e;

  --ghost-border: rgba(255, 255, 255, 0.07);
  --ghost-border-strong: rgba(255, 255, 255, 0.12);

  --ghost-radius: 10px;
  --ghost-radius-lg: 12px;
}

/* ===== Light Mode ===== */
[data-theme='light'] {
  --ghost-bg: #f8fafc;
  --ghost-panel: #ffffff;
  --ghost-inset: #f1f5f9;
  --ghost-hover: #e2e8f0;
  --ghost-panel-deep: rgba(255, 255, 255, 0.85);
  --ghost-sider-bg: #ffffff;

  --ghost-primary: #00a3cc;
  --ghost-secondary: #7c3aed;
  --ghost-success: #22c55e;
  --ghost-error: #ef4444;
  --ghost-warning: #f59e0b;

  --ghost-text: #1e293b;
  --ghost-text-secondary: #64748b;
  --ghost-text-dim: #94a3b8;

  --ghost-border: rgba(0, 0, 0, 0.08);
  --ghost-border-strong: rgba(0, 0, 0, 0.12);

  --ghost-radius: 10px;
  --ghost-radius-lg: 12px;
}
```

- [ ] **Step 2: Replace hard-coded dark values with variables**

Find and replace the following hard-coded values in `frontend/src/index.css`:

1. `.ghost-sider` background `#080b10` → `var(--ghost-sider-bg)`.
2. `.ghost-logo` background `#07090d` → `var(--ghost-bg)`.
3. `.ant-layout-sider` background `#080b10` → `var(--ghost-sider-bg)`.
4. `.ghost-content` blueprint grid: lower the grid line opacity in light mode by adding a scoped override:

```css
[data-theme='light'] .ghost-content {
  background-image:
    radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.12) 1px, transparent 0),
    linear-gradient(rgba(0, 163, 204, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 163, 204, 0.04) 1px, transparent 1px);
}
```

5. `.ghost-sider .ant-menu-item-selected` and `.ghost-sider .ant-menu-item:hover` use `rgba(0, 212, 255, ...)` which is fine because primary color stays cyan in both modes; no change needed.

6. `.ant-modal-content` background `rgba(12, 15, 22, 0.97)` → `var(--ghost-panel)`.

7. `.ant-btn-primary` gradient uses `var(--ghost-primary)` and `var(--ghost-secondary)` — already variable-based, no change.

8. `.ant-btn-default` background `var(--ghost-inset)` and color `var(--ghost-text)` — already variable-based, no change.

- [ ] **Step 3: Verify build**

Run: `cd frontend && pnpm build`
Expected: passes.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/index.css
git commit -m "feat(theme): 将 index.css 拆分为 dark/light 两套 CSS 变量并清理硬编码"
```

---

### Task 4: Add theme toggle button to HeaderExtras

**Files:**
- Modify: `frontend/src/components/HeaderExtras.tsx`

**Interfaces:**
- Consumes: `useTheme` from `frontend/src/contexts/ThemeContext.tsx`

- [ ] **Step 1: Read current `HeaderExtras.tsx`**

Use `Read` tool to inspect the current content before editing.

- [ ] **Step 2: Add theme toggle button**

Import `BulbOutlined`, `MoonOutlined`, and `Tooltip` from antd. Use `useTheme()` to get current theme and `toggleTheme`. Insert a button before other header extras.

```tsx
import { Button, Tooltip } from 'antd'
import { BulbOutlined, MoonOutlined } from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

// inside component:
const { theme, toggleTheme } = useTheme()
const isDark = theme === 'dark'

// in JSX, inside the <span className="ghost-header-extra"> ... </span>:
<Tooltip title={isDark ? '切换至亮色模式' : '切换至暗色模式'}>
  <Button
    type="text"
    icon={isDark ? <BulbOutlined /> : <MoonOutlined />}
    onClick={toggleTheme}
    style={{ color: 'var(--ghost-text-secondary)' }}
  />
</Tooltip>
```

Make sure the icon import path matches the project convention (`@ant-design/icons`).

- [ ] **Step 3: Verify build**

Run: `cd frontend && pnpm build`
Expected: passes.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/components/HeaderExtras.tsx
git commit -m "feat(theme): 在 HeaderExtras 添加 dark/light 切换按钮"
```

---

### Task 5: Manual testing and visual regression check

**Files:**
- No file changes; manual verification.

- [ ] **Step 1: Start dev server**

```powershell
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

In a second PowerShell:

```powershell
cd frontend
pnpm dev
```

- [ ] **Step 2: Verify default dark mode**

Open http://localhost:5173. Confirm the UI looks identical to before (dark mode is default).

- [ ] **Step 3: Toggle to light mode**

Click the moon/bulb icon in the top-right header. Confirm:
- Background becomes light (`#f8fafc`).
- Text becomes dark (`#1e293b`).
- Tables, forms, modals, buttons all readable.
- Sidebar background is light.

- [ ] **Step 4: Verify persistence**

Open browser DevTools → Application → Local Storage. Confirm `ghost-flow-theme` is `'light'`.
Refresh the page. Confirm it stays in light mode.
Click toggle again. Confirm `ghost-flow-theme` becomes `'dark'` and UI returns to dark.

- [ ] **Step 5: Run production build**

```powershell
cd frontend
pnpm build
```

Expected: no TypeScript or Vite build errors.

- [ ] **Step 6: Commit any fixes if needed**

If no fixes are needed, no additional commit. If fixes are needed, commit them with descriptive messages.

---

## Self-Review

### Spec coverage

- Dark mode preserved → Task 3 keeps `[data-theme='dark']` identical to current `:root`.
- Light mode added → Task 3 adds `[data-theme='light']` and Task 2 switches Ant Design algorithm.
- Toggle in app → Task 4 adds HeaderExtras button.
- Persistence → Task 1 uses `localStorage` with `ghost-flow-theme`.

### Placeholder scan

No TBD/TODO. All code blocks contain concrete implementation. File paths are exact.

### Type consistency

- `Theme` type is `'dark' | 'light'` everywhere.
- `useTheme()` returns `ThemeContextValue` consistently.
- `getAntdTheme(current: Theme)` matches the `Theme` union.

### Dependency order

Task 1 must be completed before Task 2 and Task 4 because they import from `ThemeContext`. Task 3 is independent of React state and can be done after Task 2. Task 4 depends on Task 1. Task 5 is manual verification after all code tasks.
