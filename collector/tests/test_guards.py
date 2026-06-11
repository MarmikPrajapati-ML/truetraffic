"""H3 SSRF guard tests — every blocked category must have a test."""
import pytest

from shared.guards import SSRFError, validate_external_url


def test_valid_https_passes():
    validate_external_url("https://example.com/robots.txt")


def test_valid_http_passes():
    validate_external_url("http://example.com/robots.txt")


def test_localhost_blocked():
    with pytest.raises(SSRFError, match="blocked"):
        validate_external_url("http://localhost/secret")


def test_loopback_ip_blocked():
    with pytest.raises(SSRFError, match="blocked"):
        validate_external_url("http://127.0.0.1/secret")


def test_aws_metadata_blocked():
    with pytest.raises(SSRFError, match="blocked"):
        validate_external_url("http://169.254.169.254/latest/meta-data/")


def test_private_10_blocked():
    with pytest.raises(SSRFError, match="blocked"):
        validate_external_url("http://10.0.0.1/internal")


def test_private_192168_blocked():
    with pytest.raises(SSRFError, match="blocked"):
        validate_external_url("http://192.168.1.1/admin")


def test_non_standard_port_blocked():
    with pytest.raises(SSRFError, match="port"):
        validate_external_url("http://example.com:8080/path")


def test_ftp_scheme_blocked():
    with pytest.raises(SSRFError, match="scheme"):
        validate_external_url("ftp://example.com/file")


def test_file_scheme_blocked():
    with pytest.raises(SSRFError, match="scheme"):
        validate_external_url("file:///etc/passwd")
