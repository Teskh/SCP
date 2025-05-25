import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import { getStationOverviewData, startTask } from '../services/adminService'; // Import services

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
    const [taskActionLoading, setTaskActionLoading] = useState(null); // Track loading state per task
    const [taskActionError, setTaskActionError] = useState(null); // Track error state per task

    // State for panel selection UI
    const [selectingPanelForTask, setSelectingPanelForTask] = useState(null); // task_definition_id
    const [selectedPanelId, setSelectedPanelId] = useState('');


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
            const data = await getStationOverviewData(currentSpecificStationId, user.specialty_id);
            // console.log("Station Overview Data Received:", data); // Debugging
            setModuleData(data.module); // Will be null if no module at station
            setUpcomingModuleData(data.upcoming_module); // Will be null if module exists or not seq 1 or no upcoming
            setTasks(data.tasks || []); // Ensure tasks is an array (tasks for current or upcoming module)
            setAvailablePanels(data.panels || []); // Store panels if returned (for current or upcoming module)
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

    const handleSaveSpecificStation = (specificStationId) => {
        localStorage.setItem(SELECTED_SPECIFIC_STATION_ID_KEY, specificStationId);
        setCurrentSpecificStationId(specificStationId);
        setShowSpecificStationModal(false);
        // Data fetching will be triggered by the useEffect watching currentSpecificStationId via fetchStationData
    };

    const isPanelLineStation = useMemo(() => {
        if (!currentSpecificStationId || !allStations || allStations.length === 0) return false;
        const station = allStations.find(s => s.station_id === currentSpecificStationId);
        return station && station.sequence_order >= 1 && station.sequence_order <= 5;
    }, [currentSpecificStationId, allStations]);

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
        // Determine if we are starting for a current module or an upcoming one
        const targetModule = moduleData || upcomingModuleData;

        if (!targetModule || !targetModule.plan_id || !user || !user.id || !currentSpecificStationId) {
            console.error("Missing data needed to start task:", { targetModule, user, currentSpecificStationId });
            setTaskActionError({ taskId: taskDefinitionId, message: "Error: Faltan datos para iniciar la tarea (plan_id, usuario, estación)." });
            return;
        }

        setTaskActionLoading(taskDefinitionId);
        setTaskActionError(null);

        try {
            // Send plan_id instead of module_id and use stationStart parameter name
            await startTask(
                targetModule.plan_id, // Use plan_id from current or upcoming module
                taskDefinitionId,
                user.id, // worker_id
                currentSpecificStationId, // stationStart
                panelId // house_type_panel_id (will be null if not panel line or not selected)
            );
            // Success! Refresh data to show updated task status (module should now appear as current)
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

    // --- End Task Action Handlers ---

    const displayStationName = useMemo(() => {
        if (isLoadingAllStations) return "Cargando info de estación...";
        if (allStationsError) return `Error de estación: ${allStationsError}`;
        if (!activeStationSequenceOrder && !currentSpecificStationId) return "Estación No Configurada";

        // Determine the effective station ID to display.
        // If currentSpecificStationId is set (meaning an ambiguous context was chosen and then a specific sub-station), use it.
        // Otherwise, use activeStationSequenceOrder (which could be a specific station ID like W1, or an ambiguous one like PANEL_LINE_GENERAL_VALUE or a sequence number).
        const effectiveStationIdOrSequence = currentSpecificStationId || activeStationSequenceOrder;

        if (effectiveStationIdOrSequence && allStations && allStations.length > 0) {
            // Try to find a direct station match first (for W1-W5, A1A, etc.)
            const directStationMatch = allStations.find(s => s.station_id === effectiveStationIdOrSequence);
            if (directStationMatch) {
                return `${directStationMatch.name} (${directStationMatch.station_id})`;
            }
        }
        
        // If no direct station match, handle ambiguous contexts or general labels
        if (showSpecificStationModal) {
            return "Esperando selección de estación específica...";
        }

        if (activeStationSequenceOrder === PANEL_LINE_GENERAL_VALUE) {
            return PANEL_LINE_GENERAL_LABEL;
        }

        // Handle assembly sequence numbers (7-12)
        if (allStations && allStations.length > 0) {
            const numericSequence = parseInt(activeStationSequenceOrder, 10);
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
                    Estación: {displayStationName}
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
                                                {/* Add buttons for Pause/Complete task later based on status */}
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


export default StationPage;
