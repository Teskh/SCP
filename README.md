1. Project Goal:
To develop a simple, low-stakes internal web application in Spanish for tracking task completion on a modular construction production line. The primary aim is to provide workers with an easy way to register tasks as completed for specific modules at their assigned stations, improving visibility into the production process across its distinct stages. All user-facing text in the application will be developed in Spanish.

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
Schema Outline: Contains tables for Projects, Modules (tracking current_station_id), Stations (defining W1-C6 layout), ModuleTypes, TaskDefinitions, Workers (with PIN), Specialties, TaskLogs (execution records), and TaskPauses. (Detailed schema defined separately).
4. Core User Workflow:
Login: Worker approaches the tablet, logs in via PIN (primary) or potentially QR code (secondary, experimental).
Context Awareness: Application identifies the station_id based on tablet configuration. Should ask user to identify if Line A, B, or C if at that station (since there's only one tablet for each station, for each of the three parallel lines)
Module Identification: System determines the module_id currently at this station_id.
Task Presentation: Displays relevant pending tasks for the module, station, and worker's specialty.
Task Completion: Worker selects and marks a task as done.
Logging: System records the completion in TaskLogs.
Admin Interface: A separate section/route accessible after admin login allows for managing Workers, Projects, Modules, Task Definitions, etc. (New components will be added to manage House Types, House Parameters, and their relationships).
Logout/Idle: Automatic logout after inactivity or manual logout.
5. Login Mechanisms:
Primary: PIN entry.
Secondary: QR Code scanning. (QR scanner should always be working in the background -unless turned off at settings-, if the user flashes a QR code in front of the camera, it should log him in inmediately. Alternatively, the user can select his name from the list of relevant workers for that station and enter his PIN)
6. Module Tracking & Movement:
Production Flow Logic: System understands W1 -> ... -> W5 -> M1 -> [A1 | B1 | C1] -> ... -> [A6 | B6 | C6].
Mechanism: Initial manual entry via admin/supervisor interface, including specifying the target line (A/B/C) when moving from M1. Though it's predefined at the planning level (e.g. our production plan already considers which line they'll end up in, therefore it shouldn't be defined manually at the production level, but at the planning level instead)
Clash Resolution: Basic auto-advance logic for clashes within the same line segment; specific validation needed for M1 and branching.
Future Enhancement: Automatic tracking envisioned but out of initial scope.
7. Key Features & Constraints:
Internal Use Only: Simplified security.
Low Stakes: Focus on visibility, not critical enforcement (initially).
Full-Screen SPA (React): Essential for tablet kiosk experience.
Defined Production Flow: Logic tied to the specific station layout.
No Task Dependencies (Initial): Workflow managed by users.
Station-Context Driven: Core logic relies on fixed tablet location.
Separate Admin Interface: For data management (List of tasks, List of workers/specialties, Production planning)
