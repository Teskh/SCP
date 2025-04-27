import React from 'react';
import { Routes, Route, Link, Navigate, Outlet } from 'react-router-dom'; // Import Outlet
import './App.css';
import AdminDashboard from './pages/AdminDashboard';
// DefinitionsManager is no longer needed as TaskDefinitionManager is routed directly
import TaskDefinitionManager from './components/admin/TaskDefinitionManager'; // Import TaskDefinitionManager
import WorkersManager from './components/admin/WorkersManager';
import HouseTypesManager from './components/admin/HouseTypesManager';
import HouseParametersManager from './components/admin/HouseParametersManager';
import SpecialtiesManager from './components/admin/SpecialtiesManager';
import AdminTeamManager from './components/admin/AdminTeamManager';
import ProjectsManager from './components/admin/ProjectsManager';
// import ProductionPlanner from './components/admin/ProductionPlanner'; // Removed ProductionPlanner
import ActiveProductionDashboard from './components/admin/ActiveProductionDashboard'; // Import ActiveProductionDashboard
// Import other pages/components as needed

// Basic Nav styling
const navStyle = {
    padding: '10px',
    background: '#f0f0f0',
    marginBottom: '20px',
    borderBottom: '1px solid #ccc'
};

const linkStyle = {
    margin: '0 10px',
    textDecoration: 'none',
    color: '#333'
};


function App() {
  // For now, basic navigation. Auth context will control this later.
  return (
    <div className="App">
        {/* Simple Navigation - Replace with a proper NavBar component later */}
        <nav style={navStyle}>
            <Link to="/" style={linkStyle}>Inicio (Temporal)</Link>
            <Link to="/admin" style={linkStyle}>Panel de Administración</Link>
            {/* Add links for Worker View, Login/Logout later */}
        </nav>

        <Routes>
             {/* Default route could redirect or show a landing page */}
            <Route path="/" element={
                <div>
                    <h2>Bienvenido al Seguimiento de Producción</h2>
                    <p>Seleccione un área de la navegación superior.</p>
                    {/* Or redirect immediately: <Navigate replace to="/admin" /> */}
                </div>
            } />

            {/* Admin Route - Now uses nested routes */}
            <Route path="/admin" element={<AdminDashboard />}>
                 {/* Child routes rendered by Outlet in AdminDashboard */}
                 <Route path="definitions" element={<DefinitionsManager />} />
                 <Route path="workers" element={<WorkersManager />} />
                 <Route path="house-types" element={<HouseTypesManager />} />
                 <Route path="house-parameters" element={<HouseParametersManager />} />
                 <Route path="specialties" element={<SpecialtiesManager />} />
                 <Route path="admin-team" element={<AdminTeamManager />} />
                 <Route path="projects" element={<ProjectsManager />} />
                 {/* <Route path="production-plan" element={<ProductionPlanner />} /> Removed route for Production Plan */}
                 <Route path="production-status" element={<ActiveProductionDashboard />} /> {/* Added route for Production Status */}
                 {/* Index route for /admin */}
                  <Route index element={
                      <div>
                          <h1 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>Panel de Administración</h1>
                          <p>Seleccione una opción del menú para gestionar la configuración del sistema o ver el estado de producción.</p>
                      </div>
                  } />
            </Route>

            {/* Define other top-level routes here later */}
            {/* <Route path="/worker" element={<WorkerDashboard />} /> */}
            {/* <Route path="/login" element={<LoginPage />} /> */}

            {/* Catch-all for not found routes */}
            <Route path="*" element={<div><h2>Página No Encontrada</h2><Link to="/">Ir a Inicio</Link></div>} />
        </Routes>
    </div>
  );
}

export default App;
