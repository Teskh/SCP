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
            mt.name as module_type_name,
            sp.name as specialty_name,
            st.name as station_name,
            td.module_type_id, td.specialty_id, td.station_id
        FROM TaskDefinitions td
        LEFT JOIN ModuleTypes mt ON td.module_type_id = mt.module_type_id
        LEFT JOIN Specialties sp ON td.specialty_id = sp.specialty_id
        LEFT JOIN Stations st ON td.station_id = st.station_id
        ORDER BY td.name
    """
    cursor = db.execute(query)
    task_defs = cursor.fetchall()
    return [dict(row) for row in task_defs]

def add_task_definition(name, description, module_type_id, specialty_id, station_id):
    """Adds a new task definition."""
    db = get_db()
    try:
        cursor = db.execute(
            """INSERT INTO TaskDefinitions
               (name, description, module_type_id, specialty_id, station_id)
               VALUES (?, ?, ?, ?, ?)""",
            (name, description, module_type_id, specialty_id, station_id)
        )
        db.commit()
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        return None # Or raise

def update_task_definition(task_definition_id, name, description, module_type_id, specialty_id, station_id):
    """Updates an existing task definition."""
    db = get_db()
    cursor = db.execute(
        """UPDATE TaskDefinitions SET
           name = ?, description = ?, module_type_id = ?, specialty_id = ?, station_id = ?
           WHERE task_definition_id = ?""",
        (name, description, module_type_id, specialty_id, station_id, task_definition_id)
    )
    db.commit()
    return cursor.rowcount > 0

def delete_task_definition(task_definition_id):
    """Deletes a task definition."""
    db = get_db()
    cursor = db.execute("DELETE FROM TaskDefinitions WHERE task_definition_id = ?", (task_definition_id,))
    db.commit()
    return cursor.rowcount > 0

# === Helper functions to get related data (for dropdowns etc.) ===

def get_all_module_types():
    """Fetches all module types for dropdowns."""
    db = get_db()
    cursor = db.execute("SELECT module_type_id, name FROM ModuleTypes ORDER BY name")
    return [dict(row) for row in cursor.fetchall()]

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
