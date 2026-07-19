# Redshift BrowserOkta SSO 连接 + Python 依赖自动安装修补 — 设计文档

日期：2026-07-20

## 背景

用户需要通过 SSO 方式连接 AWS Redshift。目标参数集为 `iam, credentials_provider, host, port, database, cluster_identifier, client_id, idp_tenant`，对应 `redshift-connector` 内置的 `BrowserOktaCredentialsProvider`（浏览器弹窗完成 Okta SSO）。

现状（探索结论）：

- `backend/app/services/connector/redshift_connector_impl.py` 已有 `okta` / `iam` / 密码三分支，但 `okta` 分支是 Java 插件路径（半通状态：缺 `iam=True` 等参数、plugin 类名大小写存疑），不支持内置 BrowserOkta。
- 前端 `ConnectionForm.tsx` 是自由 JSON 文本框，Redshift 模板字段不全（IAM 模板缺 `cluster_identifier`），无"测试连接"能力。
- `backend/app/services/deps_installer.py` 已接入全部 Python 执行入口（ad-hoc、测试运行、任务运行），但缺导入名→包名映射（如 `import sklearn` → `pip install sklearn` 必失败），且安装失败仅写 warning 日志，用户不可见。

## 已确认的决策

1. SSO 类型：内置 `BrowserOktaCredentialsProvider`（非 Java 插件、非通用透传）。
2. 前端表单：结构化表单（按类型 + 认证方式显示字段），加"测试连接"按钮。
3. 依赖安装：修补缺口（映射表 + 失败显式报错），不做版本锁定/并发锁/镜像源配置。
4. 后端连接器采用方案 A：按 `auth_type` 分派的参数构造器，兼容旧配置。

## 1. 后端 Redshift 连接器重构

文件：`backend/app/services/connector/redshift_connector_impl.py`

- `auth_type` 取值：`browser_okta`、`iam_keys`、`password`。
- 兼容映射（不破坏存量数据）：
  - `auth_type == "iam"` → `iam_keys`
  - 无 `auth_type` 且含 `idp_tenant` → `browser_okta`
  - 无 `auth_type` 且含 `user`+`password` → `password`
  - 原 `okta`（Java 插件）分支保留原样，供存量配置继续工作。
- `browser_okta` 分支：
  - 必填：`host, database, cluster_identifier, client_id, idp_tenant, user`；`port` 默认 5439。
  - 可选：`db_user, db_groups, region, listen_port, idp_response_timeout`。
  - 调用：`redshift_connector.connect(iam=True, credentials_provider="BrowserOktaCredentialsProvider", host=..., port=..., database=..., cluster_identifier=..., region=..., idp_tenant=..., client_id=..., user=..., [db_user, db_groups, listen_port, idp_response_timeout])`。
- `region` 处理：显式提供优先；缺省时用正则从 host 解析（`*.us-east-1.redshift.amazonaws.com` → `us-east-1`）；解析失败抛出中文 `ValueError` 提示显式填写。
- 每个分支连接前校验必填项，缺失时抛出列出缺失字段的中文 `ValueError`。
- 已知限制：浏览器插件首次连接会弹出系统浏览器做 SSO 登录，桌面应用场景下可接受，文档中注明。

## 2. 测试连接接口

文件：`backend/app/api/endpoints/connections.py`

- 新增 `POST /api/connections/test`，body：`{type: str, config: str(JSON)}`（不落库）。
- 行为：按 type 取 connector，Redshift 执行 `SELECT 1`，SQLite 执行 `SELECT 1`；返回 `{success: bool, message: str}`，失败时 message 为异常摘要。
- SSO 测试会触发浏览器弹窗，前端按钮旁提示用户。

## 3. 前端结构化表单

文件：`frontend/src/pages/Connections/ConnectionForm.tsx`（重写）

- `type = sqlite`：显示 `file_path` 字段。
- `type = redshift`：先选 `auth_type`（Radio/Select），再显示对应字段组：
  - `browser_okta`：`host, port, database, cluster_identifier, client_id, idp_tenant, user, region(选填), db_user(选填)`。
  - `iam_keys`：`host, port, database, cluster_identifier, region, user, aws_access_key_id, aws_secret_access_key, session_token(选填)`。
  - `password`：`host, port, database, user, password`。
- 所有字段中文 label + 占位提示 + 必填校验；编辑时把已有 `config` JSON 反填进字段。
- 表单内"测试连接"按钮：组装 `{type, config}` 调 `POST /api/connections/test`，结果以 Alert 显示在表单内。
- 提交时字段组装为 JSON 字符串存入 `config`（含 `auth_type`）。

## 4. deps_installer 修补

文件：`backend/app/services/deps_installer.py` 及三个调用点

- 新增导入名→包名映射表（在映射后的包名上做 `_is_installed` 检查，避免重复误装）：
  - `sklearn→scikit-learn, yaml→pyyaml, PIL→Pillow, cv2→opencv-python, bs4→beautifulsoup4`
- 安装失败时不再静默：`ensure_deps` 抛出 `RuntimeError`，消息含 pip stderr 摘要；成功路径行为不变（返回已安装包列表）。
- 三个调用点处理失败：
  - `POST /api/execute/python`（`execute.py:49`）：返回 400 + 错误信息。
  - `POST /api/execute/tasks/{id}/test`（`execute.py:81`）：测试结果中包含依赖安装失败信息。
  - `task_runner.py:102`：写入 TaskRun 失败记录（stderr 含依赖安装错误）。

## 测试

- 后端：
  - `redshift_connector_impl` 单测：三分支参数构造、必填校验报错、region 从 host 推导、旧 `iam`/`okta` 配置兼容映射。
  - `POST /api/connections/test`：sqlite 成功路径 + 参数缺失失败路径。
  - `deps_installer` 单测：映射表命中（mock pip）、stdlib 过滤、安装失败抛错。
- 前端：`oxlint` 通过；`pnpm build`（`tsc -b && vite build`）通过。
- 手动验证：真实 Okta SSO 连接无法在无凭证环境验证，依赖用户在真实环境点"测试连接"确认。

## 不做的事（YAGNI）

- 不支持任意 credentials_provider 类的通用透传。
- 不做版本锁定、并发安装锁、pip 镜像源配置。
- 不改 SQLite 连接器逻辑。
- 连接测试不做连接池/缓存，每次新建连接。
