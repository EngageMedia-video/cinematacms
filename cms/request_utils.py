from ipaddress import ip_address, ip_network

from django.conf import settings


def _is_trusted_proxy(remote_addr, trusted_proxies):
    if not remote_addr:
        return False

    try:
        remote_ip = ip_address(remote_addr)
    except ValueError:
        return remote_addr in trusted_proxies

    for proxy in trusted_proxies:
        try:
            if "/" in proxy:
                if remote_ip in ip_network(proxy, strict=False):
                    return True
            elif remote_ip == ip_address(proxy):
                return True
        except ValueError:
            if remote_addr == proxy:
                return True

    return False


def get_client_ip(request):
    """Return client IP, trusting X-Forwarded-For only from configured proxies."""
    remote_addr = request.META.get("REMOTE_ADDR", "")
    forwarded_for = request.headers.get("x-forwarded-for", "")
    trusted_proxies = getattr(settings, "TRUSTED_PROXIES", ("127.0.0.1", "::1"))
    if isinstance(trusted_proxies, str):
        trusted_proxies = [proxy.strip() for proxy in trusted_proxies.split(",") if proxy.strip()]

    forwarded_ips = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
    if forwarded_ips and _is_trusted_proxy(remote_addr, trusted_proxies):
        return forwarded_ips[0]

    return remote_addr
