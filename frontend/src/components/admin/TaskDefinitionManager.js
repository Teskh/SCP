import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as adminService from '../../services/adminService';
import TaskDependencySelectorModal from './TaskDependencySelectorModal'; // Import the new modal

// Basic styling (styles assumed to be similar, with potential additions for checkbox)
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px', border: 'none', color: 'white', borderRadius: '4px' },
    buttonEdit: { backgroundColor: '#ffc107', color: '#212529'},
    buttonDelete: { backgroundColor: '#dc3545'},
    buttonPrimary: { backgroundColor: '#007bff'},
    buttonSecondary: { backgroundColor: '#6c757d'},
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' },
    label: { minWidth: '120px', textAlign: 'right', marginRight: '10px' }, // Adjusted for alignment
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    textarea: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minHeight: '60px' },
    checkboxContainer: { display: 'flex', alignItems: 'center', gap: '5px', flexGrow: 1 },
    checkboxLabel: { fontWeight: 'normal', minWidth: 'auto', marginRight: 0 },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

const initialFormState = {
    name: '',
    description: '',
    house_type_id: '',
    specialty_id: '',
    station_sequence_order: '',
    task_dependencies: [], // Assuming this might be added later
};

const generateStageOptions = (stations) => {
    const stageLabels = {
        1: 'Linea de Paneles 1 (W1)', 2: 'Linea de Paneles 2 (W2)', 3: 'Linea de Paneles 3 (W3)',
        4: 'Linea de Paneles 4 (W4)', 5: 'Linea de Paneles 5 (W5)', 6: 'Magazine (M1)',
        7: 'Linea de Ensamblaje 1 (A1/B1/C1)', 8: 'Linea de Ensamblaje 2 (A2/B2/C2)',
        9: 'Linea de Ensamblaje 3 (A3/B3/C3)', 10: 'Linea de Ensamblaje 4 (A4/B4/C4)',
        11: 'Linea de Ensamblaje 5 (A5/B5/C5)', 12: 'Linea de Ensamblaje 6 (A6/B6/C6)',
    };
    const existingOrders = [...new Set(stations.map(s => s.sequence_order))].sort((a, b) => a - b);
    return existingOrders.map(order => ({
        value: order.toString(),
        label: stageLabels[order] || `Etapa Desconocida (${order})`
    }));
};


function TaskDefinitionManager() {
    const [taskDefs, setTaskDefs] = useState([]);
    const [houseTypes, setHouseTypes] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [stations, setStations] = useState([]);
    const [potentialDependencies, setPotentialDependencies] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null);
    const [formData, setFormData] = useState(initialFormState);
    const [isDependencyModalOpen, setIsDependencyModalOpen] = useState(false);

    const stageLabelMap = useMemo(() => {
        const options = generateStageOptions(stations);
        const map = new Map();
        options.forEach(option => map.set(parseInt(option.value, 10), option.label));
        return map;
    }, [stations]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [defsData, houseTypesData, specsData, stationsData] = await Promise.all([
                adminService.getTaskDefinitions(),
                adminService.getHouseTypes(),
                adminService.getSpecialties(),
                adminService.getStations()
            ]);
            setTaskDefs(defsData || []);
            setHouseTypes(houseTypesData || []);
            setSpecialties(specsData || []);
            setStations(stationsData || []);
        } catch (err) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch potential dependencies when station_sequence_order or is_panel_task changes in form
    // Fetch potential dependencies when station_sequence_order or is_panel_task changes in form
    useEffect(() => {
        const fetchDependencies = async () => {
            const currentStationOrder = formData.station_sequence_order;
            // Determine is_panel_task based on station_sequence_order
            // Panel stations are sequence_order 1-5.
            // If no station is selected, it's considered a general (module) task.
            const derivedIsPanelTask = currentStationOrder ? parseInt(currentStationOrder, 10) <= 5 : false;

            try {
                const deps = await adminService.getPotentialTaskDependencies(
                    currentStationOrder || null,
                    derivedIsPanelTask
                );
                // Filter out the task being edited from its own potential dependencies
                setPotentialDependencies(deps.filter(dep => dep.task_definition_id !== editMode) || []);
            } catch (err) {
                console.error("Failed to fetch potential dependencies:", err);
                setPotentialDependencies([]);
            }
        };
        fetchDependencies();
    }, [formData.station_sequence_order, editMode]);


    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };
    
    // This function will be called by the modal on save
    const handleSaveDependencies = (selectedDependencyIds) => {
        setFormData(prev => ({ ...prev, task_dependencies: selectedDependencyIds.map(String) }));
    };


    const handleEdit = (taskDef) => {
        setEditMode(taskDef.task_definition_id);
        setFormData({
            name: taskDef.name || '',
            description: taskDef.description || '',
            house_type_id: taskDef.house_type_id?.toString() || '',
            specialty_id: taskDef.specialty_id?.toString() || '',
            station_sequence_order: taskDef.station_sequence_order?.toString() || '',
            task_dependencies: Array.isArray(taskDef.task_dependencies) ? taskDef.task_dependencies.map(String) : (taskDef.task_dependencies ? String(taskDef.task_dependencies).split(',').map(String) : [])
        });
        window.scrollTo(0, 0);
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

        const currentStationOrder = formData.station_sequence_order;
        const derivedIsPanelTaskForSubmit = currentStationOrder ? parseInt(currentStationOrder, 10) <= 5 : false;

        const payload = {
            ...formData,
            house_type_id: formData.house_type_id || null,
            specialty_id: formData.specialty_id || null,
            station_sequence_order: currentStationOrder ? parseInt(currentStationOrder, 10) : null,
            is_panel_task: derivedIsPanelTaskForSubmit,
            task_dependencies: formData.task_dependencies.join(','), // Convert to comma-separated string for backend
        };

        try {
            if (editMode) {
                await adminService.updateTaskDefinition(editMode, payload);
            } else {
                await adminService.addTaskDefinition(payload);
            }
            handleCancelEdit();
            await fetchData();
        } catch (err) {
            setError(err.message || `Error al ${editMode ? 'actualizar' : 'añadir'} la definición de tarea`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta definición de tarea?')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteTaskDefinition(id);
                await fetchData();
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
                     <input id="taskName" type="text" name="name" placeholder="Nombre Tarea (ej: Instalar Marco Ventana)" value={formData.name} onChange={handleInputChange} required style={styles.input}/>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="taskDesc">Descripción:</label>
                     <textarea id="taskDesc" name="description" placeholder="Descripción detallada (Opcional)" value={formData.description} onChange={handleInputChange} style={styles.textarea}/>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="houseType">Tipo Vivienda:</label>
                     <select id="houseType" name="house_type_id" value={formData.house_type_id} onChange={handleInputChange} style={styles.select}>
                         <option value="">-- Opcional: Para todos los Tipos --</option>
                         {houseTypes.map(ht => (<option key={ht.house_type_id} value={ht.house_type_id}>{ht.name}</option>))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="specialty">Especialidad:</label>
                     <select id="specialty" name="specialty_id" value={formData.specialty_id} onChange={handleInputChange} style={styles.select} >
                         <option value="">-- Opcional: Para todas las Especialidades --</option>
                         {specialties.map(spec => (<option key={spec.specialty_id} value={spec.specialty_id}>{spec.name}</option>))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="stationSequence">Etapa (Secuencia):</label>
                     <select id="stationSequence" name="station_sequence_order" value={formData.station_sequence_order} onChange={handleInputChange} style={styles.select} >
                         <option value="">-- Opcional: Tarea General (No en Estación) --</option>
                         {generateStageOptions(stations).map(stage => (<option key={stage.value} value={stage.value}>{stage.label}</option>))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                    <label style={styles.label}>Dependencias (Pre-requisitos):</label>
                    <div style={{flexGrow: 1}}>
                        <button 
                            type="button" 
                            onClick={() => setIsDependencyModalOpen(true)} 
                            style={{...styles.button, ...styles.buttonSecondary, marginBottom: '5px'}}
                            disabled={isLoading}
                        >
                            Seleccionar Dependencias
                        </button>
                        <div style={{fontSize: '0.9em', color: '#333', marginTop: '5px'}}>
                            {formData.task_dependencies && formData.task_dependencies.length > 0 ?
                                `Seleccionadas: ${formData.task_dependencies.map(depId => {
                                    const depTask = potentialDependencies.find(pd => pd.task_definition_id.toString() === depId) || taskDefs.find(td => td.task_definition_id.toString() === depId);
                                    return depTask ? depTask.name : `ID ${depId}`;
                                }).join(', ')}`
                                : 'Ninguna dependencia seleccionada.'
                            }
                        </div>
                    </div>
                </div>

                {isDependencyModalOpen && (
                    <TaskDependencySelectorModal
                        show={isDependencyModalOpen}
                        potentialDependencies={potentialDependencies}
                        currentDependencies={formData.task_dependencies}
                        onSave={handleSaveDependencies}
                        onClose={() => setIsDependencyModalOpen(false)}
                        stageLabelMap={stageLabelMap}
                    />
                )}

                 <div>
                     <button type="submit" disabled={isLoading} style={{...styles.button, ...styles.buttonPrimary}}>
                         {isLoading ? 'Guardando...' : (editMode ? 'Actualizar Definición' : 'Añadir Definición')}
                     </button>
                     {editMode && (
                         <button type="button" onClick={handleCancelEdit} style={{...styles.button, ...styles.buttonSecondary}} disabled={isLoading}>
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
                            <th style={styles.th}>Tipo Tarea</th>
                            <th style={styles.th}>Tipo Vivienda</th>
                            <th style={styles.th}>Especialidad</th>
                            <th style={styles.th}>Etapa (Secuencia)</th>
                            <th style={styles.th}>Dependencias</th>
                            <th style={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taskDefs.map((td) => (
                            <tr key={td.task_definition_id}>
                                <td style={styles.td}>{td.name}</td>
                                <td style={styles.td}>{td.description}</td>
                                <td style={styles.td}>{td.is_panel_task ? 'Panel' : 'Módulo'}</td>
                                <td style={styles.td}>{td.house_type_name || 'N/A'}</td>
                                <td style={styles.td}>{td.specialty_name || 'N/A'}</td>
                                <td style={styles.td}>{(stageLabelMap.get(td.station_sequence_order) || td.station_sequence_order) ?? 'N/A'}</td>
                                <td style={styles.td}>
                                    {td.task_dependencies ? 
                                        String(td.task_dependencies).split(',').map(depId => {
                                            const depTask = taskDefs.find(t => t.task_definition_id === parseInt(depId));
                                            return depTask ? depTask.name : `ID ${depId}`;
                                        }).join(', ')
                                        : 'Ninguna'}
                                </td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(td)} style={{...styles.button, ...styles.buttonEdit}} disabled={isLoading}>Editar</button>
                                    <button onClick={() => handleDelete(td.task_definition_id)} style={{...styles.button, ...styles.buttonDelete}} disabled={isLoading}>Eliminar</button>
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
