import React, { useState, useEffect, useMemo } from 'react';
// import { getStations } from '../../services/adminService'; // Now receives stations as prop
import * as adminService from '../../services/adminService'; 
import * as productionService from '../../services/productionService';

const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; 
const SELECTED_WORKER_ID_KEY = 'selectedWorkerId';

function StationContextSelector({ allStations, isLoadingAllStations }) { 
    const [currentStationId, setCurrentStationId] = useState(localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY) || null);
    const [selectedWorkerId, setSelectedWorkerId] = useState(localStorage.getItem(SELECTED_WORKER_ID_KEY) || null);
    const [selectedModule, setSelectedModule] = useState(null); // Stores the single module object
    const [selectedPanelId, setSelectedPanelId] = useState(null); // panel_definition_id of the selected panel
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [contextError, setContextError] = useState('');
    const [workers, setWorkers] = useState([]);
    const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
    const [currentWorkerTask, setCurrentWorkerTask] = useState(null);
    const [isPerformingAction, setIsPerformingAction] = useState(false);

    // Effect to re-read from localStorage if the key changes externally
    useEffect(() => {
        const handleStorageChange = () => {
            const storedStationId = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
            const storedWorkerId = localStorage.getItem(SELECTED_WORKER_ID_KEY);
            
            if (storedStationId !== currentStationId) {
                setCurrentStationId(storedStationId || null);
            }
            if (storedWorkerId !== selectedWorkerId) {
                setSelectedWorkerId(storedWorkerId || null);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        
        // Check on mount
        const initialStoredStationId = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
        const initialStoredWorkerId = localStorage.getItem(SELECTED_WORKER_ID_KEY);
        
        if (initialStoredStationId && initialStoredStationId !== currentStationId) {
             setCurrentStationId(initialStoredStationId);
        } else if (!initialStoredStationId && currentStationId) {
            setCurrentStationId(null);
        }
        
        if (initialStoredWorkerId && initialStoredWorkerId !== selectedWorkerId) {
             setSelectedWorkerId(initialStoredWorkerId);
        } else if (!initialStoredWorkerId && selectedWorkerId) {
            setSelectedWorkerId(null);
        }

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [currentStationId, selectedWorkerId]);

    // Load workers on mount
    useEffect(() => {
        const loadWorkers = async () => {
            setIsLoadingWorkers(true);
            try {
                const workersData = await adminService.getWorkers();
                setWorkers(workersData);
            } catch (error) {
                console.error('Error loading workers:', error);
            } finally {
                setIsLoadingWorkers(false);
            }
        };
        
        loadWorkers();
    }, []);

    // Load station context when station or worker changes
    useEffect(() => {
        if (currentStationId) {
            loadStationContext();
        } else {
            setSelectedModule(null);
            setSelectedPanelId(null);
        }
    }, [currentStationId, selectedWorkerId]);

    // Load worker's current task when worker changes
    useEffect(() => {
        if (selectedWorkerId) {
            loadWorkerCurrentTask();
        } else {
            setCurrentWorkerTask(null);
        }
    }, [selectedWorkerId]);

    const loadStationContext = async () => {
        if (!currentStationId) return;
        
        setIsLoadingContext(true);
        setContextError('');
        
        try {
            const workerSpecialtyId = selectedWorkerId ? getWorkerSpecialtyId(selectedWorkerId) : null;
            const context = await productionService.getStationContext(currentStationId, workerSpecialtyId);
            
            if (context.current_module) {
                setSelectedModule(context.current_module);
                // Auto-select first panel if none selected
                if (!selectedPanelId && context.current_module.panels && context.current_module.panels.length > 0) {
                    setSelectedPanelId(context.current_module.panels[0].panel_definition_id);
                }
            } else {
                setSelectedModule(null);
                setSelectedPanelId(null);
            }
        } catch (error) {
            console.error('Error loading station context:', error);
            setContextError(error.message || 'Error loading station context');
            setSelectedModule(null);
            setSelectedPanelId(null);
        } finally {
            setIsLoadingContext(false);
        }
    };

    const loadWorkerCurrentTask = async () => {
        if (!selectedWorkerId) return;
        
        try {
            const task = await productionService.getWorkerCurrentTask(selectedWorkerId);
            setCurrentWorkerTask(task);
        } catch (error) {
            console.error('Error loading worker current task:', error);
            setCurrentWorkerTask(null);
        }
    };

    const getWorkerSpecialtyId = (workerId) => {
        const worker = workers.find(w => w.worker_id.toString() === workerId);
        return worker ? worker.specialty_id : null;
    };

    const handleWorkerChange = (workerId) => {
        setSelectedWorkerId(workerId);
        if (workerId) {
            localStorage.setItem(SELECTED_WORKER_ID_KEY, workerId);
        } else {
            localStorage.removeItem(SELECTED_WORKER_ID_KEY);
        }
    };

    const handleStartTask = async (panel, taskDefinitionId) => {
        if (!selectedWorkerId || !currentStationId) {
            alert('Please select a worker and ensure station is configured');
            return;
        }

        if (currentWorkerTask) {
            alert('Worker already has a task in progress. Please finish or pause the current task first.');
            return;
        }

        setIsPerformingAction(true);
        try {
            await productionService.startPanelTask({
                plan_id: selectedModule.plan_id,
                panel_definition_id: panel.panel_definition_id,
                task_definition_id: taskDefinitionId,
                worker_id: parseInt(selectedWorkerId),
                station_id: currentStationId
            });
            
            // Reload context and worker task
            await Promise.all([loadStationContext(), loadWorkerCurrentTask()]);
            
        } catch (error) {
            console.error('Error starting task:', error);
            alert(error.message || 'Error starting task');
        } finally {
            setIsPerformingAction(false);
        }
    };

    const handlePauseTask = async (taskLogId, reason = null) => {
        if (!selectedWorkerId) return;

        setIsPerformingAction(true);
        try {
            await productionService.pausePanelTask(taskLogId, parseInt(selectedWorkerId), reason);
            
            // Reload context and worker task
            await Promise.all([loadStationContext(), loadWorkerCurrentTask()]);
            
        } catch (error) {
            console.error('Error pausing task:', error);
            alert(error.message || 'Error pausing task');
        } finally {
            setIsPerformingAction(false);
        }
    };

    const handleResumeTask = async (taskLogId) => {
        if (!selectedWorkerId) return;

        setIsPerformingAction(true);
        try {
            await productionService.resumePanelTask(taskLogId, parseInt(selectedWorkerId));
            
            // Reload context and worker task
            await Promise.all([loadStationContext(), loadWorkerCurrentTask()]);
            
        } catch (error) {
            console.error('Error resuming task:', error);
            alert(error.message || 'Error resuming task');
        } finally {
            setIsPerformingAction(false);
        }
    };

    const handleFinishTask = async (taskLogId, notes = null) => {
        if (!selectedWorkerId || !currentStationId) return;

        setIsPerformingAction(true);
        try {
            await productionService.finishPanelTask(taskLogId, parseInt(selectedWorkerId), currentStationId, notes);
            
            // Reload context and worker task
            await Promise.all([loadStationContext(), loadWorkerCurrentTask()]);
            
        } catch (error) {
            console.error('Error finishing task:', error);
            alert(error.message || 'Error finishing task');
        } finally {
            setIsPerformingAction(false);
        }
    };

    const currentStationName = useMemo(() => {
        if (!currentStationId) return '';
        if (isLoadingAllStations || !allStations || allStations.length === 0) return 'Cargando nombre de estación...';
        const station = allStations.find(s => s.station_id.toString() === currentStationId);
        return station ? station.name : 'ID de estación desconocido';
    }, [currentStationId, allStations, isLoadingAllStations]);

    const selectedWorkerName = useMemo(() => {
        if (!selectedWorkerId || !workers.length) return '';
        const worker = workers.find(w => w.worker_id.toString() === selectedWorkerId);
        return worker ? `${worker.first_name} ${worker.last_name}` : 'Trabajador desconocido';
    }, [selectedWorkerId, workers]);

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

    const buttonBaseStyle = {
        border: 'none',
        padding: '8px 12px', 
        borderRadius: '4px', 
        cursor: 'pointer',
        marginRight: '5px',
        opacity: 1,
    };

    const startButtonStyle = { ...buttonBaseStyle, backgroundColor: '#28a745', color: 'white' };
    const pauseButtonStyle = { ...buttonBaseStyle, backgroundColor: '#ffc107', color: 'black' };
    const finishButtonStyle = { ...buttonBaseStyle, backgroundColor: '#007bff', color: 'white' };
    const resumeButtonStyle = { ...buttonBaseStyle, backgroundColor: '#28a745', color: 'white' };
    const disabledButtonStyle = { ...buttonBaseStyle, backgroundColor: '#6c757d', color: 'white', cursor: 'not-allowed' };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Contexto de Estación de Trabajo</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h4>Estación Actual:</h4>
                <p><strong>{currentStationName} (ID: {currentStationId})</strong></p>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h4>Seleccionar Trabajador:</h4>
                {isLoadingWorkers ? (
                    <p>Cargando trabajadores...</p>
                ) : (
                    <select 
                        value={selectedWorkerId || ''} 
                        onChange={(e) => handleWorkerChange(e.target.value || null)}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
                    >
                        <option value="">Seleccionar trabajador...</option>
                        {workers.filter(w => w.is_active).map(worker => (
                            <option key={worker.worker_id} value={worker.worker_id}>
                                {worker.first_name} {worker.last_name} {worker.specialty_name ? `(${worker.specialty_name})` : ''}
                            </option>
                        ))}
                    </select>
                )}
                {selectedWorkerId && <p><strong>Trabajador Seleccionado:</strong> {selectedWorkerName}</p>}
            </div>

            {currentWorkerTask && (
                <div style={{ marginBottom: '20px', padding: '15px', border: '2px solid #ffc107', borderRadius: '5px', backgroundColor: '#fff3cd' }}>
                    <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>Tarea Activa del Trabajador:</h4>
                    <p><strong>Tarea:</strong> {currentWorkerTask.task_name}</p>
                    <p><strong>Panel:</strong> {currentWorkerTask.panel_code} ({currentWorkerTask.panel_group})</p>
                    <p><strong>Proyecto:</strong> {currentWorkerTask.project_name} - Casa {currentWorkerTask.house_identifier} - Módulo {currentWorkerTask.module_number}</p>
                    <p><strong>Estado:</strong> <span style={{fontWeight: 'bold'}}>{currentWorkerTask.status}</span></p>
                    <p><strong>Iniciado:</strong> {new Date(currentWorkerTask.started_at).toLocaleString()}</p>
                    
                    <div style={{ marginTop: '10px' }}>
                        {currentWorkerTask.status === 'In Progress' && (
                            <>
                                <button 
                                    onClick={() => handlePauseTask(currentWorkerTask.panel_task_log_id)}
                                    disabled={isPerformingAction}
                                    style={isPerformingAction ? disabledButtonStyle : pauseButtonStyle}
                                >
                                    Pausar Tarea
                                </button>
                                <button 
                                    onClick={() => handleFinishTask(currentWorkerTask.panel_task_log_id)}
                                    disabled={isPerformingAction}
                                    style={isPerformingAction ? disabledButtonStyle : finishButtonStyle}
                                >
                                    Finalizar Tarea
                                </button>
                            </>
                        )}
                        {currentWorkerTask.status === 'Paused' && (
                            <>
                                <button 
                                    onClick={() => handleResumeTask(currentWorkerTask.panel_task_log_id)}
                                    disabled={isPerformingAction}
                                    style={isPerformingAction ? disabledButtonStyle : resumeButtonStyle}
                                >
                                    Reanudar Tarea
                                </button>
                                <button 
                                    onClick={() => handleFinishTask(currentWorkerTask.panel_task_log_id)}
                                    disabled={isPerformingAction}
                                    style={isPerformingAction ? disabledButtonStyle : finishButtonStyle}
                                >
                                    Finalizar Tarea
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isLoadingContext && <p>Cargando contexto de estación...</p>}
            {contextError && <p style={{ color: 'red' }}>{contextError}</p>}

            {!isLoadingContext && !contextError && !selectedModule && currentStationId && (
                <p style={{ color: 'blue', fontStyle: 'italic' }}>No hay módulos activos o pendientes para esta estación en este momento.</p>
            )}

            {selectedModule && (
                <div style={{border: '1px solid #eee', padding: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9'}}>
                    <h4>Módulo Actual:</h4>
                    <p><strong>Plan ID:</strong> {selectedModule.plan_id}</p>
                    <p><strong>Secuencia Planificada:</strong> {selectedModule.planned_sequence !== undefined ? selectedModule.planned_sequence : 'N/A'}</p>
                    <p><strong>Nombre del Proyecto:</strong> {selectedModule.project_name}</p>
                    <p><strong>Identificador de Casa:</strong> {selectedModule.house_identifier}</p>
                    <p><strong>Tipo de Casa:</strong> {selectedModule.house_type_name} (Módulos: {selectedModule.module_number}/{selectedModule.number_of_modules})</p>
                    <p><strong>Sub-Tipo:</strong> {selectedModule.sub_type_name || 'N/A'}</p>
                    <p><strong>Estado del Módulo:</strong> <span style={{fontWeight: 'bold'}}>{selectedModule.status}</span></p>
                    
                    <h5 style={{marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px'}}>Paneles del Módulo:</h5>
                    {selectedModule.panels && selectedModule.panels.length > 0 ? (
                        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                            {selectedModule.panels.map(panel => (
                                <li 
                                    key={panel.panel_definition_id}
                                    style={{ 
                                        padding: '12px', 
                                        border: `1px solid ${selectedPanelId === panel.panel_definition_id ? '#007bff' : '#ddd'}`, 
                                        boxShadow: selectedPanelId === panel.panel_definition_id ? '0 0 5px rgba(0,123,255,.5)' : 'none',
                                        marginBottom: '10px',
                                        borderRadius: '4px',
                                        backgroundColor: panel.status === 'consumed' ? '#e9ecef' : (selectedPanelId === panel.panel_definition_id ? '#e7f3ff' : 'white'),
                                        transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s',
                                    }}
                                >
                                    <div onClick={() => setSelectedPanelId(panel.panel_definition_id)} style={{cursor: 'pointer', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee'}}>
                                        <p style={{margin: '0 0 5px 0'}}><strong>Código:</strong> {panel.panel_code} (ID: {panel.panel_definition_id})</p>
                                        <p style={{margin: 0}}><strong>Grupo:</strong> {panel.panel_group}</p>
                                        <p style={{margin: 0}}><strong>Estado:</strong> <span style={{fontWeight: 'bold'}}>{panel.status}</span></p>
                                        {panel.current_task && (
                                            <p style={{margin: 0, color: '#856404'}}><strong>Tarea Activa:</strong> {panel.current_task.task_name} ({panel.current_task.status})</p>
                                        )}
                                    </div>
                                    
                                    {selectedPanelId === panel.panel_definition_id && (
                                        <div style={{ marginTop: '10px'}}>
                                            {/* Show available tasks */}
                                            {panel.available_tasks && panel.available_tasks.length > 0 && !panel.current_task && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Tareas Disponibles:</p>
                                                    {panel.available_tasks.map(task => (
                                                        <button
                                                            key={task.task_definition_id}
                                                            onClick={() => handleStartTask(panel, task.task_definition_id)}
                                                            disabled={isPerformingAction || !selectedWorkerId || currentWorkerTask}
                                                            style={{
                                                                ...((isPerformingAction || !selectedWorkerId || currentWorkerTask) ? disabledButtonStyle : startButtonStyle),
                                                                marginBottom: '5px',
                                                                display: 'block'
                                                            }}
                                                            title={task.description || task.name}
                                                        >
                                                            Iniciar: {task.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Show current task controls */}
                                            {panel.current_task && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Tarea Actual: {panel.current_task.task_name}</p>
                                                    <p style={{ margin: '0 0 10px 0', fontSize: '0.9em' }}>
                                                        Trabajador: {panel.current_task.first_name} {panel.current_task.last_name} | 
                                                        Estado: {panel.current_task.status} | 
                                                        Iniciado: {new Date(panel.current_task.started_at).toLocaleString()}
                                                    </p>
                                                    
                                                    {panel.current_task.status === 'In Progress' && selectedWorkerId && panel.current_task.worker_id.toString() === selectedWorkerId && (
                                                        <>
                                                            <button 
                                                                onClick={() => handlePauseTask(panel.current_task.panel_task_log_id)}
                                                                disabled={isPerformingAction}
                                                                style={isPerformingAction ? disabledButtonStyle : pauseButtonStyle}
                                                            >
                                                                Pausar Tarea
                                                            </button>
                                                            <button 
                                                                onClick={() => handleFinishTask(panel.current_task.panel_task_log_id)}
                                                                disabled={isPerformingAction}
                                                                style={isPerformingAction ? disabledButtonStyle : finishButtonStyle}
                                                            >
                                                                Finalizar Tarea
                                                            </button>
                                                        </>
                                                    )}
                                                    
                                                    {panel.current_task.status === 'Paused' && selectedWorkerId && panel.current_task.worker_id.toString() === selectedWorkerId && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleResumeTask(panel.current_task.panel_task_log_id)}
                                                                disabled={isPerformingAction || currentWorkerTask}
                                                                style={(isPerformingAction || currentWorkerTask) ? disabledButtonStyle : resumeButtonStyle}
                                                            >
                                                                Reanudar Tarea
                                                            </button>
                                                            <button 
                                                                onClick={() => handleFinishTask(panel.current_task.panel_task_log_id)}
                                                                disabled={isPerformingAction}
                                                                style={isPerformingAction ? disabledButtonStyle : finishButtonStyle}
                                                            >
                                                                Finalizar Tarea
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {panel.status === 'consumed' && (
                                                <p style={{color: 'green', fontWeight: 'bold', margin: 0}}>Panel Completado ✔</p>
                                            )}
                                            
                                            {!selectedWorkerId && panel.available_tasks && panel.available_tasks.length > 0 && (
                                                <p style={{color: 'orange', fontStyle: 'italic', margin: 0}}>Seleccione un trabajador para iniciar tareas</p>
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
                Esta vista muestra la estación y el módulo configurados actualmente basado en las reglas del sistema de producción. 
                Seleccione un trabajador y utilice los botones para gestionar el progreso de las tareas de cada panel.
                El sistema automáticamente mueve los módulos y paneles a la siguiente estación cuando todas las tareas están completadas.
            </p>
        </div>
    );
}

export default StationContextSelector;
