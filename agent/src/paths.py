"""Path resolution that works both from source and from a PyInstaller build.

When frozen, PyInstaller unpacks bundled data (the built frontend, the logo)
next to the executable and exposes that root via ``sys._MEIPASS``. From source
those same files live in the repo tree. Writable state (logs, the SQLite DB)
must never live inside the bundle — it goes next to the .exe when frozen, or in
the repo's ``agent`` folder from source.
"""
import os
import sys

IS_FROZEN = getattr(sys, "frozen", False)


def bundle_root() -> str:
    """Read-only root where bundled resources (frontend/dist, icons) live."""
    if IS_FROZEN:
        # PyInstaller sets _MEIPASS to the extraction dir (onefile) or the
        # _internal folder (onedir); bundled `datas` land under it.
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    # From source: repo root is two levels up from this file (agent/src/..).
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def resource_path(rel: str) -> str:
    """Absolute path to a bundled, read-only resource (e.g. 'frontend/dist')."""
    return os.path.normpath(os.path.join(bundle_root(), rel))


def app_dir() -> str:
    """Folder for writable, per-install files (logs).

    Installed builds live in Program Files, which a standard user cannot write
    to, so writable state goes to %LOCALAPPDATA%\\Orbit rather than next to the
    .exe. (The SQLite DB has its own %APPDATA%\\Orbit\\config home.)
    """
    if IS_FROZEN:
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "Orbit")
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


def logs_dir() -> str:
    """Never raises: the windowed exe opens its log file at import time, so a
    failure here would kill the app before it could report anything."""
    path = os.path.join(app_dir(), "logs")
    try:
        os.makedirs(path, exist_ok=True)
        return path
    except OSError:
        import tempfile
        fallback = os.path.join(tempfile.gettempdir(), "Orbit", "logs")
        os.makedirs(fallback, exist_ok=True)
        return fallback
