import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import {
    getStationContext,
    startPanelTask,
    pausePanelTask,
    resumePanelTask,
    finishPanelTask,
} from '../services/productionService'; // Import services

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId';

// Helper function to check if a specific station ID is valid for the ambiguous context
const checkSpecificIdValidity = (specificId, ambiguousSequence, stations) => {
    if (!specificId || !stations || stations.length === 0) return false;
    const station = stations.find(s => s.station_id === specificId);
    if (!station) return false;

    if (ambiguousSequence === PANEL_LINE_GENERAL_VALUE) {
        return station.sequence_order >= 1 && station.sequence_order <= 5; // W stations
    } else {
        const numericAmbiguousSeq = parseInt(ambiguousSequence, 10);
        if (isNaN(numericAmbiguousSeq)) return false;
        return station.sequence_order === numericAmbiguousSeq;
    }
};


const StationPage = ({ user, activeStationSequenceOrder, allStations, isLoadingAllStations, allStationsError }) => {
    const [showSpecificStationModal, setShowSpecificStationModal] = useState(false);
    const [currentSpecificStationId, setCurrentSpecificStationId] = useState(null);

    // State for station overview data (current module, upcoming module, tasks, panels)
    const [moduleData, setModuleData] = useState(null); // Module currently at station
    const [upcomingModuleData, setUpcomingModuleData] = useState(null); // Next module if seq=1 and no current module
    const [tasks, setTasks] = useState([]);
    const [availablePanels, setAvailablePanels] = useState([]); // State for panels
    const [isLoadingStationData, setIsLoadingStationData] = useState(false);
    const [stationDataError, setStationDataError] = useState('');

    // State for task actions
    const [isTaskUpdating, setIsTaskUpdating] = useState({}); // e.g., { [taskKey]: true }
    const [taskErrors, setTaskErrors] = useState({}); // e.g., { [taskKey]: "Error message" }


    useEffect(() => {
        if (!user || isLoadingAllStations || !allStations || allStations.length === 0) {
            // If stations are loading or not available, or no user, don't do anything yet.
            // If activeStationSequenceOrder is null/undefined (not configured), also wait.
            if (!activeStationSequenceOrder && user) {
                 // If user is logged in but no station context is set at all,
                 // this page might show a message or redirect to context selection.
                 // For now, we assume activeStationSequenceOrder will be set.
            }
            return;
        }

        const specificIdFromStorage = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
        setCurrentSpecificStationId(specificIdFromStorage);

        const parsedSequenceOrder = typeof activeStationSequenceOrder === 'string' && activeStationSequenceOrder !== PANEL_LINE_GENERAL_VALUE
            ? parseInt(activeStationSequenceOrder, 10)
            : activeStationSequenceOrder;

        const isAmbiguous =
            parsedSequenceOrder === PANEL_LINE_GENERAL_VALUE ||
            (typeof parsedSequenceOrder === 'number' && parsedSequenceOrder >= 7 && parsedSequenceOrder <= 12);

        if (isAmbiguous) {
            const isValid = checkSpecificIdValidity(specificIdFromStorage, parsedSequenceOrder, allStations);
            if (!isValid) {
                setShowSpecificStationModal(true);
            } else {
                setShowSpecificStationModal(false);
            }
        } else {
            // Not ambiguous, clear any lingering specific ID and don't show modal
            setShowSpecificStationModal(false);
            if (specificIdFromStorage) {
                localStorage.removeItem(SELECTED_SPECIFIC_STATION_ID_KEY);
                setCurrentSpecificStationId(null);
            }
        }
    }, [user, activeStationSequenceOrder, allStations, isLoadingAllStations]); // Removed currentSpecificStationId from deps as it's set inside

    // Define fetchStationData using useCallback to stabilize its identity
    const fetchStationData = useCallback(async () => {
        if (!currentSpecificStationId || !user || user.specialty_id === undefined) {
            // Clear data if station or user/specialty is not set
            setModuleData(null);
            setUpcomingModuleData(null); // Clear upcoming module too
            setTasks([]);
            setAvailablePanels([]);
            return;
        }

        setIsLoadingStationData(true);
        setStationDataError('');
        setModuleData(null);
        setUpcomingModuleData(null); // Clear upcoming module before fetch
        setTasks([]);
        setAvailablePanels([]); // Clear panels before fetch
        try {
            // console.log("Fetching station data for:", currentSpecificStationId, "Specialty:", user.specialty_id);
            const data = await getStationContext(currentSpecificStationId, user.specialty_id);
            // console.log("Station Context Data Received:", data); // Debugging

            setModuleData(data.current_module || null);
            setUpcomingModuleData(null); // Not provided by getStationContext

            let flattenedTasks = [];
            if (data.current_module && data.current_module.panels) {
                data.current_module.panels.forEach(panel => {
                    if (panel.current_task) {
                        flattenedTasks.push({
                            ...panel.current_task,
                            plan_id: data.current_module.plan_id,
                            panel_definition_id: panel.panel_definition_id,
                            // task_name is already in current_task
                            // task_description is already in current_task (assuming it has 'description')
                            // task_status is already in current_task
                            is_panel_task: true,
                        });
                    } else if (panel.available_tasks) {
                        panel.available_tasks.forEach(availTask => {
                            // Filter by specialty_id if it exists on availTask and user has a specialty_id
                            if (user && user.specialty_id !== undefined && availTask.specialty_id !== undefined) {
                                if (availTask.specialty_id !== user.specialty_id) {
                                    return; // Skip this task if specialty doesn't match
                                }
                            }
                            flattenedTasks.push({
                                ...availTask, // Includes task_definition_id, name, description, specialty_id, specialty_name
                                plan_id: data.current_module.plan_id,
                                panel_definition_id: panel.panel_definition_id,
                                task_name: availTask.name, // Explicitly map name
                                task_description: availTask.description, // Explicitly map description
                                task_status: 'Not Started',
                                panel_task_log_id: null,
                                is_panel_task: true,
                            });
                        });
                    }
                });
            }
            setTasks(data.current_module ? flattenedTasks : []);
            setAvailablePanels(data.current_module && data.current_module.panels ? data.current_module.panels : []);
        } catch (error) {
            console.error("Error fetching station data:", error);
            setStationDataError(error.message || 'Error al cargar datos de la estación.');
        } finally {
            setIsLoadingStationData(false);
        }
    }, [currentSpecificStationId, user]); // Dependencies for useCallback

    // Effect to fetch module, task, and panel data
    useEffect(() => {
        fetchStationData();
    }, [fetchStationData]); // Depend on the stable fetchStationData function

    // Task Action Handlers
    const getTaskKey = (task, index) => `${task.plan_id}-${task.panel_definition_id}-${task.task_definition_id}-${task.panel_task_log_id || index}`;

    const handleStartTask = async (task, taskKey) => {
        if (!user || !user.worker_id || !currentSpecificStationId || !task.plan_id || !task.panel_definition_id || !task.task_definition_id) {
            setTaskErrors(prev => ({ ...prev, [taskKey]: "Faltan datos para iniciar la tarea." }));
            return;
        }
        setIsTaskUpdating(prev => ({ ...prev, [taskKey]: true }));
        setTaskErrors(prev => ({ ...prev, [taskKey]: null }));
        try {
            await startPanelTask(
                task.plan_id,
                task.panel_definition_id,
                task.task_definition_id,
                user.worker_id,
                currentSpecificStationId
            );
            fetchStationData(); // Refresh data
        } catch (error) {
            console.error("Error starting task:", error);
            setTaskErrors(prev => ({ ...prev, [taskKey]: error.message || 'Error al iniciar la tarea.' }));
        } finally {
            setIsTaskUpdating(prev => ({ ...prev, [taskKey]: false }));
        }
    };

    const handlePauseTask = async (task, taskKey) => {
        if (!user || !user.worker_id || !task.panel_task_log_id) {
            setTaskErrors(prev => ({ ...prev, [taskKey]: "Faltan datos para pausar la tarea." }));
            return;
        }
        setIsTaskUpdating(prev => ({ ...prev, [taskKey]: true }));
        setTaskErrors(prev => ({ ...prev, [taskKey]: null }));
        try {
            await pausePanelTask(task.panel_task_log_id, user.worker_id);
            fetchStationData(); // Refresh data
        } catch (error) {
            console.error("Error pausing task:", error);
            setTaskErrors(prev => ({ ...prev, [taskKey]: error.message || 'Error al pausar la tarea.' }));
        } finally {
            setIsTaskUpdating(prev => ({ ...prev, [taskKey]: false }));
        }
    };

    const handleResumeTask = async (task, taskKey) => {
        if (!user || !user.worker_id || !task.panel_task_log_id) {
            setTaskErrors(prev => ({ ...prev, [taskKey]: "Faltan datos para reanudar la tarea." }));
            return;
        }
        setIsTaskUpdating(prev => ({ ...prev, [taskKey]: true }));
        setTaskErrors(prev => ({ ...prev, [taskKey]: null }));
        try {
            await resumePanelTask(task.panel_task_log_id, user.worker_id);
            fetchStationData(); // Refresh data
        } catch (error) {
            console.error("Error resuming task:", error);
            setTaskErrors(prev => ({ ...prev, [taskKey]: error.message || 'Error al reanudar la tarea.' }));
        } finally {
            setIsTaskUpdating(prev => ({ ...prev, [taskKey]: false }));
        }
    };

    const handleCompleteTask = async (task, taskKey) => {
        if (!user || !user.worker_id || !task.panel_task_log_id || !currentSpecificStationId) {
            setTaskErrors(prev => ({ ...prev, [taskKey]: "Faltan datos para completar la tarea." }));
            return;
        }
        setIsTaskUpdating(prev => ({ ...prev, [taskKey]: true }));
        setTaskErrors(prev => ({ ...prev, [taskKey]: null }));
        try {
            await finishPanelTask(task.panel_task_log_id, user.worker_id, currentSpecificStationId);
            fetchStationData(); // Refresh data
        } catch (error) {
            console.error("Error completing task:", error);
            setTaskErrors(prev => ({ ...prev, [taskKey]: error.message || 'Error al completar la tarea.' }));
        } finally {
            setIsTaskUpdating(prev => ({ ...prev, [taskKey]: false }));
        }
    };

    const handleSaveSpecificStation = (specificStationId) => {
        localStorage.setItem(SELECTED_SPECIFIC_STATION_ID_KEY, specificStationId);
        setCurrentSpecificStationId(specificStationId);
        setShowSpecificStationModal(false);
        // Data fetching will be triggered by the useEffect watching currentSpecificStationId via fetchStationData
    };

    const handleChangeStationClick = () => {
        localStorage.removeItem(SELECTED_SPECIFIC_STATION_ID_KEY);
        setCurrentSpecificStationId(null); // Also clear it from state immediately
        setShowSpecificStationModal(true);
    };

    const displayStationName = useMemo(() => {
        if (isLoadingAllStations) return "Cargando info de estación...";
        if (allStationsError) return `Error de estación: ${allStationsError}`;
        if (!activeStationSequenceOrder && !currentSpecificStationId) return "Estación No Configurada";

        if (currentSpecificStationId && allStations && allStations.length > 0) {
            const specificStation = allStations.find(s => s.station_id === currentSpecificStationId);
            if (specificStation) {
                // Check if this specific station is still valid for the current ambiguousSequenceOrder
                // This is important if ambiguousSequenceOrder changed but specificIdFromStorage was stale
                const isValidForCurrentContext = checkSpecificIdValidity(currentSpecificStationId, activeStationSequenceOrder, allStations);
                if (isValidForCurrentContext) {
                    return `${specificStation.name} (${specificStation.station_id})`;
                }
                // If not valid, the modal should be showing, or will show soon.
                // Fall through to general name or "awaiting selection"
            }
        }
        
        if (showSpecificStationModal) {
            return "Esperando selección de estación específica...";
        }

        if (activeStationSequenceOrder === PANEL_LINE_GENERAL_VALUE) {
            return PANEL_LINE_GENERAL_LABEL;
        }

        if (allStations && allStations.length > 0) {
            const sequenceMap = new Map();
            allStations.forEach(station => {
                if (!sequenceMap.has(station.sequence_order)) {
                    let displayName = station.name;
                    if (station.sequence_order >= 7) {
                        const assemblyMatch = station.name.match(/Línea de Ensamblaje [A-C]: (Estación \d+)/);
                        if (assemblyMatch && assemblyMatch[1]) {
                            displayName = assemblyMatch[1];
                        } else {
                            displayName = `Estación de Secuencia ${station.sequence_order}`;
                        }
                    }
                    sequenceMap.set(station.sequence_order, {
                        value: station.sequence_order,
                        label: `${displayName} (Secuencia ${station.sequence_order})`,
                    });
                }
            });
            const foundOption = sequenceMap.get(parseInt(activeStationSequenceOrder, 10));
            if (foundOption) return foundOption.label;
        }
        
        return activeStationSequenceOrder ? `Contexto: ${activeStationSequenceOrder}` : "Estación No Configurada";

    }, [activeStationSequenceOrder, currentSpecificStationId, allStations, isLoadingAllStations, allStationsError, showSpecificStationModal]);

    if (!user) {
        return <Navigate to="/" replace />;
    }

    const pageStyle = {
        padding: '20px',
        textAlign: 'center',
    };

    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee',
    };

    const stationInfoStyle = {
        fontSize: '0.9em',
        color: '#555',
        display: 'flex', // Added for alignment
        flexDirection: 'column', // Stack text and button
        alignItems: 'flex-end', // Align to the right
    };

    if (isLoadingAllStations && !allStations.length) { // Show loading only if truly no station data yet
        return <div style={pageStyle}><p>Cargando datos de estaciones...</p></div>;
    }
    
    // If an error occurred loading stations critical for this page's function
    if (allStationsError && !allStations.length) {
         return <div style={pageStyle}><p style={{color: 'red'}}>Error cargando datos de estaciones: {allStationsError}</p></div>;
    }


    return (
        <div style={pageStyle}>
            {showSpecificStationModal && (
                <SpecificStationSelectorModal
                    show={showSpecificStationModal}
                    onSave={handleSaveSpecificStation}
                    ambiguousSequenceOrder={activeStationSequenceOrder}
                    allStations={allStations}
                    isLoadingOptions={isLoadingAllStations}
                />
            )}
            <div style={headerStyle}>
                <h1>Bienvenido/a, {user.first_name}</h1>
                <div style={stationInfoStyle}>
                    <div>Estación: {displayStationName}</div>
                    {currentSpecificStationId && !showSpecificStationModal && (
                        <button
                            onClick={handleChangeStationClick}
                            style={{...buttonStyle, marginTop: '5px', padding: '5px 10px', fontSize: '0.8em', backgroundColor: '#6c757d' }} // Secondary color
                        >
                            Cambiar Estación
                        </button>
                    )}
                </div>
            </div>
            {allStationsError && <p style={{ color: 'red' }}>{allStationsError}</p>}

            {!showSpecificStationModal && currentSpecificStationId ? (
                <div>
                    {isLoadingStationData && <p>Cargando datos del módulo y tareas...</p>}
                    {stationDataError && <p style={{ color: 'red' }}>{stationDataError}</p>}

                    {/* Display Current Module OR Upcoming Module */}
                    {moduleData ? (
                        <div style={moduleInfoBoxStyle}>
                            <h3>Módulo Actual</h3>
                            <p><strong>Proyecto:</strong> {moduleData.project_name}</p>
                            <p><strong>Tipo de Casa:</strong> {moduleData.house_type_name} {moduleData.sub_type_name ? `(${moduleData.sub_type_name})` : ''}</p>
                            <p><strong>Identificador Casa:</strong> {moduleData.house_identifier}</p>
                            <p><strong>Módulo:</strong> {moduleData.module_number} de {moduleData.number_of_modules}</p>
                            <p><strong>Secuencia Planificada:</strong> {moduleData.planned_sequence}</p>
                            <p><strong>Estado Módulo:</strong> {moduleData.module_status}</p>
                        </div>
                    ) : upcomingModuleData ? (
                        <div style={{...moduleInfoBoxStyle, backgroundColor: '#eef'}}> {/* Slightly different background for upcoming */}
                            <h3>Próximo Módulo</h3>
                            <p><strong>Proyecto:</strong> {upcomingModuleData.project_name}</p>
                            <p><strong>Tipo de Casa:</strong> {upcomingModuleData.house_type_name} {upcomingModuleData.sub_type_name ? `(${upcomingModuleData.sub_type_name})` : ''}</p>
                            <p><strong>Identificador Casa:</strong> {upcomingModuleData.house_identifier}</p>
                            <p><strong>Módulo:</strong> {upcomingModuleData.module_number} de {upcomingModuleData.number_of_modules}</p>
                            <p><strong>Secuencia Planificada:</strong> {upcomingModuleData.planned_sequence}</p>
                            <p><strong>Estado Plan:</strong> {upcomingModuleData.status}</p>
                        </div>
                    ) : !isLoadingStationData && !stationDataError && (
                        <p style={{ marginTop: '20px' }}>No hay módulo asignado a esta estación actualmente ni módulo próximo en planificación.</p>
                    )}

                    {/* Display Tasks (for current or upcoming module) */}
                    {tasks.length > 0 && (
                        <div style={{ marginTop: '30px' }}>
                            <h3>Tareas {moduleData ? 'Pendientes/En Progreso' : 'Próximo Módulo'}</h3>
                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                                {tasks.map((task, index) => {
                                    const taskKey = getTaskKey(task, index);
                                    const isLoading = isTaskUpdating[taskKey];
                                    const error = taskErrors[taskKey];

                                    return (
                                        <li key={taskKey} style={taskListItemStyle}>
                                            <div style={taskInfoStyle}>
                                                <h4>{task.task_name}</h4>
                                                <p>{task.task_description || 'Sin descripción detallada.'}</p>
                                                <p><strong>Estado:</strong> {task.task_status}</p>
                                                {task.panel_definition_id && <p><em>Panel ID: {task.panel_definition_id} (Def)</em></p>}
                                                {task.is_panel_task && <p><small>Tarea de Panel</small></p>}
                                            </div>
                                            <div style={taskActionsStyle}>
                                                {task.task_status === 'Not Started' && (
                                                    <button
                                                        onClick={() => handleStartTask(task, taskKey)}
                                                        disabled={isLoading}
                                                        style={buttonStyle}
                                                    >
                                                        {isLoading ? 'Iniciando...' : 'Iniciar'}
                                                    </button>
                                                )}
                                                {task.task_status === 'In Progress' && (
                                                    <>
                                                        <button
                                                            onClick={() => handlePauseTask(task, taskKey)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black', marginRight: '5px'}}
                                                        >
                                                            {isLoading ? 'Pausando...' : 'Pausar'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCompleteTask(task, taskKey)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#28a745'}}
                                                        >
                                                            {isLoading ? 'Completando...' : 'Completar'}
                                                        </button>
                                                    </>
                                                )}
                                                {task.task_status === 'Paused' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleResumeTask(task, taskKey)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#17a2b8', marginRight: '5px'}}
                                                        >
                                                            {isLoading ? 'Reanudando...' : 'Reanudar'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCompleteTask(task, taskKey)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#28a745'}}
                                                        >
                                                            {isLoading ? 'Completando...' : 'Completar'}
                                                        </button>
                                                    </>
                                                )}
                                                {error && <p style={errorStyle}>{error}</p>}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    {/* Message when no tasks are available */}
                    {!isLoadingStationData && !stationDataError && (moduleData || upcomingModuleData) && tasks.length === 0 && (
                         <p style={{ marginTop: '20px' }}>No hay tareas disponibles para {moduleData ? 'este módulo' : 'el próximo módulo'} en esta estación para su especialidad.</p>
                    )}
                </div>
            ) : (
                 !currentSpecificStationId && !showSpecificStationModal && <p>Configurando estación...</p>
            )}
             {showSpecificStationModal && (
                <p>Por favor, seleccione su estación específica para continuar.</p>
            )}
        </div>
    );
};

// Some basic styles (consider moving to a separate CSS file or styled-components)
const moduleInfoBoxStyle = {
    marginTop: '20px',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '5px',
    backgroundColor: '#f9f9f9',
    textAlign: 'left', // Align text left within the box
};

const taskListItemStyle = {
    border: '1px solid #ddd',
    padding: '15px',
    marginBottom: '10px',
    borderRadius: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Align items to the top
    flexWrap: 'wrap', // Allow actions to wrap on smaller screens
};

const taskInfoStyle = {
    flex: '1 1 60%', // Takes up more space, allows shrinking/growing
    marginRight: '15px', // Space between info and actions
};

const taskActionsStyle = {
    flex: '1 1 35%', // Takes less space initially
    display: 'flex',
    flexDirection: 'column', // Stack actions vertically
    alignItems: 'flex-end', // Align actions to the right
    minWidth: '200px', // Ensure actions have some minimum width
};

// panelSelectorContainerStyle and selectStyle are removed as they are no longer used.

const buttonStyle = {
    padding: '8px 15px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: 1,
    transition: 'opacity 0.2s ease-in-out',
};

// Add disabled style directly here for simplicity
buttonStyle[':disabled'] = {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed',
    opacity: 0.6,
};


const errorStyle = {
    color: 'red',
    fontSize: '0.9em',
    marginTop: '5px',
    width: '100%', // Ensure error message takes full width in the actions container
    textAlign: 'right',
};


export default StationPage;
