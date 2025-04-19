from flask import Blueprint, request, jsonify, current_app
from ..database import queries

admin_bp = Blueprint('admin', __name__)

# === Error Handler ===
@admin_bp.errorhandler(Exception)
def handle_exception(e):
    # Log the error internally
    current_app.logger.error(f"Unhandled exception: {e}", exc_info=True)
    # Return a generic error message
    return jsonify(error="An internal server error occurred"), 500

# === Specialties Routes ===

@admin_bp.route('/specialties', methods=['GET'])
def get_specialties():
    """Get all specialties."""
    try:
        specialties = queries.get_all_specialties()
        return jsonify(specialties)
    except Exception as e:
        current_app.logger.error(f"Error in get_stations: {e}", exc_info=True)
        return jsonify(error="Failed to fetch stations"), 500


# === Workers Routes ===

@admin_bp.route('/workers', methods=['GET'])
def get_workers():
    """Get all workers."""
    try:
        workers = queries.get_all_workers()
        return jsonify(workers)
    except Exception as e:
        current_app.logger.error(f"Error in get_workers: {e}", exc_info=True)
        return jsonify(error="Failed to fetch workers"), 500

@admin_bp.route('/workers', methods=['POST'])
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

    try:
        new_id = queries.add_worker(first_name, last_name, pin, specialty_id, supervisor_id, is_active)
        if new_id:
            # Fetch the newly created worker to return it (or construct manually)
            new_worker = {
                'worker_id': new_id, 'first_name': first_name, 'last_name': last_name,
                'pin': pin, 'specialty_id': specialty_id, 'supervisor_id': supervisor_id,
                'is_active': is_active
                # Note: specialty_name and supervisor_name won't be here unless fetched again
            }
            return jsonify(new_worker), 201
        else:
            return jsonify(error="Failed to add worker"), 500
    except Exception as e:
        current_app.logger.error(f"Error in add_worker: {e}", exc_info=True)
        return jsonify(error="Failed to add worker"), 500


@admin_bp.route('/workers/<int:worker_id>', methods=['PUT'])
def update_worker(worker_id):
    """Update an existing worker."""
    data = request.get_json()
    if not data:
        return jsonify(error="Missing request data"), 400

    # Fetch existing worker data to handle partial updates if needed, or require all fields
    # For simplicity now, assume all editable fields are sent
    if not all(k in data for k in ('first_name', 'last_name', 'pin', 'is_active')):
         return jsonify(error="Missing required fields for update"), 400

    first_name = data.get('first_name')
    last_name = data.get('last_name')
    pin = data.get('pin')
    specialty_id = data.get('specialty_id') # Allow null
    supervisor_id = data.get('supervisor_id') # Allow null
    is_active = data.get('is_active')

    if not isinstance(is_active, bool):
        is_active = bool(is_active)

    # Prevent worker from being their own supervisor
    if supervisor_id is not None and int(supervisor_id) == worker_id:
        return jsonify(error="Worker cannot be their own supervisor"), 400

    try:
        success = queries.update_worker(worker_id, first_name, last_name, pin, specialty_id, supervisor_id, is_active)
        if success:
            updated_worker = {
                'worker_id': worker_id, 'first_name': first_name, 'last_name': last_name,
                'pin': pin, 'specialty_id': specialty_id, 'supervisor_id': supervisor_id,
                'is_active': is_active
                 # Note: Names for specialty/supervisor not included unless fetched again
            }
            return jsonify(updated_worker)
        else:
            # Could be not found or DB error during update
            return jsonify(error="Worker not found or update failed"), 404
    except Exception as e:
        current_app.logger.error(f"Error in update_worker: {e}", exc_info=True)
        return jsonify(error="Failed to update worker"), 500


@admin_bp.route('/workers/<int:worker_id>', methods=['DELETE'])
def delete_worker(worker_id):
    """Delete a worker."""
    try:
        success = queries.delete_worker(worker_id)
        if success:
            return jsonify(message="Worker deleted successfully"), 200 # Or 204 No Content
        else:
            # Could be not found or DB error (e.g., foreign key constraint)
            return jsonify(error="Worker not found or delete failed (check dependencies)"), 404
    except Exception as e:
        current_app.logger.error(f"Error in delete_worker: {e}", exc_info=True)
        # Check for specific SQLite constraint errors if needed
        return jsonify(error="Failed to delete worker"), 500


@admin_bp.route('/specialties', methods=['POST'])
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
            return jsonify(error="Failed to add specialty, possibly duplicate name"), 409 # Conflict
    except Exception as e:
        current_app.logger.error(f"Error in get_stations: {e}", exc_info=True)
        return jsonify(error="Failed to fetch stations"), 500


# === House Parameters Routes ===

@admin_bp.route('/house_parameters', methods=['GET'])
def get_house_parameters():
    """Get all house parameter definitions."""
    try:
        params = queries.get_all_house_parameters()
        return jsonify(params)
    except Exception as e:
        current_app.logger.error(f"Error in get_house_parameters: {e}", exc_info=True)
        return jsonify(error="Failed to fetch house parameters"), 500

@admin_bp.route('/house_parameters', methods=['POST'])
def add_house_parameter():
    """Add a new house parameter definition."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    unit = data.get('unit', '') # Unit is optional
    try:
        new_id = queries.add_house_parameter(name, unit)
        if new_id:
            new_param = {'parameter_id': new_id, 'name': name, 'unit': unit}
            return jsonify(new_param), 201
        else:
            return jsonify(error="Failed to add house parameter, possibly duplicate name"), 409
    except Exception as e:
        current_app.logger.error(f"Error in add_house_parameter: {e}", exc_info=True)
        return jsonify(error="Failed to add house parameter"), 500

@admin_bp.route('/house_parameters/<int:parameter_id>', methods=['PUT'])
def update_house_parameter(parameter_id):
    """Update an existing house parameter definition."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    unit = data.get('unit', '')
    try:
        success = queries.update_house_parameter(parameter_id, name, unit)
        if success:
            updated_param = {'parameter_id': parameter_id, 'name': name, 'unit': unit}
            return jsonify(updated_param)
        else:
            return jsonify(error="House parameter not found or update failed"), 404
    except Exception as e:
        current_app.logger.error(f"Error in update_house_parameter: {e}", exc_info=True)
        return jsonify(error="Failed to update house parameter"), 500

@admin_bp.route('/house_parameters/<int:parameter_id>', methods=['DELETE'])
def delete_house_parameter(parameter_id):
    """Delete a house parameter definition."""
    try:
        success = queries.delete_house_parameter(parameter_id)
        if success:
            return jsonify(message="House parameter deleted successfully"), 200
        else:
            return jsonify(error="House parameter not found or delete failed (check dependencies)"), 404
    except Exception as e:
        current_app.logger.error(f"Error in delete_house_parameter: {e}", exc_info=True)
        return jsonify(error="Failed to delete house parameter"), 500


# === House Type Parameters (Linking) Routes ===

@admin_bp.route('/house_types/<int:house_type_id>/parameters', methods=['GET'])
def get_house_type_parameters(house_type_id):
    """Get all parameters assigned to a specific house type."""
    try:
        params = queries.get_parameters_for_house_type(house_type_id)
        return jsonify(params)
    except Exception as e:
        current_app.logger.error(f"Error getting parameters for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch parameters for house type"), 500

@admin_bp.route('/house_types/<int:house_type_id>/parameters', methods=['POST'])
def add_or_update_house_type_parameter_route(house_type_id):
    """Add or update a parameter value for a specific house type."""
    data = request.get_json()
    if not data or 'parameter_id' not in data or 'value' not in data:
        return jsonify(error="Missing required fields (parameter_id, value)"), 400

    parameter_id = data['parameter_id']
    try:
        # Validate value is numeric (float or int)
        value = float(data['value'])
    except (ValueError, TypeError):
        return jsonify(error="Invalid value, must be numeric"), 400

    try:
        success = queries.add_or_update_house_type_parameter(house_type_id, parameter_id, value)
        if success:
            # Ideally, return the updated/created resource representation
            return jsonify(message="Parameter value set successfully"), 200 # Or 201 if always creates
        else:
            # This might indicate a DB error or constraint violation not caught by UPSERT logic
            return jsonify(error="Failed to set parameter value for house type"), 500
    except Exception as e:
        current_app.logger.error(f"Error setting parameter for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to set parameter value"), 500

@admin_bp.route('/house_types/<int:house_type_id>/parameters/<int:parameter_id>', methods=['DELETE'])
def delete_parameter_from_house_type_route(house_type_id, parameter_id):
    """Remove a specific parameter link from a house type."""
    try:
        success = queries.delete_parameter_from_house_type(house_type_id, parameter_id)
        if success:
            return jsonify(message="Parameter link removed successfully"), 200
        else:
            # This implies the link didn't exist
            return jsonify(error="Parameter link not found for this house type"), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting parameter link for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to remove parameter link"), 500

# Optional: Route to delete by house_type_parameter_id if needed
# @admin_bp.route('/house_type_parameters/<int:house_type_parameter_id>', methods=['DELETE'])
# def delete_house_type_parameter_route(house_type_parameter_id):
#     """Remove a specific parameter link by its own ID."""
#     try:
#         success = queries.delete_house_type_parameter(house_type_parameter_id)
#         if success:
#             return jsonify(message="Parameter link removed successfully"), 200
#         else:
#             return jsonify(error="Parameter link not found"), 404
#     except Exception as e:
#         current_app.logger.error(f"Error deleting house type parameter {house_type_parameter_id}: {e}", exc_info=True)
#         return jsonify(error="Failed to remove parameter link"), 500


@admin_bp.route('/specialties/<int:specialty_id>', methods=['PUT'])
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
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_bp.route('/specialties/<int:specialty_id>', methods=['DELETE'])
def delete_specialty(specialty_id):
    """Delete a specialty."""
    try:
        success = queries.delete_specialty(specialty_id)
        if success:
            return jsonify(message="Specialty deleted successfully"), 200 # Or 204 No Content
        else:
            return jsonify(error="Specialty not found"), 404
    except Exception as e:
        # Handle potential foreign key constraints if necessary
        return jsonify(error=str(e)), 500


# === Task Definitions Routes ===

@admin_bp.route('/task_definitions', methods=['GET'])
def get_task_definitions():
    """Get all task definitions."""
    try:
        task_defs = queries.get_all_task_definitions()
        return jsonify(task_defs)
    except Exception as e:
        return jsonify(error=str(e)), 500

@admin_bp.route('/task_definitions', methods=['POST'])
def add_task_definition():
    """Add a new task definition."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing 'name' in request data"), 400

    # Extract data, allowing nulls for foreign keys
    name = data.get('name')
    description = data.get('description', '')
    house_type_id = data.get('house_type_id') # Can be None/null
    specialty_id = data.get('specialty_id')     # Can be None/null
    station_id = data.get('station_id')         # Can be None/null

    try:
        new_id = queries.add_task_definition(name, description, house_type_id, specialty_id, station_id)
        if new_id:
            # Fetch the newly created task def to return it
            # This is inefficient, ideally return input + ID or fetch selectively
            new_task_def = {
                'task_definition_id': new_id, 'name': name, 'description': description,
                'house_type_id': house_type_id, 'specialty_id': specialty_id, 'station_id': station_id
                # Note: Returning related names would require another query or joining in add_task_definition
            }
            return jsonify(new_task_def), 201
        else:
            return jsonify(error="Failed to add task definition, possibly duplicate name"), 409
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_bp.route('/task_definitions/<int:task_definition_id>', methods=['PUT'])
def update_task_definition(task_definition_id):
    """Update an existing task definition."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing 'name' in request data"), 400

    name = data.get('name')
    description = data.get('description', '')
    house_type_id = data.get('house_type_id')
    specialty_id = data.get('specialty_id')
    station_id = data.get('station_id')

    try:
        success = queries.update_task_definition(task_definition_id, name, description, house_type_id, specialty_id, station_id)
        if success:
            updated_task_def = {
                'task_definition_id': task_definition_id, 'name': name, 'description': description,
                'house_type_id': house_type_id, 'specialty_id': specialty_id, 'station_id': station_id
            }
            return jsonify(updated_task_def)
        else:
            return jsonify(error="Task Definition not found or update failed"), 404
    except Exception as e:
        return jsonify(error=str(e)), 500


@admin_bp.route('/task_definitions/<int:task_definition_id>', methods=['DELETE'])
def delete_task_definition(task_definition_id):
    """Delete a task definition."""
    try:
        success = queries.delete_task_definition(task_definition_id)
        if success:
            return jsonify(message="Task Definition deleted successfully"), 200
        else:
            return jsonify(error="Task Definition not found"), 404
    except Exception as e:
        return jsonify(error=str(e)), 500


# === Routes to get related data for dropdowns ===

@admin_bp.route('/house_types', methods=['GET'])
def get_house_types():
    """Get all house types for dropdowns."""
    try:
        types = queries.get_all_house_types()
        return jsonify(types)
    except Exception as e:
        current_app.logger.error(f"Error in get_house_types: {e}", exc_info=True)
        return jsonify(error="Failed to fetch house types"), 500

# Add CRUD endpoints for HouseTypes
@admin_bp.route('/house_types', methods=['POST'])
def add_house_type():
    """Add a new house type."""
    data = request.get_json()
    if not data or 'name' not in data or 'number_of_modules' not in data:
        return jsonify(error="Missing required fields (name, number_of_modules)"), 400
    try:
        num_modules = int(data['number_of_modules'])
        if num_modules <= 0:
            return jsonify(error="Number of modules must be positive"), 400
    except (ValueError, TypeError):
        return jsonify(error="Invalid number_of_modules"), 400

    name = data['name']
    description = data.get('description', '')

    try:
        new_id = queries.add_house_type(name, description, num_modules)
        if new_id:
            new_type = {'house_type_id': new_id, 'name': name, 'description': description, 'number_of_modules': num_modules}
            return jsonify(new_type), 201
        else:
            return jsonify(error="Failed to add house type, possibly duplicate name"), 409
    except Exception as e:
        current_app.logger.error(f"Error in add_house_type: {e}", exc_info=True)
        return jsonify(error="Failed to add house type"), 500

@admin_bp.route('/house_types/<int:house_type_id>', methods=['PUT'])
def update_house_type(house_type_id):
    """Update an existing house type."""
    data = request.get_json()
    if not data or 'name' not in data or 'number_of_modules' not in data:
        return jsonify(error="Missing required fields (name, number_of_modules)"), 400
    try:
        num_modules = int(data['number_of_modules'])
        if num_modules <= 0:
            return jsonify(error="Number of modules must be positive"), 400
    except (ValueError, TypeError):
        return jsonify(error="Invalid number_of_modules"), 400

    name = data['name']
    description = data.get('description', '')

    try:
        success = queries.update_house_type(house_type_id, name, description, num_modules)
        if success:
            updated_type = {'house_type_id': house_type_id, 'name': name, 'description': description, 'number_of_modules': num_modules}
            return jsonify(updated_type)
        else:
            return jsonify(error="House type not found or update failed"), 404
    except Exception as e:
        current_app.logger.error(f"Error in update_house_type: {e}", exc_info=True)
        return jsonify(error="Failed to update house type"), 500

@admin_bp.route('/house_types/<int:house_type_id>', methods=['DELETE'])
def delete_house_type(house_type_id):
    """Delete a house type."""
    try:
        success = queries.delete_house_type(house_type_id)
        if success:
            return jsonify(message="House type deleted successfully"), 200
        else:
            return jsonify(error="House type not found or delete failed (check dependencies)"), 404
    except Exception as e:
        current_app.logger.error(f"Error in delete_house_type: {e}", exc_info=True)
        return jsonify(error="Failed to delete house type"), 500


@admin_bp.route('/stations', methods=['GET'])
def get_stations():
    """Get all stations for dropdowns."""
    try:
        stations = queries.get_all_stations()
        return jsonify(stations)
    except Exception as e:
        return jsonify(error=str(e)), 500
