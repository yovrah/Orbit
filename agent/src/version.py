"""Single source of truth for the agent version.

The update checker compares releases against this string, so it must not drift
from what the release tag says — keep the bump in one place.
"""

__version__ = "1.0.5"

GITHUB_REPO = "yovrah/Orbit"
