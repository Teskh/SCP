PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
    specialty_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Electrician', 'Plumber', 'Framer'
    description TEXT
);
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
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Maple Street Development - Phase 1'
    description TEXT,
    status TEXT DEFAULT 'Planned' -- e.g., 'Planned', 'Active', 'Completed', 'On Hold'
);
INSERT INTO Projects VALUES(4,'Las Bandurrias','','Active');
    project_module_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL, -- Renamed from module_type_id
    quantity INTEGER NOT NULL,  -- Number of this house type in the project
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    -- Unique constraint to prevent duplicates: one entry per project-house type pair
    UNIQUE (project_id, house_type_id)
);
INSERT INTO ProjectModules VALUES(4,2,2,7);
INSERT INTO ProjectModules VALUES(9,4,1,50);
    station_id TEXT PRIMARY KEY, -- e.g., 'W1', 'W2', ..., 'W5', 'M1', 'A1', ..., 'A6', 'B1', ..., 'C6'
    name TEXT NOT NULL, -- e.g., 'Panel Line 1: Framing', 'Buffer Magazine', 'Assembly Line A: Station 1'
    line_type TEXT NOT NULL, -- 'W', 'M', 'A', 'B', 'C'
    sequence_order INTEGER NOT NULL -- For sorting/determining flow (e.g., W1=1, W5=5, M1=6, A1=7, B1=7, C1=7, A2=8, B2=8, C2=8 ...)
);
    plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    house_type_id INTEGER NOT NULL,
    house_identifier TEXT NOT NULL, -- Unique identifier for this house instance within the project (e.g., "ProjectX-Lot-12")
    module_sequence_in_house INTEGER NOT NULL, -- Which module of the house this plan item represents (1-based)
    planned_sequence INTEGER NOT NULL, -- Overall production order across all projects/plans
    planned_start_datetime TEXT NOT NULL, -- ISO8601 format recommended (YYYY-MM-DD HH:MM:SS)
    planned_assembly_line TEXT NOT NULL CHECK(planned_assembly_line IN ('A', 'B', 'C')), -- Which line it's planned for
    status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned', 'Scheduled', 'In Progress', 'Completed', 'On Hold', 'Cancelled')), -- Status of this planned item
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Consider adding triggers to update this automatically
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE CASCADE, -- If project deleted, delete plan items
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE RESTRICT, -- Don't allow deleting house type if planned
    -- Ensure house identifier + module sequence is unique within a project
    UNIQUE (project_id, house_identifier, module_sequence_in_house)
    -- UNIQUE (planned_sequence) -- Should sequence be globally unique? Maybe not strictly necessary, allows reordering.
);
INSERT INTO ProductionPlan VALUES(45,4,1,'Las Bandurrias-TH S-1',1,3,'2025-04-26 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(46,4,1,'Las Bandurrias-TH S-1',2,1,'2025-04-27 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(47,4,1,'Las Bandurrias-TH S-2',1,2,'2025-04-27 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(48,4,1,'Las Bandurrias-TH S-2',2,4,'2025-04-27 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(49,4,1,'Las Bandurrias-TH S-3',1,5,'2025-04-28 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(50,4,1,'Las Bandurrias-TH S-3',2,6,'2025-04-28 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(51,4,1,'Las Bandurrias-TH S-4',1,7,'2025-04-28 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(52,4,1,'Las Bandurrias-TH S-4',2,8,'2025-04-29 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(53,4,1,'Las Bandurrias-TH S-5',1,9,'2025-04-29 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(54,4,1,'Las Bandurrias-TH S-5',2,10,'2025-04-29 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(55,4,1,'Las Bandurrias-TH S-6',1,11,'2025-04-30 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(56,4,1,'Las Bandurrias-TH S-6',2,12,'2025-04-30 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(57,4,1,'Las Bandurrias-TH S-7',1,13,'2025-04-30 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(58,4,1,'Las Bandurrias-TH S-7',2,14,'2025-05-01 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(59,4,1,'Las Bandurrias-TH S-8',1,15,'2025-05-01 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(60,4,1,'Las Bandurrias-TH S-8',2,16,'2025-05-01 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(61,4,1,'Las Bandurrias-TH S-9',1,17,'2025-05-02 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(62,4,1,'Las Bandurrias-TH S-9',2,18,'2025-05-02 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(63,4,1,'Las Bandurrias-TH S-10',1,19,'2025-05-02 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(64,4,1,'Las Bandurrias-TH S-10',2,20,'2025-05-03 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(65,4,1,'Las Bandurrias-TH S-11',1,21,'2025-05-03 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(66,4,1,'Las Bandurrias-TH S-11',2,22,'2025-05-03 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(67,4,1,'Las Bandurrias-TH S-12',1,23,'2025-05-04 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(68,4,1,'Las Bandurrias-TH S-12',2,24,'2025-05-04 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(69,4,1,'Las Bandurrias-TH S-13',1,25,'2025-05-04 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(70,4,1,'Las Bandurrias-TH S-13',2,26,'2025-05-05 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(71,4,1,'Las Bandurrias-TH S-14',1,27,'2025-05-05 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(72,4,1,'Las Bandurrias-TH S-14',2,28,'2025-05-05 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(73,4,1,'Las Bandurrias-TH S-15',1,29,'2025-05-06 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(74,4,1,'Las Bandurrias-TH S-15',2,30,'2025-05-06 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(75,4,1,'Las Bandurrias-TH S-16',1,31,'2025-05-06 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(76,4,1,'Las Bandurrias-TH S-16',2,32,'2025-05-07 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(77,4,1,'Las Bandurrias-TH S-17',1,33,'2025-05-07 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(78,4,1,'Las Bandurrias-TH S-17',2,34,'2025-05-07 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(79,4,1,'Las Bandurrias-TH S-18',1,35,'2025-05-08 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(80,4,1,'Las Bandurrias-TH S-18',2,36,'2025-05-08 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(81,4,1,'Las Bandurrias-TH S-19',1,37,'2025-05-08 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(82,4,1,'Las Bandurrias-TH S-19',2,38,'2025-05-09 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(83,4,1,'Las Bandurrias-TH S-20',1,39,'2025-05-09 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(84,4,1,'Las Bandurrias-TH S-20',2,40,'2025-05-09 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(85,4,1,'Las Bandurrias-TH S-21',1,41,'2025-05-10 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(86,4,1,'Las Bandurrias-TH S-21',2,42,'2025-05-10 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(87,4,1,'Las Bandurrias-TH S-22',1,43,'2025-05-10 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(88,4,1,'Las Bandurrias-TH S-22',2,44,'2025-05-11 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(89,4,1,'Las Bandurrias-TH S-23',1,45,'2025-05-11 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(90,4,1,'Las Bandurrias-TH S-23',2,46,'2025-05-11 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(91,4,1,'Las Bandurrias-TH S-24',1,47,'2025-05-12 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(92,4,1,'Las Bandurrias-TH S-24',2,48,'2025-05-12 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(93,4,1,'Las Bandurrias-TH S-25',1,49,'2025-05-12 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(94,4,1,'Las Bandurrias-TH S-25',2,50,'2025-05-13 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(95,4,1,'Las Bandurrias-TH S-26',1,51,'2025-05-13 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(96,4,1,'Las Bandurrias-TH S-26',2,52,'2025-05-13 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(97,4,1,'Las Bandurrias-TH S-27',1,53,'2025-05-14 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(98,4,1,'Las Bandurrias-TH S-27',2,54,'2025-05-14 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(99,4,1,'Las Bandurrias-TH S-28',1,55,'2025-05-14 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(100,4,1,'Las Bandurrias-TH S-28',2,56,'2025-05-15 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(101,4,1,'Las Bandurrias-TH S-29',1,57,'2025-05-15 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(102,4,1,'Las Bandurrias-TH S-29',2,58,'2025-05-15 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(103,4,1,'Las Bandurrias-TH S-30',1,59,'2025-05-16 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(104,4,1,'Las Bandurrias-TH S-30',2,60,'2025-05-16 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(105,4,1,'Las Bandurrias-TH S-31',1,61,'2025-05-16 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(106,4,1,'Las Bandurrias-TH S-31',2,62,'2025-05-17 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(107,4,1,'Las Bandurrias-TH S-32',1,63,'2025-05-17 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(108,4,1,'Las Bandurrias-TH S-32',2,64,'2025-05-17 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(109,4,1,'Las Bandurrias-TH S-33',1,65,'2025-05-18 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(110,4,1,'Las Bandurrias-TH S-33',2,66,'2025-05-18 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(111,4,1,'Las Bandurrias-TH S-34',1,67,'2025-05-18 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(112,4,1,'Las Bandurrias-TH S-34',2,68,'2025-05-19 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(113,4,1,'Las Bandurrias-TH S-35',1,69,'2025-05-19 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(114,4,1,'Las Bandurrias-TH S-35',2,70,'2025-05-19 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(115,4,1,'Las Bandurrias-TH S-36',1,71,'2025-05-20 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(116,4,1,'Las Bandurrias-TH S-36',2,72,'2025-05-20 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(117,4,1,'Las Bandurrias-TH S-37',1,73,'2025-05-20 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(118,4,1,'Las Bandurrias-TH S-37',2,74,'2025-05-21 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(119,4,1,'Las Bandurrias-TH S-38',1,75,'2025-05-21 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(120,4,1,'Las Bandurrias-TH S-38',2,76,'2025-05-21 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(121,4,1,'Las Bandurrias-TH S-39',1,77,'2025-05-22 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(122,4,1,'Las Bandurrias-TH S-39',2,78,'2025-05-22 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(123,4,1,'Las Bandurrias-TH S-40',1,79,'2025-05-22 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(124,4,1,'Las Bandurrias-TH S-40',2,80,'2025-05-23 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(125,4,1,'Las Bandurrias-TH S-41',1,81,'2025-05-23 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(126,4,1,'Las Bandurrias-TH S-41',2,82,'2025-05-23 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(127,4,1,'Las Bandurrias-TH S-42',1,83,'2025-05-24 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(128,4,1,'Las Bandurrias-TH S-42',2,84,'2025-05-24 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(129,4,1,'Las Bandurrias-TH S-43',1,85,'2025-05-24 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(130,4,1,'Las Bandurrias-TH S-43',2,86,'2025-05-25 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(131,4,1,'Las Bandurrias-TH S-44',1,87,'2025-05-25 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(132,4,1,'Las Bandurrias-TH S-44',2,88,'2025-05-25 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(133,4,1,'Las Bandurrias-TH S-45',1,89,'2025-05-26 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(134,4,1,'Las Bandurrias-TH S-45',2,90,'2025-05-26 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(135,4,1,'Las Bandurrias-TH S-46',1,91,'2025-05-26 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(136,4,1,'Las Bandurrias-TH S-46',2,92,'2025-05-27 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(137,4,1,'Las Bandurrias-TH S-47',1,93,'2025-05-27 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(138,4,1,'Las Bandurrias-TH S-47',2,94,'2025-05-27 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(139,4,1,'Las Bandurrias-TH S-48',1,95,'2025-05-28 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(140,4,1,'Las Bandurrias-TH S-48',2,96,'2025-05-28 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(141,4,1,'Las Bandurrias-TH S-49',1,97,'2025-05-28 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(142,4,1,'Las Bandurrias-TH S-49',2,98,'2025-05-29 00:53:05','B','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(143,4,1,'Las Bandurrias-TH S-50',1,99,'2025-05-29 08:53:05','C','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
INSERT INTO ProductionPlan VALUES(144,4,1,'Las Bandurrias-TH S-50',2,100,'2025-05-29 16:53:05','A','Planned','2025-04-26 20:53:05','2025-04-26 20:53:05');
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
    task_pause_id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_log_id INTEGER NOT NULL, -- Links to the specific task instance being paused
    paused_by_worker_id INTEGER NOT NULL,
    paused_at TEXT NOT NULL, -- Timestamp (ISO8601 format)
    resumed_at TEXT, -- Timestamp (ISO8601 format), Nullable if still paused
    reason TEXT, -- e.g., 'Waiting for materials', 'Shift change', 'Equipment issue'
    FOREIGN KEY (task_log_id) REFERENCES TaskLogs(task_log_id) ON DELETE CASCADE, -- If the task log entry is deleted, pauses are irrelevant
    FOREIGN KEY (paused_by_worker_id) REFERENCES Workers(worker_id)
);
    house_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Single Family Townhouse A', 'Lakehouse type B'
    description TEXT,
    number_of_modules INTEGER NOT NULL DEFAULT 1 -- How many physical modules make up this house type
);
INSERT INTO HouseTypes VALUES(1,'TH S','',2);
INSERT INTO HouseTypes VALUES(2,'TH M','',2);
    parameter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Floor Area', 'Number of Windows', 'Exterior Wall Length'
    unit TEXT -- e.g., 'Square Meters', 'Count', 'Linear Meters'
);
INSERT INTO HouseParameters VALUES(1,'Área de Piso','m2');
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
    multiwall_id INTEGER PRIMARY KEY AUTOINCREMENT,
    house_type_id INTEGER NOT NULL,
    module_sequence_number INTEGER NOT NULL,
    panel_group TEXT NOT NULL CHECK(panel_group IN ('Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros')), -- Must match panel group
    multiwall_code TEXT NOT NULL, -- Identifier for the multiwall (e.g., MW-01)
    FOREIGN KEY (house_type_id) REFERENCES HouseTypes(house_type_id) ON DELETE CASCADE,
    -- Ensure multiwall code is unique within the same house type, module, and group
    UNIQUE (house_type_id, module_sequence_number, panel_group, multiwall_code)
);
    admin_team_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Supervisor', 'Gestión de producción', 'Admin')), -- Define allowed roles
    pin TEXT NOT NULL UNIQUE, -- Assuming PIN should be unique for admin team members too
    is_active INTEGER DEFAULT 1 -- Boolean (0=false, 1=true)
);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('HouseTypes',2);
INSERT INTO sqlite_sequence VALUES('Projects',4);
INSERT INTO sqlite_sequence VALUES('ProjectModules',9);
INSERT INTO sqlite_sequence VALUES('ProductionPlan',144);
INSERT INTO sqlite_sequence VALUES('HouseParameters',1);
CREATE INDEX idx_productionplan_project ON ProductionPlan (project_id);
CREATE INDEX idx_productionplan_house_type ON ProductionPlan (house_type_id);
CREATE INDEX idx_productionplan_sequence ON ProductionPlan (planned_sequence);
CREATE INDEX idx_productionplan_start_datetime ON ProductionPlan (planned_start_datetime);
CREATE INDEX idx_productionplan_status ON ProductionPlan (status);
CREATE INDEX idx_productionplan_identifier_module ON ProductionPlan (project_id, house_identifier, module_sequence_in_house);
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
