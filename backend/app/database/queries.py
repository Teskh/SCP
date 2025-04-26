import sqlite3
import sqlite3
from .connection import get_db

# === Projects ===

def get_all_projects():
    """Fetches all projects with their associated house types and quantities."""
    db = get_db()
    projects_cursor = db.execute(
        "SELECT project_id, name, description, status FROM Projects ORDER BY name"
    )
    projects_list = [dict(row) for row in projects_cursor.fetchall()]
    projects_dict = {p['project_id']: p for p in projects_list}

    # Fetch associated house types (ProjectModules)
    modules_query = """
        SELECT
            pm.project_id, pm.house_type_id, pm.quantity,
            ht.name as house_type_name
        FROM ProjectModules pm
        JOIN HouseTypes ht ON pm.house_type_id = ht.house_type_id
        ORDER BY pm.project_id, ht.name
    """
    modules_cursor = db.execute(modules_query)
    project_modules = modules_cursor.fetchall()

    # Group modules by project_id
    for p_id in projects_dict:
        projects_dict[p_id]['house_types'] = [] # Initialize list

    for module_row in project_modules:
        module_dict = dict(module_row)
        p_id = module_dict['project_id']
        if p_id in projects_dict:
            # Remove redundant project_id before appending
            del module_dict['project_id']
            projects_dict[p_id]['house_types'].append(module_dict)

    return list(projects_dict.values())

def get_project_by_id(project_id):
    """Fetches a single project by its ID, including house types."""
    db = get_db()
    project_cursor = db.execute(
        "SELECT project_id, name, description, status FROM Projects WHERE project_id = ?",
        (project_id,)
    )
    project = project_cursor.fetchone()
    if not project:
        return None

    project_dict = dict(project)

    # Fetch associated house types
    modules_query = """
        SELECT
            pm.house_type_id, pm.quantity,
            ht.name as house_type_name
        FROM ProjectModules pm
        JOIN HouseTypes ht ON pm.house_type_id = ht.house_type_id
        WHERE pm.project_id = ?
        ORDER BY ht.name
    """
    modules_cursor = db.execute(modules_query, (project_id,))
    project_dict['house_types'] = [dict(row) for row in modules_cursor.fetchall()]

    return project_dict

def add_project(name, description, status, house_types_data):
    """Adds a new project and its associated house types."""
    db = get_db()
    try:
        # Start transaction
        with db:
            # Insert project
            project_cursor = db.execute(
                "INSERT INTO Projects (name, description, status) VALUES (?, ?, ?)",
                (name, description, status)
            )
            project_id = project_cursor.lastrowid

            # Insert associated house types (ProjectModules)
            if house_types_data:
                project_modules_data = [
                    (project_id, ht['house_type_id'], ht['quantity'])
                    for ht in house_types_data if ht.get('house_type_id') and ht.get('quantity')
                ]
                if project_modules_data:
                    db.executemany(
                        "INSERT INTO ProjectModules (project_id, house_type_id, quantity) VALUES (?, ?, ?)",
                        project_modules_data
                    )

            # --- Handle Production Plan Generation if status is 'Active' ---
            if status == 'Active':
                print(f"Project {project_id} created as Active. Generating production plan...")
                # Fetch details needed for generation (including house type names and number of modules)
                # Need to query within the same transaction context 'db'
                details_query = """
                    SELECT pm.house_type_id, pm.quantity, ht.name as house_type_name, ht.number_of_modules
                    FROM ProjectModules pm
                    JOIN HouseTypes ht ON pm.house_type_id = ht.house_type_id
                    WHERE pm.project_id = ?
                """
                details_cursor = db.execute(details_query, (project_id,))
                house_types_details = [dict(row) for row in details_cursor.fetchall()]

                if not generate_production_plan_for_project(project_id, name, house_types_details):
                    # If generation fails, raise an exception to trigger rollback
                    raise Exception(f"Failed to generate production plan for newly added project {project_id}. Rolling back.")

        return project_id # Return the ID of the newly created project
    except sqlite3.IntegrityError as e:
        # Handle potential unique constraint violation (e.g., duplicate name)
        print(f"Error adding project (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise to be caught by API layer
    except Exception as e: # Catch generation errors too
        print(f"Error adding project: {e}") # Replace with logging
        # Transaction ensures rollback on error
        return None

def update_project(project_id, name, description, status, house_types_data):
    """Updates an existing project and its associated house types."""
    db = get_db()
    try:
        with db: # Use transaction
            # Update project details
            update_cursor = db.execute(
                "UPDATE Projects SET name = ?, description = ?, status = ? WHERE project_id = ?",
                (name, description, status, project_id)
            )
            if update_cursor.rowcount == 0:
                return False # Project not found

            # --- Update ProjectModules ---
            # 1. Delete existing ProjectModules for this project
            db.execute("DELETE FROM ProjectModules WHERE project_id = ?", (project_id,))

            # 2. Insert new ProjectModules based on house_types_data
            if house_types_data:
                project_modules_data = [
                    (project_id, ht['house_type_id'], ht['quantity'])
                    for ht in house_types_data if ht.get('house_type_id') and ht.get('quantity')
                ]
                if project_modules_data:
                    db.executemany(
                        "INSERT INTO ProjectModules (project_id, house_type_id, quantity) VALUES (?, ?, ?)",
                        project_modules_data
                    )
        return True # Success
    except sqlite3.IntegrityError as e:
        print(f"Error updating project (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise
    except sqlite3.Error as e:
        print(f"Error updating project: {e}") # Replace with logging
        return False

from datetime import datetime, timedelta # Add imports for date calculation

def update_project(project_id, name, description, status, house_types_data):
    """Updates an existing project and its associated house types.
       Handles automatic generation/removal of production plan items based on status change.
    """
    db = get_db()
    # Get current status before update
    current_status_cursor = db.execute("SELECT status FROM Projects WHERE project_id = ?", (project_id,))
    current_status_row = current_status_cursor.fetchone()
    current_status = current_status_row['status'] if current_status_row else None

    try:
        with db: # Use transaction
            # Update project details
            update_cursor = db.execute(
                "UPDATE Projects SET name = ?, description = ?, status = ? WHERE project_id = ?",
                (name, description, status, project_id)
            )
            if update_cursor.rowcount == 0:
                print(f"Project {project_id} not found for update.")
                return False # Project not found

            # --- Update ProjectModules ---
            # 1. Delete existing ProjectModules for this project
            db.execute("DELETE FROM ProjectModules WHERE project_id = ?", (project_id,))

            # 2. Insert new ProjectModules based on house_types_data
            project_modules_data = []
            if house_types_data:
                project_modules_data = [
                    (project_id, ht['house_type_id'], ht['quantity'])
                    for ht in house_types_data if ht.get('house_type_id') and ht.get('quantity')
                ]
                if project_modules_data:
                    db.executemany(
                        "INSERT INTO ProjectModules (project_id, house_type_id, quantity) VALUES (?, ?, ?)",
                        project_modules_data
                    )

            # --- Handle Production Plan Generation/Removal ---
            if current_status != 'Active' and status == 'Active':
                # Project is being activated - Generate plan items
                print(f"Project {project_id} activated. Generating production plan...")
                # Fetch details needed for generation (including house type names and number of modules)
                details_query = """
                    SELECT pm.house_type_id, pm.quantity, ht.name as house_type_name, ht.number_of_modules
                    FROM ProjectModules pm
                    JOIN HouseTypes ht ON pm.house_type_id = ht.house_type_id
                    WHERE pm.project_id = ?
                """
                details_cursor = db.execute(details_query, (project_id,))
                house_types_details = [dict(row) for row in details_cursor.fetchall()]
                if not generate_production_plan_for_project(project_id, name, house_types_details):
                    # If generation fails, we should ideally roll back the transaction.
                    # The `with db:` block handles this automatically by not committing if an exception occurs.
                    raise Exception(f"Failed to generate production plan for project {project_id}. Rolling back.") # Raise exception to trigger rollback

            elif current_status == 'Active' and status != 'Active':
                # Project is being deactivated - Remove planned items
                print(f"Project {project_id} deactivated. Removing planned/scheduled items...")
                if not remove_planned_items_for_project(project_id):
                     raise Exception(f"Failed to remove production plan items for project {project_id}. Rolling back.")

        return True # Success - transaction committed
    except sqlite3.IntegrityError as e:
        print(f"Error updating project (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise
    except Exception as e: # Catch generation/removal errors too
        print(f"Error updating project: {e}") # Replace with logging
        # Transaction ensures rollback on error
        return False


def delete_project(project_id):
    """Deletes a project. Cascading delete handles ProjectModules."""
    db = get_db()
    try:
        # Cascading delete in schema handles ProjectModules and ProductionPlan items
        cursor = db.execute("DELETE FROM Projects WHERE project_id = ?", (project_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        # Handle potential foreign key issues if project_id is used elsewhere without CASCADE
        print(f"Error deleting project: {e}") # Replace with logging
        return False

# === Production Plan Generation Helpers ===

def get_max_planned_sequence():
    """Gets the maximum planned_sequence value from the ProductionPlan table."""
    db = get_db()
    cursor = db.execute("SELECT MAX(planned_sequence) FROM ProductionPlan")
    max_seq = cursor.fetchone()[0]
    return max_seq if max_seq is not None else 0

def generate_production_plan_for_project(project_id, project_name, house_types_details):
    """Generates ProductionPlan items (one per module) for a newly activated project."""
    db = get_db()
    items_to_add = []
    current_sequence = get_max_planned_sequence() + 1
    assembly_lines = ['A', 'B', 'C']
    line_index = 0
    start_datetime_base = datetime.now() # Base time for planning

    for ht_detail in house_types_details:
        house_type_id = ht_detail['house_type_id']
        quantity = ht_detail['quantity']
        house_type_name = ht_detail['house_type_name']
        number_of_modules = ht_detail['number_of_modules'] # Fetch number of modules

        for i in range(quantity): # For each house instance
            house_base_identifier = f"{project_name}-{house_type_name}-{i+1}" # Identifier for the house

            for module_seq in range(1, number_of_modules + 1): # For each module within the house
                # Identifier could include module sequence, e.g., "ProjectX-TypeA-1-M1"
                # Or keep house_identifier the same and rely on module_sequence_in_house column
                house_identifier = house_base_identifier # Using house identifier, module sequence is separate column

                planned_assembly_line = assembly_lines[line_index % len(assembly_lines)]

                # Simple date increment logic (e.g., add 8 hours per module) - ADJUST AS NEEDED
                planned_start_dt = start_datetime_base + timedelta(hours=(current_sequence - (get_max_planned_sequence() + 1)) * 8)
                planned_start_datetime_str = planned_start_dt.strftime('%Y-%m-%d %H:%M:%S')

                items_to_add.append((
                    project_id,
                    house_type_id,
                    house_identifier,
                    module_seq, # Add module_sequence_in_house
                    current_sequence,
                    planned_start_datetime_str,
                    planned_assembly_line,
                    'Planned' # Default status
                ))
                current_sequence += 1
                line_index += 1 # Alternate line per module

    if items_to_add:
        try:
            add_bulk_production_plan_items(items_to_add)
            print(f"Successfully generated {len(items_to_add)} plan items for project {project_id}.") # Replace with logging
            return True
        except Exception as e:
            print(f"Error generating bulk plan items for project {project_id}: {e}") # Replace with logging
            # Consider rollback or cleanup if partial insertion occurred? Transaction handles this.
            return False
    return True # No items needed, still success

def remove_planned_items_for_project(project_id):
    """Removes 'Planned' or 'Scheduled' ProductionPlan items for a deactivated project."""
    db = get_db()
    try:
        # Only remove items that haven't started progress
        cursor = db.execute(
            "DELETE FROM ProductionPlan WHERE project_id = ? AND status IN ('Planned', 'Scheduled')",
            (project_id,)
        )
        db.commit()
        print(f"Removed {cursor.rowcount} planned/scheduled items for deactivated project {project_id}.") # Replace with logging
        return True
    except sqlite3.Error as e:
        print(f"Error removing planned items for project {project_id}: {e}") # Replace with logging
        return False


# === Specialties ===

def get_all_specialties():
    """Fetches all specialties from the database."""
    db = get_db()
    cursor = db.execute("SELECT specialty_id, name, description FROM Specialties ORDER BY name")
    specialties = cursor.fetchall()
    return [dict(row) for row in specialties] # Convert Row objects to dicts

def add_specialty(name, description):
    """Adds a new specialty to the database."""
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO Specialties (name, description) VALUES (?, ?)",
            (name, description)
        )
        db.commit()
        return cursor.lastrowid # Return the ID of the newly inserted row
    except sqlite3.IntegrityError:
        # Handle potential unique constraint violation (e.g., duplicate name)
        return None # Or raise a custom exception

def update_specialty(specialty_id, name, description):
    """Updates an existing specialty."""
    db = get_db()
    cursor = db.execute(
        "UPDATE Specialties SET name = ?, description = ? WHERE specialty_id = ?",
        (name, description, specialty_id)
    )
    db.commit()
    return cursor.rowcount > 0 # Return True if a row was updated, False otherwise

def delete_specialty(specialty_id):
    """Deletes a specialty."""
    db = get_db()
    cursor = db.execute("DELETE FROM Specialties WHERE specialty_id = ?", (specialty_id,))
    db.commit()
    return cursor.rowcount > 0 # Return True if a row was deleted

# === Task Definitions ===

def get_all_task_definitions():
    """Fetches all task definitions from the database."""
    db = get_db()
    # Join with other tables to get names instead of just IDs
    query = """
        SELECT
            td.task_definition_id, td.name, td.description,
            ht.name as house_type_name,
            sp.name as specialty_name,
            st.name as station_name,
            td.house_type_id, td.specialty_id, td.station_id
        FROM TaskDefinitions td
        LEFT JOIN HouseTypes ht ON td.house_type_id = ht.house_type_id
        LEFT JOIN Specialties sp ON td.specialty_id = sp.specialty_id
        LEFT JOIN Stations st ON td.station_id = st.station_id
        ORDER BY td.name
    """
    cursor = db.execute(query)
    task_defs = cursor.fetchall()
    return [dict(row) for row in task_defs]

def add_task_definition(name, description, house_type_id, specialty_id, station_id):
    """Adds a new task definition."""
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO TaskDefinitions
               (name, description, house_type_id, specialty_id, station_id)
               VALUES (?, ?, ?, ?, ?)""",
            (name, description, house_type_id, specialty_id, station_id)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None # Or raise

def update_task_definition(task_definition_id, name, description, house_type_id, specialty_id, station_id):
    """Updates an existing task definition."""
    db = get_db()
    cursor = db.execute(
        """UPDATE TaskDefinitions SET
           name = ?, description = ?, house_type_id = ?, specialty_id = ?, station_id = ?
           WHERE task_definition_id = ?""",
        (name, description, house_type_id, specialty_id, station_id, task_definition_id)
    )
    db.commit()
    return cursor.rowcount > 0

# === House Type Panels ===

def get_panels_for_house_type_module(house_type_id, module_sequence_number):
    """Fetches all panels for a specific module within a house type, including multiwall info."""
    db = get_db()
    query = """
        SELECT
            htp.house_type_panel_id, htp.panel_group, htp.panel_code, htp.typology,
            htp.multiwall_id, mw.multiwall_code
        FROM HouseTypePanels htp
        LEFT JOIN Multiwalls mw ON htp.multiwall_id = mw.multiwall_id
        WHERE htp.house_type_id = ? AND htp.module_sequence_number = ?
        ORDER BY htp.panel_group, mw.multiwall_code, htp.panel_code -- Order by group, then multiwall, then panel
    """
    cursor = db.execute(query, (house_type_id, module_sequence_number))
    return [dict(row) for row in cursor.fetchall()]

def add_panel_to_house_type_module(house_type_id, module_sequence_number, panel_group, panel_code, typology, multiwall_id=None):
    """Adds a new panel to a specific module within a house type."""
    db = get_db()
    # Validate panel_group
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group: {panel_group}")

    # Optional: Validate that if multiwall_id is provided, its panel_group matches the panel's panel_group
    if multiwall_id:
        mw_cursor = db.execute("SELECT panel_group FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
        mw_row = mw_cursor.fetchone()
        if not mw_row or mw_row['panel_group'] != panel_group:
             raise ValueError("Panel group must match the assigned multiwall's group.")

    try:
        cursor = db.execute(
            """INSERT INTO HouseTypePanels
               (house_type_id, module_sequence_number, panel_group, panel_code, typology, multiwall_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (house_type_id, module_sequence_number, panel_group, panel_code, typology if typology else None, multiwall_id)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        # Could be UNIQUE constraint violation or CHECK constraint
        print(f"Error adding panel (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise
    except sqlite3.Error as e:
        print(f"Error adding panel: {e}") # Replace with logging
        return None

def update_panel_for_house_type_module(house_type_panel_id, panel_group, panel_code, typology, multiwall_id=None):
    """Updates an existing panel."""
    db = get_db()
    # Validate panel_group
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group: {panel_group}")

    # Optional: Validate that if multiwall_id is provided, its panel_group matches the panel's panel_group
    if multiwall_id:
        mw_cursor = db.execute("SELECT panel_group FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
        mw_row = mw_cursor.fetchone()
        # If multiwall exists, its group must match the new panel group
        if mw_row and mw_row['panel_group'] != panel_group:
             raise ValueError("Panel group must match the assigned multiwall's group.")
        # If multiwall_id is provided but doesn't exist, should we error or just set NULL? Let's error for now.
        elif not mw_row:
             raise ValueError(f"Assigned multiwall_id {multiwall_id} does not exist.")


    try:
        cursor = db.execute(
            """UPDATE HouseTypePanels SET
               panel_group = ?, panel_code = ?, typology = ?, multiwall_id = ?
               WHERE house_type_panel_id = ?""",
            (panel_group, panel_code, typology if typology else None, multiwall_id, house_type_panel_id)
        )
        db.commit()
        # Check if the update affected any rows
        if cursor.rowcount > 0:
            # Also, update the panel_group of associated panels if the group changed
            # Fetch the panels associated with this multiwall
            panels_cursor = db.execute("SELECT house_type_panel_id FROM HouseTypePanels WHERE multiwall_id = ?", (multiwall_id,))
            panel_ids = [row['house_type_panel_id'] for row in panels_cursor.fetchall()]
            if panel_ids:
                 # Update panel_group for associated panels
                 # Use executemany for potentially better performance if many panels
                 update_panels_query = "UPDATE HouseTypePanels SET panel_group = ? WHERE house_type_panel_id = ?"
                 db.executemany(update_panels_query, [(panel_group, pid) for pid in panel_ids])
                 db.commit()
            return True
        else:
            return False # Multiwall not found
    except sqlite3.IntegrityError as e:
        print(f"Error updating panel (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise
    except sqlite3.Error as e:
        print(f"Error updating panel: {e}") # Replace with logging
        return False

def delete_panel_from_house_type_module(house_type_panel_id):
    """Deletes a panel by its ID."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM HouseTypePanels WHERE house_type_panel_id = ?", (house_type_panel_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        print(f"Error deleting panel: {e}") # Replace with logging
        return False

# === Multiwalls ===

def get_multiwalls_for_house_type_module(house_type_id, module_sequence_number):
    """Fetches all multiwalls for a specific module within a house type."""
    db = get_db()
    query = """
        SELECT
            multiwall_id, panel_group, multiwall_code
        FROM Multiwalls
        WHERE house_type_id = ? AND module_sequence_number = ?
        ORDER BY panel_group, multiwall_code
    """
    cursor = db.execute(query, (house_type_id, module_sequence_number))
    return [dict(row) for row in cursor.fetchall()]

def add_multiwall(house_type_id, module_sequence_number, panel_group, multiwall_code):
    """Adds a new multiwall."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group for multiwall: {panel_group}")

    try:
        cursor = db.execute(
            """INSERT INTO Multiwalls
               (house_type_id, module_sequence_number, panel_group, multiwall_code)
               VALUES (?, ?, ?, ?)""",
            (house_type_id, module_sequence_number, panel_group, multiwall_code)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        print(f"Error adding multiwall (IntegrityError): {e}")
        raise e
    except sqlite3.Error as e:
        print(f"Error adding multiwall: {e}")
        return None

def update_multiwall(multiwall_id, panel_group, multiwall_code):
    """Updates an existing multiwall."""
    db = get_db()
    allowed_groups = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros']
    if panel_group not in allowed_groups:
        raise ValueError(f"Invalid panel_group for multiwall: {panel_group}")

    try:
        cursor = db.execute(
            """UPDATE Multiwalls SET
               panel_group = ?, multiwall_code = ?
               WHERE multiwall_id = ?""",
            (panel_group, multiwall_code, multiwall_id)
        )
        db.commit()
        # Check if the update affected any rows
        if cursor.rowcount > 0:
            # Also, update the panel_group of associated panels if the group changed
            # Fetch the panels associated with this multiwall
            panels_cursor = db.execute("SELECT house_type_panel_id FROM HouseTypePanels WHERE multiwall_id = ?", (multiwall_id,))
            panel_ids = [row['house_type_panel_id'] for row in panels_cursor.fetchall()]
            if panel_ids:
                 # Update panel_group for associated panels
                 # Use executemany for potentially better performance if many panels
                 update_panels_query = "UPDATE HouseTypePanels SET panel_group = ? WHERE house_type_panel_id = ?"
                 db.executemany(update_panels_query, [(panel_group, pid) for pid in panel_ids])
                 db.commit()
            return True
        else:
            return False # Multiwall not found
    except sqlite3.IntegrityError as e:
        print(f"Error updating multiwall (IntegrityError): {e}")
        raise e
    except sqlite3.Error as e:
        print(f"Error updating multiwall: {e}")
        return False

def delete_multiwall(multiwall_id):
    """Deletes a multiwall. Associated panels will have multiwall_id set to NULL due to FK constraint."""
    db = get_db()
    try:
        # The ON DELETE SET NULL constraint handles unlinking panels automatically
        cursor = db.execute("DELETE FROM Multiwalls WHERE multiwall_id = ?", (multiwall_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        print(f"Error deleting multiwall: {e}")
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
    # Validate role before inserting
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
        # Handle potential unique constraint violation (e.g., duplicate PIN)
        print(f"Error adding admin team member (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise to be caught by the API layer
    except sqlite3.Error as e:
        print(f"Error adding admin team member: {e}") # Replace with logging
        return None

def update_admin_team_member(admin_team_id, first_name, last_name, role, pin, is_active):
    """Updates an existing member in the팀 table."""
    db = get_db()
    # Validate role before updating
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
        print(f"Error updating admin team member (IntegrityError): {e}") # Replace with logging
        raise e # Re-raise
    except sqlite3.Error as e:
        print(f"Error updating admin team member: {e}") # Replace with logging
        return False

def delete_admin_team_member(admin_team_id):
    """Deletes a member from the AdminTeam table."""
    db = get_db()
    try:
        cursor = db.execute("DELETE FROM AdminTeam WHERE admin_team_id = ?", (admin_team_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        print(f"Error deleting admin team member: {e}") # Replace with logging
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


def delete_task_definition(task_definition_id):
    """Deletes a task definition."""
    db = get_db()
    cursor = db.execute("DELETE FROM TaskDefinitions WHERE task_definition_id = ?", (task_definition_id,))
    db.commit()
    return cursor.rowcount > 0

# === Helper functions to get related data (for dropdowns etc.) ===

def get_all_house_types():
    """
    Fetches all house types, including their associated parameters grouped by house type.
    """
    db = get_db()
    # Fetch basic house type info
    cursor = db.execute("SELECT house_type_id, name, description, number_of_modules FROM HouseTypes ORDER BY name")
    house_types_list = [dict(row) for row in cursor.fetchall()]
    house_types_dict = {ht['house_type_id']: ht for ht in house_types_list}

    # Fetch all parameters linked to house types
    param_query = """
        SELECT
            htp.house_type_parameter_id, htp.parameter_id, htp.module_sequence_number, htp.value,
            hp.name as parameter_name, hp.unit as parameter_unit
        FROM HouseTypeParameters htp
        JOIN HouseParameters hp ON htp.parameter_id = hp.parameter_id
        ORDER BY htp.house_type_id, htp.module_sequence_number, hp.name
    """
    cursor = db.execute(param_query)
    parameters = cursor.fetchall()

    # Group parameters by house_type_id
    for ht_id in house_types_dict:
        house_types_dict[ht_id]['parameters'] = [] # Initialize parameters list

    for param_row in parameters:
        param_dict = dict(param_row)
        ht_id = param_dict['house_type_id']
        if ht_id in house_types_dict:
            # Remove redundant house_type_id from the parameter dict before appending
            del param_dict['house_type_id']
            house_types_dict[ht_id]['parameters'].append(param_dict)

    # Return the list of house type dictionaries, now including parameters
    return list(house_types_dict.values())

def get_all_stations():
    """Fetches all stations for dropdowns."""
    db = get_db()
    # Order by sequence for logical flow in dropdowns
    cursor = db.execute("SELECT station_id, name FROM Stations ORDER BY sequence_order")
    return [dict(row) for row in cursor.fetchall()]


# === Workers ===

def get_all_workers():
    """Fetches all workers with their specialty name and supervisor name."""
    db = get_db()
    # Use LEFT JOINs in case specialty or supervisor is NULL
    # Use aliases for the self-join on Workers table for supervisor
    query = """
        SELECT
            w.worker_id, w.first_name, w.last_name, w.pin, w.is_active,
            w.specialty_id, s.name as specialty_name,
            w.supervisor_id, sup.first_name as supervisor_first_name, sup.last_name as supervisor_last_name
        FROM Workers w
        LEFT JOIN Specialties s ON w.specialty_id = s.specialty_id
        LEFT JOIN Workers sup ON w.supervisor_id = sup.worker_id
        ORDER BY w.last_name, w.first_name
    """
    cursor = db.execute(query)
    workers = cursor.fetchall()
    # Combine supervisor first and last names
    result = []
    for row in workers:
        worker_dict = dict(row)
        if worker_dict['supervisor_first_name'] and worker_dict['supervisor_last_name']:
            worker_dict['supervisor_name'] = f"{worker_dict['supervisor_first_name']} {worker_dict['supervisor_last_name']}"
        else:
            worker_dict['supervisor_name'] = None
        # Remove redundant supervisor name fields if desired
        # del worker_dict['supervisor_first_name']
        # del worker_dict['supervisor_last_name']
        result.append(worker_dict)
    return result


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
    except sqlite3.Error as e:
        # Log error or handle specific constraints (e.g., unique PIN if added)
        print(f"Error adding worker: {e}") # Replace with proper logging
        return None # Or raise

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
    except sqlite3.Error as e:
        print(f"Error updating worker: {e}") # Replace with proper logging
        return False # Indicate failure

def delete_worker(worker_id):
    """Deletes a worker."""
    # Consider implications: What happens to supervised workers? Set supervisor_id to NULL?
    # For now, simple delete. Add constraints or logic as needed.
    db = get_db()
    try:
        # Optional: Set supervisor_id to NULL for workers supervised by the one being deleted
        # db.execute("UPDATE Workers SET supervisor_id = NULL WHERE supervisor_id = ?", (worker_id,))

        cursor = db.execute("DELETE FROM Workers WHERE worker_id = ?", (worker_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        # Handle potential foreign key issues if worker_id is used elsewhere (e.g., TaskLogs)
        print(f"Error deleting worker: {e}") # Replace with proper logging
        return False # Indicate failure


# === Production Plan ===

def add_production_plan_item(project_id, house_type_id, house_identifier, planned_sequence, planned_start_datetime, planned_assembly_line, status='Planned'):
    """Adds a single item to the production plan."""
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO ProductionPlan
               (project_id, house_type_id, house_identifier, planned_sequence, planned_start_datetime, planned_assembly_line, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (project_id, house_type_id, house_identifier, planned_sequence, planned_start_datetime, planned_assembly_line, status)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError as e:
        print(f"Error adding production plan item (IntegrityError): {e}")
        raise e # Re-raise for API layer to handle (e.g., duplicate identifier)
    except sqlite3.Error as e:
        print(f"Error adding production plan item: {e}")
        return None

def add_bulk_production_plan_items(items_data):
    """Adds multiple items to the production plan using executemany."""
    db = get_db()
    # items_data should be a list of tuples/lists matching the order of columns in the INSERT statement
    # e.g., [(proj_id, ht_id, identifier, module_seq, planned_seq, start_dt, line, status), ...]
    sql = """INSERT INTO ProductionPlan
             (project_id, house_type_id, house_identifier, module_sequence_in_house, planned_sequence, planned_start_datetime, planned_assembly_line, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)""" # Added module_sequence_in_house
    try:
        with db: # Use transaction
            db.executemany(sql, items_data)
        return True # Indicate success (doesn't return IDs easily with executemany)
    except sqlite3.IntegrityError as e:
        print(f"Error adding bulk production plan items (IntegrityError): {e}")
        raise e # Re-raise
    except sqlite3.Error as e:
        print(f"Error adding bulk production plan items: {e}")
        return False

def get_production_plan(filters=None, sort_by='planned_sequence', sort_order='ASC', limit=None, offset=None):
    """Fetches production plan items with optional filtering, sorting, and pagination."""
    db = get_db()
    base_query = """
        SELECT
            pp.plan_id, pp.project_id, p.name as project_name,
            pp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            pp.house_identifier, pp.module_sequence_in_house, -- Added module sequence
            pp.planned_sequence, pp.planned_start_datetime,
            pp.planned_assembly_line, pp.status, pp.created_at, pp.updated_at
        FROM ProductionPlan pp
        JOIN Projects p ON pp.project_id = p.project_id
        JOIN HouseTypes ht ON pp.house_type_id = ht.house_type_id
    """
    where_clauses = []
    params = []

    if filters:
        if filters.get('project_id'):
            where_clauses.append("pp.project_id = ?")
            params.append(filters['project_id'])
        if filters.get('house_type_id'):
            where_clauses.append("pp.house_type_id = ?")
            params.append(filters['house_type_id'])
        if filters.get('status'):
            # Handle multiple statuses if needed (e.g., status='Planned,Scheduled')
            statuses = filters['status'].split(',')
            placeholders = ','.join('?' * len(statuses))
            where_clauses.append(f"pp.status IN ({placeholders})")
            params.extend(statuses)
        if filters.get('start_date_after'): # Example filter
            where_clauses.append("pp.planned_start_datetime >= ?")
            params.append(filters['start_date_after'])
        # Add more filters as needed

    if where_clauses:
        base_query += " WHERE " + " AND ".join(where_clauses)

    # Validate sort_by and sort_order to prevent SQL injection
    allowed_sort_columns = ['plan_id', 'project_name', 'house_type_name', 'house_identifier', 'planned_sequence', 'planned_start_datetime', 'planned_assembly_line', 'status', 'created_at', 'updated_at']
    if sort_by not in allowed_sort_columns:
        sort_by = 'planned_sequence' # Default sort
    if sort_order.upper() not in ['ASC', 'DESC']:
        sort_order = 'ASC'

    base_query += f" ORDER BY {sort_by} {sort_order}"

    if limit is not None:
        base_query += " LIMIT ?"
        params.append(limit)
        if offset is not None:
            base_query += " OFFSET ?"
            params.append(offset)

    cursor = db.execute(base_query, params)
    return [dict(row) for row in cursor.fetchall()]

def get_production_plan_item_by_id(plan_id):
    """Fetches a single production plan item by its ID."""
    db = get_db()
    query = """
        SELECT
            pp.plan_id, pp.project_id, p.name as project_name,
            pp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            pp.house_identifier, pp.module_sequence_in_house, -- Added module sequence
            pp.planned_sequence, pp.planned_start_datetime,
            pp.planned_assembly_line, pp.status, pp.created_at, pp.updated_at
        FROM ProductionPlan pp
        JOIN Projects p ON pp.project_id = p.project_id
        JOIN HouseTypes ht ON pp.house_type_id = ht.house_type_id
        WHERE pp.plan_id = ?
    """
    cursor = db.execute(query, (plan_id,))
    row = cursor.fetchone()
    return dict(row) if row else None

def update_production_plan_item(plan_id, updates):
    """Updates specific fields of a production plan item."""
    db = get_db()
    allowed_fields = ['project_id', 'house_type_id', 'house_identifier', 'planned_sequence', 'planned_start_datetime', 'planned_assembly_line', 'status']
    set_clauses = []
    params = []

    for field, value in updates.items():
        if field in allowed_fields:
            set_clauses.append(f"{field} = ?")
            params.append(value)

    if not set_clauses:
        return False # Nothing to update

    # Add updated_at timestamp automatically? Requires schema trigger or manual update here.
    # set_clauses.append("updated_at = CURRENT_TIMESTAMP") # If not using triggers

    sql = f"UPDATE ProductionPlan SET {', '.join(set_clauses)} WHERE plan_id = ?"
    params.append(plan_id)

    try:
        cursor = db.execute(sql, params)
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.IntegrityError as e:
        print(f"Error updating production plan item (IntegrityError): {e}")
        raise e
    except sqlite3.Error as e:
        print(f"Error updating production plan item: {e}")
        return False

def delete_production_plan_item(plan_id):
    """Deletes a production plan item."""
    db = get_db()
    try:
        # Consider implications: Should deleting a plan item delete associated Modules?
        # Current schema sets Modules.plan_id to NULL. If CASCADE is desired, change schema.
        cursor = db.execute("DELETE FROM ProductionPlan WHERE plan_id = ?", (plan_id,))
        db.commit()
        return cursor.rowcount > 0
    except sqlite3.Error as e:
        print(f"Error deleting production plan item: {e}")
        return False

def update_production_plan_sequence(ordered_plan_ids):
    """
    Updates the planned_sequence for a list of production plan items based on
    the exact order provided in the list. Assigns sequence numbers 1, 2, 3, ...
    to the items in the list according to their position.
    Assumes ordered_plan_ids contains ALL items that should be sequenced contiguously.
    """
    db = get_db()
    if not ordered_plan_ids:
        print("No plan IDs provided for reordering.")
        return True # Nothing to reorder

    try:
        with db: # Use transaction
            # Update sequence for each item based on its index in the list (0-based index + 1 for 1-based sequence)
            for i, plan_id in enumerate(ordered_plan_ids):
                new_sequence = i + 1
                cursor = db.execute(
                    "UPDATE ProductionPlan SET planned_sequence = ? WHERE plan_id = ?",
                    (new_sequence, plan_id)
                )
                if cursor.rowcount == 0:
                    # This indicates a potential problem - a plan_id sent from frontend doesn't exist?
                    # Or maybe it was filtered out (e.g., status changed)?
                    # For robustness, log this but continue. Consider raising an error if strict consistency is needed.
                    print(f"Warning: plan_id {plan_id} not found during sequence update.") # Replace with logging

        print(f"Successfully reordered {len(ordered_plan_ids)} plan items.") # Replace with logging
        return True
    except sqlite3.Error as e:
        print(f"Error updating production plan sequence: {e}") # Replace with logging
        # Transaction ensures rollback on error
        return False


def get_station_status_and_upcoming(upcoming_count=5):
    """Fetches current module at each station and the next N planned items."""
    db = get_db()

    # 1. Get current station occupancy
    station_query = """
        SELECT
            s.station_id, s.name as station_name, s.line_type, s.sequence_order,
            m.module_id, m.house_type_id, ht.name as house_type_name,
            m.module_sequence_in_house, ht.number_of_modules,
            m.project_id, p.name as project_name,
            m.plan_id, pp.house_identifier -- Include plan details if module is linked
        FROM Stations s
        LEFT JOIN Modules m ON s.station_id = m.current_station_id AND m.status = 'In Progress' -- Only show active modules at stations
        LEFT JOIN HouseTypes ht ON m.house_type_id = ht.house_type_id
        LEFT JOIN Projects p ON m.project_id = p.project_id
        LEFT JOIN ProductionPlan pp ON m.plan_id = pp.plan_id -- Join to get house_identifier
        ORDER BY s.sequence_order, s.line_type -- Ensure consistent station order
    """
    station_cursor = db.execute(station_query)
    station_status = [dict(row) for row in station_cursor.fetchall()]

    # 2. Get next N upcoming planned items (status 'Planned' or 'Scheduled')
    upcoming_query = """
        SELECT
            pp.plan_id, pp.project_id, p.name as project_name,
            pp.house_type_id, ht.name as house_type_name, ht.number_of_modules,
            pp.house_identifier, pp.module_sequence_in_house, -- Added module sequence
            pp.planned_sequence, pp.planned_start_datetime,
            pp.planned_assembly_line, pp.status
        FROM ProductionPlan pp
        JOIN Projects p ON pp.project_id = p.project_id
        JOIN HouseTypes ht ON pp.house_type_id = ht.house_type_id
        WHERE pp.status IN ('Planned', 'Scheduled')
        ORDER BY pp.project_id, pp.planned_sequence ASC, pp.planned_start_datetime ASC -- Order by project first, then sequence
        -- Removed LIMIT clause to fetch all items
    """
    upcoming_cursor = db.execute(upcoming_query) # Removed upcoming_count parameter
    upcoming_items = [dict(row) for row in upcoming_cursor.fetchall()]

    return {
        'station_status': station_status,
        'upcoming_items': upcoming_items
    }


# === House Types ===

# get_all_house_types is defined above in the helpers section

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
    except sqlite3.IntegrityError:
        return None # Duplicate name

def update_house_type(house_type_id, name, description, number_of_modules):
    """Updates an existing house type."""
    db = get_db()
    cursor = db.execute(
        "UPDATE HouseTypes SET name = ?, description = ?, number_of_modules = ? WHERE house_type_id = ?",
        (name, description, number_of_modules, house_type_id)
    )
    db.commit()
    return cursor.rowcount > 0

def delete_house_type(house_type_id):
    """Deletes a house type."""
    db = get_db()
    # Cascading deletes should handle ProjectModules, HouseTypeParameters.
    # TaskDefinitions.house_type_id will be set to NULL.
    # Modules.house_type_id might cause issues if not handled (e.g., ON DELETE RESTRICT). Schema uses default behavior.
    # ProductionPlan.house_type_id has ON DELETE RESTRICT, so deletion will fail if house type is used in plan.
    cursor = db.execute("DELETE FROM HouseTypes WHERE house_type_id = ?", (house_type_id,))
    db.commit()
    return cursor.rowcount > 0

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
        return None # Duplicate name

def update_house_parameter(parameter_id, name, unit):
    """Updates an existing house parameter definition."""
    db = get_db()
    cursor = db.execute("UPDATE HouseParameters SET name = ?, unit = ? WHERE parameter_id = ?", (name, unit, parameter_id))
    db.commit()
    return cursor.rowcount > 0

def delete_house_parameter(parameter_id):
    """Deletes a house parameter definition."""
    db = get_db()
    # Cascading delete should handle HouseTypeParameters links.
    cursor = db.execute("DELETE FROM HouseParameters WHERE parameter_id = ?", (parameter_id,))
    db.commit()
    return cursor.rowcount > 0

# === House Type Parameters (Linking Table) ===

def get_parameters_for_house_type(house_type_id):
    """Fetches all parameters and their values for a specific house type, including module sequence."""
    db = get_db()
    query = """
        SELECT
            htp.house_type_parameter_id, htp.parameter_id, htp.module_sequence_number, htp.value,
            hp.name as parameter_name, hp.unit as parameter_unit
        FROM HouseTypeParameters htp
        JOIN HouseParameters hp ON htp.parameter_id = hp.parameter_id
        WHERE htp.house_type_id = ?
        ORDER BY htp.module_sequence_number, hp.name
    """
    cursor = db.execute(query, (house_type_id,))
    return [dict(row) for row in cursor.fetchall()]

def add_or_update_house_type_parameter(house_type_id, parameter_id, module_sequence_number, value):
    """Adds or updates the value for a parameter for a specific module within a house type."""
    db = get_db()
    try:
        # Use UPSERT (requires SQLite 3.24.0+)
        cursor = db.execute(
            """INSERT INTO HouseTypeParameters (house_type_id, parameter_id, module_sequence_number, value)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(house_type_id, parameter_id, module_sequence_number)
               DO UPDATE SET value = excluded.value""",
            (house_type_id, parameter_id, module_sequence_number, value)
        )
        db.commit()
        # Return the ID of the inserted/updated row if needed
        # For simplicity, return True on success
        return True
    except sqlite3.Error as e:
        print(f"Error adding/updating house type parameter: {e}") # Replace with logging
        return False

def delete_house_type_parameter(house_type_parameter_id):
    """Removes a specific parameter link from a house type by its own ID."""
    db = get_db()
    cursor = db.execute("DELETE FROM HouseTypeParameters WHERE house_type_parameter_id = ?", (house_type_parameter_id,))
    db.commit()
    return cursor.rowcount > 0

def delete_parameter_from_house_type_module(house_type_id, parameter_id, module_sequence_number):
    """Removes a parameter link by house_type_id, parameter_id, and module sequence."""
    db = get_db()
    cursor = db.execute(
        "DELETE FROM HouseTypeParameters WHERE house_type_id = ? AND parameter_id = ? AND module_sequence_number = ?",
        (house_type_id, parameter_id, module_sequence_number)
    )
    db.commit()
    return cursor.rowcount > 0
