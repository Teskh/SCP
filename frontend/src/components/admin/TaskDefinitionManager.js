import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as adminService from '../../services/adminService';

// Basic styling
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' }, // Align top for better readability if desc is long
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center' },
    label: { minWidth: '100px', textAlign: 'right' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    textarea: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minHeight: '60px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

// NOTE: Keep initialFormState keys in English
const initialFormState = {
    name: '',
    description: '',
    house_type_id: '', // Renamed from module_type_id
    specialty_id: '',
    station_sequence_order: '', // Changed from station_id
};

// Helper to generate descriptive stage options based on sequence order
const generateStageOptions = (stations) => {
    // Define the desired labels for each sequence order
    const stageLabels = {
        1: 'Linea de Paneles 1 (W1)',
        2: 'Linea de Paneles 2 (W2)',
        3: 'Linea de Paneles 3 (W3)',
        4: 'Linea de Paneles 4 (W4)',
        5: 'Linea de Paneles 5 (W5)',
        6: 'Magazine (M1)',
        7: 'Linea de Ensamblaje 1 (A1/B1/C1)',
        8: 'Linea de Ensamblaje 2 (A2/B2/C2)',
        9: 'Linea de Ensamblaje 3 (A3/B3/C3)',
        10: 'Linea de Ensamblaje 4 (A4/B4/C4)',
        11: 'Linea de Ensamblaje 5 (A5/B5/C5)',
        12: 'Linea de Ensamblaje 6 (A6/B6/C6)',
    };

    // Get unique sequence orders present in the stations data
    const existingOrders = [...new Set(stations.map(s => s.sequence_order))].sort((a, b) => a - b);

    // Map existing orders to the desired label format
    return existingOrders.map(order => ({
        value: order.toString(), // The value stored will be the sequence number as a string
        label: stageLabels[order] || `Etapa Desconocida (${order})` // Use defined label or fallback
    }));
};


function TaskDefinitionManager() {
    const [taskDefs, setTaskDefs] = useState([]);
    const [houseTypes, setHouseTypes] = useState([]); // Renamed from moduleTypes
    const [specialties, setSpecialties] = useState([]);
    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or task_definition_id
    const [formData, setFormData] = useState(initialFormState);

    // Create a map from sequence order to label for efficient lookup in the table
    const stageLabelMap = useMemo(() => {
        const options = generateStageOptions(stations); // Use the existing helper
        const map = new Map();
        options.forEach(option => {
            // Ensure the value is treated as a number for the map key
            map.set(parseInt(option.value, 10), option.label);
        });
        return map;
    }, [stations]); // Recalculate only when stations change

    // Fetch all necessary data (task defs and related entities for dropdowns)
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [defsData, houseTypesData, specsData, stationsData] = await Promise.all([
                adminService.getTaskDefinitions(),
                adminService.getHouseTypes(), // Use renamed service function
                adminService.getSpecialties(),
                adminService.getStations()
            ]);
            setTaskDefs(defsData);
            setHouseTypes(houseTypesData); // Use renamed state setter
            setSpecialties(specsData);
            setStations(stationsData);
        } catch (err) {
            setError(err.message || 'Failed to fetch data');
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

    const handleEdit = (taskDef) => {
        setEditMode(taskDef.task_definition_id);
        setFormData({
            name: taskDef.name || '',
            description: taskDef.description || '',
            // Ensure IDs are strings for select value matching, handle nulls
            house_type_id: taskDef.house_type_id?.toString() || '', // Renamed field
            specialty_id: taskDef.specialty_id?.toString() || '',
            station_sequence_order: taskDef.station_sequence_order?.toString() || '', // Changed from station_id
        });
        window.scrollTo(0, 0); // Scroll to top to see the form
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Convert empty strings back to null for IDs if necessary, or handle in service
        const payload = {
            ...formData,
            house_type_id: formData.house_type_id || null, // Renamed field
            specialty_id: formData.specialty_id || null,
            station_sequence_order: formData.station_sequence_order || null, // Changed from station_id
        };

        try {
            if (editMode) {
                await adminService.updateTaskDefinition(editMode, payload);
            } else {
                await adminService.addTaskDefinition(payload);
            }
            handleCancelEdit();
            await fetchData(); // Refresh list and related data
        } catch (err) {
            setError(err.message || `Error al ${editMode ? 'actualizar' : 'añadir'} la definición de tarea`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        // Confirmation dialog in Spanish
        if (window.confirm('¿Está seguro de que desea eliminar esta definición de tarea?')) {
            setError('');
            setIsLoading(true); // Prevent other actions during delete
            try {
                await adminService.deleteTaskDefinition(id);
                await fetchData(); // Refresh list
            } catch (err) {
                setError(err.message || 'Error al eliminar la definición de tarea');
            } finally {
                 setIsLoading(false);
            }
        }
    };

    return (
        <div style={styles.container}>
            <h2>Gestionar Definiciones de Tareas</h2>
            {error && <p style={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                 <h3>{editMode ? 'Editar Definición de Tarea' : 'Añadir Nueva Definición de Tarea'}</h3>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="taskName">Nombre:</label>
                     <input
                         id="taskName"
                         type="text"
                         name="name"
                         placeholder="Nombre Tarea (ej: Instalar Marco Ventana)"
                         value={formData.name}
                         onChange={handleInputChange}
                         required
                         style={styles.input}
                     />
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="taskDesc">Descripción:</label>
                     <textarea
                         id="taskDesc"
                         name="description"
                         placeholder="Descripción detallada (Opcional)"
                         value={formData.description}
                         onChange={handleInputChange}
                         style={styles.textarea}
                     />
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="houseType">Tipo Vivienda:</label> {/* Changed label */}
                     <select
                         id="houseType"
                         name="house_type_id" /* Changed name */
                         value={formData.house_type_id} /* Changed value */
                         onChange={handleInputChange}
                         style={styles.select}
                     >
                         <option value="">-- Opcional: Seleccionar Tipo Vivienda --</option> {/* Changed text */}
                         {houseTypes.map(ht => ( /* Changed variable name */
                             <option key={ht.house_type_id} value={ht.house_type_id}> {/* Changed key/value */}
                                 {ht.name}
                             </option>
                         ))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="specialty">Especialidad:</label>
                     <select
                         id="specialty"
                         name="specialty_id"
                         value={formData.specialty_id}
                         onChange={handleInputChange}
                         style={styles.select}
                     >
                         <option value="">-- Opcional: Seleccionar Especialidad --</option>
                         {specialties.map(spec => (
                             <option key={spec.specialty_id} value={spec.specialty_id}>
                                 {spec.name}
                             </option>
                         ))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="stationSequence">Etapa (Secuencia):</label> {/* Changed label */}
                     <select
                         id="stationSequence"
                         name="station_sequence_order" // Changed name
                         value={formData.station_sequence_order} // Changed value
                         onChange={handleInputChange}
                         style={styles.select}
                     >
                         <option value="">-- Opcional: Seleccionar Etapa --</option>
                         {generateStageOptions(stations).map(stage => (
                             <option key={stage.value} value={stage.value}>
                                 {stage.label} {/* Display the descriptive label */}
                             </option>
                         ))}
                     </select>
                 </div>
                 <div>
                     <button type="submit" disabled={isLoading} style={styles.button}>
                         {isLoading ? 'Guardando...' : (editMode ? 'Actualizar Definición' : 'Añadir Definición')}
                     </button>
                     {editMode && (
                         <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>
                             Cancelar
                         </button>
                     )}
                 </div>
            </form>

            {isLoading && !taskDefs.length ? <p style={styles.loading}>Cargando definiciones de tareas...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nombre</th>
                            <th style={styles.th}>Descripción</th>
                            <th style={styles.th}>Tipo Vivienda</th> {/* Changed header */}
                            <th style={styles.th}>Especialidad</th>
                            <th style={styles.th}>Etapa (Secuencia)</th> {/* Changed header */}
                            <th style={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taskDefs.map((td) => (
                            <tr key={td.task_definition_id}>
                                <td style={styles.td}>{td.name}</td>
                                <td style={styles.td}>{td.description}</td>
                                <td style={styles.td}>{td.house_type_name || 'N/A'}</td> {/* Changed field */}
                                <td style={styles.td}>{td.specialty_name || 'N/A'}</td>
                                {/* Look up the label using the map, fallback to the number or N/A */}
                                <td style={styles.td}>{stageLabelMap.get(td.station_sequence_order) || td.station_sequence_order ?? 'N/A'}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(td)} style={styles.button} disabled={isLoading}>Editar</button>
                                    <button onClick={() => handleDelete(td.task_definition_id)} style={styles.button} disabled={isLoading}>Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            { !isLoading && taskDefs.length === 0 && <p>No se encontraron definiciones de tareas.</p>}
        </div>
    );
}

export default TaskDefinitionManager;
