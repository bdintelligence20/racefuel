"""Firebase ID token verification — STAGE C.

Stage B leaves /render unauthenticated for local-testing simplicity. Stage C will
verify the user's Firebase ID token via firebase_admin.auth.verify_id_token() and
enforce per-user rate limits before kicking off the render.
"""
from __future__ import annotations

# Placeholder — Stage C will populate this module with:
#
#   import firebase_admin
#   from firebase_admin import auth, credentials
#
#   firebase_admin.initialize_app(credentials.ApplicationDefault())
#
#   async def verify_id_token(authorization_header: str) -> str:
#       """Returns the Firebase uid for a valid Bearer token."""
#       ...
