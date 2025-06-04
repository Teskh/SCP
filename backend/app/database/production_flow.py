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

            logging.info(f"Module for next panel production: plan_id {plan_id}. HouseType ID: {house_type_id}. Panels to produce: {panels_info}")
            return {
                "plan_id": plan_id,
                "house_type_id": house_type_id, # Add house_type_id here
                "module_name": module_name_str,
                "panels_to_produce": panels_info
            }
            
    logging.info("No suitable module found for starting new panel production.")
    return None

def _get_panels_with_status_for_plan(db, plan_id, house_type_id, module_number, module_sub_type_id):
    """
    Retrieves all defined panels for a given module and their current production status.
    """
    panels_with_status = []

    # 1. Get all panel definitions for the module (considering sub_type)
    # PanelDefinitions.module_sequence_number corresponds to ModuleProductionPlan.module_number
    panel_defs_query = """
        SELECT pd.panel_definition_id, pd.panel_code, pd.panel_group
        FROM PanelDefinitions pd
        WHERE pd.house_type_id = ? AND pd.module_sequence_number = ?
    """
    params = [house_type_id, module_number]

    if module_sub_type_id is not None:
        # Fetch panels specific to this sub_type OR common panels (sub_type_id IS NULL in PanelDefinitions)
        panel_defs_query += " AND (pd.sub_type_id = ? OR pd.sub_type_id IS NULL)"
        params.append(module_sub_type_id)
    else:
        # Fetch only common panels if the module itself has no sub_type
        panel_defs_query += " AND pd.sub_type_id IS NULL"
    
    panel_defs_query += " ORDER BY pd.panel_group, pd.panel_code"

    defined_panels_cursor = db.execute(panel_defs_query, tuple(params))
    defined_panels = [dict(row) for row in defined_panels_cursor.fetchall()]

    for panel_def in defined_panels:
        panel_definition_id = panel_def['panel_definition_id']
        
        # 2. Get status from PanelProductionPlan
        ppp_cursor = db.execute(
            "SELECT status, panel_production_plan_id FROM PanelProductionPlan WHERE plan_id = ? AND panel_definition_id = ?",
            (plan_id, panel_definition_id)
        )
        ppp_entry = ppp_cursor.fetchone()

        status = 'Not Started' # Default if not in PanelProductionPlan
        panel_production_plan_id = None
        if ppp_entry:
            status = ppp_entry['status']
            panel_production_plan_id = ppp_entry['panel_production_plan_id']

        panels_with_status.append({
            'panel_definition_id': panel_definition_id,
            'panel_id': panel_production_plan_id, # Frontend might use this as 'panel_id'
            'panel_code': panel_def['panel_code'],
            'panel_group': panel_def['panel_group'],
            'status': status,
            # 'sequence': panel_def.get('sequence_in_module') # Include if PanelDefinitions has such a column
        })
        
    return panels_with_status

# === Station Status and Upcoming Modules ===

def get_station_status_and_upcoming_modules():
    """
    Fetches the specific content for each station (modules with active panels/tasks)
    and all upcoming planned/scheduled items from ModuleProductionPlan.
    """
    db = get_db()

    # 1. Fetch all stations
    stations_cursor = db.execute("SELECT station_id, name as station_name, line_type, sequence_order FROM Stations ORDER BY sequence_order, line_type")
    all_stations_info = [dict(row) for row in stations_cursor.fetchall()]

    station_status_list = []

    for station_info in all_stations_info:
        station_id = station_info['station_id']
        line_type = station_info['line_type']
        
        station_data = {
            'station_id': station_id,
            'station_name': station_info['station_name'],
            'line_type': line_type,
            'sequence_order': station_info['sequence_order'],
            'content': {
                'modules_with_active_panels': [], # For W stations
                'modules_in_magazine': [],        # For M1 station (modules physically in magazine)
                'modules_with_active_tasks': [],   # For A, B, C stations (modules already in assembly)
                'magazine_modules_for_assembly': [] # For Assembly Station 1 to pull from logical 'Magazine' status
            }
        }

        if line_type == 'W':
            # Find modules that have panels currently active at this W station
            w_station_panels_cursor = db.execute("""
                SELECT
                    mpp.plan_id, mpp.project_name, mpp.house_identifier, mpp.module_number,
                    mpp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
                    mpp.sub_type_id, hst.name as sub_type_name, mpp.status as module_status,
                    pd.panel_definition_id, pd.panel_code, pd.panel_group,
                    ppp.panel_production_plan_id, ppp.status as panel_status
                FROM PanelProductionPlan ppp
                JOIN ModuleProductionPlan mpp ON ppp.plan_id = mpp.plan_id
                JOIN PanelDefinitions pd ON ppp.panel_definition_id = pd.panel_definition_id
                JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
                LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
                WHERE ppp.current_station = ? AND ppp.status = 'In Progress'
                ORDER BY mpp.planned_sequence, pd.panel_code
            """, (station_id,))
            
            modules_at_w_station = {}
            for row_data in w_station_panels_cursor.fetchall():
                row = dict(row_data)
                if row['plan_id'] not in modules_at_w_station:
                    modules_at_w_station[row['plan_id']] = {
                        'plan_id': row['plan_id'],
                        'project_name': row['project_name'],
                        'house_identifier': row['house_identifier'],
                        'module_number': row['module_number'],
                        'module_sequence_in_house': row['module_number'], # Assuming module_number is the sequence in house
                        'status': row['module_status'], # This is the ModuleProductionPlan status
                        'house_type_name': row['house_type_name'],
                        'house_type_id': row['house_type_id'],
                        'number_of_modules': row['number_of_modules'],
                        'sub_type_name': row.get('sub_type_name'),
                        'sub_type_id': row.get('sub_type_id'),
                        'active_panels_at_station': []
                    }
                modules_at_w_station[row['plan_id']]['active_panels_at_station'].append({
                    'panel_production_plan_id': row['panel_production_plan_id'],
                    'panel_definition_id': row['panel_definition_id'],
                    'panel_code': row['panel_code'],
                    'panel_group': row['panel_group'],
                    'status': row['panel_status'] # This is the PanelProductionPlan status
                })
            station_data['content']['modules_with_active_panels'] = list(modules_at_w_station.values())

        elif station_id == 'M1': # Magazine station
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
            for mod_row_data in magazine_modules_cursor.fetchall():
                mod_row = dict(mod_row_data)
                panels = _get_panels_with_status_for_plan(
                    db, mod_row['plan_id'], mod_row['house_type_id'],
                    mod_row['module_number'], mod_row['sub_type_id']
                )
                station_data['content']['modules_in_magazine'].append({
                    'plan_id': mod_row['plan_id'],
                    'project_name': mod_row['project_name'],
                    'house_identifier': mod_row['house_identifier'],
                    'module_number': mod_row['module_number'],
                    'module_sequence_in_house': mod_row['module_number'],
                    'status': mod_row['status'],
                    'house_type_name': mod_row['house_type_name'],
                    'house_type_id': mod_row['house_type_id'],
                    'number_of_modules': mod_row['number_of_modules'],
                    'sub_type_name': mod_row.get('sub_type_name'),
                    'sub_type_id': mod_row.get('sub_type_id'),
                    'panels': panels # All panels for this module
                })

        elif line_type in ['A', 'B', 'C']: # Assembly lines
            assembly_tasks_cursor = db.execute("""
                SELECT
                    mpp.plan_id, mpp.project_name, mpp.house_identifier, mpp.module_number,
                    mpp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
                    mpp.sub_type_id, hst.name as sub_type_name, mpp.status as module_status,
                    td.task_definition_id, td.name as task_name, td.description as task_description,
                    tl.task_log_id, tl.status as task_status, tl.started_at
                FROM TaskLogs tl
                JOIN ModuleProductionPlan mpp ON tl.plan_id = mpp.plan_id
                JOIN TaskDefinitions td ON tl.task_definition_id = td.task_definition_id
                JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
                LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
                WHERE tl.station_start = ? AND tl.status = 'In Progress' AND td.is_panel_task = 0
                ORDER BY mpp.planned_sequence, td.name
            """, (station_id,))

            modules_at_assembly_station = {}
            for row_data in assembly_tasks_cursor.fetchall():
                row = dict(row_data)
                if row['plan_id'] not in modules_at_assembly_station:
                    modules_at_assembly_station[row['plan_id']] = {
                        'plan_id': row['plan_id'],
                        'project_name': row['project_name'],
                        'house_identifier': row['house_identifier'],
                        'module_number': row['module_number'],
                        'module_sequence_in_house': row['module_number'],
                        'status': row['module_status'],
                        'house_type_name': row['house_type_name'],
                        'house_type_id': row['house_type_id'],
                        'number_of_modules': row['number_of_modules'],
                        'sub_type_name': row.get('sub_type_name'),
                        'sub_type_id': row.get('sub_type_id'),
                        'active_module_tasks_at_station': []
                    }
                modules_at_assembly_station[row['plan_id']]['active_module_tasks_at_station'].append({
                    'task_log_id': row['task_log_id'],
                    'task_definition_id': row['task_definition_id'],
                    'task_name': row['task_name'],
                    'task_description': row['task_description'],
                    'status': row['task_status'],
                    'started_at': row['started_at']
                })
            station_data['content']['modules_with_active_tasks'] = list(modules_at_assembly_station.values())

            # If this is Assembly Station 1 (sequence_order 7), also fetch 'Magazine' status modules
            if station_info['sequence_order'] == 7:
                magazine_for_assembly_cursor = db.execute("""
                    SELECT
                        mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
                        mpp.house_identifier, mpp.module_number, ht.number_of_modules,
                        mpp.status, mpp.sub_type_id, hst.name as sub_type_name,
                        mpp.planned_assembly_line
                    FROM ModuleProductionPlan mpp
                    JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
                    LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
                    WHERE mpp.status = 'Magazine'
                    ORDER BY mpp.planned_sequence ASC
                """)
                magazine_modules_list = []
                for mag_mod_row_data in magazine_for_assembly_cursor.fetchall():
                    mag_mod_row = dict(mag_mod_row_data)
                    
                    # Fetch eligible tasks for this magazine module at this station (seq 7, non-panel)
                    eligible_tasks_cursor = db.execute("""
                        SELECT td.task_definition_id, td.name, td.description, td.specialty_id
                        FROM TaskDefinitions td
                        WHERE (td.house_type_id = ? OR td.house_type_id IS NULL)
                          AND td.is_panel_task = 0
                          AND td.station_sequence_order = 7 
                          AND NOT EXISTS (
                              SELECT 1 FROM TaskLogs tl
                              WHERE tl.plan_id = ? AND tl.task_definition_id = td.task_definition_id
                                AND tl.status = 'Completed'
                          )
                        ORDER BY td.name
                    """, (mag_mod_row['house_type_id'], mag_mod_row['plan_id']))
                    
                    eligible_tasks = [dict(task_row) for task_row in eligible_tasks_cursor.fetchall()]
                    
                    # Only include module if it has eligible tasks for this station
                    if eligible_tasks:
                        magazine_modules_list.append({
                            'plan_id': mag_mod_row['plan_id'],
                            'project_name': mag_mod_row['project_name'],
                            'house_identifier': mag_mod_row['house_identifier'],
                            'module_number': mag_mod_row['module_number'],
                            'status': mag_mod_row['status'],
                            'house_type_name': mag_mod_row['house_type_name'],
                            'house_type_id': mag_mod_row['house_type_id'],
                            'number_of_modules': mag_mod_row['number_of_modules'],
                            'sub_type_name': mag_mod_row.get('sub_type_name'),
                            'sub_type_id': mag_mod_row.get('sub_type_id'),
                            'planned_assembly_line': mag_mod_row.get('planned_assembly_line'),
                            'eligible_tasks': eligible_tasks
                        })
                station_data['content']['magazine_modules_for_assembly'] = magazine_modules_list
        
        station_status_list.append(station_data)

    # 3. Fetch upcoming items (remains the same)
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
        'station_status': station_status_list,
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
            mpp.module_number,
            mpp.house_type_id -- Add house_type_id here
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
            'house_type_id': row['house_type_id'], # Include house_type_id
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
                    # Update ModuleProductionPlan status to 'Magazine' when all panels for module are done
                    db.execute(
                        "UPDATE ModuleProductionPlan SET status = 'Magazine', updated_at = ? WHERE plan_id = ?",
                        (now_utc_str, current_plan_id)
                    )
                    logging.info(f"ModuleProductionPlan {current_plan_id} status updated to 'Magazine' after completing all panels.")

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


# === Module Task Management ===

def start_module_task(plan_id: int, task_definition_id: int, worker_id: int, station_id: str):
    """
    Starts a module task (non-panel task).
    If the module is in 'Magazine' status and the task is started at an Assembly Station 1 (seq 7),
    it updates the module's status to 'Assembly' and sets its current_station.
    """
    db = get_db()
    now_utc_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    try:
        # Check current module status and station details
        module_cursor = db.execute(
            "SELECT status, planned_assembly_line FROM ModuleProductionPlan WHERE plan_id = ?", (plan_id,)
        )
        module_data = module_cursor.fetchone()
        if not module_data:
            return {"error": f"Module with plan_id {plan_id} not found."}
        
        module_status = module_data['status']
        # planned_line = module_data['planned_assembly_line'] # Not directly used for setting current_station, station_id is king

        station_cursor = db.execute(
            "SELECT sequence_order, line_type FROM Stations WHERE station_id = ?", (station_id,)
        )
        station_data = station_cursor.fetchone()
        if not station_data:
            return {"error": f"Station with station_id {station_id} not found."}
        station_sequence_order = station_data['sequence_order']
        # station_line_type = station_data['line_type']

        # Logic for 'Magazine' modules at Assembly Station 1 (sequence_order 7)
        if module_status == 'Magazine' and station_sequence_order == 7:
            db.execute(
                """UPDATE ModuleProductionPlan
                   SET status = 'Assembly', current_station = ?, updated_at = ?
                   WHERE plan_id = ?""",
                (station_id, now_utc_str, plan_id)
            )
            logging.info(f"Module {plan_id} status updated to 'Assembly', current_station set to {station_id}.")

        # Check for existing TaskLog for this specific task on this module
        # This simplified check assumes one active log per task_definition_id for a plan_id.
        # More complex scenarios (re-doing tasks) might need different handling.
        existing_log_cursor = db.execute(
            """SELECT task_log_id, status FROM TaskLogs
               WHERE plan_id = ? AND task_definition_id = ? AND is_panel_task = 0""", # Ensure it's a module task log
            (plan_id, task_definition_id)
        )
        existing_log_row = existing_log_cursor.fetchone()

        task_log_data = None
        log_id = None # Initialize log_id

        if existing_log_row:
            log_id = existing_log_row['task_log_id']
            current_task_status = existing_log_row['status']
            if current_task_status == 'Paused':
                # Resume logic (simplified: update status and worker)
                # Proper resume should update TaskPauses table if used for module tasks
                db.execute(
                    """UPDATE TaskLogs SET status = 'In Progress', worker_id = ?, started_at = COALESCE(started_at, ?)
                       WHERE task_log_id = ?""",
                    (worker_id, now_utc_str, log_id)
                )
                logging.info(f"Resuming module task for log_id {log_id} by worker {worker_id} at station {station_id}.")
            elif current_task_status in ['In Progress', 'Completed']:
                 return {"error": f"Module task is already {current_task_status}."}
            else: # 'Not Started' or other, treat as fresh start for this log entry
                db.execute(
                    """UPDATE TaskLogs 
                       SET status = 'In Progress', worker_id = ?, started_at = ?, station_start = ?
                       WHERE task_log_id = ?""",
                    (worker_id, now_utc_str, station_id, log_id)
                )
        else:
            # Create new TaskLog entry
            cursor = db.execute(
                """INSERT INTO TaskLogs (plan_id, task_definition_id, worker_id, status, started_at, station_start, is_panel_task)
                   VALUES (?, ?, ?, 'In Progress', ?, ?, 0)""",
                (plan_id, task_definition_id, worker_id, now_utc_str, station_id)
            )
            log_id = cursor.lastrowid
            logging.info(f"Creating new TaskLog for module task: plan_id {plan_id}, task_def_id {task_definition_id} by worker {worker_id} at station {station_id}.")

        db.commit()
        
        if log_id is None: # Should not happen if logic above is correct
            return {"error": "Failed to create or identify task log."}

        # Fetch the created/updated task log data to return
        final_log_cursor = db.execute("SELECT * FROM TaskLogs WHERE task_log_id = ?", (log_id,))
        task_log_data = dict(final_log_cursor.fetchone())

        logging.info(f"start_module_task successful for plan_id {plan_id}, task_def_id {task_definition_id}. Log data: {task_log_data}")
        return {"success": True, "task_log": task_log_data}

    except sqlite3.Error as e:
        db.rollback()
        logging.error(f"Database error in start_module_task: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error in start_module_task: {e}", exc_info=True)
        return {"error": f"Unexpected error: {e}"}


# === Module Task Management ===

def start_module_task(plan_id: int, task_definition_id: int, worker_id: int, station_id: str):
    """
    Starts a module task (non-panel task).
    If the module is in 'Magazine' status and the task is started at an Assembly Station 1 (seq 7),
    it updates the module's status to 'Assembly' and sets its current_station.
    """
    db = get_db()
    now_utc_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    try:
        # Check current module status and station details
        module_cursor = db.execute(
            "SELECT status, planned_assembly_line FROM ModuleProductionPlan WHERE plan_id = ?", (plan_id,)
        )
        module_data = module_cursor.fetchone()
        if not module_data:
            return {"error": f"Module with plan_id {plan_id} not found."}
        
        module_status = module_data['status']
        # planned_line = module_data['planned_assembly_line'] # Not directly used for setting current_station, station_id is king

        station_cursor = db.execute(
            "SELECT sequence_order, line_type FROM Stations WHERE station_id = ?", (station_id,)
        )
        station_data = station_cursor.fetchone()
        if not station_data:
            return {"error": f"Station with station_id {station_id} not found."}
        station_sequence_order = station_data['sequence_order']
        # station_line_type = station_data['line_type']

        # Logic for 'Magazine' modules at Assembly Station 1 (sequence_order 7)
        if module_status == 'Magazine' and station_sequence_order == 7:
            db.execute(
                """UPDATE ModuleProductionPlan
                   SET status = 'Assembly', current_station = ?, updated_at = ?
                   WHERE plan_id = ?""",
                (station_id, now_utc_str, plan_id)
            )
            logging.info(f"Module {plan_id} status updated to 'Assembly', current_station set to {station_id}.")

        # Check for existing TaskLog for this specific task on this module
        # This simplified check assumes one active log per task_definition_id for a plan_id.
        # More complex scenarios (re-doing tasks) might need different handling.
        existing_log_cursor = db.execute(
            """SELECT task_log_id, status FROM TaskLogs
               WHERE plan_id = ? AND task_definition_id = ?""",
            (plan_id, task_definition_id)
        )
        existing_log_row = existing_log_cursor.fetchone()

        task_log_data = None
        log_id = None # Initialize log_id

        if existing_log_row:
            log_id = existing_log_row['task_log_id']
            current_task_status = existing_log_row['status']
            if current_task_status == 'Paused':
                # Resume logic (simplified: update status and worker)
                # Proper resume should update TaskPauses table if used for module tasks
                db.execute(
                    """UPDATE TaskLogs SET status = 'In Progress', worker_id = ?, started_at = COALESCE(started_at, ?)
                       WHERE task_log_id = ?""",
                    (worker_id, now_utc_str, log_id)
                )
                logging.info(f"Resuming module task for log_id {log_id} by worker {worker_id} at station {station_id}.")
            elif current_task_status in ['In Progress', 'Completed']:
                 return {"error": f"Module task is already {current_task_status}."}
            else: # 'Not Started' or other, treat as fresh start for this log entry
                db.execute(
                    """UPDATE TaskLogs 
                       SET status = 'In Progress', worker_id = ?, started_at = ?, station_start = ?
                       WHERE task_log_id = ?""",
                    (worker_id, now_utc_str, station_id, log_id)
                )
        else:
            # Create new TaskLog entry
            cursor = db.execute(
                """INSERT INTO TaskLogs (plan_id, task_definition_id, worker_id, status, started_at, station_start)
                   VALUES (?, ?, ?, 'In Progress', ?, ?)""",
                (plan_id, task_definition_id, worker_id, now_utc_str, station_id)
            )
            log_id = cursor.lastrowid
            logging.info(f"Creating new TaskLog for module task: plan_id {plan_id}, task_def_id {task_definition_id} by worker {worker_id} at station {station_id}.")

        db.commit()
        
        if log_id is None: # Should not happen if logic above is correct
            return {"error": "Failed to create or identify task log."}

        # Fetch the created/updated task log data to return
        final_log_cursor = db.execute("SELECT * FROM TaskLogs WHERE task_log_id = ?", (log_id,))
        task_log_data = dict(final_log_cursor.fetchone())

        logging.info(f"start_module_task successful for plan_id {plan_id}, task_def_id {task_definition_id}. Log data: {task_log_data}")
        return {"success": True, "task_log": task_log_data}

    except sqlite3.Error as e:
        db.rollback()
        logging.error(f"Database error in start_module_task: {e}", exc_info=True)
        return {"error": f"Database error: {e}"}
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error in start_module_task: {e}", exc_info=True)
        return {"error": f"Unexpected error: {e}"}


