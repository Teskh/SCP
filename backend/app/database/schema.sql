CREATE TABLE Workers (
    worker_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    pin TEXT NOT NULL,
    specialty_id INTEGER, -- Foreign Key to Specialties table
    supervisor_id INTEGER, -- Foreign Key to Workers table (self-referencing), nullable
    is_active INTEGER DEFAULT 1, -- Boolean (0=false, 1=true)
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id),
    FOREIGN KEY (supervisor_id) REFERENCES Workers(worker_id)
);

CREATE TABLE Specialties (
    specialty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Electrician', 'Plumber', 'Framer'
    description TEXT
);

CREATE TABLE Stations (
    station_id TEXT PRIMARY KEY, -- e.g., 'W1', 'W2', ..., 'W6', 'M1', 'A1', ..., 'A6', 'B1', ..., 'C6'
    name TEXT NOT NULL, -- e.g., 'Panel Line 1: Framing', 'Buffer Magazine', 'Assembly Line A: Station 1'
    line_type TEXT NOT NULL, -- 'W', 'M', 'A', 'B', 'C'
    sequence_order INTEGER NOT NULL -- For sorting/determining flow (e.g., W1=1, W6=6, M1=7, A1=8, B1=8, C1=8, A2=9, B2=9, C2=9 ...)
);

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
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE
    -- Unique constraint to prevent duplicates: one entry per project-house type pair
    UNIQUE (project_id, house_type_id)
);

CREATE TABLE Modules (
    module_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL, -- Which type of house this module belongs to
    module_sequence_in_house INTEGER, -- e.g., 1 of 2, 2 of 2 for a 2-module house
    planned_assembly_line TEXT, -- 'A', 'B', or 'C'. Relevant for modules leaving M1. Nullable initially.
    current_station_id TEXT, -- Foreign Key to Stations table. Tracks the module's physical location. Nullable if not yet on the line.
    status TEXT DEFAULT 'Planned', -- e.g., 'Planned', 'In Progress', 'Completed', 'On Hold'
    last_moved_at TEXT, -- Timestamp of the last move, useful for tracking flow
    FOREIGN KEY (project_id) REFERENCES Projects(project_id),
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id),
    FOREIGN KEY (current_station_id) REFERENCES Stations(station_id) ON UPDATE CASCADE ON DELETE SET NULL -- Or RESTRICT? Decide policy.
);

-- ========= Task Definitions =========

CREATE TABLE TaskDefinitions (
    task_definition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Install Window Frame', 'Run Hot Water Line', 'Attach Exterior Cladding'
    description TEXT,
    house_type_id INTEGER, -- Which type of house this task applies to (can be NULL if generic)
    specialty_id INTEGER, -- Optional: Link task to a specific specialty
    station_id TEXT, -- Optional: Link task to a specific station (e.g., 'W1', 'A3')
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE SET NULL, -- Allow house type deletion without deleting task def
    FOREIGN KEY (specialty_id) REFERENCES Specialties(specialty_id) ON DELETE SET NULL, -- Allow specialty deletion without deleting task def
    FOREIGN KEY (station_id) REFERENCES Stations(station_id) ON DELETE SET NULL -- Allow station deletion without deleting task def
);

-- ========= Task Execution Tracking =========

CREATE TABLE TaskLogs (
    task_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL, -- Which specific module instance
    task_definition_id INTEGER NOT NULL, -- Which task definition was performed
    worker_id INTEGER NOT NULL, -- Who performed it
    status TEXT NOT NULL, -- 'Not Started', 'In Progress', 'Completed', 'Paused'
    started_at TEXT, -- Timestamp (ISO8601 format)
    completed_at TEXT, -- Timestamp (ISO8601 format)
    station_id_when_completed TEXT NOT NULL, -- Record the actual station where it was marked complete
    notes TEXT, -- Optional field for worker comments
    FOREIGN KEY (module_id) REFERENCES Modules(module_id),
    FOREIGN KEY (task_definition_id) REFERENCES TaskDefinitions(task_definition_id),
    FOREIGN KEY (worker_id) REFERENCES Workers(worker_id),
    FOREIGN KEY (station_id_when_completed) REFERENCES Stations(station_id)
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
CREATE INDEX idx_modules_house_type ON Modules (house_type_id); -- New index
CREATE INDEX idx_taskdefinitions_house_type ON TaskDefinitions (house_type_id); -- Renamed index
CREATE INDEX idx_taskdefinitions_specialty ON TaskDefinitions (specialty_id);
CREATE INDEX idx_taskdefinitions_station ON TaskDefinitions (station_id);
CREATE INDEX idx_tasklogs_module ON TaskLogs (module_id);
CREATE INDEX idx_tasklogs_task_definition ON TaskLogs (task_definition_id);
CREATE INDEX idx_tasklogs_status ON TaskLogs (status);
CREATE INDEX idx_tasklogs_worker ON TaskLogs (worker_id);
CREATE INDEX idx_taskpauses_tasklog ON TaskPauses (task_log_id);
CREATE INDEX idx_projectmodules_project ON ProjectModules (project_id);
CREATE INDEX idx_projectmodules_house_type ON ProjectModules (house_type_id); -- Renamed index

-- ========= House Types and Parameters =========

CREATE TABLE HouseTypes (
    house_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Single Family Townhouse A', 'Lakehouse type B'
    description TEXT,
    number_of_modules INTEGER NOT NULL DEFAULT 1 -- How many physical modules make up this house type
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
    value REAL NOT NULL, -- Using REAL to accommodate various numeric types (integers, decimals)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    FOREIGN KEY (parameter_id) REFERENCES HouseParameters(parameter_id) ON DELETE CASCADE,
    -- Ensure only one value per parameter per module sequence within a house type
    UNIQUE (house_type_id, parameter_id, module_sequence_number)
);

-- Indexes for new tables
CREATE INDEX idx_housetypeparameters_house_type ON HouseTypeParameters (house_type_id);
CREATE INDEX idx_housetypeparameters_parameter ON HouseTypeParameters (parameter_id);
CREATE INDEX idx_housetypeparameters_module_seq ON HouseTypeParameters (module_sequence_number);
CREATE INDEX idx_housetypeparameters_composite ON HouseTypeParameters (house_type_id, parameter_id, module_sequence_number); -- Index for the unique constraint

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
