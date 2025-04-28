import logging
import sqlite3
from flask import Blueprint, request, jsonify, current_app
from ..database import queries, connection # Import connection if needed

# Configure logging for this blueprint
logger = logging.getLogger(__name__)

admin_projects_bp = Blueprint('admin_projects', __name__, url_prefix='/admin')

# === Error Handler ===
# This handler is specific to this blueprint. A global handler might also be needed.
@admin_projects_bp.errorhandler(Exception)
def handle_exception(e):
    # Log the error internally
    logger.error(f"Unhandled exception in admin_projects: {e}", exc_info=True)
    # Return a generic error message
    return jsonify(error="An internal server error occurred"), 500

# === Projects Routes ===

@admin_projects_bp.route('/projects', methods=['GET'])
def get_projects():
    """Get all projects with their associated house types."""
    try:
        projects = queries.get_all_projects()
        return jsonify(projects)
    except Exception as e:
        logger.error(f"Error in get_projects: {e}", exc_info=True)
        return jsonify(error="Failed to fetch projects"), 500

@admin_projects_bp.route('/projects', methods=['POST'])
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
            # Assuming a query like get_project_by_id exists
            new_project = queries.get_project_by_id(new_id) # This query needs to exist in queries.py
            if new_project:
                return jsonify(new_project), 201
            else:
                # Fallback if fetch fails
                logger.warning(f"Project {new_id} added but failed to retrieve.")
                return jsonify({'project_id': new_id, 'name': name, 'description': description, 'status': status, 'house_types': house_types_data}), 201
        else:
            # Check for specific errors if add_project can return None without exception
            # Assuming a query like get_project_by_name exists
            existing = queries.get_project_by_name(name) # This query needs to exist in queries.py
            if existing:
                 return jsonify(error="Project name already exists"), 409 # Conflict
            else:
                 return jsonify(error="Failed to add project for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Projects.name' in str(ie):
             return jsonify(error="Project name already exists"), 409 # Conflict
         elif 'FOREIGN KEY constraint failed' in str(ie):
             logger.warning(f"Foreign key constraint error adding project: {ie}")
             return jsonify(error="Invalid house type specified in project details"), 400
         else:
             logger.error(f"Integrity error adding project: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in add_project: {e}", exc_info=True)
        return jsonify(error="Failed to add project"), 500


@admin_projects_bp.route('/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    """Get a single project by ID."""
    try:
        project = queries.get_project_by_id(project_id)
        if project:
            return jsonify(project)
        else:
            return jsonify(error="Project not found"), 404
    except Exception as e:
        logger.error(f"Error in get_project {project_id}: {e}", exc_info=True)
        return jsonify(error="Failed to fetch project"), 500


@admin_projects_bp.route('/projects/<int:project_id>', methods=['PUT'])
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
            # Fetch updated project data to include potentially changed house types
            updated_project = queries.get_project_by_id(project_id) # This query needs to exist in queries.py
            if updated_project:
                return jsonify(updated_project)
            else:
                # Should not happen if update succeeded, but handle defensively
                logger.warning(f"Project {project_id} updated but failed to retrieve.")
                return jsonify(error="Project updated but failed to retrieve latest data"), 500
        else:
            # Could be not found or DB error during update
            # Check if project exists first
            existing = queries.get_project_by_id(project_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Project not found"), 404
            else:
                 return jsonify(error="Project update failed for an unknown reason"), 500
    except sqlite3.IntegrityError as ie:
         if 'UNIQUE constraint failed: Projects.name' in str(ie):
             # Check if the conflict is with itself or another project
             # Assuming a query like get_project_by_name exists
             existing = queries.get_project_by_name(name) # This query needs to exist in queries.py
             if existing and existing['project_id'] != project_id:
                 return jsonify(error="Project name already exists"), 409 # Conflict
             elif not existing: # Should not happen if constraint failed, but check anyway
                 logger.error(f"Integrity error on project name update, but name '{name}' not found.", exc_info=True)
                 return jsonify(error="Database integrity error during name update"), 409
             # If existing['project_id'] == project_id, it means the name wasn't changed,
             # so the error must be something else (e.g., FK constraint)
             elif 'FOREIGN KEY constraint failed' in str(ie):
                 logger.warning(f"Foreign key constraint error updating project {project_id}: {ie}")
                 return jsonify(error="Invalid house type specified in project details"), 400
             else:
                 logger.error(f"Integrity error updating project {project_id}: {ie}", exc_info=True)
                 return jsonify(error="Database integrity error"), 409
         elif 'FOREIGN KEY constraint failed' in str(ie):
             logger.warning(f"Foreign key constraint error updating project {project_id}: {ie}")
             return jsonify(error="Invalid house type specified in project details"), 400
         else:
             logger.error(f"Integrity error updating project {project_id}: {ie}", exc_info=True)
             return jsonify(error="Database integrity error"), 409
    except Exception as e:
        logger.error(f"Error in update_project {project_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update project"), 500


@admin_projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project."""
    try:
        success = queries.delete_project(project_id)
        if success:
            return jsonify(message="Project deleted successfully"), 200 # Or 204 No Content
        else:
            # Check if project exists first
            existing = queries.get_project_by_id(project_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Project not found"), 404
            else:
                 # If delete failed but project exists, likely a constraint issue
                 logger.warning(f"Delete failed for project {project_id}, possibly due to dependencies (e.g., production plan items).")
                 return jsonify(error="Project delete failed, check dependencies (e.g., production plan)"), 409 # Conflict
    except sqlite3.IntegrityError as ie:
        # Catch foreign key constraint errors specifically if needed
        logger.warning(f"Integrity error deleting project {project_id}: {ie}")
        return jsonify(error="Cannot delete project, check dependencies (e.g., production plan)."), 409 # Conflict
    except Exception as e:
        logger.error(f"Error in delete_project {project_id}: {e}", exc_info=True)
        return jsonify(error="Failed to delete project"), 500


# === Production Plan Routes ===

# Note: POST, PUT, DELETE for /production_plan are removed as plan generation
# is now handled automatically via the PUT /projects/<id> endpoint when status changes.

@admin_projects_bp.route('/production_plan', methods=['GET'])
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
        # total_count = queries.get_production_plan_count(filters=filters) # This query needs to exist
        # response = make_response(jsonify(plan_items))
        # response.headers['X-Total-Count'] = total_count
        # return response
        return jsonify(plan_items)
    except Exception as e:
        logger.error(f"Error in get_production_plan_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch production plan"), 500

@admin_projects_bp.route('/production_plan/reorder', methods=['POST'])
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

    if not ordered_plan_ids:
         return jsonify(message="No plan IDs provided, nothing reordered"), 200 # Or 400?

    try:
        success = queries.update_production_plan_sequence(ordered_plan_ids)
        if success:
            return jsonify(message="Production plan reordered successfully"), 200
        else:
            # This could be due to a database error during the transaction
            # Or potentially invalid IDs provided that don't exist
            logger.error("Failed to reorder production plan, query returned false.")
            return jsonify(error="Failed to reorder production plan (check logs for details)"), 500
    except Exception as e:
        logger.error(f"Error in reorder_production_plan: {e}", exc_info=True)
        return jsonify(error="Failed to reorder production plan"), 500


@admin_projects_bp.route('/production_plan/change_line_bulk', methods=['POST'])
def change_production_plan_line_bulk():
    """Updates the planned assembly line for multiple production plan items."""
    data = request.get_json()
    if not data or 'plan_ids' not in data or 'new_line' not in data:
        return jsonify(error="Missing 'plan_ids' or 'new_line' in request data"), 400
    if not isinstance(data['plan_ids'], list):
        return jsonify(error="'plan_ids' must be a list"), 400

    plan_ids = data['plan_ids']
    new_line = data['new_line']

    # Basic validation
    try:
        plan_ids = [int(pid) for pid in plan_ids]
    except (ValueError, TypeError):
        return jsonify(error="All items in 'plan_ids' must be integers"), 400

    if not plan_ids:
        return jsonify(message="No plan IDs provided, nothing updated"), 200 # Or 400?

    try:
        updated_count = queries.update_production_plan_items_line_bulk(plan_ids, new_line)
        # Fetch the updated items to return them? Could be large.
        # For now, just return success message and count.
        # If frontend needs updated items, it might need to refetch or we return IDs + new line.
        return jsonify(message=f"Successfully updated line for {updated_count} items.", updated_count=updated_count), 200
    except ValueError as ve: # Catch invalid line error from query
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error changing line bulk for plan items: {e}", exc_info=True)
        return jsonify(error="Failed to change production plan lines in bulk"), 500

@admin_projects_bp.route('/production_plan/set_tipologia_bulk', methods=['POST'])
def set_production_plan_tipologia_bulk():
    """Updates the tipologia_id for multiple production plan items."""
    data = request.get_json()
    if not data or 'plan_ids' not in data or 'tipologia_id' not in data: # tipologia_id can be null
        return jsonify(error="Missing 'plan_ids' or 'tipologia_id' in request data"), 400
    if not isinstance(data['plan_ids'], list):
        return jsonify(error="'plan_ids' must be a list"), 400

    plan_ids = data['plan_ids']
    tipologia_id = data['tipologia_id'] # Can be None/null

    # Basic validation
    try:
        plan_ids = [int(pid) for pid in plan_ids]
        if tipologia_id is not None:
            tipologia_id = int(tipologia_id) # Ensure tipologia_id is int if not null
    except (ValueError, TypeError):
        return jsonify(error="All items in 'plan_ids' must be integers, and 'tipologia_id' must be an integer or null"), 400

    if not plan_ids:
        return jsonify(message="No plan IDs provided, nothing updated"), 200

    try:
        updated_count = queries.update_production_plan_items_tipologia_bulk(plan_ids, tipologia_id)
        # Fetch the updated items? Maybe not necessary, frontend can refetch or update locally.
        return jsonify(message=f"Successfully updated tipologia for {updated_count} items.", updated_count=updated_count), 200
    except Exception as e:
        logger.error(f"Error setting tipologia bulk for plan items: {e}", exc_info=True)
        return jsonify(error="Failed to set production plan tipologias in bulk"), 500


@admin_projects_bp.route('/production_plan/<int:plan_id>/change_line', methods=['PUT'])
def change_production_plan_line(plan_id):
    """Updates the planned assembly line for a specific production plan item."""
    data = request.get_json()
    if not data or 'new_line' not in data:
        return jsonify(error="Missing 'new_line' in request data"), 400

    new_line = data['new_line']

    try:
        success = queries.update_production_plan_item_line(plan_id, new_line)
        if success:
            # Fetch the updated item to return it
            # Assuming a query like get_production_plan_item_by_id exists
            updated_item = queries.get_production_plan_item_by_id(plan_id) # This query needs to exist in queries.py
            if updated_item:
                return jsonify(updated_item), 200
            else:
                # Should not happen if update succeeded, but handle defensively
                logger.warning(f"Plan item {plan_id} line updated but failed to retrieve.")
                return jsonify(error="Item updated but failed to retrieve"), 500
        else:
            # Could be plan_id not found or DB error during update
            # Check if item exists first
            existing = queries.get_production_plan_item_by_id(plan_id) # This query needs to exist in queries.py
            if not existing:
                 return jsonify(error="Production plan item not found"), 404
            else:
                 return jsonify(error="Production plan item line update failed"), 500
    except ValueError as ve: # Catch invalid line error from query
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error changing line for plan item {plan_id}: {e}", exc_info=True)
        return jsonify(error="Failed to change production plan line"), 500


# Removed PUT and DELETE endpoints for /production_plan/<plan_id>

# === Production Status Route ===

@admin_projects_bp.route('/production_status', methods=['GET'])
def get_production_status_route():
    """Get current station status and all upcoming planned items."""
    try:
        # upcoming_count parameter is removed
        status_data = queries.get_station_status_and_upcoming() # Call without count
        return jsonify(status_data)
    except Exception as e:
        logger.error(f"Error in get_production_status_route: {e}", exc_info=True)
        return jsonify(error="Failed to fetch production status"), 500
