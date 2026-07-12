import redshift_connector

from .base import BaseConnector


class RedshiftConnector(BaseConnector):

    def _create_connection(self, config: dict):
        params = {
            "host": config["host"],
            "port": int(config.get("port", 5439)),
            "database": config["database"],
        }

        auth_type = config.get("auth_type", "okta")

        if auth_type == "okta":
            params.update({
                "user": config["user"],
                "password": config["password"],
                "idp_tenant": config["idp_tenant"],
                "client_id": config["client_id"],
                "plugin_name": config.get("plugin_name", "com.okta.redshift.okta_credentials_provider"),
            })
        elif auth_type == "iam":
            required_fields = [
                "user",
                "aws_access_key_id",
                "aws_secret_access_key",
                "region",
                "cluster_identifier",
            ]
            missing = [field for field in required_fields if not config.get(field)]
            if missing:
                raise ValueError(f"Redshift IAM 认证缺少必填字段: {', '.join(missing)}")

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
        else:
            # 兜底：使用原生用户名/密码认证
            params["user"] = config["user"]
            if config.get("password"):
                params["password"] = config["password"]

        return redshift_connector.connect(**params)
