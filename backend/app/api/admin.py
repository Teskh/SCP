import logging # Import logging
import sqlite3 # Import sqlite3
from flask import Blueprint, request, jsonify, current_app
from ..database import queries, connection # Import connection to use get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        current_app.logger.error(f"Error in get_specialties: {e}", exc_info=True)
        return jsonify(error="Failed to fetch specialties"), 500

# === Projects Routes ===

@admin_bp.route('/projects', methods=['GET'])
def get_projects():
    """Get all projects with their associated house types."""
    try:
        projects = queries.get_all_projects()
        return jsonify(projects)
    except Exception as e:
        current_app.logger.error(f"Error in get_projects: {e}", exc_info=True)
        return jsonify(error="Failed to fetch projects"), 500

@admin_bp.route('/projects', methods=['POST'])
def add_project():
    """Add a new project."""
    data = request.get_json()
    if not data or 'name' not in data or 'house_types' not in data:
        return jsonify(error="Missing required fields (name, house_types)"), 400
    if not isinstance(data['house_types'], list) or not data['house_types']:
        return jsonify(error="'house_types' must be a non-empty list"), 400

    name = data['name']
    description = data.get('description', '')
    status = data.get('status', 'Planned') # Default status
    house_types_data = data['house_types']

    # Basic validation for house_types data
    for ht in house_types_data:
        if not isinstance(ht, dict) or 'house_type_id' not in ht or 'quantity' not in ht:
            return jsonify(error="Each item in 'house_types' must be an object with 'house_type_id' and 'quantity'"), 400
        try:
            int(ht['house_type_id'])
            quantity = int(ht['quantity'])
            if quantity <= 0:
                 return jsonify(error="Quantity must be a positive integer"), 400
        except (ValueError, TypeError):
            return jsonify(error="Invalid house_type_id or quantity (must be integers)"), 400

    try:
        new_id = queries.add_project(name, description, status, house_types_data)
        if new_id:
            # Fetch the newly created project to return it
            new_project = queries.get_project_by_id(new_id)
            return jsonify(new_project), 201
        else:
            # This might happen if the query function returns None without raising an exception
            return jsonify(error="Failed to add project"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Projects.name' in str(ie):
             return jsonify(error="Project name already exists"), 409 # Conflict
         else:
             current_app.logger.error(f"Integrity error adding project: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        current_app.logger.error(f"Error in add_project: {e}", exc_info=True)
        return jsonify(error="Failed to add project"), 500


@admin_bp.route('/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    """Get a single project by ID."""
    try:
        project = queries.get_project_by_id(project_id)
        if project:
            return jsonify(project)
        else:
            return jsonify(error="Project not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error in get_project {project_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch project"), 500


@admin_bp.route('/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """Update an existing project."""
    data = request.get_json()
    if not data or 'name' not in data or 'house_types' not in data:
        return jsonify(error="Missing required fields (name, house_types)"), 400
    if not isinstance(data['house_types'], list): # Allow empty list for update? Yes.
        return jsonify(error="'house_types' must be a list"), 400

    name = data['name']
    description = data.get('description', '')
    status = data.get('status', 'Planned')
    house_types_data = data['house_types']

    # Basic validation for house_types data
    for ht in house_types_data:
        if not isinstance(ht, dict) or 'house_type_id' not in ht or 'quantity' not in ht:
            return jsonify(error="Each item in 'house_types' must be an object with 'house_type_id' and 'quantity'"), 400
        try:
            int(ht['house_type_id'])
            quantity = int(ht['quantity'])
            if quantity <= 0:
                 return jsonify(error="Quantity must be a positive integer"), 400
        except (ValueError, TypeError):
            return jsonify(error="Invalid house_type_id or quantity (must be integers)"), 400

    try:
        success = queries.update_project(project_id, name, description, status, house_types_data)
        if success:
            updated_project = queries.get_project_by_id(project_id) # Fetch updated data
            return jsonify(updated_project)
        else:
            # Could be not found or DB error during update
            return jsonify(error="Project not found or update failed"), 404
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Projects.name' in str(ie):
             return jsonify(error="Project name already exists"), 409 # Conflict
         else:
             current_app.logger.error(f"Integrity error updating project: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        current_app.logger.error(f"Error in update_project {project_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update project"), 500


@admin_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project."""
    try:
        success = queries.delete_project(project_id)
        if success:
            return jsonify(message="Project deleted successfully"), 200 # Or 204 No Content
        else:
            return jsonify(error="Project not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error in delete_project {project_id}: {e}", exc_info=True)
        # Check for specific constraint errors if CASCADE delete isn't sufficient
        return jsonify(error="Failed to delete project"), 500


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
    """Add or update a parameter value for a specific module within a house type."""
    data = request.get_json()
    if not data or not all(k in data for k in ('parameter_id', 'module_sequence_number', 'value')):
        return jsonify(error="Missing required fields (parameter_id, module_sequence_number, value)"), 400

    parameter_id = data['parameter_id']
    module_sequence_number = data['module_sequence_number']
    value_str = data['value']

    # Validate value is numeric (float or int) and module sequence is positive integer
    try:
        value = float(value_str) if value_str is not None and value_str != '' else None # Allow clearing value? Or require non-empty? Let's require for now.
        if value is None:
             return jsonify(error="Value cannot be empty"), 400
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
            return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
        return jsonify(error="Invalid value (must be numeric) or module_sequence_number (must be integer)"), 400

    try:
        # Optional: Validate module_sequence_number against HouseType.number_of_modules
        # house_type = queries.get_house_type_by_id(house_type_id) # Need to implement this query
        # if not house_type or module_seq_int > house_type['number_of_modules']:
        #    return jsonify(error="module_sequence_number exceeds the number of modules for this house type"), 400

        success = queries.add_or_update_house_type_parameter(house_type_id, parameter_id, module_seq_int, value)
        if success:
            # Return the data that was set
            # Fetching the full object might be better if the query returned the ID
            result = {
                'house_type_id': house_type_id,
                'parameter_id': parameter_id,
                'module_sequence_number': module_seq_int,
                'value': value
            }
            return jsonify(result), 200 # OK, as it's an UPSERT
        else:
            # This might indicate a DB error or constraint violation not caught by UPSERT logic
            return jsonify(error="Failed to set parameter value for house type"), 500
    except Exception as e:
        current_app.logger.error(f"Error setting parameter for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to set parameter value"), 500

# New route to delete a specific parameter value for a specific module
@admin_bp.route('/house_types/<int:house_type_id>/parameters/<int:parameter_id>/module/<int:module_sequence_number>', methods=['DELETE'])
def delete_parameter_from_house_type_module_route(house_type_id, parameter_id, module_sequence_number):
    """Remove a specific parameter value for a specific module within a house type."""
    try:
        # Validate module sequence is positive integer
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        success = queries.delete_parameter_from_house_type_module(house_type_id, parameter_id, module_seq_int)
        if success:
            return jsonify(message="Parameter value removed successfully for this module"), 200 # Or 204
        else:
            # This implies the link didn't exist for this specific module
            return jsonify(error="Parameter value not found for this house type, parameter, and module sequence"), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting parameter value for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to remove parameter value"), 500


# === Multiwalls Routes ===

@admin_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/multiwalls', methods=['GET'])
def get_house_type_module_multiwalls(house_type_id, module_sequence_number):
    """Get all multiwalls for a specific module within a house type."""
    try:
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        multiwalls = queries.get_multiwalls_for_house_type_module(house_type_id, module_seq_int)
        return jsonify(multiwalls)
    except Exception as e:
        current_app.logger.error(f"Error getting multiwalls for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch multiwalls"), 500

@admin_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/multiwalls', methods=['POST'])
def add_house_type_module_multiwall(house_type_id, module_sequence_number):
    """Add a new multiwall to a specific module within a house type."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'multiwall_code')):
        return jsonify(error="Missing required fields (panel_group, multiwall_code)"), 400

    panel_group = data['panel_group']
    multiwall_code = data['multiwall_code']

    try:
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        new_id = queries.add_multiwall(house_type_id, module_seq_int, panel_group, multiwall_code)
        if new_id:
            new_multiwall = {
                'multiwall_id': new_id,
                'house_type_id': house_type_id,
                'module_sequence_number': module_seq_int,
                'panel_group': panel_group,
                'multiwall_code': multiwall_code
            }
            return jsonify(new_multiwall), 201
        else:
            return jsonify(error="Failed to add multiwall"), 500
    except (ValueError, sqlite3.IntegrityError) as e:
        current_app.logger.warning(f"Failed to add multiwall for house type {house_type_id}, module {module_seq_int}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Multiwall code already exists for this group and module"), 409
        elif 'CHECK constraint failed' in str(e) or isinstance(e, ValueError):
             return jsonify(error="Invalid panel group specified"), 400
        else:
             return jsonify(error=str(e)), 400
    except Exception as e:
        current_app.logger.error(f"Error adding multiwall for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to add multiwall"), 500

@admin_bp.route('/multiwalls/<int:multiwall_id>', methods=['PUT'])
def update_house_type_module_multiwall(multiwall_id):
    """Update an existing multiwall by its ID."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'multiwall_code')):
        return jsonify(error="Missing required fields (panel_group, multiwall_code)"), 400

    panel_group = data['panel_group']
    multiwall_code = data['multiwall_code']

    try:
        success = queries.update_multiwall(multiwall_id, panel_group, multiwall_code)
        if success:
            updated_multiwall = {
                'multiwall_id': multiwall_id,
                'panel_group': panel_group,
                'multiwall_code': multiwall_code
                # Note: house_type_id and module_sequence_number are not updated here
            }
            return jsonify(updated_multiwall), 200
        else:
            return jsonify(error="Multiwall not found or update failed"), 404
    except (ValueError, sqlite3.IntegrityError) as e:
        current_app.logger.warning(f"Failed to update multiwall {multiwall_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Multiwall code already exists for this group and module"), 409
        elif 'CHECK constraint failed' in str(e) or isinstance(e, ValueError):
             return jsonify(error="Invalid panel group specified"), 400
        else:
             return jsonify(error=str(e)), 400
    except Exception as e:
        current_app.logger.error(f"Error updating multiwall {multiwall_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update multiwall"), 500

@admin_bp.route('/multiwalls/<int:multiwall_id>', methods=['DELETE'])
def delete_house_type_module_multiwall(multiwall_id):
    """Delete a multiwall by its ID."""
    try:
        success = queries.delete_multiwall(multiwall_id)
        if success:
            return jsonify(message="Multiwall deleted successfully"), 200 # Or 204 No Content
        else:
            return jsonify(error="Multiwall not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting multiwall {multiwall_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete multiwall"), 500


# === House Type Panels Routes ===

@admin_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/panels', methods=['GET'])
def get_house_type_module_panels(house_type_id, module_sequence_number):
    """Get all panels for a specific module within a house type."""
    try:
        # Validate module sequence is positive integer
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        # Optional: Validate module_sequence_number against HouseType.number_of_modules
        # house_type = queries.get_house_type_by_id(house_type_id) # Need to implement this query
        # if not house_type or module_seq_int > house_type['number_of_modules']:
        #    return jsonify(error="module_sequence_number exceeds the number of modules for this house type"), 400

        panels = queries.get_panels_for_house_type_module(house_type_id, module_seq_int)
        return jsonify(panels)
    except Exception as e:
        current_app.logger.error(f"Error getting panels for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch panels"), 500

@admin_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/panels', methods=['POST'])
def add_house_type_module_panel(house_type_id, module_sequence_number):
    """Add a new panel to a specific module within a house type."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'panel_code')):
        return jsonify(error="Missing required fields (panel_group, panel_code)"), 400

    panel_group = data['panel_group']
    panel_code = data['panel_code']
    typology = data.get('typology') # Optional
    multiwall_id = data.get('multiwall_id') # Optional

    try:
        # Validate module sequence is positive integer
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        # Optional: Validate module_sequence_number against HouseType.number_of_modules
        # house_type = queries.get_house_type_by_id(house_type_id) # Need to implement this query
        # if not house_type or module_seq_int > house_type['number_of_modules']:
        #    return jsonify(error="module_sequence_number exceeds the number of modules for this house type"), 400

        new_id = queries.add_panel_to_house_type_module(house_type_id, module_seq_int, panel_group, panel_code, typology, multiwall_id)
        if new_id:
            # Fetch the newly added panel to get potentially joined multiwall_code
            # This is slightly less efficient but ensures consistency
            # Alternatively, construct manually if multiwall_code isn't needed immediately
            db = connection.get_db() # Get DB connection
            panel_cursor = db.execute(
                 """SELECT htp.house_type_panel_id, htp.panel_group, htp.panel_code, htp.typology,
                           htp.multiwall_id, mw.multiwall_code
                    FROM HouseTypePanels htp
                    LEFT JOIN Multiwalls mw ON htp.multiwall_id = mw.multiwall_id
                    WHERE htp.house_type_panel_id = ?""", (new_id,)
            )
            new_panel_row = panel_cursor.fetchone()
            if new_panel_row:
                 new_panel = dict(new_panel_row)
                 # Add back house_type_id and module_sequence_number if needed by frontend
                 new_panel['house_type_id'] = house_type_id
                 new_panel['module_sequence_number'] = module_seq_int
                 return jsonify(new_panel), 201
            else:
                 # Should not happen if insert succeeded, but handle defensively
                 return jsonify(error="Failed to retrieve newly added panel"), 500
        else:
            # This case might not be reached if exceptions are raised properly
            return jsonify(error="Failed to add panel"), 500
    except (ValueError, sqlite3.IntegrityError) as e: # Catch validation or constraint errors
        current_app.logger.warning(f"Failed to add panel for house type {house_type_id}, module {module_seq_int}: {e}")
        # Provide more specific error messages based on the exception type if needed
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
        elif 'CHECK constraint failed' in str(e):
             return jsonify(error="Invalid panel group specified"), 400 # Bad Request
        elif "Panel group must match the assigned multiwall's group" in str(e):
             return jsonify(error="Panel group must match the assigned multiwall's group"), 400
        elif "Assigned multiwall_id" in str(e) and "does not exist" in str(e):
             return jsonify(error="Assigned multiwall does not exist"), 400
        else:
             return jsonify(error=str(e)), 400 # Bad Request for other ValueErrors
    except Exception as e:
        current_app.logger.error(f"Error adding panel for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to add panel"), 500
    except (ValueError, sqlite3.IntegrityError) as e: # Catch validation or constraint errors
        current_app.logger.warning(f"Failed to add panel for house type {house_type_id}, module {module_seq_int}: {e}")
        # Provide more specific error messages based on the exception type if needed
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
        elif 'CHECK constraint failed' in str(e):
             return jsonify(error="Invalid panel group specified"), 400 # Bad Request
        else:
             return jsonify(error=str(e)), 400 # Bad Request for other ValueErrors
    except Exception as e:
        current_app.logger.error(f"Error adding panel for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to add panel"), 500

# Use house_type_panel_id for PUT and DELETE as it's the primary key
@admin_bp.route('/house_type_panels/<int:house_type_panel_id>', methods=['PUT'])
def update_house_type_module_panel(house_type_panel_id):
    """Update an existing panel by its ID."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'panel_code')):
        return jsonify(error="Missing required fields (panel_group, panel_code)"), 400

    panel_group = data['panel_group']
    panel_code = data['panel_code']
    typology = data.get('typology') # Optional
    multiwall_id = data.get('multiwall_id') # Optional

    try:
        success = queries.update_panel_for_house_type_module(house_type_panel_id, panel_group, panel_code, typology, multiwall_id)
        if success:
            # Fetch the updated panel to return potentially updated multiwall_code
            db = connection.get_db() # Get DB connection
            panel_cursor = db.execute(
                 """SELECT htp.house_type_panel_id, htp.panel_group, htp.panel_code, htp.typology,
                           htp.multiwall_id, mw.multiwall_code
                    FROM HouseTypePanels htp
                    LEFT JOIN Multiwalls mw ON htp.multiwall_id = mw.multiwall_id
                    WHERE htp.house_type_panel_id = ?""", (house_type_panel_id,)
            )
            updated_panel_row = panel_cursor.fetchone()
            if updated_panel_row:
                 updated_panel = dict(updated_panel_row)
                 # Add back house_type_id and module_sequence_number if needed by frontend
                 # These are not updated, but might be useful context
                 # ht_cursor = current_app.db.execute("SELECT house_type_id, module_sequence_number FROM HouseTypePanels WHERE house_type_panel_id = ?", (house_type_panel_id,))
                 # ht_info = ht_cursor.fetchone()
                 # if ht_info:
                 #      updated_panel['house_type_id'] = ht_info['house_type_id']
                 #      updated_panel['module_sequence_number'] = ht_info['module_sequence_number']
                 return jsonify(updated_panel), 200
            else:
                 # Should not happen if update succeeded, but handle defensively
                 return jsonify(error="Failed to retrieve updated panel"), 500
        else:
            return jsonify(error="Panel not found or update failed"), 404
    except (ValueError, sqlite3.IntegrityError) as e: # Catch validation or constraint errors
        current_app.logger.warning(f"Failed to update panel {house_type_panel_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
        elif 'CHECK constraint failed' in str(e):
             return jsonify(error="Invalid panel group specified"), 400 # Bad Request
        elif "Panel group must match the assigned multiwall's group" in str(e):
             return jsonify(error="Panel group must match the assigned multiwall's group"), 400
        elif "Assigned multiwall_id" in str(e) and "does not exist" in str(e):
             return jsonify(error="Assigned multiwall does not exist"), 400
        else:
             return jsonify(error=str(e)), 400 # Bad Request
    except Exception as e:
        current_app.logger.error(f"Error updating panel {house_type_panel_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update panel"), 500
    except (ValueError, sqlite3.IntegrityError) as e: # Catch validation or constraint errors
        current_app.logger.warning(f"Failed to update panel {house_type_panel_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
        elif 'CHECK constraint failed' in str(e):
             return jsonify(error="Invalid panel group specified"), 400 # Bad Request
        else:
             return jsonify(error=str(e)), 400 # Bad Request
    except Exception as e:
        current_app.logger.error(f"Error updating panel {house_type_panel_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update panel"), 500

@admin_bp.route('/house_type_panels/<int:house_type_panel_id>', methods=['DELETE'])
def delete_house_type_module_panel(house_type_panel_id):
    """Delete a panel by its ID."""
    try:
        success = queries.delete_panel_from_house_type_module(house_type_panel_id)
        if success:
            return jsonify(message="Panel deleted successfully"), 200 # Or 204 No Content
        else:
            return jsonify(error="Panel not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting panel {house_type_panel_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete panel"), 500


# Route to delete by the specific HouseTypeParameter link ID (useful if frontend has it)
# @admin_bp.route('/house_type_parameters/<int:house_type_parameter_id>', methods=['DELETE']) # Commented out as per original code
# def delete_house_type_parameter_route(house_type_parameter_id):
    """Remove a specific parameter link by its own ID."""
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
        current_app.logger.error(f"Error in get_stations: {e}", exc_info=True)
        return jsonify(error="Failed to fetch stations"), 500

# === Admin Team Routes ===

@admin_bp.route('/admin_team', methods=['GET'])
def get_admin_team():
    """Get all admin team members."""
    try:
        members = queries.get_all_admin_team()
        return jsonify(members)
    except Exception as e:
        current_app.logger.error(f"Error in get_admin_team: {e}", exc_info=True)
        return jsonify(error="Failed to fetch admin team members"), 500

@admin_bp.route('/admin_team', methods=['POST'])
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
    if len(str(pin)) < 4:
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
            # This case might not be reached if exceptions are raised properly in queries
            return jsonify(error="Failed to add admin team member"), 500
    except ValueError as ve: # Catch role validation error from query
        return jsonify(error=str(ve)), 400
    except sqlite3.IntegrityError as ie: # Catch unique constraint errors (e.g., PIN)
         # Check if the error message indicates a PIN conflict
         if 'UNIQUE constraint failed: AdminTeam.pin' in str(ie):
             return jsonify(error="PIN already exists"), 409 # Conflict
         else:
             current_app.logger.error(f"Integrity error adding admin team member: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        current_app.logger.error(f"Error in add_admin_team_member: {e}", exc_info=True)
        return jsonify(error="Failed to add admin team member"), 500


@admin_bp.route('/admin_team/<int:admin_team_id>', methods=['PUT'])
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
    if len(str(pin)) < 4:
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
             current_app.logger.error(f"Integrity error updating admin team member: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        current_app.logger.error(f"Error in update_admin_team_member: {e}", exc_info=True)
        return jsonify(error="Failed to update admin team member"), 500


@admin_bp.route('/admin_team/<int:admin_team_id>', methods=['DELETE'])
def delete_admin_team_member(admin_team_id):
    """Delete an admin team member."""
    try:
        success = queries.delete_admin_team_member(admin_team_id)
        if success:
            return jsonify(message="Admin team member deleted successfully"), 200 # Or 204
        else:
            return jsonify(error="Admin team member not found"), 404
    except Exception as e:
        current_app.logger.error(f"Error in delete_admin_team_member: {e}", exc_info=True)
        return jsonify(error="Failed to delete admin team member"), 500

@admin_bp.route('/supervisors', methods=['GET'])
def get_supervisors():
    """Get all active admin team members with the 'Supervisor' role."""
    try:
        supervisors = queries.get_all_supervisors()
        return jsonify(supervisors)
    except Exception as e:
        current_app.logger.error(f"Error in get_supervisors: {e}", exc_info=True)
        return jsonify(error="Failed to fetch supervisors"), 500


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


# === Production Plan Routes ===

# Note: POST, PUT, DELETE for /production_plan are removed as plan generation
# is now handled automatically via the PUT /projects/<id> endpoint when status changes.

@admin_bp.route('/production_plan', methods=['GET'])
def get_production_plan_route():
    """Get production plan items with filtering, sorting, pagination."""
    try:
        # Extract query parameters
        filters = {
            'project_id': request.args.get('projectId'),
            'house_type_id': request.args.get('houseTypeId'),
            'status': request.args.get('status'),
            'start_date_after': request.args.get('startDateAfter'),
            # Add more filters as needed
        }
        # Remove None values from filters
        filters = {k: v for k, v in filters.items() if v is not None}

        sort_by = request.args.get('sortBy', 'planned_sequence')
        sort_order = request.args.get('sortOrder', 'ASC')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)

        plan_items = queries.get_production_plan(
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        # Could also return total count for pagination headers if needed
        return jsonify(plan_items)
    except Exception as e:
        current_app.logger.error(f"Error in get_production_plan_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch production plan"), 500

@admin_bp.route('/production_plan/reorder', methods=['POST'])
def reorder_production_plan():
    """Reorders production plan items based on a list of plan_ids."""
    data = request.get_json()
    if not data or 'ordered_plan_ids' not in data or not isinstance(data['ordered_plan_ids'], list):
        return jsonify(error="Missing or invalid 'ordered_plan_ids' list in request data"), 400

    ordered_plan_ids = data['ordered_plan_ids']

    # Optional: Basic validation if IDs are integers
    try:
        ordered_plan_ids = [int(pid) for pid in ordered_plan_ids]
    except (ValueError, TypeError):
        return jsonify(error="All items in 'ordered_plan_ids' must be integers"), 400

    try:
        success = queries.update_production_plan_sequence(ordered_plan_ids)
        if success:
            return jsonify(message="Production plan reordered successfully"), 200
        else:
            # This could be due to a database error during the transaction
            return jsonify(error="Failed to reorder production plan"), 500
    except Exception as e:
        current_app.logger.error(f"Error in reorder_production_plan: {e}", exc_info=True)
        return jsonify(error="An internal error occurred during reordering"), 500


# Removed PUT and DELETE endpoints for /production_plan/<plan_id>

@admin_bp.route('/production_status', methods=['GET'])
def get_production_status_route():
    """Get current station status and all upcoming planned items."""
    try:
        # upcoming_count parameter is removed
        status_data = queries.get_station_status_and_upcoming() # Call without count
        return jsonify(status_data)
    except Exception as e:
        current_app.logger.error(f"Error in get_production_status_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch production status"), 500


@admin_bp.route('/stations', methods=['GET'])
def get_stations():
    """Get all stations for dropdowns."""
    try:
        stations = queries.get_all_stations()
        return jsonify(stations)
    except Exception as e:
        return jsonify(error=str(e)), 500
