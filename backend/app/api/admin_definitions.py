import logging
import sqlite3
from flask import Blueprint, request, jsonify, current_app
from ..database import queries, connection # Import connection for direct db access if needed

# Configure logging for this blueprint
logger = logging.getLogger(__name__)

admin_definitions_bp = Blueprint('admin_definitions', __name__, url_prefix='/admin')

# === Error Handler ===
# This handler is specific to this blueprint. A global handler might also be needed.
@admin_definitions_bp.errorhandler(Exception)
def handle_exception(e):
    # Log the error internally
    logger.error(f"Unhandled exception in admin_definitions: {e}", exc_info=True)
    # Return a generic error message
    return jsonify(error="An internal server error occurred"), 500

# === House Types Routes ===

@admin_definitions_bp.route('/house_types', methods=['GET'])
def get_house_types():
    """Get all house types for dropdowns."""
    try:
        types = queries.get_all_house_types()
        return jsonify(types)
    except Exception as e:
        logger.error(f"Error in get_house_types: {e}", exc_info=True)
        return jsonify(error="Failed to fetch house types"), 500

@admin_definitions_bp.route('/house_types', methods=['POST'])
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
            # Check for specific errors if add_house_type can return None without exception
            # Assuming a query like get_house_type_by_name exists
            existing = queries.get_house_type_by_name(name) # This query needs to exist in queries.py
            if existing:
                return jsonify(error="House type name already exists"), 409 # Conflict
            else:
                return jsonify(error="Failed to add house type for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed: HouseTypes.name' in str(ie):
            return jsonify(error="House type name already exists"), 409 # Conflict
        else:
            logger.error(f"Integrity error adding house type: {ie}", exc_info=True)
            return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_house_type: {e}", exc_info=True)
        return jsonify(error="Failed to add house type"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>', methods=['PUT'])
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
            # Check if house type exists first
            existing = queries.get_house_type_by_id(house_type_id) # This query needs to exist in queries.py
            if not existing:
                return jsonify(error="House type not found"), 404
            else:
                return jsonify(error="House type update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed: HouseTypes.name' in str(ie):
            # Check if the conflict is with itself or another house type
            # Assuming a query like get_house_type_by_name exists
            existing = queries.get_house_type_by_name(name) # This query needs to exist in queries.py
            if existing and existing['house_type_id'] != house_type_id:
                return jsonify(error="House type name already exists"), 409 # Conflict
            else: # If name didn't change or conflict is with self, it's another error
                logger.error(f"Integrity error updating house type {house_type_id}: {ie}", exc_info=True)
                return jsonify(error="Database integrity error"), 409
        else:
            logger.error(f"Integrity error updating house type {house_type_id}: {ie}", exc_info=True)
            return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_house_type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update house type"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>', methods=['DELETE'])
def delete_house_type(house_type_id):
    """Delete a house type."""
    try:
        success = queries.delete_house_type(house_type_id)
        if success:
            return jsonify(message="House type deleted successfully"), 200
        else:
            # Check if house type exists first
            existing = queries.get_house_type_by_id(house_type_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="House type not found"), 404
            else:
                 # If delete failed but house type exists, likely a constraint issue
                 logger.warning(f"Delete failed for house type {house_type_id}, possibly due to dependencies (e.g., projects, panels).")
                 return jsonify(error="House type delete failed, check dependencies (e.g., projects, panels, parameters)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting house type {house_type_id}: {ie}")
        return jsonify(error="Cannot delete house type, check dependencies (e.g., projects, panels, parameters)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_house_type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete house type"), 500


# === House Type Tipologias Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/tipologias', methods=['GET'])
def get_house_type_tipologias_route(house_type_id):
    """Get all tipologias for a specific house type."""
    try:
        tipologias = queries.get_tipologias_for_house_type(house_type_id)
        return jsonify(tipologias)
    except Exception as e:
        logger.error(f"Error getting tipologias for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch tipologias"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/tipologias', methods=['POST'])
def add_house_type_tipologia_route(house_type_id):
    """Add a new tipologia to a house type."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    description = data.get('description', '')

    try:
        # Optional: Validate house_type_id exists? queries.add_tipologia handles FK constraint
        new_id = queries.add_tipologia_to_house_type(house_type_id, name, description)
        if new_id:
            new_tipologia = queries.get_tipologia_by_id(new_id) # Fetch to return full object
            if new_tipologia:
                return jsonify(new_tipologia), 201
            else:
                # Fallback if fetch fails
                logger.warning(f"Tipologia {new_id} added but failed to retrieve.")
                return jsonify({'tipologia_id': new_id, 'house_type_id': house_type_id, 'name': name, 'description': description}), 201
        else:
            # Should not happen if exception is raised on error
            # Check for specific errors if add_tipologia can return None without exception
            # Assuming a query like get_tipologia_by_name_and_house_type exists
            existing = queries.get_tipologia_by_name_and_house_type(name, house_type_id) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="Tipologia name already exists for this house type"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add tipologia for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed: Tipologias.house_type_id, Tipologias.name' in str(ie):
            return jsonify(error="Tipologia name already exists for this house type"), 409 # Conflict
        elif 'FOREIGN KEY constraint failed' in str(ie):
             logger.warning(f"Foreign key constraint error adding tipologia to house type {house_type_id}: {ie}")
             return jsonify(error="Invalid house type specified"), 400
        else:
             logger.error(f"Integrity error adding tipologia for house type {house_type_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error adding tipologia for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to add tipologia"), 500

@admin_definitions_bp.route('/tipologias/<int:tipologia_id>', methods=['PUT'])
def update_tipologia_route(tipologia_id):
    """Update an existing tipologia."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    description = data.get('description', '')

    try:
        success = queries.update_tipologia(tipologia_id, name, description)
        if success:
            updated_tipologia = queries.get_tipologia_by_id(tipologia_id) # Fetch updated data
            if updated_tipologia:
                return jsonify(updated_tipologia)
            else:
                # Should not happen if update succeeded, but handle defensively
                logger.warning(f"Tipologia {tipologia_id} updated but failed to retrieve.")
                return jsonify(error="Tipologia updated but failed to retrieve latest data"), 500
        else:
            # Check if tipologia exists first
            existing = queries.get_tipologia_by_id(tipologia_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Tipologia not found"), 404
            else:
                 return jsonify(error="Tipologia update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        # Assuming name must be unique within its house type (handled by schema)
        # We don't know the house_type_id here easily without another query, so generic conflict message
        if 'UNIQUE constraint failed: Tipologias.house_type_id, Tipologias.name' in str(ie):
            return jsonify(error="Tipologia name conflict with another tipologia in the same house type"), 409
        else:
            logger.error(f"Integrity error updating tipologia {tipologia_id}: {ie}", exc_info=True)
            return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error updating tipologia {tipologia_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update tipologia"), 500

@admin_definitions_bp.route('/tipologias/<int:tipologia_id>', methods=['DELETE'])
def delete_tipologia_route(tipologia_id):
    """Delete a tipologia."""
    try:
        success = queries.delete_tipologia(tipologia_id)
        if success:
            return jsonify(message="Tipologia deleted successfully"), 200 # Or 204
        else:
            # Check if tipologia exists first
            existing = queries.get_tipologia_by_id(tipologia_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Tipologia not found"), 404
            else:
                 # If delete failed but tipologia exists, likely a constraint issue
                 logger.warning(f"Delete failed for tipologia {tipologia_id}, possibly due to dependencies (e.g., house type parameters).")
                 return jsonify(error="Tipologia delete failed, check dependencies (e.g., house type parameters)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting tipologia {tipologia_id}: {ie}")
        return jsonify(error="Cannot delete tipologia, check dependencies (e.g., house type parameters)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error deleting tipologia {tipologia_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete tipologia"), 500


# === House Parameters Routes ===

@admin_definitions_bp.route('/house_parameters', methods=['GET'])
def get_house_parameters():
    """Get all house parameter definitions."""
    try:
        params = queries.get_all_house_parameters()
        return jsonify(params)
    except Exception as e:
        logger.error(f"Error in get_house_parameters: {e}", exc_info=True)
        return jsonify(error="Failed to fetch house parameters"), 500

@admin_definitions_bp.route('/house_parameters', methods=['POST'])
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
            # Check for specific errors if add_house_parameter can return None without exception
            # Assuming a query like get_house_parameter_by_name exists
            existing = queries.get_house_parameter_by_name(name) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="House parameter name already exists"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add house parameter for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: HouseParameters.name' in str(ie):
             return jsonify(error="House parameter name already exists"), 409 # Conflict
         else:
             logger.error(f"Integrity error adding house parameter: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_house_parameter: {e}", exc_info=True)
        return jsonify(error="Failed to add house parameter"), 500

@admin_definitions_bp.route('/house_parameters/<int:parameter_id>', methods=['PUT'])
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
            # Check if parameter exists first
            existing = queries.get_house_parameter_by_id(parameter_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="House parameter not found"), 404
            else:
                 return jsonify(error="House parameter update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: HouseParameters.name' in str(ie):
             # Check if the conflict is with itself or another parameter
             # Assuming a query like get_house_parameter_by_name exists
             existing = queries.get_house_parameter_by_name(name) # This query needs to exist in queries.py
             if existing and existing['parameter_id'] != parameter_id:
                 return jsonify(error="House parameter name already exists"), 409 # Conflict
             else: # If name didn't change or conflict is with self, it's another error
                 logger.error(f"Integrity error updating house parameter {parameter_id}: {ie}", exc_info=True)
                 return jsonify(error="Database integrity error"), 409
         else:
             logger.error(f"Integrity error updating house parameter {parameter_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_house_parameter {parameter_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update house parameter"), 500

@admin_definitions_bp.route('/house_parameters/<int:parameter_id>', methods=['DELETE'])
def delete_house_parameter(parameter_id):
    """Delete a house parameter definition."""
    try:
        success = queries.delete_house_parameter(parameter_id)
        if success:
            return jsonify(message="House parameter deleted successfully"), 200
        else:
            # Check if parameter exists first
            existing = queries.get_house_parameter_by_id(parameter_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="House parameter not found"), 404
            else:
                 # If delete failed but parameter exists, likely a constraint issue
                 logger.warning(f"Delete failed for house parameter {parameter_id}, possibly due to dependencies (e.g., house type parameters).")
                 return jsonify(error="House parameter delete failed, check dependencies (e.g., house type parameters)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting house parameter {parameter_id}: {ie}")
        return jsonify(error="Cannot delete house parameter, check dependencies (e.g., house type parameters)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_house_parameter {parameter_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete house parameter"), 500


# === House Type Parameters (Linking) Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters', methods=['GET'])
def get_house_type_parameters(house_type_id):
    """Get all parameters assigned to a specific house type."""
    try:
        params = queries.get_parameters_for_house_type(house_type_id)
        return jsonify(params)
    except Exception as e:
        logger.error(f"Error getting parameters for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch parameters for house type"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters', methods=['POST'])
def add_or_update_house_type_parameter_route(house_type_id):
    """Add or update a parameter value for a specific module and optional tipologia within a house type."""
    data = request.get_json()
    required_fields = ['parameter_id', 'module_sequence_number', 'value'] # Keep same required fields from frontend
    if not data or not all(k in data for k in required_fields):
        return jsonify(error=f"Missing required fields ({', '.join(required_fields)})"), 400

    parameter_id = data['parameter_id']
    module_sequence_number = data['module_sequence_number']
    value_str = data['value']
    tipologia_id = data.get('tipologia_id') # Optional, can be null/None

    # Validate value is numeric (float or int) and module sequence is positive integer
    try:
        # Allow empty string or null to potentially clear a value? Let's treat as error for now.
        value = float(value_str) if value_str is not None and str(value_str).strip() != '' else None
        if value is None:
             # Frontend should handle this, but add a check just in case
             return jsonify(error="Value cannot be empty or non-numeric"), 400

        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
            return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
        # Catches float conversion error or int conversion error
        return jsonify(error="Invalid value (must be numeric) or module_sequence_number (must be integer)"), 400

    try:
        # Optional: Validate module_sequence_number against HouseType.number_of_modules
        # house_type = queries.get_house_type_by_id(house_type_id) # Need to implement this query
        # if not house_type or module_seq_int > house_type['number_of_modules']:
        #    return jsonify(error="module_sequence_number exceeds the number of modules for this house type"), 400

        # Validate tipologia_id if provided (check if it exists for this house_type_id)
        if tipologia_id is not None:
            tipologia = queries.get_tipologia_by_id(tipologia_id)
            if not tipologia or tipologia['house_type_id'] != house_type_id:
                return jsonify(error=f"Invalid tipologia_id {tipologia_id} for house type {house_type_id}"), 400

        success = queries.add_or_update_house_type_parameter(house_type_id, parameter_id, module_seq_int, value, tipologia_id)
        if success:
            # Fetching the full object might be better if the query returned the ID or more details
            # For now, return the data that was set
            result = {
                'house_type_id': house_type_id,
                'parameter_id': parameter_id,
                'module_sequence_number': module_seq_int,
                'tipologia_id': tipologia_id, # Include tipologia_id in response
                'value': value
            }
            return jsonify(result), 200 # OK, as it's an UPSERT
        else:
            # This might indicate a DB error or constraint violation not caught by UPSERT logic (e.g., FK violation if parameter_id is invalid)
            # Check foreign keys first
            ht_exists = queries.get_house_type_by_id(house_type_id)
            param_exists = queries.get_house_parameter_by_id(parameter_id)
            if not ht_exists:
                 return jsonify(error="House type not found"), 404
            if not param_exists:
                 return jsonify(error="House parameter not found"), 404
            # If FKs are okay, it's likely an unknown DB error during UPSERT
            logger.error(f"Failed to set parameter value for house type {house_type_id}, parameter {parameter_id}, module {module_seq_int}, tipologia {tipologia_id}")
            return jsonify(error="Failed to set parameter value for house type"), 500
    except sqlite3.IntegrityError as ie:
         # This could happen if FK constraints fail despite checks above (race condition?)
         logger.error(f"Integrity error setting parameter for house type {house_type_id}: {ie}", exc_info=True)
         return jsonify(error="Database integrity error setting parameter value"), 409
    except Exception as e:
        logger.error(f"Error setting parameter for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to set parameter value"), 500

# Updated route to handle optional tipologia ID for deletion
@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters/<int:parameter_id>/module/<int:module_sequence_number>', methods=['DELETE'])
@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters/<int:parameter_id>/module/<int:module_sequence_number>/tipologia/<int:tipologia_id>', methods=['DELETE'])
def delete_parameter_from_house_type_module_route(house_type_id, parameter_id, module_sequence_number, tipologia_id=None):
    """Remove a specific parameter value for a specific module and optional tipologia within a house type."""
    try:
        # Validate module sequence is positive integer
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    # tipologia_id comes directly from the route parameter if present

    try:
        success = queries.delete_parameter_from_house_type_module(house_type_id, parameter_id, module_seq_int, tipologia_id)
        if success:
            tipologia_msg = f"for tipologia {tipologia_id}" if tipologia_id is not None else "for general (no tipologia)"
            return jsonify(message=f"Parameter value removed successfully {tipologia_msg} for this module"), 200 # Or 204
        else:
            # This implies the link didn't exist for this specific combination
            tipologia_msg = f", tipologia {tipologia_id}" if tipologia_id is not None else ", general (no tipologia)"
            return jsonify(error=f"Parameter value not found for this house type, parameter, module sequence{tipologia_msg}"), 404
    except Exception as e:
        tipologia_msg = f", tipologia {tipologia_id}" if tipologia_id is not None else ""
        logger.error(f"Error deleting parameter value for house type {house_type_id}, module {module_seq_int}{tipologia_msg}: {e}", exc_info=True)
        return jsonify(error="Failed to remove parameter value"), 500


# === Multiwalls Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/multiwalls', methods=['GET'])
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
        logger.error(f"Error getting multiwalls for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch multiwalls"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/multiwalls', methods=['POST'])
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
            # Check for specific errors if add_multiwall can return None without exception
            # Assuming a query like get_multiwall_by_details exists
            existing = queries.get_multiwall_by_details(house_type_id, module_seq_int, panel_group, multiwall_code) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="Multiwall code already exists for this group and module"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add multiwall for an unknown reason"), 500
    except (ValueError, sqlite3.IntegrityError) as e:
        logger.warning(f"Failed to add multiwall for house type {house_type_id}, module {module_seq_int}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Multiwall code already exists for this group and module"), 409
        elif 'CHECK constraint failed' in str(e) or isinstance(e, ValueError):
             return jsonify(error="Invalid panel group specified"), 400
        elif 'FOREIGN KEY constraint failed' in str(e):
             return jsonify(error="Invalid house type or module sequence specified"), 400
        else:
             logger.error(f"Integrity error adding multiwall: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error adding multiwall for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to add multiwall"), 500

@admin_definitions_bp.route('/multiwalls/<int:multiwall_id>', methods=['PUT'])
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
                # Fetch if needed: updated_multiwall = queries.get_multiwall_by_id(multiwall_id)
            }
            return jsonify(updated_multiwall), 200
        else:
            # Check if multiwall exists first
            existing = queries.get_multiwall_by_id(multiwall_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Multiwall not found"), 404
            else:
                 return jsonify(error="Multiwall update failed for an unknown reason"), 500
    except (ValueError, sqlite3.IntegrityError) as e:
        logger.warning(f"Failed to update multiwall {multiwall_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Multiwall code already exists for this group and module"), 409
        elif 'CHECK constraint failed' in str(e) or isinstance(e, ValueError):
             return jsonify(error="Invalid panel group specified"), 400
        else:
             logger.error(f"Integrity error updating multiwall: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error updating multiwall {multiwall_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update multiwall"), 500

@admin_definitions_bp.route('/multiwalls/<int:multiwall_id>', methods=['DELETE'])
def delete_house_type_module_multiwall(multiwall_id):
    """Delete a multiwall by its ID."""
    try:
        success = queries.delete_multiwall(multiwall_id)
        if success:
            return jsonify(message="Multiwall deleted successfully"), 200 # Or 204 No Content
        else:
            # Check if multiwall exists first
            existing = queries.get_multiwall_by_id(multiwall_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Multiwall not found"), 404
            else:
                 # If delete failed but multiwall exists, likely a constraint issue
                 logger.warning(f"Delete failed for multiwall {multiwall_id}, possibly due to dependencies (e.g., panels).")
                 return jsonify(error="Multiwall delete failed, check dependencies (e.g., panels)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting multiwall {multiwall_id}: {ie}")
        return jsonify(error="Cannot delete multiwall, check dependencies (e.g., panels)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error deleting multiwall {multiwall_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete multiwall"), 500


# === House Type Panels Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/panels', methods=['GET'])
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
        logger.error(f"Error getting panels for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch panels"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/panels', methods=['POST'])
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
                 logger.warning(f"Panel {new_id} added but failed to retrieve.")
                 return jsonify(error="Failed to retrieve newly added panel"), 500
        else:
            # This case might not be reached if exceptions are raised properly
            # Check for specific errors if add_panel can return None without exception
            # Assuming a query like get_panel_by_details exists
            existing = queries.get_panel_by_details(house_type_id, module_seq_int, panel_group, panel_code) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add panel for an unknown reason"), 500
    except (ValueError, sqlite3.IntegrityError) as e: # Catch validation or constraint errors
        logger.warning(f"Failed to add panel for house type {house_type_id}, module {module_seq_int}: {e}")
        # Provide more specific error messages based on the exception type if needed
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
        elif 'CHECK constraint failed' in str(e):
             return jsonify(error="Invalid panel group specified"), 400 # Bad Request
        elif "Panel group must match the assigned multiwall's group" in str(e):
             return jsonify(error="Panel group must match the assigned multiwall's group"), 400
        elif "Assigned multiwall_id" in str(e) and "does not exist" in str(e):
             return jsonify(error="Assigned multiwall does not exist or does not belong to the same house type/module"), 400
        elif 'FOREIGN KEY constraint failed' in str(e):
             return jsonify(error="Invalid house type or module sequence specified"), 400
        else:
             logger.error(f"Integrity error adding panel: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error adding panel for house type {house_type_id}, module {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to add panel"), 500

# Use house_type_panel_id for PUT and DELETE as it's the primary key
@admin_definitions_bp.route('/house_type_panels/<int:house_type_panel_id>', methods=['PUT'])
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
                 # ht_cursor = db.execute("SELECT house_type_id, module_sequence_number FROM HouseTypePanels WHERE house_type_panel_id = ?", (house_type_panel_id,))
                 # ht_info = ht_cursor.fetchone()
                 # if ht_info:
                 #      updated_panel['house_type_id'] = ht_info['house_type_id']
                 #      updated_panel['module_sequence_number'] = ht_info['module_sequence_number']
                 return jsonify(updated_panel), 200
            else:
                 # Should not happen if update succeeded, but handle defensively
                 logger.warning(f"Panel {house_type_panel_id} updated but failed to retrieve.")
                 return jsonify(error="Failed to retrieve updated panel"), 500
        else:
            # Check if panel exists first
            existing = queries.get_panel_by_id(house_type_panel_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Panel not found"), 404
            else:
                 return jsonify(error="Panel update failed for an unknown reason"), 500
    except (ValueError, sqlite3.IntegrityError) as e: # Catch validation or constraint errors
        logger.warning(f"Failed to update panel {house_type_panel_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel code already exists for this group and module"), 409 # Conflict
        elif 'CHECK constraint failed' in str(e):
             return jsonify(error="Invalid panel group specified"), 400 # Bad Request
        elif "Panel group must match the assigned multiwall's group" in str(e):
             return jsonify(error="Panel group must match the assigned multiwall's group"), 400
        elif "Assigned multiwall_id" in str(e) and "does not exist" in str(e):
             return jsonify(error="Assigned multiwall does not exist or does not belong to the same house type/module"), 400
        elif 'FOREIGN KEY constraint failed' in str(e):
             return jsonify(error="Invalid house type or module sequence specified"), 400
        else:
             logger.error(f"Integrity error updating panel: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error updating panel {house_type_panel_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update panel"), 500

@admin_definitions_bp.route('/house_type_panels/<int:house_type_panel_id>', methods=['DELETE'])
def delete_house_type_module_panel(house_type_panel_id):
    """Delete a panel by its ID."""
    try:
        success = queries.delete_panel_from_house_type_module(house_type_panel_id)
        if success:
            return jsonify(message="Panel deleted successfully"), 200 # Or 204 No Content
        else:
            # Check if panel exists first
            existing = queries.get_panel_by_id(house_type_panel_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Panel not found"), 404
            else:
                 # If delete failed but panel exists, likely a constraint issue (though unlikely for panels)
                 logger.warning(f"Delete failed for panel {house_type_panel_id}, possibly due to unexpected dependencies.")
                 return jsonify(error="Panel delete failed"), 500
    except Exception as e:
        logger.error(f"Error deleting panel {house_type_panel_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete panel"), 500


# === Task Definitions Routes ===

@admin_definitions_bp.route('/task_definitions', methods=['GET'])
def get_task_definitions():
    """Get all task definitions."""
    try:
        task_defs = queries.get_all_task_definitions()
        return jsonify(task_defs)
    except Exception as e:
        logger.error(f"Error in get_task_definitions: {e}", exc_info=True)
        return jsonify(error="Failed to fetch task definitions"), 500

@admin_definitions_bp.route('/task_definitions', methods=['POST'])
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
    station_sequence_order = data.get('station_sequence_order') # Changed from station_id

    # Convert sequence order to integer if present, otherwise None
    try:
        station_seq_int = int(station_sequence_order) if station_sequence_order is not None else None
    except (ValueError, TypeError):
        return jsonify(error="Invalid station_sequence_order, must be an integer or null"), 400

    try:
        new_id = queries.add_task_definition(name, description, house_type_id, specialty_id, station_seq_int)
        if new_id:
            # Fetch the newly created task def to return it (including related names)
            # Assuming a query like get_task_definition_by_id exists
            new_task_def = queries.get_task_definition_by_id(new_id) # This query needs to exist in queries.py
            if new_task_def:
                return jsonify(new_task_def), 201
            else:
                # Fallback if fetch fails
                new_task_def_basic = {
                    'task_definition_id': new_id, 'name': name, 'description': description,
                    'house_type_id': house_type_id, 'specialty_id': specialty_id, 'station_sequence_order': station_seq_int
                }
                return jsonify(new_task_def_basic), 201
        else:
            # Check for specific errors if add_task_definition can return None without exception
            # Assuming a query like get_task_definition_by_name exists
            existing = queries.get_task_definition_by_name(name) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="Task definition name already exists"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add task definition for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: TaskDefinitions.name' in str(ie):
             return jsonify(error="Task definition name already exists"), 409 # Conflict
         elif 'FOREIGN KEY constraint failed' in str(ie):
             logger.warning(f"Foreign key constraint error adding task definition: {ie}")
             # Note: station_sequence_order doesn't have a direct FK constraint anymore
             return jsonify(error="Invalid house type or specialty specified"), 400
         else:
             logger.error(f"Integrity error adding task definition: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_task_definition: {e}", exc_info=True)
        return jsonify(error="Failed to add task definition"), 500


@admin_definitions_bp.route('/task_definitions/<int:task_definition_id>', methods=['PUT'])
def update_task_definition(task_definition_id):
    """Update an existing task definition."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing 'name' in request data"), 400

    name = data.get('name')
    description = data.get('description', '')
    house_type_id = data.get('house_type_id')
    specialty_id = data.get('specialty_id')
    station_sequence_order = data.get('station_sequence_order') # Changed from station_id

    # Convert sequence order to integer if present, otherwise None
    try:
        station_seq_int = int(station_sequence_order) if station_sequence_order is not None else None
    except (ValueError, TypeError):
        return jsonify(error="Invalid station_sequence_order, must be an integer or null"), 400

    try:
        success = queries.update_task_definition(task_definition_id, name, description, house_type_id, specialty_id, station_seq_int)
        if success:
            # Fetch updated task definition data to include potentially changed names
            # Assuming a query like get_task_definition_by_id exists
            updated_task_def = queries.get_task_definition_by_id(task_definition_id) # This query needs to exist in queries.py
            if updated_task_def:
                return jsonify(updated_task_def)
            else:
                # Fallback if fetch fails
                updated_task_def_basic = {
                    'task_definition_id': task_definition_id, 'name': name, 'description': description,
                    'house_type_id': house_type_id, 'specialty_id': specialty_id, 'station_sequence_order': station_seq_int
                }
                return jsonify(updated_task_def_basic)
        else:
            # Check if task definition exists first
            existing = queries.get_task_definition_by_id(task_definition_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Task Definition not found"), 404
            else:
                 return jsonify(error="Task Definition update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: TaskDefinitions.name' in str(ie):
             return jsonify(error="Task definition name already exists"), 409 # Conflict
         elif 'FOREIGN KEY constraint failed' in str(ie):
             logger.warning(f"Foreign key constraint error updating task definition {task_definition_id}: {ie}")
             # Note: station_sequence_order doesn't have a direct FK constraint anymore
             return jsonify(error="Invalid house type or specialty specified"), 400
         else:
             logger.error(f"Integrity error updating task definition {task_definition_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_task_definition {task_definition_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update task definition"), 500


@admin_definitions_bp.route('/task_definitions/<int:task_definition_id>', methods=['DELETE'])
def delete_task_definition(task_definition_id):
    """Delete a task definition."""
    try:
        success = queries.delete_task_definition(task_definition_id)
        if success:
            return jsonify(message="Task Definition deleted successfully"), 200
        else:
            # Check if task definition exists first
            existing = queries.get_task_definition_by_id(task_definition_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Task Definition not found"), 404
            else:
                 # If delete failed but task def exists, likely a constraint issue
                 logger.warning(f"Delete failed for task definition {task_definition_id}, possibly due to dependencies (e.g., task logs).")
                 return jsonify(error="Task Definition delete failed, check dependencies (e.g., task logs)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting task definition {task_definition_id}: {ie}")
        return jsonify(error="Cannot delete task definition, check dependencies (e.g., task logs)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_task_definition {task_definition_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete task definition"), 500


# === Stations Route (Read-only for dropdowns) ===

@admin_definitions_bp.route('/stations', methods=['GET'])
def get_stations():
    """Get all stations for dropdowns."""
    try:
        stations = queries.get_all_stations()
        return jsonify(stations)
    except Exception as e:
        logger.error(f"Error in get_stations: {e}", exc_info=True)
        return jsonify(error="Failed to fetch stations"), 500
