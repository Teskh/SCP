import logging
import sqlite3
from flask import Blueprint, request, jsonify
from ..database import queries, connection

# Configure logging for this blueprint
logger = logging.getLogger(__name__)

admin_definitions_bp = Blueprint('admin_definitions', __name__, url_prefix='/admin')

# === Error Handler ===
@admin_definitions_bp.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception in admin_definitions: {e}", exc_info=True)
    return jsonify(error="An internal server error occurred"), 500

# === House Types Routes ===

@admin_definitions_bp.route('/house_types', methods=['GET'])
def get_house_types_route():
    """Get all house types, including their sub_types and parameters."""
    try:
        types = queries.get_all_house_types_with_details()
        return jsonify(types)
    except Exception as e:
        logger.error(f"Error in get_house_types_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch house types with details"), 500

@admin_definitions_bp.route('/house_types', methods=['POST'])
def add_house_type_route():
    """Add a new house type and its associated sub_types."""
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
    sub_types_data = data.get('sub_types', [])

    db = connection.get_db()
    try:
        with db:
            new_house_type_id = queries.add_house_type(name, description, num_modules)
            if not new_house_type_id:
                existing = queries.get_house_type_by_name(name)
                if existing:
                    return jsonify(error="House type name already exists"), 409
                raise Exception("Failed to add house type for an unknown reason")

            created_sub_types = []
            if sub_types_data:
                for st_data in sub_types_data:
                    if not st_data or 'name' not in st_data:
                        raise ValueError("Each sub_type must have a name.")
                    st_name = st_data['name']
                    st_description = st_data.get('description', '')
                    sub_type_id = queries.add_sub_type_to_house_type(new_house_type_id, st_name, st_description)
                    if not sub_type_id:
                        raise Exception(f"Failed to add sub_type '{st_name}'.")
                    created_sub_types.append({'sub_type_id': sub_type_id, 'name': st_name, 'description': st_description})
        
        final_house_type = queries.get_all_house_types_with_details()
        new_type_details = next((ht for ht in final_house_type if ht['house_type_id'] == new_house_type_id), None)

        if new_type_details:
             return jsonify(new_type_details), 201
        else:
            logger.warning(f"House Type {new_house_type_id} created but couldn't be refetched with details.")
            return jsonify({'house_type_id': new_house_type_id, 'name': name, 'description': description, 'number_of_modules': num_modules, 'sub_types': created_sub_types}), 201

    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed: HouseTypes.name' in str(ie):
            return jsonify(error="House type name already exists"), 409
        else:
            logger.error(f"Integrity error adding house type: {ie}", exc_info=True)
            return jsonify(error="Database integrity error"), 409
    except ValueError as ve:
        logger.warning(f"ValueError adding house type or sub_type: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error in add_house_type_route: {e}", exc_info=True)
        return jsonify(error="Failed to add house type"), 500


@admin_definitions_bp.route('/house_types/<int:house_type_id>', methods=['PUT'])
def update_house_type_route(house_type_id):
    """Update an existing house type, including its sub_types."""
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
    sub_types_data = data.get('sub_types', [])

    db = connection.get_db()
    try:
        with db:
            success = queries.update_house_type(house_type_id, name, description, num_modules)
            if not success:
                existing = queries.get_house_type_by_id(house_type_id)
                if not existing:
                    return jsonify(error="House type not found"), 404
                raise Exception("House type update failed for an unknown reason.")

            # Handle sub_types: very basic handling - delete existing and re-add.
            # A more sophisticated approach would involve diffing and updating/adding/deleting individually.
            existing_sub_types = queries.get_sub_types_for_house_type(house_type_id)
            for est in existing_sub_types:
                queries.delete_sub_type(est['sub_type_id'])

            updated_sub_types = []
            if sub_types_data:
                for st_data in sub_types_data:
                    if not st_data or 'name' not in st_data:
                        raise ValueError("Each sub_type must have a name.")
                    st_name = st_data['name']
                    st_description = st_data.get('description', '')
                    sub_type_id = queries.add_sub_type_to_house_type(house_type_id, st_name, st_description)
                    if not sub_type_id:
                        raise Exception(f"Failed to add sub_type '{st_name}'.")
                    updated_sub_types.append({'sub_type_id': sub_type_id, 'name': st_name, 'description': st_description})
        
        final_house_type = queries.get_all_house_types_with_details()
        updated_type_details = next((ht for ht in final_house_type if ht['house_type_id'] == house_type_id), None)

        if updated_type_details:
            return jsonify(updated_type_details)
        else:
            logger.warning(f"House Type {house_type_id} updated but couldn't be refetched with details.")
            return jsonify({'house_type_id': house_type_id, 'name': name, 'description': description, 'number_of_modules': num_modules, 'sub_types': updated_sub_types})

    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed: HouseTypes.name' in str(ie):
            existing = queries.get_house_type_by_name(name)
            if existing and existing['house_type_id'] != house_type_id:
                return jsonify(error="House type name already exists"), 409
        logger.error(f"Integrity error updating house type {house_type_id}: {ie}", exc_info=True)
        return jsonify(error="Database integrity error"), 409
    except ValueError as ve:
        logger.warning(f"ValueError updating house type or sub_type for HT {house_type_id}: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error in update_house_type_route {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update house type"), 500


@admin_definitions_bp.route('/house_types/<int:house_type_id>', methods=['DELETE'])
def delete_house_type_route(house_type_id):
    """Delete a house type. SubTypes and other direct dependencies are handled by CASCADE in DB."""
    try:
        success = queries.delete_house_type(house_type_id)
        if success:
            return jsonify(message="House type deleted successfully"), 200
        else:
            existing = queries.get_house_type_by_id(house_type_id)
            if not existing:
                 return jsonify(error="House type not found"), 404
            logger.warning(f"Delete failed for house type {house_type_id}, possibly due to RESTRICT constraints (e.g., existing modules/plans).")
            return jsonify(error="House type delete failed, check if it's used in production plans or modules."), 409
    except sqlite3.IntegrityError as ie:
        logger.warning(f"Integrity error deleting house type {house_type_id}: {ie}")
        return jsonify(error="Cannot delete house type, it is currently in use (e.g., in production plans, modules)."), 409
    except Exception as e:
        logger.error(f"Error in delete_house_type_route {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete house type"), 500


# === House SubType Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/sub_types', methods=['GET'])
def get_house_sub_types_route(house_type_id):
    """Get all sub_types for a specific house type."""
    try:
        sub_types = queries.get_sub_types_for_house_type(house_type_id)
        return jsonify(sub_types)
    except Exception as e:
        logger.error(f"Error getting sub_types for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch sub_types"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/sub_types', methods=['POST'])
def add_house_sub_type_route(house_type_id):
    """Add a new sub_type to a house type."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    description = data.get('description', '')

    try:
        new_id = queries.add_sub_type_to_house_type(house_type_id, name, description)
        if new_id:
            new_sub_type = queries.get_sub_type_by_id(new_id)
            return jsonify(new_sub_type), 201
        return jsonify(error="Failed to add sub_type, possibly duplicate name for this house type."), 500
    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed' in str(ie):
            return jsonify(error="Sub-type name already exists for this house type"), 409
        elif 'FOREIGN KEY constraint failed' in str(ie):
             return jsonify(error="Invalid house type specified"), 400
        else:
             logger.error(f"Integrity error adding sub_type for house type {house_type_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error adding sub_type for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to add sub_type"), 500

@admin_definitions_bp.route('/sub_types/<int:sub_type_id>', methods=['PUT'])
def update_sub_type_route(sub_type_id):
    """Update an existing sub_type."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    description = data.get('description', '')

    try:
        success = queries.update_sub_type(sub_type_id, name, description)
        if success:
            updated_sub_type = queries.get_sub_type_by_id(sub_type_id)
            return jsonify(updated_sub_type)
        else:
            existing = queries.get_sub_type_by_id(sub_type_id)
            if not existing:
                 return jsonify(error="Sub-type not found"), 404
            return jsonify(error="Sub-type update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        if 'UNIQUE constraint failed' in str(ie):
            return jsonify(error="Sub-type name conflict with another sub_type in the same house type"), 409
        else:
            logger.error(f"Integrity error updating sub_type {sub_type_id}: {ie}", exc_info=True)
            return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error updating sub_type {sub_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update sub_type"), 500

@admin_definitions_bp.route('/sub_types/<int:sub_type_id>', methods=['DELETE'])
def delete_sub_type_route(sub_type_id):
    """Delete a sub_type. Dependencies (HouseTypeParameters, PanelDefinitions, ModuleProductionPlan) are handled by DB constraints."""
    try:
        success = queries.delete_sub_type(sub_type_id)
        if success:
            return jsonify(message="Sub-type deleted successfully"), 200
        else:
            existing = queries.get_sub_type_by_id(sub_type_id)
            if not existing:
                 return jsonify(error="Sub-type not found"), 404
            logger.warning(f"Delete failed for sub_type {sub_type_id} though it exists.")
            return jsonify(error="Sub-type delete failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        logger.warning(f"Integrity error deleting sub_type {sub_type_id}: {ie}")
        return jsonify(error="Cannot delete sub_type due to integrity constraints."), 409
    except Exception as e:
        logger.error(f"Error deleting sub_type {sub_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete sub_type"), 500


# === House Parameters Routes ===

@admin_definitions_bp.route('/house_parameters', methods=['GET'])
def get_house_parameters_route():
    """Get all house parameter definitions."""
    try:
        params = queries.get_all_house_parameters()
        return jsonify(params)
    except Exception as e:
        logger.error(f"Error in get_house_parameters_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch house parameters"), 500

@admin_definitions_bp.route('/house_parameters', methods=['POST'])
def add_house_parameter_route():
    """Add a new house parameter definition."""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify(error="Missing required field 'name'"), 400
    name = data['name']
    unit = data.get('unit', '')
    try:
        new_id = queries.add_house_parameter(name, unit)
        if new_id:
            new_param = {'parameter_id': new_id, 'name': name, 'unit': unit}
            return jsonify(new_param), 201
        else:
            return jsonify(error="Failed to add house parameter, possibly duplicate name."), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: HouseParameters.name' in str(ie):
             return jsonify(error="House parameter name already exists"), 409
         else:
             logger.error(f"Integrity error adding house parameter: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_house_parameter_route: {e}", exc_info=True)
        return jsonify(error="Failed to add house parameter"), 500

@admin_definitions_bp.route('/house_parameters/<int:parameter_id>', methods=['PUT'])
def update_house_parameter_route(parameter_id):
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
            existing = queries.get_house_parameter_by_id(parameter_id)
            if not existing:
                 return jsonify(error="House parameter not found"), 404
            return jsonify(error="House parameter update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: HouseParameters.name' in str(ie):
             existing = queries.get_house_parameter_by_name(name)
             if existing and existing['parameter_id'] != parameter_id:
                 return jsonify(error="House parameter name already exists"), 409
         logger.error(f"Integrity error updating house parameter {parameter_id}: {ie}", exc_info=True)
         return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_house_parameter_route {parameter_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update house parameter"), 500

@admin_definitions_bp.route('/house_parameters/<int:parameter_id>', methods=['DELETE'])
def delete_house_parameter_route(parameter_id):
    """Delete a house parameter definition. Dependencies (HouseTypeParameters) handled by CASCADE."""
    try:
        success = queries.delete_house_parameter(parameter_id)
        if success:
            return jsonify(message="House parameter deleted successfully"), 200
        else:
            existing = queries.get_house_parameter_by_id(parameter_id)
            if not existing:
                 return jsonify(error="House parameter not found"), 404
            return jsonify(error="House parameter delete failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
        logger.warning(f"Integrity error deleting house parameter {parameter_id}: {ie}")
        return jsonify(error="Cannot delete house parameter, check dependencies."), 409
    except Exception as e:
        logger.error(f"Error in delete_house_parameter_route {parameter_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete house parameter"), 500

# === Module Production Plan Batch Generation ===
@admin_definitions_bp.route('/module-production-plan/generate-batch', methods=['POST'])
def generate_module_production_plan_batch_route():
    data = request.get_json()
    required_fields = ['project_name', 'house_type_id', 'number_of_houses']
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400

    project_name = data['project_name']
    try:
        house_type_id = int(data['house_type_id'])
        number_of_houses = int(data['number_of_houses'])
        if number_of_houses <= 0:
            return jsonify(error="Number of houses must be positive."), 400
    except (ValueError, TypeError):
        return jsonify(error="house_type_id and number_of_houses must be integers."), 400

    try:
        success = queries.generate_module_production_plan(
            project_name, house_type_id, number_of_houses
        )
        if success:
            return jsonify(message=f"Successfully generated production plan items for project '{project_name}'."), 201
        else:
            return jsonify(error="Failed to generate module production plan batch."), 500
    except ValueError as ve:
        logger.warning(f"ValueError generating production plan batch for project {project_name}: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error generating production plan batch for project {project_name}: {e}", exc_info=True)
        return jsonify(error="An unexpected error occurred while generating the production plan batch."), 500


# === House Type Parameters (Linking) Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters', methods=['GET'])
def get_house_type_parameters_route(house_type_id):
    """Get all parameters assigned to a specific house type, including sub_type specifics."""
    try:
        params = queries.get_parameters_for_house_type(house_type_id)
        return jsonify(params)
    except Exception as e:
        logger.error(f"Error getting parameters for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch parameters for house type"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters', methods=['POST'])
def add_or_update_house_type_parameter_route(house_type_id):
    """Add or update a parameter value for a specific module and optional sub_type within a house type."""
    data = request.get_json()
    required_fields = ['parameter_id', 'module_sequence_number', 'value']
    if not data or not all(k in data for k in required_fields):
        return jsonify(error=f"Missing required fields ({', '.join(required_fields)})"), 400

    parameter_id = data['parameter_id']
    module_sequence_number = data['module_sequence_number']
    value_str = data['value']
    sub_type_id = data.get('sub_type_id')

    try:
        value = float(value_str) if value_str is not None and str(value_str).strip() != '' else None
        if value is None:
             return jsonify(error="Value cannot be empty or non-numeric"), 400
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
            return jsonify(error="Invalid module_sequence_number, must be positive"), 400
        if sub_type_id is not None:
            sub_type_id = int(sub_type_id)
    except (ValueError, TypeError):
        return jsonify(error="Invalid value (must be numeric), module_sequence_number, or sub_type_id (must be integer if provided)"), 400

    try:
        if sub_type_id is not None:
            sub_type_obj = queries.get_sub_type_by_id(sub_type_id)
            if not sub_type_obj or sub_type_obj['house_type_id'] != house_type_id:
                return jsonify(error=f"Invalid sub_type_id {sub_type_id} for house type {house_type_id}"), 400

        success = queries.add_or_update_house_type_parameter(house_type_id, parameter_id, module_seq_int, value, sub_type_id)
        if success:
            result = {
                'house_type_id': house_type_id, 'parameter_id': parameter_id,
                'module_sequence_number': module_seq_int, 'sub_type_id': sub_type_id, 'value': value
            }
            return jsonify(result), 200
        else:
            ht_exists = queries.get_house_type_by_id(house_type_id)
            param_exists = queries.get_house_parameter_by_id(parameter_id)
            if not ht_exists: return jsonify(error="House type not found"), 404
            if not param_exists: return jsonify(error="House parameter not found"), 404
            logger.error(f"Failed to set parameter value for HT {house_type_id}, P {parameter_id}, M {module_seq_int}, ST {sub_type_id}")
            return jsonify(error="Failed to set parameter value for house type"), 500
    except sqlite3.IntegrityError as ie:
         logger.error(f"Integrity error setting parameter for house type {house_type_id}: {ie}", exc_info=True)
         return jsonify(error="Database integrity error setting parameter value"), 409
    except Exception as e:
        logger.error(f"Error setting parameter for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to set parameter value"), 500

# Route for deleting HouseTypeParameter by its own ID (if known)
@admin_definitions_bp.route('/house_type_parameters/<int:house_type_parameter_id>', methods=['DELETE'])
def delete_house_type_parameter_by_id_route(house_type_parameter_id):
    """Removes a specific parameter link from a house type by its own ID."""
    try:
        success = queries.delete_house_type_parameter(house_type_parameter_id)
        if success:
            return jsonify(message="House type parameter link deleted successfully."), 200
        else:
            return jsonify(error="House type parameter link not found."), 404
    except Exception as e:
        logger.error(f"Error deleting house_type_parameter_id {house_type_parameter_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete house type parameter link."), 500


# Updated route to handle optional sub_type_id for deletion by composite key
@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters/<int:parameter_id>/module/<int:module_sequence_number>', methods=['DELETE'])
@admin_definitions_bp.route('/house_types/<int:house_type_id>/parameters/<int:parameter_id>/module/<int:module_sequence_number>/sub_type/<int:sub_type_id>', methods=['DELETE'])
def delete_parameter_from_house_type_module_sub_type_route(house_type_id, parameter_id, module_sequence_number, sub_type_id=None):
    """Remove a parameter value by composite key: house_type, parameter, module sequence, and optionally sub_type."""
    try:
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        success = queries.delete_parameter_from_house_type_module_sub_type(house_type_id, parameter_id, module_seq_int, sub_type_id)
        if success:
            msg = f"for sub_type {sub_type_id}" if sub_type_id is not None else "for general (no sub_type)"
            return jsonify(message=f"Parameter value removed successfully {msg} for this module"), 200
        else:
            msg = f", sub_type {sub_type_id}" if sub_type_id is not None else ", general (no sub_type)"
            return jsonify(error=f"Parameter value not found for this house type, parameter, module sequence{msg}"), 404
    except Exception as e:
        msg = f", sub_type {sub_type_id}" if sub_type_id is not None else ""
        logger.error(f"Error deleting parameter value for HT {house_type_id}, M {module_seq_int}{msg}: {e}", exc_info=True)
        return jsonify(error="Failed to remove parameter value"), 500


# === Multiwalls Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/multiwalls', methods=['GET'])
def get_house_type_multiwalls_route(house_type_id):
    """Get all multiwalls for a specific house type."""
    try:
        multiwalls = queries.get_multiwalls_for_house_type_module(house_type_id)
        return jsonify(multiwalls)
    except Exception as e:
        logger.error(f"Error getting multiwalls for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch multiwalls"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/multiwalls', methods=['POST'])
def add_house_type_multiwall_route(house_type_id):
    """Add a new multiwall to a specific house type."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'multiwall_code')):
        return jsonify(error="Missing required fields (panel_group, multiwall_code)"), 400

    panel_group = data['panel_group']
    multiwall_code = data['multiwall_code']

    try:
        new_id = queries.add_multiwall(house_type_id, panel_group, multiwall_code)
        if new_id:
            new_multiwall = {
                'multiwall_id': new_id, 'house_type_id': house_type_id,
                'panel_group': panel_group, 'multiwall_code': multiwall_code
            }
            return jsonify(new_multiwall), 201
        return jsonify(error="Failed to add multiwall, possibly duplicate code for this group."), 500
    except (ValueError, sqlite3.IntegrityError) as e:
        logger.warning(f"Failed to add multiwall for house type {house_type_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Multiwall code already exists for this panel group and house type"), 409
        elif 'CHECK constraint failed' in str(e) or isinstance(e, ValueError):
             return jsonify(error="Invalid panel group specified"), 400
        elif 'FOREIGN KEY constraint failed' in str(e):
             return jsonify(error="Invalid house type specified"), 400
        else:
             logger.error(f"Integrity error adding multiwall: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error adding multiwall for house type {house_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to add multiwall"), 500

@admin_definitions_bp.route('/multiwalls/<int:multiwall_id>', methods=['PUT'])
def update_multiwall_route(multiwall_id):
    """Update an existing multiwall by its ID. House_type_id is not changed here."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'multiwall_code')):
        return jsonify(error="Missing required fields (panel_group, multiwall_code)"), 400

    panel_group = data['panel_group']
    multiwall_code = data['multiwall_code']

    try:
        success = queries.update_multiwall(multiwall_id, panel_group, multiwall_code)
        if success:
            updated_multiwall_data = queries.get_multiwall_by_id(multiwall_id)
            if updated_multiwall_data:
                return jsonify(updated_multiwall_data), 200
            return jsonify({'multiwall_id': multiwall_id, 'panel_group': panel_group, 'multiwall_code': multiwall_code}), 200

        else:
            existing = queries.get_multiwall_by_id(multiwall_id)
            if not existing:
                 return jsonify(error="Multiwall not found"), 404
            return jsonify(error="Multiwall update failed for an unknown reason"), 500
    except (ValueError, sqlite3.IntegrityError) as e:
        logger.warning(f"Failed to update multiwall {multiwall_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Multiwall code already exists for this panel group and house type"), 409
        elif 'CHECK constraint failed' in str(e) or isinstance(e, ValueError):
             return jsonify(error="Invalid panel group specified"), 400
        else:
             logger.error(f"Integrity error updating multiwall: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error updating multiwall {multiwall_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update multiwall"), 500

@admin_definitions_bp.route('/multiwalls/<int:multiwall_id>', methods=['DELETE'])
def delete_multiwall_route(multiwall_id):
    """Delete a multiwall by its ID. Associated PanelDefinitions.multiwall_id will be SET NULL."""
    try:
        success = queries.delete_multiwall(multiwall_id)
        if success:
            return jsonify(message="Multiwall deleted successfully"), 200
        else:
            existing = queries.get_multiwall_by_id(multiwall_id)
            if not existing:
                 return jsonify(error="Multiwall not found"), 404
            return jsonify(error="Multiwall delete failed for an unknown reason"), 500
    except sqlite3.IntegrityError:
        logger.warning(f"Integrity error deleting multiwall {multiwall_id}")
        return jsonify(error="Cannot delete multiwall due to unexpected integrity constraints."), 409
    except Exception as e:
        logger.error(f"Error deleting multiwall {multiwall_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete multiwall"), 500


# === Panel Definitions Routes ===

@admin_definitions_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/panel_definitions', methods=['GET'])
def get_panel_definitions_route(house_type_id, module_sequence_number):
    """
    Get all panel definitions for a specific module within a house type.
    Optionally filter by sub_type_id if provided as a query parameter.
    """
    sub_type_id_str = request.args.get('sub_type_id')
    sub_type_id = None
    if sub_type_id_str:
        try:
            sub_type_id = int(sub_type_id_str)
        except ValueError:
            return jsonify(error="Invalid sub_type_id parameter, must be an integer."), 400
            
    try:
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, must be integer"), 400

    try:
        panels = queries.get_panel_definitions_for_house_type_module(house_type_id, module_seq_int, sub_type_id)
        return jsonify(panels)
    except Exception as e:
        logger.error(f"Error getting panel_definitions for HT {house_type_id}, M {module_seq_int}, ST {sub_type_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch panel definitions"), 500

@admin_definitions_bp.route('/house_types/<int:house_type_id>/modules/<int:module_sequence_number>/panel_definitions', methods=['POST'])
def add_panel_definition_route(house_type_id, module_sequence_number):
    """Add a new panel definition to a specific module, optionally for a sub_type."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'panel_code')):
        return jsonify(error="Missing required fields (panel_group, panel_code)"), 400

    panel_group = data['panel_group']
    panel_code = data['panel_code']
    sub_type_id = data.get('sub_type_id')
    multiwall_id = data.get('multiwall_id')

    try:
        module_seq_int = int(module_sequence_number)
        if module_seq_int <= 0:
             return jsonify(error="Invalid module_sequence_number, must be positive"), 400
        if sub_type_id is not None:
            sub_type_id = int(sub_type_id)
        if multiwall_id is not None:
            multiwall_id = int(multiwall_id)
    except (ValueError, TypeError):
         return jsonify(error="Invalid module_sequence_number, sub_type_id, or multiwall_id format."), 400

    try:
        new_id = queries.add_panel_definition_to_house_type_module(
            house_type_id, module_seq_int, panel_group, panel_code, sub_type_id, multiwall_id
        )
        if new_id:
            new_panel_def = {
                'panel_definition_id': new_id, 'house_type_id': house_type_id,
                'module_sequence_number': module_seq_int, 'panel_group': panel_group,
                'panel_code': panel_code, 'sub_type_id': sub_type_id, 'multiwall_id': multiwall_id
            }
            return jsonify(new_panel_def), 201
        return jsonify(error="Failed to add panel definition, possibly duplicate."), 500
    except (ValueError, sqlite3.IntegrityError) as e:
        logger.warning(f"Failed to add panel definition for HT {house_type_id}, M {module_seq_int}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel definition code already exists for this group, module, and sub_type combination."), 409
        elif 'CHECK constraint failed' in str(e) or "Invalid panel_group" in str(e):
             return jsonify(error="Invalid panel group specified."), 400
        elif "Panel group must match" in str(e) or "multiwall_id" in str(e).lower() and "does not exist" in str(e).lower():
             return jsonify(error=str(e)), 400
        elif 'FOREIGN KEY constraint failed' in str(e):
             return jsonify(error="Invalid house_type, module, sub_type, or multiwall specified."), 400
        else:
             logger.error(f"Integrity error adding panel definition: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error adding panel definition for HT {house_type_id}, M {module_seq_int}: {e}", exc_info=True)
        return jsonify(error="Failed to add panel definition"), 500

@admin_definitions_bp.route('/panel_definitions/<int:panel_definition_id>', methods=['PUT'])
def update_panel_definition_route(panel_definition_id):
    """Update an existing panel definition by its ID."""
    data = request.get_json()
    if not data or not all(k in data for k in ('panel_group', 'panel_code')):
        return jsonify(error="Missing required fields (panel_group, panel_code)"), 400

    panel_group = data['panel_group']
    panel_code = data['panel_code']
    sub_type_id = data.get('sub_type_id')
    multiwall_id = data.get('multiwall_id')

    try:
        if sub_type_id is not None: sub_type_id = int(sub_type_id)
        if multiwall_id is not None: multiwall_id = int(multiwall_id)
    except (ValueError, TypeError):
        return jsonify(error="Invalid sub_type_id or multiwall_id format."), 400

    try:
        success = queries.update_panel_definition(
            panel_definition_id, panel_group, panel_code, sub_type_id, multiwall_id
        )
        if success:
            updated_panel_def = {
                 'panel_definition_id': panel_definition_id, 'panel_group': panel_group,
                 'panel_code': panel_code, 'sub_type_id': sub_type_id, 'multiwall_id': multiwall_id
            }
            return jsonify(updated_panel_def), 200
        else:
            return jsonify(error="Panel definition not found or no changes made."), 404
    except (ValueError, sqlite3.IntegrityError) as e:
        logger.warning(f"Failed to update panel definition {panel_definition_id}: {e}")
        if 'UNIQUE constraint failed' in str(e):
             return jsonify(error="Panel definition code already exists for this group, module, and sub_type combination."), 409
        elif 'CHECK constraint failed' in str(e) or "Invalid panel_group" in str(e):
             return jsonify(error="Invalid panel group specified."), 400
        elif "Panel group must match" in str(e) or "multiwall_id" in str(e).lower() and "does not exist" in str(e).lower():
             return jsonify(error=str(e)), 400
        elif 'FOREIGN KEY constraint failed' in str(e):
             return jsonify(error="Invalid house_type, module, sub_type, or multiwall specified."), 400
        else:
             logger.error(f"Integrity error updating panel definition: {e}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error updating panel definition {panel_definition_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update panel definition"), 500

@admin_definitions_bp.route('/panel_definitions/<int:panel_definition_id>', methods=['DELETE'])
def delete_panel_definition_route(panel_definition_id):
    """Delete a panel definition by its ID."""
    try:
        success = queries.delete_panel_definition(panel_definition_id)
        if success:
            return jsonify(message="Panel definition deleted successfully"), 200
        else:
            return jsonify(error="Panel definition not found"), 404
    except Exception as e:
        logger.error(f"Error deleting panel definition {panel_definition_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete panel definition, check dependencies (e.g. PanelTaskLogs)."), 500


# === Task Definitions Routes ===

@admin_definitions_bp.route('/task_definitions', methods=['GET'])
def get_task_definitions_route():
    """Get all task definitions."""
    try:
        task_defs = queries.get_all_task_definitions()
        return jsonify(task_defs)
    except Exception as e:
        logger.error(f"Error in get_task_definitions_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch task definitions"), 500

@admin_definitions_bp.route('/task_definitions', methods=['POST'])
def add_task_definition_route():
    """Add a new task definition."""
    data = request.get_json()
    if not data or 'name' not in data or 'is_panel_task' not in data:
        return jsonify(error="Missing 'name' or 'is_panel_task' in request data"), 400

    name = data.get('name')
    description = data.get('description', '')
    house_type_id = data.get('house_type_id')
    specialty_id = data.get('specialty_id')
    station_sequence_order = data.get('station_sequence_order')
    task_dependencies_input = data.get('task_dependencies', [])
    is_panel_task = data.get('is_panel_task')

    try:
        station_seq_int = int(station_sequence_order) if station_sequence_order is not None else None
        is_panel_task_bool = bool(int(is_panel_task))
    except (ValueError, TypeError):
        return jsonify(error="Invalid station_sequence_order (must be integer or null) or is_panel_task (must be 0 or 1)"), 400

    task_dependencies_str = ",".join(map(str, task_dependencies_input)) if task_dependencies_input else None

    try:
        new_id = queries.add_task_definition(
            name, description, house_type_id, specialty_id, station_seq_int, task_dependencies_str, is_panel_task_bool
        )
        if new_id:
            new_task_def = queries.get_task_definition_by_id(new_id)
            return jsonify(new_task_def), 201
        return jsonify(error="Failed to add task definition, possibly duplicate name."), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: TaskDefinitions.name' in str(ie):
             return jsonify(error="Task definition name already exists"), 409
         elif 'FOREIGN KEY constraint failed' in str(ie):
             return jsonify(error="Invalid house type or specialty specified"), 400
         else:
             logger.error(f"Integrity error adding task definition: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_task_definition_route: {e}", exc_info=True)
        return jsonify(error="Failed to add task definition"), 500


@admin_definitions_bp.route('/task_definitions/<int:task_definition_id>', methods=['PUT'])
def update_task_definition_route(task_definition_id):
    """Update an existing task definition."""
    data = request.get_json()
    if not data or 'name' not in data or 'is_panel_task' not in data:
        return jsonify(error="Missing 'name' or 'is_panel_task' in request data"), 400

    name = data.get('name')
    description = data.get('description', '')
    house_type_id = data.get('house_type_id')
    specialty_id = data.get('specialty_id')
    station_sequence_order = data.get('station_sequence_order')
    task_dependencies_input = data.get('task_dependencies', [])
    is_panel_task = data.get('is_panel_task')

    try:
        station_seq_int = int(station_sequence_order) if station_sequence_order is not None else None
        is_panel_task_bool = bool(int(is_panel_task))
    except (ValueError, TypeError):
        return jsonify(error="Invalid station_sequence_order (must be integer or null) or is_panel_task (must be 0 or 1)"), 400

    task_dependencies_str = ",".join(map(str, task_dependencies_input)) if task_dependencies_input else None

    try:
        success = queries.update_task_definition(
            task_definition_id, name, description, house_type_id, specialty_id,
            station_seq_int, task_dependencies_str, is_panel_task_bool
        )
        if success:
            updated_task_def = queries.get_task_definition_by_id(task_definition_id)
            return jsonify(updated_task_def)
        else:
            existing = queries.get_task_definition_by_id(task_definition_id)
            if not existing:
                 return jsonify(error="Task Definition not found"), 404
            return jsonify(error="Task Definition update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: TaskDefinitions.name' in str(ie):
             return jsonify(error="Task definition name already exists"), 409
         elif 'FOREIGN KEY constraint failed' in str(ie):
             return jsonify(error="Invalid house type or specialty specified"), 400
         else:
             logger.error(f"Integrity error updating task definition {task_definition_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_task_definition_route {task_definition_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update task definition"), 500


@admin_definitions_bp.route('/task_definitions/<int:task_definition_id>', methods=['DELETE'])
def delete_task_definition_route(task_definition_id):
    """Delete a task definition."""
    try:
        success = queries.delete_task_definition(task_definition_id)
        if success:
            return jsonify(message="Task Definition deleted successfully"), 200
        else:
            existing = queries.get_task_definition_by_id(task_definition_id)
            if not existing:
                 return jsonify(error="Task Definition not found"), 404
            return jsonify(error="Task Definition delete failed, check dependencies (e.g., task logs, panel task logs)."), 409
    except sqlite3.IntegrityError as ie:
        logger.warning(f"Integrity error deleting task definition {task_definition_id}: {ie}")
        return jsonify(error="Cannot delete task definition, it is currently in use (e.g., in task logs)."), 409
    except Exception as e:
        logger.error(f"Error in delete_task_definition_route {task_definition_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete task definition"), 500


@admin_definitions_bp.route('/task_definitions/potential_dependencies', methods=['GET'])
def get_potential_dependencies_route():
    """
    Get potential task dependencies.
    Requires 'current_station_sequence_order' (optional) and 'is_panel_task' (optional) query parameters.
    """
    sequence_order_str = request.args.get('current_station_sequence_order')
    is_panel_task_str = request.args.get('is_panel_task')

    current_sequence_order = None
    if sequence_order_str and sequence_order_str.lower() != 'null' and sequence_order_str != '':
        try:
            current_sequence_order = int(sequence_order_str)
            if current_sequence_order <= 0: raise ValueError()
        except ValueError:
            return jsonify(error="Invalid 'current_station_sequence_order'. Must be a positive integer."), 400

    is_panel_task_filter = None
    if is_panel_task_str is not None:
        if is_panel_task_str.lower() in ['true', '1']:
            is_panel_task_filter = 1
        elif is_panel_task_str.lower() in ['false', '0']:
            is_panel_task_filter = 0
        else:
            return jsonify(error="Invalid 'is_panel_task' parameter. Must be boolean-like (true/false, 1/0)."), 400
            
    try:
        potential_deps = queries.get_potential_task_dependencies(current_sequence_order, is_panel_task_filter)
        for dep in potential_deps:
            dep['has_dependencies'] = bool(dep.get('task_dependencies'))
        return jsonify(potential_deps)
    except Exception as e:
        logger.error(f"Error fetching potential task dependencies: {e}", exc_info=True)
        return jsonify(error="Failed to fetch potential task dependencies"), 500


# === Stations Route ===

@admin_definitions_bp.route('/stations', methods=['GET'])
def get_stations_route():
    """Get all stations for dropdowns."""
    try:
        stations = queries.get_all_stations()
        return jsonify(stations)
    except Exception as e:
        logger.error(f"Error in get_stations_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch stations"), 500


# === Task Operations ===

@admin_definitions_bp.route('/tasks/start', methods=['POST'])
def start_task_route():
    """
    Starts a task log entry (either TaskLog or PanelTaskLog).
    If the module doesn't exist yet (i.e., starting the first task for a planned module),
    it creates the module record from ModuleProductionPlan.plan_id.
    """
    data = request.get_json()
    required_fields = ['plan_id', 'task_definition_id', 'worker_id', 'station_start']
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400

    plan_id_req = data['plan_id']
    task_definition_id_req = data['task_definition_id']
    worker_id_req = data['worker_id']
    station_start_req = data['station_start']

    try:
        plan_id = int(plan_id_req)
        task_definition_id = int(task_definition_id_req)
        worker_id = int(worker_id_req)
    except (ValueError, TypeError):
        return jsonify(error="Invalid ID format. IDs must be integers (except station_id)."), 400

    db = connection.get_db()
    try:
        with db:
            task_def = queries.get_task_definition_by_id(task_definition_id)
            if not task_def:
                return jsonify(error=f"Task Definition ID {task_definition_id} not found."), 404
            is_panel_task = task_def['is_panel_task']

            plan_item = queries.get_module_production_plan_item_by_id(plan_id)
            if not plan_item:
                return jsonify(error=f"Production Plan ID {plan_id} not found."), 404

            if station_start_req.startswith('W') and plan_item['status'] == 'Planned':
                updated_plan = queries.update_module_production_plan_item(plan_id, {'status': 'Panels'})
                if not updated_plan:
                    logger.warning(f"Failed to update plan {plan_id} status to 'Panels'.")
            
            new_log_id = None
            log_type = ""

            if is_panel_task:
                return jsonify(error="Panel tasks are no longer supported."), 400
            else:
                existing_module_log_cursor = db.execute(
                    "SELECT status FROM TaskLogs WHERE plan_id = ? AND task_definition_id = ?",
                    (plan_id, task_definition_id))
                existing_module_log = existing_module_log_cursor.fetchone()

                if existing_module_log and existing_module_log['status'] in ['In Progress', 'Completed']:
                     return jsonify(error=f"Module task is already {existing_module_log['status']} for this plan."), 409

                new_log_id = queries.start_task_log(
                    plan_id=plan_id, task_definition_id=task_definition_id,
                    worker_id=worker_id, station_start=station_start_req
                )
                log_type = "TaskLog"

            if new_log_id:
                return jsonify(message=f"{log_type} started successfully", log_id=new_log_id, plan_id=plan_id, log_type=log_type.lower()), 201
            else:
                raise Exception(f"Failed to start {log_type}")

    except ValueError as ve:
        logger.warning(f"ValueError starting task for plan {plan_id}: {ve}")
        return jsonify(error=str(ve)), 400
    except sqlite3.IntegrityError as e:
        logger.error(f"Integrity error starting task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error="Database integrity error starting task. Check if related items exist or if task already logged."), 409
    except Exception as e:
        logger.error(f"Error starting task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error=f"An unexpected error occurred while starting the task: {str(e)}"), 500


@admin_definitions_bp.route('/tasks/pause', methods=['POST'])
def pause_task_route():
    """
    Pauses a task (either TaskLog or PanelTaskLog) and creates a TaskPause record.
    """
    data = request.get_json()
    required_fields = ['plan_id', 'task_definition_id', 'worker_id']
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400

    plan_id_req = data['plan_id']
    task_definition_id_req = data['task_definition_id']
    worker_id_req = data['worker_id']
    reason = data.get('reason', 'Worker initiated pause')

    try:
        plan_id = int(plan_id_req)
        task_definition_id = int(task_definition_id_req)
        worker_id = int(worker_id_req)
    except (ValueError, TypeError):
        return jsonify(error="Invalid ID format. IDs must be integers."), 400

    db = connection.get_db()
    try:
        with db:            
            # Find the active module task log
            task_log_cursor = db.execute(
                "SELECT task_log_id, status FROM TaskLogs WHERE plan_id = ? AND task_definition_id = ? AND status = 'In Progress'",
                (plan_id, task_definition_id))
            task_log = task_log_cursor.fetchone()

            if not task_log:
                return jsonify(error="No active module task found to pause."), 404

            # Update status to Paused
            db.execute(
                "UPDATE TaskLogs SET status = 'Paused' WHERE task_log_id = ?",
                (task_log['task_log_id'],))

            # Create pause record
            pause_cursor = db.execute(
                "INSERT INTO TaskPauses (task_log_id, paused_by_worker_id, paused_at, reason) VALUES (?, ?, datetime('now'), ?)",
                (task_log['task_log_id'], worker_id, reason))
            pause_id = pause_cursor.lastrowid

            return jsonify(message="Module task paused successfully", pause_id=pause_id, log_type="task_log"), 200

    except sqlite3.IntegrityError as e:
        logger.error(f"Integrity error pausing task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error="Database integrity error pausing task."), 409
    except Exception as e:
        logger.error(f"Error pausing task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error=f"An unexpected error occurred while pausing the task: {str(e)}"), 500


@admin_definitions_bp.route('/tasks/resume', methods=['POST'])
def resume_task_route():
    """
    Resumes a paused task and updates the pause record with resumed_at timestamp.
    """
    data = request.get_json()
    required_fields = ['plan_id', 'task_definition_id']
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400

    plan_id_req = data['plan_id']
    task_definition_id_req = data['task_definition_id']

    try:
        plan_id = int(plan_id_req)
        task_definition_id = int(task_definition_id_req)
    except (ValueError, TypeError):
        return jsonify(error="Invalid ID format. IDs must be integers."), 400

    db = connection.get_db()
    try:
        with db:
            # Find the paused module task log
            task_log_cursor = db.execute(
                "SELECT task_log_id FROM TaskLogs WHERE plan_id = ? AND task_definition_id = ? AND status = 'Paused'",
                (plan_id, task_definition_id))
            task_log = task_log_cursor.fetchone()

            if not task_log:
                return jsonify(error="No paused module task found to resume."), 404

            # Update status to In Progress
            db.execute(
                "UPDATE TaskLogs SET status = 'In Progress' WHERE task_log_id = ?",
                (task_log['task_log_id'],))

            # Update pause record with resumed_at
            db.execute(
                "UPDATE TaskPauses SET resumed_at = datetime('now') WHERE task_log_id = ? AND resumed_at IS NULL",
                (task_log['task_log_id'],))

            return jsonify(message="Module task resumed successfully", log_type="task_log"), 200

    except sqlite3.IntegrityError as e:
        logger.error(f"Integrity error resuming task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error="Database integrity error resuming task."), 409
    except Exception as e:
        logger.error(f"Error resuming task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error=f"An unexpected error occurred while resuming the task: {str(e)}"), 500


@admin_definitions_bp.route('/tasks/complete', methods=['POST'])
def complete_task_route():
    """
    Completes a task (either TaskLog or PanelTaskLog).
    After completion, it checks if all tasks for the current station are complete
    and updates the module's status and station if applicable.
    """
    data = request.get_json()
    required_fields = ['plan_id', 'task_definition_id', 'station_finish']
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400

    plan_id_req = data['plan_id']
    task_definition_id_req = data['task_definition_id']
    station_finish_req = data['station_finish']
    notes = data.get('notes', '')

    try:
        plan_id = int(plan_id_req)
        task_definition_id = int(task_definition_id_req)
    except (ValueError, TypeError):
        return jsonify(error="Invalid ID format. IDs must be integers (except station_finish)."), 400

    db = connection.get_db()
    try:
        with db:
            task_def = queries.get_task_definition_by_id(task_definition_id)
            if not task_def:
                return jsonify(error=f"Task Definition ID {task_definition_id} not found."), 404
            is_panel_task = task_def['is_panel_task']

            if is_panel_task:
                return jsonify(error="Panel tasks are no longer supported."), 400
            else:
                # Find the active module task log
                task_log_cursor = db.execute(
                    "SELECT task_log_id, status FROM TaskLogs WHERE plan_id = ? AND task_definition_id = ? AND status IN ('In Progress', 'Paused')",
                    (plan_id, task_definition_id))
                task_log = task_log_cursor.fetchone()

                if not task_log:
                    return jsonify(error="No active or paused module task found to complete."), 404

                success = queries.update_task_log_status(
                    task_log['task_log_id'], 'Completed', station_finish_req, notes
                )
                log_type = "TaskLog"

            if success:
                # After completing a task, check if the module can transition to the next station
                # Get the station sequence order for the current station_finish
                station_info_cursor = db.execute("SELECT sequence_order FROM Stations WHERE station_id = ?", (station_finish_req,))
                station_info = station_info_cursor.fetchone()
                if station_info:
                    station_sequence_order = station_info['sequence_order']
                    queries.check_and_update_module_station_completion(plan_id, station_sequence_order)
                else:
                    logger.warning(f"Station {station_finish_req} not found when checking module completion for plan {plan_id}.")

                return jsonify(message=f"{log_type} completed successfully", plan_id=plan_id, log_type=log_type.lower()), 200
            else:
                raise Exception(f"Failed to complete {log_type}")

    except ValueError as ve:
        logger.warning(f"ValueError completing task for plan {plan_id}: {ve}")
        return jsonify(error=str(ve)), 400
    except sqlite3.IntegrityError as e:
        logger.error(f"Integrity error completing task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error="Database integrity error completing task."), 409
    except Exception as e:
        logger.error(f"Error completing task for plan {plan_id}: {e}", exc_info=True)
        return jsonify(error=f"An unexpected error occurred while completing the task: {str(e)}"), 500
