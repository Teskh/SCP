import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import { getStationOverviewData, startTask, pauseTask, resumeTask, completeTask } from '../services/adminService'; // Import services

const SELECTED_STATION_CONTEXT_KEY = 'selectedStationContext'; // New constant for the main key

const ProductionManager = ({ user, allStations, isLoadingAllStations, allStationsError }) => {
    const [showSpecificStationModal, setShowSpecificStationModal] = useState(false);
    const [userSelectedStationContext, setUserSelectedStationContext] = useState(null); // New state for the main context from localStorage
    const [resolvedSpecificStationId, setResolvedSpecificStationId] = useState(null); // The actual station_id to use for API calls

    // State for station overview data (current module, tasks, panels)
    const [moduleData, setModuleData] = useState(null); // Module currently at station
    const [tasks, setTasks] = useState([]);
    const [isLoadingStationData, setIsLoadingStationData] = useState(false);
    const [stationDataError, setStationDataError] = useState('');
    const [taskActionLoading, setTaskActionLoading] = useState(null); // Track loading state per task
    const [taskActionError, setTaskActionError] = useState(null); // Track error state per task

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

        // In this case, the 'selectedStationContext' IS the specific station ID.
        setResolvedSpecificStationId(storedContext);
        setShowSpecificStationModal(false);
    }, [user, allStations, isLoadingAllStations]); // Dependencies for this effect

    // Define fetchStationData using useCallback to stabilize its identity
    const fetchStationData = useCallback(async () => {
        // Use resolvedSpecificStationId for API calls
        if (!resolvedSpecificStationId || !user || user.specialty_id === undefined) {
            // Clear data if station or user/specialty is not set
            setModuleData(null);
            setTasks([]);
            return;
        }

        setIsLoadingStationData(true);
        setStationDataError('');
        setModuleData(null);
        setTasks([]);
        try {
            const data = await getStationOverviewData(resolvedSpecificStationId, user.specialty_id); // Use resolvedSpecificStationId
            setModuleData(data.module); // Will be null if no module at station
            setTasks(data.tasks || []); // Ensure tasks is an array
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
        localStorage.setItem(SELECTED_STATION_CONTEXT_KEY, specificStationId);
        setResolvedSpecificStationId(specificStationId); // Update resolved ID
        setShowSpecificStationModal(false);
        // fetchStationData will be triggered by the useEffect watching resolvedSpecificStationId
    };

    // --- Task Action Handlers ---

    const handleStartTaskClick = (taskDefinitionId) => {
        setTaskActionError(null); // Clear previous errors
        startTaskApiCall(taskDefinitionId);
    };

    const startTaskApiCall = async (taskDefinitionId) => {
        // We are only working with the current module (if exists)
        if (!moduleData || !moduleData.plan_id || !user || !user.id || !resolvedSpecificStationId) {
            console.error("Missing data needed to start task:", { moduleData, user, resolvedSpecificStationId });
            setTaskActionError({ taskId: taskDefinitionId, message: "Error: Faltan datos para iniciar la tarea (plan_id, usuario, estación)." });
            return;
        }

        setTaskActionLoading(taskDefinitionId);
        setTaskActionError(null);

        try {
            await startTask(
                moduleData.plan_id, // Use plan_id from current module
                taskDefinitionId,
                user.id, // worker_id
                resolvedSpecificStationId // stationStart
            );
            // Success! Refresh data to show updated task status
            fetchStationData(); // Re-fetch all station data
        } catch (error) {
            console.error("Error starting task:", error);
            setTaskActionError({ taskId: taskDefinitionId, message: error.message || 'Error al iniciar la tarea.' });
        } finally {
            setTaskActionLoading(null);
        }
    };

    const handlePauseTaskClick = async (taskDefinitionId) => {
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

    const handleResumeTaskClick = async (taskDefinitionId) => {
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
                taskDefinitionId
            );
            fetchStationData(); // Refresh data to show updated task status
        } catch (error) {
            console.error("Error resuming task:", error);
            setTaskActionError({ taskId: taskDefinitionId, message: error.message || 'Error al reanudar la tarea.' });
        } finally {
            setTaskActionLoading(null);
        }
    };

    const handleCompleteTaskClick = async (taskDefinitionId) => {
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
                                    const isLoading = taskActionLoading === task.task_definition_id;
                                    const error = taskActionError?.taskId === task.task_definition_id ? taskActionError.message : null;

                                    return (
                                        <li key={task.task_definition_id} style={taskListItemStyle}>
                                            <div style={taskInfoStyle}>
                                                <h4>{task.task_name}</h4>
                                                <p>{task.task_description}</p>
                                                <p><strong>Estado:</strong> {task.task_status}</p>
                                            </div>
                                            <div style={taskActionsStyle}>
                                                {task.task_status === 'Not Started' && (
                                                    <button
                                                        onClick={() => handleStartTaskClick(task.task_definition_id)}
                                                        disabled={isLoading}
                                                        style={buttonStyle}
                                                    >
                                                        {isLoading ? 'Iniciando...' : 'Iniciar'}
                                                    </button>
                                                )}
                                                {task.task_status === 'In Progress' && (
                                                    <>
                                                        <button
                                                            onClick={() => handlePauseTaskClick(task.task_definition_id)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#ffc107', marginBottom: '5px'}}
                                                        >
                                                            {isLoading ? 'Pausando...' : 'Pausar'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCompleteTaskClick(task.task_definition_id)}
                                                            disabled={isLoading}
                                                            style={{...buttonStyle, backgroundColor: '#28a745'}}
                                                        >
                                                            {isLoading ? 'Completando...' : 'Completar'}
                                                        </button>
                                                    </>
                                                )}
                                                {task.task_status === 'Paused' && (
                                                    <button
                                                        onClick={() => handleResumeTaskClick(task.task_definition_id)}
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
