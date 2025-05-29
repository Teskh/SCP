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




