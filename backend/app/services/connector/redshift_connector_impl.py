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
        else:
            params["user"] = config["user"]
            if config.get("password"):
                params["password"] = config["password"]

        return redshift_connector.connect(**params)
