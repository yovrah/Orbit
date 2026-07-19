"""Start Orbit with Windows.

Writes the launch command into the per-user Run key. HKCU (not HKLM) keeps this
admin-free and scoped to the person who ticked the box.
"""
import logging
import os
import sys

APP_NAME = "Orbit"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"

log = logging.getLogger(__name__)


def _launch_command() -> str:
    """The command Windows should run at logon.

    Frozen build: the exe itself. From source: pythonw (no console window) plus
    the tray entry point, so autostart behaves like a normal launch either way.
    """
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'

    exe = sys.executable
    pythonw = os.path.join(os.path.dirname(exe), "pythonw.exe")
    if os.path.exists(pythonw):
        exe = pythonw
    tray = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tray.py")
    return f'"{exe}" "{tray}"'


def is_enabled() -> bool:
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, APP_NAME)
        return True
    except FileNotFoundError:
        return False
    except Exception as e:
        log.warning(f"Autostart check failed: {e!r}")
        return False


def enable() -> bool:
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, _launch_command())
        return True
    except Exception as e:
        log.error(f"Failed to enable autostart: {e!r}")
        return False


def disable() -> bool:
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except FileNotFoundError:
                pass
        return True
    except Exception as e:
        log.error(f"Failed to disable autostart: {e!r}")
        return False


def toggle() -> bool:
    """Flips the setting and returns the state it ended up in."""
    if is_enabled():
        disable()
    else:
        enable()
    return is_enabled()
