import sqlite3
from datetime import datetime, timedelta
import logging
from .connection import get_db

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
                # Handle cases where house_identifier might not be a simple integer string.
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
                    pass
    return max_house_num + 1

def generate_module_production_plan(project_name, house_type_id, number_of_houses):
    """
    Generates ModuleProductionPlan items in batch for a given project and house type.
    Infers modules_per_house from HouseTypes.
    House identifiers are auto-incremented based on existing houses for the project.
    planned_start_datetime auto-increments by 1 hour per module.
    Status defaults to 'Planned'. Sequence is appended.
    """
    db = get_db()
    items_to_add = []
    
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

    for i in range(number_of_houses):
        current_house_num_in_project = start_house_number_for_project + i
        house_identifier = str(current_house_num_in_project)

        for module_num in range(1, actual_modules_per_house + 1):
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
            current_planned_datetime += timedelta(hours=1)

    if items_to_add:
        try:
            add_bulk_module_production_plan_items(items_to_add)
            logging.info(f"Successfully generated {len(items_to_add)} plan items for project '{project_name}'.")
            return True
        except Exception as e:
            logging.error(f"Error generating bulk plan items for project '{project_name}': {e}", exc_info=True)
            raise e
    return True

def remove_planned_items_for_project_name(project_name):
    """Removes 'Planned' or 'Scheduled' ModuleProductionPlan items for a given project_name."""
    db = get_db()
    try:
        # Only remove items that haven't started progress (e.g., not 'Assembly', 'Completed')
        cursor = db.execute(
            "DELETE FROM ModuleProductionPlan WHERE project_name = ? AND status IN ('Planned', 'Panels', 'Magazine')",
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
        with db:
            db.executemany(sql, items_data)
        return True
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding bulk module production plan items (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error adding bulk module production plan items: {e}", exc_info=True)
        return False

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
        with db:
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
            td.task_dependencies, td.is_panel_task
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
            td.task_dependencies, td.is_panel_task
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
        return None

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

    if is_panel_task_filter is not None:
        conditions.append("td.is_panel_task = ?")
        params.append(is_panel_task_filter)

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)

    base_query += " ORDER BY td.station_sequence_order, td.name;"
    cursor = db.execute(base_query, params)
    potential_deps = cursor.fetchall()
    return [dict(row) for row in potential_deps]


# === Panel Definitions ===

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
        current_panel_cursor = db.execute("SELECT multiwall_id FROM PanelDefinitions WHERE panel_definition_id = ?", (panel_definition_id,))
        current_panel = current_panel_cursor.fetchone()
        if not current_panel:
            return False

        cursor = db.execute(
            """UPDATE PanelDefinitions SET
               panel_group = ?, panel_code = ?, sub_type_id = ?, multiwall_id = ?
               WHERE panel_definition_id = ?""",
            (panel_group, panel_code, sub_type_id, multiwall_id, panel_definition_id)
        )
        db.commit()

        if cursor.rowcount > 0:
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

def get_multiwalls_for_house_type_module(house_type_id, module_sequence_number=None):
    """Fetches all multiwalls for a specific house type."""
    db = get_db()
    query = """
        SELECT
            multiwall_id, house_type_id, panel_group, multiwall_code
        FROM Multiwalls
        WHERE house_type_id = ?
        ORDER BY panel_group, multiwall_code
    """
    # module_sequence_number is not in Multiwalls table
    cursor = db.execute(query, (house_type_id,))
    return [dict(row) for row in cursor.fetchall()]

def add_multiwall(house_type_id, panel_group, multiwall_code):
    """Adds a new multiwall."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group for multiwall: {panel_group}")

    try:
        cursor = db.execute(
            """INSERT INTO Multiwalls
               (house_type_id, panel_group, multiwall_code)
               VALUES (?, ?, ?)""",
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

def update_multiwall(multiwall_id, panel_group, multiwall_code):
    """Updates an existing multiwall's code or group."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group for multiwall: {panel_group}")

    try:
        with db:
            mw_cursor = db.execute("SELECT panel_group FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
            mw_current = mw_cursor.fetchone()
            if not mw_current:
                return False

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
                return False
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating multiwall (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error updating multiwall: {e}", exc_info=True)
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
        return False

# === Helper functions to get related data ===

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
        house_types_dict[ht_id]['sub_types'] = []

    param_query = """
        SELECT
            htp.house_type_id,
            htp.house_type_parameter_id, htp.parameter_id, htp.module_sequence_number,
            htp.sub_type_id, hst.name as sub_type_name,
            htp.value,
            hp.name as parameter_name, hp.unit as parameter_unit
        FROM HouseTypeParameters htp
        JOIN HouseParameters hp ON htp.parameter_id = hp.parameter_id
        LEFT JOIN HouseSubType hst ON htp.sub_type_id = hst.sub_type_id
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
        FROM HouseSubType
        ORDER BY house_type_id, name
    """
    sub_type_cursor = db.execute(sub_type_query)
    sub_types = sub_type_cursor.fetchall()

    for sub_type_row in sub_types:
        sub_type_dict = dict(sub_type_row)
        ht_id = sub_type_dict.pop('house_type_id')
        if ht_id in house_types_dict:
            house_types_dict[ht_id]['sub_types'].append(sub_type_dict)

    return list(house_types_dict.values())


def get_all_stations():
    """Fetches all stations."""
    db = get_db()
    cursor = db.execute("SELECT station_id, name, line_type, sequence_order FROM Stations ORDER BY sequence_order")
    return [dict(row) for row in cursor.fetchall()]


def _get_panels_with_status_for_plan(db, plan_id, house_type_id, module_number, module_plan_sub_type_id):
    """
    Helper to fetch panel definitions for a plan and determine their current task status from PanelTaskLogs.
    A panel's status is simplified to the status of its most 'active' task log.
    module_number is the module's sequence in the house (from ModuleProductionPlan.module_number).
    This is a simplification; a panel might have multiple tasks.
    """
    panel_defs_query = """
        SELECT pd.panel_definition_id, pd.panel_group, pd.panel_code
        FROM PanelDefinitions pd
        WHERE pd.house_type_id = ? AND pd.module_sequence_number = ?
          AND (pd.sub_type_id = ? OR pd.sub_type_id IS NULL)
        ORDER BY pd.panel_code 
    """
    params = [house_type_id, module_number, module_plan_sub_type_id]
    panel_defs_cursor = db.execute(panel_defs_query, params)
    panel_defs = [dict(row) for row in panel_defs_cursor.fetchall()]

    panels_with_status = []
    for pd in panel_defs:
        status_cursor = db.execute("""
            SELECT status FROM PanelTaskLogs
            WHERE plan_id = ? AND panel_definition_id = ?
            ORDER BY
                CASE status
                    WHEN 'In Progress' THEN 1
                    WHEN 'Paused' THEN 2
                    WHEN 'Not Started' THEN 3
                    WHEN 'Completed' THEN 4
                    ELSE 5
                END,
                completed_at DESC, started_at DESC
            LIMIT 1
        """, (plan_id, pd['panel_definition_id']))
        status_row = status_cursor.fetchone()
        current_panel_status = status_row['status'] if status_row else 'not_started'

        panels_with_status.append({
            'panel_id': pd['panel_definition_id'], # Keep 'panel_id' for frontend compatibility
            'panel_definition_id': pd['panel_definition_id'],
            'panel_code': pd['panel_code'],
            'panel_group': pd['panel_group'],
            'status': current_panel_status
        })
    return panels_with_status


# Helper for planned modules (no module_id yet)
def _get_panel_definitions_for_planned_module(db, plan_house_type_id, plan_module_number, plan_sub_type_id):
    """
    Fetches panel definitions for a planned module.
    All panels are assumed 'not_started'.
    plan_module_number is the module's sequence in the house.
    """
    panel_defs_query = """
        SELECT pd.panel_definition_id, pd.panel_group, pd.panel_code
        FROM PanelDefinitions pd
        WHERE pd.house_type_id = ? AND pd.module_sequence_number = ?
          AND (pd.sub_type_id = ? OR pd.sub_type_id IS NULL) -- Match specific sub_type or common panels
        ORDER BY pd.panel_code
    """
    params = [plan_house_type_id, plan_module_number, plan_sub_type_id]
    
    panel_defs_cursor = db.execute(panel_defs_query, params)
    panel_defs_rows = panel_defs_cursor.fetchall()

    defined_panels = []
    for pd_row in panel_defs_rows:
        defined_panels.append({
            'panel_id': pd_row['panel_definition_id'], # Keep 'panel_id' for frontend compatibility
            'panel_definition_id': pd_row['panel_definition_id'],
            'panel_code': pd_row['panel_code'],
            'panel_group': pd_row['panel_group'],
            'status': 'not_started' # For a planned module, panels are not started
        })
    return defined_panels


# === TaskLog Operations ===

def start_task_log(plan_id, task_definition_id, worker_id, station_start):
    """
    Starts a MODULE task (is_panel_task=0) by inserting a new record into TaskLogs using plan_id.
    Sets status to 'In Progress' and records the start time and station.
    """
    db = get_db()
    # Verify this task definition is NOT a panel task
    td_cursor = db.execute("SELECT is_panel_task FROM TaskDefinitions WHERE task_definition_id = ?", (task_definition_id,))
    td_data = td_cursor.fetchone()
    if not td_data or td_data['is_panel_task'] == 1:
        logging.error(f"Attempted to start task_definition_id {task_definition_id} in TaskLogs, but it's a panel task or does not exist.")
        raise ValueError("This task should be logged in PanelTaskLogs or task definition is invalid.")

    current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        cursor = db.execute(
            """INSERT INTO TaskLogs
               (plan_id, task_definition_id, worker_id, station_start, started_at, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, NULL)""",
            (plan_id, task_definition_id, worker_id, station_start, current_timestamp, 'In Progress')
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error starting task log (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error starting task log: {e}", exc_info=True)
        return None

def update_task_log_status(task_log_id, status, station_finish=None, notes=None):
    """Updates the status of a TaskLog. Sets completed_at if status is 'Completed'."""
    db = get_db()
    current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        if status == 'Completed':
            cursor = db.execute(
                "UPDATE TaskLogs SET status = ?, completed_at = ?, station_finish = ?, notes = ? WHERE task_log_id = ?",
                (status, current_timestamp, station_finish, notes, task_log_id)
            )
        else:
            cursor = db.execute(
                "UPDATE TaskLogs SET status = ?, notes = ? WHERE task_log_id = ?", # station_finish and completed_at not set if not 'Completed'
                (status, notes, task_log_id)
            )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating task log {task_log_id} status: {e}", exc_info=True)
        return False


# === PanelTaskLog Operations ===

def start_panel_task_log(plan_id, panel_definition_id, task_definition_id, worker_id, station_start):
    """
    Starts a PANEL task (is_panel_task=1) by inserting a new record into PanelTaskLogs using plan_id.
    Sets status to 'In Progress' and records the start time and station.
    """
    db = get_db()
    # Verify this task definition IS a panel task
    td_cursor = db.execute("SELECT is_panel_task FROM TaskDefinitions WHERE task_definition_id = ?", (task_definition_id,))
    td_data = td_cursor.fetchone()
    if not td_data or td_data['is_panel_task'] == 0:
        logging.error(f"Attempted to start task_definition_id {task_definition_id} in PanelTaskLogs, but it's not a panel task or does not exist.")
        raise ValueError("This task should be logged in TaskLogs or task definition is invalid.")

    current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        cursor = db.execute(
            """INSERT INTO PanelTaskLogs
               (plan_id, panel_definition_id, task_definition_id, worker_id, station_start, started_at, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL)""",
            (plan_id, panel_definition_id, task_definition_id, worker_id, station_start, current_timestamp, 'In Progress')
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        logging.error(f"Error starting panel task log (IntegrityError): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error starting panel task log: {e}", exc_info=True)
        return None

def update_panel_task_log_status(panel_task_log_id, status, station_finish=None, notes=None):
    """Updates the status of a PanelTaskLog. Sets completed_at if status is 'Completed'."""
    db = get_db()
    current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        if status == 'Completed':
            cursor = db.execute(
                "UPDATE PanelTaskLogs SET status = ?, completed_at = ?, station_finish = ?, notes = ? WHERE panel_task_log_id = ?",
                (status, current_timestamp, station_finish, notes, panel_task_log_id)
            )
        else:
            cursor = db.execute(
                "UPDATE PanelTaskLogs SET status = ?, notes = ? WHERE panel_task_log_id = ?",
                (status, notes, panel_task_log_id)
            )
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error updating panel task log {panel_task_log_id} status: {e}", exc_info=True)
        return False


# === Station Status and Upcoming Modules ===

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


# === House Types ===

def get_all_house_types():
    """Fetches all basic house types (ID and name). For detailed info, use get_all_house_types_with_details."""
    db = get_db()
    cursor = db.execute("SELECT house_type_id, name, description, number_of_modules FROM HouseTypes ORDER BY name")
    return [dict(row) for row in cursor.fetchall()]


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
    except sqlite3.IntegrityError as e:
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
    except sqlite3.Error as e:
        logging.error(f"Error deleting house type {house_type_id} (possibly due to existing plans/modules): {e}", exc_info=True)
        return False


# === House SubType ===

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
    except sqlite3.IntegrityError:
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

def get_parameters_for_house_type(house_type_id):
    """Fetches all parameters and their values for a specific house type, including module sequence and sub_type info."""
    db = get_db()
    query = """
        SELECT
            htp.house_type_parameter_id, htp.parameter_id, htp.module_sequence_number,
            htp.sub_type_id, hst.name as sub_type_name,
            htp.value,
            hp.name as parameter_name, hp.unit as parameter_unit
        FROM HouseTypeParameters htp
        JOIN HouseParameters hp ON htp.parameter_id = hp.parameter_id
        LEFT JOIN HouseSubType hst ON htp.sub_type_id = hst.sub_type_id
        WHERE htp.house_type_id = ?
        ORDER BY htp.module_sequence_number, hst.name, hp.name
    """
    cursor = db.execute(query, (house_type_id,))
    return [dict(row) for row in cursor.fetchall()]

def add_or_update_house_type_parameter(house_type_id, parameter_id, module_sequence_number, value, sub_type_id=None):
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

def delete_parameter_from_house_type_module_sub_type(house_type_id, parameter_id, module_sequence_number, sub_type_id=None):
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
    except sqlite3.IntegrityError as e:
        logging.error(f"Error adding worker (IntegrityError, possibly duplicate PIN): {e}", exc_info=True)
        raise e
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
    except sqlite3.IntegrityError as e:
        logging.error(f"Error updating worker (IntegrityError, possibly duplicate PIN): {e}", exc_info=True)
        raise e
    except sqlite3.Error as e:
        logging.error(f"Error updating worker: {e}", exc_info=True)
        return False

def delete_worker(worker_id):
    """Deletes a worker."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM Workers WHERE worker_id = ?", (worker_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        logging.error(f"Error deleting worker: {e}", exc_info=True)
        return False


def check_and_update_module_station_completion(plan_id, station_sequence_order):
    """
    Checks if all tasks for a module at a specific station are completed and updates status accordingly.
    Implements automatic station transitions and status updates according to production rules.
    """
    db = get_db()
    try:
        # Get the plan item to determine current status and assembly line
        plan_item = get_module_production_plan_item_by_id(plan_id)
        if not plan_item:
            logging.error(f"Plan ID {plan_id} not found for station completion check")
            return False

        # Check if all tasks for this station sequence are completed for this plan
        panel_tasks_incomplete_cursor = db.execute("""
            SELECT COUNT(*) as count FROM PanelTaskLogs ptl
            JOIN TaskDefinitions td ON ptl.task_definition_id = td.task_definition_id
            WHERE ptl.plan_id = ? AND td.station_sequence_order = ? AND ptl.status != 'Completed'
        """, (plan_id, station_sequence_order))
        panel_tasks_incomplete = panel_tasks_incomplete_cursor.fetchone()['count']

        module_tasks_incomplete_cursor = db.execute("""
            SELECT COUNT(*) as count FROM TaskLogs tl
            JOIN TaskDefinitions td ON tl.task_definition_id = td.task_definition_id
            WHERE tl.plan_id = ? AND td.station_sequence_order = ? AND tl.status != 'Completed'
        """, (plan_id, station_sequence_order))
        module_tasks_incomplete = module_tasks_incomplete_cursor.fetchone()['count']

        # If there are still incomplete tasks, don't proceed with station transition
        if panel_tasks_incomplete > 0 or module_tasks_incomplete > 0:
            logging.info(f"Plan {plan_id} still has incomplete tasks at station sequence {station_sequence_order}")
            return True

        # All tasks are complete for this station - implement status transitions
        current_status = plan_item['status']
        new_status = current_status

        # Implement the production flow rules
        if station_sequence_order <= 5:  # Panel line stations (W1-W5)
            if current_status == 'Panels':
                new_status = 'Magazine'
                logging.info(f"Moving plan {plan_id} from Panels to Magazine after completing W station tasks")

        elif station_sequence_order == 6:  # Magazine (M1)
            if current_status == 'Magazine':
                new_status = 'Assembly'
                logging.info(f"Moving plan {plan_id} from Magazine to Assembly after completing Magazine tasks")

        elif station_sequence_order >= 7:  # Assembly line stations (A1-A6, B1-B6, C1-C6)
            if current_status == 'Assembly':
                # Check if this is the last assembly station (sequence 12)
                if station_sequence_order == 12:
                    new_status = 'Completed'
                    logging.info(f"Completing plan {plan_id} after finishing final assembly station tasks")
                    
                    # Mark all panels as 'Consumed' when module is completed
                    db.execute("""
                        UPDATE PanelTaskLogs SET status = 'Consumed' 
                        WHERE plan_id = ? AND status = 'Completed'
                    """, (plan_id,))
                    logging.info(f"Marked all panels as 'Consumed' for completed plan {plan_id}")

        # Update the status if it changed
        if new_status != current_status:
            update_success = update_module_production_plan_item(plan_id, {'status': new_status})
            if update_success:
                logging.info(f"Successfully updated plan {plan_id} status from {current_status} to {new_status}")
            else:
                logging.error(f"Failed to update plan {plan_id} status from {current_status} to {new_status}")
                return False

        return True

    except sqlite3.Error as e:
        logging.error(f"Database error in check_and_update_module_station_completion: {e}", exc_info=True)
        return False
    except Exception as e:
        logging.error(f"Error in check_and_update_module_station_completion: {e}", exc_info=True)
        return False


