import React, { useState, useEffect, useMemo } from 'react';
// import { getStations } from '../../services/adminService'; // Now receives stations as prop
import * as adminService from '../../services/adminService'; 

const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; 

function StationContextSelector({ allStations, isLoadingAllStations }) { 
    const [currentStationId, setCurrentStationId] = useState(localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY) || null);
    // currentStationName will be derived using useMemo
    const [availableModules, setAvailableModules] = useState([]);
    const [selectedModuleId, setSelectedModuleId] = useState(null);
    const [selectedPanelId, setSelectedPanelId] = useState(null);
    const [isLoadingModules, setIsLoadingModules] = useState(false);
    const [moduleError, setModuleError] = useState('');
    const [isSubmittingTaskAction, setIsSubmittingTaskAction] = useState(false);
    const [taskActionError, setTaskActionError] = useState('');
    // const [error, setError] = useState(''); // General error, not currently used for much. ModuleError is specific.

    // Effect to re-read from localStorage if the key changes externally (e.g. user logs out & logs in, or admin changes config)
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

    const fetchAvailableModulesAndSetState = async (stationId) => {
        if (!stationId) {
            setAvailableModules([]);
            setSelectedModuleId(null);
            setSelectedPanelId(null);
            setIsLoadingModules(false);
            return;
        }

        setIsLoadingModules(true);
        setModuleError('');
        // We don't clear selectedPanelId here, as it might be useful to keep it if the module data refreshes
        // It will naturally be cleared if the selectedModuleId is no longer valid or its panels change.

        try {
            const data = await adminService.getAvailablePanelsForStation(stationId);
            const modules = data || [];
            setAvailableModules(modules);

            let bestModule = null;
            if (modules.length > 0) {
                const inProductionModule = modules.find(m => m.status === 'in_production');
                if (inProductionModule) {
                    bestModule = inProductionModule;
                } else {
                    const sortedNonCompletedModules = modules
                        .filter(m => m.status !== 'completed')
                        .sort((a, b) => a.sequence_number - b.sequence_number);
                    if (sortedNonCompletedModules.length > 0) {
                        bestModule = sortedNonCompletedModules[0];
                    }
                }
            }
            const newSelectedModuleId = bestModule ? bestModule.module_id : null;
            setSelectedModuleId(newSelectedModuleId);

            // If the previously selected panel is still part of the newly selected module, keep it.
            // Otherwise, clear it.
            if (newSelectedModuleId && selectedPanelId) {
                const currentModule = modules.find(m => m.module_id === newSelectedModuleId);
                if (!currentModule || !currentModule.panels.find(p => p.panel_id === selectedPanelId)) {
                    setSelectedPanelId(null); 
                }
            } else if (!newSelectedModuleId) {
                setSelectedPanelId(null); // No module selected, so no panel can be selected
            }

        } catch (err) {
            console.error("Error fetching available modules for station", stationId, ":", err);
            setModuleError(`Error al cargar módulos: ${err.message || 'Error desconocido'}`);
            setAvailableModules([]); // Clear modules on error
            setSelectedModuleId(null);
            setSelectedPanelId(null);
        } finally {
            setIsLoadingModules(false);
        }
    };
    
    useEffect(() => {
        fetchAvailableModulesAndSetState(currentStationId);
    }, [currentStationId]); // Re-fetch when currentStationId changes

    // Task Action Handlers
    const handleTaskAction = async (actionType, moduleId, panelId) => {
        setIsSubmittingTaskAction(true);
        setTaskActionError('');
        let actionSuccess = false;

        // Placeholder for actual service calls
        console.log(`${actionType} task for module ${moduleId}, panel ${panelId}, station ${currentStationId}`);
        
        try {
            // Simulate API call for panel action
            await new Promise(resolve => setTimeout(resolve, 1000)); 
            // Mock what the actual service call would do:
            // let panelActionResponse;
            // switch (actionType) {
            //     case 'start':
            //         panelActionResponse = await adminService.startPanel(currentStationId, moduleId, panelId);
            //         break;
            //     case 'pause':
            //         panelActionResponse = await adminService.pausePanel(currentStationId, moduleId, panelId);
            //         break;
            //     case 'finish':
            //         panelActionResponse = await adminService.finishPanel(currentStationId, moduleId, panelId);
            //         break;
            //     default:
            //         throw new Error(`Invalid action type: ${actionType}`);
            // }
            // console.log(`Panel action ${actionType} API Response:`, panelActionResponse);
            actionSuccess = true; // Assume panel action was successful

            // Refresh module data to get the latest statuses
            const updatedModulesAfterPanelAction = await fetchAvailableModulesAndSetState(currentStationId);

            if (actionSuccess && actionType === 'start' && currentStationId === 'W1') {
                handleStationW1Progression(updatedModulesAfterPanelAction || availableModules); 
            }

            if (actionSuccess && actionType === 'finish') {
                const finishedModule = (updatedModulesAfterPanelAction || availableModules).find(m => m.module_id === moduleId);
                if (finishedModule && finishedModule.panels.every(p => p.status === 'completed')) {
                    console.log(`All panels in module ${moduleId} are completed. Updating module status to 'Magazine'.`);
                    await triggerModuleStatusUpdate(moduleId, 'Magazine');
                    // After module status update, the available modules might change again (e.g., module disappears)
                    // So, fetch again to ensure UI is perfectly up-to-date.
                    await fetchAvailableModulesAndSetState(currentStationId);
                }
            }
            
            // Optional: Logic for updating module to 'Panels' status when first panel starts (already commented out in previous code)
            // This would typically be handled by the backend based on panel events.
            // If it must be frontend-driven:
            // if (actionSuccess && actionType === 'start') {
            //    const startedModule = (updatedModulesAfterPanelAction || availableModules).find(m => m.module_id === moduleId);
            //    if (startedModule && startedModule.status === 'pending_fabrication' && startedModule.panels.some(p => p.status === 'in_progress')) {
            //        console.log(`First panel started in module ${moduleId}. Updating module status to 'Panels'.`);
            //        await triggerModuleStatusUpdate(moduleId, 'Panels'); // Assuming 'Panels' is the status
            //        await fetchAvailableModulesAndSetState(currentStationId); // Refresh again
            //    }
            // }


        } catch (err) {
            console.error(`Error performing ${actionType} task for panel ${panelId} in module ${moduleId}:`, err);
            setTaskActionError(`Error al ${actionType} tarea: ${err.message || 'Error desconocido'}`);
            actionSuccess = false; // Ensure this is set on error
        } finally {
            setIsSubmittingTaskAction(false); // This should be the very last thing
        }
    };

    const triggerModuleStatusUpdate = async (moduleIdToUpdate, newStatus) => {
        // Nested setIsSubmittingTaskAction might be problematic if called from handleTaskAction which also uses it.
        // However, since this is awaited, it should be fine. For more complex scenarios, a separate loading state for module updates might be better.
        // For now, we'll reuse it but be mindful.
        setIsSubmittingTaskAction(true); 
        setTaskActionError(''); // Clear previous errors specific to panel actions
        console.log(`Attempting to update module ${moduleIdToUpdate} to status '${newStatus}'`);

        try {
            // Simulate API call for module status update
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
            // const updateResponse = await adminService.updateModuleStatus(moduleIdToUpdate, newStatus);
            // console.log(`Module status update API response for module ${moduleIdToUpdate}:`, updateResponse);
            console.log(`Module ${moduleIdToUpdate} successfully updated to '${newStatus}' (simulated).`);

            // No need to return modules from here, handleTaskAction will call fetchAvailableModulesAndSetState again if needed.
        } catch (err) {
            console.error(`Error updating module ${moduleIdToUpdate} status to '${newStatus}':`, err);
            // Set a more specific error or append to existing taskActionError
            setTaskActionError(`Error al actualizar estado del módulo a '${newStatus}': ${err.message || 'Error desconocido'}`);
            throw err; // Re-throw to allow calling function to know it failed if necessary
        } finally {
            // Since this is awaited in handleTaskAction, handleTaskAction's finally block will manage setIsSubmittingTaskAction(false)
            // If this function were called independently, it would need its own setIsSubmittingTaskAction(false).
            // For now, let the caller manage the overall submission state.
        }
    };

    const selectNextNotStartedPanelInModule = (moduleToUpdate) => {
        if (!moduleToUpdate || !moduleToUpdate.panels || moduleToUpdate.panels.length === 0) {
            setSelectedPanelId(null); // No panels or invalid module
            return false; // No panel selected
        }
        // Order panels by their original sequence if available, or assume array order is correct
        // For now, we assume panel_id or their order in array implies sequence.
        // If a specific `panel_sequence_number` existed, we'd sort by that.
        const notStartedPanels = moduleToUpdate.panels.filter(p => p.status === 'not_started');
        
        if (notStartedPanels.length > 0) {
            // Sort by panel_id as a proxy for sequence if no explicit sequence number
            // This assumes lower panel_ids are earlier in sequence. Adjust if needed.
            notStartedPanels.sort((a,b) => a.panel_id - b.panel_id); 
            setSelectedPanelId(notStartedPanels[0].panel_id);
            return true; // A panel was selected
        }
        // If no 'not_started' panels, but we want to ensure a panel is selected if module is active,
        // we could select the first panel regardless of status, or the first 'in_progress'.
        // For now, only 'not_started' triggers an auto-selection here.
        // setSelectedPanelId(null); // Clearing here might be too aggressive if a panel was already selected and is in_progress
        return false; // No 'not_started' panel selected
    };

    const handleStationW1Progression = (currentModulesData) => {
        if (currentStationId !== 'W1' || !currentModulesData) return;

        let currentModuleForProgression = currentModulesData.find(m => m.module_id === selectedModuleId);

        if (currentModuleForProgression) {
            // Attempt to find the next not_started panel in the current module
            const foundNextPanel = selectNextNotStartedPanelInModule(currentModuleForProgression);

            if (foundNextPanel) {
                // console.log(`W1 Progression: Next panel ${selectedPanelId} in module ${currentModuleForProgression.module_id} selected.`);
                return; // Panel progression within the current module is done
            }
            // If no 'not_started' panel was found in the current module, proceed to module progression
            // console.log(`W1 Progression: All panels in module ${currentModuleForProgression.module_id} seem started/completed. Looking for next module.`);
        } else {
            // console.log(`W1 Progression: No currently selected module, or module not found. Trying to find initial module for W1.`);
            // This case might happen if the auto-selected module by fetchAvailableModulesAndSetState was already completed or had no not_started panels.
        }
        
        // Module Progression Logic:
        // Find modules that are not the current one (if any) and not completed
        // Or, if no currentModuleForProgression, find the first available not-completed module.
        const potentialNextModules = currentModulesData
            .filter(m => m.status !== 'completed' && (currentModuleForProgression ? m.module_id !== currentModuleForProgression.module_id : true))
            .sort((a, b) => a.sequence_number - b.sequence_number);

        if (potentialNextModules.length > 0) {
            const nextModuleToProgressTo = potentialNextModules[0];
            // console.log(`W1 Progression: Moving to next module ${nextModuleToProgressTo.module_id}`);
            
            // Check if we are actually changing the module, or if the "best module" logic already picked this one
            if (selectedModuleId !== nextModuleToProgressTo.module_id) {
                 setSelectedModuleId(nextModuleToProgressTo.module_id);
            }
            // After selecting new module (or confirming current one), select its first 'not_started' panel
            selectNextNotStartedPanelInModule(nextModuleToProgressTo); 
        } else if (currentModuleForProgression && !currentModuleForProgression.panels.some(p => p.status === 'not_started')) {
            // console.log("W1 Progression: No more available modules to progress to, and current module has no 'not_started' panels.");
            // If current module is fully processed (no not_started panels) and no other modules to go to, clear panel selection
            setSelectedPanelId(null);
        } else if (!currentModuleForProgression && potentialNextModules.length === 0) {
            // console.log("W1 Progression: No modules available at all for W1 station.");
            setSelectedModuleId(null); // Ensure no module is selected
            setSelectedPanelId(null); // Ensure no panel is selected
        }
    };

    useEffect(() => {
        // Initial fetch when component mounts or currentStationId changes
        fetchAvailableModulesAndSetState(currentStationId).then(initialModules => {
            if (currentStationId === 'W1' && initialModules) {
                // After initial load for W1, apply progression logic to select first panel of first module.
                handleStationW1Progression(initialModules);
            }
        });
    }, [currentStationId]); // Re-fetch and apply W1 logic when currentStationId changes

    if (isLoadingAllStations && !currentStationName && !currentStationId) return <p>Cargando configuración inicial...</p>;
    // Removed general error display, moduleError is more specific. TaskActionError will be used for task ops.

    if (!currentStationId && !isLoadingAllStations) { // Show message if no station ID AND not in process of loading all stations list
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

    const selectedModule = availableModules.find(m => m.module_id === selectedModuleId);

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
            
            {isLoadingModules && <p>Cargando módulos disponibles para la estación...</p>}
            {moduleError && <p style={{ color: 'red' }}>{moduleError}</p>}

            {!isLoadingModules && !moduleError && !selectedModuleId && currentStationId && (
                <p style={{ color: 'blue', fontStyle: 'italic' }}>No hay módulos activos o pendientes para esta estación en este momento.</p>
            )}

            {selectedModule && (
                <div style={{border: '1px solid #eee', padding: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9'}}>
                    <h4>Módulo Seleccionado Automáticamente:</h4>
                    <p><strong>Nombre:</strong> {selectedModule.module_name} (ID: {selectedModule.module_id})</p>
                    <p><strong>Proyecto:</strong> {selectedModule.project_name}</p>
                    <p><strong>Casa:</strong> {selectedModule.house_identifier} - <strong>Módulo:</strong> {selectedModule.module_number}</p>
                    <p><strong>Estado del Módulo:</strong> <span style={{fontWeight: 'bold', color: selectedModule.status === 'in_production' ? 'green' : (selectedModule.status === 'completed' ? 'grey' : 'orange')}}>{selectedModule.status}</span></p>
                    
                    <h5 style={{marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px'}}>Paneles del Módulo:</h5>
                    {selectedModule.panels && selectedModule.panels.length > 0 ? (
                        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                            {selectedModule.panels.map(panel => (
                                <li 
                                    key={panel.panel_id} 
                                    style={{ 
                                        padding: '12px', 
                                        border: `1px solid ${selectedPanelId === panel.panel_id ? '#007bff' : '#ddd'}`, 
                                        boxShadow: selectedPanelId === panel.panel_id ? '0 0 5px rgba(0,123,255,.5)' : 'none',
                                        marginBottom: '10px',
                                        borderRadius: '4px',
                                        backgroundColor: panel.status === 'completed' ? '#e9ecef' : 'white', // Light grey for completed
                                        transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
                                    }}
                                >
                                    <div onClick={() => setSelectedPanelId(panel.panel_id)} style={{cursor: 'pointer', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee'}}>
                                        <p style={{margin: '0 0 5px 0'}}><strong>Código:</strong> {panel.panel_code} (ID: {panel.panel_id})</p>
                                        <p style={{margin: 0}}><strong>Estado:</strong> <span style={{fontWeight: 'bold'}}>{panel.status}</span></p>
                                    </div>
                                    
                                    {/* Task Management Buttons */}
                                    <div style={{ marginTop: '10px'}}>
                                        {panel.status === 'not_started' && (
                                            <button 
                                                onClick={() => handleTaskAction('start', selectedModule.module_id, panel.panel_id)} 
                                                disabled={isSubmittingTaskAction}
                                                style={startButtonStyle}
                                            >
                                                {isSubmittingTaskAction ? 'Iniciando...' : 'Iniciar Tarea'}
                                            </button>
                                        )}
                                        {panel.status === 'in_progress' && (
                                            <>
                                                <button 
                                                    onClick={() => handleTaskAction('pause', selectedModule.module_id, panel.panel_id)} 
                                                    disabled={isSubmittingTaskAction}
                                                    style={pauseButtonStyle}
                                                >
                                                    {isSubmittingTaskAction ? 'Pausando...' : 'Pausar Tarea'}
                                                </button>
                                                <button 
                                                    onClick={() => handleTaskAction('finish', selectedModule.module_id, panel.panel_id)} 
                                                    disabled={isSubmittingTaskAction}
                                                    style={finishButtonStyle}
                                                >
                                                    {isSubmittingTaskAction ? 'Finalizando...' : 'Finalizar Tarea'}
                                                </button>
                                            </>
                                        )}
                                        {panel.status === 'paused' && (
                                             <button 
                                                onClick={() => handleTaskAction('start', selectedModule.module_id, panel.panel_id)} // Assuming 'start' can resume
                                                disabled={isSubmittingTaskAction}
                                                style={resumeButtonStyle}
                                            >
                                                {isSubmittingTaskAction ? 'Reanudando...' : 'Reanudar Tarea'}
                                            </button>
                                        )}
                                        {panel.status === 'completed' && (
                                            <p style={{color: 'green', fontWeight: 'bold', margin: 0}}>Panel Completado ✔</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Este módulo no tiene paneles asignados, o los datos están cargando.</p>
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
