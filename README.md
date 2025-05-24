1. Project Goal:
To develop a simple, low-stakes internal web application in Spanish for tracking task completion on a modular construction production line. The primary aim is to provide workers with an easy way to register tasks as completed for specific modules or panels at their assigned stations, improving visibility into the production process. All user-facing text in the application will be developed in Spanish.

2. Target Users & Environment:
Users: Production line workers and supervisors (for module movement and admin tasks).
Environment: Fixed tablets located at each production station within the facility. The application should run full-screen in a web browser on these tablets.
Production Line Structure: The physical layout consists of:
Panel Line (W): 5 sequential stations (W1 to W5) for initial panel production.
    - W1: Estación de Estructura
    - W2: Estación de Revestimiento PLI 1
    - W3: Estación de Revestimiento PLI 2
    - W4: Estación de Revestimiento PLA 1
    - W5: Estación de Revestimiento PLA 2
Buffer Magazine (M): A single intermediate storage/holding station (M1) following the panel line.
Assembly Lines (A, B, C): 3 parallel lines, each with 6 stations (A1-A6, B1-B6, C1-C6), where panels are assembled into modules and finished. Modules move from M1 onto one of these parallel lines.
3. System Architecture:
Frontend:
Type: (This is very important) Single Page Application (SPA)
Framework: React.
Reasoning: Chosen for its robust component model, declarative UI approach (simplifying DOM updates), strong ecosystem, and suitability for building interactive SPAs. This structure facilitates a seamless full-screen experience without browser chrome reappearing on navigation.
State Management: Initially, state will be managed using React's built-in features (e.g., useState, useContext, prop drilling). A dedicated global state library (like Redux or Zustand) will not be implemented unless application complexity demonstrably warrants it later.
Key Libraries (Planned): React, React Router (for SPA navigation), a JavaScript QR code scanning library (jsqr for QR login), standard fetching library (fetch API).
Backend:
Technology: Flask (Python microframework) served via Gunicorn.
Reasoning: Flask is a lightweight and flexible microframework, well-suited for building APIs. Its simplicity, extensive documentation, large community, and wide range of extensions make it a good
choice. Gunicorn is a robust WSGI server for deploying Flask applications in production. HTTPS will be enforced via Gunicorn configuration using provided certificate and key files, which is necessary
for secure camera access in modern browsers.
Responsibilities: Serve the SPA's static build files (or configure Gunicorn/proxy for this), handle API requests (login, task fetching, task completion, module movement, admin CRUD operations),
interact with the database, process QR code data (if received from the frontend).
Database:
Technology: SQLite3.
Reasoning: Simplicity, file-based, sufficient for the low-concurrency, low-stakes nature of this internal application.
Schema Outline: Contains tables for `ModuleProductionPlan` (includes `project_name`, `house_identifier`, `module_number` to define planned module instances), `Modules` (physical instances tracking `current_station_id`, linked to `ModuleProductionPlan`), `Stations` (W1-C6 layout), `HouseTypes`, `HouseSubType` (formerly Tipologias, e.g., 'Standard', 'Premium'), `HouseParameters`, `HouseTypeParameters` (linking parameters to specific modules within a type and sub-type), `Multiwalls`, `PanelDefinitions` (defining panels per module within a type/sub-type, optionally linked to a Multiwall), `TaskDefinitions` (now with `is_panel_task` flag), `Workers` (with PIN), `Specialties`, `TaskLogs` (for module-level task execution), `PanelTaskLogs` (for panel-specific task execution), and `TaskPauses`. (Detailed schema in `backend/app/database/new_schema.sql`).
4. Core User Workflow:
Login: Worker approaches the tablet, logs in via PIN (primary) or potentially QR code (secondary, experimental).
Context Awareness: Application identifies the `station_id` based on tablet configuration. Should ask user to identify if Line A, B, or C if at that station.
Module/Panel Identification: System determines the `module_id` (and potentially relevant `panel_definition_id`s) currently at this `station_id`.
Task Presentation: Displays relevant pending tasks for the module (or its panels), station, and worker's specialty, distinguishing between module tasks and panel tasks based on `TaskDefinitions.is_panel_task`.
Task Completion: Worker selects and marks a task as done.
Logging: System records the completion in `TaskLogs` (for module tasks) or `PanelTaskLogs` (for panel tasks), including start/finish station.
Admin Interface: A separate section/route accessible after admin login allows for managing Workers, `ModuleProductionPlan` items (defining project name, house details, modules), `TaskDefinitions`, `HouseTypes` (including defining `HouseSubType`s, parameters, and panels per module/sub-type), Specialties, etc.
Logout/Idle: Automatic logout after inactivity or manual logout.
5. Login Mechanisms:
Primary: PIN entry.
Secondary: QR Code scanning. (QR scanner should always be working in the background -unless turned off at settings-, if the user flashes a QR code in front of the camera, it should log him in inmediately. Alternatively, the user can select his name from the list of relevant workers for that station and enter his PIN)
6. Module Tracking & Movement:
Production Flow Logic: System understands W1 -> ... -> W5 -> M1 -> [A1 | B1 | C1] -> ... -> [A6 | B6 | C6].
Mechanism: Module movement is driven by updates to `Modules.current_station_id`. The target assembly line (A/B/C) for a module is defined in its `ModuleProductionPlan` item.
Clash Resolution: Basic auto-advance logic for clashes within the same line segment; specific validation needed for M1 and branching.
Future Enhancement: Automatic tracking envisioned but out of initial scope.
7. Key Features & Constraints:
Internal Use Only: Simplified security.
Low Stakes: Focus on visibility, not critical enforcement (initially).
Full-Screen SPA (React): Essential for tablet kiosk experience.
Defined Production Flow: Logic tied to the specific station layout.
Task Dependencies: Tasks can specify prerequisite tasks via comma-separated `task_definition_ids`.
Station-Context Driven: Core logic relies on fixed tablet location.
Separate Admin Interface: For data management (Task Definitions, Workers/Specialties, Production Planning via `ModuleProductionPlan`, House Types including SubTypes, Parameters and Panels per module/sub-type).
Ensure keeping this document in context when making any change, as well as our schema and App.js.
This is the structure of this codebase, keep it up to date when new changes modify it:
.
├── .env                                                               # Stores environment variables (e.g., secrets, database paths) - Not committed to Git
├── .gitignore                                                         # Specifies intentionally untracked files that Git should ignore
├── backend                                                            # Root directory for the Flask backend application
│   ├── app                                                            # Main application package for the backend
│   │   ├── api                                                        # Contains Flask Blueprints defining API endpoints
│   │   │   ├── admin_definitions.py                                   # API routes for managing definitions (House Types, Parameters, Panels, Multiwalls, Task Definitions Stations)
│   │   │   ├── admin_personnel.py                                     # API routes for managing personnel (Workers, Specialties, Admin Team)
│   │   │   ├── auth.py                                                # API routes for user authentication (login/logout)
│   │   │   └── __init__.py                                            # Makes the 'api' directory a Python package
│   │   ├── database                                                   # Package for database interactions
│   │   │   ├── connection.py                                          # Handles establishing and closing the database connection (SQLite)
│   │   │   ├── queries.py                                             # Contains functions executing specific SQL queries against the database
│   │   │   ├── schema.sql                                             # SQL script to define the database schema (tables, constraints, initial data)
│   │   │   └── __init__.py                                            # Makes the 'database' directory a Python package (currently empty)
│   │   ├── main                                                       # Placeholder for core application logic (if needed beyond APIs) - Currently empty
│   │   ├── services                                                   # Placeholder for business logic services (if needed) - Currently empty
│   │   ├── utils                                                      # Placeholder for utility functions (if needed) - Currently empty
│   │   └── __init__.py                                                # Application factory: Creates/configures Flask app, registers blueprints, sets up DB
├── config.py                                                          # Defines configuration classes for Flask (e.g., database URI, secret key)
├── requirements.txt                                                   # Lists Python dependencies for the backend
└── run.py                                                             # Entry point script to run the Flask development server
├── data                                                               # Directory to store persistent data (like database file) - Not committed to Git
│   └── database.db                                                    # The SQLite database file
├── frontend                                                           # Root directory for the React frontend application
│   ├── .gitignore                                                     # Specifies intentionally untracked files for frontend (e.g., node_modules)
│   ├── package-lock.json                                              # Records exact versions of frontend dependencies
│   ├── package.json                                                   # Defines frontend project metadata, dependencies, and scripts (npm/yarn)
│   ├── public                                                         # Contains static assets served directly by webserver
│   │   ├── index.html                                                 # The main HTML template for the React SPA
│   │   ├── manifest.json                                              # Web app manifest file (PWA features)
│   │   └── robots.txt                                                 # Instructions for web crawlers
│   ├── src                                                            # Contains the React application source code
│   │   ├── App.css                                                    # General CSS styles for the main App component
│   │   ├── App.js                                                     # The root component of the React application, defines routing
│   │   ├── App.test.js                                                # Basic test file for the App component
│   │   ├── components                                                 # Reusable UI components
│   │   │   └── admin                                                  # Components specifically for Admin Dashboard section
│   │   │       ├── ActiveProductionDashboard.js                       # Component displaying current state of production line and upcoming plan
│   │   │       ├── AdminComponentStyles.js                            # Shared JavaScript-based styles for Admin components
│   │   │       ├── AdminTeamManager.js                                # Component for managing Admin Team members (CRUD)
│   │   │       ├── HouseParametersManager.js                          # Component for managing global House Parameter definitions (CRUD)
│   │   │       ├── HouseTypePanelsModal.js                            # Modal for managing Panels/Multiwalls within specific House Type and Module   
│   │   │       ├── HouseTypesManager.js                               # Component for managing House Types, Tipologias, and linking Parameters (CRUD)
│   │   │       ├── AddProductionBatchModal.js                         # Modal for adding new production batches to the plan
│   │   │       ├── SpecialtiesManager.js                              # Component for managing Worker Specialties (CRUD)
│   │   │       ├── TaskDefinitionManager.js                           # Component for managing Task Definitions (CRUD)
│   │   │       └── WorkersManager.js                                  # Component for managing Workers (CRUD)
│   │   ├── index.css                                                  # Global CSS styles applied to entire application
│   │   ├── index.js                                                   # Entry point for React application, renders App component into DOM
│   │   ├── logo.svg                                                   # Example SVG logo (can be removed/replaced)
│   │   ├── pages                                                      # Components representing distinct pages/views
│   │   │   └── AdminDashboard.js                                      # Page component acting as layout for admin section, including navigation
│   │   ├── reportWebVitals.js                                         # Utility for measuring web performance metrics
│   │   ├── services                                                   # Modules for interacting with backend API
│   │   │   └── adminService.js                                        # Functions for making API calls to backend admin endpoints
│   │   └── setupTests.js                                              # Configuration file for React Testing Library/Jest
│   └── README.md                                                      # README file specifically for frontend (if needed, currently seems empty)
└── ssl                                                                # Directory likely intended for SSL certificate files (e.g., for HTTPS) - Contents not shown
