import sqlite3
from datetime import datetime, timedelta
import logging # Import logging module
from .connection import get_db

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


# === Production Plan Generation Helpers ===

def get_max_planned_sequence():
    """Gets the maximum planned_sequence value from the ModuleProductionPlan table."""
    db = get_db()
    cursor = db.execute("SELECT MAX(planned_sequence) FROM ModuleProductionPlan")
    max_seq = cursor.fetchone()[0]
    return max_seq if max_seq is not None else 0

def _get_next_house_number_for_project(project_name):
    """
    Determines the next available house number for a given project.
    House identifiers are expected to be in the format 'ProjectName-Number'.
    """
    db = get_db()
    cursor = db.execute(
        "SELECT house_identifier FROM ModuleProductionPlan WHERE project_name = ?",
        (project_name,)
    )
    existing_identifiers = cursor.fetchall()
    
    max_house_num = 0
    if existing_identifiers:
        for row in existing_identifiers:
            identifier = row['house_identifier']
            try:
                # Assuming house_identifier is now just a number string (e.g., "1", "2")
                num_part = int(identifier)
                if num_part > max_house_num:
                    max_house_num = num_part
            except ValueError:
                # Handle cases where house_identifier might not be a simple integer string
                # This could happen with legacy data or if the format assumption is broken.
                logging.warning(f"Could not parse house number from identifier: '{identifier}' for project '{project_name}'. Expected a simple number.")
                # Attempt to parse legacy format ProjectName-Num as a fallback
                try:
                    legacy_num_part = int(identifier.split('-')[-1])
                    if legacy_num_part > max_house_num:
                        max_house_num = legacy_num_part
                    logging.info(f"Successfully parsed legacy identifier '{identifier}' to {legacy_num_part} for project '{project_name}'.")
                except (ValueError, IndexError):
                    logging.warning(f"Failed to parse identifier '{identifier}' as legacy format for project '{project_name}'.")
                    pass # Or raise an error if strict format is required
    return max_house_num + 1

def generate_module_production_plan(project_name, house_type_id, number_of_houses):
    """
    Generates ModuleProductionPlan items in batch for a given project and house type.
    Also creates corresponding PanelsProductionPlan items for each panel definition.
    Infers modules_per_house from HouseTypes.
    House identifiers are auto-incremented based on existing houses for the project.
    planned_start_datetime auto-increments by 1 hour per module.
    Status defaults to 'Planned'. Sequence is appended.
    """
    db = get_db()
    items_to_add = []
    
    # Fetch house type details to get number_of_modules
    ht_cursor = db.execute("SELECT number_of_modules FROM HouseTypes WHERE house_type_id = ?", (house_type_id,))
    ht_data = ht_cursor.fetchone()
    if not ht_data:
        logging.error(f"HouseType ID {house_type_id} not found for plan generation.")
        raise ValueError(f"HouseType ID {house_type_id} not found.")
    actual_modules_per_house = ht_data['number_of_modules']
    if actual_modules_per_house <= 0:
        logging.error(f"HouseType ID {house_type_id} has invalid number_of_modules: {actual_modules_per_house}.")
        raise ValueError(f"HouseType ID {house_type_id} has 0 or negative modules.")

    current_max_sequence = get_max_planned_sequence()
    current_sequence = current_max_sequence + 1
    
    # Base time for planning starts now, increments by 1 hour for each module added in this batch
    current_planned_datetime = datetime.now()
    start_house_number_for_project = _get_next_house_number_for_project(project_name)

    assembly_lines = ['A', 'B', 'C'] 
    line_index = (current_max_sequence % len(assembly_lines)) # Try to continue line cycle from last item

    for i in range(number_of_houses): # For each house instance
        current_house_num_in_project = start_house_number_for_project + i
        house_identifier = str(current_house_num_in_project) # Identifier is now just the number as a string

        for module_num in range(1, actual_modules_per_house + 1): # For each module within the house
            planned_assembly_line = assembly_lines[line_index % len(assembly_lines)]
            planned_start_datetime_str = current_planned_datetime.strftime('%Y-%m-%d %H:%M:%S')

            items_to_add.append((
                project_name,
                house_type_id,
                house_identifier, 
                module_num,       
                current_sequence,
                planned_start_datetime_str,
                planned_assembly_line,
                None, # sub_type_id - Set to NULL initially
                'Planned' # Default status
            ))
            current_sequence += 1
            line_index += 1 
            current_planned_datetime += timedelta(hours=1) # Increment time for the next module

    if items_to_add:
        try:
            with db: # Use transaction to ensure both module and panel plans are created together
                # Add module production plan items
                plan_ids = add_bulk_module_production_plan_items_with_ids(items_to_add)
                
                # Create panel production plan items for each module
                panel_items_to_add = []
                for i, (project_name, house_type_id, house_identifier, module_num, sequence, start_dt, line, sub_type_id, status) in enumerate(items_to_add):
                    plan_id = plan_ids[i]
                    
                    # Get panel definitions for this module (considering sub_type_id if set)
                    panel_definitions = get_panel_definitions_for_house_type_module(house_type_id, module_num, sub_type_id)
                    
                    for panel_def in panel_definitions:
                        panel_items_to_add.append((
                            plan_id,
                            panel_def['panel_definition_id'],
                            'planned', # Default status
                            None # current_station - NULL for planned status
                        ))
                
                # Add panel production plan items
                if panel_items_to_add:
                    add_bulk_panels_production_plan_items(panel_items_to_add)
                    logging.info(f"Successfully generated {len(panel_items_to_add)} panel plan items for project '{project_name}'.")
                
            logging.info(f"Successfully generated {len(items_to_add)} module plan items for project '{project_name}'.")
            return True
        except Exception as e:
            logging.error(f"Error generating bulk plan items for project '{project_name}': {e}", exc_info=True)
            # Re-raise to be caught by the API layer for proper HTTP response
            raise e
    return True # No items to add (e.g., number_of_houses = 0), still considered success

def remove_planned_items_for_project_name(project_name):
    """Removes 'Planned' or 'Scheduled' ModuleProductionPlan items for a given project_name."""
    db = get_db()
    try:
        # Only remove items that haven't started progress (e.g., not 'Assembly', 'Completed')
        cursor = db.execute(
            "DELETE FROM ModuleProductionPlan WHERE project_name = ? AND status IN ('Planned', 'Panels', 'Magazine')", # Adjusted statuses
            (project_name,)
        )
        db.commit()
        logging.info(f"Removed {cursor.rowcount} planned/scheduled items for project '{project_name}'.")
        return True
    except sqlite3.Error as e:
        logging.error(f"Error removing planned items for project '{project_name}': {e}", exc_info=True)
        return False

# === Module Production Plan (Direct Operations) ===

def add_module_production_plan_item(project_name, house_type_id, house_identifier, module_number, planned_sequence, planned_start_datetime, planned_assembly_line, sub_type_id=None, status='Planned'):
    """Adds a single item to the ModuleProductionPlan."""
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO ModuleProductionPlan
               (project_name, house_type_id, house_identifier, module_number, planned_sequence, planned_start_datetime, planned_assembly_line, sub_type_id, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_name, house_type_id, house_identifier, module_number, planned_sequence, planned_start_datetime, planned_assembly_line, sub_type_id, status)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding module production plan item (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding module production plan item: {e}", exc_info=True)
        return None

def add_bulk_module_production_plan_items(items_data):
    """Adds multiple items to the ModuleProductionPlan using executemany."""
    db = get_db()
    # items_data should be a list of tuples/lists matching the order of columns in the INSERT statement
    # e.g., [(project_name, ht_id, house_id, mod_num, planned_seq, start_dt, line, sub_type_id, status), ...]
    sql = """INSERT INTO ModuleProductionPlan
             (project_name, house_type_id, house_identifier, module_number, planned_sequence, planned_start_datetime, planned_assembly_line, sub_type_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    try:
        with db: # Use transaction
            db.executemany(sql, items_data)
        return True
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding bulk module production plan items (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding bulk module production plan items: {e}", exc_info=True)
        return False

def add_bulk_module_production_plan_items_with_ids(items_data):
    """
    Adds multiple items to the ModuleProductionPlan using executemany and returns the generated plan_ids.
    Returns a list of plan_ids in the same order as the input items_data.
    """
    db = get_db()
    sql = """INSERT INTO ModuleProductionPlan
             (project_name, house_type_id, house_identifier, module_number, planned_sequence, planned_start_datetime, planned_assembly_line, sub_type_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    try:
        plan_ids = []
        cursor = db.cursor()
        for item_data in items_data:
            cursor.execute(sql, item_data)
            plan_ids.append(cursor.lastrowid)
        return plan_ids
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding bulk module production plan items with IDs (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding bulk module production plan items with IDs: {e}", exc_info=True)
        raise e

def add_bulk_panels_production_plan_items(panel_items_data):
    """
    Adds multiple items to the PanelsProductionPlan using executemany.
    panel_items_data should be a list of tuples: [(plan_id, panel_definition_id, status, current_station), ...]
    """
    db = get_db()
    sql = """INSERT INTO PanelsProductionPlan
             (plan_id, panel_definition_id, status, current_station)
             VALUES (?, ?, ?, ?)"""
    try:
        db.executemany(sql, panel_items_data)
        return True
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding bulk panels production plan items (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding bulk panels production plan items: {e}", exc_info=True)
        raise e

def get_module_production_plan(filters=None, sort_by='planned_sequence', sort_order='ASC', limit=None, offset=None):
    """
    Fetches module production plan items, excluding 'Completed' status,
    with optional filtering, sorting, and pagination.
    Default sort is by planned_sequence ASC.
    """
    db = get_db()
    base_query = """
        SELECT
            mpp.plan_id, mpp.project_name,
            mpp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            mpp.house_identifier, mpp.module_number,
            mpp.planned_sequence, mpp.planned_start_datetime,
            mpp.planned_assembly_line, mpp.status, mpp.created_at, mpp.updated_at,
            mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
    """
    where_clauses = ["mpp.status != 'Completed'"] # Default filter
    params = []

    if filters:
        if filters.get('project_name'):
            where_clauses.append("mpp.project_name LIKE ?")
            params.append(f"%{filters['project_name']}%")
        if filters.get('house_type_id'):
            where_clauses.append("mpp.house_type_id = ?")
            params.append(filters['house_type_id'])
        # Status filter might still be useful for other non-completed statuses
        if filters.get('status') and filters['status'].lower() != 'completed':
            statuses = filters['status'].split(',')
            # Ensure 'Completed' is not part of the filter if explicitly passed
            statuses = [s for s in statuses if s.lower() != 'completed']
            if statuses:
                placeholders = ','.join('?' * len(statuses))
                where_clauses.append(f"mpp.status IN ({placeholders})")
                params.extend(statuses)
        if filters.get('start_date_after'):
            where_clauses.append("mpp.planned_start_datetime >= ?")
            params.append(filters['start_date_after'])
        if filters.get('sub_type_id'):
            where_clauses.append("mpp.sub_type_id = ?")
            params.append(filters['sub_type_id'])

    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)

    # Default sort is planned_sequence ASC, other sorts are secondary or override
    allowed_sort_columns = ['plan_id', 'project_name', 'house_type_name', 'house_identifier', 'module_number', 'planned_sequence', 'planned_start_datetime', 'planned_assembly_line', 'status', 'created_at', 'updated_at', 'sub_type_name']
    
    final_sort_by = 'mpp.planned_sequence' # Primary sort
    final_sort_order = 'ASC'

    if sort_by in allowed_sort_columns and sort_by != 'planned_sequence':
        # If a different primary sort is requested, apply it, then sequence as secondary
        final_sort_by = f"{sort_by} {sort_order.upper() if sort_order.upper() in ['ASC', 'DESC'] else 'ASC'}, mpp.planned_sequence ASC"
    elif sort_by == 'planned_sequence' and sort_order.upper() == 'DESC':
        final_sort_order = 'DESC'
        final_sort_by = f"mpp.planned_sequence {final_sort_order}"
    # else it's default planned_sequence ASC

    base_query += f" ORDER BY {final_sort_by}"

    if limit is not None:
        base_query += " LIMIT ?"
        params.append(limit)
        if offset is not None:
            base_query += " OFFSET ?"
            params.append(offset)

    cursor = db.execute(base_query, params)
    return [dict(row) for row in cursor.fetchall()]

def get_module_production_plan_item_by_id(plan_id):
    """Fetches a single module production plan item by its ID."""
    db = get_db()
    query = """
        SELECT
            mpp.plan_id, mpp.project_name,
            mpp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            mpp.house_identifier, mpp.module_number,
            mpp.planned_sequence, mpp.planned_start_datetime,
            mpp.planned_assembly_line, mpp.status, mpp.created_at, mpp.updated_at,
            mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.plan_id = ?
    """
    cursor = db.execute(query, (plan_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def update_module_production_plan_item(plan_id, updates):
    """Updates specific fields of a module production plan item."""
    db = get_db()
    allowed_fields = ['project_name', 'house_type_id', 'house_identifier', 'module_number', 'planned_sequence', 'planned_start_datetime', 'planned_assembly_line', 'status', 'sub_type_id']
    set_clauses = []
    params = []

    for field, value in updates.items():
        if field in allowed_fields:
            set_clauses.append(f"{field} = ?")
            params.append(value)

    if not set_clauses:
        return False

    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    sql = f"UPDATE ModuleProductionPlan SET {', '.join(set_clauses)} WHERE plan_id = ?"
    params.append(plan_id)

    try:
        cursor = db.execute(sql, params)
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating module production plan item (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error updating module production plan item: {e}", exc_info=True)
        return False

def delete_module_production_plan_item(plan_id):
    """Deletes a module production plan item."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM ModuleProductionPlan WHERE plan_id = ?", (plan_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting module production plan item: {e}", exc_info=True)
        return False

def update_module_production_plan_sequence(ordered_plan_ids):
    """
    Updates the planned_sequence for a list of module production plan items
    based on the exact order provided in the list.
    """
    db = get_db()
    if not ordered_plan_ids:
        logging.info("No plan IDs provided for reordering ModuleProductionPlan.")
        return True

    try:
        with db: # Use transaction
            for i, plan_id in enumerate(ordered_plan_ids):
                new_sequence = i + 1
                cursor = db.execute(
                    "UPDATE ModuleProductionPlan SET planned_sequence = ? WHERE plan_id = ?",
                    (new_sequence, plan_id)
                )
                if cursor.rowcount == 0:
                    logging.warning(f"plan_id {plan_id} not found during ModuleProductionPlan sequence update.")
        logging.info(f"Successfully reordered {len(ordered_plan_ids)} ModuleProductionPlan items.")
        return True
    except sqlite3.Error as e:
        logging.error(f"Error updating ModuleProductionPlan sequence: {e}", exc_info=True)
        return False

# === Specialties ===

def get_all_specialties():
    """Fetches all specialties from the database."""
    db = get_db()
    cursor = db.execute("SELECT specialty_id, name, description FROM Specialties ORDER BY name")
    specialties = cursor.fetchall()
    return [dict(row) for row in specialties]

def get_specialty_by_name(name):
    """Fetches a specialty by its name."""
    db = get_db()
    cursor = db.execute(
        "SELECT specialty_id, name, description FROM Specialties WHERE name = ?",
        (name,)
    )
    row = cursor.fetchone()
    return dict(row) if row else None

def add_specialty(name, description):
    """Adds a new specialty to the database."""
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO Specialties (name, description) VALUES (?, ?)",
            (name, description)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.warning(f"Specialty '{name}' already exists or other integrity error: {e}")
        return None

def update_specialty(specialty_id, name, description):
    """Updates an existing specialty."""
    db = get_db()
    try:
        cursor = db.execute(
            "UPDATE Specialties SET name = ?, description = ? WHERE specialty_id = ?",
            (name, description, specialty_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating specialty {specialty_id}: {e}", exc_info=True)
        return False

def delete_specialty(specialty_id):
    """Deletes a specialty."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM Specialties WHERE specialty_id = ?", (specialty_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting specialty {specialty_id}: {e}", exc_info=True)
        # Consider if this task is linked to TaskDefinitions and how to handle it (e.g., set specialty_id to NULL)
        return False

# === Task Definitions ===

def get_all_task_definitions():
    """Fetches all task definitions from the database, including related names."""
    db = get_db()
    query = """
        SELECT
            td.task_definition_id, td.name, td.description,
            ht.name as house_type_name,
            sp.name as specialty_name,
            td.house_type_id, td.specialty_id, td.station_sequence_order,
            td.task_dependencies, td.is_panel_task -- Added is_panel_task
        FROM TaskDefinitions td
        LEFT JOIN HouseTypes ht ON td.house_type_id = ht.house_type_id
        LEFT JOIN Specialties sp ON td.specialty_id = sp.specialty_id
        ORDER BY td.name
    """
    cursor = db.execute(query)
    task_defs = cursor.fetchall()
    return [dict(row) for row in task_defs]

def get_task_definition_by_id(task_definition_id):
    """Fetches a single task definition by its ID, including related names."""
    db = get_db()
    query = """
        SELECT
            td.task_definition_id, td.name, td.description,
            ht.name as house_type_name,
            sp.name as specialty_name,
            td.house_type_id, td.specialty_id, td.station_sequence_order,
            td.task_dependencies, td.is_panel_task -- Added is_panel_task
        FROM TaskDefinitions td
        LEFT JOIN HouseTypes ht ON td.house_type_id = ht.house_type_id
        LEFT JOIN Specialties sp ON td.specialty_id = sp.specialty_id
        WHERE td.task_definition_id = ?
    """
    cursor = db.execute(query, (task_definition_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def add_task_definition(name, description, house_type_id, specialty_id, station_sequence_order, task_dependencies, is_panel_task):
    """Adds a new task definition."""
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO TaskDefinitions
               (name, description, house_type_id, specialty_id, station_sequence_order, task_dependencies, is_panel_task)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, description, house_type_id, specialty_id, station_sequence_order, task_dependencies, is_panel_task)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.warning(f"Task Definition '{name}' already exists or other integrity error: {e}")
        return None # Or raise

def update_task_definition(task_definition_id, name, description, house_type_id, specialty_id, station_sequence_order, task_dependencies, is_panel_task):
    """Updates an existing task definition."""
    db = get_db()
    try:
        cursor = db.execute(
            """UPDATE TaskDefinitions SET
               name = ?, description = ?, house_type_id = ?, specialty_id = ?,
               station_sequence_order = ?, task_dependencies = ?, is_panel_task = ?
               WHERE task_definition_id = ?""",
            (name, description, house_type_id, specialty_id, station_sequence_order, task_dependencies, is_panel_task, task_definition_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating task definition {task_definition_id}: {e}", exc_info=True)
        return False

def get_potential_task_dependencies(current_station_sequence_order, is_panel_task_filter=None):
    """
    Fetches task definitions that could be prerequisites.
    Potential prerequisites must be from stations with a lower sequence order
    or no specific station. Optionally filters by is_panel_task.
    """
    db = get_db()
    base_query = """
        SELECT
            td.task_definition_id,
            td.name,
            td.station_sequence_order,
            td.task_dependencies,
            td.is_panel_task
        FROM TaskDefinitions td
    """
    conditions = []
    params = []

    if current_station_sequence_order is not None and current_station_sequence_order > 0:
        conditions.append("(td.station_sequence_order < ? OR td.station_sequence_order IS NULL)")
        params.append(current_station_sequence_order)
    else: # Only fetch tasks with NULL station_sequence_order if no specific station context
        conditions.append("td.station_sequence_order IS NULL")

    if is_panel_task_filter is not None: # Filter by is_panel_task if provided
        conditions.append("td.is_panel_task = ?")
        params.append(is_panel_task_filter)

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)

    base_query += " ORDER BY td.station_sequence_order, td.name;"
    cursor = db.execute(base_query, params)
    potential_deps = cursor.fetchall()
    return [dict(row) for row in potential_deps]


# === Panel Definitions (formerly HouseTypePanels) ===

def get_panel_definitions_for_house_type_module(house_type_id, module_sequence_number, sub_type_id=None):
    """
    Fetches all panel definitions for a specific module within a house type,
    optionally filtered by sub_type_id.
    If sub_type_id is None, fetches panels common to all sub_types (sub_type_id IS NULL).
    If sub_type_id is provided, fetches panels specific to that sub_type.
    """
    db = get_db()
    query = """
        SELECT
            pd.panel_definition_id, pd.panel_group, pd.panel_code,
            pd.sub_type_id, hst.name as sub_type_name,
            pd.multiwall_id, mw.multiwall_code
        FROM PanelDefinitions pd
        LEFT JOIN Multiwalls mw ON pd.multiwall_id = mw.multiwall_id
        LEFT JOIN HouseSubType hst ON pd.sub_type_id = hst.sub_type_id
        WHERE pd.house_type_id = ? AND pd.module_sequence_number = ?
    """
    params = [house_type_id, module_sequence_number]

    if sub_type_id is not None:
        query += " AND pd.sub_type_id = ?"
        params.append(sub_type_id)
    else:
        query += " AND pd.sub_type_id IS NULL"

    query += " ORDER BY pd.panel_group, mw.multiwall_code, pd.panel_code"
    cursor = db.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


def add_panel_definition_to_house_type_module(house_type_id, module_sequence_number, panel_group, panel_code, sub_type_id=None, multiwall_id=None):
    """Adds a new panel definition to a specific module within a house type."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group: {panel_group}")

    if multiwall_id:
        mw_cursor = db.execute("SELECT panel_group FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
        mw_row = mw_cursor.fetchone()
        if not mw_row or mw_row['panel_group'] != panel_group:
             raise ValueError("Panel group must match the assigned multiwall's group.")

    try:
        cursor = db.execute(
            """INSERT INTO PanelDefinitions
               (house_type_id, module_sequence_number, panel_group, panel_code, sub_type_id, multiwall_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (house_type_id, module_sequence_number, panel_group, panel_code, sub_type_id, multiwall_id)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding panel definition (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding panel definition: {e}", exc_info=True)
        return None

def update_panel_definition(panel_definition_id, panel_group, panel_code, sub_type_id=None, multiwall_id=None):
    """Updates an existing panel definition."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group: {panel_group}")

    if multiwall_id:
        mw_cursor = db.execute("SELECT panel_group FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
        mw_row = mw_cursor.fetchone()
        if not mw_row:
             raise ValueError(f"Assigned multiwall_id {multiwall_id} does not exist.")
        if mw_row['panel_group'] != panel_group:
             raise ValueError("Panel group must match the assigned multiwall's group.")

    try:
        # First, get the current multiwall_id to see if it changed
        current_panel_cursor = db.execute("SELECT multiwall_id FROM PanelDefinitions WHERE panel_definition_id = ?", (panel_definition_id,))
        current_panel = current_panel_cursor.fetchone()
        if not current_panel:
            return False # Panel definition not found

        cursor = db.execute(
            """UPDATE PanelDefinitions SET
               panel_group = ?, panel_code = ?, sub_type_id = ?, multiwall_id = ?
               WHERE panel_definition_id = ?""",
            (panel_group, panel_code, sub_type_id, multiwall_id, panel_definition_id)
        )
        db.commit()

        if cursor.rowcount > 0:
            # If multiwall assignment changed OR panel_group changed for a panel linked to a multiwall
            if multiwall_id and (current_panel['multiwall_id'] != multiwall_id or True): # Simplified: always update associated if multiwall is set
                # Update panel_group for all panels associated with this multiwall_id to ensure consistency
                # This logic might be overly broad if a panel is simply re-assigned to a *different* multiwall
                # that happens to have the same panel_group.
                # A more precise approach would be to only update if the *multiwall's own panel_group* was intended to change,
                # which is handled in update_multiwall.
                # For now, let's assume if a panel's group changes while it's part of a multiwall,
                # it implies the multiwall's items should also reflect this group.
                # However, the schema constrains Multiwalls.panel_group, so this might be redundant or better handled.

                # Simpler: if the panel's group changed, and it's part of a multiwall,
                # ensure all other panels in that multiwall also reflect that new group.
                # This seems problematic as PanelDefinitions.panel_group should align with Multiwalls.panel_group.
                # The validation at the start should prevent mismatches.
                # The original logic to update associated panels' group is likely better placed in `update_multiwall`.
                pass # Revisit if cascading group changes from panel to other panels in the same multiwall is needed.
            return True
        else:
            return False
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating panel definition (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error updating panel definition: {e}", exc_info=True)
        return False

def delete_panel_definition(panel_definition_id):
    """Deletes a panel definition by its ID."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM PanelDefinitions WHERE panel_definition_id = ?", (panel_definition_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting panel definition: {e}", exc_info=True)
        return False

# === Multiwalls ===

def get_multiwalls_for_house_type_module(house_type_id, module_sequence_number=None): # module_sequence_number is not in Multiwalls table
    """Fetches all multiwalls for a specific house type."""
    db = get_db()
    query = """
        SELECT
            multiwall_id, house_type_id, panel_group, multiwall_code
        FROM Multiwalls
        WHERE house_type_id = ?
        ORDER BY panel_group, multiwall_code
    """
    # module_sequence_number is not part of Multiwalls table as per new_schema.sql
    # If it were, the query would include: AND module_sequence_number = ?
    # params = [house_type_id, module_sequence_number] if module_sequence_number else [house_type_id]
    cursor = db.execute(query, (house_type_id,))
    return [dict(row) for row in cursor.fetchall()]

def add_multiwall(house_type_id, panel_group, multiwall_code): # module_sequence_number removed
    """Adds a new multiwall."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group for multiwall: {panel_group}")

    try:
        cursor = db.execute(
            """INSERT INTO Multiwalls
               (house_type_id, panel_group, multiwall_code)
               VALUES (?, ?, ?)""", # module_sequence_number removed
            (house_type_id, panel_group, multiwall_code)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding multiwall (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding multiwall: {e}", exc_info=True)
        return None

def update_multiwall(multiwall_id, panel_group, multiwall_code): # house_type_id and module_sequence_number are not updated here, they define the multiwall
    """Updates an existing multiwall's code or group."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group for multiwall: {panel_group}")

    try:
        with db: # Use transaction
            # Get current panel_group of the multiwall
            mw_cursor = db.execute("SELECT panel_group FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
            mw_current = mw_cursor.fetchone()
            if not mw_current:
                return False # Multiwall not found

            current_mw_panel_group = mw_current['panel_group']

            update_cursor = db.execute(
                """UPDATE Multiwalls SET
                   panel_group = ?, multiwall_code = ?
                   WHERE multiwall_id = ?""",
                (panel_group, multiwall_code, multiwall_id)
            )

            if update_cursor.rowcount > 0:
                # If the multiwall's panel_group has changed, update all associated PanelDefinitions
                if current_mw_panel_group != panel_group:
                    db.execute(
                        "UPDATE PanelDefinitions SET panel_group = ? WHERE multiwall_id = ?",
                        (panel_group, multiwall_id)
                    )
                return True
            else:
                return False # Should not happen if mw_current was found, but as a safeguard
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating multiwall (IntegrityError): {e}", exc_info=True)
        raise e # Re-raise to be handled by API, transaction will rollback
    except sqlite3.Error as e:
        logging.error(f"Error updating multiwall: {e}", exc_info=True)
        # Transaction ensures rollback
        return False


def delete_multiwall(multiwall_id):
    """Deletes a multiwall. Associated PanelDefinitions will have multiwall_id set to NULL due to FK constraint."""
    db = get_db()
    try:
        # The ON DELETE SET NULL constraint in PanelDefinitions.multiwall_id handles unlinking panels automatically
        cursor = db.execute("DELETE FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting multiwall: {e}", exc_info=True)
        return False

# === Admin Team ===

def get_all_admin_team():
    """Fetches all members from the AdminTeam table."""
    db = get_db()
    cursor = db.execute(
        "SELECT admin_team_id, first_name, last_name, role, pin, is_active FROM AdminTeam ORDER BY last_name, first_name"
    )
    members = cursor.fetchall()
    return [dict(row) for row in members]

def add_admin_team_member(first_name, last_name, role, pin, is_active):
    """Adds a new member to the AdminTeam table."""
    db = get_db()
    allowed_roles = ['Supervisor', 'Gestión de producción', 'Admin']
    if role not in allowed_roles:
        raise ValueError(f"Invalid role specified: {role}. Must be one of {allowed_roles}")

    try:
        cursor = db.execute(
            "INSERT INTO AdminTeam (first_name, last_name, role, pin, is_active) VALUES (?, ?, ?, ?, ?)",
            (first_name, last_name, role, pin, is_active)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding admin team member (IntegrityError - e.g. duplicate PIN): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding admin team member: {e}", exc_info=True)
        return None

def update_admin_team_member(admin_team_id, first_name, last_name, role, pin, is_active):
    """Updates an existing member in the AdminTeam table."""
    db = get_db()
    allowed_roles = ['Supervisor', 'Gestión de producción', 'Admin']
    if role not in allowed_roles:
        raise ValueError(f"Invalid role specified: {role}. Must be one of {allowed_roles}")

    try:
        cursor = db.execute(
            """UPDATE AdminTeam SET
               first_name = ?, last_name = ?, role = ?, pin = ?, is_active = ?
               WHERE admin_team_id = ?""",
            (first_name, last_name, role, pin, is_active, admin_team_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating admin team member (IntegrityError - e.g. duplicate PIN): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error updating admin team member: {e}", exc_info=True)
        return False

def delete_admin_team_member(admin_team_id):
    """Deletes a member from the AdminTeam table."""
    db = get_db()
    try:
        # Consider ON DELETE SET NULL for Workers.supervisor_id if an admin is deleted
        cursor = db.execute("DELETE FROM AdminTeam WHERE admin_team_id = ?", (admin_team_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting admin team member: {e}", exc_info=True)
        return False

def get_all_supervisors():
    """Fetches all active admin team members with the 'Supervisor' role."""
    db = get_db()
    cursor = db.execute(
        """SELECT admin_team_id, first_name, last_name
           FROM AdminTeam
           WHERE role = 'Supervisor' AND is_active = 1
           ORDER BY last_name, first_name"""
    )
    supervisors = cursor.fetchall()
    return [dict(row) for row in supervisors]

def get_admin_member_by_pin(pin):
    """Fetches an admin team member by their PIN."""
    db = get_db()
    cursor = db.execute(
        "SELECT admin_team_id, first_name, last_name, role, pin, is_active FROM AdminTeam WHERE pin = ?",
        (pin,)
    )
    row = cursor.fetchone()
    return dict(row) if row else None

def delete_task_definition(task_definition_id):
    """Deletes a task definition."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM TaskDefinitions WHERE task_definition_id = ?", (task_definition_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting task definition {task_definition_id}: {e}", exc_info=True)
        # Consider impact on TaskLogs/PanelTaskLogs (e.g. ON DELETE RESTRICT)
        return False

# === Helper functions to get related data (for dropdowns etc.) ===

def get_all_house_types_with_details():
    """
    Fetches all house types, including their associated parameters and sub_types, grouped by house type.
    """
    db = get_db()
    ht_cursor = db.execute("SELECT house_type_id, name, description, number_of_modules FROM HouseTypes ORDER BY name")
    house_types_list = [dict(row) for row in ht_cursor.fetchall()]
    house_types_dict = {ht['house_type_id']: ht for ht in house_types_list}

    for ht_id in house_types_dict:
        house_types_dict[ht_id]['parameters'] = []
        house_types_dict[ht_id]['sub_types'] = [] # Changed from tipologias

    param_query = """
        SELECT
            htp.house_type_id,
            htp.house_type_parameter_id, htp.parameter_id, htp.module_sequence_number,
            htp.sub_type_id, hst.name as sub_type_name, -- Changed from tipologia
            htp.value,
            hp.name as parameter_name, hp.unit as parameter_unit
        FROM HouseTypeParameters htp
        JOIN HouseParameters hp ON htp.parameter_id = hp.parameter_id
        LEFT JOIN HouseSubType hst ON htp.sub_type_id = hst.sub_type_id -- Changed from HouseTypeTipologias
        ORDER BY htp.house_type_id, htp.module_sequence_number, hst.name, hp.name
    """
    param_cursor = db.execute(param_query)
    parameters = param_cursor.fetchall()

    for param_row in parameters:
        param_dict = dict(param_row)
        ht_id = param_dict.pop('house_type_id')
        if ht_id in house_types_dict:
            house_types_dict[ht_id]['parameters'].append(param_dict)

    sub_type_query = """
        SELECT house_type_id, sub_type_id, name, description
        FROM HouseSubType -- Changed from HouseTypeTipologias
        ORDER BY house_type_id, name
    """
    sub_type_cursor = db.execute(sub_type_query)
    sub_types = sub_type_cursor.fetchall()

    for sub_type_row in sub_types:
        sub_type_dict = dict(sub_type_row)
        ht_id = sub_type_dict.pop('house_type_id')
        if ht_id in house_types_dict:
            house_types_dict[ht_id]['sub_types'].append(sub_type_dict) # Changed from tipologias

    return list(house_types_dict.values())


def get_all_stations():
    """Fetches all stations for dropdowns."""
    db = get_db()
    cursor = db.execute("SELECT station_id, name, line_type, sequence_order FROM Stations ORDER BY sequence_order")
    return [dict(row) for row in cursor.fetchall()]


# === Workers ===

def get_all_workers():
    """Fetches all workers with their specialty name and supervisor name."""
    db = get_db()
    query = """
        SELECT
            w.worker_id, w.first_name, w.last_name, w.pin, w.is_active,
            w.specialty_id, s.name as specialty_name,
            w.supervisor_id, atm.first_name as supervisor_first_name, atm.last_name as supervisor_last_name
        FROM Workers w
        LEFT JOIN Specialties s ON w.specialty_id = s.specialty_id
        LEFT JOIN AdminTeam atm ON w.supervisor_id = atm.admin_team_id
        ORDER BY w.last_name, w.first_name
    """
    cursor = db.execute(query)
    workers_data = cursor.fetchall()
    result = []
    for row_data in workers_data:
        worker_dict = dict(row_data)
        if worker_dict['supervisor_first_name'] and worker_dict['supervisor_last_name']:
            worker_dict['supervisor_name'] = f"{worker_dict['supervisor_first_name']} {worker_dict['supervisor_last_name']}"
        else:
            worker_dict['supervisor_name'] = None
        result.append(worker_dict)
    return result

def get_worker_by_id(worker_id):
    """Fetches a single worker by their ID, including specialty and supervisor names."""
    db = get_db()
    query = """
        SELECT
            w.worker_id, w.first_name, w.last_name, w.pin, w.is_active,
            w.specialty_id, s.name as specialty_name,
            w.supervisor_id, atm.first_name as supervisor_first_name, atm.last_name as supervisor_last_name
        FROM Workers w
        LEFT JOIN Specialties s ON w.specialty_id = s.specialty_id
        LEFT JOIN AdminTeam atm ON w.supervisor_id = atm.admin_team_id
        WHERE w.worker_id = ?
    """
    cursor = db.execute(query, (worker_id,))
    row_data = cursor.fetchone()
    if not row_data:
        return None

    worker_dict = dict(row_data)
    if worker_dict['supervisor_first_name'] and worker_dict['supervisor_last_name']:
        worker_dict['supervisor_name'] = f"{worker_dict['supervisor_first_name']} {worker_dict['supervisor_last_name']}"
    else:
        worker_dict['supervisor_name'] = None
    return worker_dict

def get_worker_by_pin(pin):
    """Fetches a worker by their PIN, including specialty for context."""
    db = get_db()
    # Include specialty_id and specialty_name for immediate use after login
    cursor = db.execute(
        """SELECT w.worker_id, w.first_name, w.last_name, w.pin, w.specialty_id, s.name as specialty_name, w.is_active
           FROM Workers w
           LEFT JOIN Specialties s ON w.specialty_id = s.specialty_id
           WHERE w.pin = ?""",
        (pin,)
    )
    row = cursor.fetchone()
    return dict(row) if row else None

def add_worker(first_name, last_name, pin, specialty_id, supervisor_id, is_active):
    """Adds a new worker to the database."""
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO Workers
               (first_name, last_name, pin, specialty_id, supervisor_id, is_active)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (first_name, last_name, pin, specialty_id, supervisor_id, is_active)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e: # Catch IntegrityError for duplicate PINs if PIN is UNIQUE
        logging.error(f"Error adding worker (IntegrityError, possibly duplicate PIN): {e}", exc_info=True)
        raise e # Re-raise for API to handle
    except sqlite3.Error as e:
        logging.error(f"Error adding worker: {e}", exc_info=True)
        return None

def update_worker(worker_id, first_name, last_name, pin, specialty_id, supervisor_id, is_active):
    """Updates an existing worker."""
    db = get_db()
    try:
        cursor = db.execute(
            """UPDATE Workers SET
               first_name = ?, last_name = ?, pin = ?, specialty_id = ?,
               supervisor_id = ?, is_active = ?
               WHERE worker_id = ?""",
            (first_name, last_name, pin, specialty_id, supervisor_id, is_active, worker_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError as e: # Catch IntegrityError for duplicate PINs
        logging.error(f"Error updating worker (IntegrityError, possibly duplicate PIN): {e}", exc_info=True)
        raise e # Re-raise
    except sqlite3.Error as e:
        logging.error(f"Error updating worker: {e}", exc_info=True)
        return False

def delete_worker(worker_id):
    """Deletes a worker."""
    db = get_db()
    try:
        # Workers.supervisor_id has ON DELETE SET NULL
        # TaskLogs/PanelTaskLogs have worker_id as FOREIGN KEY ON DELETE RESTRICT - this might cause issues if worker has logs.
        # This should be handled by ensuring a worker cannot be deleted if they have logs, or by anonymizing logs.
        # For now, let's assume deletion is allowed if no RESTRICT constraint is violated.
        cursor = db.execute("DELETE FROM Workers WHERE worker_id = ?", (worker_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting worker: {e}", exc_info=True) # This will show if FK constraint fails
        return False

# === Production Plan related functions were moved up for clarity ===
# (add_module_production_plan_item, get_module_production_plan, etc.)


# === Station Status and Upcoming Modules ===

def _get_panels_with_status_for_plan(db, plan_id, house_type_id, module_number, sub_type_id):
    """
    Helper function to get panels with their production status for a specific plan.
    Now uses PanelsProductionPlan table to get actual panel status.
    """
    query = """
        SELECT
            pd.panel_definition_id, pd.panel_group, pd.panel_code,
            ppp.panel_plan_id, ppp.status, ppp.current_station,
            mw.multiwall_code
        FROM PanelDefinitions pd
        LEFT JOIN PanelsProductionPlan ppp ON pd.panel_definition_id = ppp.panel_definition_id AND ppp.plan_id = ?
        LEFT JOIN Multiwalls mw ON pd.multiwall_id = mw.multiwall_id
        WHERE pd.house_type_id = ? AND pd.module_sequence_number = ?
        AND (pd.sub_type_id = ? OR (pd.sub_type_id IS NULL AND ? IS NULL))
        ORDER BY pd.panel_group, mw.multiwall_code, pd.panel_code
    """
    cursor = db.execute(query, (plan_id, house_type_id, module_number, sub_type_id, sub_type_id))
    panels = []
    for row in cursor.fetchall():
        panel_dict = dict(row)
        # Map database status to display status
        panel_dict['status'] = panel_dict['status'] or 'not_started'
        panels.append(panel_dict)
    return panels

def get_station_status_and_upcoming_modules():
    """Fetches current module at each station and all upcoming planned/scheduled/magazine items from ModuleProductionPlan."""
    db = get_db()

    # 1. Fetch all stations
    stations_cursor = db.execute("SELECT station_id, name as station_name, line_type, sequence_order FROM Stations ORDER BY sequence_order, line_type")
    all_stations = [dict(row) for row in stations_cursor.fetchall()]

    # 2. Fetch relevant ModuleProductionPlan items for current station occupancy
    # For 'Panels' status (typically one active for the whole W line)
    panels_module_cursor = db.execute("""
        SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
               mpp.house_identifier, mpp.module_number, ht.number_of_modules,
               mpp.status, mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status = 'Panels'
        ORDER BY mpp.planned_sequence ASC LIMIT 1 
    """)
    panels_active_module_row = panels_module_cursor.fetchone()

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
            if panels_active_module_row:
                active_mpp_item_dict = dict(panels_active_module_row)
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
    
    # Renaming for clarity to match return structure
    station_status = station_status_list

    # Get all upcoming items from ModuleProductionPlan (this part is the same as original)
    upcoming_query = """
        SELECT
            mpp.plan_id, mpp.project_name,
            mpp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            mpp.house_identifier, mpp.module_number, -- Changed from module_sequence_in_house
            mpp.planned_sequence, mpp.planned_start_datetime,
            mpp.planned_assembly_line, mpp.status,
            mpp.sub_type_id, hst.name as sub_type_name
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status != 'Completed' -- Filter out completed items
        ORDER BY mpp.planned_sequence ASC -- Ensure sorting by sequence
    """
    upcoming_cursor = db.execute(upcoming_query)
    upcoming_items = [dict(row) for row in upcoming_cursor.fetchall()]

    return {
        'station_status': station_status,
        'upcoming_items': upcoming_items
    }


# === Panels Production Plan ===

def get_panels_production_plan_for_module(plan_id):
    """Get all panel production plan items for a specific module plan."""
    db = get_db()
    query = """
        SELECT
            ppp.panel_plan_id, ppp.plan_id, ppp.panel_definition_id,
            ppp.status, ppp.current_station, ppp.created_at, ppp.updated_at,
            pd.panel_group, pd.panel_code,
            mw.multiwall_code
        FROM PanelsProductionPlan ppp
        JOIN PanelDefinitions pd ON ppp.panel_definition_id = pd.panel_definition_id
        LEFT JOIN Multiwalls mw ON pd.multiwall_id = mw.multiwall_id
        WHERE ppp.plan_id = ?
        ORDER BY pd.panel_group, mw.multiwall_code, pd.panel_code
    """
    cursor = db.execute(query, (plan_id,))
    return [dict(row) for row in cursor.fetchall()]

def update_panel_production_status(panel_plan_id, status, current_station=None):
    """Update the status and current station of a panel production plan item."""
    db = get_db()
    allowed_statuses = ['planned', 'in_progress', 'magazine', 'consumed']
    if status not in allowed_statuses:
        raise ValueError(f"Invalid status: {status}. Must be one of {allowed_statuses}")
    
    try:
        cursor = db.execute(
            """UPDATE PanelsProductionPlan 
               SET status = ?, current_station = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE panel_plan_id = ?""",
            (status, current_station, panel_plan_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating panel production status: {e}", exc_info=True)
        return False

def get_panels_by_status_and_station(status=None, current_station=None):
    """Get panels filtered by status and/or current station."""
    db = get_db()
    base_query = """
        SELECT
            ppp.panel_plan_id, ppp.plan_id, ppp.panel_definition_id,
            ppp.status, ppp.current_station,
            pd.panel_group, pd.panel_code,
            mpp.project_name, mpp.house_identifier, mpp.module_number,
            ht.name as house_type_name
        FROM PanelsProductionPlan ppp
        JOIN PanelDefinitions pd ON ppp.panel_definition_id = pd.panel_definition_id
        JOIN ModuleProductionPlan mpp ON ppp.plan_id = mpp.plan_id
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
    """
    
    conditions = []
    params = []
    
    if status:
        conditions.append("ppp.status = ?")
        params.append(status)
    
    if current_station:
        conditions.append("ppp.current_station = ?")
        params.append(current_station)
    
    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)
    
    base_query += " ORDER BY mpp.planned_sequence, pd.panel_group, pd.panel_code"
    
    cursor = db.execute(base_query, params)
    return [dict(row) for row in cursor.fetchall()]

# === House Types ===
# get_all_house_types_with_details is defined above in the helpers section

def get_all_house_types():
    """Fetches all basic house types (ID and name). For detailed info, use get_all_house_types_with_details."""
    db = get_db()
    cursor = db.execute("SELECT house_type_id, name, description, number_of_modules FROM HouseTypes ORDER BY name")
    return [dict(row) for row in cursor.fetchall()]

def get_house_type_by_id(house_type_id):
    """Fetches a single house type by its ID."""
    db = get_db()
    cursor = db.execute("SELECT house_type_id, name, description, number_of_modules FROM HouseTypes WHERE house_type_id = ?", (house_type_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_house_type_by_name(name):
    """Fetches a house type by its name."""
    db = get_db()
    cursor = db.execute("SELECT house_type_id, name, description, number_of_modules FROM HouseTypes WHERE name = ?", (name,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_house_parameter_by_id(parameter_id):
    """Fetches a single house parameter by its ID."""
    db = get_db()
    cursor = db.execute("SELECT parameter_id, name, unit FROM HouseParameters WHERE parameter_id = ?", (parameter_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_house_parameter_by_name(name):
    """Fetches a house parameter by its name."""
    db = get_db()
    cursor = db.execute("SELECT parameter_id, name, unit FROM HouseParameters WHERE name = ?", (name,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_multiwall_by_id(multiwall_id):
    """Fetches a single multiwall by its ID."""
    db = get_db()
    cursor = db.execute("SELECT multiwall_id, house_type_id, panel_group, multiwall_code FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def get_panel_definition_by_id(panel_definition_id):
    """Fetches a single panel definition by its ID."""
    db = get_db()
    query = """
        SELECT
            pd.panel_definition_id, pd.house_type_id, pd.module_sequence_number,
            pd.panel_group, pd.panel_code, pd.sub_type_id, pd.multiwall_id,
            hst.name as sub_type_name, mw.multiwall_code
        FROM PanelDefinitions pd
        LEFT JOIN HouseSubType hst ON pd.sub_type_id = hst.sub_type_id
        LEFT JOIN Multiwalls mw ON pd.multiwall_id = mw.multiwall_id
        WHERE pd.panel_definition_id = ?
    """
    cursor = db.execute(query, (panel_definition_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


def add_house_type(name, description, number_of_modules):
    """Adds a new house type."""
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO HouseTypes (name, description, number_of_modules) VALUES (?, ?, ?)",
            (name, description, number_of_modules)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e: # Catch duplicate name
        logging.warning(f"HouseType '{name}' already exists or other integrity error: {e}")
        return None

def update_house_type(house_type_id, name, description, number_of_modules):
    """Updates an existing house type."""
    db = get_db()
    try:
        cursor = db.execute(
            "UPDATE HouseTypes SET name = ?, description = ?, number_of_modules = ? WHERE house_type_id = ?",
            (name, description, number_of_modules, house_type_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating house type {house_type_id}: {e}", exc_info=True)
        return False

def delete_house_type(house_type_id):
    """Deletes a house type."""
    db = get_db()
    try:
        # Schema has ON DELETE CASCADE for HouseSubType, HouseTypeParameters, PanelDefinitions, Multiwalls.
        # ModuleProductionPlan.house_type_id has ON DELETE RESTRICT.
        # Modules.house_type_id has ON DELETE RESTRICT.
        # TaskDefinitions.house_type_id has ON DELETE SET NULL.
        # ProjectModules.house_type_id has ON DELETE CASCADE.
        cursor = db.execute("DELETE FROM HouseTypes WHERE house_type_id = ?", (house_type_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e: # Will catch IntegrityError if RESTRICT fails
        logging.error(f"Error deleting house type {house_type_id} (possibly due to existing plans/modules): {e}", exc_info=True)
        return False


# === House SubType (formerly Tipologias) ===

def get_sub_types_for_house_type(house_type_id):
    """Fetches all sub_types for a specific house type."""
    db = get_db()
    cursor = db.execute(
        "SELECT sub_type_id, house_type_id, name, description FROM HouseSubType WHERE house_type_id = ? ORDER BY name",
        (house_type_id,)
    )
    return [dict(row) for row in cursor.fetchall()]

def get_sub_type_by_id(sub_type_id):
    """Fetches a single sub_type by its ID."""
    db = get_db()
    cursor = db.execute(
        "SELECT sub_type_id, house_type_id, name, description FROM HouseSubType WHERE sub_type_id = ?",
        (sub_type_id,)
    )
    row = cursor.fetchone()
    return dict(row) if row else None

def add_sub_type_to_house_type(house_type_id, name, description):
    """Adds a new sub_type to a house type."""
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO HouseSubType (house_type_id, name, description) VALUES (?, ?, ?)",
            (house_type_id, name, description)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding sub_type (IntegrityError - e.g. duplicate name for house_type): {e}", exc_info=True)
        raise e

def update_sub_type(sub_type_id, name, description):
    """Updates an existing sub_type."""
    db = get_db()
    try:
        cursor = db.execute(
            "UPDATE HouseSubType SET name = ?, description = ? WHERE sub_type_id = ?",
            (name, description, sub_type_id)
        )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating sub_type (IntegrityError): {e}", exc_info=True)
        raise e

def delete_sub_type(sub_type_id):
    """Deletes a sub_type. Associated HouseTypeParameters, ModuleProductionPlan.sub_type_id, PanelDefinitions.sub_type_id are handled by schema constraints."""
    db = get_db()
    try:
        # HouseTypeParameters.sub_type_id ON DELETE CASCADE
        # ModuleProductionPlan.sub_type_id ON DELETE SET NULL
        # PanelDefinitions.sub_type_id ON DELETE SET NULL
        cursor = db.execute("DELETE FROM HouseSubType WHERE sub_type_id = ?", (sub_type_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting sub_type: {e}", exc_info=True)
        return False


# === House Parameters ===

def get_all_house_parameters():
    """Fetches all house parameters."""
    db = get_db()
    cursor = db.execute("SELECT parameter_id, name, unit FROM HouseParameters ORDER BY name")
    return [dict(row) for row in cursor.fetchall()]

def add_house_parameter(name, unit):
    """Adds a new house parameter definition."""
    db = get_db()
    try:
        cursor = db.execute("INSERT INTO HouseParameters (name, unit) VALUES (?, ?)", (name, unit))
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError: # Duplicate name
        logging.warning(f"HouseParameter '{name}' already exists.")
        return None

def update_house_parameter(parameter_id, name, unit):
    """Updates an existing house parameter definition."""
    db = get_db()
    try:
        cursor = db.execute("UPDATE HouseParameters SET name = ?, unit = ? WHERE parameter_id = ?", (name, unit, parameter_id))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating house parameter {parameter_id}: {e}", exc_info=True)
        return False

def delete_house_parameter(parameter_id):
    """Deletes a house parameter definition. Associated HouseTypeParameters are deleted by CASCADE."""
    db = get_db()
    try:
        # HouseTypeParameters.parameter_id has ON DELETE CASCADE
        cursor = db.execute("DELETE FROM HouseParameters WHERE parameter_id = ?", (parameter_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting house parameter {parameter_id}: {e}", exc_info=True)
        return False

# === House Type Parameters (Linking Table) ===

def get_parameters_for_house_type(house_type_id): # Renamed from get_parameters_for_house_type to simplify, matches pattern
    """Fetches all parameters and their values for a specific house type, including module sequence and sub_type info."""
    db = get_db()
    query = """
        SELECT
            htp.house_type_parameter_id, htp.parameter_id, htp.module_sequence_number,
            htp.sub_type_id, hst.name as sub_type_name, -- Changed from tipologia
            htp.value,
            hp.name as parameter_name, hp.unit as parameter_unit
        FROM HouseTypeParameters htp
        JOIN HouseParameters hp ON htp.parameter_id = hp.parameter_id
        LEFT JOIN HouseSubType hst ON htp.sub_type_id = hst.sub_type_id -- Changed from HouseTypeTipologias
        WHERE htp.house_type_id = ?
        ORDER BY htp.module_sequence_number, hst.name, hp.name
    """
    cursor = db.execute(query, (house_type_id,))
    return [dict(row) for row in cursor.fetchall()]

def add_or_update_house_type_parameter(house_type_id, parameter_id, module_sequence_number, value, sub_type_id=None): # Renamed tipologia_id to sub_type_id
    """Adds or updates the value for a parameter for a specific module and sub_type within a house type."""
    db = get_db()
    try:
        # UPSERT based on UNIQUE (house_type_id, parameter_id, module_sequence_number, sub_type_id)
        cursor = db.execute(
            """INSERT INTO HouseTypeParameters (house_type_id, parameter_id, module_sequence_number, sub_type_id, value)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(house_type_id, parameter_id, module_sequence_number, sub_type_id)
               DO UPDATE SET value = excluded.value""",
            (house_type_id, parameter_id, module_sequence_number, sub_type_id, value)
        )
        db.commit()
        return True # lastrowid is not reliable for UPSERT updates in all cases
    except sqlite3.Error as e:
        logging.error(f"Error adding/updating house type parameter: {e}", exc_info=True)
        return False

def delete_house_type_parameter(house_type_parameter_id):
    """Removes a specific parameter link from a house type by its own ID (house_type_parameter_id)."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM HouseTypeParameters WHERE house_type_parameter_id = ?", (house_type_parameter_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting house type parameter by ID {house_type_parameter_id}: {e}", exc_info=True)
        return False

def delete_parameter_from_house_type_module_sub_type(house_type_id, parameter_id, module_sequence_number, sub_type_id=None): # Renamed tipologia_id
    """Removes a parameter link by composite key: house_type_id, parameter_id, module sequence, and optionally sub_type_id."""
    db = get_db()
    try:
        if sub_type_id is None:
            cursor = db.execute(
                """DELETE FROM HouseTypeParameters
                   WHERE house_type_id = ? AND parameter_id = ? AND module_sequence_number = ? AND sub_type_id IS NULL""",
                (house_type_id, parameter_id, module_sequence_number)
            )
        else:
            cursor = db.execute(
                """DELETE FROM HouseTypeParameters
                   WHERE house_type_id = ? AND parameter_id = ? AND module_sequence_number = ? AND sub_type_id = ?""",
                (house_type_id, parameter_id, module_sequence_number, sub_type_id)
            )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting house type parameter by composite key: {e}", exc_info=True)
        return False

# ProjectModules table and its related functions are considered deprecated by the new batch planning approach.
# They are removed to avoid confusion. If ProjectModules table is still needed for other purposes,
# its functions should be reviewed and potentially kept, but they are not part of this refactor's scope
# for production planning.

# === Station Context and Task Management ===

def get_station_context(station_id, worker_specialty_id=None):
    """
    Get the current production context for a specific station.
    Returns the module/panels that should be worked on at this station.
    Implements the production system rules for context selection.
    """
    db = get_db()
    
    # Get station info
    station_cursor = db.execute(
        "SELECT station_id, name, line_type, sequence_order FROM Stations WHERE station_id = ?",
        (station_id,)
    )
    station = station_cursor.fetchone()
    if not station:
        return None
    
    station_dict = dict(station)
    
    # For W1 station, implement the special logic for starting the process
    if station_id == 'W1':
        return _get_w1_station_context(db, station_dict, worker_specialty_id)
    
    # For other stations, find modules/panels currently at this station
    return _get_general_station_context(db, station_dict, worker_specialty_id)

def _get_w1_station_context(db, station_dict, worker_specialty_id):
    """
    Special logic for W1 station - the root of the production process.
    Find the lowest planned_sequence plan_id that's not completed and check its panels.
    """
    # Find the lowest planned_sequence module that's not completed
    module_cursor = db.execute("""
        SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
               mpp.house_identifier, mpp.module_number, ht.number_of_modules,
               mpp.status, mpp.sub_type_id, hst.name as sub_type_name, mpp.planned_sequence
        FROM ModuleProductionPlan mpp
        JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
        LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
        WHERE mpp.status != 'Completed'
        ORDER BY mpp.planned_sequence ASC
        LIMIT 1
    """)
    
    module_row = module_cursor.fetchone()
    if not module_row:
        return {
            'station': station_dict,
            'current_module': None,
            'message': 'No modules in production queue'
        }
    
    module_dict = dict(module_row)
    
    # Get panels for this module
    panels = _get_panels_with_status_for_plan(
        db, 
        module_dict['plan_id'], 
        module_dict['house_type_id'],
        module_dict['module_number'],
        module_dict['sub_type_id']
    )
    
    # Check if any panels are "planned" (can start new work)
    planned_panels = [p for p in panels if p['status'] == 'planned']
    in_progress_panels = [p for p in panels if p['status'] == 'in_progress']
    
    # If all panels are in progress, look at the next module
    if not planned_panels and in_progress_panels:
        # All panels are being worked on, check next module
        next_module_cursor = db.execute("""
            SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
                   mpp.house_identifier, mpp.module_number, ht.number_of_modules,
                   mpp.status, mpp.sub_type_id, hst.name as sub_type_name, mpp.planned_sequence
            FROM ModuleProductionPlan mpp
            JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
            LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
            WHERE mpp.status != 'Completed' AND mpp.planned_sequence > ?
            ORDER BY mpp.planned_sequence ASC
            LIMIT 1
        """, (module_dict['planned_sequence'],))
        
        next_module_row = next_module_cursor.fetchone()
        if next_module_row:
            module_dict = dict(next_module_row)
            panels = _get_panels_with_status_for_plan(
                db, 
                module_dict['plan_id'], 
                module_dict['house_type_id'],
                module_dict['module_number'],
                module_dict['sub_type_id']
            )
    
    # Add task information to panels
    panels_with_tasks = []
    for panel in panels:
        panel_with_tasks = dict(panel)
        panel_with_tasks['available_tasks'] = _get_available_tasks_for_panel(
            db, module_dict['plan_id'], panel['panel_definition_id'], 
            station_dict['sequence_order'], worker_specialty_id
        )
        panel_with_tasks['current_task'] = _get_current_task_for_panel(
            db, module_dict['plan_id'], panel['panel_definition_id']
        )
        panels_with_tasks.append(panel_with_tasks)
    
    return {
        'station': station_dict,
        'current_module': {
            'plan_id': module_dict['plan_id'],
            'project_name': module_dict['project_name'],
            'house_identifier': module_dict['house_identifier'],
            'module_number': module_dict['module_number'],
            'status': module_dict['status'],
            'house_type_name': module_dict['house_type_name'],
            'house_type_id': module_dict['house_type_id'],
            'number_of_modules': module_dict['number_of_modules'],
            'sub_type_name': module_dict.get('sub_type_name'),
            'sub_type_id': module_dict.get('sub_type_id'),
            'planned_sequence': module_dict['planned_sequence'],
            'panels': panels_with_tasks
        }
    }

def _get_general_station_context(db, station_dict, worker_specialty_id):
    """
    General logic for non-W1 stations.
    Find modules/panels currently at this station.
    """
    # Find modules currently at this station based on status and line type
    if station_dict['line_type'] == 'W':
        # Panel line stations - look for modules in 'Panels' status
        module_cursor = db.execute("""
            SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
                   mpp.house_identifier, mpp.module_number, ht.number_of_modules,
                   mpp.status, mpp.sub_type_id, hst.name as sub_type_name, mpp.planned_sequence
            FROM ModuleProductionPlan mpp
            JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
            LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
            WHERE mpp.status = 'Panels'
            ORDER BY mpp.planned_sequence ASC
            LIMIT 1
        """)
    elif station_dict['line_type'] == 'M':
        # Magazine station
        module_cursor = db.execute("""
            SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
                   mpp.house_identifier, mpp.module_number, ht.number_of_modules,
                   mpp.status, mpp.sub_type_id, hst.name as sub_type_name, mpp.planned_sequence
            FROM ModuleProductionPlan mpp
            JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
            LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
            WHERE mpp.status = 'Magazine'
            ORDER BY mpp.planned_sequence ASC
            LIMIT 1
        """)
    else:
        # Assembly line stations (A, B, C)
        module_cursor = db.execute("""
            SELECT mpp.plan_id, mpp.project_name, mpp.house_type_id, ht.name as house_type_name,
                   mpp.house_identifier, mpp.module_number, ht.number_of_modules,
                   mpp.status, mpp.sub_type_id, hst.name as sub_type_name, mpp.planned_sequence,
                   mpp.current_station
            FROM ModuleProductionPlan mpp
            JOIN HouseTypes ht ON mpp.house_type_id = ht.house_type_id
            LEFT JOIN HouseSubType hst ON mpp.sub_type_id = hst.sub_type_id
            WHERE mpp.status = 'Assembly' AND mpp.planned_assembly_line = ? 
                  AND (mpp.current_station = ? OR mpp.current_station IS NULL)
            ORDER BY mpp.planned_sequence ASC
            LIMIT 1
        """, (station_dict['line_type'], station_dict['station_id']))
    
    module_row = module_cursor.fetchone()
    if not module_row:
        return {
            'station': station_dict,
            'current_module': None,
            'message': f'No modules currently at station {station_dict["station_id"]}'
        }
    
    module_dict = dict(module_row)
    
    # Get panels for this module
    panels = _get_panels_with_status_for_plan(
        db, 
        module_dict['plan_id'], 
        module_dict['house_type_id'],
        module_dict['module_number'],
        module_dict['sub_type_id']
    )
    
    # Add task information to panels
    panels_with_tasks = []
    for panel in panels:
        panel_with_tasks = dict(panel)
        panel_with_tasks['available_tasks'] = _get_available_tasks_for_panel(
            db, module_dict['plan_id'], panel['panel_definition_id'], 
            station_dict['sequence_order'], worker_specialty_id
        )
        panel_with_tasks['current_task'] = _get_current_task_for_panel(
            db, module_dict['plan_id'], panel['panel_definition_id']
        )
        panels_with_tasks.append(panel_with_tasks)
    
    return {
        'station': station_dict,
        'current_module': {
            'plan_id': module_dict['plan_id'],
            'project_name': module_dict['project_name'],
            'house_identifier': module_dict['house_identifier'],
            'module_number': module_dict['module_number'],
            'status': module_dict['status'],
            'house_type_name': module_dict['house_type_name'],
            'house_type_id': module_dict['house_type_id'],
            'number_of_modules': module_dict['number_of_modules'],
            'sub_type_name': module_dict.get('sub_type_name'),
            'sub_type_id': module_dict.get('sub_type_id'),
            'planned_sequence': module_dict['planned_sequence'],
            'panels': panels_with_tasks
        }
    }

def _get_available_tasks_for_panel(db, plan_id, panel_definition_id, station_sequence_order, worker_specialty_id):
    """Get available tasks for a panel at the current station."""
    query = """
        SELECT td.task_definition_id, td.name, td.description, td.specialty_id, s.name as specialty_name
        FROM TaskDefinitions td
        LEFT JOIN Specialties s ON td.specialty_id = s.specialty_id
        WHERE td.is_panel_task = 1 
              AND (td.station_sequence_order = ? OR td.station_sequence_order IS NULL)
              AND (td.specialty_id = ? OR td.specialty_id IS NULL OR ? IS NULL)
              AND td.task_definition_id NOT IN (
                  SELECT ptl.task_definition_id 
                  FROM PanelTaskLogs ptl 
                  WHERE ptl.plan_id = ? AND ptl.panel_definition_id = ? 
                        AND ptl.status = 'Completed'
              )
        ORDER BY td.name
    """
    cursor = db.execute(query, (station_sequence_order, worker_specialty_id, worker_specialty_id, plan_id, panel_definition_id))
    return [dict(row) for row in cursor.fetchall()]

def _get_current_task_for_panel(db, plan_id, panel_definition_id):
    """Get the current active task for a panel (if any)."""
    query = """
        SELECT ptl.panel_task_log_id, ptl.task_definition_id, ptl.status, ptl.started_at,
               td.name as task_name, ptl.worker_id, w.first_name, w.last_name
        FROM PanelTaskLogs ptl
        JOIN TaskDefinitions td ON ptl.task_definition_id = td.task_definition_id
        LEFT JOIN Workers w ON ptl.worker_id = w.worker_id
        WHERE ptl.plan_id = ? AND ptl.panel_definition_id = ? 
              AND ptl.status IN ('In Progress', 'Paused')
        ORDER BY ptl.started_at DESC
        LIMIT 1
    """
    cursor = db.execute(query, (plan_id, panel_definition_id))
    row = cursor.fetchone()
    return dict(row) if row else None

def start_panel_task(plan_id, panel_definition_id, task_definition_id, worker_id, station_id):
    """Start a new task for a panel."""
    db = get_db()
    
    # Check if worker already has a task in progress
    existing_task_cursor = db.execute("""
        SELECT panel_task_log_id FROM PanelTaskLogs 
        WHERE worker_id = ? AND status IN ('In Progress', 'Paused')
    """, (worker_id,))
    
    if existing_task_cursor.fetchone():
        raise ValueError("Worker already has a task in progress. Must finish or pause current task first.")
    
    # Check if this specific task is already in progress for this panel
    existing_panel_task_cursor = db.execute("""
        SELECT panel_task_log_id FROM PanelTaskLogs 
        WHERE plan_id = ? AND panel_definition_id = ? AND task_definition_id = ? 
              AND status IN ('In Progress', 'Paused')
    """, (plan_id, panel_definition_id, task_definition_id))
    
    if existing_panel_task_cursor.fetchone():
        raise ValueError("This task is already in progress for this panel.")
    
    try:
        # Insert new task log
        cursor = db.execute("""
            INSERT INTO PanelTaskLogs 
            (plan_id, panel_definition_id, task_definition_id, worker_id, status, started_at, station_start)
            VALUES (?, ?, ?, ?, 'In Progress', ?, ?)
        """, (plan_id, panel_definition_id, task_definition_id, worker_id, 
              datetime.now().strftime('%Y-%m-%d %H:%M:%S'), station_id))
        
        task_log_id = cursor.lastrowid
        
        # Update panel status to in_progress if it was planned
        db.execute("""
            UPDATE PanelsProductionPlan 
            SET status = 'in_progress', current_station = ?, updated_at = CURRENT_TIMESTAMP
            WHERE plan_id = ? AND panel_definition_id = ? AND status = 'planned'
        """, (station_id, plan_id, panel_definition_id))
        
        db.commit()
        return task_log_id
    except sqlite3.Error as e:
        logging.error(f"Error starting panel task: {e}", exc_info=True)
        return None

def pause_panel_task(panel_task_log_id, worker_id, reason=None):
    """Pause an active panel task."""
    db = get_db()
    
    try:
        # Update task status to paused
        cursor = db.execute("""
            UPDATE PanelTaskLogs 
            SET status = 'Paused'
            WHERE panel_task_log_id = ? AND worker_id = ? AND status = 'In Progress'
        """, (panel_task_log_id, worker_id))
        
        if cursor.rowcount == 0:
            return False
        
        # Insert pause record
        db.execute("""
            INSERT INTO TaskPauses (panel_task_log_id, paused_by_worker_id, paused_at, reason)
            VALUES (?, ?, ?, ?)
        """, (panel_task_log_id, worker_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), reason))
        
        db.commit()
        return True
    except sqlite3.Error as e:
        logging.error(f"Error pausing panel task: {e}", exc_info=True)
        return False

def resume_panel_task(panel_task_log_id, worker_id):
    """Resume a paused panel task."""
    db = get_db()
    
    # Check if worker already has another task in progress
    existing_task_cursor = db.execute("""
        SELECT panel_task_log_id FROM PanelTaskLogs 
        WHERE worker_id = ? AND status = 'In Progress' AND panel_task_log_id != ?
    """, (worker_id, panel_task_log_id))
    
    if existing_task_cursor.fetchone():
        raise ValueError("Worker already has another task in progress.")
    
    try:
        # Update task status to in progress
        cursor = db.execute("""
            UPDATE PanelTaskLogs 
            SET status = 'In Progress'
            WHERE panel_task_log_id = ? AND worker_id = ? AND status = 'Paused'
        """, (panel_task_log_id, worker_id))
        
        if cursor.rowcount == 0:
            return False
        
        # Update the most recent pause record
        db.execute("""
            UPDATE TaskPauses 
            SET resumed_at = ?
            WHERE panel_task_log_id = ? AND resumed_at IS NULL
        """, (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), panel_task_log_id))
        
        db.commit()
        return True
    except sqlite3.Error as e:
        logging.error(f"Error resuming panel task: {e}", exc_info=True)
        return False

def finish_panel_task(panel_task_log_id, worker_id, station_id, notes=None):
    """Finish a panel task and update production flow."""
    db = get_db()
    
    try:
        # Get task details
        task_cursor = db.execute("""
            SELECT ptl.plan_id, ptl.panel_definition_id, ptl.task_definition_id
            FROM PanelTaskLogs ptl
            WHERE ptl.panel_task_log_id = ? AND ptl.worker_id = ? 
                  AND ptl.status IN ('In Progress', 'Paused')
        """, (panel_task_log_id, worker_id))
        
        task_row = task_cursor.fetchone()
        if not task_row:
            return False
        
        plan_id, panel_definition_id, task_definition_id = task_row
        
        # Update task status to completed
        db.execute("""
            UPDATE PanelTaskLogs 
            SET status = 'Completed', completed_at = ?, station_finish = ?, notes = ?
            WHERE panel_task_log_id = ?
        """, (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), station_id, notes, panel_task_log_id))
        
        # Check if all tasks for this panel at this station are completed
        _check_and_update_panel_progression(db, plan_id, panel_definition_id, station_id)
        
        # Check if all panels for this module at this station are completed
        _check_and_update_module_progression(db, plan_id, station_id)
        
        db.commit()
        return True
    except sqlite3.Error as e:
        logging.error(f"Error finishing panel task: {e}", exc_info=True)
        return False

def _check_and_update_panel_progression(db, plan_id, panel_definition_id, current_station_id):
    """Check if panel should move to next station or be marked as completed."""
    # Get current station sequence order
    station_cursor = db.execute(
        "SELECT sequence_order, line_type FROM Stations WHERE station_id = ?",
        (current_station_id,)
    )
    station_row = station_cursor.fetchone()
    if not station_row:
        return
    
    current_sequence_order, line_type = station_row
    
    # Check if there are any incomplete tasks for this panel at this station
    incomplete_tasks_cursor = db.execute("""
        SELECT COUNT(*) as incomplete_count
        FROM TaskDefinitions td
        WHERE td.is_panel_task = 1 
              AND td.station_sequence_order = ?
              AND td.task_definition_id NOT IN (
                  SELECT ptl.task_definition_id 
                  FROM PanelTaskLogs ptl 
                  WHERE ptl.plan_id = ? AND ptl.panel_definition_id = ? 
                        AND ptl.status = 'Completed'
              )
    """, (current_sequence_order, plan_id, panel_definition_id))
    
    incomplete_count = incomplete_tasks_cursor.fetchone()[0]
    
    if incomplete_count == 0:
        # All tasks completed at this station, move to next station
        if line_type == 'W' and current_station_id == 'W5':
            # Last panel station, move to magazine
            db.execute("""
                UPDATE PanelsProductionPlan 
                SET status = 'magazine', current_station = 'M1', updated_at = CURRENT_TIMESTAMP
                WHERE plan_id = ? AND panel_definition_id = ?
            """, (plan_id, panel_definition_id))
        elif line_type == 'M':
            # Magazine complete, mark as consumed (ready for assembly)
            db.execute("""
                UPDATE PanelsProductionPlan 
                SET status = 'consumed', current_station = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE plan_id = ? AND panel_definition_id = ?
            """, (plan_id, panel_definition_id))
        else:
            # Move to next station in the same line
            next_station_cursor = db.execute("""
                SELECT station_id FROM Stations 
                WHERE line_type = ? AND sequence_order > ?
                ORDER BY sequence_order ASC LIMIT 1
            """, (line_type, current_sequence_order))
            
            next_station_row = next_station_cursor.fetchone()
            if next_station_row:
                next_station_id = next_station_row[0]
                db.execute("""
                    UPDATE PanelsProductionPlan 
                    SET current_station = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE plan_id = ? AND panel_definition_id = ?
                """, (next_station_id, plan_id, panel_definition_id))

def _check_and_update_module_progression(db, plan_id, current_station_id):
    """Check if module should move to next phase of production."""
    # Get current station info
    station_cursor = db.execute(
        "SELECT sequence_order, line_type FROM Stations WHERE station_id = ?",
        (current_station_id,)
    )
    station_row = station_cursor.fetchone()
    if not station_row:
        return
    
    current_sequence_order, line_type = station_row
    
    if line_type == 'W':
        # Check if all panels for this module are completed in panel line
        incomplete_panels_cursor = db.execute("""
            SELECT COUNT(*) as incomplete_count
            FROM PanelsProductionPlan ppp
            WHERE ppp.plan_id = ? AND ppp.status IN ('planned', 'in_progress')
        """, (plan_id,))
        
        incomplete_count = incomplete_panels_cursor.fetchone()[0]
        
        if incomplete_count == 0:
            # All panels completed, move module to Magazine status
            db.execute("""
                UPDATE ModuleProductionPlan 
                SET status = 'Magazine', current_station = 'M1', updated_at = CURRENT_TIMESTAMP
                WHERE plan_id = ?
            """, (plan_id,))
    
    elif line_type == 'M':
        # Check if all panels are consumed (ready for assembly)
        unconsumed_panels_cursor = db.execute("""
            SELECT COUNT(*) as unconsumed_count
            FROM PanelsProductionPlan ppp
            WHERE ppp.plan_id = ? AND ppp.status != 'consumed'
        """, (plan_id,))
        
        unconsumed_count = unconsumed_panels_cursor.fetchone()[0]
        
        if unconsumed_count == 0:
            # All panels consumed, move module to Assembly status
            # Get the planned assembly line for this module
            module_cursor = db.execute(
                "SELECT planned_assembly_line FROM ModuleProductionPlan WHERE plan_id = ?",
                (plan_id,)
            )
            module_row = module_cursor.fetchone()
            if module_row:
                planned_line = module_row[0]
                # Find first station in the assembly line
                first_assembly_station_cursor = db.execute("""
                    SELECT station_id FROM Stations 
                    WHERE line_type = ? 
                    ORDER BY sequence_order ASC LIMIT 1
                """, (planned_line,))
                
                first_station_row = first_assembly_station_cursor.fetchone()
                if first_station_row:
                    first_station_id = first_station_row[0]
                    db.execute("""
                        UPDATE ModuleProductionPlan 
                        SET status = 'Assembly', current_station = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE plan_id = ?
                    """, (first_station_id, plan_id))
    
    elif line_type in ['A', 'B', 'C']:
        # Assembly line - check if module should move to next station or be completed
        # This would require module-level tasks, which aren't fully implemented yet
        # For now, we'll leave this as a placeholder
        pass

def get_worker_current_task(worker_id):
    """Get the current active task for a worker."""
    db = get_db()
    
    # Check panel tasks first
    panel_task_cursor = db.execute("""
        SELECT ptl.panel_task_log_id, ptl.plan_id, ptl.panel_definition_id, 
               ptl.task_definition_id, ptl.status, ptl.started_at, ptl.station_start,
               td.name as task_name, pd.panel_code, pd.panel_group,
               mpp.project_name, mpp.house_identifier, mpp.module_number
        FROM PanelTaskLogs ptl
        JOIN TaskDefinitions td ON ptl.task_definition_id = td.task_definition_id
        JOIN PanelDefinitions pd ON ptl.panel_definition_id = pd.panel_definition_id
        JOIN ModuleProductionPlan mpp ON ptl.plan_id = mpp.plan_id
        WHERE ptl.worker_id = ? AND ptl.status IN ('In Progress', 'Paused')
        ORDER BY ptl.started_at DESC
        LIMIT 1
    """, (worker_id,))
    
    panel_task_row = panel_task_cursor.fetchone()
    if panel_task_row:
        task_dict = dict(panel_task_row)
        task_dict['task_type'] = 'panel'
        return task_dict
    
    # Check module tasks (if implemented)
    # TODO: Add module task checking when module tasks are implemented
    
    return None
