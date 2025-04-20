import React, { useState, useEffect, useCallback } from 'react';
import { getProjects, addProject, updateProject, deleteProject, getHouseTypes } from '../../services/adminService';
// Removed incorrect import: import styles from './AdminComponentStyles.js';

// Define styles directly, similar to other admin components
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 },
    subHeader: { marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' },
    formGroup: { marginBottom: '15px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px', flexWrap: 'wrap' }, // Align items to bottom for button alignment
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    textarea: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', minHeight: '80px' },
    select: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', height: '36px' }, // Ensure consistent height
    button: { cursor: 'pointer', padding: '10px 15px', border: 'none', borderRadius: '4px', color: 'white', backgroundColor: '#007bff' },
    buttonSecondary: { backgroundColor: '#6c757d' },
    buttonDelete: { backgroundColor: '#dc3545', marginLeft: '5px' },
    buttonEdit: { backgroundColor: '#ffc107', color: '#333', marginLeft: '5px' },
    buttonGroup: { marginTop: '15px', display: 'flex', gap: '10px' },
    error: { color: 'red', marginTop: '10px', marginBottom: '10px', padding: '10px', border: '1px solid red', borderRadius: '4px', backgroundColor: '#f8d7da' },
    loading: { fontStyle: 'italic', color: '#666' }
};


const initialFormState = {
    name: '',
    description: '',
    status: 'Planned', // Default status
    house_types: [], // Array of { house_type_id: '', quantity: '' }
};

const projectStatuses = ['Planned', 'Active', 'Completed', 'On Hold']; // Available statuses

function ProjectsManager() {
    const [projects, setProjects] = useState([]);
    const [allHouseTypes, setAllHouseTypes] = useState([]); // For dropdowns
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or project_id
    const [formData, setFormData] = useState(initialFormState);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [projectsData, houseTypesData] = await Promise.all([
                getProjects(),
                getHouseTypes() // Fetch house types for the form
            ]);
            setProjects(projectsData || []);
            setAllHouseTypes(houseTypesData || []);
        } catch (err) {
            setError(`Error fetching data: ${err.message}`);
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- House Type Row Management ---
    const handleHouseTypeChange = (index, field, value) => {
        const updatedHouseTypes = [...formData.house_types];
        updatedHouseTypes[index] = { ...updatedHouseTypes[index], [field]: value };
        setFormData(prev => ({ ...prev, house_types: updatedHouseTypes }));
    };

    const addHouseTypeRow = () => {
        setFormData(prev => ({
            ...prev,
            house_types: [...prev.house_types, { house_type_id: '', quantity: '' }]
        }));
    };

    const removeHouseTypeRow = (index) => {
        const updatedHouseTypes = formData.house_types.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, house_types: updatedHouseTypes }));
    };
    // --- End House Type Row Management ---


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Basic validation
        if (!formData.name.trim()) {
            setError('Project name is required.');
            setIsLoading(false);
            return;
        }
        if (!formData.house_types || formData.house_types.length === 0) {
            setError('At least one house type must be added to the project.');
            setIsLoading(false);
            return;
        }
        const validHouseTypes = formData.house_types.filter(ht => ht.house_type_id && ht.quantity > 0);
        if (validHouseTypes.length !== formData.house_types.length) {
             setError('All added house types must have a type selected and a quantity greater than 0.');
             setIsLoading(false);
             return;
        }
         // Check for duplicate house types within the form
        const houseTypeIds = validHouseTypes.map(ht => ht.house_type_id);
        if (new Set(houseTypeIds).size !== houseTypeIds.length) {
            setError('Cannot add the same house type multiple times to one project.');
            setIsLoading(false);
            return;
        }


        const payload = {
            ...formData,
            house_types: validHouseTypes.map(ht => ({
                house_type_id: parseInt(ht.house_type_id, 10),
                quantity: parseInt(ht.quantity, 10)
            })) // Ensure IDs and quantities are numbers
        };

        try {
            if (editMode) {
                await updateProject(editMode, payload);
            } else {
                await addProject(payload);
            }
            setFormData(initialFormState);
            setEditMode(null);
            await fetchData(); // Refresh list
        } catch (err) {
            setError(`Operation failed: ${err.message}`);
            console.error("Submit error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (project) => {
        setEditMode(project.project_id);
        // Prepare formData for editing, ensuring house_types structure matches form
        setFormData({
            name: project.name,
            description: project.description || '',
            status: project.status || 'Planned',
            house_types: project.house_types.map(ht => ({
                house_type_id: ht.house_type_id.toString(), // Ensure string for select value
                quantity: ht.quantity.toString() // Ensure string for input value
            })) || []
        });
        setError(''); // Clear previous errors
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            setIsLoading(true);
            setError('');
            try {
                await deleteProject(id);
                await fetchData(); // Refresh list
                if (editMode === id) { // If deleting the item currently being edited
                    setEditMode(null);
                    setFormData(initialFormState);
                }
            } catch (err) {
                setError(`Delete failed: ${err.message}`);
                console.error("Delete error:", err);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Gestionar Proyectos</h2>

            {error && <p style={styles.error}>{error}</p>}
            {isLoading && <p>Loading...</p>}

            {/* Form for Adding/Editing */}
            <form onSubmit={handleSubmit} style={styles.form}>
                <h3 style={styles.subHeader}>{editMode ? 'Editar Proyecto' : 'Añadir Nuevo Proyecto'}</h3>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="name">Nombre del Proyecto:</label>
                    <input
                        style={styles.input}
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="description">Descripción:</label>
                    <textarea
                        style={styles.textarea}
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                    />
                </div>
                 <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="status">Estado:</label>
                    <select
                        style={styles.select}
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                    >
                        {projectStatuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>

                {/* House Types Section */}
                <h4 style={{...styles.subHeader, marginTop: '20px'}}>Tipos de Vivienda en el Proyecto:</h4>
                {formData.house_types.map((ht, index) => (
                    <div key={index} style={styles.formRow}>
                        <div style={{...styles.formGroup, flex: 3, marginRight: '10px'}}>
                             <label style={styles.label} htmlFor={`ht-type-${index}`}>Tipo Vivienda:</label>
                             <select
                                style={styles.select}
                                id={`ht-type-${index}`}
                                value={ht.house_type_id}
                                onChange={(e) => handleHouseTypeChange(index, 'house_type_id', e.target.value)}
                                required
                             >
                                <option value="">-- Seleccionar Tipo --</option>
                                {allHouseTypes.map(type => (
                                    <option key={type.house_type_id} value={type.house_type_id}>
                                        {type.name}
                                    </option>
                                ))}
                             </select>
                        </div>
                         <div style={{...styles.formGroup, flex: 1, marginRight: '10px'}}>
                             <label style={styles.label} htmlFor={`ht-quantity-${index}`}>Cantidad:</label>
                             <input
                                style={styles.input}
                                type="number"
                                id={`ht-quantity-${index}`}
                                min="1"
                                value={ht.quantity}
                                onChange={(e) => handleHouseTypeChange(index, 'quantity', e.target.value)}
                                required
                             />
                        </div>
                        <button
                            type="button"
                            onClick={() => removeHouseTypeRow(index)}
                            style={{...styles.button, ...styles.buttonDelete, alignSelf: 'flex-end', marginBottom: '15px'}}
                        >
                            Eliminar Fila
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addHouseTypeRow}
                    style={{...styles.button, ...styles.buttonSecondary, marginTop: '5px', marginBottom: '20px'}}
                >
                    + Añadir Tipo de Vivienda
                </button>
                {/* End House Types Section */}


                <div style={styles.buttonGroup}>
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {editMode ? 'Actualizar Proyecto' : 'Guardar Proyecto'}
                    </button>
                    {editMode && (
                        <button type="button" onClick={handleCancelEdit} style={{...styles.button, ...styles.buttonSecondary}} disabled={isLoading}>
                            Cancelar Edición
                        </button>
                    )}
                </div>
            </form>

            {/* List of Projects */}
            <h3 style={{...styles.subHeader, marginTop: '30px'}}>Proyectos Existentes</h3>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Nombre</th>
                        <th style={styles.th}>Descripción</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Tipos Vivienda (Cantidad)</th>
                        <th style={styles.th}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {projects.map(project => (
                        <tr key={project.project_id}>
                            <td style={styles.td}>{project.name}</td>
                            <td style={styles.td}>{project.description}</td>
                            <td style={styles.td}>{project.status}</td>
                            <td style={styles.td}>
                                {project.house_types && project.house_types.length > 0 ? (
                                    <ul style={{margin: 0, paddingLeft: '15px'}}>
                                        {project.house_types.map(ht => (
                                            <li key={ht.house_type_id}>
                                                {ht.house_type_name || `ID: ${ht.house_type_id}`} ({ht.quantity})
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    'Ninguno'
                                )}
                            </td>
                            <td style={styles.td}>
                                <button onClick={() => handleEdit(project)} style={{...styles.button, ...styles.buttonEdit, marginRight: '5px'}} disabled={isLoading}>
                                    Editar
                                </button>
                                <button onClick={() => handleDelete(project.project_id)} style={{...styles.button, ...styles.buttonDelete}} disabled={isLoading}>
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    ))}
                    {projects.length === 0 && !isLoading && (
                        <tr>
                            <td colSpan="5" style={styles.td}>No hay proyectos definidos.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default ProjectsManager;
