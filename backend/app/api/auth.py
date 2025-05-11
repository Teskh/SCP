import logging
import sqlite3
from flask import Blueprint, request, jsonify, current_app
from ..database.connection import get_db

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__) # The url_prefix will be set during registration in create_app

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'pin' not in data:
        return jsonify(error="PIN is required"), 400

    pin = data.get('pin')
    db = get_db()
    user_info = None
    user_type = None # e.g., 'worker', 'Supervisor', 'Admin', 'Gestión de producción'

    # Try to find in Workers table
    cursor = db.execute(
        "SELECT worker_id, first_name, last_name, specialty_id, supervisor_id, is_active FROM Workers WHERE pin = ? AND is_active = 1",
        (pin,)
    )
    worker = cursor.fetchone()

    if worker:
        user_data = dict(worker)
        user_info = {
            "id": user_data["worker_id"],
            "first_name": user_data["first_name"],
            "last_name": user_data["last_name"],
            "is_active": user_data["is_active"],
            "specialty_id": user_data.get("specialty_id"),
            "supervisor_id": user_data.get("supervisor_id")
        }
        user_type = 'worker'
        # Optionally fetch specialty name if needed by frontend upon login
        if user_info.get('specialty_id'):
            specialty_cursor = db.execute("SELECT name FROM Specialties WHERE specialty_id = ?", (user_info['specialty_id'],))
            specialty = specialty_cursor.fetchone()
            user_info['specialty_name'] = specialty['name'] if specialty else None
    else:
        # Try to find in AdminTeam table
        cursor = db.execute(
            "SELECT admin_team_id, first_name, last_name, role, is_active FROM AdminTeam WHERE pin = ? AND is_active = 1",
            (pin,)
        )
        admin_member = cursor.fetchone()
        if admin_member:
            user_data = dict(admin_member)
            user_info = {
                "id": user_data["admin_team_id"],
                "first_name": user_data["first_name"],
                "last_name": user_data["last_name"],
                "role": user_data["role"],
                "is_active": user_data["is_active"]
            }
            user_type = user_data['role'] # Use the specific admin role as user_type

    if user_info:
        logger.info(f"Login successful for user type: {user_type}, ID: {user_info['id']}")
        # For security, don't log the actual PIN or too much detail here in production
        return jsonify(message="Login successful", user=user_info, user_type=user_type), 200
    else:
        # Avoid logging PINs in production environments or use a truncated/hashed version for tracing
        logger.warning(f"Login failed for provided PIN.")
        return jsonify(error="Invalid PIN or user not active/found"), 401
