# Ghost Flow Work App — 暗黑霓虹 UI 设计规范

**日期：** 2026-07-17  
**状态：** 已批准  
**风格：** 全站暗黑 + 霓虹光效（Dark Cyber Neon）  
**动画策略：** 纯 CSS，GPU 加速（`transform` / `opacity`），尊重 `prefers-reduced-motion`

---

## 1. 设计目标

将现有浅色 SaaS 风格前端升级为全站暗黑科技风，提升视觉冲击力与沉浸感，同时加入细腻、不损耗性能的微动画。目标是在不引入新依赖、不改后端接口的前提下，完成视觉与动效升级。

## 2. 设计原则

- **性能优先**：动画仅使用 `transform`、`opacity`、`box-shadow` 等 GPU 可合成属性；不使用 JS 动画库。
- **可访问性**：所有动画包在 `@media (prefers-reduced-motion: no-preference)` 中。
- **低侵入**：不修改 Ant Design 6 主题 token，通过 CSS 变量和类覆盖实现。
- **一致性**：圆角、间距、阴影、动效时长全站统一。
- **中文保留**：所有界面文案继续使用中文。

## 3. 全局设计 Tokens

### 3.1 颜色

| 用途 | 值 | 说明 |
|---|---|---|
| 页面背景 | `#0a0e14` | 近黑蓝底色 |
| 卡片/面板 | `rgba(15, 20, 30, 0.7)` | 半透明玻璃感 |
| Header/Sider | `rgba(10, 14, 20, 0.85)` | 更深一层，带 `backdrop-filter: blur(12px)` |
| 主强调色 | `#00d4ff` | 霓虹青蓝 |
| 辅助强调色 | `#7c3aed` | 霓虹紫 |
| 成功 | `#4ade80` | 保留语义 |
| 错误 | `#ff6b6b` | 保留语义 |
| 警告 | `#fbbf24` | 保留语义 |
| 主文字 | `#e2e8f0` | 高对比 |
| 次要文字 | `#94a3b8` | 中等对比 |
| 禁用/边框 | `#475569` | 低对比 |

### 3.2 形状与阴影

- **圆角**：卡片 14px，按钮/标签 6px，弹窗 12px。
- **卡片阴影**：`box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4)`；hover 时附加 `0 0 24px rgba(0, 212, 255, 0.08)`。
- **边框**：卡片 1px `rgba(148, 163, 184, 0.1)`；hover 时变为 `rgba(0, 212, 255, 0.3)`。

### 3.3 字体与数字

- 字体栈不变，数字使用 `font-variant-numeric: tabular-nums` 保证表格与统计数字对齐。
- 代码/Cron/配置摘要使用等宽字体 `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`。

## 4. 布局设计

### 4.1 侧边栏 `.ghost-sider`

- 背景：深黑蓝渐变 `#0a0e14 → #0f172a`。
- 选中项：左侧 3px `#00d4ff` 竖线 + `rgba(0, 212, 255, 0.15)` 背景 + 微弱外发光。
- Hover：背景 `rgba(255, 255, 255, 0.06)`，文字/图标 `translateX(4px)`。

### 4.2 顶部 Header `.ghost-header`

- 背景：`rgba(10, 14, 20, 0.85)` + `backdrop-filter: blur(12px)`。
- 底部：1px `rgba(0, 212, 255, 0.2)` 细线。
- 标题颜色：`#e2e8f0`；右侧版本信息颜色：`#94a3b8`。

### 4.3 内容区 `.ghost-content`

- 背景：`#0a0e14` 基础上叠加极淡网格 `radial-gradient(circle at 1px 1px, rgba(148,163,184,0.05) 1px, transparent 0)`，网格大小 32px。
- 卡片悬浮其上，形成层次。

### 4.4 页面标题 `.ghost-page-header`

- 标题左侧增加 4px 宽、24px 高的渐变竖线（`#00d4ff → #7c3aed`）。

## 5. 组件级样式

### 5.1 统一卡片 `.ghost-card`

- `background: rgba(15, 20, 30, 0.7)`
- `backdrop-filter: blur(16px)`
- `border: 1px solid rgba(148, 163, 184, 0.1)`
- `border-radius: 14px`
- `transition: border-color 0.3s ease, box-shadow 0.3s ease`

### 5.2 统计卡 `.ghost-stat-card`

- 在 `.ghost-card` 基础上增加顶部 3px 渐变条：
  - 连接：`#00d4ff → #38bdf8`
  - 任务：`#7c3aed → #a855f7`
  - 成功：`#4ade80 → #22c55e`
  - 失败：`#ff6b6b → #ef4444`
- 图标圆形底：对应颜色 `background: ${color}20`，外发光 `box-shadow: 0 0 16px ${color}30`。
- 数值：`font-variant-numeric: tabular-nums`。

### 5.3 表格

- 表头背景：`rgba(15, 23, 42, 0.9)`，文字 `#94a3b8`。
- 行背景：`transparent`；hover 时 `rgba(0, 212, 255, 0.04)`。
- 边框：`rgba(148, 163, 184, 0.08)`。
- 操作列图标按钮 hover：圆形背景 `rgba(0, 212, 255, 0.1)`。

### 5.4 按钮与标签

- 主按钮：渐变背景 `linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)`，无边框，hover 时亮度提升 10% + 阴影增强。
- 状态 Tag：半透明背景 `${color}15`，边框 `${color}40`，文字 `${color}`。

### 5.5 弹窗

- 背景：`rgba(15, 20, 30, 0.95)` + `backdrop-filter: blur(20px)`。
- 头部底部：1px `rgba(0, 212, 255, 0.15)`。
- 遮罩：`rgba(0, 0, 0, 0.7)` + `backdrop-filter: blur(4px)`。

## 6. 动画系统

全部动画使用 CSS `@keyframes` 或 `transition`，包在 `@media (prefers-reduced-motion: no-preference)` 中。

| 动画 | 属性 | 时长 | 说明 |
|---|---|---|---|
| 页面入场 | `opacity`, `translateY` | 300ms `ease-out` | 路由切换时内容区淡入上移 |
| 卡片入场 | `opacity`, `translateY` | 400ms `ease-out`，stagger 60ms | 仪表盘/列表卡片依次入场 |
| 悬浮反馈 | `translateY(-2px)`, `box-shadow` | 200ms | 卡片、按钮 hover |
| 状态脉冲 | `box-shadow` | 2s 无限 | 运行中 Badge / 状态点呼吸 |
| 数字回弹 | `scale` | 200ms | 统计卡数值变化时 `1.1 → 1` |
| 加载淡入 | `opacity` | 300ms | 骨架屏/Spin 容器 |

## 7. 页面专属增强

### 7.1 Dashboard

- 统计卡图标增加环形光效。
- 最近运行记录行 hover 时左侧显示 2px 状态色竖线。

### 7.2 Connections

- 类型 Tag 改为“图标 + 文字”组合。
- 配置摘要使用等宽字体。

### 7.3 Tasks

- 调度开关启用时，开关左侧显示绿色呼吸点。
- 执行结果弹窗顶部状态条使用对应语义色渐变。

### 7.4 Schedules

- 下次执行时间使用等宽字体 + 霓虹蓝高亮。
- 引擎状态卡背景加入极淡的 `linear-gradient(135deg, rgba(0,212,255,0.03), rgba(124,58,237,0.03))`。

### 7.5 History

- 耗时列按阈值变色：<1s `#4ade80`，1–10s `#fbbf24`，>10s `#ff6b6b`。
- 展开详情区域带 `fadeIn` 动画。

## 8. 实现约束

- 修改范围：`frontend/src/index.css` 与各页面 `*.tsx` 的 className / style 微调。
- 不新增 npm 依赖，不改后端 API。
- 所有文案保持中文。
- 完成验收：`pnpm build` 通过，`pnpm lint` 无新增错误，浏览器走查确认动画流畅、无布局抖动。

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Ant Design 默认浅色样式覆盖不彻底 | 使用 `!important` 仅用于 AntD 组件内部覆盖，项目自定义类避免使用 |
| `backdrop-filter` 在低性能设备上卡顿 | 提供降级：不支持的浏览器自动退化为半透明纯色背景 |
| 动画过多导致低端设备掉帧 | 所有动画仅动合成属性；卡片入场 stagger 上限 8 个 |
