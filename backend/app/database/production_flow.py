import sqlite3
from datetime import datetime, timedelta
import logging
import json
from .connection import get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_module_for_panel_production():
    """
    Finds the plan_id of the first module (ordered by planned_sequence)
    in 'Planned' or 'Panels' status for which not all required panels
    have been added to the PanelProductionPlan.
    """
    db = get_db()
    
    candidate_modules_cursor = db.execute("""
        SELECT plan_id, house_type_id, module_number, sub_type_id
        FROM ModuleProductionPlan
        WHERE status IN ('Planned', 'Panels')
        ORDER BY planned_sequence ASC
    """)
    candidate_modules = candidate_modules_cursor.fetchall()

    for module_row in candidate_modules:
        module = dict(module_row)
        plan_id = module['plan_id']
        house_type_id = module['house_type_id']
        module_number = module['module_number']
        module_sub_type_id = module['sub_type_id']

        required_panel_ids_query = """
            SELECT panel_definition_id FROM PanelDefinitions
            WHERE house_type_id = ? AND module_sequence_number = ?
        """
        params = [house_type_id, module_number]
        if module_sub_type_id is not None:
            required_panel_ids_query += " AND (sub_type_id = ? OR sub_type_id IS NULL)"
            params.append(module_sub_type_id)
        else:
            required_panel_ids_query += " AND sub_type_id IS NULL"
        
        required_panels_cursor = db.execute(required_panel_ids_query, tuple(params))
        required_panel_ids = {row['panel_definition_id'] for row in required_panels_cursor.fetchall()}

        ppp_cursor = db.execute("SELECT panel_definition_id FROM PanelProductionPlan WHERE plan_id = ?", (plan_id,))
        panels_in_production_ids = {row['panel_definition_id'] for row in ppp_cursor.fetchall()}

        if not required_panel_ids.issubset(panels_in_production_ids):
            panels_to_produce_ids = list(required_panel_ids - panels_in_production_ids)
            
            if not panels_to_produce_ids: # Should not happen if not subset, but as a safeguard
                logging.info(f"Module {plan_id} selected, but no new panels to produce. Required: {required_panel_ids}, In PPP: {panels_in_production_ids}")
                continue

            # Fetch module details for module_name
            mpp_details_cursor = db.execute(
                "SELECT project_name, house_identifier, module_number FROM ModuleProductionPlan WHERE plan_id = ?",
                (plan_id,)
            )
            mpp_details_row = mpp_details_cursor.fetchone()
            if not mpp_details_row:
                logging.error(f"Could not fetch ModuleProductionPlan details for plan_id {plan_id}")
                continue 
            
            mpp_details = dict(mpp_details_row)
            module_name_str = f"{mpp_details['project_name']} - {mpp_details['house_identifier']} - Mod {mpp_details['module_number']}"

            panels_info = []
            if panels_to_produce_ids:
                placeholders = ','.join('?' for _ in panels_to_produce_ids)
                panel_defs_cursor = db.execute(
                    f"SELECT panel_definition_id, panel_code, panel_group FROM PanelDefinitions WHERE panel_definition_id IN ({placeholders})",
                    panels_to_produce_ids
                )
                panels_info = [dict(row) for row in panel_defs_cursor.fetchall()]

            logging.info(f"Module for next panel production: plan_id {plan_id}. Panels to produce: {panels_info}")
            return {
                "plan_id": plan_id,
                "module_name": module_name_str,
                "panels_to_produce": panels_info
            }
            
    logging.info("No suitable module found for starting new panel production.")
    return None

# === Station Status and Upcoming Modules ===

def get_station_status_and_upcoming_modules():
    """Fetches current module at each station and all upcoming planned/scheduled/magazine items from ModuleProductionPlan."""
    db = get_db()

    # 1. Fetch all stations
    stations_cursor = db.execute("SELECT station_id, name as station_name, line_type, sequence_order FROM Stations ORDER BY sequence_order, line_type")
    all_stations = [dict(row) for row in stations_cursor.fetchall()]

    # 2. Fetch relevant ModuleProductionPlan items for current station occupancy
    # For 'Panels' status (potentially multiple, but the first by sequence is considered 'current' for the W line display)
    panels_modules_cursor = db.execute("""
        SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
               mpp.house_identifier, mpp.module_number, ht.number_of_modules,
               mpp.status, mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status = 'Panels'
        ORDER BY mpp.planned_sequence ASC
    """)
    panels_active_modules_rows = [dict(row) for row in panels_modules_cursor.fetchall()]

    # For 'Magazine' status (for M1 station)
    magazine_modules_cursor = db.execute("""
        SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
               mpp.house_identifier, mpp.module_number, ht.number_of_modules,
               mpp.status, mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status = 'Magazine'
        ORDER BY mpp.planned_sequence ASC
    """)
    magazine_active_modules_rows = [dict(row) for row in magazine_modules_cursor.fetchall()]

    # For 'Assembly' status (for A, B, C lines)
    assembly_modules_cursor = db.execute("""
        SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
               mpp.house_identifier, mpp.module_number, ht.number_of_modules,
               mpp.status, mpp.planned_assembly_line, mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status = 'Assembly'
        ORDER BY mpp.planned_assembly_line, mpp.planned_sequence ASC
    """)
    assembly_active_modules_rows = [dict(row) for row in assembly_modules_cursor.fetchall()]

    station_status_list = []

    for station in all_stations:
        station_data = {
            'station_id': station['station_id'],
            'station_name': station['station_name'],
            'line_type': station['line_type'],
            'sequence_order': station['sequence_order'],
            'current_module': None 
        }
        
        active_mpp_item_dict = None

        if station['line_type'] == 'W':
            if panels_active_modules_rows: # Check if there are any modules in 'Panels' status
                active_mpp_item_dict = panels_active_modules_rows[0] # Take the first one by sequence
        elif station['line_type'] == 'M' and station['station_id'] == 'M1':
            if magazine_active_modules_rows: # Show the first 'Magazine' module by sequence
                active_mpp_item_dict = magazine_active_modules_rows[0] 
        elif station['line_type'] in ['A', 'B', 'C']:
            for mod_row in assembly_active_modules_rows:
                if mod_row['planned_assembly_line'] == station['line_type']:
                    active_mpp_item_dict = mod_row
                    break 

        if active_mpp_item_dict:
            panels = _get_panels_with_status_for_plan(
                db, 
                active_mpp_item_dict['plan_id'], 
                active_mpp_item_dict['house_type_id'],
                active_mpp_item_dict['module_number'],
                active_mpp_item_dict['sub_type_id']
            )
            
            station_data['current_module'] = {
                'plan_id': active_mpp_item_dict['plan_id'],
                'project_name': active_mpp_item_dict['project_name'],
                'house_identifier': active_mpp_item_dict['house_identifier'],
                'module_number': active_mpp_item_dict['module_number'],
                'module_sequence_in_house': active_mpp_item_dict['module_number'],
                'status': active_mpp_item_dict['status'],
                'house_type_name': active_mpp_item_dict['house_type_name'],
                'house_type_id': active_mpp_item_dict['house_type_id'],
                'number_of_modules': active_mpp_item_dict['number_of_modules'],
                'sub_type_name': active_mpp_item_dict.get('sub_type_name'),
                'sub_type_id': active_mpp_item_dict.get('sub_type_id'),
                'panels': panels
            }
        station_status_list.append(station_data)
    
    station_status = station_status_list

    upcoming_query = """
        SELECT
            mpp.plan_id, mpp.project_name,
            mpp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            mpp.house_identifier, mpp.module_number,
            mpp.planned_sequence, mpp.planned_start_datetime,
            mpp.planned_assembly_line, mpp.status,
            mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status != 'Completed'
        ORDER BY mpp.planned_sequence ASC
    """
    upcoming_cursor = db.execute(upcoming_query)
    upcoming_items = [dict(row) for row in upcoming_cursor.fetchall()]

    result = {
        'station_status': station_status,
        'upcoming_items': upcoming_items
    }
    logging.info(f"Returning station status and upcoming modules: {json.dumps(result, indent=2)}")
    return result

def get_current_station_panels(station_id):
    """
    Retrieves panels currently assigned to a specific station from PanelProductionPlan.

    Args:
        station_id (str): The ID of the station to query.

    Returns:
        list: A list of dictionaries, where each dictionary contains:
              - panel_production_plan_id (int)
              - panel_definition_id (int)
              - plan_id (int)
              - module_name (str): Formatted as "Project Name - House Identifier - Mod Module Number"
              - panel_name (str): The panel_code from PanelDefinitions
    """
    db = get_db()
    cursor = db.execute("""
        SELECT
            ppp.panel_production_plan_id,
            ppp.panel_definition_id,
            ppp.plan_id,
            pd.panel_code,
            mpp.project_name,
            mpp.house_identifier,
            mpp.module_number
        FROM PanelProductionPlan ppp
        JOIN PanelDefinitions pd ON ppp.panel_definition_id = pd.panel_definition_id
        JOIN ModuleProductionPlan mpp ON ppp.plan_id = mpp.plan_id
        WHERE ppp.current_station = ? AND ppp.status = 'In Progress' -- Assuming we only want active panels
    """, (station_id,))
    
    panels_at_station = []
    for row_data in cursor.fetchall():
        row = dict(row_data) # Convert sqlite3.Row to dict for easier access
        panels_at_station.append({
            'panel_production_plan_id': row['panel_production_plan_id'],
            'panel_definition_id': row['panel_definition_id'],
            'plan_id': row['plan_id'],
            'module_name': f"{row['project_name']} - {row['house_identifier']} - Mod {row['module_number']}",
            'panel_name': row['panel_code']
        })
    
    logging.info(f"Found {len(panels_at_station)} panels at station {station_id}: {json.dumps(panels_at_station, indent=2)}")
    return panels_at_station


def get_tasks_for_panel_production_item(plan_id: int, panel_definition_id: int, station_id: str = None, specialty_id: int = None):
    """
    Retrieves relevant panel tasks for a specific panel_definition_id within a given plan_id,
    filtered by station and worker's specialty, along with their status from PanelTaskLogs.
    """
    db = get_db()

    # Validate plan_id
    module_info_cursor = db.execute("SELECT house_type_id FROM ModuleProductionPlan WHERE plan_id = ?", (plan_id,))
    module_info = module_info_cursor.fetchone()
    if not module_info:
        logging.warning(f"get_tasks_for_panel_production_item: ModuleProductionPlan item not found for plan_id {plan_id}")
        return []

    query_params = []

    base_query_select_from = """
        SELECT
            td.task_definition_id,
            td.name,
            td.description,
            td.station_sequence_order,
            td.specialty_id AS task_specialty_id,
            td.is_panel_task,
            COALESCE(ptl.status, 'Not Started') as status,
            ptl.started_at,
            ptl.completed_at,
            ptl.station_start,
            ptl.station_finish,
            ptl.panel_task_log_id,
            ptl.notes
        FROM ModuleProductionPlan mpp
        JOIN TaskDefinitions td ON (td.house_type_id = mpp.house_type_id OR td.house_type_id IS NULL)
        LEFT JOIN PanelTaskLogs ptl ON td.task_definition_id = ptl.task_definition_id
            AND ptl.plan_id = mpp.plan_id
            AND ptl.panel_definition_id = ?
    """
    query_params.append(panel_definition_id)

    where_clauses = ["mpp.plan_id = ?", "td.is_panel_task = 1"]
    query_params.append(plan_id)

    # Station filtering
    if station_id:
        station_info_cursor = db.execute("SELECT sequence_order FROM Stations WHERE station_id = ?", (station_id,))
        station_info = station_info_cursor.fetchone()
        if station_info:
            station_sequence_order_val = station_info['sequence_order']
            where_clauses.append("(td.station_sequence_order = ? OR td.station_sequence_order IS NULL)")
            query_params.append(station_sequence_order_val)
        else:
            logging.warning(f"get_tasks_for_panel_production_item: Station '{station_id}' not found. Returning no tasks.")
            return [] 
    else:
        # No station_id provided, only match tasks not specific to any station sequence
        where_clauses.append("td.station_sequence_order IS NULL")

    # Specialty filtering
    if specialty_id is not None:
        where_clauses.append("(td.specialty_id = ? OR td.specialty_id IS NULL)")
        query_params.append(specialty_id)
    else:
        # No specialty_id provided, only match tasks not specific to any specialty
        where_clauses.append("td.specialty_id IS NULL")

    full_query = base_query_select_from + " WHERE " + " AND ".join(where_clauses) + " ORDER BY td.name;"
    
    tasks_cursor = db.execute(full_query, tuple(query_params))
    tasks = [dict(row) for row in tasks_cursor.fetchall()]
    
    logging.info(f"Found {len(tasks)} tasks for plan_id {plan_id}, panel_definition_id {panel_definition_id}, station_id '{station_id}', specialty_id {specialty_id}: {json.dumps(tasks, indent=2)}")
    return tasks

# === Panel Task Management ===

def _resume_panel_task_logic(db, panel_task_log_id: int, worker_id: int):
    """
    Helper function to resume a paused panel task.
    Updates TaskPauses and PanelTaskLog.
    """
    now_utc = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    try:
        # Update the latest TaskPauses entry for this panel_task_log_id
        cursor = db.execute(
            """UPDATE TaskPauses SET resumed_at = ?
               WHERE rowid = (
                   SELECT rowid FROM TaskPauses
                   WHERE panel_task_log_id = ? AND resumed_at IS NULL
                   ORDER BY paused_at DESC
                   LIMIT 1
               )""",
            (now_utc, panel_task_log_id)
        )
        if cursor.rowcount == 0:
            # This might happen if the task was not actually paused or if there's a data inconsistency.
            logging.warning(f"Resume panel task: No open pause entry found for panel_task_log_id {panel_task_log_id}.")
            # Depending on desired strictness, could raise an error here.

        # Update PanelTaskLog status
        db.execute(
            "UPDATE PanelTaskLogs SET status = 'In Progress', worker_id = ? WHERE panel_task_log_id = ?",
            (worker_id, panel_task_log_id)
        )
        db.commit()
        logging.info(f"Panel task {panel_task_log_id} resumed by worker {worker_id}.")
        return True
    except sqlite3.Error as e:
        db.rollback()
        logging.error(f"Error in _resume_panel_task_logic for panel_task_log_id {panel_task_log_id}: {e}", exc_info=True)
        raise


def start_panel_task(plan_id: int, panel_definition_id: int, task_definition_id: int, worker_id: int, station_id: str):
    """
    Starts a new panel task or resumes a paused one.
    Handles W1 station specific logic for PanelProductionPlan and ModuleProductionPlan.
    """
    db = get_db()
    now_utc_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    try:
        # Check for existing PanelTaskLog for this specific task on this panel
        existing_log_cursor = db.execute(
            """SELECT panel_task_log_id, status FROM PanelTaskLogs
               WHERE plan_id = ? AND panel_definition_id = ? AND task_definition_id = ?""",
            (plan_id, panel_definition_id, task_definition_id)
        )
        existing_log_row = existing_log_cursor.fetchone()

        panel_task_log_data = None

        if existing_log_row:
            existing_log = dict(existing_log_row)
            log_id = existing_log['panel_task_log_id']
            status = existing_log['status']

            if status == 'Paused':
                logging.info(f"Resuming panel task for log_id {log_id} by worker {worker_id} at station {station_id}.")
                _resume_panel_task_logic(db, log_id, worker_id)
                # Fetch the updated log to return
                updated_log_cursor = db.execute("SELECT * FROM PanelTaskLogs WHERE panel_task_log_id = ?", (log_id,))
                panel_task_log_data = dict(updated_log_cursor.fetchone())
            elif status in ['In Progress', 'Completed']:
                logging.warning(f"Panel task for plan_id {plan_id}, panel_def_id {panel_definition_id}, task_def_id {task_definition_id} is already '{status}'.")
                return {"error": f"Task is already {status}."}
            else: # Not Started or other states - treat as new start for this context
                logging.info(f"Panel task log {log_id} found with status '{status}'. Updating to 'In Progress'.")
                db.execute(
                    """UPDATE PanelTaskLogs 
                       SET status = 'In Progress', worker_id = ?, started_at = ?, station_start = ?
                       WHERE panel_task_log_id = ?""",
                    ('In Progress', worker_id, now_utc_str, station_id, log_id)
                )
                db.commit()
                updated_log_cursor = db.execute("SELECT * FROM PanelTaskLogs WHERE panel_task_log_id = ?", (log_id,))
                panel_task_log_data = dict(updated_log_cursor.fetchone())

        else: # No existing log for this specific task on this panel, create a new one
            logging.info(f"Creating new PanelTaskLog for plan_id {plan_id}, panel_def_id {panel_definition_id}, task_def_id {task_definition_id} by worker {worker_id} at station {station_id}.")
            cursor = db.execute(
                """INSERT INTO PanelTaskLogs 
                   (plan_id, panel_definition_id, task_definition_id, worker_id, status, started_at, station_start)
                   VALUES (?, ?, ?, ?, 'In Progress', ?, ?)""",
                (plan_id, panel_definition_id, task_definition_id, worker_id, now_utc_str, station_id)
            )
            new_log_id = cursor.lastrowid
            db.commit() # Commit early to get the ID and for W1 logic to see this task if needed
            
            created_log_cursor = db.execute("SELECT * FROM PanelTaskLogs WHERE panel_task_log_id = ?", (new_log_id,))
            panel_task_log_data = dict(created_log_cursor.fetchone())

        # W1 Logic
        if station_id == 'W1':
            # Ensure PanelProductionPlan entry exists and is 'In Progress'
            ppp_cursor = db.execute(
                "SELECT panel_production_plan_id, status FROM PanelProductionPlan WHERE plan_id = ? AND panel_definition_id = ?",
                (plan_id, panel_definition_id)
            )
            ppp_row = ppp_cursor.fetchone()

            if ppp_row:
                ppp = dict(ppp_row)
                if ppp['status'] != 'In Progress':
                    db.execute(
                        "UPDATE PanelProductionPlan SET status = 'In Progress', current_station = 'W1', updated_at = ? WHERE panel_production_plan_id = ?",
                        (now_utc_str, ppp['panel_production_plan_id'])
                    )
                    logging.info(f"PPP entry {ppp['panel_production_plan_id']} for plan_id {plan_id}, panel_def_id {panel_definition_id} updated to 'In Progress' at W1.")
            else:
                db.execute(
                    """INSERT INTO PanelProductionPlan (plan_id, panel_definition_id, status, current_station, created_at, updated_at)
                       VALUES (?, ?, 'In Progress', 'W1', ?, ?)""",
                    (plan_id, panel_definition_id, now_utc_str, now_utc_str)
                )
                logging.info(f"New PPP entry created for plan_id {plan_id}, panel_def_id {panel_definition_id}, status 'In Progress' at W1.")

            # Ensure ModuleProductionPlan.status for plan_id is 'Panels'
            mpp_cursor = db.execute("SELECT status FROM ModuleProductionPlan WHERE plan_id = ?", (plan_id,))
            mpp_row = mpp_cursor.fetchone()
            if mpp_row and mpp_row['status'] == 'Planned':
                db.execute("UPDATE ModuleProductionPlan SET status = 'Panels', updated_at = ? WHERE plan_id = ?", (now_utc_str, plan_id))
                logging.info(f"ModuleProductionPlan {plan_id} status updated from 'Planned' to 'Panels'.")
            elif not mpp_row:
                 logging.error(f"W1 Logic: ModuleProductionPlan item not found for plan_id {plan_id}")
                 # This implies a data integrity issue if a panel task is started for a non-existent plan.
                 # Depending on desired behavior, could raise an error or return a specific error message.
                 db.rollback() # Rollback W1 changes if MPP doesn't exist
                 return {"error": f"ModuleProductionPlan item not found for plan_id {plan_id} during W1 logic."}


            db.commit() # Commit changes from W1 logic

        if not panel_task_log_data: # Should have been set if new or resumed
             # Refetch if it wasn't set, e.g. after resuming and not explicitly re-querying before W1 logic
            log_id_to_fetch = existing_log_row['panel_task_log_id'] if existing_log_row else new_log_id
            refetched_log_cursor = db.execute("SELECT * FROM PanelTaskLogs WHERE panel_task_log_id = ?", (log_id_to_fetch,))
            panel_task_log_data = dict(refetched_log_cursor.fetchone())

        logging.info(f"start_panel_task successful for plan_id {plan_id}, panel_def_id {panel_definition_id}, task_def_id {task_definition_id}. Log data: {panel_task_log_data}")
        return {"success": True, "panel_task_log": panel_task_log_data}

    except sqlite3.Error as e:
        db.rollback()
        logging.error(f"Database error in start_panel_task for plan_id {plan_id}, panel_def_id {panel_definition_id}, task_def_id {task_definition_id}: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error in start_panel_task for plan_id {plan_id}, panel_def_id {panel_definition_id}, task_def_id {task_definition_id}: {e}", exc_info=True)
        return {"error": f"Unexpected error: {e}"}


def pause_panel_task(panel_task_log_id: int, worker_id: int, reason: str):
    """
    Pauses a panel task.
    Updates PanelTaskLog status and creates a TaskPauses entry.
    """
    db = get_db()
    now_utc_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    try:
        # Check if the task is actually in a pausable state
        log_cursor = db.execute("SELECT status FROM PanelTaskLogs WHERE panel_task_log_id = ?", (panel_task_log_id,))
        log_row = log_cursor.fetchone()

        if not log_row:
            return {"error": f"PanelTaskLog with id {panel_task_log_id} not found."}
        
        current_status = log_row['status']
        if current_status != 'In Progress':
            return {"error": f"Task {panel_task_log_id} is not 'In Progress' (current status: {current_status}). Cannot pause."}

        # Update PanelTaskLog status to 'Paused'
        db.execute(
            "UPDATE PanelTaskLogs SET status = 'Paused' WHERE panel_task_log_id = ?",
            (panel_task_log_id,)
        )

        # Create TaskPauses entry
        db.execute(
            """INSERT INTO TaskPauses (panel_task_log_id, paused_by_worker_id, paused_at, reason)
               VALUES (?, ?, ?, ?)""",
            (panel_task_log_id, worker_id, now_utc_str, reason)
        )
        db.commit()
        logging.info(f"Panel task {panel_task_log_id} paused by worker {worker_id}. Reason: {reason}")
        return {"success": True, "message": f"Task {panel_task_log_id} paused successfully."}
    except sqlite3.Error as e:
        db.rollback()
        logging.error(f"Database error in pause_panel_task for panel_task_log_id {panel_task_log_id}: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error in pause_panel_task for panel_task_log_id {panel_task_log_id}: {e}", exc_info=True)
        return {"error": f"Unexpected error: {e}"}


def resume_panel_task(panel_task_log_id: int, worker_id: int):
    """
    Resumes a paused panel task using the helper logic.
    """
    db = get_db()
    try:
        # Check if the task is actually paused
        log_cursor = db.execute("SELECT status FROM PanelTaskLogs WHERE panel_task_log_id = ?", (panel_task_log_id,))
        log_row = log_cursor.fetchone()

        if not log_row:
            return {"error": f"PanelTaskLog with id {panel_task_log_id} not found."}
        
        current_status = log_row['status']
        if current_status != 'Paused':
            return {"error": f"Task {panel_task_log_id} is not 'Paused' (current status: {current_status}). Cannot resume directly (should be handled by start_panel_task if starting)."}

        if _resume_panel_task_logic(db, panel_task_log_id, worker_id):
            return {"success": True, "message": f"Task {panel_task_log_id} resumed successfully."}
        else:
            # _resume_panel_task_logic raises errors, so this path might not be hit often
            return {"error": "Failed to resume task for unspecified reason."} 
            
    except sqlite3.Error as e:
        # db.rollback() is handled by _resume_panel_task_logic if it's the source
        logging.error(f"Database error in resume_panel_task for panel_task_log_id {panel_task_log_id}: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except Exception as e:
        # db.rollback() is handled by _resume_panel_task_logic if it's the source
        logging.error(f"Unexpected error in resume_panel_task for panel_task_log_id {panel_task_log_id}: {e}", exc_info=True)
        return {"error": f"Unexpected error: {e}"}


def finish_panel_task(panel_task_log_id: int, worker_id: int, station_id: str, notes: str = None):
    """
    Marks a panel task as completed.
    Checks if all tasks for the panel at the current station are done.
    If so, and if it's a 'W' line station, advances the panel to the next 'W' station
    or marks PanelProductionPlan as 'Completed'.
    """
    db = get_db()
    now_utc_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    updated_ppp_details = None

    try:
        # Update PanelTaskLog to 'Completed'
        cursor = db.execute(
            """UPDATE PanelTaskLogs 
               SET status = 'Completed', completed_at = ?, worker_id = ?, station_finish = ?, notes = ?
               WHERE panel_task_log_id = ?""",
            (now_utc_str, worker_id, station_id, notes, panel_task_log_id)
        )
        if cursor.rowcount == 0:
            return {"error": f"PanelTaskLog with id {panel_task_log_id} not found or not updated."}

        # Get plan_id and panel_definition_id from the completed task log
        log_info_cursor = db.execute(
            "SELECT plan_id, panel_definition_id FROM PanelTaskLogs WHERE panel_task_log_id = ?",
            (panel_task_log_id,)
        )
        log_info = log_info_cursor.fetchone()
        if not log_info:
            # Should not happen if update above was successful
            db.rollback()
            return {"error": "Failed to retrieve log info after update."}
        
        current_plan_id = log_info['plan_id']
        current_panel_definition_id = log_info['panel_definition_id']

        # Check if all tasks for this panel at this station are completed
        # 1. Get house_type_id from ModuleProductionPlan
        mpp_cursor = db.execute("SELECT house_type_id FROM ModuleProductionPlan WHERE plan_id = ?", (current_plan_id,))
        mpp_info = mpp_cursor.fetchone()
        if not mpp_info:
            db.rollback()
            return {"error": f"ModuleProductionPlan not found for plan_id {current_plan_id}."}
        house_type_id = mpp_info['house_type_id']

        # 2. Get current station's sequence_order
        current_station_info_cursor = db.execute("SELECT sequence_order, line_type FROM Stations WHERE station_id = ?", (station_id,))
        current_station_info = current_station_info_cursor.fetchone()
        if not current_station_info:
            db.rollback()
            return {"error": f"Station {station_id} not found."}
        current_station_sequence = current_station_info['sequence_order']
        current_station_line_type = current_station_info['line_type']

        # 3. Get all relevant task definitions for this panel type at this station sequence
        # Tasks can be generic (house_type_id IS NULL) or specific to the house_type_id.
        # Tasks can be generic (station_sequence_order IS NULL - less common for station-based flow) or specific to the station_sequence_order.
        required_tasks_cursor = db.execute(
            """SELECT td.task_definition_id FROM TaskDefinitions td
               WHERE (td.house_type_id = ? OR td.house_type_id IS NULL)
                 AND td.is_panel_task = 1
                 AND td.station_sequence_order = ?""",
            (house_type_id, current_station_sequence)
        )
        required_task_defs = required_tasks_cursor.fetchall()
        
        if not required_task_defs:
            logging.info(f"No specific panel tasks defined for house_type {house_type_id} at station sequence {current_station_sequence}. Proceeding as if all tasks are complete for this station.")
            all_tasks_completed_at_station = True
        else:
            required_task_def_ids = [row['task_definition_id'] for row in required_task_defs]
            placeholders = ','.join('?' for _ in required_task_def_ids)

            # 4. Check status of these tasks in PanelTaskLogs
            completed_tasks_cursor = db.execute(
                f"""SELECT COUNT(DISTINCT task_definition_id) as completed_count FROM PanelTaskLogs
                   WHERE plan_id = ? AND panel_definition_id = ?
                     AND task_definition_id IN ({placeholders})
                     AND status = 'Completed'""",
                [current_plan_id, current_panel_definition_id] + required_task_def_ids
            )
            completed_count = completed_tasks_cursor.fetchone()['completed_count']
            all_tasks_completed_at_station = (completed_count == len(required_task_def_ids))

        if all_tasks_completed_at_station:
            logging.info(f"All tasks for panel {current_panel_definition_id} (plan {current_plan_id}) at station {station_id} (seq {current_station_sequence}) are completed.")
            
            if current_station_line_type == 'W':
                # Find next station in 'W' line
                next_station_cursor = db.execute(
                    """SELECT station_id FROM Stations
                       WHERE line_type = 'W' AND sequence_order > ?
                       ORDER BY sequence_order ASC LIMIT 1""",
                    (current_station_sequence,)
                )
                next_w_station = next_station_cursor.fetchone()

                ppp_update_fields = {"updated_at": now_utc_str}
                if next_w_station:
                    ppp_update_fields["current_station"] = next_w_station['station_id']
                    logging.info(f"Panel {current_panel_definition_id} (plan {current_plan_id}) moved to next W station: {next_w_station['station_id']}.")
                else: # No next 'W' station, it was W5 (or last W station in sequence)
                    ppp_update_fields["current_station"] = None # Or some other indicator like 'MagazineGate' if needed
                    ppp_update_fields["status"] = 'Completed' # Panel production itself is done
                    logging.info(f"Panel {current_panel_definition_id} (plan {current_plan_id}) completed W line production.")

                set_clauses = ", ".join([f"{key} = ?" for key in ppp_update_fields.keys()])
                params = list(ppp_update_fields.values()) + [current_plan_id, current_panel_definition_id]
                
                db.execute(
                    f"UPDATE PanelProductionPlan SET {set_clauses} WHERE plan_id = ? AND panel_definition_id = ?",
                    params
                )
                
                # Fetch updated PPP details to return
                updated_ppp_cursor = db.execute(
                    "SELECT * FROM PanelProductionPlan WHERE plan_id = ? AND panel_definition_id = ?",
                    (current_plan_id, current_panel_definition_id)
                )
                updated_ppp_details = dict(updated_ppp_cursor.fetchone())

        db.commit()
        logging.info(f"Panel task {panel_task_log_id} finished by worker {worker_id} at station {station_id}. Notes: {notes}")
        response = {"success": True, "message": f"Task {panel_task_log_id} completed."}
        if updated_ppp_details:
            response["panel_production_plan_update"] = updated_ppp_details
        return response

    except sqlite3.Error as e:
        db.rollback()
        logging.error(f"Database error in finish_panel_task for PTL_id {panel_task_log_id}: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error in finish_panel_task for PTL_id {panel_task_log_id}: {e}", exc_info=True)
        return {"error": f"Unexpected error: {e}"}


