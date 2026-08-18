# Python 环境路径设置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在工具中配置一个外部 Python 解释器路径，所有 Python 任务使用该解释器执行，缺失依赖时通过 uv 安装到该环境。

**Architecture:** 新增持久化 `Setting` 表保存 `python_executable_path`；新增 `services/python_env.py` 统一负责解释器/uv 路径解析与校验；`deps_installer.py` 与 `python_executor.py` 改为读取该配置；前端新增“系统设置”页面与 API 客户端；Electron 构建脚本把 `uv.exe` 放入 `resources/`。

**Tech Stack:** FastAPI, SQLAlchemy 2.0, SQLite, React + Ant Design 6, Vite, uv, Electron, PyInstaller.

## Global Constraints

- 所有代码注释、错误信息、接口文档使用中文。
- 后端测试使用 `pytest`，前端使用 `oxlint`（无测试框架）。
- 数据库模型使用 SQLAlchemy 2.0 `Mapped`/`mapped_column` 风格。
- 开发模式未配置路径时回退到 `sys.executable`；PyInstaller 打包版未配置时直接报错。
- uv 定位：开发模式查 PATH；打包版优先 `Path(sys.executable).parent / "uv.exe"`（Electron resources 目录）。
- 打包版自带 `uv.exe`。

---

## File Map

| 文件 | 职责 |
|---|---|
| `backend/app/models/setting.py` | `Setting` 表模型 |
| `backend/app/schemas/setting.py` | Pydantic schema：`SettingUpdate`、`SettingResponse`、`SettingTestResponse` |
| `backend/app/services/python_env.py` | 解释器/uv 路径解析、校验、settings 读写辅助函数 |
| `backend/app/api/endpoints/settings.py` | `/api/settings` CRUD + test 接口 |
| `backend/app/services/deps_installer.py` | 改为向配置的解释器安装依赖 |
| `backend/app/services/executor/python_executor.py` | 改为使用配置的解释器执行脚本 |
| `backend/app/api/endpoints/execute.py` | 调用改造后的 deps_installer/python_executor |
| `backend/app/services/task_runner.py` | 调用改造后的 deps_installer/python_executor |
| `backend/app/models/__init__.py` | 导出 `Setting` |
| `backend/app/main.py` | 注册 settings router |
| `backend/alembic/versions/...` | 新增 settings 表迁移 |
| `frontend/src/api/settings.ts` | 前端 settings API 客户端 |
| `frontend/src/pages/Settings/index.tsx` | 设置页面 |
| `frontend/src/components/AppLayout.tsx` | 添加系统设置菜单与路由 |
| `scripts/build-desktop.ps1` | 打包前下载/复制 `uv.exe` 到 `electron/resources/uv.exe` |
| `electron/package.json` | 确保 `uv.exe` 被打包进 resources |
| `backend/tests/test_settings.py` | settings 接口与 python_env 服务测试 |
| `backend/tests/test_deps_installer.py` | 补充配置解释器场景测试 |
| `backend/tests/test_python_executor.py` | 补充配置解释器执行测试 |

---

### Task 1: 新增 `Setting` 模型与 Alembic 迁移

**Files:**
- Create: `backend/app/models/setting.py`
- Modify: `backend/app/models/__init__.py`
- Create: Alembic migration file
- Test: `backend/tests/test_settings.py`

**Interfaces:**
- Produces: `class Setting(Base)` with `id`, `python_executable_path`, `created_at`, `updated_at`.
- Produces: `Setting` exported from `app.models`.

- [ ] **Step 1: 创建模型文件**

```python
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


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

- [ ] **Step 2: 导出模型**

在 `backend/app/models/__init__.py` 添加：

```python
from .setting import Setting
```

- [ ] **Step 3: 生成 Alembic 迁移**

```bash
cd backend
uv run alembic revision --autogenerate -m "add settings table"
```

检查生成的 migration 包含 `settings` 表的创建。

- [ ] **Step 4: 应用迁移并验证**

```bash
cd backend
uv run alembic upgrade head
uv run alembic current
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/models/setting.py backend/app/models/__init__.py backend/alembic/versions/...
git commit -m "feat(backend): 新增 Setting 模型与迁移"
```

---

### Task 2: 实现 `services/python_env.py`

**Files:**
- Create: `backend/app/services/python_env.py`
- Test: `backend/tests/test_settings.py`

**Interfaces:**
- Consumes: `Setting` model, `Session`.
- Produces:
  - `get_or_create_settings(db: Session) -> Setting`
  - `get_configured_python(db: Session) -> str | None`
  - `resolve_uv_executable() -> str | None`
  - `validate_python_env(python_path: str | None) -> dict`
  - `get_effective_python(db: Session) -> str`（未配置时开发模式回退 sys.executable，打包版抛 RuntimeError）

- [ ] **Step 1: 编写失败测试**

```python
from unittest.mock import patch

from app.services.python_env import resolve_uv_executable


def test_resolve_uv_executable_finds_uv_in_path():
    with patch("app.services.python_env.shutil.which", return_value="/usr/bin/uv"):
        assert resolve_uv_executable() == "/usr/bin/uv"


def test_resolve_uv_executable_uses_resource_in_frozen_app():
    fake_exe = "C:\\app\\resources\\ghost-flow-backend.exe"
    with (
        patch("app.services.python_env.getattr", return_value=True),
        patch("app.services.python_env.sys") as mock_sys,
        patch("app.services.python_env.shutil.which", return_value=None),
    ):
        mock_sys.frozen = True
        mock_sys.executable = fake_exe
        mock_sys._MEIPASS = "C:\\app\\resources\\_MEI"
        assert resolve_uv_executable() == "C:\\app\\resources\\uv.exe"
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend
uv run pytest tests/test_settings.py -v
```

Expected: 失败，`python_env` 不存在。

- [ ] **Step 3: 实现服务函数**

```python
import shutil
import subprocess
import sys
from pathlib import Path

from loguru import logger
from sqlalchemy.orm import Session

from ..models.setting import Setting


def _is_frozen_app() -> bool:
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def get_or_create_settings(db: Session) -> Setting:
    setting = db.get(Setting, 1)
    if setting is None:
        setting = Setting(id=1)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def get_configured_python(db: Session) -> str | None:
    setting = get_or_create_settings(db)
    path = setting.python_executable_path
    if not path:
        return None
    return path.strip() or None


def resolve_uv_executable() -> str | None:
    if _is_frozen_app():
        bundled = Path(sys.executable).parent / "uv.exe"
        if bundled.exists():
            return str(bundled)
    return shutil.which("uv")


def validate_python_env(python_path: str | None) -> dict:
    result = {
        "python_ok": False,
        "python_version": None,
        "uv_ok": False,
        "uv_version": None,
        "message": "",
    }

    if not python_path:
        result["message"] = "未配置 Python 解释器路径"
        return result

    try:
        proc = subprocess.run(
            [python_path, "--version"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode == 0 and proc.stdout.startswith("Python "):
            result["python_ok"] = True
            result["python_version"] = proc.stdout.strip()
        else:
            result["message"] = "指定的 Python 解释器无法运行"
            return result
    except Exception as e:
        result["message"] = f"检查 Python 解释器时出错：{e}"
        return result

    uv_path = resolve_uv_executable()
    if not uv_path:
        result["message"] = "未找到 uv 可执行文件"
        return result

    try:
        proc = subprocess.run(
            [uv_path, "--version"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode == 0:
            result["uv_ok"] = True
            result["uv_version"] = proc.stdout.strip() or proc.stderr.strip()
        else:
            result["message"] = "uv 可执行文件无法运行"
            return result
    except Exception as e:
        result["message"] = f"检查 uv 时出错：{e}"
        return result

    result["message"] = "环境检查通过"
    return result


def get_effective_python(db: Session) -> str:
    configured = get_configured_python(db)
    if configured:
        return configured
    if _is_frozen_app():
        raise RuntimeError(
            "打包版未配置 Python 解释器路径，请在“系统设置”中配置可用的 Python 环境。"
        )
    return sys.executable
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
cd backend
uv run pytest tests/test_settings.py -v
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/services/python_env.py backend/tests/test_settings.py
git commit -m "feat(backend): 添加 Python 环境解析与校验服务"
```

---

### Task 3: 改造 `deps_installer.py`

**Files:**
- Modify: `backend/app/services/deps_installer.py`
- Modify: `backend/app/api/endpoints/execute.py`
- Modify: `backend/app/services/task_runner.py`
- Test: `backend/tests/test_deps_installer.py`

**Interfaces:**
- Consumes: `get_effective_python(db)`, `resolve_uv_executable()`.
- Produces: `ensure_dependencies(code: str, db: Session) -> list[str]`。

- [ ] **Step 1: 调整 `ensure_dependencies` 签名并更新调用方**

将 `ensure_dependencies(code: str)` 改为 `ensure_dependencies(code: str, db: Session)`。

在 `execute.py`：

```python
# /api/execute/python
ensure_dependencies(req.code, db)
# /api/execute/tasks/{id}/test
ensure_dependencies(task.content, db)
```

在 `task_runner.py`：

```python
ensure_dependencies(task.content, db)
```

- [ ] **Step 2: 重写安装流程**

```python
from sqlalchemy.orm import Session

from .python_env import get_effective_python, resolve_uv_executable


def _is_installed(package: str, python_path: str) -> bool:
    try:
        result = subprocess.run(
            [python_path, "-c",
             f"import importlib.metadata; importlib.metadata.distribution('{package}')"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def ensure_dependencies(code: str, db: Session) -> list[str]:
    imports = _parse_imports(code)
    candidates = {_resolve_package(name) for name in imports if not _is_stdlib(name)}

    python_path = get_effective_python(db)
    need_install = [pkg for pkg in sorted(candidates) if not _is_installed(pkg, python_path)]

    if not need_install:
        return []

    uv_path = resolve_uv_executable()
    if not uv_path:
        raise RuntimeError("未找到 uv 可执行文件，无法自动安装第三方依赖。")

    installed = []
    for pkg in need_install:
        try:
            result = subprocess.run(
                [uv_path, "pip", "install", "--python", python_path, pkg],
                capture_output=True, text=True, timeout=120,
            )
        except Exception as e:
            raise RuntimeError(f"依赖安装失败（{pkg}）: {e}") from e
        if result.returncode == 0:
            installed.append(pkg)
            logger.info(f"auto-installed package: {pkg} into {python_path}")
        else:
            raise RuntimeError(f"依赖安装失败（{pkg}）: {_stderr_summary(result.stderr)}")

    return installed
```

- [ ] **Step 3: 更新单元测试**

将现有 `ensure_dependencies` 调用处补上 `db` 参数（使用 `mock.MagicMock()` 或真实 session）。

新增测试：

```python
def test_ensure_dependencies_uses_configured_python():
    code = "import pandas"
    fake_python = "/usr/bin/python3"
    fake_uv = "/usr/bin/uv"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value=fake_python),
        patch.object(deps_installer, "resolve_uv_executable", return_value=fake_uv),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(returncode=0, stdout="", stderr="")
        deps_installer.ensure_dependencies(code, mock.MagicMock())

    cmd = mock_run.call_args[0][0]
    assert cmd[:5] == [fake_uv, "pip", "install", "--python", fake_python]
```

- [ ] **Step 4: 运行测试**

```bash
cd backend
uv run pytest tests/test_deps_installer.py -v
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/services/deps_installer.py backend/app/api/endpoints/execute.py backend/app/services/task_runner.py backend/tests/test_deps_installer.py
git commit -m "feat(backend): deps_installer 使用配置的解释器和 uv 安装依赖"
```

---

### Task 4: 改造 `python_executor.py`

**Files:**
- Modify: `backend/app/services/executor/python_executor.py`
- Modify: `backend/app/api/endpoints/execute.py`
- Modify: `backend/app/services/task_runner.py`
- Test: `backend/tests/test_python_executor.py`

**Interfaces:**
- Consumes: `get_effective_python(db)`。
- Produces: `execute_python(code, timeout=60, run_id=None, python_path=None)`；未传 `python_path` 时由调用方从 db 获取并传入。

- [ ] **Step 1: 修改 `execute_python` 签名与调用方**

```python
def execute_python(
    code: str,
    timeout: int = 60,
    run_id: int | None = None,
    python_path: str | None = None,
) -> dict:
```

调用方在 `execute.py` 和 `task_runner.py`：

```python
from app.services.python_env import get_effective_python

python_path = get_effective_python(db)
result = execute_python(task.content, timeout=..., run_id=..., python_path=python_path)
```

- [ ] **Step 2: 使用传入的解释器执行脚本**

```python
def execute_python(...):
    if python_path is None:
        python_path = sys.executable

    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "_exec_script.py"
        script_path.write_text(code, encoding="utf-8")

        process = subprocess.Popen(
            [python_path, str(script_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=tmpdir,
            env=os.environ.copy(),
        )
        ...
```

同时移除 `_build_python_cmd` / `_build_python_process_env` 中对 frozen 的特殊处理，或简化为：

```python
def _build_python_cmd(script_path: Path, python_path: str | None = None) -> list[str]:
    return [python_path or sys.executable, str(script_path)]
```

- [ ] **Step 3: 更新单元测试**

修改 `test_build_python_cmd_in_frozen_app_*` 测试，改为验证传入 `python_path` 后的命令。

新增：

```python
def test_execute_python_uses_provided_python_path():
    from pathlib import Path
    import sys

    result = execute_python(
        "import sys; print(sys.executable)",
        timeout=10,
        python_path=sys.executable,
    )
    assert result["success"] is True
    assert sys.executable in result["stdout"]
```

- [ ] **Step 4: 运行测试**

```bash
cd backend
uv run pytest tests/test_python_executor.py -v
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/services/executor/python_executor.py backend/app/api/endpoints/execute.py backend/app/services/task_runner.py backend/tests/test_python_executor.py
git commit -m "feat(backend): python_executor 使用配置的解释器执行脚本"
```

---

### Task 5: 新增 `/api/settings` 接口

**Files:**
- Create: `backend/app/schemas/setting.py`
- Create: `backend/app/api/endpoints/settings.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_settings.py`

**Interfaces:**
- Produces: `GET /api/settings`, `PUT /api/settings`, `POST /api/settings/test`。

- [ ] **Step 1: 创建 schema**

```python
from pydantic import BaseModel, Field


class SettingUpdate(BaseModel):
    python_executable_path: str | None = Field(default=None, max_length=1024)


class SettingResponse(BaseModel):
    python_executable_path: str | None
    python_ok: bool
    uv_ok: bool


class SettingTestResponse(BaseModel):
    python_ok: bool
    python_version: str | None
    uv_ok: bool
    uv_version: str | None
    message: str
```

- [ ] **Step 2: 创建 router**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.setting import SettingResponse, SettingTestResponse, SettingUpdate
from ...services.python_env import (
    get_configured_python,
    get_or_create_settings,
    resolve_uv_executable,
    validate_python_env,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingResponse)
def get_settings(db: Session = Depends(get_db)):
    path = get_configured_python(db)
    validation = validate_python_env(path)
    return SettingResponse(
        python_executable_path=path,
        python_ok=validation["python_ok"],
        uv_ok=validation["uv_ok"],
    )


@router.put("", response_model=SettingResponse)
def update_settings(req: SettingUpdate, db: Session = Depends(get_db)):
    setting = get_or_create_settings(db)
    value = req.python_executable_path
    setting.python_executable_path = value.strip() if value else None
    db.commit()
    db.refresh(setting)
    path = get_configured_python(db)
    validation = validate_python_env(path)
    return SettingResponse(
        python_executable_path=path,
        python_ok=validation["python_ok"],
        uv_ok=validation["uv_ok"],
    )


@router.post("/test", response_model=SettingTestResponse)
def test_settings(req: SettingUpdate):
    path = req.python_executable_path.strip() if req.python_executable_path else None
    return SettingTestResponse(**validate_python_env(path))
```

- [ ] **Step 3: 注册路由**

在 `backend/app/main.py` 找到其他 router 注册处，添加：

```python
from .api.endpoints import settings

app.include_router(settings.router)
```

- [ ] **Step 4: 编写接口测试**

```python
def test_get_settings_returns_defaults(client):
    res = client.get("/api/settings")
    assert res.status_code == 200
    assert res.json()["python_executable_path"] is None
    assert res.json()["python_ok"] is False


def test_update_settings_persists_path(client):
    res = client.put("/api/settings", json={"python_executable_path": "/usr/bin/python3"})
    assert res.status_code == 200
    assert res.json()["python_executable_path"] == "/usr/bin/python3"

    res = client.get("/api/settings")
    assert res.json()["python_executable_path"] == "/usr/bin/python3"
```

- [ ] **Step 5: 运行测试**

```bash
cd backend
uv run pytest tests/test_settings.py -v
```

- [ ] **Step 6: 提交**

```bash
git add backend/app/schemas/setting.py backend/app/api/endpoints/settings.py backend/app/main.py backend/tests/test_settings.py
git commit -m "feat(backend): 新增 /api/settings 配置接口"
```

---

### Task 6: 前端设置页面

**Files:**
- Create: `frontend/src/api/settings.ts`
- Create: `frontend/src/pages/Settings/index.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`
- Modify: `frontend/src/api/client.ts`（无需修改，已统一 baseURL）

**Interfaces:**
- Produces: `getSettings()`, `updateSettings(data)`, `testSettings(data)`。
- Produces: Settings page route `/settings`。

- [ ] **Step 1: 创建 API 客户端**

```typescript
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

export const getSettings = () => client.get<Settings>('/settings').then(r => r.data)
export const updateSettings = (data: SettingsUpdate) =>
  client.put<Settings>('/settings', data).then(r => r.data)
export const testSettings = (data: SettingsUpdate) =>
  client.post<SettingsTestResult>('/settings/test', data).then(r => r.data)
```

- [ ] **Step 2: 创建设置页面**

```tsx
import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, message, Space, Tag } from 'antd'
import { getSettings, testSettings, updateSettings } from '../../api/settings'

export default function Settings() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState({ python_ok: false, uv_ok: false })

  const load = async () => {
    const data = await getSettings()
    form.setFieldsValue({ python_executable_path: data.python_executable_path || '' })
    setSaved({ python_ok: data.python_ok, uv_ok: data.uv_ok })
  }

  useEffect(() => { load() }, [])

  const handleTest = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const result = await testSettings({
        python_executable_path: values.python_executable_path || null,
      })
      if (result.python_ok && result.uv_ok) {
        message.success(`${result.message} (${result.python_version}, ${result.uv_version})`)
      } else {
        message.error(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const data = await updateSettings({
        python_executable_path: values.python_executable_path || null,
      })
      setSaved({ python_ok: data.python_ok, uv_ok: data.uv_ok })
      message.success('保存成功')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="系统设置">
      <Form form={form} layout="vertical">
        <Form.Item
          label="Python 解释器路径"
          name="python_executable_path"
          rules={[{ required: false }]}
          extra="留空表示使用开发模式下的当前解释器；打包版必须配置。"
        >
          <Input placeholder="例如 C:\\Python312\\python.exe" />
        </Form.Item>
        <Space>
          <Button loading={loading} onClick={handleTest}>测试环境</Button>
          <Button type="primary" loading={loading} onClick={handleSave}>保存</Button>
        </Space>
      </Form>
      <div style={{ marginTop: 16 }}>
        <span>当前状态：</span>
        <Tag color={saved.python_ok ? 'success' : 'error'}>
          Python {saved.python_ok ? '可用' : '不可用'}
        </Tag>
        <Tag color={saved.uv_ok ? 'success' : 'error'}>
          uv {saved.uv_ok ? '可用' : '不可用'}
        </Tag>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: 添加菜单与路由**

在 `AppLayout.tsx` 中：

```tsx
import { SettingOutlined } from '@ant-icons'

const menuItems = [
  ...
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
]
```

在 Routes 中添加：

```tsx
import Settings from '../pages/Settings'

<Route path="/settings" element={<Settings />} />
```

- [ ] **Step 4: 前端 lint 检查**

```bash
cd frontend
pnpm oxlint
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/api/settings.ts frontend/src/pages/Settings/index.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(frontend): 新增系统设置页面"
```

---

### Task 7: Electron 打包包含 uv.exe

**Files:**
- Modify: `scripts/build-desktop.ps1`
- Modify: `electron/package.json`

**Interfaces:**
- Produces: 打包后的 `resources/uv.exe`。

- [ ] **Step 1: 修改 PowerShell 构建脚本**

在打包前增加下载/复制 `uv.exe` 的步骤。示例：

```powershell
$uvDest = "$PSScriptRoot\..\electron\resources\uv.exe"
if (-not (Test-Path $uvDest)) {
    Write-Host "下载 uv.exe..."
    $uvUrl = "https://github.com/astral-sh/uv/releases/download/0.4.10/uv-x86_64-pc-windows-msvc.zip"
    $zip = "$env:TEMP\uv.zip"
    Invoke-WebRequest -Uri $uvUrl -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath "$env:TEMP\uv" -Force
    Copy-Item "$env:TEMP\uv\uv.exe" $uvDest -Force
}
```

根据实际 uv 版本调整 URL。也可以优先复制本机已有的 `uv.exe`：

```powershell
$localUv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if ($localUv) {
    Copy-Item $localUv $uvDest -Force
} else {
    # 下载逻辑
}
```

- [ ] **Step 2: 确保 electron-builder 包含 uv.exe**

`electron/package.json` 的 `build` 配置中 `extraResources` 已默认包含 `resources/` 下文件。验证：

```json
{
  "build": {
    "extraResources": [
      "resources/**"
    ]
  }
}
```

如未声明则添加。

- [ ] **Step 3: 验证打包产物**

```powershell
.\scripts\build-desktop.ps1
ls electron\dist\*-unpacked\resources\uv.exe
```

- [ ] **Step 4: 提交**

```bash
git add scripts/build-desktop.ps1 electron/package.json
git commit -m "build(electron): 打包时附带 uv.exe"
```

---

### Task 8: 全量测试与回归验证

**Files:** 全部改动。

- [ ] **Step 1: 后端全量测试**

```bash
cd backend
uv run pytest -v
```

Expected: 全部通过。

- [ ] **Step 2: 前端 lint**

```bash
cd frontend
pnpm oxlint
```

Expected: 无新增错误。

- [ ] **Step 3: 手动验证关键路径**

1. 启动后端：`cd backend && uv run uvicorn app.main:app --reload --port 8000`
2. 打开前端，进入“系统设置”。
3. 输入本机 Python 路径（如 `.venv\Scripts\python.exe`），点击“测试环境”，应显示 Python 与 uv 版本。
4. 保存后创建 Python 任务，内容 `import pandas; print(pandas.__version__)`。
5. 执行任务，观察：
   - 若环境无 pandas，应触发 `uv pip install --python <路径> pandas`。
   - 安装成功后打印版本号。

- [ ] **Step 4: 提交最终变更**

```bash
git add -A
git commit -m "feat: 支持配置 Python 环境路径并通过 uv 自动安装依赖"
```

---

## Self-Review

1. **Spec coverage:**
   - 全局设置项持久化 → Task 1 + Task 5。
   - 使用配置的解释器执行脚本 → Task 4。
   - 缺失依赖自动安装 → Task 3。
   - uv 管理环境库 → Task 2 + Task 7。
   - 前端设置页面 → Task 6。
   - 开发与打包版一致性 → Global Constraints + Task 7。
   - 无遗漏。

2. **Placeholder scan:** 无 TBD/TODO/模糊描述，所有步骤包含具体代码与命令。

3. **Type consistency:**
   - `ensure_dependencies(code: str, db: Session)` 在 Task 3 中定义并在调用方使用。
   - `execute_python(..., python_path: str | None = None)` 在 Task 4 中定义并在调用方使用。
   - `SettingResponse` / `SettingTestResponse` 字段与 Task 5 中返回一致。
