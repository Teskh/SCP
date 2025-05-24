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
        opacity: 1,
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
                                                    disabled={true}
                                                    style={startButtonStyle}
                                                >
                                                    Iniciar Tarea
                                                </button>
                                            )}
                                            {panel.status === 'in_progress' && (
                                                <>
                                                    <button 
                                                        disabled={true}
                                                        style={pauseButtonStyle}
                                                    >
                                                        Pausar Tarea
                                                    </button>
                                                    <button 
                                                        disabled={true}
                                                        style={finishButtonStyle}
                                                    >
                                                        Finalizar Tarea
                                                    </button>
                                                </>
                                            )}
                                            {panel.status === 'paused' && (
                                                <>
                                                    <button 
                                                        disabled={true}
                                                        style={resumeButtonStyle}
                                                    >
                                                        Reanudar Tarea
                                                    </button>
                                                    <button 
                                                        disabled={true}
                                                        style={{...finishButtonStyle, marginLeft: '5px'}}
                                                    >
                                                        Finalizar Tarea
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
