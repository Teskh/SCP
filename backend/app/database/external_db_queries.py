import sqlite3
import logging
import json
import os
from flask import current_app # To access app.config
from .connection import get_db # Import the main DB connection helper

logger = logging.getLogger(__name__)

def _connect_to_external_db(db_path):
    """Helper to connect to an external SQLite database in read-only mode."""
    logger.debug(f"Attempting to connect to external DB: {db_path}")
    if not os.path.exists(db_path):
        logger.error(f"External database file not found: {db_path}")
        raise FileNotFoundError(f"External database not found at: {db_path}")
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        logger.debug(f"Successfully connected to external DB: {db_path}")
        return conn
    except sqlite3.Error as e:
        logger.error(f"Error connecting to external DB at {db_path}: {e}")
        raise

def _get_project_instance_attributes(project_db_path, project_id, instance_type, instance_id):
    """
    Retrieves attributes for a specific Item_Instance or Accessory_Instance from projects.db.
    """
    attributes = {}
    logger.debug(f"Fetching attributes for {instance_type} {instance_id} in project {project_id} from {project_db_path}")
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
                logger.warning(f"Invalid instance type '{instance_type}' for fetching attributes.")
                return {} # Invalid instance type

            for row in cursor.fetchall():
                try:
                    attributes[row['name']] = json.loads(row['value']) if row['value'] else None # Assuming value is JSON string
                except json.JSONDecodeError:
                    logger.warning(f"Failed to decode JSON for attribute '{row['name']}' with value '{row['value']}' for {instance_type} {instance_id}. Storing as raw string.")
                    attributes[row['name']] = row['value'] # Store as raw string if JSON decoding fails
    except Exception as e:
        logger.error(f"Error fetching instance attributes for {instance_type} {instance_id} in project {project_id} from {project_db_path}: {e}")
        # Depending on strictness, could re-raise or return empty dict
    logger.debug(f"Fetched attributes for {instance_type} {instance_id}: {attributes}")
    return attributes

def _condition_matches(instance_value, operator, condition_value):
    """Evaluates if an instance value matches a condition."""
    # Ensure instance_value is treated as string for comparison, as it comes from DB
    instance_value_str = str(instance_value) if instance_value is not None else ''
    condition_value_str = str(condition_value) if condition_value is not None else ''

    logger.debug(f"Evaluating condition: instance_value='{instance_value_str}', operator='{operator}', condition_value='{condition_value_str}'")

    result = False
    if operator == '=':
        result = instance_value_str == condition_value_str
    elif operator == '>':
        try:
            result = float(instance_value_str) > float(condition_value_str)
        except ValueError:
            result = instance_value_str > condition_value_str # Fallback to string comparison
    elif operator == '<':
        try:
            result = float(instance_value_str) < float(condition_value_str)
        except ValueError:
            result = instance_value_str < condition_value_str # Fallback to string comparison
    elif operator.upper() == 'IN':
        try:
            values = json.loads(condition_value_str)
            if not isinstance(values, list):
                values = [values]
        except json.JSONDecodeError:
            values = [x.strip() for x in condition_value_str.split(',')]
        result = instance_value_str in [str(v) for v in values]
    elif operator.upper() == 'BETWEEN':
        parts = [x.strip() for x in condition_value_str.split(',')]
        if len(parts) != 2:
            result = False
        else:
            try:
                lower, upper = float(parts[0]), float(parts[1])
                result = lower <= float(instance_value_str) <= upper
            except ValueError:
                result = False
    elif operator.upper() == 'IS NOT NULL':
        result = instance_value is not None and instance_value_str != ''
    else:
        logger.warning(f"Unknown operator: {operator}")
        result = False
    
    logger.debug(f"Condition result: {result}")
    return result

def _evaluate_material_conditions(conditions, instance_attributes):
    """
    Evaluates a list of conditions (for a single group_id) against instance attributes.
    All conditions in the list must be true (AND logic).
    """
    logger.debug(f"Evaluating conditions for group: {conditions}. Instance attributes: {instance_attributes}")
    for cond in conditions:
        attr_name = cond['attribute_name']
        operator = cond['operator']
        cond_value = cond['value']
        inst_value = instance_attributes.get(attr_name)
        if not _condition_matches(inst_value, operator, cond_value):
            logger.debug(f"Condition failed for attribute '{attr_name}'.")
            return False
    logger.debug(f"All conditions in group evaluated to true.")
    return True

def _get_applicable_materials_from_main_db(main_db_conn, instance_type, ref_id, instance_attributes):
    """
    Retrieves materials from main.db for a given item/accessory and filters them
    based on material conditions and instance attributes.
    """
    logger.debug(f"Fetching materials for {instance_type} ref_id={ref_id} from main.db. Instance attributes: {instance_attributes}")
    cursor = main_db_conn.cursor()
    if instance_type == 'item':
        cursor.execute("SELECT material_id, material_name, SKU, Units FROM Materials WHERE item_id = ?", (ref_id,))
    elif instance_type == 'accessory':
        cursor.execute("SELECT material_id, material_name, SKU, Units FROM Materials WHERE accesory_id = ?", (ref_id,))
    else:
        logger.warning(f"Invalid instance type '{instance_type}' for fetching applicable materials.")
        return [] # Invalid instance type

    materials = cursor.fetchall()
    logger.debug(f"Materials found for {instance_type} ref_id={ref_id} before filtering: {len(materials)}")
    applicable_materials = []

    for material_row in materials:
        material_dict = dict(material_row)
        logger.debug(f"Checking material: {material_dict['material_name']} (ID: {material_dict['material_id']})")
        cursor.execute("SELECT condition_id, material_id, group_id, attribute_name, operator, value FROM Material_Conditions WHERE material_id = ?", (material_dict['material_id'],))
        conditions = cursor.fetchall()
        
        if not conditions:
            # No conditions means the material applies automatically.
            logger.debug(f"Material {material_dict['material_name']} has no conditions, adding.")
            applicable_materials.append(material_dict)
            continue

        # Group conditions by group_id for OR logic between groups, AND logic within a group
        groups = {}
        for cond_row in conditions:
            cond_dict = dict(cond_row)
            groups.setdefault(cond_dict['group_id'], []).append(cond_dict)
        
        # Evaluate groups: if any group evaluates to true, the material is applicable
        material_is_applicable = False
        logger.debug(f"Evaluating {len(groups)} condition groups for material {material_dict['material_name']}.")
        for group_id in sorted(groups.keys()): # Sort to ensure consistent evaluation order
            logger.debug(f"  Evaluating group_id: {group_id}")
            if _evaluate_material_conditions(groups[group_id], instance_attributes):
                material_is_applicable = True
                logger.debug(f"  Group {group_id} matched. Material {material_dict['material_name']} is applicable.")
                break # Found a matching group, no need to check other groups for this material
            else:
                logger.debug(f"  Group {group_id} did not match.")
        
        if material_is_applicable:
            applicable_materials.append(material_dict)
            
    logger.debug(f"Applicable materials for {instance_type} ref_id={ref_id} after filtering: {len(applicable_materials)}")
    return applicable_materials

def get_materials_for_task(task_definition_id: int, house_type_id: int):
    """
    Fetches materials applicable to a given task, considering the linked project
    and instance-specific attributes.
    """
    materials_list = []
    project_db_path = current_app.config['EXTERNAL_PROJECTS_DB_PATH']
    main_db_path = current_app.config['MAIN_DB_PATH']

    logger.info(f"Attempting to fetch materials for task_definition_id: {task_definition_id}, house_type_id: {house_type_id}")
    logger.debug(f"Configured project_db_path: {project_db_path}")
    logger.debug(f"Configured main_db_path: {main_db_path}")

    # 1. Get linked_project_id from HouseType
    # Use the main application's database connection for HouseTypes
    try:
        # Use the Flask-managed application's primary database connection
        app_db_conn = get_db()
        house_type_cursor = app_db_conn.execute("SELECT linked_project_id FROM HouseTypes WHERE house_type_id = ?", (house_type_id,))
        house_type_info = house_type_cursor.fetchone()
    except sqlite3.Error as e:
        logger.error(f"Database error connecting to application's primary DB or querying HouseTypes for house_type_id {house_type_id}: {e}", exc_info=True)
        return []
    except Exception as e:
        logger.error(f"Unexpected error querying HouseTypes for house_type_id {house_type_id}: {e}", exc_info=True)
        return []

    if not house_type_info or house_type_info['linked_project_id'] is None:
        logger.info(f"HouseType {house_type_id} is not linked to an external project (linked_project_id is NULL or HouseType not found). No materials to fetch based on project context.")
        return [] # No linked project, no project-specific materials

    linked_project_id = house_type_info['linked_project_id']
    logger.info(f"HouseType {house_type_id} linked to project ID: {linked_project_id}")

    try:
        # Connect to the external main.db for Items, Accesory_Item, Materials, etc.
        with _connect_to_external_db(main_db_path) as actual_main_db_conn:
            with _connect_to_external_db(project_db_path) as project_db_conn:
                # 2. Find Items linked to this task_definition_id in main.db
                actual_main_db_cursor = actual_main_db_conn.cursor()
                
                # Search in Items table
                # Using REPLACE to make searching for a number in a JSON array string more robust.
                # This assumes task_definition_id is an integer and stored as a number in the JSON, e.g., [1,2,3]
                actual_main_db_cursor.execute(
                    "SELECT item_id, name, associated_tasks FROM Items WHERE REPLACE(REPLACE(json_extract(associated_tasks, '$'), '[', ','), ']', ',') LIKE '%,' || CAST(? AS TEXT) || ',%'",
                    (task_definition_id,)
                )
                items_linked_to_task = actual_main_db_cursor.fetchall()
                logger.info(f"Found {len(items_linked_to_task)} items linked to task {task_definition_id} in {main_db_path}.")

                for item_row in items_linked_to_task:
                    item_id = item_row['item_id']
                    logger.debug(f"Processing item {item_id} ('{item_row['name']}') linked to task {task_definition_id}. Associated tasks: {item_row['associated_tasks']}")
                    # 3. Find instances of this item for the linked_project_id in projects.db
                    project_db_cursor = project_db_conn.cursor()
                    project_db_cursor.execute(
                        "SELECT instance_id FROM Item_Instances WHERE project_id = ? AND item_id = ?",
                        (linked_project_id, item_id)
                    )
                    item_instances = project_db_cursor.fetchall()
                    logger.debug(f"Found {len(item_instances)} instances for item {item_id} in project {linked_project_id}.")

                    for instance_row in item_instances:
                        instance_id = instance_row['instance_id']
                        logger.debug(f"  Processing item instance {instance_id}.")
                        # 4. Get instance attributes from projects.db
                        instance_attributes = _get_project_instance_attributes(project_db_path, linked_project_id, 'item', instance_id)
                        # 5. Get applicable materials from main.db based on attributes
                        applicable_mats_for_item = _get_applicable_materials_from_main_db(actual_main_db_conn, 'item', item_id, instance_attributes)
                        
                        processed_mats_for_item = []
                        for mat_dict in applicable_mats_for_item:
                            bom_cursor = project_db_conn.cursor()
                            bom_cursor.execute(
                                "SELECT quantity, assembly_kit FROM Bill_Of_Materials WHERE project_id = ? AND material_id = ?",
                                (linked_project_id, mat_dict['material_id'])
                            )
                            bom_data = bom_cursor.fetchone()
                            if bom_data:
                                mat_dict['quantity'] = bom_data['quantity']
                                # 'unit' is now solely from mat_dict.get('Units') from main.db
                                mat_dict['assembly_kit'] = bom_data['assembly_kit']
                            else:
                                mat_dict['quantity'] = 0 # Default quantity if not in BOM for this project
                                mat_dict['assembly_kit'] = None
                            # Ensure 'unit' key exists, using the value from main.db's Materials.Units
                            mat_dict['unit'] = mat_dict.get('Units')
                            processed_mats_for_item.append(mat_dict)
                        
                        materials_list.extend(processed_mats_for_item)
                        logger.debug(f"  Added {len(processed_mats_for_item)} materials (with quantity info) for item instance {instance_id}.")

                # 6. Find Accessory_Items linked to this task_definition_id in main.db
                # Using REPLACE to make searching for a number in a JSON array string more robust.
                actual_main_db_cursor.execute(
                    "SELECT accesory_id, name, associated_tasks FROM Accesory_Item WHERE REPLACE(REPLACE(json_extract(associated_tasks, '$'), '[', ','), ']', ',') LIKE '%,' || CAST(? AS TEXT) || ',%'",
                    (task_definition_id,)
                )
                accessories_linked_to_task = actual_main_db_cursor.fetchall()
                logger.info(f"Found {len(accessories_linked_to_task)} accessories linked to task {task_definition_id} in {main_db_path}.")

                for accessory_row in accessories_linked_to_task:
                    accessory_id = accessory_row['accesory_id']
                    logger.debug(f"Processing accessory {accessory_id} ('{accessory_row['name']}') linked to task {task_definition_id}. Associated tasks: {accessory_row['associated_tasks']}")
                    # 7. Find instances of this accessory for the linked_project_id in projects.db
                    project_db_cursor.execute( # Reusing project_db_cursor from above
                        "SELECT accessory_instance_id FROM Accessory_Instance WHERE project_id = ? AND accessory_id = ?",
                        (linked_project_id, accessory_id)
                    )
                    accessory_instances = project_db_cursor.fetchall()
                    logger.debug(f"Found {len(accessory_instances)} instances for accessory {accessory_id} in project {linked_project_id}.")

                    for instance_row in accessory_instances:
                        instance_id = instance_row['accessory_instance_id']
                        logger.debug(f"  Processing accessory instance {instance_id}.")
                        # 8. Get instance attributes from projects.db
                        instance_attributes = _get_project_instance_attributes(project_db_path, linked_project_id, 'accessory', instance_id)
                        # 9. Get applicable materials from main.db based on attributes
                        applicable_mats_for_accessory = _get_applicable_materials_from_main_db(actual_main_db_conn, 'accessory', accessory_id, instance_attributes)

                        processed_mats_for_accessory = []
                        for mat_dict in applicable_mats_for_accessory:
                            bom_cursor = project_db_conn.cursor()
                            bom_cursor.execute(
                                "SELECT quantity, assembly_kit FROM Bill_Of_Materials WHERE project_id = ? AND material_id = ?",
                                (linked_project_id, mat_dict['material_id'])
                            )
                            bom_data = bom_cursor.fetchone()
                            if bom_data:
                                mat_dict['quantity'] = bom_data['quantity']
                                # 'unit' is now solely from mat_dict.get('Units') from main.db
                                mat_dict['assembly_kit'] = bom_data['assembly_kit']
                            else:
                                mat_dict['quantity'] = 0 # Default quantity if not in BOM for this project
                                mat_dict['assembly_kit'] = None
                            # Ensure 'unit' key exists, using the value from main.db's Materials.Units
                            mat_dict['unit'] = mat_dict.get('Units')
                            processed_mats_for_accessory.append(mat_dict)

                        materials_list.extend(processed_mats_for_accessory)
                        logger.debug(f"  Added {len(processed_mats_for_accessory)} materials (with quantity info) for accessory instance {instance_id}.")

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
    logger.info(f"Total unique materials found for task {task_definition_id}: {len(unique_materials)}")
    return list(unique_materials)
