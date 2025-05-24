import React, { useState, useEffect, useMemo } from 'react';
// import { getStations } from '../../services/adminService'; // Now receives stations as prop
import * as adminService from '../../services/adminService'; 

const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; 

function StationContextSelector({ allStations, isLoadingAllStations }) { 
    const [currentStationId, setCurrentStationId] = useState(localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY) || null);
    const [selectedModule, setSelectedModule] = useState(null); // Stores the single module object
    const [selectedPanelId, setSelectedPanelId] = useState(null); // panel_definition_id of the selected panel
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [contextError, setContextError] = useState('');
    const [isSubmittingTaskAction, setIsSubmittingTaskAction] = useState(false);
    const [taskActionError, setTaskActionError] = useState('');

    // Effect to re-read from localStorage if the key changes externally
    // This is a more robust way to ensure currentStationId is up-to-date if other parts of the app can change it.
    useEffect(() => {
        const handleStorageChange = () => {
            const storedStationId = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
            if (storedStationId !== currentStationId) { // Only update if it actually changed
                setCurrentStationId(storedStationId || null);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        // Also check on mount
        const initialStoredStationId = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
        if (initialStoredStationId && initialStoredStationId !== currentStationId) {
             setCurrentStationId(initialStoredStationId);
        } else if (!initialStoredStationId && currentStationId) { // Cleared in another tab
            setCurrentStationId(null);
        }

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [currentStationId]);

    const currentStationName = useMemo(() => {
        if (!currentStationId) return '';
        if (isLoadingAllStations || !allStations || allStations.length === 0) return 'Cargando nombre de estación...';
        const station = allStations.find(s => s.station_id.toString() === currentStationId);
        return station ? station.name : 'ID de estación desconocido';
    }, [currentStationId, allStations, isLoadingAllStations]);

    const selectNextNotStartedPanelInModule = (moduleToProcess) => {
        if (moduleToProcess && moduleToProcess.panels && moduleToProcess.panels.length > 0) {
            // Panels should be sorted by their intended work sequence if possible.
            // Assuming panels are already sorted or using panel_code as a proxy.
            const nextPanel = moduleToProcess.panels.find(p => p.status === 'not_started');
            if (nextPanel) {
                setSelectedPanelId(nextPanel.panel_id); // panel_id is panel_definition_id
            } else {
                setSelectedPanelId(null); // Or select the first panel again if all are started/paused
            }
        } else {
            setSelectedPanelId(null);
        }
    };
    
    const fetchStationContext = async (stationId) => {
        if (!stationId) {
            setSelectedModule(null);
            setSelectedPanelId(null);
            setIsLoadingContext(false);
            return;
        }

        setIsLoadingContext(true);
        setContextError('');
        try {
            const data = await adminService.getStationContext(stationId); // Calls new backend endpoint
            setSelectedModule(data.module || null);
            
            if (data.module && data.module.panels) {
                 // The backend now returns panels with their statuses directly within the module object.
                 // setSelectedModule will handle this.
            }

            if (data.module) {
                // If it's W1, automatically select the next not-started panel.
                if (stationId === 'W1') { // TODO: Make 'W1' check more robust if station roles are dynamic
                    selectNextNotStartedPanelInModule(data.module);
                } else if (selectedPanelId) { // For other stations, try to keep selection if valid
                    const currentModulePanels = data.module.panels || [];
                    if (!currentModulePanels.find(p => p.panel_id === selectedPanelId)) {
                        setSelectedPanelId(null); // Clear if previously selected panel is no longer relevant
                    }
                } else {
                     setSelectedPanelId(null); // Default to no panel selected if not W1 and no prior selection
                }
            } else {
                setSelectedPanelId(null); // No module, so no panel
            }

        } catch (err) {
            console.error("Error fetching station context for station", stationId, ":", err);
            setContextError(`Error al cargar contexto de estación: ${err.message || 'Error desconocido'}`);
            setSelectedModule(null);
            setSelectedPanelId(null);
        } finally {
            setIsLoadingContext(false);
        }
    };
    
    useEffect(() => {
        if (currentStationId) {
            fetchStationContext(currentStationId);
        } else {
            setSelectedModule(null);
            setSelectedPanelId(null);
        }
    }, [currentStationId]);

    // Task Action Handlers
    // Note: The 'panel' object passed to this function must include 'log_id' if the task status is 'in_progress' or 'paused'.
    // This 'log_id' is crucial for calling updatePanelTaskStatus.
    // The 'taskDefinitionIdForPanel' is a placeholder and needs to be correctly determined for 'startTask'.
    const handleTaskAction = async (actionType, panel) => {
        const workerId = 1; // Placeholder for actual worker ID
        const taskDefinitionIdForPanel = 1; // Placeholder: This needs to be dynamic based on panel & station for 'start' action.

        if (!selectedModule || !selectedModule.plan_id) {
            setTaskActionError("No production plan item selected to perform task on.");
            return;
        }
        if (!panel || !panel.panel_definition_id) {
            setTaskActionError("Panel information is missing.");
            return;
        }

        setIsSubmittingTaskAction(true);
        setTaskActionError('');
        
        try {
            let response;
            const planId = selectedModule.plan_id;
            const panelDefinitionId = panel.panel_definition_id;

            switch (actionType) {
                case 'start': // For 'not_started' panels
                    response = await adminService.startTask(
                        planId,
                        taskDefinitionIdForPanel, // This is a placeholder.
                        workerId,
                        currentStationId,
                        panelDefinitionId
                    );
                    break;
                case 'pause': // For 'in_progress' panels
                    if (!panel.log_id) { // panel.log_id must be available from backend for existing tasks
                        throw new Error("Task log ID is missing for pausing. Backend might need to provide log_id for panels.");
                    }
                    response = await adminService.updatePanelTaskStatus(
                        panel.log_id,
                        'Paused'
                    );
                    break;
                case 'resume': // For 'paused' panels
                     if (!panel.log_id) {
                        throw new Error("Task log ID is missing for resuming. Backend might need to provide log_id for panels.");
                    }
                    response = await adminService.updatePanelTaskStatus(
                        panel.log_id,
                        'In Progress'
                    );
                    break;
                case 'finish': // For 'in_progress' or 'paused' panels
                    if (!panel.log_id) {
                        throw new Error("Task log ID is missing for finishing. Backend might need to provide log_id for panels.");
                    }
                    response = await adminService.updatePanelTaskStatus(
                        panel.log_id,
                        'Completed',
                        currentStationId // stationFinish
                    );
                    break;
                default:
                    throw new Error(`Invalid action type: ${actionType}`);
            }
            console.log(`Panel action ${actionType} API Response:`, response);

            await fetchStationContext(currentStationId); 

            if (actionType === 'finish') {
                const updatedModule = selectedModule; // Re-access after fetch, assuming it's updated.
                if (updatedModule && updatedModule.panels && updatedModule.panels.every(p => p.status === 'completed')) {
                    console.log(`All panels in module (plan_id: ${updatedModule.plan_id}) are completed. Updating module status to 'Magazine'.`);
                    await adminService.updatePlanStatus(updatedModule.plan_id, 'Magazine');
                    await fetchStationContext(currentStationId);
                } else if (updatedModule && currentStationId === 'W1') { 
                    selectNextNotStartedPanelInModule(updatedModule);
                }
            } else if (actionType === 'start' && currentStationId === 'W1' && selectedModule) {
                selectNextNotStartedPanelInModule(selectedModule);
            }

        } catch (err) {
            const idForErrorMessage = selectedModule.plan_id;
            const panelIdForError = panel.panel_definition_id;
            console.error(`Error performing ${actionType} task for panel ${panelIdForError} in module (plan_id: ${idForErrorMessage}):`, err);
            setTaskActionError(`Error al ${actionType} tarea para panel ${panelIdForError} (Plan ID: ${idForErrorMessage}): ${err.message || 'Error desconocido'}`);
        } finally {
            setIsSubmittingTaskAction(false);
        }
    };
    
    // Removed triggerModuleStatusUpdate as its logic is now part of handleTaskAction or direct adminService calls.

    // Initial fetch handled by useEffect dependent on currentStationId

    if (isLoadingAllStations && !currentStationName && !currentStationId) return <p>Cargando configuración inicial...</p>;

    if (!currentStationId && !isLoadingAllStations) {
        return (
            <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
                <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Contexto de Estación</h2>
                <p style={{ color: 'orange', fontWeight: 'bold' }}>Estación no configurada.</p>
                <p>Por favor, configure la estación específica en la página de administración de estaciones o asegúrese de que se haya seleccionado una.</p>
            </div>
        );
    }
    
    // Still loading basic station info
    if (isLoadingAllStations || (currentStationId && !currentStationName)) {
         return <p>Cargando configuración de estación...</p>;
    }

    // selectedModule is now directly from state
    // const selectedModule = availableModules.find(m => m.module_id === selectedModuleId); // Old logic

    const buttonBaseStyle = {
        border: 'none',
        padding: '8px 12px', 
        borderRadius: '4px', 
        cursor: 'pointer',
        marginRight: '5px',
        opacity: isSubmittingTaskAction ? 0.6 : 1,
    };

    const startButtonStyle = { ...buttonBaseStyle, backgroundColor: '#28a745', color: 'white' }; // Green
    const pauseButtonStyle = { ...buttonBaseStyle, backgroundColor: '#ffc107', color: 'black' }; // Yellow
    const finishButtonStyle = { ...buttonBaseStyle, backgroundColor: '#007bff', color: 'white' }; // Blue
    const resumeButtonStyle = { ...buttonBaseStyle, backgroundColor: '#28a745', color: 'white' }; // Green (same as start)


    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Contexto de Estación de Trabajo</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h4>Estación Actual:</h4>
                <p><strong>{currentStationName} (ID: {currentStationId})</strong></p>
            </div>

            {taskActionError && <p style={{ color: 'red', fontWeight: 'bold', border: '1px solid red', padding: '10px', borderRadius: '4px' }}>Error en Tarea: {taskActionError}</p>}
            {isSubmittingTaskAction && <p style={{color: 'blue'}}>Procesando acción de tarea...</p>}
            
            {isLoadingContext && <p>Cargando contexto de estación...</p>}
            {contextError && <p style={{ color: 'red' }}>{contextError}</p>}

            {!isLoadingContext && !contextError && !selectedModule && currentStationId && (
                <p style={{ color: 'blue', fontStyle: 'italic' }}>No hay módulos activos o pendientes para esta estación en este momento.</p>
            )}

            {selectedModule && (
                <div style={{border: '1px solid #eee', padding: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9'}}>
                    <h4>Módulo Actual:</h4>
                    {/* Display module details from selectedModule state */}
                    <p><strong>Plan ID:</strong> {selectedModule.plan_id}</p>
                    <p><strong>Secuencia Planificada:</strong> {selectedModule.planned_sequence !== undefined ? selectedModule.planned_sequence : 'N/A'}</p>
                    <p><strong>Nombre del Proyecto:</strong> {selectedModule.project_name}</p>
                    <p><strong>Identificador de Casa:</strong> {selectedModule.house_identifier}</p>
                    <p><strong>Tipo de Casa:</strong> {selectedModule.house_type_name} (Módulos: {selectedModule.module_number}/{selectedModule.number_of_modules})</p>
                    <p><strong>Sub-Tipo:</strong> {selectedModule.sub_type_name || 'N/A'}</p>
                    <p><strong>Estado del Módulo:</strong> <span style={{fontWeight: 'bold'}}>{selectedModule.module_status}</span></p>
                    
                    <h5 style={{marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px'}}>Paneles del Módulo:</h5>
                    {selectedModule.panels && selectedModule.panels.length > 0 ? (
                        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                            {selectedModule.panels.map(panel => (
                                <li 
                                    key={panel.panel_id} // panel_id is panel_definition_id
                                    style={{ 
                                        padding: '12px', 
                                        border: `1px solid ${selectedPanelId === panel.panel_id ? '#007bff' : '#ddd'}`, 
                                        boxShadow: selectedPanelId === panel.panel_id ? '0 0 5px rgba(0,123,255,.5)' : 'none',
                                        marginBottom: '10px',
                                        borderRadius: '4px',
                                        backgroundColor: panel.status === 'completed' ? '#e9ecef' : (selectedPanelId === panel.panel_id ? '#e7f3ff' : 'white'),
                                        transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
                                    }}
                                >
                                    <div onClick={() => setSelectedPanelId(panel.panel_id)} style={{cursor: 'pointer', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee'}}>
                                        <p style={{margin: '0 0 5px 0'}}><strong>Código:</strong> {panel.panel_code} (ID PanelDef: {panel.panel_definition_id})</p>
                                        <p style={{margin: 0}}><strong>Grupo:</strong> {panel.panel_group}</p>
                                        <p style={{margin: 0}}><strong>Estado:</strong> <span style={{fontWeight: 'bold'}}>{panel.status}</span></p>
                                    </div>
                                    
                                    {/* Task Management Buttons */}
                                    {/* Ensure 'panel' object contains 'log_id' if status is 'in_progress' or 'paused' */}
                                    {selectedPanelId === panel.panel_id && ( // Show buttons only for selected panel
                                        <div style={{ marginTop: '10px'}}>
                                            {panel.status === 'not_started' && (
                                                <button 
                                                    onClick={() => handleTaskAction('start', panel)} 
                                                    disabled={isSubmittingTaskAction}
                                                    style={startButtonStyle}
                                                >
                                                    {isSubmittingTaskAction ? 'Iniciando...' : 'Iniciar Tarea'}
                                                </button>
                                            )}
                                            {panel.status === 'in_progress' && (
                                                <>
                                                    <button 
                                                        onClick={() => handleTaskAction('pause', panel)} 
                                                        disabled={isSubmittingTaskAction}
                                                        style={pauseButtonStyle}
                                                    >
                                                        {isSubmittingTaskAction ? 'Pausando...' : 'Pausar Tarea'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleTaskAction('finish', panel)} 
                                                        disabled={isSubmittingTaskAction}
                                                        style={finishButtonStyle}
                                                    >
                                                        {isSubmittingTaskAction ? 'Finalizando...' : 'Finalizar Tarea'}
                                                    </button>
                                                </>
                                            )}
                                            {panel.status === 'paused' && (
                                                <>
                                                    <button 
                                                        onClick={() => handleTaskAction('resume', panel)} 
                                                        disabled={isSubmittingTaskAction}
                                                        style={resumeButtonStyle}
                                                    >
                                                        {isSubmittingTaskAction ? 'Reanudando...' : 'Reanudar Tarea'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleTaskAction('finish', panel)} 
                                                        disabled={isSubmittingTaskAction}
                                                        style={{...finishButtonStyle, marginLeft: '5px'}}
                                                    >
                                                        {isSubmittingTaskAction ? 'Finalizando...' : 'Finalizar Tarea'}
                                                    </button>
                                                </>
                                            )}
                                            {panel.status === 'completed' && (
                                                <p style={{color: 'green', fontWeight: 'bold', margin: 0}}>Panel Completado ✔</p>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Este módulo no tiene paneles definidos o asignados para esta estación/subtipo.</p>
                    )}
                </div>
            )}
            
            <p style={{ marginTop: '30px', fontSize: '0.9em', color: '#555', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
                Esta vista muestra la estación y el módulo configurados actualmente. 
                El módulo se selecciona automáticamente basado en el estado de producción o la secuencia.
                Utilice los botones para gestionar el progreso de las tareas de cada panel.
                Si necesita cambiar la estación, hágalo desde la página de administración de estaciones.
            </p>
        </div>
    );
}

export default StationContextSelector;
