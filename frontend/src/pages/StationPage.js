import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import SpecificStationSelectorModal from '../components/station/SpecificStationSelectorModal'; // Import the modal

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId';

// Helper function to check if a specific station ID is valid for the ambiguous context
const checkSpecificIdValidity = (specificId, ambiguousSequence, stations) => {
    if (!specificId || !stations || stations.length === 0) return false;
    const station = stations.find(s => s.station_id === specificId);
    if (!station) return false;

    if (ambiguousSequence === PANEL_LINE_GENERAL_VALUE) {
        return station.sequence_order >= 1 && station.sequence_order <= 5; // W stations
    } else {
        const numericAmbiguousSeq = parseInt(ambiguousSequence, 10);
        if (isNaN(numericAmbiguousSeq)) return false;
        return station.sequence_order === numericAmbiguousSeq;
    }
};


const StationPage = ({ user, activeStationSequenceOrder, allStations, isLoadingAllStations, allStationsError }) => {
import { getStationOverviewData } from '../services/adminService'; // Import the new service

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId';

// Helper function to check if a specific station ID is valid for the ambiguous context
const checkSpecificIdValidity = (specificId, ambiguousSequence, stations) => {
    if (!specificId || !stations || stations.length === 0) return false;
    const station = stations.find(s => s.station_id === specificId);
    if (!station) return false;

    if (ambiguousSequence === PANEL_LINE_GENERAL_VALUE) {
        return station.sequence_order >= 1 && station.sequence_order <= 5; // W stations
    } else {
        const numericAmbiguousSeq = parseInt(ambiguousSequence, 10);
        if (isNaN(numericAmbiguousSeq)) return false;
        return station.sequence_order === numericAmbiguousSeq;
    }
};


const StationPage = ({ user, activeStationSequenceOrder, allStations, isLoadingAllStations, allStationsError }) => {
    const [showSpecificStationModal, setShowSpecificStationModal] = useState(false);
    const [currentSpecificStationId, setCurrentSpecificStationId] = useState(null);

    // State for station overview data (module and tasks)
    const [moduleData, setModuleData] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [isLoadingStationData, setIsLoadingStationData] = useState(false);
    const [stationDataError, setStationDataError] = useState('');


    useEffect(() => {
        if (!user || isLoadingAllStations || !allStations || allStations.length === 0) {
            // If stations are loading or not available, or no user, don't do anything yet.
            // If activeStationSequenceOrder is null/undefined (not configured), also wait.
            if (!activeStationSequenceOrder && user) {
                 // If user is logged in but no station context is set at all,
                 // this page might show a message or redirect to context selection.
                 // For now, we assume activeStationSequenceOrder will be set.
            }
            return;
        }

        const specificIdFromStorage = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
        setCurrentSpecificStationId(specificIdFromStorage);

        const parsedSequenceOrder = typeof activeStationSequenceOrder === 'string' && activeStationSequenceOrder !== PANEL_LINE_GENERAL_VALUE
            ? parseInt(activeStationSequenceOrder, 10)
            : activeStationSequenceOrder;

        const isAmbiguous =
            parsedSequenceOrder === PANEL_LINE_GENERAL_VALUE ||
            (typeof parsedSequenceOrder === 'number' && parsedSequenceOrder >= 7 && parsedSequenceOrder <= 12);

        if (isAmbiguous) {
            const isValid = checkSpecificIdValidity(specificIdFromStorage, parsedSequenceOrder, allStations);
            if (!isValid) {
                setShowSpecificStationModal(true);
            } else {
                setShowSpecificStationModal(false);
            }
        } else {
            // Not ambiguous, clear any lingering specific ID and don't show modal
            setShowSpecificStationModal(false);
            if (specificIdFromStorage) {
                localStorage.removeItem(SELECTED_SPECIFIC_STATION_ID_KEY);
                setCurrentSpecificStationId(null);
            }
        }
    }, [user, activeStationSequenceOrder, allStations, isLoadingAllStations]); // Removed currentSpecificStationId from deps as it's set inside

    // Effect to fetch module and task data when station ID and user are available
    useEffect(() => {
        if (currentSpecificStationId && user && user.specialty_id !== undefined) { // Ensure specialty_id is available
            const fetchStationData = async () => {
                setIsLoadingStationData(true);
                setStationDataError('');
                setModuleData(null);
                setTasks([]);
                try {
                    // console.log("Fetching station data for:", currentSpecificStationId, "Specialty:", user.specialty_id);
                    const data = await getStationOverviewData(currentSpecificStationId, user.specialty_id);
                    setModuleData(data.module);
                    setTasks(data.tasks || []); // Ensure tasks is an array
                } catch (error) {
                    console.error("Error fetching station data:", error);
                    setStationDataError(error.message || 'Error al cargar datos de la estación.');
                } finally {
                    setIsLoadingStationData(false);
                }
            };
            fetchStationData();
        } else {
            // Clear data if station or user/specialty is not set
            setModuleData(null);
            setTasks([]);
        }
    }, [currentSpecificStationId, user]); // user dependency includes user.specialty_id

    const handleSaveSpecificStation = (specificStationId) => {
        localStorage.setItem(SELECTED_SPECIFIC_STATION_ID_KEY, specificStationId);
        setCurrentSpecificStationId(specificStationId);
        setShowSpecificStationModal(false);
        // Data fetching will be triggered by the useEffect watching currentSpecificStationId
    };

    const displayStationName = useMemo(() => {
        if (isLoadingAllStations) return "Cargando info de estación...";
        if (allStationsError) return `Error de estación: ${allStationsError}`;
        if (!activeStationSequenceOrder && !currentSpecificStationId) return "Estación No Configurada";

        if (currentSpecificStationId && allStations && allStations.length > 0) {
            const specificStation = allStations.find(s => s.station_id === currentSpecificStationId);
            if (specificStation) {
                // Check if this specific station is still valid for the current ambiguousSequenceOrder
                // This is important if ambiguousSequenceOrder changed but specificIdFromStorage was stale
                const isValidForCurrentContext = checkSpecificIdValidity(currentSpecificStationId, activeStationSequenceOrder, allStations);
                if (isValidForCurrentContext) {
                    return `${specificStation.name} (${specificStation.station_id})`;
                }
                // If not valid, the modal should be showing, or will show soon.
                // Fall through to general name or "awaiting selection"
            }
        }
        
        if (showSpecificStationModal) {
            return "Esperando selección de estación específica...";
        }

        if (activeStationSequenceOrder === PANEL_LINE_GENERAL_VALUE) {
            return PANEL_LINE_GENERAL_LABEL;
        }

        if (allStations && allStations.length > 0) {
            const sequenceMap = new Map();
            allStations.forEach(station => {
                if (!sequenceMap.has(station.sequence_order)) {
                    let displayName = station.name;
                    if (station.sequence_order >= 7) {
                        const assemblyMatch = station.name.match(/Línea de Ensamblaje [A-C]: (Estación \d+)/);
                        if (assemblyMatch && assemblyMatch[1]) {
                            displayName = assemblyMatch[1];
                        } else {
                            displayName = `Estación de Secuencia ${station.sequence_order}`;
                        }
                    }
                    sequenceMap.set(station.sequence_order, {
                        value: station.sequence_order,
                        label: `${displayName} (Secuencia ${station.sequence_order})`,
                    });
                }
            });
            const foundOption = sequenceMap.get(parseInt(activeStationSequenceOrder, 10));
            if (foundOption) return foundOption.label;
        }
        
        return activeStationSequenceOrder ? `Contexto: ${activeStationSequenceOrder}` : "Estación No Configurada";

    }, [activeStationSequenceOrder, currentSpecificStationId, allStations, isLoadingAllStations, allStationsError, showSpecificStationModal]);

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
                    ambiguousSequenceOrder={activeStationSequenceOrder}
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

            {!showSpecificStationModal && currentSpecificStationId ? (
                <div>
                    {isLoadingStationData && <p>Cargando datos del módulo y tareas...</p>}
                    {stationDataError && <p style={{ color: 'red' }}>{stationDataError}</p>}
                    
                    {moduleData && (
                        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                            <h3>Módulo Actual</h3>
                            <p><strong>Proyecto:</strong> {moduleData.project_name}</p>
                            <p><strong>Tipo de Casa:</strong> {moduleData.house_type_name} {moduleData.tipologia_name ? `(${moduleData.tipologia_name})` : ''}</p>
                            <p><strong>Identificador Casa:</strong> {moduleData.house_identifier}</p>
                            <p><strong>Módulo:</strong> {moduleData.module_sequence_in_house} de {moduleData.number_of_modules}</p>
                            <p><strong>Secuencia Planificada:</strong> {moduleData.planned_sequence}</p>
                            <p><strong>Estado Módulo:</strong> {moduleData.module_status}</p>
                        </div>
                    )}
                    {!moduleData && !isLoadingStationData && !stationDataError && (
                        <p style={{ marginTop: '20px' }}>No hay módulo asignado a esta estación actualmente o no se encontró información del módulo.</p>
                    )}

                    {tasks.length > 0 && (
                        <div style={{ marginTop: '30px' }}>
                            <h3>Tareas Pendientes/En Progreso</h3>
                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                                {tasks.map(task => (
                                    <li key={task.task_definition_id} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px', borderRadius: '5px' }}>
                                        <h4>{task.task_name}</h4>
                                        <p>{task.task_description}</p>
                                        <p><strong>Estado:</strong> {task.task_status}</p>
                                        {/* Add buttons for Start/Complete task later */}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {!isLoadingStationData && !stationDataError && moduleData && tasks.length === 0 && (
                         <p style={{ marginTop: '20px' }}>No hay tareas disponibles para este módulo en esta estación para su especialidad, o todas las tareas están completas.</p>
                    )}
                </div>
            ) : (
                 !currentSpecificStationId && !showSpecificStationModal && <p>Configurando estación...</p>
            )}
             {showSpecificStationModal && (
                <p>Por favor, seleccione su estación específica para continuar.</p>
            )}
        </div>
    );
};

export default StationPage;
