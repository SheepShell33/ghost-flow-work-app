# Python 环境路径设置设计文档

## 背景

用户希望在 Ghost Flow Work App 中指定一个外部 Python 解释器路径，工具使用 uv 来管理该环境中的第三方库；当 Python 脚本引入环境内不存在的包时，先自动安装依赖，再执行脚本。

## 目标

- 提供一个持久化的全局设置项：Python 解释器路径。
- 所有 Python 任务（ad-hoc 执行、任务运行）均使用配置的解释器执行。
- 自动依赖安装使用 uv，目标解释器为配置的解释器。
- 开发模式与 Electron 打包版行为一致：打包版自带 `uv.exe`。

## 非目标

- 不实现每个任务单独指定 Python 环境（全局设置即可）。
- 不实现 uv 虚拟环境的自动创建（用户已提供解释器路径）。
- 不替换后端自身的 Python 运行时（后端服务仍用当前解释器运行）。

## 数据模型

新增 `Setting` 表，使用 SQLAlchemy 2.0 映射风格，与现有模型一致。

```python
class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    python_executable_path: Mapped[str | None] = mapped_column(
        String(1024), nullable=True,
        comment="用户指定的 Python 解释器绝对路径"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- 固定使用 `id=1` 的单行记录。
- 未配置时 `python_executable_path` 为 `None`。

## 后端 API

路由前缀：`/api/settings`

### GET /api/settings

返回当前设置及可用性状态。

响应体：

```json
{
  "python_executable_path": "C:\\Python312\\python.exe",
  "python_ok": true,
  "uv_ok": true
}
```

- `python_ok`：当前配置的解释器能否运行 `--version`；未配置时为 `false`。
- `uv_ok`：当前能否找到可用的 uv 可执行文件。

### PUT /api/settings

保存设置。

请求体：

```json
{
  "python_executable_path": "C:\\Python312\\python.exe"
}
```

- 字段可选；传 `null` 或空字符串表示清除配置。
- 保存后返回同 GET 的响应体。

### POST /api/settings/test

不保存，仅校验给定路径。

请求体：

```json
{
  "python_executable_path": "C:\\Python312\\python.exe"
}
```

响应体：

```json
{
  "python_ok": true,
  "python_version": "Python 3.12.0",
  "uv_ok": true,
  "uv_version": "uv 0.4.10",
  "message": "环境检查通过"
}
```

- 校验失败时 `python_ok` / `uv_ok` 为 `false`，`message` 给出中文原因。

## 服务层

新增 `backend/app/services/python_env.py`，职责：

1. `get_configured_python()`：读取 `Setting` 表，返回配置的解释器路径；未配置时返回 `None`。
2. `resolve_uv_executable()`：返回 uv 可执行文件路径。
   - 开发模式：`shutil.which("uv")`。
   - PyInstaller 打包版：优先 `sys._MEIPASS/../../uv.exe`（即 Electron `resources/uv.exe`），其次 PATH。
3. `validate_python_env(path)`：运行 `[path, "--version"]` 与 `[uv, "--version"]`，返回测试结构体。

## 执行流程改造

### deps_installer.py

- 调用 `get_configured_python()` 获取目标解释器。
- 未配置时：
  - 开发模式：回退到 `sys.executable`。
  - PyInstaller 打包版：抛出 `RuntimeError`，提示用户先配置 Python 环境路径。
- 检查包是否已安装时，向目标解释器查询：

```bash
<python> -c "import importlib.metadata; importlib.metadata.distribution('<pkg>')"
```

- 安装依赖：

```bash
<uv> pip install --python <python> <pkg>
```

### python_executor.py

- 使用配置的解释器执行脚本：

```bash
<python> <script_path>
```

- 未配置时开发模式回退到 `sys.executable`。
- PyInstaller 打包版未配置时返回错误结果（不再查找系统 Python）。

## 前端

### 菜单与路由

- 在 `AppLayout.tsx` 左侧菜单新增“系统设置”项，路径 `/settings`。
- 路由注册 `/settings` → `pages/Settings/index.tsx`。

### 设置页面

- Python 解释器路径输入框（带文件选择按钮，仅选 `.exe`）。
- “测试环境”按钮：调用 `POST /api/settings/test`。
- “保存”按钮：调用 `PUT /api/settings`。
- 页面加载时调用 `GET /api/settings` 回显。

### API 客户端

新增 `frontend/src/api/settings.ts`：

- `getSettings()`
- `updateSettings(data)`
- `testSettings(data)`

## 构建脚本

- `scripts/build-desktop.ps1` 在打包前下载或复制 `uv.exe` 到 `electron/resources/uv.exe`。
- `electron/package.json` 的 `build.files` 或 `extraResources` 确保 `uv.exe` 被打包进 `resources/`。
- 开发模式下不需要复制，直接依赖 PATH 中的 uv。

## 测试

后端新增 `backend/tests/test_settings.py`：

- 设置 CRUD。
- `validate_python_env` 对有效/无效路径的返回。
- `resolve_uv_executable` 在打包模式下的资源目录查找逻辑。

后端补充 `backend/tests/test_deps_installer.py`：

- 使用配置的解释器安装依赖。
- 未配置时在打包版抛出明确错误。

后端补充 `backend/tests/test_python_executor.py`：

- 使用配置的解释器执行脚本。

## 降级与错误处理

- 未配置 Python 路径：
  - 开发模式：使用 `sys.executable`（保持现有行为）。
  - 打包版：直接返回中文错误，提示用户到“系统设置”配置解释器路径。
- uv 不可用：
  - 设置页测试接口返回 `uv_ok: false`。
  - 安装依赖时抛出 `RuntimeError`，提示检查 uv 是否已打包或是否在 PATH 中。
- 配置的解释器无效：
  - 保存时允许保存，但页面显示测试失败状态；执行 Python 任务时再次校验并给出清晰错误。

## 影响范围

- 后端：`app/models/setting.py`、`app/schemas/setting.py`、`app/api/endpoints/settings.py`、`app/services/python_env.py`、`app/services/deps_installer.py`、`app/services/executor/python_executor.py`。
- 前端：`src/components/AppLayout.tsx`、`src/pages/Settings/index.tsx`、`src/api/settings.ts`。
- 构建：`scripts/build-desktop.ps1`、`electron/package.json`。
- 数据库：新增 `settings` 表，需 Alembic 迁移。
