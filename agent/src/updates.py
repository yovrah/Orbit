"""Checks GitHub Releases for a newer Orbit build.

Notify-only: it never downloads or replaces anything, it just tells the user a
new version exists and links to the release page. Uses urllib so the agent
gains no new dependency.
"""
import json
import logging
import re
import threading
import time
import urllib.request

from version import GITHUB_REPO, __version__

log = logging.getLogger(__name__)

API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
CHECK_INTERVAL = 6 * 3600  # seconds

# Last known newer release, or None. Read by /ping so the phone can surface it.
LATEST = None


def _parse(v: str) -> tuple:
    """'v1.2.3' -> (1, 2, 3). Unparseable parts become 0 rather than raising,
    so a malformed tag can never crash the agent."""
    nums = re.findall(r"\d+", v or "")
    return tuple(int(n) for n in nums[:3]) or (0,)


def is_newer(latest: str, current: str) -> bool:
    return _parse(latest) > _parse(current)


def check_now(timeout: int = 10):
    """Returns release info if GitHub has a newer version, else None."""
    global LATEST
    try:
        req = urllib.request.Request(
            API_URL,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": f"Orbit/{__version__}",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)

        tag = (data.get("tag_name") or "").lstrip("v")
        if not tag:
            return None

        if is_newer(tag, __version__):
            LATEST = {
                "version": tag,
                "url": data.get("html_url"),
                "name": data.get("name") or f"v{tag}",
                "published_at": data.get("published_at"),
            }
            log.info(f"Update available: {tag} (running {__version__})")
            return LATEST

        LATEST = None
        return None
    except Exception as e:
        # Offline, rate-limited, DNS-blocked — all non-fatal by design. Printed
        # (not just logged) because in the windowed exe stdout is the log file,
        # and a frozen build failing TLS here would otherwise be invisible.
        print(f"Update check failed: {e!r}")
        return None


def start(on_update=None):
    """Checks shortly after launch, then every CHECK_INTERVAL, in the
    background. on_update(info) fires once per newly discovered version."""
    def loop():
        time.sleep(20)  # let the server finish coming up first
        notified = None
        while True:
            info = check_now()
            if info and on_update and info["version"] != notified:
                notified = info["version"]
                try:
                    on_update(info)
                except Exception as e:
                    log.warning(f"Update notification failed: {e!r}")
            time.sleep(CHECK_INTERVAL)

    threading.Thread(target=loop, daemon=True).start()


if __name__ == "__main__":
    assert is_newer("1.0.4", "1.0.3")
    assert is_newer("1.1.0", "1.0.9")
    assert is_newer("2.0.0", "1.9.9")
    assert not is_newer("1.0.3", "1.0.3")
    assert not is_newer("1.0.2", "1.0.3")
    assert not is_newer("", "1.0.3")
    assert is_newer("v1.0.10", "1.0.9")  # not string-compared
    print("version comparison ok")
