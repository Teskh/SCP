import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal
import { startTask, pauseTask, resumeTask, completeTask } from '../services/adminService'; // Import services

const SELECTED_STATION_CONTEXT_KEY = 'selectedStationContext'; // New constant for the main key
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; // Key for localStorage, used by SpecificStationSelectorModal
const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL'; // From StationContextSelector/StationManager

const ProductionManager = ({ user, allStations, isLoadingAllStations, allStationsError }) => {
    const [showSpecificStationModal, setShowSpecificStationModal] = useState(false);
    const [userSelectedStationContext, setUserSelectedStationContext] = useState(null); // New state for the main context from localStorage
    const [resolvedSpecificStationId, setResolvedSpecificStationId] = useState(null); // The actual station_id to use for API calls

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
    }, [user, allStations, isLoadingAllStations]); // Dependencies for this effect

    const handleSaveSpecificStation = (specificStationId) => {
        // Store the specific station ID in localStorage for future visits
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

            {!showSpecificStationModal && resolvedSpecificStationId ? (
                <div>
                    <p style={{ marginTop: '20px' }}>La funcionalidad de visualización de módulos y tareas está actualmente deshabilitada.</p>
                    {/* The following sections are removed as their data source is no longer available */}
                    {/* Display Current Module */}
                    {/* Display Tasks for current module */}
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
