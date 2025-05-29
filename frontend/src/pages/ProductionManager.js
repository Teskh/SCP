import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import { 
    // startTask, pauseTask, resumeTask, completeTask, // Task operations are currently disabled
    getInfoForNextModulePanels, 
    getCurrentStationPanels 
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
            return;
        }

        const currentStation = allStations.find(s => s.station_id === resolvedSpecificStationId);

        if (currentStation && currentStation.line_type === 'W') {
            setIsLoadingPanelInfo(true);
            setPanelInfoError('');
            setPanelProductionInfo(null);

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
        }
    }, [resolvedSpecificStationId, allStations, user]);


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
                            <h3>Paneles en Producción</h3>
                            {panelProductionInfo.type === 'nextModule' && panelProductionInfo.data && (
                                <>
                                    <p><strong>Siguiente Módulo a Producir Paneles:</strong> {panelProductionInfo.data.module_name} (Plan ID: {panelProductionInfo.data.plan_id})</p>
                                    {panelProductionInfo.data.panels_to_produce && panelProductionInfo.data.panels_to_produce.length > 0 ? (
                                        <ul style={listStyle}>
                                            {panelProductionInfo.data.panels_to_produce.map(panel => (
                                                <li key={panel.panel_definition_id} style={listItemStyle}>
                                                    {panel.panel_code} ({panel.panel_group})
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>No hay paneles específicos listados para iniciar producción para este módulo (o ya están todos en PanelProductionPlan).</p>
                                    )}
                                </>
                            )}
                             {panelProductionInfo.type === 'nextModule' && !panelProductionInfo.data && panelProductionInfo.message && (
                                <p>{panelProductionInfo.message}</p>
                            )}

                            {panelProductionInfo.type === 'currentStation' && panelProductionInfo.data && panelProductionInfo.data.length > 0 && (
                                <>
                                    <p><strong>Paneles Actualmente en esta Estación ({resolvedSpecificStationId}):</strong></p>
                                    <ul style={listStyle}>
                                        {panelProductionInfo.data.map(panel => (
                                            <li key={panel.panel_production_plan_id} style={listItemStyle}>
                                                {panel.panel_name} (Módulo: {panel.module_name}, Plan ID: {panel.plan_id})
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {panelProductionInfo.type === 'currentStation' && (!panelProductionInfo.data || panelProductionInfo.data.length === 0) && (
                                <p>No hay paneles "En Progreso" actualmente en esta estación.</p>
                            )}
                        </div>
                    )}
                     <p style={{ marginTop: '20px', fontStyle: 'italic' }}>La funcionalidad de visualización de tareas individuales está actualmente deshabilitada.</p>
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
