import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import { 
    // startTask, pauseTask, resumeTask, completeTask, // Task operations are currently disabled
    getInfoForNextModulePanels, 
    getCurrentStationPanels,
    getTasksForPanel
} from '../services/adminService';

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
                getInfoForNextModulePanels()
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
                getCurrentStationPanels(resolvedSpecificStationId)
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
        getTasksForPanel(selectedPanelIdentifier.plan_id, selectedPanelIdentifier.panel_definition_id, resolvedSpecificStationId, workerSpecialtyId)
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

    const handleStartTaskClick = (taskDefinitionId) => {
        console.warn("Start Task functionality is currently disabled due to backend changes.");
        // Placeholder for future implementation
    };

    const handlePauseTaskClick = async (taskDefinitionId) => {
        console.warn("Pause Task functionality is currently disabled due to backend changes.");
        // Placeholder for future implementation
    };

    const handleResumeTaskClick = async (taskDefinitionId) => {
        console.warn("Resume Task functionality is currently disabled due to backend changes.");
        // Placeholder for future implementation
    };

    const handleCompleteTaskClick = async (taskDefinitionId) => {
        console.warn("Complete Task functionality is currently disabled due to backend changes.");
        // Placeholder for future implementation
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
                                                        <button style={{...buttonStyle, opacity: 0.5, marginBottom: '5px'}} disabled>Iniciar</button>
                                                        <button style={{...buttonStyle, opacity: 0.5, marginBottom: '5px'}} disabled>Pausar</button>
                                                        <button style={{...buttonStyle, opacity: 0.5}} disabled>Completar</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {!isLoadingPanelTasks && !panelTasksError && panelTasks.length === 0 && (
                                        <p>No hay tareas definidas o encontradas para este panel.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {!selectedPanelIdentifier && <p style={{ marginTop: '20px', fontStyle: 'italic' }}>La funcionalidad de visualización de tareas individuales está actualmente deshabilitada hasta que se seleccione un panel.</p>}
                </div>
            )}
            {!resolvedSpecificStationId && !showSpecificStationModal && <p>Configurando estación...</p>}
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
