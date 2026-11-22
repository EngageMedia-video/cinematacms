import copy
import logging
import re
import subprocess
import traceback
from ipaddress import ip_address
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_configured = False
GIT_TIMEOUT_SECONDS = 5

EMAIL_PATTERN = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])")
URL_PATTERN = re.compile(
    r"\b(?:https?|postgres(?:ql)?|redis|rediss|smtp)://[^\s,)]+",
    re.IGNORECASE,
)
IPV4_PATTERN = re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])")
IPV6_CANDIDATE_PATTERN = re.compile(r"(?<![\w:])(?:\[[0-9A-Fa-f:]+\]|[0-9A-Fa-f]*:[0-9A-Fa-f:]+)(?![\w:])")
SECRET_PATTERN = re.compile(
    r"\b(authorization|password|passwd|secret|api[-_]?key|token)\b(\s*(?:=|:)\s*|\s+)([^\s,;]+)",
    re.IGNORECASE,
)
SQL_PATTERN = re.compile(
    r"\b(?:SELECT\s+.+?\s+FROM|INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|WITH\s+\S+\s+AS)\b.+",
    re.IGNORECASE,
)
SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "body",
        "client_ip",
        "cookie",
        "cookies",
        "data",
        "db_statement",
        "email",
        "email_address",
        "headers",
        "ip",
        "ip_address",
        "password",
        "query",
        "query_string",
        "remote_addr",
        "request",
        "request_body",
        "secret",
        "sql",
        "statement",
        "token",
        "user",
        "vars",
    }
)
TRACE_CONTEXT_KEYS = frozenset({"trace_id", "span_id", "parent_span_id", "op", "status"})


class ErrorTrackingDiagnosticError(RuntimeError):
    """Fixed failure used to verify staging error ingestion."""


def _redact_ipv6_candidate(match: re.Match[str]) -> str:
    candidate = match.group(0)
    address = candidate.removeprefix("[").removesuffix("]")
    try:
        parsed = ip_address(address)
    except ValueError:
        return candidate
    return "[redacted-ip]" if parsed.version == 6 else candidate


def redact_text(value: str) -> str:
    redacted = URL_PATTERN.sub("[redacted-url]", value)
    redacted = EMAIL_PATTERN.sub("[redacted-email]", redacted)
    redacted = IPV4_PATTERN.sub("[redacted-ip]", redacted)
    redacted = IPV6_CANDIDATE_PATTERN.sub(_redact_ipv6_candidate, redacted)
    redacted = SECRET_PATTERN.sub(r"\1\2[redacted]", redacted)
    return SQL_PATTERN.sub("[redacted-sql]", redacted)


def _sanitize_value(value: Any, key: str = "") -> Any:
    normalized_key = key.lower()
    if normalized_key in SENSITIVE_KEYS or normalized_key.endswith(("_email", "_ip")):
        return "[redacted]"
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, dict):
        return {item_key: _sanitize_value(item_value, str(item_key)) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_value(item) for item in value)
    return value


def _remove_frame_variables(value: Any) -> None:
    if isinstance(value, dict):
        value.pop("vars", None)
        for nested in value.values():
            _remove_frame_variables(nested)
    elif isinstance(value, list):
        for nested in value:
            _remove_frame_variables(nested)


def sanitize_event(event: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any]:
    if hint is not None:
        hint.pop("attachments", None)
    sanitized = copy.deepcopy(event)
    for field in (
        "breadcrumbs",
        "extra",
        "fingerprint",
        "modules",
        "request",
        "server_name",
        "spans",
        "tags",
        "transaction",
        "user",
    ):
        sanitized.pop(field, None)

    trace_context = sanitized.get("contexts", {}).get("trace", {})
    sanitized["contexts"] = {
        "trace": {key: _sanitize_value(value, key) for key, value in trace_context.items() if key in TRACE_CONTEXT_KEYS}
    }
    sanitized = _sanitize_value(sanitized)
    _remove_frame_variables(sanitized)
    sanitized["tags"] = {"service_role": getattr(settings, "OTEL_SERVICE_ROLE", "web")}
    return sanitized


def sanitize_log_record(record: logging.LogRecord) -> None:
    record.msg = redact_text(record.getMessage())
    record.args = ()

    for key, value in tuple(record.__dict__.items()):
        if key in {"msg", "args", "exc_info", "exc_text"}:
            continue
        record.__dict__[key] = _sanitize_value(value, key)

    if record.exc_info:
        record.exc_text = redact_text("".join(traceback.format_exception(*record.exc_info)))
        record.exc_info = None


def _git_output(checkout: str, *arguments: str) -> str | None:
    completed = subprocess.run(
        ["git", "-C", checkout, *arguments],
        capture_output=True,
        text=True,
        timeout=GIT_TIMEOUT_SECONDS,
        check=False,
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def checkout_release(checkout: str) -> str | None:
    """Name the release after the tag at HEAD of the checkout, or after its commit when no tag points there."""
    try:
        version = _git_output(checkout, "describe", "--tags", "--exact-match", "HEAD") or _git_output(
            checkout, "rev-parse", "--short=12", "HEAD"
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        logger.warning("Error tracking has no release: git failed in %s: %s", checkout, error)
        return None
    if not version:
        logger.warning("Error tracking has no release: %s is not a git checkout that git can read.", checkout)
        return None
    return f"cinematacms@{version}"


def configure_error_tracking() -> bool:
    global _configured

    dsn = getattr(settings, "SENTRY_DSN", "").strip()
    if not dsn:
        return False
    if _configured:
        return True

    import sentry_sdk
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=dsn,
        environment=getattr(settings, "SENTRY_ENVIRONMENT", "development"),
        release=checkout_release(str(settings.BASE_DIR)),
        sample_rate=float(getattr(settings, "SENTRY_SAMPLE_RATE", 1.0)),
        traces_sample_rate=0.0,
        profiles_sample_rate=0.0,
        enable_logs=False,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        max_breadcrumbs=0,
        auto_session_tracking=False,
        server_name="",
        before_send=sanitize_event,
        integrations=[
            LoggingIntegration(
                level=None,
                event_level=None,
                sentry_logs_level=None,
                capture_sentry_logs=False,
            )
        ],
    )
    _configured = True
    return True


def capture_unexpected_exception(error: BaseException | None = None):
    if not getattr(settings, "SENTRY_DSN", "").strip():
        return None
    try:
        import sentry_sdk

        return sentry_sdk.capture_exception(error)
    except Exception:
        from files.metrics import record_telemetry_failure

        record_telemetry_failure("errors", "error_tracking_sdk", "export")
        return None
