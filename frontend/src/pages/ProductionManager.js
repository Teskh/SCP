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
    
    // Module Task Specific State (for Assembly Stations)
    const [selectedModuleIdentifier, setSelectedModuleIdentifier] = useState(null); // { plan_id, module_name, house_type_id, eligible_tasks }
    const [moduleTasks, setModuleTasks] = useState([]); // Tasks for a selected module (if not directly in eligible_tasks)
    const [isLoadingModuleTasks, setIsLoadingModuleTasks] = useState(false);
    const [moduleTasksError, setModuleTasksError] = useState('');
    
    const [materialsForSelectedTask, setMaterialsForSelectedTask] = useState([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
    const [materialsError, setMaterialsError] = useState('');


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

    // Effect to fetch panel production information OR module information for assembly stations
    useEffect(() => {
        if (!resolvedSpecificStationId || !allStations || allStations.length === 0 || !user) {
            setPanelProductionInfo(null);
            setPanelInfoError('');
            setSelectedPanelIdentifier(null);
            setPanelTasks([]);
            setSelectedModuleIdentifier(null);
            setModuleTasks([]);
            return;
        }

        const currentStation = allStations.find(s => s.station_id === resolvedSpecificStationId);

        // Clear previous states
        setPanelProductionInfo(null);
        setPanelInfoError('');
        setSelectedPanelIdentifier(null);
        setPanelTasks([]);
        setSelectedModuleIdentifier(null);
        setModuleTasks([]);
        setTaskActionMessage({ type: '', content: '' });


        if (currentStation && currentStation.line_type === 'W') { // Panel Production Stations (W1-W5)
            setIsLoadingPanelInfo(true);
            // setSelectedPanelIdentifier(null); // Already cleared above
            // setPanelTasks([]); // Already cleared above

            if (currentStation.station_id === 'W1') { // Special logic for W1
                setIsLoadingPanelInfo(true);
                setPanelInfoError('');
                setPanelProductionInfo(null);
                setSelectedPanelIdentifier(null);
                setPanelTasks([]);
                Promise.all([
                    adminService.getInfoForNextModulePanels(),
                    adminService.getCurrentStationPanels('W1')
                ])
                    .then(([infoData, inProgressPanels]) => {
                        const combinedData = { ...infoData, in_progress_panels: inProgressPanels };
                        if (infoData && infoData.plan_id) {
                            setPanelProductionInfo({ type: 'nextModule', data: combinedData });
                        } else {
                            setPanelProductionInfo({
                                type: 'nextModule',
                                data: null,
                                message: infoData.message || "No hay módulos listos para iniciar producción de paneles.",
                                in_progress_panels: inProgressPanels
                            });
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching panel info for next module or in-progress panels:", err);
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
        } else if (currentStation && (currentStation.line_type === 'A' || currentStation.line_type === 'B' || currentStation.line_type === 'C')) { // Assembly Stations
            // For assembly stations, we fetch the station status overview which includes modules at station and magazine modules for station 1
            setIsLoadingPanelInfo(true); // Re-use for general loading state
            adminService.getStationStatusOverview()
                .then(overviewData => {
                    const stationDetail = overviewData.station_status.find(s => s.station_id === resolvedSpecificStationId);
                    if (stationDetail) {
                        // Combine modules already at station and magazine modules if it's assembly station 1 (seq 7)
                        let combinedModules = [];
                        if (stationDetail.content.modules_with_active_tasks) {
                            combinedModules = combinedModules.concat(
                                stationDetail.content.modules_with_active_tasks.map(m => ({...m, source: 'active_station'}))
                            );
                        }
                        if (currentStation.sequence_order === 7 && stationDetail.content.magazine_modules_for_assembly) {
                             combinedModules = combinedModules.concat(
                                stationDetail.content.magazine_modules_for_assembly.map(m => ({...m, source: 'magazine'}))
                            );
                        }
                        setPanelProductionInfo({ type: 'assemblyStation', data: { modules: combinedModules, station: currentStation } });
                    } else {
                        setPanelInfoError(`No se encontró detalle para la estación de ensamblaje ${resolvedSpecificStationId}.`);
                    }
                })
                .catch(err => {
                    console.error(`Error fetching station overview for assembly station ${resolvedSpecificStationId}:`, err);
                    setPanelInfoError(`Error obteniendo datos para la estación de ensamblaje: ${err.message}`);
                })
                .finally(() => setIsLoadingPanelInfo(false));

        } else {
            // Neither W line nor Assembly line, or station not found
            // setPanelProductionInfo(null); // Already cleared
            // setPanelInfoError(''); // Already cleared
            // setSelectedPanelIdentifier(null); // Already cleared
            // setPanelTasks([]); // Already cleared
        }
    }, [resolvedSpecificStationId, allStations, user]);

    // Effect to fetch tasks for the selected panel (W-line) OR materials for selected module task (Assembly-line)
    useEffect(() => {
        // Panel Task Logic (W-line)
        if (selectedPanelIdentifier && selectedPanelIdentifier.plan_id && selectedPanelIdentifier.panel_definition_id) {
            const workerSpecialtyId = user && user.specialty_id !== undefined ? user.specialty_id : null;
            const currentHouseTypeId = selectedPanelIdentifier?.house_type_id;

            setIsLoadingPanelTasks(true);
            setPanelTasksError('');
            setMaterialsForSelectedTask([]);
            setMaterialsError('');

            adminService.getTasksForPanel(selectedPanelIdentifier.plan_id, selectedPanelIdentifier.panel_definition_id, resolvedSpecificStationId, workerSpecialtyId)
                .then(tasksData => {
                    // Sorting logic for panel tasks
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
                    console.error("Error fetching panel tasks:", err);
                    setPanelTasksError(`Error obteniendo tareas del panel: ${err.message}`);
                    setPanelTasks([]);
                })
                .finally(() => setIsLoadingPanelTasks(false));

            // Fetch materials for selected panel task
            if (selectedPanelIdentifier.task_definition_id && currentHouseTypeId) {
                setIsLoadingMaterials(true);
                adminService.getMaterialsForTask(selectedPanelIdentifier.task_definition_id, currentHouseTypeId)
                    .then(materialsData => setMaterialsForSelectedTask(materialsData || []))
                    .catch(err => {
                        console.error("Error fetching materials for panel task:", err);
                        setMaterialsError(`Error obteniendo materiales: ${err.message}`);
                        setMaterialsForSelectedTask([]);
                    })
                    .finally(() => setIsLoadingMaterials(false));
            } else {
                setMaterialsForSelectedTask([]);
                setMaterialsError('');
            }
        } else {
            setPanelTasks([]);
            setPanelTasksError('');
        }

        // Materials for selected Module Task (Assembly Line)
        if (selectedModuleIdentifier && selectedModuleIdentifier.task_definition_id && selectedModuleIdentifier.house_type_id) {
            setIsLoadingMaterials(true);
            setMaterialsError('');
            adminService.getMaterialsForTask(selectedModuleIdentifier.task_definition_id, selectedModuleIdentifier.house_type_id)
                .then(materialsData => {
                    setMaterialsForSelectedTask(materialsData || []);
                })
                .catch(err => {
                    console.error("Error fetching materials for module task:", err);
                    setMaterialsError(`Error obteniendo materiales para la tarea del módulo: ${err.message}`);
                    setMaterialsForSelectedTask([]);
                })
                .finally(() => setIsLoadingMaterials(false));
        } else if (selectedModuleIdentifier) { // If a module is selected but not a specific task for materials
            setMaterialsForSelectedTask([]);
            setMaterialsError('');
        }

    }, [selectedPanelIdentifier, selectedModuleIdentifier, resolvedSpecificStationId, user]);


    const handlePanelSelect = (panelData) => {
        setSelectedPanelIdentifier(panelData);
        setSelectedModuleIdentifier(null); // Clear module selection
        setMaterialsForSelectedTask([]);
        setMaterialsError('');
    };
    
    const handleModuleSelect = (moduleData) => {
        setSelectedModuleIdentifier({
            plan_id: moduleData.plan_id,
            module_name: `${moduleData.project_name} - ${moduleData.house_identifier} - Mod ${moduleData.module_number}`,
            house_type_id: moduleData.house_type_id,
            eligible_tasks: moduleData.eligible_tasks || moduleData.active_module_tasks_at_station || [], // Use appropriate task list
            // task_definition_id can be set when a specific task is clicked for materials
        });
        setSelectedPanelIdentifier(null); // Clear panel selection
        setMaterialsForSelectedTask([]);
        setMaterialsError('');
    };

    const handleTaskSelectForMaterials = (task, itemType = 'panel') => { // itemType can be 'panel' or 'module'
        if (itemType === 'panel' && selectedPanelIdentifier) {
            setSelectedPanelIdentifier(prev => ({
                ...prev,
                task_definition_id: task.task_definition_id,
                task_name: task.name
            }));
        } else if (itemType === 'module' && selectedModuleIdentifier) {
            setSelectedModuleIdentifier(prev => ({
                ...prev,
                task_definition_id: task.task_definition_id, // For fetching materials
                task_name: task.name
            }));
        }
    };

    const handleSaveSpecificStation = (specificStationId) => {
        localStorage.setItem(SELECTED_SPECIFIC_STATION_ID_KEY, specificStationId);
        setResolvedSpecificStationId(specificStationId);
        setShowSpecificStationModal(false);
    };

    const clearTaskActionMessage = () => {
        setTimeout(() => setTaskActionMessage({ type: '', content: '' }), 3000);
    };
    
    const refreshStationData = () => {
        // This function will re-trigger the main data fetching useEffect by changing resolvedSpecificStationId temporarily or user.
        // A more robust way would be to have a dedicated refresh function that calls the service again.
        // For now, we can force a re-fetch by briefly clearing and resetting resolvedSpecificStationId if it's set.
        // Or, even better, make the main useEffect depend on a 'refreshKey' state variable.
        // For simplicity here, we'll rely on the existing useEffects to re-fetch when relevant state changes.
        // The backend calls in task actions should return updated data or we call a specific refresh for that part.
        
        // Re-fetch panel/module info based on current station type
        const currentStation = allStations.find(s => s.station_id === resolvedSpecificStationId);
        if (currentStation && currentStation.line_type === 'W') {
            // Refresh panel info (logic similar to main useEffect)
            if (currentStation.station_id === 'W1') {
                 Promise.all([
                    adminService.getInfoForNextModulePanels(),
                    adminService.getCurrentStationPanels('W1')
                ]).then(([infoData, inProgressPanels]) => {
                    const combinedData = { ...infoData, in_progress_panels: inProgressPanels };
                     setPanelProductionInfo({ type: 'nextModule', data: combinedData.plan_id ? combinedData : null, message: combinedData.message, in_progress_panels: inProgressPanels });
                }).catch(err => setPanelInfoError(err.message));
            } else {
                adminService.getCurrentStationPanels(resolvedSpecificStationId)
                    .then(data => setPanelProductionInfo({ type: 'currentStation', data }))
                    .catch(err => setPanelInfoError(err.message));
            }
        } else if (currentStation && (currentStation.line_type === 'A' || currentStation.line_type === 'B' || currentStation.line_type === 'C')) {
            // Refresh assembly station info
            adminService.getStationStatusOverview()
                .then(overviewData => {
                    const stationDetail = overviewData.station_status.find(s => s.station_id === resolvedSpecificStationId);
                    if (stationDetail) {
                        let combinedModules = [];
                        if (stationDetail.content.modules_with_active_tasks) {
                             combinedModules = combinedModules.concat(
                                stationDetail.content.modules_with_active_tasks.map(m => ({...m, source: 'active_station'}))
                            );
                        }
                        if (currentStation.sequence_order === 7 && stationDetail.content.magazine_modules_for_assembly) {
                             combinedModules = combinedModules.concat(
                                stationDetail.content.magazine_modules_for_assembly.map(m => ({...m, source: 'magazine'}))
                            );
                        }
                        setPanelProductionInfo({ type: 'assemblyStation', data: { modules: combinedModules, station: currentStation } });
                         // If a module was selected, its tasks might need refresh if they are not part of 'eligible_tasks' directly
                        if (selectedModuleIdentifier) {
                            // Potentially re-select or update selectedModuleIdentifier if its source list changed
                            const updatedSelectedModule = combinedModules.find(m => m.plan_id === selectedModuleIdentifier.plan_id);
                            if (updatedSelectedModule) {
                                handleModuleSelect(updatedSelectedModule); // This will update eligible_tasks
                            } else {
                                setSelectedModuleIdentifier(null); // Module might have moved or changed status
                            }
                        }
                    }
                })
                .catch(err => setPanelInfoError(err.message));
        }


        // If a panel is selected, refresh its tasks
        if (selectedPanelIdentifier && resolvedSpecificStationId && user) {
            adminService.getTasksForPanel(selectedPanelIdentifier.plan_id, selectedPanelIdentifier.panel_definition_id, resolvedSpecificStationId, user.specialty_id)
                .then(tasksData => {
                    // Sorting logic for panel tasks
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
                    setTaskActionMessage({ type: 'error', content: `Error actualizando tareas del panel: ${err.message}` });
                    clearTaskActionMessage();
                });
        }
        // Note: Refreshing module tasks if a module is selected is handled by re-selecting the module or if tasks are part of moduleData.
    };


    const handleStartPanelTaskClick = async (task) => {
        if (!user || typeof user.id !== 'number') {
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
                    worker_id: user.id,
                    station_id: resolvedSpecificStationId
                });
                setTaskActionMessage({ type: 'success', content: `Tarea "${task.name}" iniciada.` });
            } else if (task.status === 'Paused') {
                if (!task.panel_task_log_id) {
                     setTaskActionMessage({ type: 'error', content: 'Error: Falta ID de registro de tarea para reanudar.' });
                     clearTaskActionMessage();
                     return;
                }
                response = await adminService.resumePanelTask(task.panel_task_log_id, { worker_id: user.id });
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

    const handlePausePanelTaskClick = async (task) => {
        if (!user || typeof user.id !== 'number') {
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
        if (reason === null) return;

        setTaskActionMessage({ type: '', content: '' });
        try {
            await adminService.pausePanelTask(task.panel_task_log_id, { worker_id: user.id, reason: reason || '' });
            setTaskActionMessage({ type: 'success', content: `Tarea de panel "${task.name}" pausada.` });
            refreshStationData(); // Refresh data
        } catch (error) {
            console.error("Error pausing panel task:", error);
            setTaskActionMessage({ type: 'error', content: `Error pausando tarea de panel "${task.name}": ${error.message}` });
        }
        clearTaskActionMessage();
    };
    
    const handleCompletePanelTaskClick = async (task) => {
        if (!user || typeof user.id !== 'number' || !resolvedSpecificStationId) {
            setTaskActionMessage({ type: 'error', content: 'Usuario o estación no identificados.' });
            clearTaskActionMessage();
            return;
        }
         if (task.status !== 'In Progress' || !task.panel_task_log_id) {
            setTaskActionMessage({ type: 'error', content: 'La tarea no está en progreso o falta ID de registro.' });
            clearTaskActionMessage();
            return;
        }

        const notes = window.prompt("Notas para completar la tarea (opcional):");
        if (notes === null) return;
        
        setTaskActionMessage({ type: '', content: '' });
        try {
            const response = await adminService.finishPanelTask(task.panel_task_log_id, {
                worker_id: user.id,
                station_id: resolvedSpecificStationId,
                notes: notes || ''
            });
            setTaskActionMessage({ type: 'success', content: `Tarea de panel "${task.name}" completada.` });
            refreshStationData(); // Refresh data
            if (response && response.panel_production_plan_update) {
                // If the completed panel moved, clear selection or update lists
                const currentStation = allStations.find(s => s.station_id === resolvedSpecificStationId);
                if (currentStation && currentStation.line_type === 'W' && currentStation.station_id !== 'W1') {
                    // If panel moved from W2-W5, it might no longer be in this station's list
                    // Check if selectedPanelIdentifier is still valid for current station
                    const stillExists = panelProductionInfo?.data?.find(p => p.panel_production_plan_id === selectedPanelIdentifier.panel_production_plan_id);
                    if (!stillExists) setSelectedPanelIdentifier(null);
                }
            }
        } catch (error) {
            console.error("Error completing panel task:", error);
            setTaskActionMessage({ type: 'error', content: `Error completando tarea de panel "${task.name}": ${error.message}` });
        }
        clearTaskActionMessage();
    };

    // --- Module Task Action Handlers (Assembly Line) ---
    const handleStartModuleTaskClick = async (modulePlanId, task) => {
        if (!user || typeof user.id !== 'number' || !resolvedSpecificStationId) {
            setTaskActionMessage({ type: 'error', content: 'Usuario o estación no identificados.' });
            clearTaskActionMessage();
            return;
        }
        setTaskActionMessage({ type: '', content: '' });
        try {
            // Using the generic startTask service for module tasks
            await adminService.startTask(modulePlanId, task.task_definition_id, user.id, resolvedSpecificStationId);
            setTaskActionMessage({ type: 'success', content: `Tarea de módulo "${task.name}" iniciada/reanudada.` });
            refreshStationData(); // Refresh data, which should update module status and task lists
        } catch (error) {
            console.error("Error starting/resuming module task:", error);
            setTaskActionMessage({ type: 'error', content: `Error iniciando/reanudando tarea de módulo "${task.name}": ${error.message}` });
        }
        clearTaskActionMessage();
    };

    // Placeholder for Pause Module Task - Requires backend support similar to panel tasks (TaskPauses, etc.)
    const handlePauseModuleTaskClick = async (modulePlanId, task) => {
        alert(`Funcionalidad de pausar tarea de módulo (${task.name}) aún no implementada.`);
        // TODO: Implement if backend supports pausing generic module tasks with TaskPauses table
    };

    // Placeholder for Complete Module Task
    const handleCompleteModuleTaskClick = async (modulePlanId, task) => {
        alert(`Funcionalidad de completar tarea de módulo (${task.name}) aún no implementada.`);
        // TODO: Implement if backend supports completing generic module tasks
    };


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
                    {isLoadingPanelInfo && <p>Cargando información de producción...</p>}
                    {panelInfoError && <p style={{ color: 'red' }}>{panelInfoError}</p>}
                    
                    {/* Panel Production Display (W-lines) */}
                    {panelProductionInfo && panelProductionInfo.type !== 'assemblyStation' && !isLoadingPanelInfo && !panelInfoError && (
                        <div style={panelProductionSectionStyle}>
                            <h3>Información de Paneles (Estaciones W)</h3>
                            {!selectedPanelIdentifier ? (
                                <>
                                    {/* Panel Selection for W1 */}
                                    {panelProductionInfo.type === 'nextModule' && panelProductionInfo.data && (
                                        <>
                                            <p><strong>Módulo:</strong> {panelProductionInfo.data.module_name} (Plan ID: {panelProductionInfo.data.plan_id})</p>
                                            {(panelProductionInfo.data.panels_to_produce?.length > 0 || panelProductionInfo.data.in_progress_panels?.length > 0) ? (
                                                <>
                                                    {panelProductionInfo.data.panels_to_produce?.length > 0 && (
                                                        <> <p><strong>Paneles nuevos para producción:</strong></p> <ul style={listStyle}> {panelProductionInfo.data.panels_to_produce.map(panel => ( <li key={panel.panel_definition_id} style={{...listItemStyle, cursor: 'pointer'}} onClick={() => handlePanelSelect({ plan_id: panelProductionInfo.data.plan_id, panel_definition_id: panel.panel_definition_id, panel_name: `${panel.panel_code} (${panel.panel_group})`, module_name: panelProductionInfo.data.module_name, house_type_id: panelProductionInfo.data.house_type_id })}>{panel.panel_code} ({panel.panel_group})</li> ))} </ul> </>
                                                    )}
                                                    {panelProductionInfo.data.in_progress_panels?.length > 0 && (
                                                        <> <p><strong>Paneles en progreso:</strong></p> <ul style={listStyle}> {panelProductionInfo.data.in_progress_panels.map(panel => ( <li key={panel.panel_production_plan_id} style={{...listItemStyle, cursor: 'pointer'}} onClick={() => handlePanelSelect({ plan_id: panel.plan_id, panel_definition_id: panel.panel_definition_id, panel_name: panel.panel_name, module_name: panel.module_name, house_type_id: panel.house_type_id })}>{panel.panel_name} (Módulo: {panel.module_name})</li> ))} </ul> </>
                                                    )}
                                                </>
                                            ) : <p>No hay paneles específicos listados para este módulo.</p>}
                                        </>
                                    )}
                                    {panelProductionInfo.type === 'nextModule' && !panelProductionInfo.data && panelProductionInfo.message && (<p>{panelProductionInfo.message}</p>)}
                                    {/* Panel Selection for W2-W5 */}
                                    {panelProductionInfo.type === 'currentStation' && panelProductionInfo.data?.length > 0 && (
                                        <> <p><strong>Paneles en esta Estación ({resolvedSpecificStationId}). Seleccione uno:</strong></p> <ul style={listStyle}> {panelProductionInfo.data.map(panel => ( <li key={panel.panel_production_plan_id} style={{...listItemStyle, cursor: 'pointer'}} onClick={() => handlePanelSelect({ plan_id: panel.plan_id, panel_definition_id: panel.panel_definition_id, panel_name: panel.panel_name, module_name: panel.module_name, house_type_id: panel.house_type_id })}>{panel.panel_name} (Módulo: {panel.module_name})</li> ))} </ul> </>
                                    )}
                                    {panelProductionInfo.type === 'currentStation' && (!panelProductionInfo.data || panelProductionInfo.data.length === 0) && (<p>No hay paneles "En Progreso" actualmente en esta estación.</p>)}
                                </>
                            ) : ( // Display tasks for selectedPanelIdentifier
                                <div style={{ marginTop: '20px' }}>
                                    <button onClick={() => setSelectedPanelIdentifier(null)} style={{ ...buttonStyle, backgroundColor: '#6c757d', marginBottom: '10px' }}>Volver a selección de panel</button>
                                    <h4>Tareas para Panel: {selectedPanelIdentifier.panel_name}</h4>
                                    <p>(Módulo: {selectedPanelIdentifier.module_name}, Plan ID: {selectedPanelIdentifier.plan_id}, Panel Def ID: {selectedPanelIdentifier.panel_definition_id})</p>
                                    {isLoadingPanelTasks && <p>Cargando tareas del panel...</p>}
                                    {panelTasksError && <p style={{ color: 'red' }}>{panelTasksError}</p>}
                                    {!isLoadingPanelTasks && !panelTasksError && panelTasks.length > 0 && (
                                        <ul style={listStyle}> {panelTasks.map(task => ( <li key={task.task_definition_id} style={taskListItemStyle}> <div style={taskInfoStyle}> <strong>{task.name}</strong> (ID: {task.task_definition_id})<br /> Estado: {task.status} <br/> {task.description && <small>Desc: {task.description}<br/></small>} {task.station_finish && <small>Finalizada en Estación: {task.station_finish}<br/></small>} {task.completed_at && <small>Completada: {new Date(task.completed_at).toLocaleString()}<br/></small>} </div> <div style={taskActionsStyle}> {(task.status === 'Not Started' || task.status === 'Paused') && ( <button style={buttonStyle} onClick={() => handleStartPanelTaskClick(task)}> {task.status === 'Not Started' ? 'Iniciar' : 'Reanudar'} </button> )} {task.status === 'In Progress' && ( <> <button style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black', marginBottom: '5px'}} onClick={() => handlePausePanelTaskClick(task)}> Pausar </button> <button style={{...buttonStyle, backgroundColor: '#28a745'}} onClick={() => handleCompletePanelTaskClick(task)}> Completar </button> </> )} {task.status === 'Completed' && (<span style={{color: 'green', fontSize: '0.9em'}}>Completada</span>)} <button style={{...buttonStyle, backgroundColor: '#17a2b8', marginTop: '5px'}} onClick={() => handleTaskSelectForMaterials(task, 'panel')}> Ver Materiales </button> </div> </li> ))} </ul>
                                    )}
                                    {!isLoadingPanelTasks && !panelTasksError && panelTasks.length === 0 && (<p>No hay tareas definidas o encontradas para este panel.</p>)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Assembly Station Display (A, B, C lines) */}
                    {panelProductionInfo && panelProductionInfo.type === 'assemblyStation' && !isLoadingPanelInfo && !panelInfoError && (
                        <div style={panelProductionSectionStyle}>
                            <h3>Información de Módulos (Estación de Ensamblaje: {panelProductionInfo.data.station.name})</h3>
                            {!selectedModuleIdentifier ? (
                                <>
                                    {panelProductionInfo.data.modules?.length > 0 ? (
                                        <>
                                        <p><strong>Seleccione un módulo para ver/iniciar sus tareas:</strong></p>
                                        <ul style={listStyle}>
                                            {panelProductionInfo.data.modules.map(module => (
                                                <li key={module.plan_id} style={{...listItemStyle, cursor: 'pointer', backgroundColor: module.source === 'magazine' ? '#e6fffa' : 'inherit'}} onClick={() => handleModuleSelect(module)}>
                                                    {module.project_name} - {module.house_identifier} - Mod {module.module_number} (Plan ID: {module.plan_id})
                                                    <br/><small>Estado: {module.status} {module.source === 'magazine' ? '(Desde Almacén)' : `(En Estación ${module.current_station || 'N/A'})`}</small>
                                                    {module.planned_assembly_line && <small> - Línea Planificada: {module.planned_assembly_line}</small>}
                                                </li>
                                            ))}
                                        </ul>
                                        </>
                                    ) : (
                                        <p>No hay módulos activos o disponibles desde el almacén para esta estación en este momento.</p>
                                    )}
                                </>
                            ) : ( // Display tasks for selectedModuleIdentifier
                                <div style={{ marginTop: '20px' }}>
                                    <button onClick={() => setSelectedModuleIdentifier(null)} style={{ ...buttonStyle, backgroundColor: '#6c757d', marginBottom: '10px' }}>Volver a selección de módulo</button>
                                    <h4>Tareas para Módulo: {selectedModuleIdentifier.module_name}</h4>
                                    <p>(Plan ID: {selectedModuleIdentifier.plan_id})</p>
                                    {/* Assuming eligible_tasks contains all tasks to display. Adapt if tasks need separate fetching. */}
                                    {selectedModuleIdentifier.eligible_tasks?.length > 0 ? (
                                        <ul style={listStyle}>
                                            {selectedModuleIdentifier.eligible_tasks.map(task => (
                                                <li key={task.task_definition_id} style={taskListItemStyle}>
                                                    <div style={taskInfoStyle}>
                                                        <strong>{task.name}</strong> (ID: {task.task_definition_id})<br />
                                                        {/* Status for module tasks might come from TaskLogs, not directly on eligible_tasks yet */}
                                                        {/* For now, we assume 'Not Started' if from magazine, or actual status if from active_module_tasks */}
                                                        <small>Estado: {task.status || 'No Iniciada'}</small><br/>
                                                        {task.description && <small>Desc: {task.description}<br/></small>}
                                                    </div>
                                                    <div style={taskActionsStyle}>
                                                        {(!task.status || task.status === 'Not Started' || task.status === 'Paused') && (
                                                            <button style={buttonStyle} onClick={() => handleStartModuleTaskClick(selectedModuleIdentifier.plan_id, task)}>
                                                                {task.status === 'Paused' ? 'Reanudar' : 'Iniciar'}
                                                            </button>
                                                        )}
                                                        {task.status === 'In Progress' && (
                                                            <>
                                                            <button style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black', marginBottom: '5px'}} onClick={() => handlePauseModuleTaskClick(selectedModuleIdentifier.plan_id, task)}>Pausar</button>
                                                            <button style={{...buttonStyle, backgroundColor: '#28a745'}} onClick={() => handleCompleteModuleTaskClick(selectedModuleIdentifier.plan_id, task)}>Completar</button>
                                                            </>
                                                        )}
                                                        {task.status === 'Completed' && (<span style={{color: 'green', fontSize: '0.9em'}}>Completada</span>)}
                                                        <button style={{...buttonStyle, backgroundColor: '#17a2b8', marginTop: '5px'}} onClick={() => handleTaskSelectForMaterials(task, 'module')}>Ver Materiales</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No hay tareas elegibles definidas para este módulo en esta estación.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Common Sections: Task Action Message & Materials */}
                    {taskActionMessage.content && (
                        <p style={taskActionMessage.type === 'error' ? errorStyle : successStyle}>
                            {taskActionMessage.content}
                        </p>
                    )}
                    {/* Materials for Selected Task Section (Panel or Module) */}
                    {(selectedPanelIdentifier?.task_definition_id || selectedModuleIdentifier?.task_definition_id) && (
                        <div style={materialsSectionStyle}>
                            <h4>Materiales para Tarea: {(selectedPanelIdentifier?.task_name || selectedModuleIdentifier?.task_name) || (selectedPanelIdentifier?.task_definition_id || selectedModuleIdentifier?.task_definition_id)}</h4>
                            {isLoadingMaterials && <p>Cargando materiales...</p>}
                            {materialsError && <p style={{ color: 'red' }}>{materialsError}</p>}
                            {!isLoadingMaterials && !materialsError && materialsForSelectedTask.length > 0 ? (
                                <ul style={listStyle}> {materialsForSelectedTask.map(material => ( <li key={material.material_id} style={listItemStyle}> <strong>{material.material_name}</strong> (SKU: {material.SKU}) - {material.quantity} {material.unit || material.Units}</li> ))} </ul>
                            ) : (!isLoadingMaterials && !materialsError && <p>No se encontraron materiales para esta tarea o no hay un proyecto vinculado.</p>)}
                        </div>
                    )}

                    {/* Message when nothing is selected */}
                    {!selectedPanelIdentifier && !selectedModuleIdentifier && resolvedSpecificStationId && panelProductionInfo && !isLoadingPanelInfo && (
                         <p style={{ marginTop: '20px', fontStyle: 'italic' }}>
                            Seleccione un panel o módulo de la lista de arriba para ver y gestionar sus tareas.
                         </p>
                    )}
                </div>
            )}
            {!resolvedSpecificStationId && !showSpecificStationModal && !isLoadingAllStations && <p>Estación no configurada o inválida. Por favor, configure una estación válida.</p>}
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


const moduleInfoBoxStyle = {
    marginTop: '20px',
    padding: '15px',
    border: '1px solid #eee',
    borderRadius: '5px',
    backgroundColor: '#f9f9f9',
    textAlign: 'left', // Align text left within the box
};

const materialsSectionStyle = {
    marginTop: '20px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '5px',
    backgroundColor: '#f0f0f0',
    textAlign: 'left',
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
