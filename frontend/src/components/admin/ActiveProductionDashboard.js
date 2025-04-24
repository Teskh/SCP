import React, { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities'; // For transform/transition styles
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
    minHeight: '120px', // Ensure line container has height even if empty
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
    userSelect: 'none', // Prevent text selection during drag
    transition: 'background-color 0.2s ease', // Smooth background transition
    // Add styles for when dragging
};

const draggingListItemStyle = {
    backgroundColor: '#e6f7ff', // Light blue background when dragging
};

const dragHandleStyle = { // Optional: Style for a dedicated drag handle
    display: 'inline-block',
    marginRight: '10px',
    cursor: 'grab',
    color: '#aaa',
};

// --- Sortable Item Component (for dnd-kit) ---
// Moved outside ActiveProductionDashboard for correct component definition scope
function SortableItem({ id, item, isFirstInProjectGroup }) { // Added prop for visual grouping
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...upcomingItemStyle, // Base style
        ...(isDragging ? draggingListItemStyle : {}), // Apply dragging style
        // Add project grouping visual cues using the prop
        borderTop: isFirstInProjectGroup ? '2px solid #ccc' : upcomingItemStyle.border,
        marginTop: isFirstInProjectGroup ? '10px' : upcomingItemStyle.marginBottom,
        zIndex: isDragging ? 1 : 'auto',
        position: 'relative',
    };

    // Display text generation remains the same
    const displayText = `<strong>#${item.planned_sequence}:</strong> [${item.project_name}] ${item.house_identifier} (Módulo ${item.module_sequence_in_house}/${item.number_of_modules}) - Tipo: ${item.house_type_name} - Línea: ${item.planned_assembly_line} - Inicio: ${item.planned_start_datetime} (${item.status})`;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <span dangerouslySetInnerHTML={{ __html: displayText }} />
        </div>
    );
}
// --- End Sortable Item Component ---


function ActiveProductionDashboard() {
    const [stationStatus, setStationStatus] = useState([]);
    const [upcomingItems, setUpcomingItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [collapsedProjects, setCollapsedProjects] = useState({}); // State for collapsed projects { projectId: true/false }

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const statusData = await adminService.getProductionStatus(); // Fetch status and ALL upcoming items
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

    // --- Helper Functions (defined within component scope) ---
    // Group upcoming items by project ID for display purposes
    const groupItemsByProject = (items) => {
       return items.reduce((acc, item) => {
            const projectId = item.project_id;
            if (!acc[projectId]) {
                acc[projectId] = {
                    projectName: item.project_name,
                    items: []
                };
            }
            acc[projectId].items.push(item);
            return acc;
        }, {});
    };

    // Sort projects based on the sequence of their first item
    const getSortedProjectIds = (groupedItems) => {
        return Object.keys(groupedItems).sort((a, b) => {
            const firstItemSeqA = groupedItems[a].items[0]?.planned_sequence || 0;
            const firstItemSeqB = groupedItems[b].items[0]?.planned_sequence || 0;
            // If sequences are the same, maintain stable sort by project ID
            if (firstItemSeqA === firstItemSeqB) {
                return parseInt(a) - parseInt(b);
            }
            return firstItemSeqA - firstItemSeqB;
        });
    };

    // Memoize grouped items and sorted IDs to avoid recalculation on every render
    const groupedUpcomingItems = React.useMemo(() => groupItemsByProject(upcomingItems), [upcomingItems]);
    const sortedProjectIds = React.useMemo(() => getSortedProjectIds(groupedUpcomingItems), [groupedUpcomingItems]);


    useEffect(() => {
        fetchData();
        // Optional: Set up auto-refresh interval
        const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [fetchData]);

    const toggleProjectCollapse = (projectId) => {
        setCollapsedProjects(prev => ({
            ...prev,
            [projectId]: !prev[projectId]
        }));
    };

    // --- dnd-kit Setup ---
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = upcomingItems.findIndex((item) => item.plan_id === active.id);
            const newIndex = upcomingItems.findIndex((item) => item.plan_id === over.id);

            if (oldIndex === -1 || newIndex === -1) {
                console.error("Could not find dragged item indices");
                return; // Should not happen if IDs are correct
            }

            // Optimistically update the UI using arrayMove
            const reorderedItems = arrayMove(upcomingItems, oldIndex, newIndex);
            setUpcomingItems(reorderedItems); // Update local state immediately

            // Prepare the list of IDs in the new order
            const orderedPlanIds = reorderedItems.map(item => item.plan_id);

            // Call the backend to persist the new order
            const originalItems = [...upcomingItems]; // Store original order for potential revert
            try {
                setIsLoading(true);
                setError('');
                await adminService.reorderProductionPlan(orderedPlanIds);
                setLastUpdated(new Date());
            } catch (err) {
                setError(`Error reordering plan: ${err.message}. Reverting local changes.`);
                console.error("Reorder error:", err);
                // Revert the optimistic update on error by setting state back
                setUpcomingItems(originalItems);
                // Optionally refetch to be absolutely sure: await fetchData();
            } finally {
                setIsLoading(false);
            }
        }
    }, [upcomingItems, fetchData]); // Include fetchData if using it for revert
    // --- End dnd-kit Setup ---


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

            {/* Upcoming Items - Sortable List using dnd-kit */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={styles.header}>Plan de Producción Pendiente ({upcomingItems.length} items)</h3>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={upcomingItems.map(item => item.plan_id)} // Pass array of IDs
                        strategy={verticalListSortingStrategy}
                    >
                        <div style={upcomingListStyle}> {/* Use the ul/div styling */}
                            {upcomingItems.length > 0 ? (
                                upcomingItems.map((item, index) => {
                                    // Determine if this item starts a new project group visually
                                    const isFirstInProjectGroup = index === 0 || upcomingItems[index - 1].project_id !== item.project_id;
                                    return (
                                        <SortableItem
                                            key={item.plan_id}
                                            id={item.plan_id}
                                            item={item}
                                            isFirstInProjectGroup={isFirstInProjectGroup} // Pass prop
                                        />
                                    );
                                }
                                ) 
                            ) : (
                                <p>No hay elementos planeados o programados en el plan de producción.</p>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>

            </div>
        </div>
    );
}

export default ActiveProductionDashboard;
