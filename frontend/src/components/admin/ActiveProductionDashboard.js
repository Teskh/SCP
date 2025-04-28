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
import SetTipologiaModal from './SetTipologiaModal';
import SetDateTimeModal from './SetDateTimeModal'; // Import the new modal
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
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)', // Add a shadow for a "lifted" effect
    opacity: 0.9, // Slightly reduce opacity
    cursor: 'grabbing', // Change cursor during drag
    zIndex: 100, // Ensure dragged item is visually on top
};

const dragHandleStyle = { // Optional: Style for a dedicated drag handle
    display: 'inline-block',
    marginRight: '10px',
    cursor: 'grab',
    color: '#aaa',
};

// Style for the module sequence badge
const moduleBadgeStyle = {
    display: 'inline-block',
    padding: '2px 5px',
    borderRadius: '3px',
    backgroundColor: '#6c757d', // Bootstrap secondary color (grey)
    color: 'white',
    fontSize: '0.8em',
    fontWeight: 'bold',
    marginRight: '5px', // Add some space after the badge
    verticalAlign: 'middle', // Align badge nicely with text
};

// Style for the House Type badge
const houseTypeBadgeStyle = {
    display: 'inline-block',
    padding: '2px 5px',
    borderRadius: '3px',
    backgroundColor: '#007bff', // Bootstrap primary color (blue)
    color: 'white',
    fontSize: '0.8em',
    fontWeight: 'bold',
    marginRight: '5px', // Add some space after the badge
    verticalAlign: 'middle', // Align badge nicely with text
};


// --- Line Indicator Component ---
// Extracted for clarity and reusability
const LineIndicator = ({ line, isActive, isClickable, onClick }) => {
    const baseStyle = {
        display: 'inline-block',
        padding: '3px 6px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '0.8em',
        minWidth: '20px',
        textAlign: 'center',
        margin: '0 2px', // Add small horizontal margin between indicators
        border: '1px solid transparent', // Placeholder for border consistency
    };

    const activeStyle = {
        color: 'white',
        backgroundColor: line === 'A' ? '#dc3545' : line === 'B' ? '#28a745' : '#007bff', // Red, Green, Blue
    };

    const inactiveClickableStyle = {
        color: '#aaa',
        backgroundColor: '#f0f0f0',
        cursor: 'pointer',
        border: '1px solid #ccc',
        '&:hover': { // Note: Pseudo-classes need specific handling in React (e.g., state or styled-components)
            backgroundColor: '#e0e0e0',
        }
    };

    // Basic hover effect using inline style state (more advanced with libraries)
    const [isHovering, setIsHovering] = React.useState(false);

    const combinedStyle = {
        ...baseStyle,
        ...(isActive ? activeStyle : (isClickable ? inactiveClickableStyle : {})),
        ...(isClickable && !isActive && isHovering ? { backgroundColor: '#e0e0e0' } : {}) // Apply hover style
    };

    return (
        <div
            style={combinedStyle}
            onClick={isClickable && !isActive ? onClick : undefined} // Only trigger onClick if clickable and not active
            onMouseEnter={() => isClickable && !isActive && setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {line}
        </div>
    );
};

// --- Helper Function to get unique projects from items ---
const getUniqueProjects = (items) => {
    const projects = new Map();
    items.forEach(item => {
        if (!projects.has(item.project_id)) {
            projects.set(item.project_id, {
                id: item.project_id,
                name: item.project_name,
                // Collect all unique module sequences for this project from the items
                moduleSequences: new Set(items.filter(i => i.project_id === item.project_id).map(i => i.module_sequence_in_house))
            });
        }
    });
    // Convert map values to array and sort sequences numerically within each project
    return Array.from(projects.values()).map(proj => ({
        ...proj,
        moduleSequences: Array.from(proj.moduleSequences).sort((a, b) => a - b)
    })).sort((a, b) => a.name.localeCompare(b.name)); // Sort projects by name
};

// --- Helper Function to generate a random color suitable for text ---
const generateDeterministicColor = (projectId) => {
    // Use a prime number to distribute hues across the spectrum
    const prime = 1117; // A prime number
    const hue = (projectId * prime) % 360;
    const saturation = 70; // Keep saturation constant for consistency
    const lightness = 40; // Keep lightness constant for readability
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};


// --- Sortable Item Component (for dnd-kit) ---
// Moved outside ActiveProductionDashboard for correct component definition scope
function SortableItem({ id, item, isSelected, onClick, onChangeLine, showProjectSeparator, projectColor, disabled, formatPlannedDate, onHouseTypeBadgeClick, onDateTimeBadgeClick }) { // Added onDateTimeBadgeClick prop
    const {
        attributes,
        listeners: dndListeners, // Original dnd-kit listeners
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled // Pass the disabled prop to useSortable hook
    });
    // Extract the pointerDown handler for merging selection logic
    const { onPointerDown: dndOnPointerDown, ...listeners } = dndListeners;

    // Combine base, conditional, and dnd-kit styles for the draggable element
    const draggableElementStyle = {
        ...upcomingItemStyle, // Start with base item style
        ...(isDragging
            ? draggingListItemStyle // Apply dragging style if dragging
            : (isSelected ? selectedListItemStyle : {})), // Otherwise, apply selected style if selected
        transform: CSS.Transform.toString(transform), // Apply dnd-kit transform
        transition, // Apply dnd-kit transition
        // Add top border/margin if it's the start of a new project in the flat list
        borderTop: showProjectSeparator ? '2px solid #ccc' : (isSelected && !isDragging ? selectedListItemStyle.border : upcomingItemStyle.border),
        marginTop: showProjectSeparator ? '10px' : upcomingItemStyle.marginBottom,
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        flexGrow: 1,
        marginRight: '10px',
        position: 'relative', // Needed for zIndex from draggingListItemStyle
        // Ensure zIndex is applied correctly when dragging
        zIndex: isDragging ? draggingListItemStyle.zIndex : 'auto',
        outline: 'none', // Remove default browser focus outline
        cursor: disabled ? 'pointer' : (isDragging ? 'grabbing' : 'grab'), // Change cursor based on disabled/dragging state
    };

    // Style for the container holding the line indicators
    const lineIndicatorContainerStyle = {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: '100px', // Ensure enough space for indicators
    };

    // Apply drag listeners and onClick handler to the draggable element
    // onClick logic is now gated by Shift key inside handleItemClick
    return (
        // Outer container - NOT draggable, holds both parts
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: upcomingItemStyle.marginBottom }}>
            {/* Draggable Content - Apply styles, ref, attributes, listeners, and onClick */}
            <div
                ref={setNodeRef}
                style={draggableElementStyle}
                {...attributes}
                {...listeners} // Apply drag-kit listeners directly
                onPointerDown={(e) => {
                    // Single left-click with Shift selects item
                    if (e.nativeEvent.shiftKey && e.nativeEvent.button === 0) {
                        onClick(e, id);
                    }
                    // Then always invoke dnd-kit pointerDown for drag (if allowed)
                    if (dndOnPointerDown) {
                        dndOnPointerDown(e);
                    }
                }}
            >
                {/* Sequence Number - Placed inside draggable part */}
                <span style={{ fontWeight: 'bold', marginRight: '10px', color: '#666' }}>#{item.planned_sequence}:</span>
                {/* Main text content - Now using JSX with colored project name and module badge */}
                <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: projectColor, fontWeight: 'bold' }}>[{item.project_name}]</span>
                    {` ${item.house_identifier} `}
                    <span style={moduleBadgeStyle}>MD{item.module_sequence_in_house}</span>
                    {/* House Type Badge */}
                    <span
                        style={houseTypeBadgeStyle}
                        data-house-type-badge="true" // Keep data attribute for clarity/potential future use
                        onPointerDown={e => {
                            // Stop propagation immediately on pointer down to prevent drag sensor activation
                            e.stopPropagation();
                        }}
                        onClick={e => {
                            // No need to stop propagation here again, but keep for modal logic
                            // e.stopPropagation(); // Can be removed if onPointerDown handles it
                            onHouseTypeBadgeClick(item.house_type_id, item.plan_id);
                        }}
                    >
                        [{item.house_type_name}]
                        {item.tipologia_name && `[${item.tipologia_name}]`} {/* Use tipologia_name from item */}
                    </span>
                    {/* Make date clickable */}
                    <span
                        style={{ cursor: 'pointer', textDecoration: 'underline', marginLeft: '5px' }}
                        data-datetime-badge="true" // Add data attribute
                        onPointerDown={e => {
                            // Stop propagation immediately on pointer down to prevent drag sensor activation
                            e.stopPropagation();
                        }}
                        onClick={e => {
                            // Call the handler passed from the parent
                            onDateTimeBadgeClick(item.plan_id, item.planned_start_datetime);
                        }}
                    >
                        {formatPlannedDate(item.planned_start_datetime)}
                    </span>
                </span>
           </div>

           {/* Line Indicator Container - NOT draggable */}
            <div style={lineIndicatorContainerStyle}>
                <LineIndicator
                    line="A"
                    isActive={item.planned_assembly_line === 'A'}
                    isClickable={true}
                    onClick={() => onChangeLine(id, 'A')}
                />
                <LineIndicator
                    line="B"
                    isActive={item.planned_assembly_line === 'B'}
                    isClickable={true}
                    onClick={() => onChangeLine(id, 'B')}
                />
                <LineIndicator
                    line="C"
                    isActive={item.planned_assembly_line === 'C'}
                    isClickable={true}
                    onClick={() => onChangeLine(id, 'C')}
                />
            </div>
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
    // Removed collapsedProjects state
    const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // State for selected item IDs
    const [lastClickedItemId, setLastClickedItemId] = useState(null); // State for shift-click logic
    const [draggedItemIds, setDraggedItemIds] = useState(null); // State to hold IDs being dragged (single or group)
    const [isUpdatingLine, setIsUpdatingLine] = useState(false); // State to track line update API call
    const [projectColorMap, setProjectColorMap] = useState(new Map()); // State to store project colors
    const [isShiftKeyDown, setIsShiftKeyDown] = useState(false); // State to track Shift key globally
    // --- Set Tipologia Modal State & Handlers ---
    const [tipologiaModalOpen, setTipologiaModalOpen] = useState(false);
    const [tipologiaHouseTypeId, setTipologiaHouseTypeId] = useState(null);
    const [tipologiaHouseTypeName, setTipologiaHouseTypeName] = useState(''); // Store name for display
    const [tipologiaPlanIds, setTipologiaPlanIds] = useState([]);
    const [availableTipologias, setAvailableTipologias] = useState(null); // Store fetched tipologias
    const [isLoadingTipologias, setIsLoadingTipologias] = useState(false);
    const [currentTipologiaId, setCurrentTipologiaId] = useState(undefined); // State for pre-selecting in modal
    // --- Set DateTime Modal State & Handlers ---
    const [dateTimeModalOpen, setDateTimeModalOpen] = useState(false);
    const [dateTimePlanIds, setDateTimePlanIds] = useState([]);
    const [dateTimeCurrentValue, setDateTimeCurrentValue] = useState(null); // Store current datetime for pre-fill
    const [isSavingDateTime, setIsSavingDateTime] = useState(false); // Separate loading state for saving datetime


    const handleOpenTipologiaModal = async (houseTypeId, houseTypeName, planId) => {
        setIsLoadingTipologias(true);
        setTipologiaModalOpen(true);
        setTipologiaHouseTypeId(houseTypeId);
        setTipologiaHouseTypeName(houseTypeName);

        // Determine which plan IDs to affect
        const ids = (selectedItemIds.size > 0 && selectedItemIds.has(planId))
            ? Array.from(selectedItemIds)
            : [planId];
        setTipologiaPlanIds(ids);

        // Check if all selected items belong to the *same* houseTypeId
        let allSameHouseType = true;
        let firstTipologiaId = undefined;
        let commonTipologiaFound = true;

        if (ids.length > 0) {
            const firstItem = upcomingItems.find(item => item.plan_id === ids[0]);
            if (!firstItem || firstItem.house_type_id !== houseTypeId) {
                allSameHouseType = false; // Should not happen if logic is correct, but check
            } else {
                firstTipologiaId = firstItem.tipologia_id; // Initialize with the first item's tipologia
            }

            for (let i = 1; i < ids.length; i++) {
                const currentItem = upcomingItems.find(item => item.plan_id === ids[i]);
                if (!currentItem || currentItem.house_type_id !== houseTypeId) {
                    allSameHouseType = false;
                    break;
                }
                // Check if tipologia is the same as the first one
                if (currentItem.tipologia_id !== firstTipologiaId) {
                    commonTipologiaFound = false;
                    // Don't break here, continue checking house type consistency
                }
            }
        } else {
             allSameHouseType = false; // No items selected/passed
        }


        if (!allSameHouseType) {
            setError("Error: Los elementos seleccionados deben pertenecer al mismo Tipo de Casa para establecer la tipología.");
            handleCloseTipologiaModal(); // Close modal immediately
            return;
        }

        // Set current tipologia for pre-selection only if it's common among all selected items
        setCurrentTipologiaId(commonTipologiaFound ? firstTipologiaId : undefined);


        // Fetch available tipologias for this house type
        try {
            setError(''); // Clear previous errors
            const tipologiasData = await adminService.getHouseTypeTipologias(houseTypeId);
            setAvailableTipologias(tipologiasData || []); // Ensure it's an array
        } catch (err) {
            setError(`Error cargando tipologías: ${err.message}`);
            setAvailableTipologias([]); // Set empty on error
            console.error(err);
        } finally {
            setIsLoadingTipologias(false);
        }
    };

    const handleCloseTipologiaModal = () => {
        setTipologiaModalOpen(false);
        setTipologiaHouseTypeId(null);
        setTipologiaHouseTypeName('');
        setTipologiaPlanIds([]);
        setAvailableTipologias(null); // Clear fetched data
        setCurrentTipologiaId(undefined); // Clear current selection
        setError(''); // Clear modal-specific errors
    };

    // Handler for saving the tipologia from the modal
    const handleSetTipologia = async (planIdsToUpdate, newTipologiaId) => {
        // Optimistic UI update (optional, but good for responsiveness)
        const originalItems = [...upcomingItems];
        const updatedItemsOptimistic = originalItems.map(item => {
            if (planIdsToUpdate.includes(item.plan_id)) {
                // Find the name of the new tipologia (if not null)
                const newTipologia = availableTipologias?.find(t => t.tipologia_id === newTipologiaId);
                return {
                    ...item,
                    tipologia_id: newTipologiaId,
                    tipologia_name: newTipologia ? newTipologia.name : null // Update name locally
                };
            }
            return item;
        });
        setUpcomingItems(updatedItemsOptimistic);

        try {
            await adminService.setProductionPlanItemsTipologiaBulk(planIdsToUpdate, newTipologiaId);
            // Success! Data is already updated optimistically. Maybe show a success message briefly?
            setLastUpdated(new Date()); // Update timestamp
            // Optional: Refetch data to ensure consistency? Or trust optimistic update.
            // await fetchData(); // Uncomment to refetch after save
        } catch (err) {
            // Revert optimistic update on error
            setUpcomingItems(originalItems);
            // Re-throw the error so the modal can display it
            throw err;
        }
    };
    // --- End Tipologia Modal Handlers ---

    // --- Set DateTime Modal Handlers ---
    const handleOpenDateTimeModal = (planId, currentDateTime) => {
        // Determine which plan IDs to affect
        const ids = (selectedItemIds.size > 0 && selectedItemIds.has(planId))
            ? Array.from(selectedItemIds)
            : [planId];
        setDateTimePlanIds(ids);

        // Determine the datetime to pre-fill
        // If multiple items are selected, use the datetime of the first one in the current list order
        let dateTimeToPreFill = null;
        if (ids.length > 0) {
            // Find the item corresponding to the *first* ID in the selection list `ids`
            const firstItemId = ids[0];
            const firstItem = upcomingItems.find(item => item.plan_id === firstItemId);
            dateTimeToPreFill = firstItem ? firstItem.planned_start_datetime : null;
        }
        setDateTimeCurrentValue(dateTimeToPreFill);

        setDateTimeModalOpen(true);
        setError(''); // Clear general errors when opening modal
    };

    const handleCloseDateTimeModal = () => {
        setDateTimeModalOpen(false);
        setDateTimePlanIds([]);
        setDateTimeCurrentValue(null);
        setError(''); // Clear modal-specific errors
    };

    const handleSetDateTime = async (planIdsToUpdate, newDateTimeString) => {
        // Optimistic UI update
        const originalItems = [...upcomingItems];
        const updatedItemsOptimistic = originalItems.map(item => {
            if (planIdsToUpdate.includes(item.plan_id)) {
                return { ...item, planned_start_datetime: newDateTimeString };
            }
            return item;
        });
        // Sort optimistically based on the new date? Maybe not, backend reorder is separate.
        // Let's just update the date visually for now. Re-fetch or manual reorder might be needed.
        setUpcomingItems(updatedItemsOptimistic);
        setIsSavingDateTime(true); // Use dedicated saving state

        try {
            await adminService.setProductionPlanItemsDateTimeBulk(planIdsToUpdate, newDateTimeString);
            setLastUpdated(new Date());
            // Optional: Refetch data to get potentially re-ordered list if backend adjusts sequence based on time
            // await fetchData(); // Uncomment to refetch after save
        } catch (err) {
            // Revert optimistic update on error
            setUpcomingItems(originalItems);
            // Re-throw the error so the modal can display it
            throw err;
        } finally {
            setIsSavingDateTime(false);
        }
    };
    // --- End DateTime Modal Handlers ---


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

    // --- Derived State ---
    // Get unique project details from the flat upcomingItems list
    const uniqueProjects = React.useMemo(() => getUniqueProjects(upcomingItems), [upcomingItems]);

    // Effect to assign random colors to projects when uniqueProjects changes
    useEffect(() => {
        setProjectColorMap(prevMap => {
            const newMap = new Map(prevMap);
            let updated = false;
            uniqueProjects.forEach(project => {
                if (!newMap.has(project.id)) {
                    newMap.set(project.id, generateDeterministicColor(project.id)); // Use deterministic color
                    updated = true;
                }
            }
            );
            return updated ? newMap : prevMap; // Only update state if changes were made
        });
    }, [uniqueProjects]); // Dependency: uniqueProjects

    useEffect(() => {
        fetchData();
        // Optional: Set up auto-refresh interval
        const intervalId = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [fetchData]);

    // Removed toggleProjectCollapse function

    // --- dnd-kit Setup ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            // Prevent drag activation if Shift key is pressed, allowing Shift+Click for selection only
            activationConstraint: {
                // distance: 5, // Default is 0, uncomment/adjust if needed
                // delay: 100, // Default is 0 (PointerSensor), 250 (MouseSensor), uncomment/adjust if needed
                shouldActivate: (event) => {
                    // Check if Shift key is pressed
                    const isShiftPressed = event.nativeEvent && typeof event.nativeEvent.shiftKey !== 'undefined' && event.nativeEvent.shiftKey;
                    if (isShiftPressed) {
                        return false; // Don't activate drag if Shift is pressed
                    }

                    // Check if the event target is the house type badge or inside it
                    const targetElement = event.nativeEvent.target;
                    // Use closest to check if the click originated from the badge or its children
                    const houseTypeBadge = targetElement.closest('[data-house-type-badge="true"]');
                    const dateTimeBadge = targetElement.closest('[data-datetime-badge="true"]'); // Check for datetime badge

                    if (houseTypeBadge || dateTimeBadge) { // Prevent drag if clicking either badge
                        return false;
                    }

                    // Otherwise, allow drag activation
                    return true;
                }
            }
        }),
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
            // Update planned_sequence locally for immediate visual feedback
            const itemsWithUpdatedSequence = reorderedItems.map((item, index) => ({
                ...item,
                planned_sequence: index + 1, // Update sequence based on new position (1-based)
            }));

            setUpcomingItems(itemsWithUpdatedSequence); // Update local state immediately with new sequence numbers

            const orderedPlanIds = itemsWithUpdatedSequence.map(item => item.plan_id);

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
    }, [upcomingItems, draggedItemIds]); // Removed fetchData dependency to prevent loop, rely on manual refresh or interval

     const handleDragCancel = useCallback(() => {
        // Reset dragged items state if drag is cancelled
        setDraggedItemIds(null);
    }, []);
    // --- End dnd-kit Setup ---

    // --- Selection Logic ---
    const handleItemClick = useCallback((event, clickedItemId) => {
        event.stopPropagation(); // Prevent click from bubbling to the deselect handler

        const isShiftPressed = event.nativeEvent.shiftKey; // Check if Shift key was held

        // --- Only perform selection/deselection if Shift key is pressed ---
        if (!isShiftPressed) {
            // If Shift is not pressed, do nothing regarding selection.
            // This allows normal click-and-drag without affecting selection.
            return;
        }

        // --- Proceed with selection logic only if Shift is pressed ---
        setSelectedItemIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);

            // Check if it's a range selection (Shift + Click on a different item than the last anchor)
            if (lastClickedItemId && lastClickedItemId !== clickedItemId) {
                // Shift + Click: Select range using the flat upcomingItems list
                const itemsInOrder = upcomingItems; // Use the flat list directly
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
                // Shift + Click on a single item (or the first item in a potential range)
                // Toggles the selection state of the clicked item.
                if (newSelectedIds.has(clickedItemId)) {
                    newSelectedIds.delete(clickedItemId);
                } else {
                    newSelectedIds.add(clickedItemId);
                }
            }
            return newSelectedIds;
        });

        // Update the anchor point for future Shift+Click range selections
        setLastClickedItemId(clickedItemId);

    }, [lastClickedItemId, upcomingItems]); // Dependencies for selection logic

    const handleDeselectAll = (event) => {
        // Check if the click target is NOT within a sortable item OR the project header container
        if (!event.target.closest('[role="button"]') && !event.target.closest('[data-project-header-container]')) {
            setSelectedItemIds(new Set());
            setLastClickedItemId(null);
        }
    };
    // --- End Selection Logic ---

    // --- Line Change Logic ---
    const handleChangeAssemblyLine = useCallback(async (clickedPlanId, newLine) => {
        // Prevent changing line if already updating or dragging
        if (isUpdatingLine || draggedItemIds) return;

        const originalItems = [...upcomingItems];
        const itemsToUpdateIds = [];
        let isBulkUpdate = false;

        // Determine if this is a bulk update based on selection
        if (selectedItemIds.size > 1 && selectedItemIds.has(clickedPlanId)) {
            isBulkUpdate = true;
            selectedItemIds.forEach(id => itemsToUpdateIds.push(id));
        } else {
            // Single item update (or clicked item not in multi-selection)
            itemsToUpdateIds.push(clickedPlanId);
        }

        // Filter out items that already have the target line
        const actualIdsToUpdate = itemsToUpdateIds.filter(id => {
            const item = originalItems.find(i => i.plan_id === id);
            return item && item.planned_assembly_line !== newLine;
        });

        if (actualIdsToUpdate.length === 0) {
            console.log("No items need line change.");
            return; // All items already have the target line or no valid items found
        }

        // Optimistic UI Update for all items being changed
        const updatedItemsOptimistic = originalItems.map(item =>
            actualIdsToUpdate.includes(item.plan_id)
                ? { ...item, planned_assembly_line: newLine }
                : item
        );
        setUpcomingItems(updatedItemsOptimistic);
        setIsUpdatingLine(true);
        setError('');

        try {
            if (isBulkUpdate) {
                // Call Bulk API
                const response = await adminService.changeProductionPlanItemsLineBulk(actualIdsToUpdate, newLine);
                console.log(`Bulk line change response: ${response.message}`);
                // Optional: Refetch or update based on response if needed, but optimistic update is done
            } else {
                // Call Single API (only one ID in actualIdsToUpdate)
                const singlePlanId = actualIdsToUpdate[0];
                const updatedItem = await adminService.changeProductionPlanItemLine(singlePlanId, newLine);
                // Update local state with potentially more complete data from backend (if needed)
                // This might overwrite other optimistic updates if bulk was intended but only one needed changing.
                // Consider refetching after bulk OR trust optimistic update. Let's trust optimistic for now.
                // setUpcomingItems(prevItems => prevItems.map(item =>
                //     item.plan_id === singlePlanId ? updatedItem : item
                // ));
            }
            setLastUpdated(new Date());
        } catch (err) {
            const errorMsg = `Error changing line for item(s) ${actualIdsToUpdate.join(', ')}: ${err.message}. Reverting.`;
            setError(errorMsg);
            console.error("Line change error:", err);
            // Revert optimistic update on error
            setUpcomingItems(originalItems);
        } finally {
            setIsUpdatingLine(false);
        }
    }, [upcomingItems, isUpdatingLine, draggedItemIds, selectedItemIds]); // Added selectedItemIds dependency
    // --- End Line Change Logic ---

    // --- Select Module Sequence Logic ---
    const handleSelectModuleSequenceInProject = useCallback((event, projectId, targetSequence) => {
        event.stopPropagation(); // Prevent triggering other clicks

        // Filter the flat upcomingItems list
        const idsToSelect = upcomingItems
            .filter(item => item.project_id === projectId && item.module_sequence_in_house === targetSequence)
            .map(item => item.plan_id);

        if (idsToSelect.length > 0) {
            setSelectedItemIds(prevSelectedIds => {
                const newSelectedIds = new Set(prevSelectedIds);
                idsToSelect.forEach(id => newSelectedIds.add(id));
                return newSelectedIds;
            });
            // Optionally, update lastClickedItemId if needed for subsequent shift-clicks
            // setLastClickedItemId(idsToSelect[idsToSelect.length - 1]); // Select the last one as anchor? Or keep existing?
        }

    }, [upcomingItems]); // Dependency: flat upcomingItems list
    // --- End Select Module Sequence Logic ---

    // --- Date Formatting Helper ---
    const formatPlannedDate = (dateString) => {
        if (!dateString) return '🗓 --'; // Return placeholder if no date
        try {
            // Replace space with 'T' for better ISO 8601 compatibility if needed, though 'YYYY-MM-DD HH:MM:SS' usually works
            // const compatibleDateString = dateString.replace(' ', 'T');
            const date = new Date(dateString);

            // Check if the date object is valid
            if (isNaN(date.getTime())) {
                console.error("Invalid Date object created from:", dateString);
                return `🗓 ErrorFecha`; // Indicate invalid date
            }

            const currentYear = new Date().getFullYear();
            const year = date.getFullYear();
            // Use a specific locale for month name consistency
            const month = date.toLocaleString('es-ES', { month: 'long' });
            const day = date.getDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            // Capitalize the first letter of the month
            const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

            const yearString = year !== currentYear ? `${year} ` : ''; // Only show year if different from current

            return `🗓 ${yearString}${capitalizedMonth} ${day}, ${hours}:${minutes}`; // Adjusted format slightly
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return `🗓 Error`; // Fallback indicating an error occurred
        }
    };
    // --- End Date Formatting Helper ---

    const renderStation = (stationId) => {
        const station = stationStatus[stationId];
        // Add key to the error div
        if (!station) return <div key={`error-${stationId}`} style={stationBoxStyle}>Error: Station {stationId} not found</div>;

        const modulePresent = station.module_id;

        return (
            <div key={stationId} style={stationBoxStyle}>
                <div style={stationTitleStyle}>{station.station_name} ({stationId})</div>
                {modulePresent ? (
                    // Add key to the div when module is present
                    <div key={`${stationId}-content`} style={moduleInfoStyle}>
                        <div><strong>ID Casa:</strong> {station.house_identifier || 'N/A'}</div>
                        {/* Replaced "Tipo: ..." with House Type Badge */}
                        <div>
                            <strong>Tipo:</strong>
                            <span style={houseTypeBadgeStyle}>
                                [{station.house_type_name}]
                                {station.house_type_typology && `[${station.house_type_typology}]`} {/* Add typology if it exists */}
                            </span>
                        </div>
                        <div><strong>Módulo:</strong> <span style={moduleBadgeStyle}>MD{station.module_sequence_in_house}</span></div> {/* Removed (N total) */}
                        <div><strong>Proyecto:</strong> {station.project_name}</div>
                        <div>(ID Mod: {station.module_id})</div>
                    </div>
                ) : (
                    // Add key to the div when module is not present (empty)
                    <div key={`${stationId}-empty`} style={{...moduleInfoStyle, ...emptyStationStyle}}>(Vacío)</div>
                )}
            </div>
        );
    };

    // Add key prop directly to the returned div based on lineKey
    const renderLine = (lineKey) => (
        <div key={`line-${lineKey}`} style={lineStyles}>
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
                {/* Add unique keys to the direct children divs representing each line */}
                <div key="line-A-wrapper" style={{ flex: 1, marginRight: '10px' }}>
                    <h4>Línea A</h4>
                    {stationLayout['A'].map(stationId => renderStation(stationId))}
                </div>
                <div key="line-B-wrapper" style={{ flex: 1, marginRight: '10px' }}>
                    <h4>Línea B</h4>
                    {stationLayout['B'].map(stationId => renderStation(stationId))}
                </div>
                <div key="line-C-wrapper" style={{ flex: 1 }}>
                    <h4>Línea C</h4>
                    {stationLayout['C'].map(stationId => renderStation(stationId))}
                </div>
            </div>

            {/* Project Headers Section */}
            <div style={{ marginTop: '30px' }} data-project-header-container="true"> {/* Added data attribute */}
                <h3 style={styles.header}>Proyectos Pendientes</h3>
                {uniqueProjects.length > 0 ? (
                    uniqueProjects.map(project => (
                        <div key={project.id} style={{ marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#f8f8f8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span>{project.name}</span>
                                {project.moduleSequences.length > 0 && (
                                    <div style={styles.moduleSelectContainer}>
                                        <span style={styles.moduleSelectLabel}>Seleccionar:</span>
                                        {project.moduleSequences.map(sequence => (
                                            <button
                                                key={sequence}
                                                style={styles.moduleSelectButton}
                                                title={`Seleccionar todos los módulos #${sequence} en este proyecto`}
                                                onClick={(e) => handleSelectModuleSequenceInProject(e, project.id, sequence)}
                                            >
                                                [M{sequence}]
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No hay proyectos con elementos pendientes en el plan.</p>
                )}
            </div>

            {/* Upcoming Items - Single Sortable List using dnd-kit */}
            <div style={{ marginTop: '20px' }}>
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
                                upcomingItems.map((item, index) => {
                                    // Determine if this item starts a new project visually compared to the previous one
                                    const prevItem = index > 0 ? upcomingItems[index - 1] : null;
                                    const showProjectSeparator = !prevItem || prevItem.project_id !== item.project_id;

                                    return (
                                        <SortableItem
                                            key={item.plan_id}
                                            id={item.plan_id}
                                            item={item}
                                            isSelected={selectedItemIds.has(item.plan_id)} // Pass selection state
                                            onClick={handleItemClick} // Pass click handler for selection
                                            onChangeLine={handleChangeAssemblyLine} // Pass line change handler
                                            showProjectSeparator={showProjectSeparator} // Pass separator flag
                                            projectColor={projectColorMap.get(item.project_id) || '#000000'} // Get color from map, default black
                                            disabled={isShiftKeyDown} // Pass the disabled state
                                            formatPlannedDate={formatPlannedDate} // Pass the formatting function
                                           // Pass house type name as well
                                           onHouseTypeBadgeClick={() => handleOpenTipologiaModal(item.house_type_id, item.house_type_name, item.plan_id)}
                                           // Pass datetime click handler
                                           onDateTimeBadgeClick={handleOpenDateTimeModal}
                                       />
                                   );
                               })
                            ) : (
                                <p>No hay elementos planeados o programados en el plan de producción.</p>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
                {tipologiaModalOpen && (
                    <SetTipologiaModal
                        houseTypeName={tipologiaHouseTypeName}
                        planIds={tipologiaPlanIds}
                        availableTipologias={availableTipologias}
                        currentTipologiaId={currentTipologiaId}
                        onSave={handleSetTipologia} // Pass the save handler
                        onClose={handleCloseTipologiaModal}
                        isLoading={isLoadingTipologias} // Pass loading state
                    />
                )}
                {/* Render DateTime Modal */}
                {dateTimeModalOpen && (
                    <SetDateTimeModal
                        planIds={dateTimePlanIds}
                        currentItemDateTime={dateTimeCurrentValue}
                        onSave={handleSetDateTime}
                        onClose={handleCloseDateTimeModal}
                        isLoading={isSavingDateTime} // Pass the dedicated loading state
                    />
                )}
            </div>
        </div>
    );
}

export default ActiveProductionDashboard;
