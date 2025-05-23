import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import styles from '../components/admin/AdminComponentStyles'; // Import shared styles

// Basic styling for layout and navigation
const dashboardStyles = {
    display: 'flex',
};

const navStyles = {
    width: '200px',
    borderRight: '1px solid #ccc',
    padding: '20px',
    height: 'calc(100vh - 80px)', // Adjust based on header/footer height
    background: '#f8f8f8',
    overflowY: 'auto', // Allow navigation scrolling if many links
};

const navListStyles = { listStyle: 'none', padding: 0, margin: 0 };

const navItemStyles = { marginBottom: '10px' };

const navLinkStyles = {
    textDecoration: 'none',
    color: '#337ab7',
    padding: '8px 12px',
    display: 'block',
    borderRadius: '4px',
};

const navLinkActiveStyles = {
    backgroundColor: '#e7e7e7',
    fontWeight: 'bold',
    color: '#333',
};

const contentStyles = {
    flexGrow: 1,
    padding: '20px',
    overflowY: 'auto', // Allow content scrolling
    height: 'calc(100vh - 80px)', // Match nav height
};


function AdminDashboard() {
    const location = useLocation(); // Get current location for active link styling

    // Helper to check if a path is active
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div style={dashboardStyles}>
            <nav style={navStyles}>
                <h2 style={{...styles.header, borderBottom: 'none', marginBottom: '20px'}}>Menú Admin</h2>
                <ul style={navListStyles}>
                    {/* Personal Section */}
                    <li style={{...navItemStyles, marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd'}}>
                        <strong style={{ display: 'block', padding: '8px 12px', color: '#555' }}>Personal</strong>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/workers"
                            style={{ ...navLinkStyles, ...(isActive('/admin/workers') ? navLinkActiveStyles : {}) }}
                        >
                            Trabajadores
                        </Link>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/specialties"
                            style={{ ...navLinkStyles, ...(isActive('/admin/specialties') ? navLinkActiveStyles : {}) }}
                        >
                            Especialidades
                        </Link>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/admin-team"
                            style={{ ...navLinkStyles, ...(isActive('/admin/admin-team') ? navLinkActiveStyles : {}) }}
                        >
                            Equipo Admin
                        </Link>
                    </li>

                    {/* Proyectos Section */}
                    <li style={{...navItemStyles, marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd'}}>
                        <strong style={{ display: 'block', padding: '8px 12px', color: '#555' }}>Proyectos</strong>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/projects"
                            style={{ ...navLinkStyles, ...(isActive('/admin/projects') ? navLinkActiveStyles : {}) }}
                        >
                            Gestionar Proyectos
                        </Link>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/production-status"
                            style={{ ...navLinkStyles, ...(isActive('/admin/production-status') ? navLinkActiveStyles : {}) }}
                        >
                            Estado Producción
                        </Link>
                    </li>

                    {/* Configuración Section */}
                    <li style={{...navItemStyles, marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd'}}>
                        <strong style={{ display: 'block', padding: '8px 12px', color: '#555' }}>Configuración</strong>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/station-context"
                            style={{ ...navLinkStyles, ...(isActive('/admin/station-context') ? navLinkActiveStyles : {}) }}
                        >
                            Estaciones
                        </Link>
                    </li>

                    {/* Definiciones Section */}
                    <li style={{...navItemStyles, marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #ddd'}}>
                        <strong style={{ display: 'block', padding: '8px 12px', color: '#555' }}>Definiciones</strong>
                    </li>
                     <li style={navItemStyles}>
                        <Link
                            to="/admin/house-types"
                            style={{ ...navLinkStyles, ...(isActive('/admin/house-types') ? navLinkActiveStyles : {}) }}
                        >
                            Tipos de Vivienda
                        </Link>
                    </li>
                     <li style={navItemStyles}>
                        <Link
                            to="/admin/house-parameters"
                            style={{ ...navLinkStyles, ...(isActive('/admin/house-parameters') ? navLinkActiveStyles : {}) }}
                        >
                            Parámetros Vivienda
                        </Link>
                    </li>
                    <li style={navItemStyles}>
                        <Link
                            to="/admin/definitions" // Keep path for now, will adjust in next step
                            style={{ ...navLinkStyles, ...(isActive('/admin/definitions') ? navLinkActiveStyles : {}) }}
                        >
                            Definiciones de Tareas
                        </Link>
                    </li>
                    {/* Add links for Stations etc. under Definitions if needed later */}
                </ul>
            </nav>
            <main style={contentStyles}>
                 {/* Render the matched child route component here */}
                 {/* Outlet will render the index route or the matched child route */}
                 <Outlet />
            </main>
        </div>
    );
}

export default AdminDashboard;
