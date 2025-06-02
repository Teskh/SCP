-- Drop existing tables (order matters for foreign keys, drop dependent tables first)
DROP TABLE IF EXISTS TaskPauses;
DROP TABLE IF EXISTS PanelTaskLogs; -- Depends on TaskDefinitions, Workers, PanelDefinitions, Stations, ModuleProductionPlan
DROP TABLE IF EXISTS TaskLogs; -- Depends on TaskDefinitions, Workers, Stations, ModuleProductionPlan
-- Modules table is removed
DROP TABLE IF EXISTS ModuleProductionPlan; -- Depends on HouseTypes, HouseSubType
DROP TABLE IF EXISTS PanelDefinitions; -- Was HouseTypePanels. Depends on HouseTypes, HouseSubType, Multiwalls
DROP TABLE IF EXISTS Multiwalls; -- Depends on HouseTypes
DROP TABLE IF EXISTS HouseTypeParameters; -- Depends on HouseTypes, HouseParameters, HouseSubType
DROP TABLE IF EXISTS ProjectModules; -- Depends on HouseTypes (Projects table is removed)
DROP TABLE IF EXISTS TaskDefinitions; -- Depends on HouseTypes, Specialties
DROP TABLE IF EXISTS Workers; -- Depends on Specialties, AdminTeam
DROP TABLE IF EXISTS HouseSubType; -- Was HouseTypeTipologias. Depends on HouseTypes
DROP TABLE IF EXISTS Projects; -- This table is being removed from creation
DROP TABLE IF EXISTS Specialties;
DROP TABLE IF EXISTS AdminTeam;
DROP TABLE IF EXISTS HouseTypes;
DROP TABLE IF EXISTS HouseParameters;
DROP TABLE IF EXISTS Stations;


CREATE TABLE Specialties (
    specialty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Electrician', 'Plumber', 'Framer'
    description TEXT
);

CREATE TABLE Workers (
    worker_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    pin TEXT NOT NULL,
    specialty_id INTEGER, -- Foreign Key to Specialties table
    supervisor_id INTEGER, -- Foreign Key to AdminTeam table, nullable
    is_active INTEGER DEFAULT 1, -- Boolean (0=false, 1=true)
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id),
    FOREIGN KEY (supervisor_id) REFERENCES AdminTeam(admin_team_id) ON DELETE SET NULL
);

CREATE TABLE ProjectModules (
    project_module_id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- project_id INTEGER NOT NULL, -- Project table removed, this table might be deprecated or project info handled differently
    house_type_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    -- FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE, -- Project table removed
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE
    -- UNIQUE (project_id, house_type_id) -- project_id removed, uniqueness might need re-evaluation if project context is still needed
);

CREATE TABLE Stations (
    station_id TEXT PRIMARY KEY, -- e.g., 'W1', 'W2', ..., 'W5', 'M1', 'A1', ..., 'A6', 'B1', ..., 'C6'
    name TEXT NOT NULL, -- e.g., 'Panel Line 1: Framing', 'Buffer Magazine', 'Assembly Line A: Station 1'
    line_type TEXT NOT NULL, -- 'W', 'M', 'A', 'B', 'C'
    sequence_order INTEGER NOT NULL -- For sorting/determining flow (e.g., W1=1, W5=5, M1=6, A1=7, B1=7, C1=7, A2=8, B2=8, C2=8 ...)
);

-- =========Panel Production Plan =========

CREATE TABLE PanelProductionPlan (
                panel_production_plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                panel_definition_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'In Progress', 'Completed', 'Consumed')),
                current_station TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES ModuleProductionPlan(plan_id) ON DELETE CASCADE,
                FOREIGN KEY (panel_definition_id) REFERENCES PanelDefinitions(panel_definition_id) ON DELETE CASCADE,
                UNIQUE(plan_id, panel_definition_id)
            )

CREATE INDEX idx_panel_production_plan_plan_id ON PanelProductionPlan (plan_id);
CREATE INDEX idx_panel_production_plan_panel_definition_id ON PanelProductionPlan (panel_definition_id);
CREATE INDEX idx_panel_production_plan_status ON PanelProductionPlan (status);
CREATE INDEX idx_panel_production_plan_current_station ON PanelProductionPlan (current_station);

-- =========Module Production Plan =========

CREATE TABLE ModuleProductionPlan (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL, -- Replaces project_id FK, stores the name of the project
    house_type_id INTEGER NOT NULL,
    house_identifier TEXT NOT NULL, -- Unique identifier for this house instance within the project (e.g., "ProjectX-Lot-12")
    module_number INTEGER NOT NULL, -- Which module of the house this plan item represents
    planned_sequence INTEGER NOT NULL, -- Overall production order across all projects/plans
    planned_start_datetime TEXT NOT NULL, -- ISO8601 format recommended (YYYY-MM-DD HH:MM:SS)
    planned_assembly_line TEXT NOT NULL CHECK(planned_assembly_line IN ('A', 'B', 'C')), -- Which line it's planned for
    sub_type_id INTEGER, -- Link to the specific sub_type (tipologia) for this planned item
    status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned', 'Panels', 'Magazine', 'Assembly', 'Completed')), -- Status of this planned item
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Consider adding triggers to update this automatically
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE RESTRICT, -- Don't allow deleting house type if planned
    FOREIGN KEY (sub_type_id) REFERENCES HouseSubType(sub_type_id) ON DELETE SET NULL, -- If sub_type deleted, set plan item's sub_type to NULL
    UNIQUE (project_name, house_identifier, module_number) -- Ensures a module for a specific house in a project is planned only once
);

-- Indexes for ModuleProductionPlan
CREATE INDEX idx_ModuleProductionPlan_project_name ON ModuleProductionPlan (project_name);
CREATE INDEX idx_ModuleProductionPlan_house_type ON ModuleProductionPlan (house_type_id);
CREATE INDEX idx_ModuleProductionPlan_sequence ON ModuleProductionPlan (planned_sequence);
CREATE INDEX idx_ModuleProductionPlan_start_datetime ON ModuleProductionPlan (planned_start_datetime);
CREATE INDEX idx_ModuleProductionPlan_status ON ModuleProductionPlan (status);
CREATE INDEX idx_ModuleProductionPlan_sub_type ON ModuleProductionPlan (sub_type_id); -- Index for sub_type FK
CREATE INDEX idx_ModuleProductionPlan_identifier_module ON ModuleProductionPlan (project_name, house_identifier, module_number); -- Index for unique constraint

-- ========= Task Definitions =========

CREATE TABLE TaskDefinitions (
    task_definition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Install Window Frame', 'Run Hot Water Line', 'Attach Exterior Cladding'
    description TEXT,
    house_type_id INTEGER, -- Which type of house this task applies to (can be NULL if generic)
    specialty_id INTEGER, -- Optional: Link task to a specific specialty (can be NULL if generic)
    station_sequence_order INTEGER, -- Optional: Link task to a specific production sequence step (e.g., 1 for W1, 7 for A1/B1/C1)
    task_dependencies TEXT, -- Comma-separated list of prerequisite task_definition_ids (e.g., "1,5,8")
    is_panel_task INTEGER DEFAULT 0, -- Boolean (0=false, 1=true) to indicate if this task applies to panels (logged in PanelTaskLogs) or modules (logged in TaskLogs)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE SET NULL, -- Allow house type deletion without deleting task def
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id) ON DELETE SET NULL -- Allow specialty deletion without deleting task def
    -- No direct FK to Stations.sequence_order as it's not unique
);

-- ========= Task Execution Tracking =========

CREATE TABLE TaskLogs ( -- For tasks related to a Module as a whole
    task_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL, -- Link to the specific production plan item
    task_definition_id INTEGER NOT NULL, -- Which task definition was performed (should have is_panel_task = 0)
    worker_id INTEGER NOT NULL, -- Who performed it
    status TEXT NOT NULL CHECK(status IN ('Not Started', 'In Progress', 'Completed', 'Paused')),
    started_at TEXT, -- Timestamp (ISO8601 format)
    completed_at TEXT, -- Timestamp (ISO8601 format)
    station_start TEXT, -- Record the station where the task was started
    station_finish TEXT, -- Record the actual station where it was marked complete (Nullable)
    notes TEXT, -- Optional field for worker comments
    FOREIGN KEY (plan_id) REFERENCES ModuleProductionPlan(plan_id) ON DELETE CASCADE,
    FOREIGN KEY (task_definition_id) REFERENCES TaskDefinitions(task_definition_id) ON DELETE RESTRICT,
    FOREIGN KEY (worker_id) REFERENCES Workers(worker_id) ON DELETE RESTRICT,
    FOREIGN KEY (station_start) REFERENCES Stations(station_id) ON DELETE SET NULL,
    FOREIGN KEY (station_finish) REFERENCES Stations(station_id) ON DELETE SET NULL -- Changed from RESTRICT to SET NULL for flexibility
);

CREATE TABLE PanelTaskLogs ( -- For tasks related to specific Panels within a Module
    panel_task_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL, -- Link to the specific production plan item
    panel_definition_id INTEGER NOT NULL, -- Which specific panel definition instance
    task_definition_id INTEGER NOT NULL, -- Which task definition was performed (should have is_panel_task = 1)
    worker_id INTEGER NOT NULL, -- Who performed it
    status TEXT NOT NULL CHECK(status IN ('Not Started', 'In Progress', 'Completed', 'Paused')),
    started_at TEXT, -- Timestamp (ISO8601 format)
    completed_at TEXT, -- Timestamp (ISO8601 format)
    station_start TEXT, -- Record the station where the task was started
    station_finish TEXT, -- Record the actual station where it was marked complete (Nullable)
    notes TEXT, -- Optional field for worker comments
    FOREIGN KEY (plan_id) REFERENCES ModuleProductionPlan(plan_id) ON DELETE CASCADE,
    FOREIGN KEY (panel_definition_id) REFERENCES PanelDefinitions(panel_definition_id) ON DELETE CASCADE,
    FOREIGN KEY (task_definition_id) REFERENCES TaskDefinitions(task_definition_id) ON DELETE RESTRICT,
    FOREIGN KEY (worker_id) REFERENCES Workers(worker_id) ON DELETE RESTRICT,
    FOREIGN KEY (station_start) REFERENCES Stations(station_id) ON DELETE SET NULL,
    FOREIGN KEY (station_finish) REFERENCES Stations(station_id) ON DELETE SET NULL -- Changed from RESTRICT to SET NULL
);

CREATE TABLE TaskPauses (
    task_pause_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_log_id INTEGER, -- Links to the specific module task instance being paused (Nullable)
    panel_task_log_id INTEGER, -- Links to the specific panel task instance being paused (Nullable)
    paused_by_worker_id INTEGER NOT NULL,
    paused_at TEXT NOT NULL, -- Timestamp (ISO8601 format)
    resumed_at TEXT, -- Timestamp (ISO8601 format), Nullable if still paused
    reason TEXT, -- e.g., 'Waiting for materials', 'Shift change', 'Equipment issue'
    FOREIGN KEY (task_log_id) REFERENCES TaskLogs(task_log_id) ON DELETE CASCADE,
    FOREIGN KEY (panel_task_log_id) REFERENCES PanelTaskLogs(panel_task_log_id) ON DELETE CASCADE,
    FOREIGN KEY (paused_by_worker_id) REFERENCES Workers(worker_id) ON DELETE RESTRICT,
    CHECK ( (task_log_id IS NOT NULL AND panel_task_log_id IS NULL) OR (task_log_id IS NULL AND panel_task_log_id IS NOT NULL) ) -- Ensures pause is linked to one type of log
);

-- ========= Indexes for Performance =========
-- TaskDefinitions
CREATE INDEX idx_taskdefinitions_house_type ON TaskDefinitions (house_type_id);
CREATE INDEX idx_taskdefinitions_specialty ON TaskDefinitions (specialty_id);
CREATE INDEX idx_taskdefinitions_station_sequence ON TaskDefinitions (station_sequence_order);
CREATE INDEX idx_taskdefinitions_is_panel_task ON TaskDefinitions (is_panel_task);
-- TaskLogs
CREATE INDEX idx_tasklogs_plan ON TaskLogs (plan_id);
CREATE INDEX idx_tasklogs_task_definition ON TaskLogs (task_definition_id);
CREATE INDEX idx_tasklogs_status ON TaskLogs (status);
CREATE INDEX idx_tasklogs_worker ON TaskLogs (worker_id);
CREATE INDEX idx_tasklogs_station_start ON TaskLogs (station_start);
CREATE INDEX idx_tasklogs_station_finish ON TaskLogs (station_finish);
-- PanelTaskLogs
CREATE INDEX idx_paneltasklogs_plan ON PanelTaskLogs (plan_id);
CREATE INDEX idx_paneltasklogs_panel_definition ON PanelTaskLogs (panel_definition_id);
CREATE INDEX idx_paneltasklogs_task_definition ON PanelTaskLogs (task_definition_id);
CREATE INDEX idx_paneltasklogs_status ON PanelTaskLogs (status);
CREATE INDEX idx_paneltasklogs_worker ON PanelTaskLogs (worker_id);
CREATE INDEX idx_paneltasklogs_station_start ON PanelTaskLogs (station_start);
CREATE INDEX idx_paneltasklogs_station_finish ON PanelTaskLogs (station_finish);
-- TaskPauses
CREATE INDEX idx_taskpauses_tasklog ON TaskPauses (task_log_id);
CREATE INDEX idx_taskpauses_paneltasklog ON TaskPauses (panel_task_log_id);
-- ProjectModules
-- CREATE INDEX idx_projectmodules_project ON ProjectModules (project_id); -- project_id removed
CREATE INDEX idx_projectmodules_house_type ON ProjectModules (house_type_id);
-- Projects table removed, so these are no longer needed:
-- CREATE INDEX idx_projects_name ON Projects (name);
-- CREATE INDEX idx_projects_status ON Projects (status);

-- ========= House Types and Parameters =========

CREATE TABLE HouseTypes (
    house_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Single Family Townhouse A', 'Lakehouse type B'
    description TEXT,
    number_of_modules INTEGER NOT NULL DEFAULT 1, -- How many physical modules make up this house type
    linked_project_id INTEGER -- Optional: ID from an external Projects table
);

-- Table for House SubTypes (formerly Tipologias) associated with a HouseType
CREATE TABLE HouseSubType (
    sub_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g., 'Single', 'Duplex', 'Standard', 'Premium'
    description TEXT,
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    UNIQUE (house_type_id, name) -- SubType name must be unique within a house type
);

CREATE TABLE HouseParameters (
    parameter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Floor Area', 'Number of Windows', 'Exterior Wall Length'
    unit TEXT -- e.g., 'Square Meters', 'Count', 'Linear Meters'
);

CREATE TABLE HouseTypeParameters (
    house_type_parameter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    parameter_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL, -- Which module within the house type this value applies to (1-based index)
    sub_type_id INTEGER, -- Nullable FK: If NULL, applies to all sub_types for the module. If set, applies only to this specific sub_type.
    value REAL NOT NULL, -- Using REAL to accommodate various numeric types (integers, decimals)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_id) REFERENCES HouseParameters(parameter_id) ON DELETE CASCADE,
    FOREIGN KEY (sub_type_id) REFERENCES HouseSubType(sub_type_id) ON DELETE CASCADE, -- If sub_type deleted, delete specific param values
    -- Ensure only one value per parameter per module sequence *per specific sub_type* OR one value for *all sub_types* (NULL sub_type_id)
    UNIQUE (house_type_id, parameter_id, module_sequence_number, sub_type_id)
);

-- Indexes for HouseSubType and HouseTypeParameters
CREATE INDEX idx_housesubtype_house_type ON HouseSubType (house_type_id); -- Index for HouseSubType FK
CREATE INDEX idx_housetypeparameters_house_type ON HouseTypeParameters (house_type_id);
CREATE INDEX idx_housetypeparameters_parameter ON HouseTypeParameters (parameter_id);
CREATE INDEX idx_housetypeparameters_module_seq ON HouseTypeParameters (module_sequence_number);
CREATE INDEX idx_housetypeparameters_sub_type ON HouseTypeParameters (sub_type_id); -- Index for SubType FK
CREATE INDEX idx_housetypeparameters_composite ON HouseTypeParameters (house_type_id, parameter_id, module_sequence_number, sub_type_id); -- Index for the unique constraint

-- ========= Panel Definitions (formerly HouseTypePanels) =========

CREATE TABLE PanelDefinitions (
    panel_definition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL, -- Which module within the house type this panel belongs to (1-based index)
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros')), -- Category of the panel
    panel_code TEXT NOT NULL, -- Identifier/name of the panel
    sub_type_id INTEGER, -- Optional: Specific house sub-type this panel applies to (NULL means applies to all sub-types for this module)
    multiwall_id INTEGER, -- Optional: Link to a Multiwall
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    FOREIGN KEY (sub_type_id) REFERENCES HouseSubType(sub_type_id) ON DELETE SET NULL, -- If sub_type deleted, unlink panel from it
    FOREIGN KEY (multiwall_id) REFERENCES Multiwalls(multiwall_id) ON DELETE SET NULL, -- If multiwall is deleted, unlink panels
    UNIQUE (house_type_id, module_sequence_number, panel_group, panel_code, sub_type_id) -- Panel code unique per group, module, and sub_type (or NULL sub_type)
);

-- Indexes for PanelDefinitions
CREATE INDEX idx_paneldefinitions_house_type_module ON PanelDefinitions (house_type_id, module_sequence_number);
CREATE INDEX idx_paneldefinitions_group ON PanelDefinitions (panel_group);
CREATE INDEX idx_paneldefinitions_multiwall ON PanelDefinitions (multiwall_id);
CREATE INDEX idx_paneldefinitions_sub_type ON PanelDefinitions (sub_type_id);


-- ========= Multiwalls =========

CREATE TABLE Multiwalls (
    multiwall_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL, -- Multiwalls are defined per house type
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros')), -- Must match panel group
    multiwall_code TEXT NOT NULL, -- Identifier for the multiwall (e.g., MW-01)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    UNIQUE (house_type_id, panel_group, multiwall_code) -- Multiwall code unique per house_type and panel_group
);

-- Indexes for Multiwalls
CREATE INDEX idx_multiwalls_house_type_group ON Multiwalls (house_type_id, panel_group);


-- ========= Admin Team =========

CREATE TABLE AdminTeam (
    admin_team_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Supervisor', 'Gestión de producción', 'Admin')), -- Define allowed roles
    pin TEXT NOT NULL UNIQUE, -- Assuming PIN should be unique for admin team members too
    is_active INTEGER DEFAULT 1 -- Boolean (0=false, 1=true)
);

-- Indexes for AdminTeam
CREATE INDEX idx_adminteam_role ON AdminTeam (role);
CREATE INDEX idx_adminteam_is_active ON AdminTeam (is_active);


-- ========= Initial Data Inserts =========

-- Insert Stations
INSERT INTO Stations (station_id, name, line_type, sequence_order) VALUES
('W1', 'Línea de Paneles 1: Estación de Estructura', 'W', 1),
('W2', 'Línea de Paneles 2: Estación de Revestimiento PLI 1', 'W', 2),
('W3', 'Línea de Paneles 3: Estación de Revestimiento PLI 2', 'W', 3),
('W4', 'Línea de Paneles 4: Estación de Revestimiento PLA 1', 'W', 4),
('W5', 'Línea de Paneles 5: Estación de Revestimiento PLA 2', 'W', 5),
('M1', 'Magazine', 'M', 6), -- M1 follows W5
('A1', 'Línea de Ensamblaje A: Estación 1', 'A', 7), -- A1, B1, C1 are parallel
('A2', 'Línea de Ensamblaje A: Estación 2', 'A', 8),
('A3', 'Línea de Ensamblaje A: Estación 3', 'A', 9),
('A4', 'Línea de Ensamblaje A: Estación 4', 'A', 10),
('A5', 'Línea de Ensamblaje A: Estación 5', 'A', 11),
('A6', 'Línea de Ensamblaje A: Estación 6', 'A', 12),
('B1', 'Línea de Ensamblaje B: Estación 1', 'B', 7), -- A1, B1, C1 are parallel
('B2', 'Línea de Ensamblaje B: Estación 2', 'B', 8),
('B3', 'Línea de Ensamblaje B: Estación 3', 'B', 9),
('B4', 'Línea de Ensamblaje B: Estación 4', 'B', 10),
('B5', 'Línea de Ensamblaje B: Estación 5', 'B', 11),
('B6', 'Línea de Ensamblaje B: Estación 6', 'B', 12),
('C1', 'Línea de Ensamblaje C: Estación 1', 'C', 7), -- A1, B1, C1 are parallel
('C2', 'Línea de Ensamblaje C: Estación 2', 'C', 8),
('C3', 'Línea de Ensamblaje C: Estación 3', 'C', 9),
('C4', 'Línea de Ensamblaje C: Estación 4', 'C', 10),
('C5', 'Línea de Ensamblaje C: Estación 5', 'C', 11),
('C6', 'Línea de Ensamblaje C: Estación 6', 'C', 12);
