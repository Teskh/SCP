import sqlite3
from datetime import datetime, timedelta
import logging
from .connection import get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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

    return {
        'station_status': station_status,
        'upcoming_items': upcoming_items
    }
