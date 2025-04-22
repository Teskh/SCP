import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';
import styles from './AdminComponentStyles'; // Assuming shared styles

// Define station layout structure (can be enhanced)
const stationLayout = {
    'W': ['W1', 'W2', 'W3', 'W4', 'W5'],
    'M': ['M1'],
    'A': ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    'B': ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
    'C': ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
};

const lineStyles = {
    display: 'flex',
    flexDirection: 'row', // Default for W, M
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '1px solid #eee',
    overflowX: 'auto', // Allow horizontal scroll if needed
};

const assemblyLinesContainer = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between', // Space out lines A, B, C
};

const stationBoxStyle = {
    border: '1px solid #ccc',
    padding: '10px 15px', // Increased padding
    margin: '5px',
    minWidth: '150px', // Ensure minimum width
    maxWidth: '250px', // Max width before text wraps aggressively
    minHeight: '100px', // Ensure minimum height
    borderRadius: '4px',
    backgroundColor: '#f9f9f9',
    textAlign: 'center', // Center station ID
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between', // Space out title and content
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    fontSize: '0.9em', // Slightly smaller font for content
};

const stationTitleStyle = {
    fontWeight: 'bold',
    marginBottom: '8px', // Space below title
    fontSize: '1em', // Reset font size for title
    color: '#333',
};

const moduleInfoStyle = {
    fontSize: '0.85em', // Smaller font for module details
    color: '#555',
    wordWrap: 'break-word', // Allow long identifiers to wrap
};

const emptyStationStyle = {
    color: '#aaa',
    fontStyle: 'italic',
};

const upcomingListStyle = {
    listStyle: 'none',
    padding: 0,
};

const upcomingItemStyle = {
    border: '1px solid #eee',
    padding: '8px',
    marginBottom: '5px',
    borderRadius: '3px',
    backgroundColor: '#fff',
    fontSize: '0.9em',
};


function ActiveProductionDashboard() {
    const [stationStatus, setStationStatus] = useState([]);
    const [upcomingItems, setUpcomingItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const statusData = await adminService.getProductionStatus(5); // Fetch status and next 5 items
            // Process station data into a map for easy lookup
            const statusMap = statusData.station_status.reduce((acc, station) => {
                acc[station.station_id] = station;
                return acc;
            }, {});
            setStationStatus(statusMap);
            setUpcomingItems(statusData.upcoming_items);
            setLastUpdated(new Date());
        } catch (err) {
            setError(`Error fetching production status: ${err.message}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Optional: Set up auto-refresh interval
        const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [fetchData]);

    const renderStation = (stationId) => {
        const station = stationStatus[stationId];
        if (!station) return <div style={stationBoxStyle}>Error: Station {stationId} not found</div>;

        const modulePresent = station.module_id;

        return (
            <div key={stationId} style={stationBoxStyle}>
                <div style={stationTitleStyle}>{station.station_name} ({stationId})</div>
                {modulePresent ? (
                    <div style={moduleInfoStyle}>
                        <div><strong>ID Casa:</strong> {station.house_identifier || 'N/A'}</div>
                        <div><strong>Tipo:</strong> {station.house_type_name}</div>
                        <div><strong>Módulo:</strong> {station.module_sequence_in_house}/{station.number_of_modules}</div>
                        <div><strong>Proyecto:</strong> {station.project_name}</div>
                        <div>(ID Mod: {station.module_id})</div>
                    </div>
                ) : (
                    <div style={{...moduleInfoStyle, ...emptyStationStyle}}>(Vacío)</div>
                )}
            </div>
        );
    };

    const renderLine = (lineKey) => (
        <div style={lineStyles}>
            {stationLayout[lineKey].map(stationId => renderStation(stationId))}
        </div>
    );

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Estado Actual de Producción</h2>

            {error && <p style={styles.error}>{error}</p>}
            {isLoading && <p>Cargando...</p>}

            <div style={{ marginBottom: '10px', fontSize: '0.8em', color: '#666' }}>
                Última actualización: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'N/A'}
                <button onClick={fetchData} disabled={isLoading} style={{ marginLeft: '10px', padding: '2px 5px', fontSize: '0.9em' }}>
                    Refrescar
                </button>
            </div>

            {/* Panel Line (W) */}
            <h3>Línea de Paneles (W)</h3>
            {renderLine('W')}

            {/* Magazine (M) */}
            <h3>Magazine (M)</h3>
            {renderLine('M')}

            {/* Assembly Lines (A, B, C) */}
            <h3>Líneas de Ensamblaje</h3>
            <div style={assemblyLinesContainer}>
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <h4>Línea A</h4>
                    {stationLayout['A'].map(stationId => renderStation(stationId))}
                </div>
                <div style={{ flex: 1, marginRight: '10px' }}>
                    <h4>Línea B</h4>
                    {stationLayout['B'].map(stationId => renderStation(stationId))}
                </div>
                <div style={{ flex: 1 }}>
                    <h4>Línea C</h4>
                    {stationLayout['C'].map(stationId => renderStation(stationId))}
                </div>
            </div>

             {/* Upcoming Items */}
             <div style={{ marginTop: '30px' }}>
                <h3 style={styles.header}>Próximos en Plan ({upcomingItems.length})</h3>
                {upcomingItems.length > 0 ? (
                    <ul style={upcomingListStyle}>
                        {upcomingItems.map(item => (
                            <li key={item.plan_id} style={upcomingItemStyle}>
                                <strong>#{item.planned_sequence}:</strong> {item.house_identifier} ({item.house_type_name}) - Proyecto: {item.project_name} - Línea: {item.planned_assembly_line} - Inicio: {item.planned_start_datetime} ({item.status})
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No hay elementos planeados próximos.</p>
                )}
            </div>
        </div>
    );
}

export default ActiveProductionDashboard;
