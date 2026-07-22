import redshift_connector

from .base import BaseConnector


def _resolve_auth_type(config: dict) -> str:
    """解析认证方式，兼容存量配置：

    - auth_type == "iam"（旧写法）→ iam_keys
    - 无 auth_type 且含 idp_tenant → browser_azure
    - 无 auth_type 且含 user + password → password
    """
    auth_type = config.get("auth_type")
    if auth_type == "iam":
        return "iam_keys"
    if auth_type:
        return auth_type
    if config.get("idp_tenant"):
        return "browser_azure"
    # 兜底走 password 分支，由其必填校验给出明确的中文报错
    return "password"


def _check_required(config: dict, required: list[str], label: str) -> None:
    """连接前校验必填字段，缺失时抛出列出缺失字段的中文 ValueError。"""
    missing = [field for field in required if not config.get(field)]
    if missing:
        raise ValueError(f"Redshift {label} 认证缺少必填字段: {', '.join(missing)}")


class RedshiftConnector(BaseConnector):

    def _create_connection(self, config: dict):
        _check_required(config, ["host", "database"], "连接配置")

        params = {
            "host": config["host"],
            "port": int(config.get("port", 5439)),
            "database": config["database"],
        }

        auth_type = _resolve_auth_type(config)

        if auth_type == "okta":
            params.update({
                "user": config["user"],
                "password": config["password"],
                "idp_tenant": config["idp_tenant"],
                "client_id": config["client_id"],
                "plugin_name": config.get("plugin_name", "com.okta.redshift.okta_credentials_provider"),
            })
        elif auth_type == "browser_azure":
            _check_required(
                config,
                ["cluster_identifier", "client_id", "idp_tenant"],
                "Azure AD 浏览器 SSO",
            )
            params.update({
                "iam": True,
                "credentials_provider": "BrowserAzureCredentialsProvider",
                "cluster_identifier": config["cluster_identifier"],
                "idp_tenant": config["idp_tenant"],
                "client_id": config["client_id"],
            })
            # region 缺省时由 redshift-connector 自行从 host 推导，这里仅在显式提供时传递
            for optional in ("db_user", "db_groups", "region"):
                if config.get(optional):
                    params[optional] = config[optional]
            for optional_int in ("listen_port", "idp_response_timeout"):
                if config.get(optional_int) is not None:
                    params[optional_int] = int(config[optional_int])
        elif auth_type == "iam_keys":
            _check_required(
                config,
                ["user", "aws_access_key_id", "aws_secret_access_key", "region", "cluster_identifier"],
                "IAM 密钥",
            )
            params.update({
                "iam": True,
                "db_user": config["user"],
                "user": "",
                "password": "",
                "access_key_id": config["aws_access_key_id"],
                "secret_access_key": config["aws_secret_access_key"],
                "cluster_identifier": config["cluster_identifier"],
                "region": config["region"],
            })
            if config.get("aws_session_token"):
                params["session_token"] = config["aws_session_token"]
        elif auth_type == "password":
            _check_required(config, ["user", "password"], "密码")
            params["user"] = config["user"]
            params["password"] = config["password"]
        else:
            raise ValueError(f"不支持的 Redshift 认证方式: {auth_type}")

        return redshift_connector.connect(**params)
