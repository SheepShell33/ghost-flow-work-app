"""Redshift 连接器参数构造、必填校验与兼容映射测试"""

from unittest.mock import patch

import pytest

from app.services.connector.redshift_connector_impl import RedshiftConnector


@pytest.fixture
def mock_connect():
    with patch(
        "app.services.connector.redshift_connector_impl.redshift_connector.connect"
    ) as m:
        yield m


def _create(config: dict):
    return RedshiftConnector()._create_connection(config)


AZURE_BASE = {
    "auth_type": "browser_azure",
    "host": "xxx.abc123.us-east-1.redshift.amazonaws.com",
    "database": "dev",
    "cluster_identifier": "my-cluster",
    "client_id": "client-id-1",
    "idp_tenant": "tenant-id-1",
}

IAM_BASE = {
    "auth_type": "iam_keys",
    "host": "xxx.abc123.us-east-1.redshift.amazonaws.com",
    "database": "dev",
    "cluster_identifier": "my-cluster",
    "region": "us-east-1",
    "user": "awsuser",
    "aws_access_key_id": "AKIA...",
    "aws_secret_access_key": "secret",
}

PASSWORD_BASE = {
    "auth_type": "password",
    "host": "xxx.abc123.us-east-1.redshift.amazonaws.com",
    "database": "dev",
    "user": "awsuser",
    "password": "s3cret",
}


# ===== browser_azure 分支 =====

def test_browser_azure_params(mock_connect):
    _create(AZURE_BASE)
    mock_connect.assert_called_once()
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["iam"] is True
    assert kwargs["credentials_provider"] == "BrowserAzureCredentialsProvider"
    assert kwargs["host"] == AZURE_BASE["host"]
    assert kwargs["port"] == 5439  # 默认端口
    assert kwargs["database"] == "dev"
    assert kwargs["cluster_identifier"] == "my-cluster"
    assert kwargs["client_id"] == "client-id-1"
    assert kwargs["idp_tenant"] == "tenant-id-1"
    # region 缺省时不传，由 connector 自行从 host 推导
    assert "region" not in kwargs


def test_browser_azure_region_and_optionals_passed_when_given(mock_connect):
    config = {
        **AZURE_BASE,
        "port": 5440,
        "region": "us-west-2",
        "db_user": "analyst",
        "db_groups": ["bi"],
        "listen_port": 7890,
        "idp_response_timeout": 120,
    }
    _create(config)
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["port"] == 5440
    assert kwargs["region"] == "us-west-2"
    assert kwargs["db_user"] == "analyst"
    assert kwargs["db_groups"] == ["bi"]
    assert kwargs["listen_port"] == 7890
    assert kwargs["idp_response_timeout"] == 120


def test_browser_azure_missing_required(mock_connect):
    config = {k: v for k, v in AZURE_BASE.items() if k not in ("client_id", "idp_tenant")}
    with pytest.raises(ValueError) as exc_info:
        _create(config)
    assert "client_id" in str(exc_info.value)
    assert "idp_tenant" in str(exc_info.value)
    mock_connect.assert_not_called()


def test_missing_host_and_database(mock_connect):
    with pytest.raises(ValueError) as exc_info:
        _create({"auth_type": "password", "user": "u", "password": "p"})
    assert "host" in str(exc_info.value)
    assert "database" in str(exc_info.value)
    mock_connect.assert_not_called()


# ===== iam_keys 分支 =====

def test_iam_keys_params(mock_connect):
    _create(IAM_BASE)
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["iam"] is True
    assert kwargs["db_user"] == "awsuser"
    assert kwargs["access_key_id"] == "AKIA..."
    assert kwargs["secret_access_key"] == "secret"
    assert kwargs["cluster_identifier"] == "my-cluster"
    assert kwargs["region"] == "us-east-1"
    assert "session_token" not in kwargs


def test_iam_keys_with_session_token(mock_connect):
    _create({**IAM_BASE, "aws_session_token": "token-1"})
    assert mock_connect.call_args.kwargs["session_token"] == "token-1"


def test_iam_keys_missing_required(mock_connect):
    config = {k: v for k, v in IAM_BASE.items() if k != "aws_secret_access_key"}
    with pytest.raises(ValueError) as exc_info:
        _create(config)
    assert "aws_secret_access_key" in str(exc_info.value)
    mock_connect.assert_not_called()


# ===== password 分支 =====

def test_password_params(mock_connect):
    _create(PASSWORD_BASE)
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["user"] == "awsuser"
    assert kwargs["password"] == "s3cret"
    assert "iam" not in kwargs


def test_password_missing_required(mock_connect):
    config = {k: v for k, v in PASSWORD_BASE.items() if k != "password"}
    with pytest.raises(ValueError) as exc_info:
        _create(config)
    assert "password" in str(exc_info.value)
    mock_connect.assert_not_called()


# ===== 兼容映射 =====

def test_legacy_iam_maps_to_iam_keys(mock_connect):
    _create({**IAM_BASE, "auth_type": "iam"})
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["iam"] is True
    assert kwargs["access_key_id"] == "AKIA..."


def test_no_auth_type_with_idp_tenant_maps_to_browser_azure(mock_connect):
    config = {k: v for k, v in AZURE_BASE.items() if k != "auth_type"}
    _create(config)
    assert mock_connect.call_args.kwargs["credentials_provider"] == "BrowserAzureCredentialsProvider"


def test_no_auth_type_with_user_password_maps_to_password(mock_connect):
    config = {k: v for k, v in PASSWORD_BASE.items() if k != "auth_type"}
    _create(config)
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["user"] == "awsuser"
    assert kwargs["password"] == "s3cret"
    assert "iam" not in kwargs


# ===== okta 分支原样保留 =====

def test_okta_branch_preserved(mock_connect):
    _create({
        "auth_type": "okta",
        "host": "xxx.redshift.amazonaws.com",
        "database": "dev",
        "user": "user@company.com",
        "password": "p",
        "idp_tenant": "https://your-org.okta.com",
        "client_id": "cid",
    })
    kwargs = mock_connect.call_args.kwargs
    assert kwargs["plugin_name"] == "com.okta.redshift.okta_credentials_provider"
    assert kwargs["user"] == "user@company.com"
    assert kwargs["idp_tenant"] == "https://your-org.okta.com"
