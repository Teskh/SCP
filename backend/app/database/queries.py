import sqlite3
from .connection import get_db

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
    """Updates an existing member in the AdminTeam table."""
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
            htp.house_type_id, htp.parameter_id, htp.module_sequence_number, htp.value,
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
    # Consider adding more robust checks or constraints if needed.
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
