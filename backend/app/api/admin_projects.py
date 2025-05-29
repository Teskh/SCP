from datetime import datetime # For datetime validation if needed
import logging
import sqlite3
from flask import Blueprint, request, jsonify
from ..database import queries, production_flow 
logger = logging.getLogger(__name__)

admin_projects_bp = Blueprint('admin_projects', __name__, url_prefix='/admin')

# === Error Handler ===
@admin_projects_bp.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception in admin_projects: {e}", exc_info=True)
    return jsonify(error="An internal server error occurred"), 500

# === Module Production Plan Routes ===
@admin_projects_bp.route('/module-production-plan', methods=['POST'])
def add_module_production_plan_entries():
    """
    Adds new entries to the ModuleProductionPlan.
    This can be for a new project_name or add modules to an existing one.
    Expects data like: {
        "project_name": "Project Alpha",
        "house_type_id": 1,
        "house_identifier_base": "Lot", // e.g., Lot-A, Lot-B or just "House"
        "number_of_houses": 5, // How many houses of this type
        // modules_per_house is now fetched from HouseTypes table inside generate_module_production_plan
    }
    """
    data = request.get_json()
    required_fields = ['project_name', 'house_type_id', 'house_identifier_base', 'number_of_houses']
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400

    try:
        project_name = str(data['project_name'])
        house_type_id = int(data['house_type_id'])
        house_identifier_base = str(data['house_identifier_base'])
        number_of_houses = int(data['number_of_houses'])
        modules_per_house = data.get('modules_per_house') # Optional override, typically from HouseType
        if modules_per_house is not None:
            modules_per_house = int(modules_per_house)


        success = queries.generate_module_production_plan(
            project_name=project_name,
            house_type_id=house_type_id,
            house_identifier_base=house_identifier_base,
            number_of_houses=number_of_houses,
            modules_per_house=modules_per_house # Pass None if not provided, query will fetch from DB
        )

        if success:
            # Fetching all items for the project_name to return them.
            # This could be paginated if the number of items is large.
            plan_items = queries.get_module_production_plan(filters={'project_name': project_name})
            return jsonify(plan_items), 201
        else:
            # The generate function should log specifics.
            return jsonify(error="Failed to generate module production plan entries."), 500
    except ValueError as ve:
        logger.warning(f"Invalid data type for adding module production plan: {ve}")
        return jsonify(error=f"Invalid data type for one of the fields: {ve}"), 400
    except Exception as e:
        logger.error(f"Error in add_module_production_plan_entries: {e}", exc_info=True)
        return jsonify(error="Failed to add module production plan entries"), 500


@admin_projects_bp.route('/module-production-plan', methods=['GET'])
def get_module_production_plan_route():
    """Get module production plan items with filtering, sorting, pagination."""
    try:
        filters = {
            'project_name': request.args.get('projectName'), # Changed from projectId
            'house_type_id': request.args.get('houseTypeId'),
            'status': request.args.get('status'),
            'start_date_after': request.args.get('startDateAfter'),
            'sub_type_id': request.args.get('subTypeId'), # Changed from tipologiaId
        }
        filters = {k: v for k, v in filters.items() if v is not None}

        sort_by = request.args.get('sortBy', 'planned_sequence')
        sort_order = request.args.get('sortOrder', 'ASC')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int)

        plan_items = queries.get_module_production_plan(
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        return jsonify(plan_items)
    except Exception as e:
        logger.error(f"Error in get_module_production_plan_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch module production plan"), 500

@admin_projects_bp.route('/module-production-plan/<int:plan_id>', methods=['GET'])
def get_module_production_plan_item_route(plan_id):
    """Get a single module production plan item by its ID."""
    try:
        item = queries.get_module_production_plan_item_by_id(plan_id)
        if item:
            return jsonify(item)
        else:
            return jsonify(error="Module production plan item not found"), 404
    except Exception as e:
        logger.error(f"Error fetching module production plan item {plan_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch module production plan item"), 500

@admin_projects_bp.route('/module-production-plan/<int:plan_id>', methods=['PUT'])
def update_module_production_plan_item_route(plan_id):
    """Update a specific module production plan item."""
    data = request.get_json()
    if not data:
        return jsonify(error="No data provided for update"), 400

    # Ensure sub_type_id is correctly named if present
    if 'tipologia_id' in data and 'sub_type_id' not in data:
        data['sub_type_id'] = data.pop('tipologia_id')

    try:
        success = queries.update_module_production_plan_item(plan_id, data)
        if success:
            updated_item = queries.get_module_production_plan_item_by_id(plan_id)
            return jsonify(updated_item)
        else:
            # Check if item exists to differentiate between not found and other update errors
            existing_item = queries.get_module_production_plan_item_by_id(plan_id)
            if not existing_item:
                return jsonify(error="Module production plan item not found"), 404
            return jsonify(error="Failed to update module production plan item, possible validation error or no changes made."), 400 # Or 500 if unknown
    except sqlite3.IntegrityError as ie:
        logger.error(f"Integrity error updating plan item {plan_id}: {ie}", exc_info=True)
        # Example: UNIQUE constraint failed: ModuleProductionPlan.project_name, ModuleProductionPlan.house_identifier, ModuleProductionPlan.module_number
        return jsonify(error=f"Database integrity error: {ie}"), 409
    except Exception as e:
        logger.error(f"Error updating plan item {plan_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update module production plan item"), 500


@admin_projects_bp.route('/module-production-plan/<int:plan_id>', methods=['DELETE'])
def delete_module_production_plan_item_route(plan_id):
    """Delete a specific module production plan item."""
    try:
        success = queries.delete_module_production_plan_item(plan_id)
        if success:
            return jsonify(message="Module production plan item deleted successfully"), 200
        else:
            return jsonify(error="Module production plan item not found or delete failed"), 404
    except sqlite3.IntegrityError as ie: # Should be handled by ON DELETE SET NULL or CASCADE in most cases
        logger.error(f"Integrity error deleting plan item {plan_id}: {ie}", exc_info=True)
        return jsonify(error=f"Cannot delete plan item due to database constraints: {ie}"), 409
    except Exception as e:
        logger.error(f"Error deleting plan item {plan_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete module production plan item"), 500

@admin_projects_bp.route('/module-production-plan/reorder', methods=['POST'])
def reorder_module_production_plan():
    """Reorders module production plan items based on a list of plan_ids."""
    data = request.get_json()
    if not data or 'ordered_plan_ids' not in data or not isinstance(data['ordered_plan_ids'], list):
        return jsonify(error="Missing or invalid 'ordered_plan_ids' list in request data"), 400

    ordered_plan_ids = data['ordered_plan_ids']
    try:
        ordered_plan_ids = [int(pid) for pid in ordered_plan_ids]
    except (ValueError, TypeError):
        return jsonify(error="All items in 'ordered_plan_ids' must be integers"), 400

    if not ordered_plan_ids:
         return jsonify(message="No plan IDs provided, nothing reordered"), 200

    try:
        success = queries.update_module_production_plan_sequence(ordered_plan_ids)
        if success:
            return jsonify(message="Module production plan reordered successfully"), 200
        else:
            logger.error("Failed to reorder module production plan, query returned false.")
            return jsonify(error="Failed to reorder module production plan (check logs for details)"), 500
    except Exception as e:
        logger.error(f"Error in reorder_module_production_plan: {e}", exc_info=True)
        return jsonify(error="Failed to reorder module production plan"), 500

@admin_projects_bp.route('/module-production-plan/bulk-update-line', methods=['POST'])
def change_module_production_plan_line_bulk():
    """Updates the planned assembly line for multiple module production plan items."""
    data = request.get_json()
    if not data or 'plan_ids' not in data or 'new_line' not in data:
        return jsonify(error="Missing 'plan_ids' or 'new_line' in request data"), 400
    if not isinstance(data['plan_ids'], list):
        return jsonify(error="'plan_ids' must be a list"), 400

    plan_ids = data['plan_ids']
    new_line = data['new_line']

    try:
        plan_ids = [int(pid) for pid in plan_ids]
    except (ValueError, TypeError):
        return jsonify(error="All items in 'plan_ids' must be integers"), 400

    if not plan_ids:
        return jsonify(message="No plan IDs provided, nothing updated"), 200

    try:
        updated_count = 0
        for plan_id in plan_ids:
            if queries.update_module_production_plan_item(plan_id, {'planned_assembly_line': new_line}):
                updated_count +=1
        return jsonify(message=f"Successfully updated line for {updated_count} items.", updated_count=updated_count), 200
    except ValueError as ve:
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error changing line bulk for module plan items: {e}", exc_info=True)
        return jsonify(error="Failed to change module production plan lines in bulk"), 500

@admin_projects_bp.route('/module-production-plan/bulk-update-sub-type', methods=['POST'])
def set_module_production_plan_sub_type_bulk():
    """Updates the sub_type_id for multiple module production plan items."""
    data = request.get_json()
    # Ensure 'sub_type_id' is expected, not 'tipologia_id'
    if not data or 'plan_ids' not in data or 'sub_type_id' not in data: # sub_type_id can be null
        return jsonify(error="Missing 'plan_ids' or 'sub_type_id' in request data"), 400
    if not isinstance(data['plan_ids'], list):
        return jsonify(error="'plan_ids' must be a list"), 400

    plan_ids = data['plan_ids']
    sub_type_id = data['sub_type_id']

    try:
        plan_ids = [int(pid) for pid in plan_ids]
        if sub_type_id is not None:
            sub_type_id = int(sub_type_id)
    except (ValueError, TypeError):
        return jsonify(error="All items in 'plan_ids' must be integers, and 'sub_type_id' must be an integer or null"), 400

    if not plan_ids:
        return jsonify(message="No plan IDs provided, nothing updated"), 200

    try:
        # Assuming a bulk update function like `queries.update_module_production_plan_items_sub_type_bulk(plan_ids, sub_type_id)`
        # Simulating with iteration for now:
        updated_count = 0
        for plan_id in plan_ids:
             if queries.update_module_production_plan_item(plan_id, {'sub_type_id': sub_type_id}):
                updated_count +=1
        # updated_count = queries.update_module_production_plan_items_sub_type_bulk(plan_ids, sub_type_id)
        return jsonify(message=f"Successfully updated sub_type for {updated_count} items.", updated_count=updated_count), 200
    except Exception as e:
        logger.error(f"Error setting sub_type bulk for module plan items: {e}", exc_info=True)
        return jsonify(error="Failed to set module production plan sub_types in bulk"), 500


@admin_projects_bp.route('/module-production-plan/bulk-update-datetime', methods=['POST'])
def set_module_production_plan_datetime_bulk():
    """Updates the planned_start_datetime for multiple module production plan items."""
    data = request.get_json()
    if not data or 'plan_ids' not in data or 'new_datetime' not in data:
        return jsonify(error="Missing 'plan_ids' or 'new_datetime' in request data"), 400
    if not isinstance(data['plan_ids'], list):
        return jsonify(error="'plan_ids' must be a list"), 400

    plan_ids = data['plan_ids']
    new_datetime_str = data['new_datetime']

    try:
        plan_ids = [int(pid) for pid in plan_ids]
        datetime.strptime(new_datetime_str, '%Y-%m-%d %H:%M:%S') # Validate format
    except (ValueError, TypeError):
        return jsonify(error="All items in 'plan_ids' must be integers, or 'new_datetime' has invalid format (expected YYYY-MM-DD HH:MM:SS)"), 400

    if not plan_ids:
        return jsonify(message="No plan IDs provided, nothing updated"), 200

    try:
        # Assuming a bulk update function like `queries.update_module_production_plan_items_datetime_bulk(plan_ids, new_datetime_str)`
        # Simulating with iteration for now:
        updated_count = 0
        for plan_id in plan_ids:
            if queries.update_module_production_plan_item(plan_id, {'planned_start_datetime': new_datetime_str}):
                updated_count+=1
        # updated_count = queries.update_module_production_plan_items_datetime_bulk(plan_ids, new_datetime_str)
        return jsonify(message=f"Successfully updated datetime for {updated_count} items.", updated_count=updated_count), 200
    except Exception as e:
        logger.error(f"Error setting datetime bulk for module plan items: {e}", exc_info=True)
        return jsonify(error="Failed to set module production plan datetimes in bulk"), 500


# Individual item updates (line, sub_type, datetime) can be done via the generic
# PUT /module-production-plan/<int:plan_id> endpoint by providing the specific field to update.
# For example, to change line: PUT /module-production-plan/123 with body {"planned_assembly_line": "B"}

# === Production Status Route (Station Overview) ===

@admin_projects_bp.route('/station-status-overview', methods=['GET'])
def get_station_status_overview_route():
    """Get current station status and all upcoming planned/magazine items."""
    try:
        status_data = production_flow.get_station_status_and_upcoming_modules() # Updated query function name
        return jsonify(status_data)
    except Exception as e:
        logger.error(f"Error in get_station_status_overview_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch station status overview"), 500
