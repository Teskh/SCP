import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import { getStationOverviewData, startTask, pauseTask, resumeTask, completeTask } from '../services/adminService'; // Import services

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId';
const SELECTED_STATION_CONTEXT_KEY = 'selectedStationContext'; // New constant for the main key

// Helper function to check if a specific station ID is valid for the ambiguous context
const checkSpecificIdValidity = (specificId, ambiguousContextValue, allStations) => {
    if (!specificId || !allStations || allStations.length === 0) return false;
    const station = allStations.find(s => s.station_id === specificId);
    if (!station) return false;

    if (ambiguousContextValue === PANEL_LINE_GENERAL_VALUE) {
        // For 'PANEL_LINE_GENERAL', the specific ID must be a 'W' type station
        return station.line_type === 'W';
    } else {
        // For numeric assembly sequences (7-12), the specific ID must match that sequence order
        const numericAmbiguousSeq = parseInt(ambiguousContextValue, 10);
        if (isNaN(numericAmbiguousSeq)) return false;
        return station.sequence_order === numericAmbiguousSeq;
    }
};


const ProductionManager = ({ user, allStations, isLoadingAllStations, allStationsError }) => {
    const [showSpecificStationModal, setShowSpecificStationModal] = useState(false);
    const [userSelectedStationContext, setUserSelectedStationContext] = useState(null); // New state for the main context from localStorage
    const [resolvedSpecificStationId, setResolvedSpecificStationId] = useState(null); // The actual station_id to use for API calls

    // State for station overview data (current module, tasks, panels)
    const [moduleData, setModuleData] = useState(null); // Module currently at station
    const [tasks, setTasks] = useState([]);
    const [availablePanels, setAvailablePanels] = useState([]); // State for panels
    const [isLoadingStationData, setIsLoadingStationData] = useState(false);
    const [stationDataError, setStationDataError] = useState('');
    const [taskActionLoading, setTaskActionLoading] = useState(null); // Track loading state per task
    const [taskActionError, setTaskActionError] = useState(null); // Track error state per task

    // State for panel selection UI
    const [selectingPanelForTask, setSelectingPanelForTask] = useState(null); // task_definition_id
    const [selectedPanelId, setSelectedPanelId] = useState('');


    // Effect to determine the station context and specific station ID
    useEffect(() => {
        if (!user || isLoadingAllStations || !allStations || allStations.length === 0) {
            return;
        }

        const storedContext = localStorage.getItem(SELECTED_STATION_CONTEXT_KEY);
        setUserSelectedStationContext(storedContext); // Set the main context

        if (!storedContext) {
            // No station context selected at all, clear resolved ID and ensure modal is closed
            setResolvedSpecificStationId(null);
            setShowSpecificStationModal(false);
            return;
        }

        const specificIdFromStorage = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);

        const isAmbiguousContext =
            storedContext === PANEL_LINE_GENERAL_VALUE ||
            (typeof storedContext === 'string' && parseInt(storedContext, 10) >= 7 && parseInt(storedContext, 10) <= 12);

        if (isAmbiguousContext) {
            const isValidSpecificId = checkSpecificIdValidity(specificIdFromStorage, storedContext, allStations);
            if (!isValidSpecificId) {
                // Ambiguous context, but no valid specific ID chosen yet or it's invalid
                setResolvedSpecificStationId(null); // Clear invalid specific ID
                setShowSpecificStationModal(true); // Prompt user to select specific station
            } else {
                // Ambiguous context, and a valid specific ID is already chosen
                setResolvedSpecificStationId(specificIdFromStorage);
                setShowSpecificStationModal(false);
            }
        } else {
            // Not an ambiguous context (it's a direct station ID like 'W1', 'A1A', etc.)
            // In this case, the 'selectedStationContext' IS the specific station ID.
            setResolvedSpecificStationId(storedContext);
            setShowSpecificStationModal(false);
            // Clear any lingering specific ID from previous ambiguous selections, as it's not relevant now
            if (specificIdFromStorage) {
                localStorage.removeItem(SELECTED_SPECIFIC_STATION_ID_KEY);
            }
        }
    }, [user, allStations, isLoadingAllStations]); // Dependencies for this effect

    // Define fetchStationData using useCallback to stabilize its identity
    const fetchStationData = useCallback(async () => {
        // Use resolvedSpecificStationId for API calls
        if (!resolvedSpecificStationId || !user || user.specialty_id === undefined) {
            // Clear data if station or user/specialty is not set
            setModuleData(null);
            setTasks([]);
            setAvailablePanels([]);
            return;
        }

        setIsLoadingStationData(true);
        setStationDataError('');
        setModuleData(null);
        setTasks([]);
        setAvailablePanels([]); // Clear panels before fetch
        try {
            const data = await getStationOverviewData(resolvedSpecificStationId, user.specialty_id); // Use resolvedSpecificStationId
            setModuleData(data.module); // Will be null if no module at station
            setTasks(data.tasks || []); // Ensure tasks is an array
            setAvailablePanels(data.panels || []); // Store panels if returned
        } catch (error) {
            console.error("Error fetching station data:", error);
            setStationDataError(error.message || 'Error al cargar datos de la estación.');
        } finally {
            setIsLoadingStationData(false);
        }
    }, [resolvedSpecificStationId, user]); // Dependencies for useCallback

    // Effect to trigger data fetching when resolvedSpecificStationId changes
    useEffect(() => {
        fetchStationData();
    }, [fetchStationData]); // Depend on the stable fetchStationData function

    const handleSaveSpecificStation = (specificStationId) => {
        localStorage.setItem(SELECTED_SPECIFIC_STATION_ID_KEY, specificStationId);
        setResolvedSpecificStationId(specificStationId); // Update resolved ID
        setShowSpecificStationModal(false);
        // fetchStationData will be triggered by the useEffect watching resolvedSpecificStationId
    };

    const isPanelLineStation = useMemo(() => {
        if (!resolvedSpecificStationId || !allStations || allStations.length === 0) return false;
        const station = allStations.find(s => s.station_id === resolvedSpecificStationId);
        return station && station.line_type === 'W'; // Check line_type 'W' for panel line stations
    }, [resolvedSpecificStationId, allStations]);

    // --- Task Action Handlers ---

    const handleStartTaskClick = (taskDefinitionId) => {
        setTaskActionError(null); // Clear previous errors
        if (isPanelLineStation) {
            // Show panel selector for this task
            setSelectingPanelForTask(taskDefinitionId);
            setSelectedPanelId(''); // Reset selection
        } else {
            // Start task directly (no panel needed)
            startTaskApiCall(taskDefinitionId, null);
        }
    };

    const handleCancelPanelSelection = () => {
        setSelectingPanelForTask(null);
        setSelectedPanelId('');
        setTaskActionError(null);
    };

    const handleConfirmPanelAndStart = (taskDefinitionId) => {
        if (!selectedPanelId) {
            setTaskActionError({ taskId: taskDefinitionId, message: "Por favor, seleccione un panel." });
            return;
        }
        startTaskApiCall(taskDefinitionId, selectedPanelId);
    };

    const startTaskApiCall = async (taskDefinitionId, panelId) => {
        // We are only working with the current module (if exists)
        if (!moduleData || !moduleData.plan_id || !user || !user.id || !resolvedSpecificStationId) {
            console.error("Missing data needed to start task:", { moduleData, user, resolvedSpecificStationId });
            setTaskActionError({ taskId: taskDefinitionId, message: "Error: Faltan datos para iniciar la tarea (plan_id, usuario, estación)." });
            return;
        }

        setTaskActionLoading(taskDefinitionId);
        setTaskActionError(null);

        try {
            // Send plan_id instead of module_id and use stationStart parameter name
            await startTask(
                moduleData.plan_id, // Use plan_id from current module
                taskDefinitionId,
                user.id, // worker_id
                resolvedSpecificStationId, // stationStart
                panelId // house_type_panel_id (will be null if not panel line or not selected)
            );
            // Success! Refresh data to show updated task status
            fetchStationData(); // Re-fetch all station data
            setSelectingPanelForTask(null); // Close panel selector if open
            setSelectedPanelId('');
        } catch (error) {
            console.error("Error starting task:", error);
            setTaskActionError({ taskId: taskDefinitionId, message: error.message || 'Error al iniciar la tarea.' });
        } finally {
            setTaskActionLoading(null);
        }
    };

    const handlePauseTaskClick = async (taskDefinitionId, panelId = null) => {
        if (!moduleData || !moduleData.plan_id || !user || !user.id) {
            console.error("Missing data needed to pause task:", { moduleData, user });
            setTaskActionError({ taskId: taskDefinitionId, message: "Error: Faltan datos para pausar la tarea." });
            return;
        }

        setTaskActionLoading(taskDefinitionId);
        setTaskActionError(null);

        try {
            await pauseTask(
                moduleData.plan_id,
                taskDefinitionId,
                user.id,
                panelId,
                'Worker initiated pause'
            );
            fetchStationData(); // Refresh data to show updated task status
        } catch (error) {
            console.error("Error pausing task:", error);
            setTaskActionError({ taskId: taskDefinitionId, message: error.message || 'Error al pausar la tarea.' });
        } finally {
            setTaskActionLoading(null);
        }
    };

    const handleResumeTaskClick = async (taskDefinitionId, panelId = null) => {
        if (!moduleData || !moduleData.plan_id) {
            console.error("Missing data needed to resume task:", { moduleData });
            setTaskActionError({ taskId: taskDefinitionId, message: "Error: Faltan datos para reanudar la tarea." });
            return;
        }

        setTaskActionLoading(taskDefinitionId);
        setTaskActionError(null);

        try {
            await resumeTask(
                moduleData.plan_id,
                taskDefinitionId,
                panelId
            );
            fetchStationData(); // Refresh data to show updated task status
        } catch (error) {
            console.error("Error resuming task:", error);
            setTaskActionError({ taskId: taskDefinitionId, message: error.message || 'Error al reanudar la tarea.' });
        } finally {
            setTaskActionLoading(null);
        }
    };

    const handleCompleteTaskClick = async (taskDefinitionId, panelId = null) => {
        if (!moduleData || !moduleData.plan_id || !resolvedSpecificStationId) {
            console.error("Missing data needed to complete task:", { moduleData, resolvedSpecificStationId });
            setTaskActionError({ taskId: taskDefinitionId, message: "Error: Faltan datos para completar la tarea." });
            return;
        }

        setTaskActionLoading(taskDefinitionId);
        setTaskActionError(null);

        try {
            await completeTask(
                moduleData.plan_id,
                taskDefinitionId,
                resolvedSpecificStationId, // station_finish
                panelId,
                '' // notes - could be enhanced to ask user for notes
            );
            fetchStationData(); // Refresh data to show updated task status
        } catch (error) {
            console.error("Error completing task:", error);
            setTaskActionError({ taskId: taskDefinitionId, message: error.message || 'Error al completar la tarea.' });
        } finally {
            setTaskActionLoading(null);
        }
    };

    // --- End Task Action Handlers ---

    const displayStationName = useMemo(() => {
        if (isLoadingAllStations) return "Cargando info de estación...";
        if (allStationsError) return `Error de estación: ${allStationsError}`;
        if (!userSelectedStationContext && !resolvedSpecificStationId) return "Estación No Configurada";

        // If a specific station has been resolved, use its name
        if (resolvedSpecificStationId && allStations && allStations.length > 0) {
            const station = allStations.find(s => s.station_id === resolvedSpecificStationId);
            if (station) {
                return `${station.name} (${station.station_id})`;
            }
        }
        
        // If modal is showing, it means we're waiting for a specific selection
        if (showSpecificStationModal) {
            return "Esperando selección de estación específica...";
        }

        // If userSelectedStationContext is set but no specific station resolved yet (e.g., just loaded page with ambiguous context)
        if (userSelectedStationContext === PANEL_LINE_GENERAL_VALUE) {
            return PANEL_LINE_GENERAL_LABEL;
        }

        // Handle assembly sequence numbers (7-12)
        if (userSelectedStationContext && allStations && allStations.length > 0) {
            const numericSequence = parseInt(userSelectedStationContext, 10);
            if (!isNaN(numericSequence) && numericSequence >= 7 && numericSequence <= 12) {
                // Find any station with this sequence order to get the general assembly name
                const sampleStation = allStations.find(s => s.sequence_order === numericSequence);
                if (sampleStation) {
                    const assemblyNumber = numericSequence - 6;
                    return `Estación de Ensamblaje ${assemblyNumber} (Secuencia ${numericSequence})`;
                }
            }
        }
        
        // Fallback if nothing matches
        return userSelectedStationContext ? `Contexto: ${userSelectedStationContext}` : "Estación No Configurada";

    }, [userSelectedStationContext, resolvedSpecificStationId, allStations, isLoadingAllStations, allStationsError, showSpecificStationModal]);

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
                    selectedStationContext={userSelectedStationContext} // Pass the main context
                    allStations={allStations}
                    isLoadingOptions={isLoadingAllStations}
                />
            )}
            <div style={headerStyle}>
                <h1>Bienvenido/a, {user.first_name}</h1>
                <div style={stationInfoStyle}>
                    Estación: {displayStationName}
                </div>
            </div>
            {allStationsError && <p style={{ color: 'red' }}>{allStationsError}</p>}

            {!showSpecificStationModal && resolvedSpecificStationId ? (
                <div>
                    {isLoadingStationData && <p>Cargando datos del módulo y tareas...</p>}
                    {stationDataError && <p style={{ color: 'red' }}>{stationDataError}</p>}

                    {/* Display Current Module */}
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
                    ) : !isLoadingStationData && !stationDataError && (
                        <p style={{ marginTop: '20px' }}>No hay módulo asignado a esta estación actualmente.</p>
                    )}

                    {/* Display Tasks for current module */}
                    {tasks.length > 0 && (
                        <div style={{ marginTop: '30px' }}>
                            <h3>Tareas Pendientes/En Progreso</h3>
                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                                {tasks.map(task => {
                                    const isSelectingPanel = selectingPanelForTask === task.task_definition_id;
                                    const isLoading = taskActionLoading === task.task_definition_id;
                                    const error = taskActionError?.taskId === task.task_definition_id ? taskActionError.message : null;

                                    return (
                                        <li key={task.task_definition_id} style={taskListItemStyle}>
                                            <div style={taskInfoStyle}>
                                                <h4>{task.task_name}</h4>
                                                <p>{task.task_description}</p>
                                                <p><strong>Estado:</strong> {task.task_status}</p>
                                                {task.house_type_panel_id && <p><em>Panel ID: {task.house_type_panel_id}</em></p>}
                                            </div>
                                            <div style={taskActionsStyle}>
                                                {task.task_status === 'Not Started' && !isSelectingPanel && (
                                                    <button
                                                        onClick={() => handleStartTaskClick(task.task_definition_id)}
                                                        disabled={isLoading}
                                                        style={buttonStyle}
                                                    >
                                                        {isLoading ? 'Iniciando...' : 'Iniciar'}
                                                    </button>
                                                )}
                                                {isSelectingPanel && (
                                                    <div style={panelSelectorContainerStyle}>
                                                        <select
                                                            value={selectedPanelId}
                                                            onChange={(e) => setSelectedPanelId(e.target.value)}
                                                            style={selectStyle}
                                                            disabled={isLoading}
                                                        >
                                                            <option value="">-- Seleccione Panel --</option>
                                                            {availablePanels.map(panel => (
                                                                <option key={panel.panel_definition_id} value={panel.panel_definition_id}>
                                                                    {panel.panel_code} ({panel.panel_group}{panel.multiwall_code ? ` / ${panel.multiwall_code}` : ''})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleConfirmPanelAndStart(task.task_definition_id)}
                                                            disabled={isLoading || !selectedPanelId}
                                                            style={{...buttonStyle, marginLeft: '10px'}}
                                                        >
                                                            {isLoading ? 'Iniciando...' : 'Confirmar Inicio'}
                                                        </button>
                                                        <button
                                                            onClick={handleCancelPanelSelection}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, marginLeft: '5px', backgroundColor: '#6c757d'}} // Secondary color
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                )}
                                                {task.task_status === 'In Progress' && !isSelectingPanel && (
                                                    <>
                                                        <button
                                                            onClick={() => handlePauseTaskClick(task.task_definition_id, task.house_type_panel_id)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#ffc107', marginBottom: '5px'}}
                                                        >
                                                            {isLoading ? 'Pausando...' : 'Pausar'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCompleteTaskClick(task.task_definition_id, task.house_type_panel_id)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#28a745'}}
                                                        >
                                                            {isLoading ? 'Completando...' : 'Completar'}
                                                        </button>
                                                    </>
                                                )}
                                                {task.task_status === 'Paused' && !isSelectingPanel && (
                                                    <button
                                                        onClick={() => handleResumeTaskClick(task.task_definition_id, task.house_type_panel_id)}
                                                        disabled={isLoading}
                                                        style={{...buttonStyle, backgroundColor: '#17a2b8'}}
                                                    >
                                                        {isLoading ? 'Reanudando...' : 'Reanudar'}
                                                    </button>
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
                    {!isLoadingStationData && !stationDataError && moduleData && tasks.length === 0 && (
                         <p style={{ marginTop: '20px' }}>No hay tareas disponibles para este módulo en esta estación para su especialidad.</p>
                    )}
                </div>
            ) : (
                 !resolvedSpecificStationId && !showSpecificStationModal && <p>Configurando estación...</p>
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

const panelSelectorContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    marginTop: '10px',
    flexWrap: 'wrap', // Allow buttons to wrap below select
};

const selectStyle = {
    padding: '8px',
    marginRight: '10px', // Space between select and button
    minWidth: '150px',
    flexGrow: 1, // Allow select to grow
};

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


export default ProductionManager;
