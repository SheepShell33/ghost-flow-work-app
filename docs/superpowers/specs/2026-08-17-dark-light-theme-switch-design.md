# Dark / Light 主题切换设计

## 背景

当前 Ghost Flow Work App 前端采用统一的暗色霓虹风格（`theme.darkAlgorithm` + `--ghost-*` CSS 变量）。用户希望在保留现有暗色风格作为 dark mode 的基础上，增加 light mode，并允许用户在应用内随时切换。

## 目标

- 保留当前视觉作为 **Dark Mode**。
- 新增 **Light Mode**，配色明亮、可读性好，同时保持品牌主色（青色）。
- 提供可随时访问的主题切换入口。
- 用户偏好持久化到 `localStorage`，刷新或重启后保持。

## 设计决策

### 方案选型

采用 **React Context + Ant Design 算法切换 + CSS 变量** 方案：

- `ThemeContext` 统一管理 `theme: 'dark' | 'light'`。
- `main.tsx` 根据 theme 动态选择 `theme.darkAlgorithm` 或 `theme.defaultAlgorithm`，并传入对应 token/components。
- `index.css` 使用 `[data-theme='dark']` / `[data-theme='light']` 作用域分别定义 `--ghost-*` 变量。
- 切换入口放在顶部 `HeaderExtras`。

该方案兼顾 Ant Design 组件原生主题一致性与自定义样式的完整覆盖。

### 状态管理

新建 `frontend/src/contexts/ThemeContext.tsx`：

```ts
type Theme = 'dark' | 'light'
interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}
```

- 初始化时读取 `localStorage.getItem('ghost-flow-theme')`。
- 若未设置，默认 `'dark'`（保持现有风格）。
- `setTheme` / `toggleTheme` 更新 state 并回写 `localStorage`。
- 通过 `useEffect` 在 theme 变化时同步 `<html>` 的 `data-theme` 属性，供 CSS 变量选择器使用。

### Ant Design 主题配置

`main.tsx` 中：

- Dark：`algorithm: theme.darkAlgorithm`，使用当前已有的 token 值。
- Light：`algorithm: theme.defaultAlgorithm`，token 值对应 light 配色：
  - `colorBgLayout`: `#f8fafc`
  - `colorBgContainer`: `#ffffff`
  - `colorBgElevated`: `#ffffff`
  - `colorBorder`: `rgba(0, 0, 0, 0.08)`
  - `colorText`: `#1e293b`
  - `colorTextSecondary`: `#64748b`
  - `colorPrimary`: `#00a3cc`（在浅色背景下保持对比度，仍偏青色）
  - `borderRadius`: 10（保持一致）

### 自定义 CSS 变量

`index.css` 重构为：

```css
[data-theme='dark'] {
  --ghost-bg: #07090d;
  --ghost-panel: #0c0f16;
  /* ... 现有暗色变量 ... */
}

[data-theme='light'] {
  --ghost-bg: #f8fafc;
  --ghost-panel: #ffffff;
  --ghost-inset: #f1f5f9;
  --ghost-hover: #e2e8f0;
  --ghost-panel-deep: rgba(255, 255, 255, 0.85);

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

现有 `.ghost-*` 工具类与 Ant Design 覆盖均依赖这些变量，切换时自动生效。

特别处理：

- `.ghost-content` 的蓝图网格背景在 light 模式下降低透明度或改为更淡的网格点，避免刺眼。
- `.ant-layout-sider` 当前硬编码 `#080b10`，改为使用变量 `--ghost-sider-bg`，并在 light 下设为 `#ffffff` 或 `#f8fafc`。
- `.ghost-sider .ant-menu-item-selected` 等覆盖项保持青色高亮，但背景透明度降低。

### 切换入口

在 `frontend/src/components/HeaderExtras.tsx` 中添加图标按钮：

- dark 模式下显示 `BulbOutlined`（提示可切换为 light）。
- light 模式下显示 `MoonOutlined`（提示可切换为 dark）。
- 点击调用 `toggleTheme()`。
- 使用 `Tooltip` 显示 "切换至亮色模式" / "切换至暗色模式"。

### 文件清单

| 文件 | 改动 |
|---|---|
| `frontend/src/contexts/ThemeContext.tsx` | 新建 ThemeContext、Provider、hook |
| `frontend/src/main.tsx` | 引入 ThemeProvider；动态 algorithm/token；设置 data-theme |
| `frontend/src/index.css` | 拆分为 `[data-theme='dark']` / `[data-theme='light']` 两套变量；清理硬编码暗色值 |
| `frontend/src/components/HeaderExtras.tsx` | 添加主题切换按钮 |
| `frontend/src/components/AppLayout.tsx` | 如有需要，调整 Sider 背景为变量 |

## 测试策略

1. 切换按钮点击后，Header 图标应变化。
2. `localStorage` 中 `ghost-flow-theme` 应同步更新。
3. 刷新页面后应保持上次选择的主题。
4. Light 模式下各页面文字可读、表格/表单/弹窗样式正常。
5. Dark 模式保持与当前一致。
6. 运行 `cd frontend && pnpm build` 无 TypeScript / lint 错误。

## 风险与注意事项

- `index.css` 中存在大量 `!important` 覆盖 Ant Design 组件。Light 模式下需确保这些覆盖仍符合预期，必要时在 CSS 中按 `[data-theme='light']` 局部覆盖。
- Ant Design 的 `theme.defaultAlgorithm` 与自定义 CSS 变量需同时切换，避免出现 antd 组件为 light 而自定义卡片仍为 dark 的半成品状态。
- 保持主色在不同模式下都具备足够对比度。
