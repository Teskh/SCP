import logging
from flask import Blueprint, request, jsonify, current_app
from ..database import queries # connection and sqlite3 might not be needed anymore

# Configure logging
# logging.basicConfig(level=logging.INFO) # Basic config might be done globally
logger = logging.getLogger(__name__) # Use logger specific to this module

admin_bp = Blueprint('admin', __name__)

# === Error Handler ===
@admin_bp.errorhandler(Exception)
def handle_exception(e):
    # Log the error internally
    current_app.logger.error(f"Unhandled exception in admin_bp: {e}", exc_info=True)
    # Return a generic error message
    return jsonify(error="An internal server error occurred"), 500

# This blueprint is now empty of routes, as they have been moved to:
# - admin_personnel.py (Specialties, Workers, Admin Team, Supervisors)
# - admin_projects.py (Projects, Production Plan, Production Status)
# - admin_definitions.py (House Types, Tipologias, House Parameters, Multiwalls, Panels, Task Definitions, Stations)

# If this blueprint is no longer needed (i.e., no routes are registered directly
# under the '/admin' prefix that aren't covered by the sub-blueprints),
# this file and its registration in __init__.py can be removed entirely.
# Keeping it minimal for now in case it's still registered.
