import sqlite3
import logging
import json
import os
from flask import current_app # To access app.config

logger = logging.getLogger(__name__)

def _connect_to_external_db(db_path):
    """Helper to connect to an external SQLite database in read-only mode."""
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"External database not found at: {db_path}")
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        logger.error(f"Error connecting to external DB at {db_path}: {e}")
        raise

def _get_project_instance_attributes(project_db_path, project_id, instance_type, instance_id):
    """
    Retrieves attributes for a specific Item_Instance or Accessory_Instance from projects.db.
    """
    attributes = {}
    try:
        with _connect_to_external_db(project_db_path) as conn:
            cursor = conn.cursor()
            if instance_type == 'item':
                cursor.execute(
                    "SELECT name, value FROM Item_Instance_Attributes WHERE instance_id = ?",
                    (instance_id,)
                )
            elif instance_type == 'accessory':
                cursor.execute(
                    "SELECT name, value FROM Accessory_Instance_Attributes WHERE accessory_instance_id = ?",
                    (instance_id,)
                )
            else:
                return {} # Invalid instance type

            for row in cursor.fetchall():
                attributes[row['name']] = json.loads(row['value']) if row['value'] else None # Assuming value is JSON string
    except Exception as e:
        logger.error(f"Error fetching instance attributes for {instance_type} {instance_id} in project {project_id} from {project_db_path}: {e}")
        # Depending on strictness, could re-raise or return empty dict
    return attributes

def _condition_matches(instance_value, operator, condition_value):
    """Evaluates if an instance value matches a condition."""
    # Ensure instance_value is treated as string for comparison, as it comes from DB
    instance_value_str = str(instance_value) if instance_value is not None else ''
    condition_value_str = str(condition_value) if condition_value is not None else ''

    if operator == '=':
        return instance_value_str == condition_value_str
    elif operator == '>':
        try:
            return float(instance_value_str) > float(condition_value_str)
        except ValueError:
            return instance_value_str > condition_value_str # Fallback to string comparison
    elif operator == '<':
        try:
            return float(instance_value_str) < float(condition_value_str)
        except ValueError:
            return instance_value_str < condition_value_str # Fallback to string comparison
    elif operator.upper() == 'IN':
        try:
            values = json.loads(condition_value_str)
            if not isinstance(values, list):
                values = [values]
        except json.JSONDecodeError:
            values = [x.strip() for x in condition_value_str.split(',')]
        return instance_value_str in [str(v) for v in values]
    elif operator.upper() == 'BETWEEN':
        parts = [x.strip() for x in condition_value_str.split(',')]
        if len(parts) != 2:
            return False
        try:
            lower, upper = float(parts[0]), float(parts[1])
            return lower <= float(instance_value_str) <= upper
        except ValueError:
            return False
    elif operator.upper() == 'IS NOT NULL':
        return instance_value is not None and instance_value_str != ''
    else:
        return False

def _evaluate_material_conditions(conditions, instance_attributes):
    """
    Evaluates a list of conditions (for a single group_id) against instance attributes.
    All conditions in the list must be true (AND logic).
    """
    for cond in conditions:
        attr_name = cond['attribute_name']
        operator = cond['operator']
        cond_value = cond['value']
        inst_value = instance_attributes.get(attr_name)
        if not _condition_matches(inst_value, operator, cond_value):
            return False
    return True

def _get_applicable_materials_from_main_db(main_db_conn, instance_type, ref_id, instance_attributes):
    """
    Retrieves materials from main.db for a given item/accessory and filters them
    based on material conditions and instance attributes.
    """
    cursor = main_db_conn.cursor()
    if instance_type == 'item':
        cursor.execute("SELECT material_id, material_name, SKU, Units FROM Materials WHERE item_id = ?", (ref_id,))
    elif instance_type == 'accessory':
        cursor.execute("SELECT material_id, material_name, SKU, Units FROM Materials WHERE accesory_id = ?", (ref_id,))
    else:
        return [] # Invalid instance type

    materials = cursor.fetchall()
    applicable_materials = []

    for material_row in materials:
        material_dict = dict(material_row)
        cursor.execute("SELECT condition_id, material_id, group_id, attribute_name, operator, value FROM Material_Conditions WHERE material_id = ?", (material_dict['material_id'],))
        conditions = cursor.fetchall()
        
        if not conditions:
            # No conditions means the material applies automatically.
            applicable_materials.append(material_dict)
            continue

        # Group conditions by group_id for OR logic between groups, AND logic within a group
        groups = {}
        for cond_row in conditions:
            cond_dict = dict(cond_row)
            groups.setdefault(cond_dict['group_id'], []).append(cond_dict)
        
        # Evaluate groups: if any group evaluates to true, the material is applicable
        material_is_applicable = False
        for group_id in sorted(groups.keys()): # Sort to ensure consistent evaluation order
            if _evaluate_material_conditions(groups[group_id], instance_attributes):
                material_is_applicable = True
                break # Found a matching group, no need to check other groups for this material
        
        if material_is_applicable:
            applicable_materials.append(material_dict)
            
    return applicable_materials

def get_materials_for_task(task_definition_id: int, house_type_id: int):
    """
    Fetches materials applicable to a given task, considering the linked project
    and instance-specific attributes.
    """
    materials_list = []
    project_db_path = current_app.config['EXTERNAL_PROJECTS_DB_PATH']
    main_db_path = current_app.config['MAIN_DB_PATH']

    # 1. Get linked_project_id from HouseType
    db = sqlite3.connect(current_app.config['DATABASE_URI'].replace('sqlite:///', ''), uri=True)
    db.row_factory = sqlite3.Row
    house_type_cursor = db.execute("SELECT linked_project_id FROM HouseTypes WHERE house_type_id = ?", (house_type_id,))
    house_type_info = house_type_cursor.fetchone()
    db.close()

    if not house_type_info or house_type_info['linked_project_id'] is None:
        logger.info(f"HouseType {house_type_id} is not linked to an external project. No materials to fetch based on project context.")
        return [] # No linked project, no project-specific materials

    linked_project_id = house_type_info['linked_project_id']

    try:
        with _connect_to_external_db(main_db_path) as main_db_conn:
            with _connect_to_external_db(project_db_path) as project_db_conn:
                # 2. Find Items linked to this task_definition_id in main.db
                main_db_cursor = main_db_conn.cursor()
                
                # Search in Items table
                main_db_cursor.execute(
                    "SELECT item_id, name, associated_tasks FROM Items WHERE json_extract(associated_tasks, '$') LIKE ?",
                    (f'%"{task_definition_id}"%',)
                )
                items_linked_to_task = main_db_cursor.fetchall()

                for item_row in items_linked_to_task:
                    item_id = item_row['item_id']
                    # 3. Find instances of this item for the linked_project_id in projects.db
                    project_db_cursor = project_db_conn.cursor()
                    project_db_cursor.execute(
                        "SELECT instance_id FROM Item_Instances WHERE project_id = ? AND item_id = ?",
                        (linked_project_id, item_id)
                    )
                    item_instances = project_db_cursor.fetchall()

                    for instance_row in item_instances:
                        instance_id = instance_row['instance_id']
                        # 4. Get instance attributes from projects.db
                        instance_attributes = _get_project_instance_attributes(project_db_path, linked_project_id, 'item', instance_id)
                        # 5. Get applicable materials from main.db based on attributes
                        applicable_mats = _get_applicable_materials_from_main_db(main_db_conn, 'item', item_id, instance_attributes)
                        materials_list.extend(applicable_mats)

                # 6. Find Accessory_Items linked to this task_definition_id in main.db
                main_db_cursor.execute(
                    "SELECT accesory_id, name, associated_tasks FROM Accesory_Item WHERE json_extract(associated_tasks, '$') LIKE ?",
                    (f'%"{task_definition_id}"%',)
                )
                accessories_linked_to_task = main_db_cursor.fetchall()

                for accessory_row in accessories_linked_to_task:
                    accessory_id = accessory_row['accesory_id']
                    # 7. Find instances of this accessory for the linked_project_id in projects.db
                    project_db_cursor.execute(
                        "SELECT accessory_instance_id FROM Accessory_Instance WHERE project_id = ? AND accessory_id = ?",
                        (linked_project_id, accessory_id)
                    )
                    accessory_instances = project_db_cursor.fetchall()

                    for instance_row in accessory_instances:
                        instance_id = instance_row['accessory_instance_id']
                        # 8. Get instance attributes from projects.db
                        instance_attributes = _get_project_instance_attributes(project_db_path, linked_project_id, 'accessory', instance_id)
                        # 9. Get applicable materials from main.db based on attributes
                        applicable_mats = _get_applicable_materials_from_main_db(main_db_conn, 'accessory', accessory_id, instance_attributes)
                        materials_list.extend(applicable_mats)

    except FileNotFoundError as fnfe:
        logger.error(f"Required external database not found: {fnfe}")
        return []
    except sqlite3.Error as e:
        logger.error(f"Database error while fetching materials for task {task_definition_id}: {e}", exc_info=True)
        return []
    except Exception as e:
        logger.error(f"Unexpected error while fetching materials for task {task_definition_id}: {e}", exc_info=True)
        return []

    # Remove duplicates based on material_id if any
    unique_materials = {material['material_id']: material for material in materials_list}.values()
    return list(unique_materials)
