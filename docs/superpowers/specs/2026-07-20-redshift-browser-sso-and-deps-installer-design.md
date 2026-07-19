# Redshift 浏览器 SSO（Azure AD）连接 + Python 依赖自动安装修补 — 设计文档

日期：2026-07-20（同日修订：SSO 类型由 BrowserOkta 更正为 BrowserAzure）

## 背景

用户需要通过 SSO 方式连接 AWS Redshift。目标参数集为 `iam, credentials_provider, host, port, database, cluster_identifier, client_id, idp_tenant`。

**关键事实核查结论**：`redshift-connector`（本地 2.1.15 及上游 master）不存在 `BrowserOktaCredentialsProvider`。上述参数集（`idp_tenant` + `client_id` + 浏览器弹窗）实际对应内置的 `BrowserAzureCredentialsProvider`（Azure AD / Entra ID SSO，源码：`redshift_connector/plugin/browser_azure_credentials_provider.py`，必填校验 `idp_tenant`、`client_id`）。已与用户确认其 SSO 为 Azure AD / Entra。

现状（探索结论）：

- `backend/app/services/connector/redshift_connector_impl.py` 已有 `okta` / `iam` / 密码三分支，但 `okta` 分支是 Java 插件路径（半通状态：缺 `iam=True` 等参数、plugin 类名大小写存疑），不支持浏览器 SSO。
- 前端 `ConnectionForm.tsx` 是自由 JSON 文本框，Redshift 模板字段不全（IAM 模板缺 `cluster_identifier`），无"测试连接"能力。
- `backend/app/services/deps_installer.py` 已接入全部 Python 执行入口（ad-hoc、测试运行、任务运行），但缺导入名→包名映射（如 `import sklearn` → `pip install sklearn` 必失败），且安装失败仅写 warning 日志，用户不可见。

## 已确认的决策

1. SSO 类型：内置 `BrowserAzureCredentialsProvider`（Azure AD / Entra，浏览器弹窗；非 Java 插件、非通用透传）。
2. 前端表单：结构化表单（按类型 + 认证方式显示字段），加"测试连接"按钮。
3. 依赖安装：修补缺口（映射表 + 失败显式报错），不做版本锁定/并发锁/镜像源配置。
4. 后端连接器采用方案 A：按 `auth_type` 分派的参数构造器，兼容旧配置。

## 1. 后端 Redshift 连接器重构

文件：`backend/app/services/connector/redshift_connector_impl.py`

- `auth_type` 取值：`browser_azure`、`iam_keys`、`password`。
- 兼容映射（不破坏存量数据）：
  - `auth_type == "iam"` → `iam_keys`
  - 无 `auth_type` 且含 `idp_tenant` → `browser_azure`
  - 无 `auth_type` 且含 `user`+`password` → `password`
  - 原 `okta`（Java 插件）分支保留原样，供存量配置继续工作。
- `browser_azure` 分支：
  - 必填：`host, database, cluster_identifier, client_id, idp_tenant`；`port` 默认 5439。
  - 可选：`db_user, db_groups, region, listen_port, idp_response_timeout`。
  - 调用：`redshift_connector.connect(iam=True, credentials_provider="BrowserAzureCredentialsProvider", host=..., port=..., database=..., cluster_identifier=..., idp_tenant=..., client_id=..., [db_user, db_groups, region, listen_port, idp_response_timeout])`。
  - `region`：仅在显式提供时传递；缺省由 `redshift-connector` 自身从 host 推导（`IamHelper.set_iam_properties` 内 `set_region_from_host()`），不在我们的代码里重复实现。
- 每个分支连接前校验必填项，缺失时抛出列出缺失字段的中文 `ValueError`。
- 已知限制：浏览器插件首次连接会弹出系统浏览器做 SSO 登录，桌面应用场景下可接受，文档中注明。

## 2. 测试连接接口

文件：`backend/app/api/endpoints/connections.py`

- 新增 `POST /api/connections/test`，body：`{type: str, config: str(JSON)}`（不落库）。
- 行为：按 type 取 connector，执行 `SELECT 1`；返回 `{success: bool, message: str}`，失败时 message 为异常摘要。
- SSO 测试会触发浏览器弹窗，前端按钮旁提示用户。

## 3. 前端结构化表单

文件：`frontend/src/pages/Connections/ConnectionForm.tsx`（重写）

- `type = sqlite`：显示 `file_path` 字段。
- `type = redshift`：先选 `auth_type`（Radio/Select），再显示对应字段组：
  - `browser_azure`：`host, port, database, cluster_identifier, client_id, idp_tenant, region(选填), db_user(选填), db_groups(选填)`。
  - `iam_keys`：`host, port, database, cluster_identifier, region, user, aws_access_key_id, aws_secret_access_key, session_token(选填)`。
  - `password`：`host, port, database, user, password`。
- 所有字段中文 label + 占位提示 + 必填校验；编辑时把已有 `config` JSON 反填进字段。
- 表单内"测试连接"按钮：组装 `{type, config}` 调 `POST /api/connections/test`，结果以 Alert 显示在表单内；按钮旁注明 SSO 测试会弹出浏览器。
- 提交时字段组装为 JSON 字符串存入 `config`（含 `auth_type`）。

## 4. deps_installer 修补

文件：`backend/app/services/deps_installer.py` 及三个调用点

- 新增导入名→包名映射表（在映射后的包名上做 `_is_installed` 检查，避免重复误装）：
  - `sklearn→scikit-learn, yaml→pyyaml, PIL→Pillow, cv2→opencv-python, bs4→beautifulsoup4`
- 安装失败时不再静默：`ensure_dependencies` 抛出 `RuntimeError`，消息含 pip stderr 摘要；成功路径行为不变（返回已安装包列表）。
- 三个调用点处理失败：
  - `POST /api/execute/python`（`execute.py:49`）：返回 400 + 错误信息。
  - `POST /api/execute/tasks/{id}/test`（`execute.py:81`）：测试结果中包含依赖安装失败信息（该端点已有 `except Exception → 400`，只需确保错误消息可读）。
  - `task_runner.py:102`：写入 TaskRun 失败记录（error_message 含依赖安装错误；现有 `except Exception` 分支已覆盖，只需确保异常消息可读）。

## 测试

- 后端（新增 `pytest` dev 依赖，`backend/tests/` 目录）：
  - `redshift_connector_impl` 单测（mock `redshift_connector.connect`）：三分支参数构造、必填校验报错、旧 `iam`/`okta` 配置兼容映射、region 缺省时不传该参数。
  - `POST /api/connections/test`：sqlite 成功路径 + 参数缺失失败路径。
  - `deps_installer` 单测：映射表命中（mock pip）、stdlib 过滤、安装失败抛 `RuntimeError`。
- 前端：`oxlint` 通过；`pnpm build`（`tsc -b && vite build`）通过。
- 手动验证：真实 Azure AD SSO 连接无法在无凭证环境验证，依赖用户在真实环境点"测试连接"确认。

## 不做的事（YAGNI）

- 不支持任意 credentials_provider 类的通用透传。
- 不做版本锁定、并发安装锁、pip 镜像源配置。
- 不改 SQLite 连接器逻辑。
- 连接测试不做连接池/缓存，每次新建连接。
