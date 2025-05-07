import logging
import sqlite3
from flask import Blueprint, request, jsonify, current_app
from ..database import queries, connection # Import connection if needed for direct db access

# Configure logging for this blueprint
logger = logging.getLogger(__name__)

admin_personnel_bp = Blueprint('admin_personnel', __name__, url_prefix='/admin')

# === Error Handler ===
# This handler is specific to this blueprint. A global handler might also be needed.
@admin_personnel_bp.errorhandler(Exception)
def handle_exception(e):
    # Log the error internally
    logger.error(f"Unhandled exception in admin_personnel: {e}", exc_info=True)
    # Return a generic error message
    return jsonify(error="An internal server error occurred"), 500

# === Specialties Routes ===

@admin_personnel_bp.route('/specialties', methods=['GET'])
def get_specialties():
    """Get all specialties."""
    try:
        specialties = queries.get_all_specialties()
        return jsonify(specialties)
    except Exception as e:
        logger.error(f"Error in get_specialties: {e}", exc_info=True)
        return jsonify(error="Failed to fetch specialties"), 500

@admin_personnel_bp.route('/specialties', methods=['POST'])
def add_specialty():
    """Add a new specialty."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing 'name' in request data"), 400

    name = data.get('name')
    description = data.get('description', '') # Optional description

    try:
        new_id = queries.add_specialty(name, description)
        if new_id:
            # Fetch the newly created specialty to return it
            # This might be inefficient; consider returning the input data + ID
            new_specialty = {'specialty_id': new_id, 'name': name, 'description': description}
            return jsonify(new_specialty), 201
        else:
            # Check for specific errors if add_specialty can return None without exception
             # e.g., duplicate name if not handled by IntegrityError
             # Assuming a query like get_specialty_by_name exists for this check
             existing = queries.get_specialty_by_name(name) # This query needs to exist in queries.py
             if existing:
                 return jsonify(error="Specialty name already exists"), 409 # Conflict
             else:
                 return jsonify(error="Failed to add specialty for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         # Handle potential unique constraint violation if not caught above
         if 'UNIQUE constraint failed: Specialties.name' in str(ie):
             return jsonify(error="Specialty name already exists"), 409 # Conflict
         else:
             logger.error(f"Integrity error adding specialty: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_specialty: {e}", exc_info=True)
        return jsonify(error="Failed to add specialty"), 500


@admin_personnel_bp.route('/specialties/<int:specialty_id>', methods=['PUT'])
def update_specialty(specialty_id):
    """Update an existing specialty."""
    data = request.get_json()
    if not data or 'name' not in data:
         return jsonify(error="Missing 'name' in request data"), 400

    name = data.get('name')
    description = data.get('description', '')

    try:
        success = queries.update_specialty(specialty_id, name, description)
        if success:
            updated_specialty = {'specialty_id': specialty_id, 'name': name, 'description': description}
            return jsonify(updated_specialty)
        else:
            return jsonify(error="Specialty not found or update failed"), 404
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Specialties.name' in str(ie):
             return jsonify(error="Specialty name already exists"), 409 # Conflict
         else:
             logger.error(f"Integrity error updating specialty: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_specialty {specialty_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update specialty"), 500

@admin_personnel_bp.route('/specialties/<int:specialty_id>', methods=['DELETE'])
def delete_specialty(specialty_id):
    """Delete a specialty."""
    try:
        success = queries.delete_specialty(specialty_id)
        if success:
            return jsonify(message="Specialty deleted successfully"), 200 # Or 204 No Content
        else:
            # Could be not found or DB error (e.g., foreign key constraint)
            return jsonify(error="Specialty not found or delete failed (check dependencies)"), 404
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting specialty {specialty_id}: {ie}")
        return jsonify(error="Cannot delete specialty, it is currently assigned to workers or tasks."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_specialty {specialty_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete specialty"), 500


# === Workers Routes ===

@admin_personnel_bp.route('/workers', methods=['GET'])
def get_workers():
    """Get all workers."""
    try:
        workers = queries.get_all_workers()
        return jsonify(workers)
    except Exception as e:
        logger.error(f"Error in get_workers: {e}", exc_info=True)
        return jsonify(error="Failed to fetch workers"), 500

@admin_personnel_bp.route('/workers', methods=['POST'])
def add_worker():
    """Add a new worker."""
    data = request.get_json()
    if not data or not all(k in data for k in ('first_name', 'last_name', 'pin')):
        return jsonify(error="Missing required fields (first_name, last_name, pin)"), 400

    # Extract data, handle optional fields and types
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    pin = data.get('pin') # Ensure PIN validation/hashing if needed later
    specialty_id = data.get('specialty_id') # Can be None/null
    supervisor_id = data.get('supervisor_id') # Can be None/null
    is_active = data.get('is_active', True) # Default to active

    # Basic validation
    if not isinstance(is_active, bool):
         # Frontend might send 1/0, adjust if necessary or enforce boolean
         is_active = bool(is_active)

    # Basic PIN validation (e.g., length) - Add more robust validation as needed
    if not pin or len(str(pin)) < 4:
         return jsonify(error="PIN must be at least 4 digits"), 400

    try:
        new_id = queries.add_worker(first_name, last_name, pin, specialty_id, supervisor_id, is_active)
        if new_id:
            # Fetch the newly created worker to return it (or construct manually)
            # Fetching ensures related names are included if the query joins them
            # Assuming a query like get_worker_by_id exists
            new_worker = queries.get_worker_by_id(new_id) # This query needs to exist in queries.py
            if new_worker:
                 return jsonify(new_worker), 201
            else:
                 # Fallback if get_worker_by_id fails or doesn't exist
                 new_worker_basic = {
                     'worker_id': new_id, 'first_name': first_name, 'last_name': last_name,
                     'pin': pin, 'specialty_id': specialty_id, 'supervisor_id': supervisor_id,
                     'is_active': is_active
                 }
                 return jsonify(new_worker_basic), 201
        else:
             # Check for specific errors if add_worker can return None without exception
             # e.g., duplicate PIN if not handled by IntegrityError
             # Assuming a query like get_worker_by_pin exists
             existing = queries.get_worker_by_pin(pin) # This query needs to exist in queries.py
             if existing:
                 return jsonify(error="Worker PIN already exists"), 409 # Conflict
             else:
                 return jsonify(error="Failed to add worker for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Workers.pin' in str(ie):
             return jsonify(error="Worker PIN already exists"), 409 # Conflict
         elif 'FOREIGN KEY constraint failed' in str(ie):
             # Check if specialty_id or supervisor_id is invalid
             logger.warning(f"Foreign key constraint error adding worker: {ie}")
             return jsonify(error="Invalid specialty or supervisor specified"), 400
         else:
             logger.error(f"Integrity error adding worker: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_worker: {e}", exc_info=True)
        return jsonify(error="Failed to add worker"), 500


@admin_personnel_bp.route('/workers/<int:worker_id>', methods=['PUT'])
def update_worker(worker_id):
    """Update an existing worker."""
    data = request.get_json()
    if not data:
        return jsonify(error="Missing request data"), 400

    # Fetch existing worker data to handle partial updates if needed, or require all fields
    # For simplicity now, assume all editable fields are sent
    if not all(k in data for k in ('first_name', 'last_name', 'pin', 'is_active')):
         return jsonify(error="Missing required fields for update (first_name, last_name, pin, is_active)"), 400

    first_name = data.get('first_name')
    last_name = data.get('last_name')
    pin = data.get('pin')
    specialty_id = data.get('specialty_id') # Allow null
    supervisor_id = data.get('supervisor_id') # Allow null
    is_active = data.get('is_active')

    if not isinstance(is_active, bool):
        is_active = bool(is_active)

    # Basic PIN validation
    if not pin or len(str(pin)) < 4:
         return jsonify(error="PIN must be at least 4 digits"), 400

    # supervisor_id now refers to AdminTeam.admin_team_id, so the check for self-supervision is no longer applicable here.
    # If an admin can also be a worker, further logic might be needed, but based on current schema, they are distinct.

    try:
        success = queries.update_worker(worker_id, first_name, last_name, pin, specialty_id, supervisor_id, is_active)
        if success:
            # Fetch updated worker data to include potentially changed names
            # Assuming a query like get_worker_by_id exists
            updated_worker = queries.get_worker_by_id(worker_id) # This query needs to exist in queries.py
            if updated_worker:
                return jsonify(updated_worker)
            else:
                 # Fallback if fetch fails
                 updated_worker_basic = {
                     'worker_id': worker_id, 'first_name': first_name, 'last_name': last_name,
                     'pin': pin, 'specialty_id': specialty_id, 'supervisor_id': supervisor_id,
                     'is_active': is_active
                 }
                 return jsonify(updated_worker_basic)
        else:
            # Could be not found or DB error during update
            # Check if worker exists first
            existing = queries.get_worker_by_id(worker_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Worker not found"), 404
            else:
                 return jsonify(error="Worker update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Workers.pin' in str(ie):
             return jsonify(error="Worker PIN already exists"), 409 # Conflict
         elif 'FOREIGN KEY constraint failed' in str(ie):
             logger.warning(f"Foreign key constraint error updating worker {worker_id}: {ie}")
             return jsonify(error="Invalid specialty or supervisor specified"), 400
         else:
             logger.error(f"Integrity error updating worker {worker_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_worker {worker_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update worker"), 500


@admin_personnel_bp.route('/workers/<int:worker_id>', methods=['DELETE'])
def delete_worker(worker_id):
    """Delete a worker."""
    try:
        success = queries.delete_worker(worker_id)
        if success:
            return jsonify(message="Worker deleted successfully"), 200 # Or 204 No Content
        else:
            # Could be not found or DB error (e.g., foreign key constraint)
            # Check if worker exists first
            existing = queries.get_worker_by_id(worker_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Worker not found"), 404
            else:
                 # If delete failed but worker exists, likely a constraint issue
                 logger.warning(f"Delete failed for worker {worker_id}, possibly due to dependencies.")
                 return jsonify(error="Worker delete failed, check dependencies (e.g., task logs)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting worker {worker_id}: {ie}")
        return jsonify(error="Cannot delete worker, check dependencies (e.g., task logs)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_worker {worker_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete worker"), 500


# === Admin Team Routes ===

@admin_personnel_bp.route('/admin_team', methods=['GET'])
def get_admin_team():
    """Get all admin team members."""
    try:
        members = queries.get_all_admin_team()
        return jsonify(members)
    except Exception as e:
        logger.error(f"Error in get_admin_team: {e}", exc_info=True)
        return jsonify(error="Failed to fetch admin team members"), 500

@admin_personnel_bp.route('/admin_team', methods=['POST'])
def add_admin_team_member():
    """Add a new admin team member."""
    data = request.get_json()
    required_fields = ['first_name', 'last_name', 'role', 'pin']
    if not data or not all(k in data for k in required_fields):
        return jsonify(error=f"Missing required fields: {', '.join(required_fields)}"), 400

    first_name = data['first_name']
    last_name = data['last_name']
    role = data['role']
    pin = data['pin'] # Add validation/hashing if needed
    is_active = data.get('is_active', True)

    if not isinstance(is_active, bool):
        is_active = bool(is_active)

    # Basic PIN validation (e.g., length)
    if not pin or len(str(pin)) < 4:
         return jsonify(error="PIN must be at least 4 digits"), 400

    try:
        new_id = queries.add_admin_team_member(first_name, last_name, role, pin, is_active)
        if new_id:
            new_member = {
                'admin_team_id': new_id, 'first_name': first_name, 'last_name': last_name,
                'role': role, 'pin': pin, 'is_active': is_active
            }
            return jsonify(new_member), 201
        else:
            # Check for specific errors if add_admin_team_member can return None without exception
            # Assuming a query like get_admin_member_by_pin exists
            existing = queries.get_admin_member_by_pin(pin) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="Admin PIN already exists"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add admin team member for an unknown reason"), 500
    except ValueError as ve: # Catch role validation error from query
        return jsonify(error=str(ve)), 400
    except sqlite3.IntegrityError as ie: # Catch unique constraint errors (e.g., PIN)
         # Check if the error message indicates a PIN conflict
         if 'UNIQUE constraint failed: AdminTeam.pin' in str(ie):
             return jsonify(error="Admin PIN already exists"), 409 # Conflict
         else:
             logger.error(f"Integrity error adding admin team member: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_admin_team_member: {e}", exc_info=True)
        return jsonify(error="Failed to add admin team member"), 500


@admin_personnel_bp.route('/admin_team/<int:admin_team_id>', methods=['PUT'])
def update_admin_team_member(admin_team_id):
    """Update an existing admin team member."""
    data = request.get_json()
    required_fields = ['first_name', 'last_name', 'role', 'pin', 'is_active']
    if not data or not all(k in data for k in required_fields):
        return jsonify(error=f"Missing required fields for update: {', '.join(required_fields)}"), 400

    first_name = data['first_name']
    last_name = data['last_name']
    role = data['role']
    pin = data['pin']
    is_active = data['is_active']

    if not isinstance(is_active, bool):
        is_active = bool(is_active)

    # Basic PIN validation
    if not pin or len(str(pin)) < 4:
         return jsonify(error="PIN must be at least 4 digits"), 400

    try:
        success = queries.update_admin_team_member(admin_team_id, first_name, last_name, role, pin, is_active)
        if success:
            updated_member = {
                'admin_team_id': admin_team_id, 'first_name': first_name, 'last_name': last_name,
                'role': role, 'pin': pin, 'is_active': is_active
            }
            return jsonify(updated_member)
        else:
            return jsonify(error="Admin team member not found or update failed"), 404
    except ValueError as ve: # Catch role validation error
        return jsonify(error=str(ve)), 400
    except sqlite3.IntegrityError as ie: # Catch unique constraint errors (e.g., PIN)
         if 'UNIQUE constraint failed: AdminTeam.pin' in str(ie):
             return jsonify(error="PIN already exists"), 409 # Conflict
         else:
             logger.error(f"Integrity error updating admin team member: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_admin_team_member {admin_team_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update admin team member"), 500


@admin_personnel_bp.route('/admin_team/<int:admin_team_id>', methods=['DELETE'])
def delete_admin_team_member(admin_team_id):
    """Delete an admin team member."""
    try:
        success = queries.delete_admin_team_member(admin_team_id)
        if success:
            return jsonify(message="Admin team member deleted successfully"), 200 # Or 204
        else:
            return jsonify(error="Admin team member not found"), 404
    except sqlite3.IntegrityError as ie:
        logger.error(f"Integrity error deleting admin team member {admin_team_id}: {ie}", exc_info=True)
        # Check if they are a supervisor for any workers
        return jsonify(error="Cannot delete admin member, they might be assigned as a supervisor."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_admin_team_member {admin_team_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete admin team member"), 500

# === Supervisors Route ===

@admin_personnel_bp.route('/supervisors', methods=['GET'])
def get_supervisors():
    """Get all active admin team members with the 'Supervisor' role."""
    try:
        supervisors = queries.get_all_supervisors()
        return jsonify(supervisors)
    except Exception as e:
        logger.error(f"Error in get_supervisors: {e}", exc_info=True)
        return jsonify(error="Failed to fetch supervisors"), 500
