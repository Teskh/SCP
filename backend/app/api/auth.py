import logging
from flask import Blueprint, request, jsonify
from ..database import queries # Import queries module

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'pin' not in data:
        return jsonify(error="PIN is required"), 400

    pin = data.get('pin')
    user_info = None
    user_type = None # e.g., 'worker', 'Supervisor', 'Admin', 'Gestión de producción'

    # Try to find in Workers table using the query function
    worker_data = queries.get_worker_by_pin(pin) # This query now includes specialty_name

    if worker_data and worker_data.get('is_active'): # Ensure worker is active
        user_info = {
            "id": worker_data["worker_id"],
            "first_name": worker_data["first_name"],
            "last_name": worker_data["last_name"],
            "is_active": worker_data["is_active"],
            "specialty_id": worker_data.get("specialty_id"),
            "specialty_name": worker_data.get("specialty_name"), # Already fetched by get_worker_by_pin
            # supervisor_id is not typically needed by frontend upon login, but can be added if necessary
        }
        user_type = 'worker'
    else:
        # Try to find in AdminTeam table using the query function
        admin_data = queries.get_admin_member_by_pin(pin)
        
        if admin_data and admin_data.get('is_active'): # Ensure admin is active
            user_info = {
                "id": admin_data["admin_team_id"],
                "first_name": admin_data["first_name"],
                "last_name": admin_data["last_name"],
                "role": admin_data["role"],
                "is_active": admin_data["is_active"]
            }
            user_type = admin_data['role'] # Use the specific admin role as user_type

    if user_info:
        logger.info(f"Login successful for user type: {user_type}, ID: {user_info['id']}")
        return jsonify(message="Login successful", user=user_info, user_type=user_type), 200
    else:
        logger.warning(f"Login failed for provided PIN.") # Avoid logging the PIN itself
        return jsonify(error="Invalid PIN or user not active/found"), 401
