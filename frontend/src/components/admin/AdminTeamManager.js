import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';

// Reusing styles from WorkersManager for consistency
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    label: { minWidth: '100px', textAlign: 'right' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minWidth: '150px' },
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minWidth: '150px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '5px', minWidth: '100px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

// NOTE: Keep initialFormState keys in English
const initialFormState = {
    first_name: '',
    last_name: '',
    role: 'Supervisor', // Default role
    pin: '',
    is_active: true,
};

// Define allowed roles for the dropdown
const adminRoles = ['Supervisor', 'Gestión de producción', 'Admin'];

function AdminTeamManager() {
    const [teamMembers, setTeamMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or admin_team_id
    const [formData, setFormData] = useState(initialFormState);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await adminService.getAdminTeam();
            setTeamMembers(data);
        } catch (err) {
            setError(err.message || 'Error al obtener los miembros del equipo admin');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEdit = (member) => {
        setEditMode(member.admin_team_id);
        setFormData({
            first_name: member.first_name || '',
            last_name: member.last_name || '',
            role: member.role || 'Supervisor', // Default if somehow null
            pin: member.pin || '', // Consider security implications of displaying PIN
            is_active: member.is_active ?? true,
        });
        window.scrollTo(0, 0); // Scroll to form
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic PIN validation
        if (formData.pin.length < 4) {
            setError('El PIN debe tener al menos 4 dígitos.');
            return;
        }
        // Role validation (should be handled by select, but good practice)
        if (!adminRoles.includes(formData.role)) {
             setError('Rol inválido seleccionado.');
             return;
        }

        setIsLoading(true);
        const payload = { ...formData };

        try {
            if (editMode) {
                await adminService.updateAdminTeamMember(editMode, payload);
            } else {
                await adminService.addAdminTeamMember(payload);
            }
            handleCancelEdit();
            await fetchData(); // Refresh list
        } catch (err) {
            // Display specific error from backend if available (e.g., duplicate PIN)
            setError(err.message || `Error al ${editMode ? 'actualizar' : 'añadir'} el miembro del equipo`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        // Confirmation dialog in Spanish
        if (window.confirm('¿Está seguro de que desea eliminar a este miembro del equipo?')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteAdminTeamMember(id);
                await fetchData(); // Refresh list
            } catch (err) {
                setError(err.message || 'Error al eliminar el miembro del equipo');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div style={styles.container}>
            <h2>Gestionar Equipo Admin</h2>
            {error && <p style={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <h3>{editMode ? 'Editar Miembro' : 'Añadir Nuevo Miembro'}</h3>
                <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="adminFirstName">Nombre:</label>
                    <input id="adminFirstName" type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required style={styles.input} />
                    <label style={styles.label} htmlFor="adminLastName">Apellido:</label>
                    <input id="adminLastName" type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required style={styles.input} />
                </div>
                 <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="adminRole">Rol:</label>
                    <select id="adminRole" name="role" value={formData.role} onChange={handleInputChange} required style={styles.select}>
                        {adminRoles.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                 </div>
                 <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="adminPin">PIN:</label>
                    <input id="adminPin" type="password" name="pin" placeholder={editMode ? "Nuevo PIN si cambia" : "Mín 4 dígitos"} value={formData.pin} onChange={handleInputChange} required={!editMode} minLength="4" style={styles.input} />
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.checkboxLabel} htmlFor="adminIsActive">
                         <input id="adminIsActive" type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} />
                         Activo
                     </label>
                 </div>
                <div>
                    <button type="submit" disabled={isLoading} style={styles.button}>
                        {isLoading ? 'Guardando...' : (editMode ? 'Actualizar Miembro' : 'Añadir Miembro')}
                    </button>
                    {editMode && (
                        <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>Cancelar</button>
                    )}
                </div>
            </form>

            {isLoading && !teamMembers.length ? <p style={styles.loading}>Cargando miembros del equipo...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nombre</th>
                            <th style={styles.th}>Rol</th>
                            <th style={styles.th}>Activo</th>
                            <th style={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teamMembers.map((m) => (
                            <tr key={m.admin_team_id}>
                                <td style={styles.td}>{m.first_name} {m.last_name}</td>
                                <td style={styles.td}>{m.role}</td>
                                <td style={styles.td}>{m.is_active ? 'Sí' : 'No'}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(m)} style={styles.button} disabled={isLoading}>Editar</button>
                                    <button onClick={() => handleDelete(m.admin_team_id)} style={styles.button} disabled={isLoading}>Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {!isLoading && teamMembers.length === 0 && <p>No se encontraron miembros del equipo admin.</p>}
        </div>
    );
}

export default AdminTeamManager;
