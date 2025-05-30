import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import * as adminService from '../services/adminService';

const SELECTED_STATION_CONTEXT_KEY = 'selectedStationContext';
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; // Key for localStorage, used by SpecificStationSelectorModal
const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL'; // From StationContextSelector/StationManager

const ProductionManager = ({ user, allStations, isLoadingAllStations, allStationsError }) => {
    const [showSpecificStationModal, setShowSpecificStationModal] = useState(false);
    const [userSelectedStationContext, setUserSelectedStationContext] = useState(null);
    const [resolvedSpecificStationId, setResolvedSpecificStationId] = useState(null);

    // Panel Production Info State
    const [panelProductionInfo, setPanelProductionInfo] = useState(null);
    const [isLoadingPanelInfo, setIsLoadingPanelInfo] = useState(false);
    const [panelInfoError, setPanelInfoError] = useState('');

    // Selected Panel and its Tasks State
    const [selectedPanelIdentifier, setSelectedPanelIdentifier] = useState(null); // { plan_id, panel_definition_id, panel_name, module_name }
    const [panelTasks, setPanelTasks] = useState([]);
    const [isLoadingPanelTasks, setIsLoadingPanelTasks] = useState(false);
    const [panelTasksError, setPanelTasksError] = useState('');
    const [taskActionMessage, setTaskActionMessage] = useState({ type: '', content: '' }); // type: 'success' or 'error'


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

        if (storedContext === PANEL_LINE_GENERAL_VALUE) {
            // If the general panel line is selected, we need a specific station from the modal
            const storedSpecificId = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
            // Check if the stored specific ID is actually a valid 'W' station
            const isValidSpecificId = allStations.some(s => s.station_id === storedSpecificId && s.line_type === 'W');

            if (storedSpecificId && isValidSpecificId) {
                setResolvedSpecificStationId(storedSpecificId);
                setShowSpecificStationModal(false);
            } else {
                setResolvedSpecificStationId(null); // Clear resolved ID until a specific one is chosen
                setShowSpecificStationModal(true); // Show the modal to select a specific W station
            }
        } else {
            // If it's not the general panel line, it's assumed to be a specific station ID directly
            setResolvedSpecificStationId(storedContext);
            setShowSpecificStationModal(false);
        }
    }, [user, allStations, isLoadingAllStations]);

    // Effect to fetch panel production information
    useEffect(() => {
        if (!resolvedSpecificStationId || !allStations || allStations.length === 0) {
            setPanelProductionInfo(null);
            setPanelInfoError('');
            setSelectedPanelIdentifier(null); // Clear selected panel if station changes
            setPanelTasks([]);
            return;
        }

        const currentStation = allStations.find(s => s.station_id === resolvedSpecificStationId);

        if (currentStation && currentStation.line_type === 'W') {
            setIsLoadingPanelInfo(true);
            setPanelInfoError('');
            setPanelProductionInfo(null);
            setSelectedPanelIdentifier(null); // Clear selected panel when station info reloads
            setPanelTasks([]);


            if (currentStation.station_id === 'W1') {
                adminService.getInfoForNextModulePanels()
                    .then(data => {
                        // data might be { message: "..." } if no module is ready, or the full object
                        if (data && data.plan_id) {
                            setPanelProductionInfo({ type: 'nextModule', data });
                        } else {
                            setPanelProductionInfo({ type: 'nextModule', data: null, message: data.message || "No hay módulos listos para iniciar producción de paneles." });
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching next module panel info:", err);
                        setPanelInfoError(`Error obteniendo información de paneles para el siguiente módulo: ${err.message}`);
                    })
                    .finally(() => setIsLoadingPanelInfo(false));
            } else { // W2, W3, W4, W5
                adminService.getCurrentStationPanels(resolvedSpecificStationId)
                    .then(data => {
                        setPanelProductionInfo({ type: 'currentStation', data });
                    })
                    .catch(err => {
                        console.error(`Error fetching current panels for station ${resolvedSpecificStationId}:`, err);
                        setPanelInfoError(`Error obteniendo paneles para la estación ${resolvedSpecificStationId}: ${err.message}`);
                    })
                    .finally(() => setIsLoadingPanelInfo(false));
            }
        } else {
            setPanelProductionInfo(null); // Clear if not a W station or station not found
            setPanelInfoError('');
            setSelectedPanelIdentifier(null);
            setPanelTasks([]);
        }
    }, [resolvedSpecificStationId, allStations, user]);

    // Effect to fetch tasks for the selected panel
    useEffect(() => {
        if (!selectedPanelIdentifier || !selectedPanelIdentifier.plan_id || !selectedPanelIdentifier.panel_definition_id) {
            setPanelTasks([]);
            setPanelTasksError('');
            return;
        }

        // Ensure user object and specialty_id are accessed safely for the API call
        const workerSpecialtyId = user && user.specialty_id !== undefined ? user.specialty_id : null;

        setIsLoadingPanelTasks(true);
        setPanelTasksError('');
        adminService.getTasksForPanel(selectedPanelIdentifier.plan_id, selectedPanelIdentifier.panel_definition_id, resolvedSpecificStationId, workerSpecialtyId)
            .then(tasksData => {
                // Sort tasks: 1. In Progress, 2. Paused, 3. Not Started,
                // 4. Completed (not at current station), 5. Completed (at current station)
                const getTaskSortScore = (task, currentStationId) => {
                    if (task.status === 'In Progress') return 1;
                    if (task.status === 'Paused') return 2;
                    if (task.status === 'Not Started') return 3;
                    if (task.status === 'Completed') {
                        return task.station_finish === currentStationId ? 5 : 4;
                    }
                    return 6; // Should not happen
                };

                const sortedTasks = tasksData.sort((a, b) => {
                    const scoreA = getTaskSortScore(a, resolvedSpecificStationId);
                    const scoreB = getTaskSortScore(b, resolvedSpecificStationId);
                    if (scoreA !== scoreB) {
                        return scoreA - scoreB;
                    }
                    return a.name.localeCompare(b.name); // Secondary sort by name
                });
                setPanelTasks(sortedTasks);
            })
            .catch(err => {
                console.error("Error fetching panel tasks:", err);
                setPanelTasksError(`Error obteniendo tareas del panel: ${err.message}`);
                setPanelTasks([]);
            })
            .finally(() => setIsLoadingPanelTasks(false));

    }, [selectedPanelIdentifier, resolvedSpecificStationId, user]);

    const handlePanelSelect = (panelData) => {
        setSelectedPanelIdentifier(panelData);
    };

    const handleSaveSpecificStation = (specificStationId) => {
        localStorage.setItem(SELECTED_SPECIFIC_STATION_ID_KEY, specificStationId);
        setResolvedSpecificStationId(specificStationId); // Update resolved ID
        setShowSpecificStationModal(false);
    };

    // --- Task Action Handlers ---
    // These handlers will no longer have moduleData or tasks to operate on directly
    // as the station context fetching logic is removed.
    // They are kept as placeholders but will likely need significant refactoring
    // if task operations are to be re-implemented with a different data flow.

    const clearTaskActionMessage = () => {
        setTimeout(() => setTaskActionMessage({ type: '', content: '' }), 3000);
    };
    
    const refreshTasks = () => {
        if (selectedPanelIdentifier && resolvedSpecificStationId && user) {
            // Use the imported adminService directly
            adminService.getTasksForPanel(selectedPanelIdentifier.plan_id, selectedPanelIdentifier.panel_definition_id, resolvedSpecificStationId, user.specialty_id)
                .then(tasksData => {
                     const getTaskSortScore = (task, currentStationId) => {
                        if (task.status === 'In Progress') return 1;
                        if (task.status === 'Paused') return 2;
                        if (task.status === 'Not Started') return 3;
                        if (task.status === 'Completed') {
                            return task.station_finish === currentStationId ? 5 : 4;
                        }
                        return 6; 
                    };
                    const sortedTasks = tasksData.sort((a, b) => {
                        const scoreA = getTaskSortScore(a, resolvedSpecificStationId);
                        const scoreB = getTaskSortScore(b, resolvedSpecificStationId);
                        if (scoreA !== scoreB) return scoreA - scoreB;
                        return a.name.localeCompare(b.name);
                    });
                    setPanelTasks(sortedTasks);
                })
                .catch(err => {
                    console.error("Error refreshing panel tasks:", err);
                    setTaskActionMessage({ type: 'error', content: `Error actualizando tareas: ${err.message}` });
                    clearTaskActionMessage();
                });
        }
    };

    const handleStartTaskClick = async (task) => {
        if (!user || !user.worker_id) {
            setTaskActionMessage({ type: 'error', content: 'Usuario no identificado. No se puede iniciar la tarea.' });
            clearTaskActionMessage();
            return;
        }
        if (!selectedPanelIdentifier || !resolvedSpecificStationId) {
            setTaskActionMessage({ type: 'error', content: 'Panel o estación no seleccionados. No se puede iniciar la tarea.' });
            clearTaskActionMessage();
            return;
        }

        setTaskActionMessage({ type: '', content: '' }); // Clear previous messages

        try {
            let response;
            if (task.status === 'Not Started') {
                response = await adminService.startPanelTask({
                    plan_id: selectedPanelIdentifier.plan_id,
                    panel_definition_id: selectedPanelIdentifier.panel_definition_id,
                    task_definition_id: task.task_definition_id,
                    worker_id: user.worker_id,
                    station_id: resolvedSpecificStationId
                });
                setTaskActionMessage({ type: 'success', content: `Tarea "${task.name}" iniciada.` });
            } else if (task.status === 'Paused') {
                if (!task.panel_task_log_id) {
                     setTaskActionMessage({ type: 'error', content: 'Error: Falta ID de registro de tarea para reanudar.' });
                     clearTaskActionMessage();
                     return;
                }
                response = await adminService.resumePanelTask(task.panel_task_log_id, { worker_id: user.worker_id });
                setTaskActionMessage({ type: 'success', content: `Tarea "${task.name}" reanudada.` });
            } else {
                setTaskActionMessage({ type: 'error', content: `La tarea "${task.name}" no está en un estado válido para iniciar/reanudar.` });
                clearTaskActionMessage();
                return;
            }
            console.log("Start/Resume task response:", response);
            refreshTasks();
        } catch (error) {
            console.error("Error starting/resuming task:", error);
            setTaskActionMessage({ type: 'error', content: `Error iniciando/reanudando tarea "${task.name}": ${error.message}` });
        }
        clearTaskActionMessage();
    };

    const handlePauseTaskClick = async (task) => {
        if (!user || !user.worker_id) {
            setTaskActionMessage({ type: 'error', content: 'Usuario no identificado.' });
            clearTaskActionMessage();
            return;
        }
        if (task.status !== 'In Progress' || !task.panel_task_log_id) {
            setTaskActionMessage({ type: 'error', content: 'La tarea no está en progreso o falta ID de registro.' });
            clearTaskActionMessage();
            return;
        }
        
        const reason = window.prompt("Motivo de la pausa (opcional):");
        // If user clicks cancel, prompt returns null. If OK with empty, it's "".
        if (reason === null) { // User cancelled
            return;
        }

        setTaskActionMessage({ type: '', content: '' });
        try {
            const response = await adminService.pausePanelTask(task.panel_task_log_id, { worker_id: user.worker_id, reason: reason || '' });
            console.log("Pause task response:", response);
            setTaskActionMessage({ type: 'success', content: `Tarea "${task.name}" pausada.` });
            refreshTasks();
        } catch (error) {
            console.error("Error pausing task:", error);
            setTaskActionMessage({ type: 'error', content: `Error pausando tarea "${task.name}": ${error.message}` });
        }
        clearTaskActionMessage();
    };
    
    const handleCompleteTaskClick = async (task) => {
        if (!user || !user.worker_id) {
            setTaskActionMessage({ type: 'error', content: 'Usuario no identificado.' });
            clearTaskActionMessage();
            return;
        }
         if (task.status !== 'In Progress' || !task.panel_task_log_id) {
            setTaskActionMessage({ type: 'error', content: 'La tarea no está en progreso o falta ID de registro.' });
            clearTaskActionMessage();
            return;
        }
        if (!resolvedSpecificStationId) {
            setTaskActionMessage({ type: 'error', content: 'Estación no resuelta. No se puede completar la tarea.' });
            clearTaskActionMessage();
            return;
        }

        const notes = window.prompt("Notas para completar la tarea (opcional):");
        if (notes === null) { // User cancelled
            return;
        }
        
        setTaskActionMessage({ type: '', content: '' });
        try {
            const response = await adminService.finishPanelTask(task.panel_task_log_id, {
                worker_id: user.worker_id,
                station_id: resolvedSpecificStationId,
                notes: notes || ''
            });
            console.log("Complete task response:", response);
            setTaskActionMessage({ type: 'success', content: `Tarea "${task.name}" completada.` });
            refreshTasks();
            // If response.panel_production_plan_update exists, may need to update panel list or selection
            if (response && response.panel_production_plan_update) {
                console.log("Panel production plan updated:", response.panel_production_plan_update);
                // Potentially refresh the list of panels for the station if it's not W1
                // Or clear selection if the panel moved from the current station
                // For now, refreshTasks should handle tasks disappearing if they are no longer relevant
            }
        } catch (error) {
            console.error("Error completing task:", error);
            setTaskActionMessage({ type: 'error', content: `Error completando tarea "${task.name}": ${error.message}` });
        }
        clearTaskActionMessage();
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

            {!showSpecificStationModal && resolvedSpecificStationId && (
                <div style={{ marginTop: '20px' }}>
                    {isLoadingPanelInfo && <p>Cargando información de producción de paneles...</p>}
                    {panelInfoError && <p style={{ color: 'red' }}>{panelInfoError}</p>}
                    
                    {panelProductionInfo && !isLoadingPanelInfo && !panelInfoError && (
                        <div style={panelProductionSectionStyle}>
                            <h3>Información de Paneles</h3>
                            {!selectedPanelIdentifier ? (
                                <>
                                    {/* Panel Selection for W1 */}
                                    {panelProductionInfo.type === 'nextModule' && panelProductionInfo.data && (
                                        <>
                                            <p><strong>Módulo:</strong> {panelProductionInfo.data.module_name} (Plan ID: {panelProductionInfo.data.plan_id})</p>
                                            {panelProductionInfo.data.panels_to_produce && panelProductionInfo.data.panels_to_produce.length > 0 ? (
                                                <>
                                                    <p><strong>Seleccione un panel para ver sus tareas:</strong></p>
                                                    <ul style={listStyle}>
                                                        {panelProductionInfo.data.panels_to_produce.map(panel => (
                                                            <li key={panel.panel_definition_id} style={{...listItemStyle, cursor: 'pointer'}} onClick={() => handlePanelSelect({
                                                                plan_id: panelProductionInfo.data.plan_id,
                                                                panel_definition_id: panel.panel_definition_id,
                                                                panel_name: `${panel.panel_code} (${panel.panel_group})`,
                                                                module_name: panelProductionInfo.data.module_name
                                                            })}>
                                                                {panel.panel_code} ({panel.panel_group})
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </>
                                            ) : (
                                                <p>No hay paneles específicos listados para iniciar producción para este módulo.</p>
                                            )}
                                        </>
                                    )}
                                    {panelProductionInfo.type === 'nextModule' && !panelProductionInfo.data && panelProductionInfo.message && (
                                        <p>{panelProductionInfo.message}</p>
                                    )}

                                    {/* Panel Selection for W2-W5 */}
                                    {panelProductionInfo.type === 'currentStation' && panelProductionInfo.data && panelProductionInfo.data.length > 0 && (
                                        <>
                                            <p><strong>Paneles en esta Estación ({resolvedSpecificStationId}). Seleccione uno para ver sus tareas:</strong></p>
                                            <ul style={listStyle}>
                                                {panelProductionInfo.data.map(panel => (
                                                    <li key={panel.panel_production_plan_id} style={{...listItemStyle, cursor: 'pointer'}} onClick={() => handlePanelSelect({
                                                        plan_id: panel.plan_id,
                                                        panel_definition_id: panel.panel_definition_id,
                                                        panel_name: panel.panel_name,
                                                        module_name: panel.module_name
                                                    })}>
                                                        {panel.panel_name} (Módulo: {panel.module_name})
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                    {panelProductionInfo.type === 'currentStation' && (!panelProductionInfo.data || panelProductionInfo.data.length === 0) && (
                                        <p>No hay paneles "En Progreso" actualmente en esta estación.</p>
                                    )}
                                </>
                            ) : (
                                // Display tasks for selectedPanelIdentifier
                                <div style={{ marginTop: '20px' }}>
                                    <button onClick={() => setSelectedPanelIdentifier(null)} style={{ ...buttonStyle, backgroundColor: '#6c757d', marginBottom: '10px' }}>Volver a selección de panel</button>
                                    <h4>Tareas para Panel: {selectedPanelIdentifier.panel_name}</h4>
                                    <p>(Módulo: {selectedPanelIdentifier.module_name}, Plan ID: {selectedPanelIdentifier.plan_id}, Panel Def ID: {selectedPanelIdentifier.panel_definition_id})</p>
                                    {isLoadingPanelTasks && <p>Cargando tareas del panel...</p>}
                                    {panelTasksError && <p style={{ color: 'red' }}>{panelTasksError}</p>}
                                    {!isLoadingPanelTasks && !panelTasksError && panelTasks.length > 0 && (
                                        <ul style={listStyle}>
                                            {panelTasks.map(task => (
                                                <li key={task.task_definition_id} style={taskListItemStyle}>
                                                    <div style={taskInfoStyle}>
                                                        <strong>{task.name}</strong> (ID: {task.task_definition_id})<br />
                                                        Estado: {task.status} <br/>
                                                        {task.description && <small>Desc: {task.description}<br/></small>}
                                                        {task.station_finish && <small>Finalizada en Estación: {task.station_finish}<br/></small>}
                                                        {task.completed_at && <small>Completada: {new Date(task.completed_at).toLocaleString()}<br/></small>}
                                                    </div>
                                                    {/* Placeholder for task actions, currently disabled */}
                                                    <div style={taskActionsStyle}>
                                                        {(task.status === 'Not Started' || task.status === 'Paused') && (
                                                            <button 
                                                                style={buttonStyle}
                                                                onClick={() => handleStartTaskClick(task)}
                                                            >
                                                                {task.status === 'Not Started' ? 'Iniciar' : 'Reanudar'}
                                                            </button>
                                                        )}
                                                        {task.status === 'In Progress' && (
                                                            <>
                                                                <button 
                                                                    style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black', marginBottom: '5px'}}
                                                                    onClick={() => handlePauseTaskClick(task)}
                                                                >
                                                                    Pausar
                                                                </button>
                                                                <button 
                                                                    style={{...buttonStyle, backgroundColor: '#28a745'}}
                                                                    onClick={() => handleCompleteTaskClick(task)}
                                                                >
                                                                    Completar
                                                                </button>
                                                            </>
                                                        )}
                                                        {task.status === 'Completed' && (
                                                            <span style={{color: 'green', fontSize: '0.9em'}}>Completada</span>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {!isLoadingPanelTasks && !panelTasksError && panelTasks.length === 0 && (
                                        <p>No hay tareas definidas o encontradas para este panel.</p>
                                    )}
                                    {taskActionMessage.content && (
                                        <p style={taskActionMessage.type === 'error' ? errorStyle : successStyle}>
                                            {taskActionMessage.content}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Message when no panel is selected, kept as is */}
                    {!selectedPanelIdentifier && resolvedSpecificStationId && panelProductionInfo && !isLoadingPanelInfo && (
                         <p style={{ marginTop: '20px', fontStyle: 'italic' }}>
                            Seleccione un panel de la lista de arriba para ver y gestionar sus tareas.
                         </p>
                    )}
                </div>
            )}
            {!resolvedSpecificStationId && !showSpecificStationModal && !isLoadingAllStations && <p>Estación no configurada o inválida. Por favor, configure una estación válida desde el selector de contexto.</p>}
            {showSpecificStationModal && (
                <p>Por favor, seleccione su estación específica para continuar.</p>
            )}
        </div>
    );
};

// Basic styles (consider moving to a separate CSS file or styled-components)
const panelProductionSectionStyle = {
    marginTop: '20px',
    padding: '15px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    backgroundColor: '#f9f9f9',
    textAlign: 'left',
};

const listStyle = {
    listStyleType: 'none',
    paddingLeft: 0,
};

const listItemStyle = {
    padding: '8px',
    borderBottom: '1px solid #eee',
};

listItemStyle[':last-child'] = {
    borderBottom: 'none',
};

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
    transition: 'opacity 0.2s ease-in-out, background-color 0.2s ease-in-out',
    minWidth: '100px', 
    textAlign: 'center',
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
    width: '100%', 
    textAlign: 'right',
    paddingTop: '5px',
};

const successStyle = {
    color: 'green',
    fontSize: '0.9em',
    marginTop: '5px',
    width: '100%',
    textAlign: 'right',
    paddingTop: '5px',
};

export default ProductionManager;
