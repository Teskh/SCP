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
    cursor: 'pointer', // Indicate items are clickable
    // Add styles for when dragging
};

const selectedListItemStyle = {
    backgroundColor: '#d6eaff', // A distinct background for selected items
    borderLeft: '3px solid #007bff', // Add a visual indicator on the left
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
function SortableItem({ id, item, isFirstInProjectGroup, isSelected, onClick }) { // Added isSelected and onClick props
    const {
        attributes,
        listeners, // These are for drag-and-drop
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...upcomingItemStyle, // Base style
        ...(isSelected && !isDragging ? selectedListItemStyle : {}), // Apply selected style if selected and not dragging
        ...(isDragging ? draggingListItemStyle : {}), // Apply dragging style (overrides selected style visually during drag)
        // Add project grouping visual cues using the prop
        borderTop: isFirstInProjectGroup ? '2px solid #ccc' : (isSelected ? selectedListItemStyle.border : upcomingItemStyle.border), // Keep border consistent
        marginTop: isFirstInProjectGroup ? '10px' : upcomingItemStyle.marginBottom,
        zIndex: isDragging ? 1 : 'auto',
        position: 'relative',
    };

    // Display text generation remains the same
    const displayText = `<strong>#${item.planned_sequence}:</strong> [${item.project_name}] ${item.house_identifier} (Módulo ${item.module_sequence_in_house}/${item.number_of_modules}) - Tipo: ${item.house_type_name} - Línea: ${item.planned_assembly_line} - Inicio: ${item.planned_start_datetime} (${item.status})`;

    // Combine drag listeners and click handler
    const combinedListeners = {
        ...listeners, // Spread the drag listeners from useSortable
        onClick: (e) => onClick(e, id), // Add the onClick handler passed from parent
    };

    return (
        // Apply combined listeners and attributes to the main div
        <div ref={setNodeRef} style={style} {...attributes} {...combinedListeners}>
            {/* Drag handle could go here if needed, but listeners are on the whole item */}
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
    const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // State for selected item IDs
    const [lastClickedItemId, setLastClickedItemId] = useState(null); // State for shift-click logic
    const [draggedItemIds, setDraggedItemIds] = useState(null); // State to hold IDs being dragged (single or group)

    const fetchData = useCallback(async () => {
        // Preserve selection if items still exist after fetch? For now, clear on fetch.
        // If preservation is needed, logic would compare old/new items.
        setSelectedItemIds(new Set());
        setLastClickedItemId(null);
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

    const handleDragStart = useCallback((event) => {
        const { active } = event;
        // Check if the dragged item is part of the current selection
        if (selectedItemIds.has(active.id)) {
            // If yes, we are dragging the whole selection
            setDraggedItemIds(selectedItemIds);
        } else {
            // If no, we are dragging a single, unselected item
            setDraggedItemIds(new Set([active.id]));
            // Optional: Clear selection when dragging an unselected item?
            // setSelectedItemIds(new Set());
            // setLastClickedItemId(null);
        }
    }, [selectedItemIds]);

    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;

        // Ensure draggedItemIds is set (should be by handleDragStart)
        if (!draggedItemIds) {
            console.warn("Drag end called without draggedItemIds being set.");
            return;
        }

        // Reset dragged items state regardless of outcome
        setDraggedItemIds(null);

        if (over && active.id !== over.id) {
            const originalItems = [...upcomingItems]; // Store original order for potential revert
            let reorderedItems = originalItems;

            // Check if we dragged a group (more than one item)
            const isGroupDrag = draggedItemIds.size > 1;

            if (isGroupDrag) {
                // --- Group Drag Logic ---
                // Ensure 'over.id' is not part of the dragged group itself
                if (draggedItemIds.has(over.id)) {
                    console.log("Cannot drop group onto itself. No change.");
                    return; // Prevent dropping group onto one of its own items
                }

                // 1. Get the items being dragged, preserving their relative order
                const groupBeingDragged = originalItems.filter(item => draggedItemIds.has(item.plan_id));

                // 2. Create a list of items *not* being dragged
                const itemsWithoutGroup = originalItems.filter(item => !draggedItemIds.has(item.plan_id));

                // 3. Find the index where the 'over' item is in the list *without* the group
                const newIndexInFilteredList = itemsWithoutGroup.findIndex(item => item.plan_id === over.id);

                if (newIndexInFilteredList === -1) {
                    console.error("Could not find the 'over' item index in the filtered list.");
                    return; // Should not happen if over.id is valid and not in the group
                }

                // 4. Insert the dragged group into the filtered list at the target index
                // Adjust index based on whether the original position of the group was before or after the target
                 const originalIndexOfFirstDragged = originalItems.findIndex(item => item.plan_id === groupBeingDragged[0].plan_id);
                 const originalIndexOfOver = originalItems.findIndex(item => item.plan_id === over.id);

                 let insertionIndex = newIndexInFilteredList;
                 // If the item we are dropping over was originally *after* the group,
                 // its index in the filtered list needs adjustment when inserting the group.
                 if (originalIndexOfOver > originalIndexOfFirstDragged) {
                     // No index adjustment needed in splice if dropping after
                 } else {
                     // If dropping before, the splice index is correct as is.
                 }
                 // Correction: Find the index of 'over' in the filtered list.
                 // To insert *after* the 'over' item, we splice at index + 1.
                 insertionIndex = newIndexInFilteredList + 1; // Reassign the existing variable

                reorderedItems = [
                    ...itemsWithoutGroup.slice(0, insertionIndex), // Items up to and including the 'over' item
                    ...groupBeingDragged,                          // The dragged group
                    ...itemsWithoutGroup.slice(insertionIndex)     // Items after the 'over' item
                ];

            } else {
                // --- Single Item Drag Logic (Existing) ---
                const oldIndex = originalItems.findIndex((item) => item.plan_id === active.id);
                const newIndex = originalItems.findIndex((item) => item.plan_id === over.id);

                if (oldIndex === -1 || newIndex === -1) {
                    console.error("Could not find dragged item indices for single drag.");
                    return;
                }
                reorderedItems = arrayMove(originalItems, oldIndex, newIndex);
            }

            // --- Apply Changes (Optimistic Update & Backend Call) ---
            setUpcomingItems(reorderedItems); // Update local state immediately

            const orderedPlanIds = reorderedItems.map(item => item.plan_id);

            try {
                setIsLoading(true);
                setError('');
                await adminService.reorderProductionPlan(orderedPlanIds);
                setLastUpdated(new Date());
                // Optional: Clear selection after successful drag?
                // setSelectedItemIds(new Set());
                // setLastClickedItemId(null);
            } catch (err) {
                setError(`Error reordering plan: ${err.message}. Reverting local changes.`);
                console.error("Reorder error:", err);
                setUpcomingItems(originalItems); // Revert optimistic update
            } finally {
                setIsLoading(false);
            }
        }
    }, [upcomingItems, fetchData, draggedItemIds]); // Add draggedItemIds dependency

     const handleDragCancel = useCallback(() => {
        // Reset dragged items state if drag is cancelled
        setDraggedItemIds(null);
    }, []);
    // --- End dnd-kit Setup ---

    // --- Selection Logic ---
    const handleItemClick = useCallback((event, clickedItemId) => {
        event.stopPropagation(); // Prevent click from bubbling to the deselect handler

        const isShiftPressed = event.nativeEvent.shiftKey; // Check if Shift key was held

        setSelectedItemIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);

            if (isShiftPressed && lastClickedItemId && lastClickedItemId !== clickedItemId) {
                // Shift + Click: Select range
                const itemsInOrder = sortedProjectIds.flatMap(pid => groupedUpcomingItems[pid]?.items || []);
                const lastClickedIndex = itemsInOrder.findIndex(item => item.plan_id === lastClickedItemId);
                const currentClickedIndex = itemsInOrder.findIndex(item => item.plan_id === clickedItemId);

                if (lastClickedIndex !== -1 && currentClickedIndex !== -1) {
                    const start = Math.min(lastClickedIndex, currentClickedIndex);
                    const end = Math.max(lastClickedIndex, currentClickedIndex);
                    // Clear previous selection before applying range? Or add to it? Let's clear for simplicity.
                    // newSelectedIds.clear(); // Uncomment to clear previous selection first
                    for (let i = start; i <= end; i++) {
                        if (itemsInOrder[i]) {
                            newSelectedIds.add(itemsInOrder[i].plan_id);
                        }
                    }
                } else {
                    // Fallback if indices not found (shouldn't happen): just toggle the clicked item
                    if (newSelectedIds.has(clickedItemId)) {
                        newSelectedIds.delete(clickedItemId);
                    } else {
                        newSelectedIds.add(clickedItemId);
                    }
                }
            } else {
                // Normal Click (or first click in a shift-select sequence)
                if (newSelectedIds.has(clickedItemId)) {
                    newSelectedIds.delete(clickedItemId);
                } else {
                    newSelectedIds.add(clickedItemId);
                }
            }
            return newSelectedIds;
        });

        // Update last clicked item ID *unless* shift was pressed (keep the anchor)
        if (!isShiftPressed) {
            setLastClickedItemId(clickedItemId);
        }

    }, [lastClickedItemId, sortedProjectIds, groupedUpcomingItems]); // Dependencies for selection logic

    const handleDeselectAll = (event) => {
        // Check if the click target is NOT within a sortable item or the project header
        // This is a simple check; more robust might involve checking class names or data attributes
        if (!event.target.closest('[role="button"]')) { // Assuming SortableItem's div gets role="button" via attributes
             // Check if the click is not on a project header either
             const projectHeader = event.target.closest('[data-project-header]');
             if (!projectHeader) {
                setSelectedItemIds(new Set());
                setLastClickedItemId(null);
             }
        }
    };
    // --- End Selection Logic ---


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
        // Add onClick for deselection to the main container
        <div style={styles.container} onClick={handleDeselectAll}>
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
                    onDragStart={handleDragStart} // Add handler
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel} // Add handler
                >
                    <SortableContext
                        items={upcomingItems.map(item => item.plan_id)} // Pass array of IDs
                        strategy={verticalListSortingStrategy}
                    >
                        <div style={upcomingListStyle}>
                            {upcomingItems.length > 0 ? (
                                sortedProjectIds.map(projectId => {
                                    const group = groupedUpcomingItems[projectId];
                                    const isCollapsed = collapsedProjects[projectId];
                                    const firstItemIdInGroup = group.items[0]?.plan_id; // Needed for SortableItem check

                                    return (
                                        <div key={projectId} style={{ marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <div
                                                style={{
                                                    padding: '8px 12px',
                                                    backgroundColor: '#f0f0f0',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    borderBottom: isCollapsed ? 'none' : '1px solid #ddd',
                                                    fontWeight: 'bold',
                                                }}
                                                onClick={(e) => { e.stopPropagation(); toggleProjectCollapse(projectId); }} // Stop propagation
                                                data-project-header="true" // Add attribute for deselection check
                                            >
                                                <span>{group.projectName} ({group.items.length} módulos)</span>
                                                <span>{isCollapsed ? '▼ Expandir' : '▲ Contraer'}</span>
                                            </div>
                                            {!isCollapsed && (
                                                <div style={{ padding: '5px' }}>
                                                    {group.items.map((item, index) => {
                                                        // Determine if this item starts a new project group visually (always true for the first item in the rendered group)
                                                        const isFirstInDisplayedGroup = index === 0;
                                                        return (
                                                            <SortableItem
                                                                key={item.plan_id}
                                                                id={item.plan_id}
                                                                item={item}
                                                                isFirstInProjectGroup={item.plan_id === firstItemIdInGroup}
                                                                isSelected={selectedItemIds.has(item.plan_id)} // Pass selection state
                                                                onClick={handleItemClick} // Pass click handler
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
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
