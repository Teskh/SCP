import React from 'react';
import { Routes, Route, Link, Navigate, Outlet } from 'react-router-dom'; // Import Outlet
import './App.css';
import AdminDashboard from './pages/AdminDashboard';
import DefinitionsManager from './components/admin/DefinitionsManager';
import WorkersManager from './components/admin/WorkersManager';
import HouseTypesManager from './components/admin/HouseTypesManager'; // Import new component
import HouseParametersManager from './components/admin/HouseParametersManager'; // Import new component
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
                 {/* Index route for /admin (optional, shows welcome message) */}
                 {/* <Route index element={<div>Seleccione una sección de administración</div>} /> */}
                 {/* Add other admin sub-routes (e.g., projects) here */}
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
