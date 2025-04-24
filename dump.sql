PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE Specialties (
    specialty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Electrician', 'Plumber', 'Framer'
    description TEXT
);
INSERT INTO Specialties VALUES(1,'Carpintero','');
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
CREATE TABLE Projects (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Maple Street Development - Phase 1'
    description TEXT,
    status TEXT DEFAULT 'Planned' -- e.g., 'Planned', 'Active', 'Completed', 'On Hold'
);
INSERT INTO Projects VALUES(2,'Las Bandurrias','','Active');
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
INSERT INTO ProjectModules VALUES(3,1,1,68);
INSERT INTO ProjectModules VALUES(5,2,1,68);
CREATE TABLE Stations (
    station_id TEXT PRIMARY KEY, -- e.g., 'W1', 'W2', ..., 'W5', 'M1', 'A1', ..., 'A6', 'B1', ..., 'C6'
    name TEXT NOT NULL, -- e.g., 'Panel Line 1: Framing', 'Buffer Magazine', 'Assembly Line A: Station 1'
    line_type TEXT NOT NULL, -- 'W', 'M', 'A', 'B', 'C'
    sequence_order INTEGER NOT NULL -- For sorting/determining flow (e.g., W1=1, W5=5, M1=6, A1=7, B1=7, C1=7, A2=8, B2=8, C2=8 ...)
);
INSERT INTO Stations VALUES('W1','LÃ­znea de Paneles 1: EstaciÃ³n de Estructura','W',1);
INSERT INTO Stations VALUES('W2','LÃ­nea de Paneles 2: EstaciÃ³n de Revestimiento PLI 1','W',2);
INSERT INTO Stations VALUES('W3','LÃ­nea de Paneles 3: EstaciÃ³n de Revestimiento PLI 2','W',3);
INSERT INTO Stations VALUES('W4','LÃ­nea de Paneles 4: EstaciÃ³n de Revestimiento PLA 1','W',4);
INSERT INTO Stations VALUES('W5','LÃ­nea de Paneles 5: EstaciÃ³n de Revestimiento PLA 2','W',5);
INSERT INTO Stations VALUES('M1','Magazine','M',6);
INSERT INTO Stations VALUES('A1','LÃ­nea de Ensamblaje A: EstaciÃ³n 1','A',7);
INSERT INTO Stations VALUES('A2','LÃ­nea de Ensamblaje A: EstaciÃ³n 2','A',8);
INSERT INTO Stations VALUES('A3','LÃ­nea de Ensamblaje A: EstaciÃ³n 3','A',9);
INSERT INTO Stations VALUES('A4','LÃ­nea de Ensamblaje A: EstaciÃ³n 4','A',10);
INSERT INTO Stations VALUES('A5','LÃ­nea de Ensamblaje A: EstaciÃ³n 5','A',11);
INSERT INTO Stations VALUES('A6','LÃ­nea de Ensamblaje A: EstaciÃ³n 6','A',12);
INSERT INTO Stations VALUES('B1','LÃ­nea de Ensamblaje B: EstaciÃ³n 1','B',7);
INSERT INTO Stations VALUES('B2','LÃ­nea de Ensamblaje B: EstaciÃ³n 2','B',8);
INSERT INTO Stations VALUES('B3','LÃ­nea de Ensamblaje B: EstaciÃ³n 3','B',9);
INSERT INTO Stations VALUES('B4','LÃ­nea de Ensamblaje B: EstaciÃ³n 4','B',10);
INSERT INTO Stations VALUES('B5','LÃ­nea de Ensamblaje B: EstaciÃ³n 5','B',11);
INSERT INTO Stations VALUES('B6','LÃ­nea de Ensamblaje B: EstaciÃ³n 6','B',12);
INSERT INTO Stations VALUES('C1','LÃ­nea de Ensamblaje C: EstaciÃ³n 1','C',7);
INSERT INTO Stations VALUES('C2','LÃ­nea de Ensamblaje C: EstaciÃ³n 2','C',8);
INSERT INTO Stations VALUES('C3','LÃ­nea de Ensamblaje C: EstaciÃ³n 3','C',9);
INSERT INTO Stations VALUES('C4','LÃ­nea de Ensamblaje C: EstaciÃ³n 4','C',10);
INSERT INTO Stations VALUES('C5','LÃ­nea de Ensamblaje C: EstaciÃ³n 5','C',11);
INSERT INTO Stations VALUES('C6','LÃ­nea de Ensamblaje C: EstaciÃ³n 6','C',12);
CREATE TABLE ProductionPlan (
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL,
    house_identifier TEXT NOT NULL, -- Unique identifier for this house instance within the project (e.g., "ProjectX-Lot-12")
    planned_sequence INTEGER NOT NULL, -- Overall production order across all projects/plans
    planned_start_datetime TEXT NOT NULL, -- ISO8601 format recommended (YYYY-MM-DD HH:MM:SS)
    planned_assembly_line TEXT NOT NULL CHECK(planned_assembly_line IN ('A', 'B', 'C')), -- Which line it's planned for
    status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned', 'Scheduled', 'In Progress', 'Completed', 'On Hold', 'Cancelled')), -- Status of this planned item
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Consider adding triggers to update this automatically
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE, -- If project deleted, delete plan items
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE RESTRICT, -- Don't allow deleting house type if planned
    UNIQUE (project_id, house_identifier) -- Ensure house identifier is unique within a project
    -- UNIQUE (planned_sequence) -- Should sequence be globally unique? Maybe not strictly necessary, allows reordering.
);
INSERT INTO ProductionPlan VALUES(2,1,1,'1-a-1',1,'2025-05-09 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(3,1,1,'1-a-2',2,'2025-05-10 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(4,1,1,'1-a-3',3,'2025-05-11 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(5,1,1,'1-a-4',4,'2025-05-12 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(6,1,1,'1-a-5',5,'2025-05-13 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(7,1,1,'1-a-6',6,'2025-05-14 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(8,1,1,'1-a-7',7,'2025-05-15 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(9,1,1,'1-a-8',8,'2025-05-16 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(10,1,1,'1-a-9',9,'2025-05-17 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(11,1,1,'1-a-10',10,'2025-05-18 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(12,1,1,'1-a-11',11,'2025-05-19 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(13,1,1,'1-a-12',12,'2025-05-20 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(14,1,1,'1-a-13',13,'2025-05-21 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(15,1,1,'1-a-14',14,'2025-05-22 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(16,1,1,'1-a-15',15,'2025-05-23 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(17,1,1,'1-a-16',16,'2025-05-24 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(18,1,1,'1-a-17',17,'2025-05-25 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(19,1,1,'1-a-18',18,'2025-05-26 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(20,1,1,'1-a-19',19,'2025-05-27 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(21,1,1,'1-a-20',20,'2025-05-28 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(22,1,1,'1-a-21',21,'2025-05-29 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(23,1,1,'1-a-22',22,'2025-05-30 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(24,1,1,'1-a-23',23,'2025-05-31 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(25,1,1,'1-a-24',24,'2025-06-01 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(26,1,1,'1-a-25',25,'2025-06-02 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(27,1,1,'1-a-26',26,'2025-06-03 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(28,1,1,'1-a-27',27,'2025-06-04 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(29,1,1,'1-a-28',28,'2025-06-05 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(30,1,1,'1-a-29',29,'2025-06-06 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(31,1,1,'1-a-30',30,'2025-06-07 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(32,1,1,'1-a-31',31,'2025-06-08 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(33,1,1,'1-a-32',32,'2025-06-09 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(34,1,1,'1-a-33',33,'2025-06-10 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(35,1,1,'1-a-34',34,'2025-06-11 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(36,1,1,'1-a-35',35,'2025-06-12 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(37,1,1,'1-a-36',36,'2025-06-13 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(38,1,1,'1-a-37',37,'2025-06-14 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(39,1,1,'1-a-38',38,'2025-06-15 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(40,1,1,'1-a-39',39,'2025-06-16 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(41,1,1,'1-a-40',40,'2025-06-17 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(42,1,1,'1-a-41',41,'2025-06-18 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(43,1,1,'1-a-42',42,'2025-06-19 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(44,1,1,'1-a-43',43,'2025-06-20 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(45,1,1,'1-a-44',44,'2025-06-21 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(46,1,1,'1-a-45',45,'2025-06-22 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(47,1,1,'1-a-46',46,'2025-06-23 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(48,1,1,'1-a-47',47,'2025-06-24 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(49,1,1,'1-a-48',48,'2025-06-25 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(50,1,1,'1-a-49',49,'2025-06-26 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(51,1,1,'1-a-50',50,'2025-06-27 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(52,1,1,'1-a-51',51,'2025-06-28 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(53,1,1,'1-a-52',52,'2025-06-29 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(54,1,1,'1-a-53',53,'2025-06-30 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(55,1,1,'1-a-54',54,'2025-07-01 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(56,1,1,'1-a-55',55,'2025-07-02 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(57,1,1,'1-a-56',56,'2025-07-03 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(58,1,1,'1-a-57',57,'2025-07-04 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(59,1,1,'1-a-58',58,'2025-07-05 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(60,1,1,'1-a-59',59,'2025-07-06 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(61,1,1,'1-a-60',60,'2025-07-07 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(62,1,1,'1-a-61',61,'2025-07-08 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(63,1,1,'1-a-62',62,'2025-07-09 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(64,1,1,'1-a-63',63,'2025-07-10 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(65,1,1,'1-a-64',64,'2025-07-11 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(66,1,1,'1-a-65',65,'2025-07-12 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(67,1,1,'1-a-66',66,'2025-07-13 08:00:00','C','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(68,1,1,'1-a-67',67,'2025-07-14 08:00:00','A','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(69,1,1,'1-a-68',68,'2025-07-15 08:00:00','B','Planned','2025-04-24 01:06:22','2025-04-24 01:06:22');
INSERT INTO ProductionPlan VALUES(70,2,1,'Las Bandurrias-THS-1',69,'2025-04-23 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(71,2,1,'Las Bandurrias-THS-2',70,'2025-04-24 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(72,2,1,'Las Bandurrias-THS-3',71,'2025-04-24 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(73,2,1,'Las Bandurrias-THS-4',72,'2025-04-24 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(74,2,1,'Las Bandurrias-THS-5',73,'2025-04-25 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(75,2,1,'Las Bandurrias-THS-6',74,'2025-04-25 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(76,2,1,'Las Bandurrias-THS-7',75,'2025-04-25 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(77,2,1,'Las Bandurrias-THS-8',76,'2025-04-26 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(78,2,1,'Las Bandurrias-THS-9',77,'2025-04-26 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(79,2,1,'Las Bandurrias-THS-10',78,'2025-04-26 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(80,2,1,'Las Bandurrias-THS-11',79,'2025-04-27 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(81,2,1,'Las Bandurrias-THS-12',80,'2025-04-27 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(82,2,1,'Las Bandurrias-THS-13',81,'2025-04-27 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(83,2,1,'Las Bandurrias-THS-14',82,'2025-04-28 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(84,2,1,'Las Bandurrias-THS-15',83,'2025-04-28 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(85,2,1,'Las Bandurrias-THS-16',84,'2025-04-28 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(86,2,1,'Las Bandurrias-THS-17',85,'2025-04-29 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(87,2,1,'Las Bandurrias-THS-18',86,'2025-04-29 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(88,2,1,'Las Bandurrias-THS-19',87,'2025-04-29 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(89,2,1,'Las Bandurrias-THS-20',88,'2025-04-30 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(90,2,1,'Las Bandurrias-THS-21',89,'2025-04-30 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(91,2,1,'Las Bandurrias-THS-22',90,'2025-04-30 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(92,2,1,'Las Bandurrias-THS-23',91,'2025-05-01 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(93,2,1,'Las Bandurrias-THS-24',92,'2025-05-01 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(94,2,1,'Las Bandurrias-THS-25',93,'2025-05-01 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(95,2,1,'Las Bandurrias-THS-26',94,'2025-05-02 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(96,2,1,'Las Bandurrias-THS-27',95,'2025-05-02 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(97,2,1,'Las Bandurrias-THS-28',96,'2025-05-02 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(98,2,1,'Las Bandurrias-THS-29',97,'2025-05-03 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(99,2,1,'Las Bandurrias-THS-30',98,'2025-05-03 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(100,2,1,'Las Bandurrias-THS-31',99,'2025-05-03 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(101,2,1,'Las Bandurrias-THS-32',100,'2025-05-04 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(102,2,1,'Las Bandurrias-THS-33',101,'2025-05-04 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(103,2,1,'Las Bandurrias-THS-34',102,'2025-05-04 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(104,2,1,'Las Bandurrias-THS-35',103,'2025-05-05 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(105,2,1,'Las Bandurrias-THS-36',104,'2025-05-05 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(106,2,1,'Las Bandurrias-THS-37',105,'2025-05-05 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(107,2,1,'Las Bandurrias-THS-38',106,'2025-05-06 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(108,2,1,'Las Bandurrias-THS-39',107,'2025-05-06 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(109,2,1,'Las Bandurrias-THS-40',108,'2025-05-06 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(110,2,1,'Las Bandurrias-THS-41',109,'2025-05-07 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(111,2,1,'Las Bandurrias-THS-42',110,'2025-05-07 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(112,2,1,'Las Bandurrias-THS-43',111,'2025-05-07 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(113,2,1,'Las Bandurrias-THS-44',112,'2025-05-08 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(114,2,1,'Las Bandurrias-THS-45',113,'2025-05-08 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(115,2,1,'Las Bandurrias-THS-46',114,'2025-05-08 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(116,2,1,'Las Bandurrias-THS-47',115,'2025-05-09 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(117,2,1,'Las Bandurrias-THS-48',116,'2025-05-09 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(118,2,1,'Las Bandurrias-THS-49',117,'2025-05-09 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(119,2,1,'Las Bandurrias-THS-50',118,'2025-05-10 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(120,2,1,'Las Bandurrias-THS-51',119,'2025-05-10 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(121,2,1,'Las Bandurrias-THS-52',120,'2025-05-10 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(122,2,1,'Las Bandurrias-THS-53',121,'2025-05-11 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(123,2,1,'Las Bandurrias-THS-54',122,'2025-05-11 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(124,2,1,'Las Bandurrias-THS-55',123,'2025-05-11 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(125,2,1,'Las Bandurrias-THS-56',124,'2025-05-12 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(126,2,1,'Las Bandurrias-THS-57',125,'2025-05-12 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(127,2,1,'Las Bandurrias-THS-58',126,'2025-05-12 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(128,2,1,'Las Bandurrias-THS-59',127,'2025-05-13 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(129,2,1,'Las Bandurrias-THS-60',128,'2025-05-13 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(130,2,1,'Las Bandurrias-THS-61',129,'2025-05-13 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(131,2,1,'Las Bandurrias-THS-62',130,'2025-05-14 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(132,2,1,'Las Bandurrias-THS-63',131,'2025-05-14 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(133,2,1,'Las Bandurrias-THS-64',132,'2025-05-14 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(134,2,1,'Las Bandurrias-THS-65',133,'2025-05-15 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(135,2,1,'Las Bandurrias-THS-66',134,'2025-05-15 13:12:09','C','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(136,2,1,'Las Bandurrias-THS-67',135,'2025-05-15 21:12:09','A','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
INSERT INTO ProductionPlan VALUES(137,2,1,'Las Bandurrias-THS-68',136,'2025-05-16 05:12:09','B','Planned','2025-04-24 01:12:09','2025-04-24 01:12:09');
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
CREATE TABLE HouseTypes (
    house_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Single Family Townhouse A', 'Lakehouse type B'
    description TEXT,
    number_of_modules INTEGER NOT NULL DEFAULT 1 -- How many physical modules make up this house type
);
INSERT INTO HouseTypes VALUES(1,'THS','',2);
CREATE TABLE HouseParameters (
    parameter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Floor Area', 'Number of Windows', 'Exterior Wall Length'
    unit TEXT -- e.g., 'Square Meters', 'Count', 'Linear Meters'
);
INSERT INTO HouseParameters VALUES(1,'Área de Piso','m2');
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
CREATE TABLE HouseTypePanels (
    house_type_panel_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL, -- Which module within the house type this panel belongs to (1-based index)
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas CajÃ³n', 'Otros')), -- Category of the panel
    panel_code TEXT NOT NULL, -- Identifier/name of the panel
    typology TEXT, -- Optional: Specific typology this panel applies to (NULL means applies to all)
    multiwall_id INTEGER, -- Optional: Link to a Multiwall
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    FOREIGN KEY (multiwall_id) REFERENCES Multiwalls(multiwall_id) ON DELETE SET NULL, -- If multiwall is deleted, unlink panels
    -- Ensure panel code is unique within the same house type, module, and group (allowing same code in different groups/modules)
    -- Note: Uniqueness constraint does not involve multiwall_id directly. A panel code must be unique within its group/module regardless of multiwall assignment.
    UNIQUE (house_type_id, module_sequence_number, panel_group, panel_code)
);
CREATE TABLE Multiwalls (
    multiwall_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL,
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas CajÃ³n', 'Otros')), -- Must match panel group
    multiwall_code TEXT NOT NULL, -- Identifier for the multiwall (e.g., MW-01)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    -- Ensure multiwall code is unique within the same house type, module, and group
    UNIQUE (house_type_id, module_sequence_number, panel_group, multiwall_code)
);
CREATE TABLE AdminTeam (
    admin_team_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Supervisor', 'GestiÃ³n de producciÃ³n', 'Admin')), -- Define allowed roles
    pin TEXT NOT NULL UNIQUE, -- Assuming PIN should be unique for admin team members too
    is_active INTEGER DEFAULT 1 -- Boolean (0=false, 1=true)
);
INSERT INTO AdminTeam VALUES(1,'César','Villarroel','Supervisor','1234',1);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('HouseTypes',1);
INSERT INTO sqlite_sequence VALUES('HouseParameters',1);
INSERT INTO sqlite_sequence VALUES('Specialties',1);
INSERT INTO sqlite_sequence VALUES('AdminTeam',1);
INSERT INTO sqlite_sequence VALUES('Projects',2);
INSERT INTO sqlite_sequence VALUES('ProjectModules',5);
INSERT INTO sqlite_sequence VALUES('ProductionPlan',137);
CREATE INDEX idx_productionplan_project ON ProductionPlan (project_id);
CREATE INDEX idx_productionplan_house_type ON ProductionPlan (house_type_id);
CREATE INDEX idx_productionplan_sequence ON ProductionPlan (planned_sequence);
CREATE INDEX idx_productionplan_start_datetime ON ProductionPlan (planned_start_datetime);
CREATE INDEX idx_productionplan_status ON ProductionPlan (status);
CREATE INDEX idx_productionplan_identifier ON ProductionPlan (project_id, house_identifier);
CREATE INDEX idx_modules_current_station ON Modules (current_station_id);
CREATE INDEX idx_modules_project ON Modules (project_id);
CREATE INDEX idx_modules_status ON Modules (status);
CREATE INDEX idx_modules_house_type ON Modules (house_type_id);
CREATE INDEX idx_modules_plan_id ON Modules (plan_id);
CREATE INDEX idx_taskdefinitions_house_type ON TaskDefinitions (house_type_id);
CREATE INDEX idx_taskdefinitions_specialty ON TaskDefinitions (specialty_id);
CREATE INDEX idx_taskdefinitions_station ON TaskDefinitions (station_id);
CREATE INDEX idx_tasklogs_module ON TaskLogs (module_id);
CREATE INDEX idx_tasklogs_task_definition ON TaskLogs (task_definition_id);
CREATE INDEX idx_tasklogs_status ON TaskLogs (status);
CREATE INDEX idx_tasklogs_worker ON TaskLogs (worker_id);
CREATE INDEX idx_taskpauses_tasklog ON TaskPauses (task_log_id);
CREATE INDEX idx_projectmodules_project ON ProjectModules (project_id);
CREATE INDEX idx_projectmodules_house_type ON ProjectModules (house_type_id);
CREATE INDEX idx_projects_name ON Projects (name);
CREATE INDEX idx_projects_status ON Projects (status);
CREATE INDEX idx_housetypeparameters_house_type ON HouseTypeParameters (house_type_id);
CREATE INDEX idx_housetypeparameters_parameter ON HouseTypeParameters (parameter_id);
CREATE INDEX idx_housetypeparameters_module_seq ON HouseTypeParameters (module_sequence_number);
CREATE INDEX idx_housetypeparameters_composite ON HouseTypeParameters (house_type_id, parameter_id, module_sequence_number);
CREATE INDEX idx_housetypepanels_house_type_module ON HouseTypePanels (house_type_id, module_sequence_number);
CREATE INDEX idx_housetypepanels_group ON HouseTypePanels (panel_group);
CREATE INDEX idx_housetypepanels_multiwall ON HouseTypePanels (multiwall_id);
CREATE INDEX idx_multiwalls_house_type_module ON Multiwalls (house_type_id, module_sequence_number);
CREATE INDEX idx_multiwalls_group ON Multiwalls (panel_group);
CREATE INDEX idx_adminteam_role ON AdminTeam (role);
CREATE INDEX idx_adminteam_is_active ON AdminTeam (is_active);
COMMIT;
