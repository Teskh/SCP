-- Drop existing tables (order matters for foreign keys, drop dependent tables first)
DROP TABLE IF EXISTS TaskPauses;
DROP TABLE IF EXISTS TaskLogs;
DROP TABLE IF EXISTS TaskDefinitions;
DROP TABLE IF EXISTS Modules;
DROP TABLE IF EXISTS ProductionPlan; -- Added: Drop new table
DROP TABLE IF EXISTS ProjectModules;
DROP TABLE IF EXISTS HouseTypePanels;
DROP TABLE IF EXISTS Multiwalls;
DROP TABLE IF EXISTS HouseTypeParameters;
DROP TABLE IF EXISTS HouseParameters;
DROP TABLE IF EXISTS HouseTypeTipologias; -- Added: Drop new table
DROP TABLE IF EXISTS HouseTypes;
DROP TABLE IF EXISTS Projects;
DROP TABLE IF EXISTS Stations;
DROP TABLE IF EXISTS Workers; -- Drop Workers before Specialties if supervisor FK is enforced strictly
DROP TABLE IF EXISTS Specialties;
DROP TABLE IF EXISTS AdminTeam;


-- Recreate tables

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

-- ========= Projects =========

CREATE TABLE Projects (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Maple Street Development - Phase 1'
    description TEXT,
    status TEXT DEFAULT 'Planned' -- e.g., 'Planned', 'Active', 'Completed', 'On Hold'
);

CREATE TABLE ProjectModules (
    project_module_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL, -- Renamed from module_type_id
    quantity INTEGER NOT NULL,  -- Number of this house type in the project
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    -- Unique constraint to prevent duplicates: one entry per project-house type pair
    UNIQUE (project_id, house_type_id)
);

-- Specialties table is created earlier now

CREATE TABLE Stations (
    station_id TEXT PRIMARY KEY, -- e.g., 'W1', 'W2', ..., 'W5', 'M1', 'A1', ..., 'A6', 'B1', ..., 'C6'
    name TEXT NOT NULL, -- e.g., 'Panel Line 1: Framing', 'Buffer Magazine', 'Assembly Line A: Station 1'
    line_type TEXT NOT NULL, -- 'W', 'M', 'A', 'B', 'C'
    sequence_order INTEGER NOT NULL -- For sorting/determining flow (e.g., W1=1, W5=5, M1=6, A1=7, B1=7, C1=7, A2=8, B2=8, C2=8 ...)
);

-- ========= Production Plan =========

CREATE TABLE ProductionPlan (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL,
    house_identifier TEXT NOT NULL, -- Unique identifier for this house instance within the project (e.g., "ProjectX-Lot-12")
    module_sequence_in_house INTEGER NOT NULL, -- Which module of the house this plan item represents (1-based)
    planned_sequence INTEGER NOT NULL, -- Overall production order across all projects/plans
    planned_start_datetime TEXT NOT NULL, -- ISO8601 format recommended (YYYY-MM-DD HH:MM:SS)
    planned_assembly_line TEXT NOT NULL CHECK(planned_assembly_line IN ('A', 'B', 'C')), -- Which line it's planned for
    tipologia_id INTEGER, -- Added: Link to the specific tipologia for this planned item
    status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned', 'Scheduled', 'In Progress', 'Completed', 'On Hold', 'Cancelled')), -- Status of this planned item
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Consider adding triggers to update this automatically
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE, -- If project deleted, delete plan items
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE RESTRICT, -- Don't allow deleting house type if planned
    FOREIGN KEY (tipologia_id) REFERENCES HouseTypeTipologias(tipologia_id) ON DELETE SET NULL, -- Added FK: If tipologia deleted, set plan item's tipologia to NULL
    -- Ensure house identifier + module sequence is unique within a project
    UNIQUE (project_id, house_identifier, module_sequence_in_house)
    -- UNIQUE (planned_sequence) -- Should sequence be globally unique? Maybe not strictly necessary, allows reordering.
);

-- Indexes for ProductionPlan
CREATE INDEX idx_productionplan_project ON ProductionPlan (project_id);
CREATE INDEX idx_productionplan_house_type ON ProductionPlan (house_type_id);
CREATE INDEX idx_productionplan_sequence ON ProductionPlan (planned_sequence);
CREATE INDEX idx_productionplan_start_datetime ON ProductionPlan (planned_start_datetime);
CREATE INDEX idx_productionplan_status ON ProductionPlan (status);
CREATE INDEX idx_productionplan_tipologia ON ProductionPlan (tipologia_id); -- Added index for tipologia FK
-- Updated index for the unique constraint
CREATE INDEX idx_productionplan_identifier_module ON ProductionPlan (project_id, house_identifier, module_sequence_in_house);


CREATE TABLE Modules (
    module_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL, -- Which type of house this module belongs to
    module_sequence_in_house INTEGER, -- e.g., 1 of 2, 2 of 2 for a 2-module house
    planned_assembly_line TEXT, -- 'A', 'B', or 'C'. Relevant for modules leaving M1. Nullable initially.
    current_station_id TEXT, -- Foreign Key to Stations table. Tracks the module's physical location. Nullable if not yet on the line.
    status TEXT DEFAULT 'Planned', -- e.g., 'Planned', 'In Progress', 'Completed', 'On Hold'
    last_moved_at TEXT, -- Timestamp of the last move, useful for tracking flow
    plan_id INTEGER, -- Added: Link back to the specific production plan item this module belongs to
    FOREIGN KEY (project_id) REFERENCES Projects(project_id),
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id),
    FOREIGN KEY (current_station_id) REFERENCES Stations(station_id) ON UPDATE CASCADE ON DELETE SET NULL, -- Or RESTRICT? Decide policy.
    FOREIGN KEY (plan_id) REFERENCES ProductionPlan(plan_id) ON DELETE SET NULL -- If plan item is deleted, unlink module but don't delete module? Or CASCADE? Let's use SET NULL for now.
);

-- ========= Task Definitions =========

CREATE TABLE TaskDefinitions (
    task_definition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Install Window Frame', 'Run Hot Water Line', 'Attach Exterior Cladding'
    description TEXT,
    house_type_id INTEGER, -- Which type of house this task applies to (can be NULL if generic)
    specialty_id INTEGER, -- Optional: Link task to a specific specialty
    station_sequence_order INTEGER, -- Optional: Link task to a specific production sequence step (e.g., 1 for W1, 7 for A1/B1/C1)
    task_dependencies TEXT, -- Comma-separated list of prerequisite task_definition_ids (e.g., "1,5,8")
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE SET NULL, -- Allow house type deletion without deleting task def
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id) ON DELETE SET NULL -- Allow specialty deletion without deleting task def
    -- No direct FK to Stations.sequence_order as it's not unique
);

-- ========= Task Execution Tracking =========

CREATE TABLE TaskLogs (
    task_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL, -- Which specific module instance
    task_definition_id INTEGER NOT NULL, -- Which task definition was performed
    worker_id INTEGER NOT NULL, -- Who performed it
    panel_id INTEGER, -- Added: Optional link to a specific panel if the task is panel-specific
    status TEXT NOT NULL, -- 'Not Started', 'In Progress', 'Completed', 'Paused'
    started_at TEXT, -- Timestamp (ISO8601 format)
    completed_at TEXT, -- Timestamp (ISO8601 format)
    station_start TEXT, -- Added: Record the station where the task was started
    station_finish TEXT, -- Renamed: Record the actual station where it was marked complete (Nullable)
    notes TEXT, -- Optional field for worker comments
    FOREIGN KEY (module_id) REFERENCES Modules(module_id),
    FOREIGN KEY (task_definition_id) REFERENCES TaskDefinitions(task_definition_id),
    FOREIGN KEY (worker_id) REFERENCES Workers(worker_id),
    FOREIGN KEY (panel_id) REFERENCES HouseTypePanels(house_type_panel_id) ON DELETE SET NULL, -- Added FK: If panel definition is deleted, set task log's panel_id to NULL
    FOREIGN KEY (station_start) REFERENCES Stations(station_id) ON DELETE SET NULL, -- Added FK: If station is deleted, set station_start to NULL
    FOREIGN KEY (station_finish) REFERENCES Stations(station_id) ON DELETE RESTRICT -- Renamed FK: Don't allow deleting station if tasks were completed there
);

CREATE TABLE TaskPauses (
    task_pause_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_log_id INTEGER NOT NULL, -- Links to the specific task instance being paused
    paused_by_worker_id INTEGER NOT NULL,
    paused_at TEXT NOT NULL, -- Timestamp (ISO8601 format)
    resumed_at TEXT, -- Timestamp (ISO8601 format), Nullable if still paused
    reason TEXT, -- e.g., 'Waiting for materials', 'Shift change', 'Equipment issue'
    FOREIGN KEY (task_log_id) REFERENCES TaskLogs(task_log_id) ON DELETE CASCADE, -- If the task log entry is deleted, pauses are irrelevant
    FOREIGN KEY (paused_by_worker_id) REFERENCES Workers(worker_id)
);

-- ========= Indexes for Performance =========
-- Index frequently queried foreign keys and status columns
CREATE INDEX idx_modules_current_station ON Modules (current_station_id);
CREATE INDEX idx_modules_project ON Modules (project_id);
CREATE INDEX idx_modules_status ON Modules (status);
CREATE INDEX idx_modules_house_type ON Modules (house_type_id);
CREATE INDEX idx_modules_plan_id ON Modules (plan_id); -- Added index
CREATE INDEX idx_taskdefinitions_house_type ON TaskDefinitions (house_type_id);
CREATE INDEX idx_taskdefinitions_specialty ON TaskDefinitions (specialty_id);
CREATE INDEX idx_taskdefinitions_station_sequence ON TaskDefinitions (station_sequence_order); -- Renamed index
CREATE INDEX idx_tasklogs_module ON TaskLogs (module_id);
CREATE INDEX idx_tasklogs_task_definition ON TaskLogs (task_definition_id);
CREATE INDEX idx_tasklogs_status ON TaskLogs (status);
CREATE INDEX idx_tasklogs_worker ON TaskLogs (worker_id);
CREATE INDEX idx_tasklogs_panel ON TaskLogs (panel_id); -- Added index for panel_id
CREATE INDEX idx_tasklogs_station_start ON TaskLogs (station_start); -- Added index for station_start
CREATE INDEX idx_tasklogs_station_finish ON TaskLogs (station_finish); -- Renamed index
CREATE INDEX idx_taskpauses_tasklog ON TaskPauses (task_log_id);
CREATE INDEX idx_projectmodules_project ON ProjectModules (project_id);
CREATE INDEX idx_projectmodules_house_type ON ProjectModules (house_type_id);
CREATE INDEX idx_projects_name ON Projects (name);
CREATE INDEX idx_projects_status ON Projects (status);

-- ========= House Types and Parameters =========

CREATE TABLE HouseTypes (
    house_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Single Family Townhouse A', 'Lakehouse type B'
    description TEXT,
    number_of_modules INTEGER NOT NULL DEFAULT 1 -- How many physical modules make up this house type
);

-- Added: Table for Tipologias associated with a HouseType
CREATE TABLE HouseTypeTipologias (
    tipologia_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g., 'Single', 'Duplex', 'Standard', 'Premium'
    description TEXT,
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    UNIQUE (house_type_id, name) -- Tipologia name must be unique within a house type
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
    tipologia_id INTEGER, -- Nullable FK: If NULL, applies to all typologies for the module. If set, applies only to this specific typology.
    value REAL NOT NULL, -- Using REAL to accommodate various numeric types (integers, decimals)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_id) REFERENCES HouseParameters(parameter_id) ON DELETE CASCADE,
    FOREIGN KEY (tipologia_id) REFERENCES HouseTypeTipologias(tipologia_id) ON DELETE CASCADE, -- If typology deleted, delete specific param values
    -- Ensure only one value per parameter per module sequence *per specific typology* OR one value for *all typologies* (NULL)
    UNIQUE (house_type_id, parameter_id, module_sequence_number, tipologia_id)
);

-- Indexes for new tables
CREATE INDEX idx_housetypetipologias_house_type ON HouseTypeTipologias (house_type_id); -- Index for Tipologias FK
CREATE INDEX idx_housetypeparameters_house_type ON HouseTypeParameters (house_type_id);
CREATE INDEX idx_housetypeparameters_parameter ON HouseTypeParameters (parameter_id);
CREATE INDEX idx_housetypeparameters_module_seq ON HouseTypeParameters (module_sequence_number);
CREATE INDEX idx_housetypeparameters_tipologia ON HouseTypeParameters (tipologia_id); -- Index for Tipologia FK
CREATE INDEX idx_housetypeparameters_composite ON HouseTypeParameters (house_type_id, parameter_id, module_sequence_number, tipologia_id); -- Index for the unique constraint

-- ========= House Type Panels =========

CREATE TABLE HouseTypePanels (
    house_type_panel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL, -- Which module within the house type this panel belongs to (1-based index)
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros')), -- Category of the panel
    panel_code TEXT NOT NULL, -- Identifier/name of the panel
    typology TEXT, -- Optional: Specific typology this panel applies to (NULL means applies to all)
    multiwall_id INTEGER, -- Optional: Link to a Multiwall
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    FOREIGN KEY (multiwall_id) REFERENCES Multiwalls(multiwall_id) ON DELETE SET NULL, -- If multiwall is deleted, unlink panels
    -- Ensure panel code is unique within the same house type, module, and group (allowing same code in different groups/modules)
    -- Note: Uniqueness constraint does not involve multiwall_id directly. A panel code must be unique within its group/module regardless of multiwall assignment.
    UNIQUE (house_type_id, module_sequence_number, panel_group, panel_code)
);

-- Indexes for HouseTypePanels
CREATE INDEX idx_housetypepanels_house_type_module ON HouseTypePanels (house_type_id, module_sequence_number);
CREATE INDEX idx_housetypepanels_group ON HouseTypePanels (panel_group);
CREATE INDEX idx_housetypepanels_multiwall ON HouseTypePanels (multiwall_id); -- Added index for FK


-- ========= Multiwalls =========

CREATE TABLE Multiwalls (
    multiwall_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL,
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros')), -- Must match panel group
    multiwall_code TEXT NOT NULL, -- Identifier for the multiwall (e.g., MW-01)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    -- Ensure multiwall code is unique within the same house type, module, and group
    UNIQUE (house_type_id, module_sequence_number, panel_group, multiwall_code)
);

-- Indexes for Multiwalls
CREATE INDEX idx_multiwalls_house_type_module ON Multiwalls (house_type_id, module_sequence_number);
CREATE INDEX idx_multiwalls_group ON Multiwalls (panel_group);


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
