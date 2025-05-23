import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService'; // Updated to import all as adminService

// Styles (kept similar for brevity, adjust as needed for new layout)
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 },
    subHeader: { marginTop: '20px', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    select: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', height: '36px' },
    button: { cursor: 'pointer', padding: '10px 15px', border: 'none', borderRadius: '4px', color: 'white', backgroundColor: '#007bff' },
    buttonSecondary: { backgroundColor: '#6c757d' },
    buttonDelete: { backgroundColor: '#dc3545', marginLeft: '5px' },
    buttonEdit: { backgroundColor: '#ffc107', color: '#333', marginLeft: '5px' },
    buttonGroup: { marginTop: '15px', display: 'flex', gap: '10px' },
    error: { color: 'red', marginTop: '10px', marginBottom: '10px', padding: '10px', border: '1px solid red', borderRadius: '4px', backgroundColor: '#f8d7da' },
};

const initialPlanItemFormState = {
    project_name: '',
    house_identifier: '',
    module_number: '',
    house_type_id: '',
    sub_type_id: '', // New field
    planned_sequence: '',
    planned_start_datetime: '',
    planned_assembly_line: 'A', // Default value
    status: 'Planned', // Default status
};

const planItemStatuses = ['Planned', 'Panels', 'Magazine', 'Assembly', 'Completed'];
const assemblyLines = ['A', 'B', 'C'];

// Helper to format datetime for input[type=datetime-local]
const formatDateForInput = (isoDate) => {
    if (!isoDate) return '';
    // ISO 8601 format "YYYY-MM-DD HH:MM:SS" needs to be "YYYY-MM-DDTHH:MM" for datetime-local
    return isoDate.replace(' ', 'T').substring(0, 16);
};
// Helper to format datetime for backend
const formatDateForBackend = (localDate) => {
    if (!localDate) return '';
    return localDate.replace('T', ' ') + ':00'; // Add seconds
}

function ModuleProductionPlanManager() { // Renamed component
    const [planItems, setPlanItems] = useState([]);
    const [allHouseTypes, setAllHouseTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // plan_id for editing
    const [formData, setFormData] = useState(initialPlanItemFormState);
    const [selectedHouseTypeSubTypes, setSelectedHouseTypeSubTypes] = useState([]);

    const fetchPlanItemsAndHouseTypes = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [planData, houseTypesData] = await Promise.all([
                adminService.getModuleProductionPlan(), // Updated service call
                adminService.getHouseTypes() // Fetches house types for dropdowns
            ]);
            setPlanItems(planData || []);
            setAllHouseTypes(houseTypesData || []);
        } catch (err) {
            setError(`Error fetching data: ${err.message}`);
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlanItemsAndHouseTypes();
    }, [fetchPlanItemsAndHouseTypes]);

    useEffect(() => {
        // Update sub-types dropdown when house_type_id changes in form
        if (formData.house_type_id) {
            const selectedType = allHouseTypes.find(ht => ht.house_type_id === parseInt(formData.house_type_id));
            setSelectedHouseTypeSubTypes(selectedType ? selectedType.sub_types || [] : []);
            // Reset sub_type_id if it's not valid for the new house_type
            if (selectedType && !selectedType.sub_types.find(st => st.sub_type_id === parseInt(formData.sub_type_id))) {
                setFormData(prev => ({ ...prev, sub_type_id: '' }));
            }
        } else {
            setSelectedHouseTypeSubTypes([]);
        }
    }, [formData.house_type_id, allHouseTypes, formData.sub_type_id]);


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const payload = {
            ...formData,
            module_number: parseInt(formData.module_number, 10),
            house_type_id: parseInt(formData.house_type_id, 10),
            sub_type_id: formData.sub_type_id ? parseInt(formData.sub_type_id, 10) : null,
            planned_sequence: parseInt(formData.planned_sequence, 10),
            planned_start_datetime: formData.planned_start_datetime ? formatDateForBackend(formData.planned_start_datetime) : null,
        };
        
        // Basic frontend validation (more robust validation should be on backend)
        if (!payload.project_name || !payload.house_identifier || !payload.module_number || !payload.house_type_id || !payload.planned_sequence || !payload.planned_start_datetime) {
            setError("Please fill all required fields for the plan item.");
            setIsLoading(false);
            return;
        }

        try {
            if (editMode) { // editMode now stores plan_id
                await adminService.updateModuleProductionPlanItem(editMode, payload);
            } else {
                // Assuming addModuleProductionPlanItem for single item, or adapt if it's bulk generation
                await adminService.addModuleProductionPlanItem(payload); // This function needs to be added to adminService.js
            }
            setFormData(initialPlanItemFormState);
            setEditMode(null);
            await fetchPlanItemsAndHouseTypes(); // Refresh list
        } catch (err) {
            setError(`Operation failed: ${err.message}`);
            console.error("Submit error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (item) => {
        setEditMode(item.plan_id);
        setFormData({
            project_name: item.project_name || '',
            house_identifier: item.house_identifier || '',
            module_number: item.module_number || '',
            house_type_id: item.house_type_id ? item.house_type_id.toString() : '',
            sub_type_id: item.sub_type_id ? item.sub_type_id.toString() : '',
            planned_sequence: item.planned_sequence || '',
            planned_start_datetime: item.planned_start_datetime ? formatDateForInput(item.planned_start_datetime) : '',
            planned_assembly_line: item.planned_assembly_line || 'A',
            status: item.status || 'Planned',
        });
        setError('');
    };

    const handleDelete = async (planId) => {
        if (window.confirm('Are you sure you want to delete this plan item? This cannot be undone.')) {
            setIsLoading(true);
            setError('');
            try {
                await adminService.deleteModuleProductionPlanItem(planId);
                await fetchPlanItemsAndHouseTypes(); // Refresh list
                if (editMode === planId) {
                    setEditMode(null);
                    setFormData(initialPlanItemFormState);
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
        setFormData(initialPlanItemFormState);
        setError('');
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Gestionar Plan de Producción de Módulos</h2>

            {error && <p style={styles.error}>{error}</p>}
            {isLoading && <p>Cargando...</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <h3 style={styles.subHeader}>{editMode ? 'Editar Item del Plan' : 'Añadir Nuevo Item al Plan'}</h3>
                
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="project_name">Nombre del Proyecto:</label>
                    <input style={styles.input} type="text" id="project_name" name="project_name" value={formData.project_name} onChange={handleInputChange} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="house_identifier">Identificador de Vivienda:</label>
                    <input style={styles.input} type="text" id="house_identifier" name="house_identifier" value={formData.house_identifier} onChange={handleInputChange} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="module_number">Número de Módulo:</label>
                    <input style={styles.input} type="number" id="module_number" name="module_number" value={formData.module_number} onChange={handleInputChange} required min="1"/>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="house_type_id">Tipo de Vivienda:</label>
                    <select style={styles.select} id="house_type_id" name="house_type_id" value={formData.house_type_id} onChange={handleInputChange} required>
                        <option value="">-- Seleccionar Tipo --</option>
                        {allHouseTypes.map(type => (
                            <option key={type.house_type_id} value={type.house_type_id}>{type.name}</option>
                        ))}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="sub_type_id">Sub-Tipo (Tipología):</label>
                    <select style={styles.select} id="sub_type_id" name="sub_type_id" value={formData.sub_type_id} onChange={handleInputChange} disabled={!formData.house_type_id || selectedHouseTypeSubTypes.length === 0}>
                        <option value="">-- General (Sin Sub-Tipo Específico) --</option>
                        {selectedHouseTypeSubTypes.map(st => (
                            <option key={st.sub_type_id} value={st.sub_type_id}>{st.name}</option>
                        ))}
                    </select>
                </div>
                 <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="planned_sequence">Secuencia Planeada:</label>
                    <input style={styles.input} type="number" id="planned_sequence" name="planned_sequence" value={formData.planned_sequence} onChange={handleInputChange} required min="1"/>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="planned_start_datetime">Fecha/Hora Inicio Planeada:</label>
                    <input style={styles.input} type="datetime-local" id="planned_start_datetime" name="planned_start_datetime" value={formData.planned_start_datetime} onChange={handleInputChange} required />
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="planned_assembly_line">Línea de Ensamblaje Planeada:</label>
                    <select style={styles.select} id="planned_assembly_line" name="planned_assembly_line" value={formData.planned_assembly_line} onChange={handleInputChange} required>
                        {assemblyLines.map(line => (<option key={line} value={line}>{line}</option>))}
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label style={styles.label} htmlFor="status">Estado:</label>
                    <select style={styles.select} id="status" name="status" value={formData.status} onChange={handleInputChange} required>
                        {planItemStatuses.map(s => (<option key={s} value={s}>{s}</option>))}
                    </select>
                </div>

                <div style={styles.buttonGroup}>
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {editMode ? 'Actualizar Item' : 'Guardar Item'}
                    </button>
                    {editMode && (
                        <button type="button" onClick={handleCancelEdit} style={{...styles.button, ...styles.buttonSecondary}} disabled={isLoading}>
                            Cancelar Edición
                        </button>
                    )}
                </div>
            </form>

            <h3 style={{...styles.subHeader, marginTop: '30px'}}>Items del Plan de Producción</h3>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>ID Plan</th>
                        <th style={styles.th}>Proyecto</th>
                        <th style={styles.th}>Ident. Vivienda</th>
                        <th style={styles.th}>Módulo #</th>
                        <th style={styles.th}>Tipo Vivienda</th>
                        <th style={styles.th}>Sub-Tipo</th>
                        <th style={styles.th}>Secuencia</th>
                        <th style={styles.th}>Inicio Planeado</th>
                        <th style={styles.th}>Línea</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {planItems.map(item => (
                        <tr key={item.plan_id}>
                            <td style={styles.td}>{item.plan_id}</td>
                            <td style={styles.td}>{item.project_name}</td>
                            <td style={styles.td}>{item.house_identifier}</td>
                            <td style={styles.td}>{item.module_number}</td>
                            <td style={styles.td}>{item.house_type_name}</td>
                            <td style={styles.td}>{item.sub_type_name || '-'}</td>
                            <td style={styles.td}>{item.planned_sequence}</td>
                            <td style={styles.td}>{item.planned_start_datetime ? new Date(item.planned_start_datetime.replace(' ', 'T')+'Z').toLocaleString() : '-'}</td>
                            <td style={styles.td}>{item.planned_assembly_line}</td>
                            <td style={styles.td}>{item.status}</td>
                            <td style={styles.td}>
                                <button onClick={() => handleEdit(item)} style={{...styles.button, ...styles.buttonEdit, marginRight: '5px'}} disabled={isLoading}>
                                    Editar
                                </button>
                                <button onClick={() => handleDelete(item.plan_id)} style={{...styles.button, ...styles.buttonDelete}} disabled={isLoading}>
                                    Eliminar
                                </button>
                            </td>
                        </tr>
                    ))}
                    {planItems.length === 0 && !isLoading && (
                        <tr>
                            <td colSpan="11" style={styles.td}>No hay items en el plan de producción.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default ModuleProductionPlanManager; // Renamed component
