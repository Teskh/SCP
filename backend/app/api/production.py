import logging
import sqlite3
from flask import Blueprint, request, jsonify
from ..database import queries

# Configure logging for this blueprint
logger = logging.getLogger(__name__)

production_bp = Blueprint('production', __name__, url_prefix='/api/production')

# === Error Handler ===
@production_bp.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception in production: {e}", exc_info=True)
    return jsonify(error="An internal server error occurred"), 500

# === Station Context Routes ===

@production_bp.route('/station-context/<station_id>', methods=['GET'])
def get_station_context_route(station_id):
    """Get the current production context for a specific station."""
    try:
        worker_specialty_id = request.args.get('worker_specialty_id', type=int)
        
        context = queries.get_station_context(station_id, worker_specialty_id)
        
        if context is None:
            return jsonify(error="Station not found"), 404
        
        return jsonify(context)
    except Exception as e:
        logger.error(f"Error getting station context for {station_id}: {e}", exc_info=True)
        return jsonify(error="Failed to get station context"), 500

@production_bp.route('/worker-current-task/<int:worker_id>', methods=['GET'])
def get_worker_current_task_route(worker_id):
    """Get the current active task for a worker."""
    try:
        current_task = queries.get_worker_current_task(worker_id)
        
        if current_task is None:
            return jsonify(message="No active task for worker"), 200
        
        return jsonify(current_task)
    except Exception as e:
        logger.error(f"Error getting current task for worker {worker_id}: {e}", exc_info=True)
        return jsonify(error="Failed to get worker current task"), 500

# === Task Management Routes ===

@production_bp.route('/panel-task/start', methods=['POST'])
def start_panel_task_route():
    """Start a new panel task."""
    data = request.get_json()
    required_fields = ['plan_id', 'panel_definition_id', 'task_definition_id', 'worker_id', 'station_id']
    
    if not data or not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        return jsonify(error=f"Missing required fields: {', '.join(missing)}"), 400
    
    try:
        plan_id = int(data['plan_id'])
        panel_definition_id = int(data['panel_definition_id'])
        task_definition_id = int(data['task_definition_id'])
        worker_id = int(data['worker_id'])
        station_id = str(data['station_id'])
        
        task_log_id = queries.start_panel_task(
            plan_id, panel_definition_id, task_definition_id, worker_id, station_id
        )
        
        if task_log_id:
            return jsonify({
                'message': 'Task started successfully',
                'panel_task_log_id': task_log_id
            }), 201
        else:
            return jsonify(error="Failed to start task"), 500
            
    except ValueError as ve:
        logger.warning(f"Validation error starting panel task: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error starting panel task: {e}", exc_info=True)
        return jsonify(error="Failed to start panel task"), 500

@production_bp.route('/panel-task/<int:panel_task_log_id>/pause', methods=['POST'])
def pause_panel_task_route(panel_task_log_id):
    """Pause an active panel task."""
    data = request.get_json()
    
    if not data or 'worker_id' not in data:
        return jsonify(error="Missing required field: worker_id"), 400
    
    try:
        worker_id = int(data['worker_id'])
        reason = data.get('reason')
        
        success = queries.pause_panel_task(panel_task_log_id, worker_id, reason)
        
        if success:
            return jsonify(message="Task paused successfully"), 200
        else:
            return jsonify(error="Failed to pause task or task not found"), 404
            
    except ValueError as ve:
        logger.warning(f"Validation error pausing panel task: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error pausing panel task {panel_task_log_id}: {e}", exc_info=True)
        return jsonify(error="Failed to pause panel task"), 500

@production_bp.route('/panel-task/<int:panel_task_log_id>/resume', methods=['POST'])
def resume_panel_task_route(panel_task_log_id):
    """Resume a paused panel task."""
    data = request.get_json()
    
    if not data or 'worker_id' not in data:
        return jsonify(error="Missing required field: worker_id"), 400
    
    try:
        worker_id = int(data['worker_id'])
        
        success = queries.resume_panel_task(panel_task_log_id, worker_id)
        
        if success:
            return jsonify(message="Task resumed successfully"), 200
        else:
            return jsonify(error="Failed to resume task or task not found"), 404
            
    except ValueError as ve:
        logger.warning(f"Validation error resuming panel task: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error resuming panel task {panel_task_log_id}: {e}", exc_info=True)
        return jsonify(error="Failed to resume panel task"), 500

@production_bp.route('/panel-task/<int:panel_task_log_id>/finish', methods=['POST'])
def finish_panel_task_route(panel_task_log_id):
    """Finish a panel task."""
    data = request.get_json()
    
    if not data or 'worker_id' not in data or 'station_id' not in data:
        return jsonify(error="Missing required fields: worker_id, station_id"), 400
    
    try:
        worker_id = int(data['worker_id'])
        station_id = str(data['station_id'])
        notes = data.get('notes')
        
        success = queries.finish_panel_task(panel_task_log_id, worker_id, station_id, notes)
        
        if success:
            return jsonify(message="Task finished successfully"), 200
        else:
            return jsonify(error="Failed to finish task or task not found"), 404
            
    except ValueError as ve:
        logger.warning(f"Validation error finishing panel task: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error finishing panel task {panel_task_log_id}: {e}", exc_info=True)
        return jsonify(error="Failed to finish panel task"), 500

# === Panel Status Routes ===

@production_bp.route('/panel-production-plan/<int:panel_plan_id>/status', methods=['PUT'])
def update_panel_status_route(panel_plan_id):
    """Update the status of a panel production plan item."""
    data = request.get_json()
    
    if not data or 'status' not in data:
        return jsonify(error="Missing required field: status"), 400
    
    try:
        status = str(data['status'])
        current_station = data.get('current_station')
        
        success = queries.update_panel_production_status(panel_plan_id, status, current_station)
        
        if success:
            return jsonify(message="Panel status updated successfully"), 200
        else:
            return jsonify(error="Failed to update panel status or panel not found"), 404
            
    except ValueError as ve:
        logger.warning(f"Validation error updating panel status: {ve}")
        return jsonify(error=str(ve)), 400
    except Exception as e:
        logger.error(f"Error updating panel status {panel_plan_id}: {e}", exc_info=True)
        return jsonify(error="Failed to update panel status"), 500

@production_bp.route('/panels', methods=['GET'])
def get_panels_by_status_and_station_route():
    """Get panels filtered by status and/or current station."""
    try:
        status = request.args.get('status')
        current_station = request.args.get('current_station')
        
        panels = queries.get_panels_by_status_and_station(status, current_station)
        
        return jsonify(panels)
    except Exception as e:
        logger.error(f"Error getting panels by status and station: {e}", exc_info=True)
        return jsonify(error="Failed to get panels"), 500

@production_bp.route('/module-production-plan/<int:plan_id>/panels', methods=['GET'])
def get_panels_for_module_route(plan_id):
    """Get all panel production plan items for a specific module."""
    try:
        panels = queries.get_panels_production_plan_for_module(plan_id)
        
        return jsonify(panels)
    except Exception as e:
        logger.error(f"Error getting panels for module {plan_id}: {e}", exc_info=True)
        return jsonify(error="Failed to get panels for module"), 500