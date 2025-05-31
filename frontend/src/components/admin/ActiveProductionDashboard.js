import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SetSubTypeModal from './SetSubTypeModal'; // Renamed from SetTipologiaModal
import SetDateTimeModal from './SetDateTimeModal';
import AddProductionBatchModal from './AddProductionBatchModal'; // New Modal
import * as adminService from '../../services/adminService';
import styles from './AdminComponentStyles';

const stationLayout = {
    'W': ['W1', 'W2', 'W3', 'W4', 'W5'],
    'M': ['M1'],
    'A': ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    'B': ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
    'C': ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
};

const lineStyles = {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: '20px',
    paddingBottom: '10px',
    borderBottom: '1px solid #eee',
    overflowX: 'auto',
    minHeight: '180px', // Increased minHeight to accommodate more task details
};

const assemblyLinesContainer = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
};

const stationBoxStyle = {
    border: '1px solid #ccc',
    padding: '10px 15px',
    margin: '5px',
    minWidth: '200px', // Increased minWidth
    maxWidth: '300px',
    minHeight: '150px', // Increased minHeight
    borderRadius: '4px',
    backgroundColor: '#f9f9f9',
    textAlign: 'left', // Changed to left for task lists
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start', // Changed to flex-start
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    fontSize: '0.9em',
};

const stationTitleStyle = {
    fontWeight: 'bold',
    marginBottom: '8px',
    fontSize: '1em',
    color: '#333',
    textAlign: 'center', // Keep station title centered
};

const moduleInfoStyle = {
    fontSize: '0.85em',
    color: '#555',
    wordWrap: 'break-word',
    marginBottom: '5px',
};

const taskListStyle = {
    listStyleType: 'none',
    paddingLeft: '0',
    margin: '5px 0',
    fontSize: '0.8em',
};

const taskItemStyle = {
    padding: '2px 0',
    borderBottom: '1px dotted #eee',
};
const completedTaskStyle = {
    textDecoration: 'line-through',
    color: '#888',
};

const panelContainerStyle = {
    marginTop: '5px',
    paddingLeft: '10px',
    borderLeft: '2px solid #007bff'
};

const emptyStationStyle = {
    color: '#aaa',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: '30px', // Center "Vacío" text a bit
};

const upcomingListStyle = { listStyle: 'none', padding: 0 };
const upcomingItemStyle = {
    border: '1px solid #eee', padding: '8px', marginBottom: '5px', borderRadius: '3px',
    backgroundColor: '#fff', fontSize: '0.9em', userSelect: 'none',
    transition: 'background-color 0.2s ease', cursor: 'pointer',
};
const selectedListItemStyle = { backgroundColor: '#d6eaff', borderLeft: '3px solid #007bff' };
const draggingListItemStyle = { backgroundColor: '#e6f7ff', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', opacity: 0.9, cursor: 'grabbing', zIndex: 100 };
const moduleBadgeStyle = { display: 'inline-block', padding: '2px 5px', borderRadius: '3px', backgroundColor: '#6c757d', color: 'white', fontSize: '0.8em', fontWeight: 'bold', marginRight: '5px', verticalAlign: 'middle' };
const houseTypeBadgeStyle = { display: 'inline-block', padding: '2px 5px', borderRadius: '3px', backgroundColor: '#007bff', color: 'white', fontSize: '0.8em', fontWeight: 'bold', marginRight: '5px', verticalAlign: 'middle' };
const statusBadgeStyleBase = { display: 'inline-block', padding: '2px 6px', borderRadius: '3px', color: 'black', fontSize: '0.8em', fontWeight: 'bold', marginRight: '5px', verticalAlign: 'middle', border: '1px solid #ccc' };

const statusDisplayConfig = {
    Planned: { text: 'Planificado', color: '#eeeeee' }, // Light Grey
    Panels: { text: 'Paneles', color: '#bbdefb' },    // Light Blue
    Magazine: { text: 'Magazine', color: '#c8e6c9' }, // Light Green
    Assembly: { text: 'Terminaciones', color: '#ffcc80' }, // Light Orange
    // Add other statuses if they can appear in upcomingItems
    default: { text: 'Desconocido', color: '#f5f5f5'} // Default fallback
};

const LineIndicator = ({ line, isActive, isClickable, onClick }) => {
    const baseStyle = { display: 'inline-block', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8em', minWidth: '20px', textAlign: 'center', margin: '0 2px', border: '1px solid transparent' };
    const activeStyle = { color: 'white', backgroundColor: line === 'A' ? '#dc3545' : line === 'B' ? '#28a745' : '#007bff' };
    const inactiveClickableStyle = { color: '#aaa', backgroundColor: '#f0f0f0', cursor: 'pointer', border: '1px solid #ccc' };
    const [isHovering, setIsHovering] = React.useState(false);
    const combinedStyle = { ...baseStyle, ...(isActive ? activeStyle : (isClickable ? inactiveClickableStyle : {})), ...(isClickable && !isActive && isHovering ? { backgroundColor: '#e0e0e0' } : {}) };
    return <div style={combinedStyle} onClick={isClickable && !isActive ? onClick : undefined} onMouseEnter={() => isClickable && !isActive && setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>{line}</div>;
};

const getUniqueProjectsFromUpcoming = (items) => {
    const projects = new Map();
    items.forEach(item => {
        if (!projects.has(item.project_name)) { // Use project_name
            projects.set(item.project_name, {
                // id: item.project_id, // project_id is no longer available directly on upcoming_items
                name: item.project_name,
                moduleNumbers: new Set(items.filter(i => i.project_name === item.project_name).map(i => i.module_number)) // Use module_number
            });
        } else {
            projects.get(item.project_name).moduleNumbers.add(item.module_number);
        }
    });
    return Array.from(projects.values()).map(proj => ({
        ...proj,
        moduleNumbers: Array.from(proj.moduleNumbers).sort((a, b) => a - b)
    })).sort((a, b) => a.name.localeCompare(b.name));
};

const generateDeterministicColor = (projectName) => {
    let hash = 0;
    for (let i = 0; i < projectName.length; i++) {
        hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 40%)`;
};

function SortableItem({ id, item, index, isSelected, onClick, onChangeLine, showProjectSeparator, projectColor, disabled, formatPlannedDate, onHouseTypeBadgeClick, onDateTimeBadgeClick, onDeleteItem }) {
    const { attributes, listeners: dndListeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
    const { onPointerDown: dndOnPointerDown, ...listeners } = dndListeners;
    const [isDeleteHovered, setIsDeleteHovered] = useState(false);

    const deleteIconStyle = {
        marginLeft: '10px',
        padding: '5px',
        fontSize: '1.2em', // Adjust size as needed
        color: isDeleteHovered ? '#e53935' : '#9e9e9e', // Red on hover, grey otherwise
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: '50%', // Make it circular if desired, or remove for square
        cursor: 'pointer',
        transition: 'color 0.2s ease-in-out, transform 0.1s ease-in-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: isDeleteHovered ? 'scale(1.1)' : 'scale(1)',
    };

    const draggableElementStyle = {
        ...upcomingItemStyle,
        ...(isDragging ? draggingListItemStyle : (isSelected ? selectedListItemStyle : {})),
        transform: CSS.Transform.toString(transform), transition,
        borderTop: showProjectSeparator ? '2px solid #ccc' : (isSelected && !isDragging ? selectedListItemStyle.border : upcomingItemStyle.border),
        marginTop: showProjectSeparator ? '10px' : upcomingItemStyle.marginBottom,
        display: 'flex', alignItems: 'center', padding: '8px', flexGrow: 1, marginRight: '10px', position: 'relative',
        zIndex: isDragging ? draggingListItemStyle.zIndex : 'auto', outline: 'none',
        cursor: disabled ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
    };
    const lineIndicatorContainerStyle = { display: 'flex', flexDirection: 'row', alignItems: 'center', minWidth: '100px' };

    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: upcomingItemStyle.marginBottom }}>
            <div ref={setNodeRef} style={draggableElementStyle} {...attributes} {...listeners}
                onPointerDown={(e) => { if (e.nativeEvent.shiftKey && e.nativeEvent.button === 0) { onClick(e, id); } if (dndOnPointerDown) { dndOnPointerDown(e); } }}>
                <span style={{ fontWeight: 'bold', marginRight: '10px', color: '#666' }}>#{index + 1}:</span>
                <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: projectColor, fontWeight: 'bold' }}>[{item.project_name}]</span>
                    {` ${item.house_identifier} `}
                    <span style={moduleBadgeStyle}>MD{item.module_number}</span> {/* Changed from module_sequence_in_house */}
                    <span style={houseTypeBadgeStyle} data-house-type-badge="true" onPointerDown={e => e.stopPropagation()} onClick={e => onHouseTypeBadgeClick(item.house_type_id, item.house_type_name, item.plan_id, item.sub_type_id)}>
                        [{item.house_type_name}]
                        {item.sub_type_name && ` [${item.sub_type_name}]`} {/* Changed from tipologia_name */}
                    </span>
                    <span style={{
                        ...statusBadgeStyleBase,
                        backgroundColor: (statusDisplayConfig[item.status] || statusDisplayConfig.default).color
                        }}>
                        {(statusDisplayConfig[item.status] || statusDisplayConfig.default).text}
                    </span>
                    <span style={{ cursor: 'pointer', textDecoration: 'underline', marginLeft: '5px' }} data-datetime-badge="true" onPointerDown={e => e.stopPropagation()} onClick={e => onDateTimeBadgeClick(item.plan_id, item.planned_start_datetime)}>
                        {formatPlannedDate(item.planned_start_datetime)}
                    </span>
                </span>
           </div>
            <div style={lineIndicatorContainerStyle}>
                <LineIndicator line="A" isActive={item.planned_assembly_line === 'A'} isClickable={true} onClick={() => onChangeLine(id, 'A')} />
                <LineIndicator line="B" isActive={item.planned_assembly_line === 'B'} isClickable={true} onClick={() => onChangeLine(id, 'B')} />
                <LineIndicator line="C" isActive={item.planned_assembly_line === 'C'} isClickable={true} onClick={() => onChangeLine(id, 'C')} />
            </div>
            <button
                style={deleteIconStyle}
                onClick={(e) => {
                    e.stopPropagation(); // Prevent drag/selection logic from firing
                    onDeleteItem(id);
                }}
                onMouseEnter={() => setIsDeleteHovered(true)}
                onMouseLeave={() => setIsDeleteHovered(false)}
                title={`Eliminar item #${item.planned_sequence} (Plan ID: ${id})`}
            >
                &#128465;
            </button>
        </div>
    );
}

function ActiveProductionDashboard() {
    const [stationStatusData, setStationStatusData] = useState({ station_status: [], upcoming_items: [] });
    const [stationStatusMap, setStationStatusMap] = useState({}); // For quick lookup
    const [upcomingItems, setUpcomingItems] = useState([]); // For DND list
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [selectedItemIds, setSelectedItemIds] = useState(new Set());
    const [lastClickedItemId, setLastClickedItemId] = useState(null);
    const [draggedItemIds, setDraggedItemIds] = useState(null);
    const [isUpdatingLine, setIsUpdatingLine] = useState(false);
    const [projectColorMap, setProjectColorMap] = useState(new Map());
    const [isShiftKeyDown, setIsShiftKeyDown] = useState(false); // Not used in current logic, but kept if needed

    const [subTypeModalOpen, setSubTypeModalOpen] = useState(false); // Renamed
    const [subTypeHouseTypeId, setSubTypeHouseTypeId] = useState(null); // Renamed
    const [subTypeHouseTypeName, setSubTypeHouseTypeName] = useState(''); // Renamed
    const [subTypePlanIds, setSubTypePlanIds] = useState([]); // Renamed
    const [availableSubTypes, setAvailableSubTypes] = useState(null); // Renamed
    const [isLoadingSubTypes, setIsLoadingSubTypes] = useState(false); // Renamed
    const [currentSubTypeIdForModal, setCurrentSubTypeIdForModal] = useState(undefined); // Renamed

    const [dateTimeModalOpen, setDateTimeModalOpen] = useState(false);
    const [dateTimePlanIds, setDateTimePlanIds] = useState([]);
    const [dateTimeCurrentValue, setDateTimeCurrentValue] = useState(null);
    const [isSavingDateTime, setIsSavingDateTime] = useState(false);

    const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false);
    const [allHouseTypes, setAllHouseTypes] = useState([]);
    const [isLoadingHouseTypes, setIsLoadingHouseTypes] = useState(false);

    // State for hover tooltip
    const [hoveredStationDetails, setHoveredStationDetails] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });


    const fetchData = useCallback(async () => {
        // setSelectedItemIds(new Set()); // Keep selection on auto-refresh
        // setLastClickedItemId(null); // Keep last clicked on auto-refresh
        setIsLoading(true);
        setError('');
        try {
            const data = await adminService.getStationStatusOverview();
            setStationStatusData(data);
            const statusMap = (data.station_status || []).reduce((acc, station) => {
                acc[station.station_id] = station;
                return acc;
            }, {});
            setStationStatusMap(statusMap);
            setUpcomingItems(data.upcoming_items || []); // These are already filtered by backend
            setLastUpdated(new Date());
        } catch (err) {
            setError(`Error fetching production status: ${err.message}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []); // Removed item selection reset from fetchData dependencies to persist selection

    const fetchHouseTypesForModal = useCallback(async () => {
        setIsLoadingHouseTypes(true);
        try {
            const typesData = await adminService.getHouseTypes(); // Fetches all details
            setAllHouseTypes(typesData.map(ht => ({ // Simplify for dropdown
                house_type_id: ht.house_type_id,
                name: ht.name,
                number_of_modules: ht.number_of_modules 
            })) || []);
        } catch (err) {
            setError(`Error fetching house types for batch modal: ${err.message}`);
            setAllHouseTypes([]);
        } finally {
            setIsLoadingHouseTypes(false);
        }
    }, []);
    
    const uniqueProjects = React.useMemo(() => getUniqueProjectsFromUpcoming(upcomingItems), [upcomingItems]);

    useEffect(() => {
        setProjectColorMap(prevMap => {
            const newMap = new Map(prevMap);
            let updated = false;
            uniqueProjects.forEach(project => {
                if (!newMap.has(project.name)) { // Use project.name as key
                    newMap.set(project.name, generateDeterministicColor(project.name));
                    updated = true;
                }
            });
            return updated ? newMap : prevMap;
        });
    }, [uniqueProjects]);

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 30000); 
        return () => clearInterval(intervalId);
    }, [fetchData]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { shouldActivate: (event) => {
            const isShiftPressed = event.nativeEvent && typeof event.nativeEvent.shiftKey !== 'undefined' && event.nativeEvent.shiftKey;
            if (isShiftPressed) return false;
            const targetElement = event.nativeEvent.target;
            const houseTypeBadge = targetElement.closest('[data-house-type-badge="true"]');
            const dateTimeBadge = targetElement.closest('[data-datetime-badge="true"]');
            if (houseTypeBadge || dateTimeBadge) return false;
            return true;
        }}}),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = useCallback((event) => {
        const { active } = event;
        if (selectedItemIds.has(active.id)) {
            setDraggedItemIds(selectedItemIds);
        } else {
            setDraggedItemIds(new Set([active.id]));
        }
    }, [selectedItemIds]);

    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;
        if (!draggedItemIds) return;
        setDraggedItemIds(null);

        if (over && active.id !== over.id) {
            const originalItems = [...upcomingItems];
            let reorderedItems = originalItems;
            const isGroupDrag = draggedItemIds.size > 1;

            if (isGroupDrag) {
                if (draggedItemIds.has(over.id)) return;
                const groupBeingDragged = originalItems.filter(item => draggedItemIds.has(item.plan_id));
                const itemsWithoutGroup = originalItems.filter(item => !draggedItemIds.has(item.plan_id));
                const newIndexInFilteredList = itemsWithoutGroup.findIndex(item => item.plan_id === over.id);
                if (newIndexInFilteredList === -1) return;
                reorderedItems = [...itemsWithoutGroup.slice(0, newIndexInFilteredList), ...groupBeingDragged, ...itemsWithoutGroup.slice(newIndexInFilteredList)];
            } else {
                const oldIndex = originalItems.findIndex((item) => item.plan_id === active.id);
                const newIndex = originalItems.findIndex((item) => item.plan_id === over.id);
                if (oldIndex === -1 || newIndex === -1) return;
                reorderedItems = arrayMove(originalItems, oldIndex, newIndex);
            }

            const itemsWithUpdatedSequence = reorderedItems.map((item, index) => ({ ...item, planned_sequence: index + 1 }));
            setUpcomingItems(itemsWithUpdatedSequence);
            const orderedPlanIds = itemsWithUpdatedSequence.map(item => item.plan_id);

            try {
                setIsLoading(true); setError('');
                await adminService.reorderModuleProductionPlan(orderedPlanIds); // Updated service call
                setLastUpdated(new Date());
            } catch (err) {
                setError(`Error reordenando plan: ${err.message}. Revirtiendo cambios locales.`);
                setUpcomingItems(originalItems);
            } finally {
                setIsLoading(false);
            }
        }
    }, [upcomingItems, draggedItemIds]);

    const handleDragCancel = useCallback(() => setDraggedItemIds(null), []);

    const handleItemClick = useCallback((event, clickedItemId) => {
        event.stopPropagation();
        if (!event.nativeEvent.shiftKey) return;
        setSelectedItemIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);
            if (lastClickedItemId && lastClickedItemId !== clickedItemId) {
                const itemsInOrder = upcomingItems;
                const lastClickedIndex = itemsInOrder.findIndex(item => item.plan_id === lastClickedItemId);
                const currentClickedIndex = itemsInOrder.findIndex(item => item.plan_id === clickedItemId);
                if (lastClickedIndex !== -1 && currentClickedIndex !== -1) {
                    const start = Math.min(lastClickedIndex, currentClickedIndex);
                    const end = Math.max(lastClickedIndex, currentClickedIndex);
                    for (let i = start; i <= end; i++) {
                        if (itemsInOrder[i]) newSelectedIds.add(itemsInOrder[i].plan_id);
                    }
                } else {
                    if (newSelectedIds.has(clickedItemId)) newSelectedIds.delete(clickedItemId); else newSelectedIds.add(clickedItemId);
                }
            } else {
                if (newSelectedIds.has(clickedItemId)) newSelectedIds.delete(clickedItemId); else newSelectedIds.add(clickedItemId);
            }
            return newSelectedIds;
        });
        setLastClickedItemId(clickedItemId);
    }, [lastClickedItemId, upcomingItems]);

    const handleDeselectAll = (event) => {
        if (!event.target.closest('[role="button"]') && !event.target.closest('[data-project-header-container]')) {
            setSelectedItemIds(new Set());
            setLastClickedItemId(null);
        }
    };
    
    const handleChangeAssemblyLine = useCallback(async (clickedPlanId, newLine) => {
        if (isUpdatingLine || draggedItemIds) return;
        const originalItems = [...upcomingItems];
        const itemsToUpdateIds = (selectedItemIds.size > 1 && selectedItemIds.has(clickedPlanId)) ? Array.from(selectedItemIds) : [clickedPlanId];
        const actualIdsToUpdate = itemsToUpdateIds.filter(id => originalItems.find(i => i.plan_id === id)?.planned_assembly_line !== newLine);
        if (actualIdsToUpdate.length === 0) return;

        setUpcomingItems(originalItems.map(item => actualIdsToUpdate.includes(item.plan_id) ? { ...item, planned_assembly_line: newLine } : item));
        setIsUpdatingLine(true); setError('');
        try {
            if (actualIdsToUpdate.length > 1) {
                await adminService.changeModuleProductionPlanItemsLineBulk(actualIdsToUpdate, newLine); // Updated
            } else {
                await adminService.updateModuleProductionPlanItem(actualIdsToUpdate[0], { planned_assembly_line: newLine }); // Updated
            }
            setLastUpdated(new Date());
        } catch (err) {
            setError(`Error cambiando línea para item(s) ${actualIdsToUpdate.join(', ')}: ${err.message}. Revirtiendo.`);
            setUpcomingItems(originalItems);
        } finally {
            setIsUpdatingLine(false);
        }
    }, [upcomingItems, isUpdatingLine, draggedItemIds, selectedItemIds]);

    const handleSelectModuleNumberInProject = useCallback((event, projectName, targetModuleNumber) => { // Changed from projectID to projectName, sequence to number
        event.stopPropagation();
        const idsToSelect = upcomingItems
            .filter(item => item.project_name === projectName && item.module_number === targetModuleNumber) // Use project_name and module_number
            .map(item => item.plan_id);
        if (idsToSelect.length > 0) {
            setSelectedItemIds(prev => new Set([...prev, ...idsToSelect]));
        }
    }, [upcomingItems]);

    const formatPlannedDate = (dateString) => {
        if (!dateString) return '🗓 --';
        try {
            const date = new Date(dateString.replace(' ', 'T')+'Z'); // Ensure UTC parsing if backend sends naive datetime
            if (isNaN(date.getTime())) return `🗓 ErrorFecha`;
            const currentYear = new Date().getFullYear();
            const year = date.getFullYear();
            const month = date.toLocaleString('es-ES', { month: 'long' });
            const day = date.getDate();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
            const yearString = year !== currentYear ? `${year} ` : '';
            return `🗓 ${yearString}${capitalizedMonth} ${day}, ${hours}:${minutes}`;
        } catch (e) { return `🗓 Error`; }
    };

    const handleOpenSubTypeModal = async (houseTypeId, houseTypeNameFromItem, planId, currentItemSubTypeId) => { // Renamed
        setIsLoadingSubTypes(true); // Renamed
        setSubTypeModalOpen(true);  // Renamed
        setSubTypeHouseTypeId(houseTypeId); // Renamed
        setSubTypeHouseTypeName(houseTypeNameFromItem); // Renamed

        const ids = (selectedItemIds.size > 0 && selectedItemIds.has(planId)) ? Array.from(selectedItemIds) : [planId];
        setSubTypePlanIds(ids); // Renamed

        let allSameHouseType = true;
        let firstSubTypeId = undefined; // Renamed
        let commonSubTypeFound = true; // Renamed

        if (ids.length > 0) {
            const firstItem = upcomingItems.find(item => item.plan_id === ids[0]);
            if (!firstItem || firstItem.house_type_id !== houseTypeId) {
                allSameHouseType = false;
            } else {
                firstSubTypeId = firstItem.sub_type_id; // Use sub_type_id
            }
            for (let i = 1; i < ids.length; i++) {
                const currentItem = upcomingItems.find(item => item.plan_id === ids[i]);
                if (!currentItem || currentItem.house_type_id !== houseTypeId) { allSameHouseType = false; break; }
                if (currentItem.sub_type_id !== firstSubTypeId) commonSubTypeFound = false; // Use sub_type_id
            }
        } else { allSameHouseType = false; }

        if (!allSameHouseType) {
            setError("Error: Los elementos seleccionados deben pertenecer al mismo Tipo de Casa para establecer el Sub-Tipo.");
            handleCloseSubTypeModal(); return; // Renamed
        }
        setCurrentSubTypeIdForModal(commonSubTypeFound ? firstSubTypeId : undefined); // Renamed

        try {
            setError('');
            const subTypesData = await adminService.getHouseSubTypes(houseTypeId); // Renamed service call
            setAvailableSubTypes(subTypesData || []); // Renamed
        } catch (err) {
            setError(`Error cargando Sub-Tipos: ${err.message}`);
            setAvailableSubTypes([]); // Renamed
        } finally {
            setIsLoadingSubTypes(false); // Renamed
        }
    };

    const handleCloseSubTypeModal = () => { // Renamed
        setSubTypeModalOpen(false); setSubTypeHouseTypeId(null); setSubTypeHouseTypeName('');
        setSubTypePlanIds([]); setAvailableSubTypes(null); setCurrentSubTypeIdForModal(undefined); setError('');
    };

    const handleSetSubType = async (planIdsToUpdate, newSubTypeId) => { // Renamed
        const originalItems = [...upcomingItems];
        const updatedItemsOptimistic = originalItems.map(item => {
            if (planIdsToUpdate.includes(item.plan_id)) {
                const newSubType = availableSubTypes?.find(st => st.sub_type_id === newSubTypeId);
                return { ...item, sub_type_id: newSubTypeId, sub_type_name: newSubType ? newSubType.name : null };
            }
            return item;
        });
        setUpcomingItems(updatedItemsOptimistic);
        try {
            await adminService.setModuleProductionPlanItemsSubTypeBulk(planIdsToUpdate, newSubTypeId); // Updated service call
            setLastUpdated(new Date());
        } catch (err) { setUpcomingItems(originalItems); throw err; }
    };

    const handleOpenDateTimeModal = (planId, currentDateTime) => {
        const ids = (selectedItemIds.size > 0 && selectedItemIds.has(planId)) ? Array.from(selectedItemIds) : [planId];
        setDateTimePlanIds(ids);
        let dateTimeToPreFill = null;
        if (ids.length > 0) {
            const firstItem = upcomingItems.find(item => item.plan_id === ids[0]);
            dateTimeToPreFill = firstItem ? firstItem.planned_start_datetime : null;
        }
        setDateTimeCurrentValue(dateTimeToPreFill);
        setDateTimeModalOpen(true); setError('');
    };
    const handleCloseDateTimeModal = () => { setDateTimeModalOpen(false); setDateTimePlanIds([]); setDateTimeCurrentValue(null); setError(''); };
    const handleSetDateTime = async (planIdsToUpdate, newDateTimeString) => {
        const originalItems = [...upcomingItems];
        const updatedItemsOptimistic = originalItems.map(item => planIdsToUpdate.includes(item.plan_id) ? { ...item, planned_start_datetime: newDateTimeString } : item);
        setUpcomingItems(updatedItemsOptimistic);
        setIsSavingDateTime(true);
        try {
            await adminService.setModuleProductionPlanItemsDateTimeBulk(planIdsToUpdate, newDateTimeString); // Updated
            setLastUpdated(new Date());
        } catch (err) { setUpcomingItems(originalItems); throw err; } finally { setIsSavingDateTime(false); }
    };

    const handleOpenAddBatchModal = () => {
        fetchHouseTypesForModal(); // Fetch/refresh house types when opening
        setIsAddBatchModalOpen(true);
        setError(''); // Clear previous errors
    };

    const handleCloseAddBatchModal = () => {
        setIsAddBatchModalOpen(false);
    };

    const handleAddProductionBatch = async (batchData) => {
        setIsLoading(true); // Use main loading indicator or a specific one for the modal
        setError('');
        try {
            await adminService.addModuleProductionPlanBatch(batchData); // Updated service call
            await fetchData(); // Refresh the entire dashboard data
            handleCloseAddBatchModal();
            setLastUpdated(new Date());
        } catch (err) {
            setError(`Error adding production batch: ${err.message}`);
            // Modal can display this error, or it can be shown on the main page
            // For now, error state is on main page.
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteItem = async (clickedPlanId) => {
        const itemsToDelete = new Set();
        let confirmationMessage = '';

        if (selectedItemIds.has(clickedPlanId) && selectedItemIds.size > 1) {
            selectedItemIds.forEach(id => itemsToDelete.add(id));
            confirmationMessage = `¿Está seguro de que desea eliminar los ${itemsToDelete.size} elementos seleccionados del plan de producción? Esta acción no se puede deshacer.`;
        } else {
            itemsToDelete.add(clickedPlanId);
            confirmationMessage = `¿Está seguro de que desea eliminar el elemento del plan de producción (ID: ${clickedPlanId})? Esta acción no se puede deshacer.`;
        }

        if (itemsToDelete.size > 0 && window.confirm(confirmationMessage)) {
            setIsLoading(true);
            setError('');
            let allSucceeded = true;
            const successfullyDeletedIds = [];

            for (const idToDelete of itemsToDelete) {
                try {
                    await adminService.deleteModuleProductionPlanItem(idToDelete);
                    successfullyDeletedIds.push(idToDelete);
                } catch (err) {
                    allSucceeded = false;
                    setError(prevError => `${prevError}Error eliminando item ${idToDelete}: ${err.message}. `);
                    // Continue trying to delete others
                }
            }

            if (successfullyDeletedIds.length > 0) {
                setUpcomingItems(prevItems => prevItems.filter(item => !successfullyDeletedIds.includes(item.plan_id)));
                setSelectedItemIds(prevSelected => {
                    const newSelected = new Set(prevSelected);
                    successfullyDeletedIds.forEach(id => newSelected.delete(id));
                    return newSelected;
                });
                if (successfullyDeletedIds.includes(lastClickedItemId)) {
                    setLastClickedItemId(null);
                }
                setLastUpdated(new Date());
            }

            if (!allSucceeded) {
                // Error message is already set
            } else if (successfullyDeletedIds.length > 0) {
                // Optionally, add a success notification here for the deleted items
            }
            setIsLoading(false);
        }
    };


    const renderStation = (stationId) => {
        const station = stationStatusMap[stationId];
        if (!station) return <div key={`error-${stationId}`} style={stationBoxStyle}>Error: Estación {stationId} no encontrada</div>;

        const { content, line_type } = station;
        const isPanelLineStation = line_type === 'W';
        const isMagazineStation = stationId === 'M1';
        const isAssemblyLineStation = ['A', 'B', 'C'].includes(line_type);

        let displayContent = null;

        if (isPanelLineStation && content.modules_with_active_panels && content.modules_with_active_panels.length > 0) {
            displayContent = content.modules_with_active_panels.map(moduleData => (
                <div key={`w-mod-${moduleData.plan_id}`} style={{ ...moduleInfoStyle, marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                    <div>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{moduleData.project_name}</span>
                        {` #${moduleData.house_identifier} `}
                        <span style={moduleBadgeStyle}>MD{moduleData.module_number}</span>
                        <span style={houseTypeBadgeStyle}>[{moduleData.house_type_name}]{moduleData.sub_type_name ? ` [${moduleData.sub_type_name}]` : ''}</span>
                    </div>
                    <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #bbb' }}>
                        <strong>Paneles Activos en esta Estación:</strong>
                        <ul style={taskListStyle}>
                            {moduleData.active_panels_at_station.map(panel => (
                                <li key={panel.panel_production_plan_id || panel.panel_definition_id} style={taskItemStyle}>
                                    {panel.panel_code} ({panel.panel_group}) - <span style={{ fontWeight: 'normal', color: panel.status === 'In Progress' ? 'green' : '#c28b00'}}>{panel.status}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ));
        } else if (isMagazineStation && content.modules_in_magazine && content.modules_in_magazine.length > 0) {
            displayContent = content.modules_in_magazine.map(moduleData => (
                <div key={`m1-mod-${moduleData.plan_id}`} style={{ ...moduleInfoStyle, marginBottom: '10px' }}>
                    <div>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{moduleData.project_name}</span>
                        {` #${moduleData.house_identifier} `}
                        <span style={moduleBadgeStyle}>MD{moduleData.module_number}</span>
                        <span style={houseTypeBadgeStyle}>[{moduleData.house_type_name}]{moduleData.sub_type_name ? ` [${moduleData.sub_type_name}]` : ''}</span>
                    </div>
                    <div style={{ marginTop: '5px', fontStyle: 'italic', color: '#555' }}>
                        Total Paneles: {moduleData.panels ? moduleData.panels.length : 0}. Detalles al pasar el cursor.
                    </div>
                </div>
            ));
        } else if (isAssemblyLineStation && content.modules_with_active_tasks && content.modules_with_active_tasks.length > 0) {
            displayContent = content.modules_with_active_tasks.map(moduleData => (
                <div key={`asm-mod-${moduleData.plan_id}`} style={{ ...moduleInfoStyle, marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                    <div>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{moduleData.project_name}</span>
                        {` #${moduleData.house_identifier} `}
                        <span style={moduleBadgeStyle}>MD{moduleData.module_number}</span>
                        <span style={houseTypeBadgeStyle}>[{moduleData.house_type_name}]{moduleData.sub_type_name ? ` [${moduleData.sub_type_name}]` : ''}</span>
                    </div>
                    <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: '1px dashed #bbb' }}>
                        <strong>Tareas de Módulo Activas en esta Estación:</strong>
                        <ul style={taskListStyle}>
                            {moduleData.active_module_tasks_at_station.map(task => (
                                <li key={task.task_log_id || task.task_definition_id} style={{...taskItemStyle, ...(task.status === 'Completed' && completedTaskStyle)}}>
                                    {task.task_name} - <span style={{ fontWeight: 'normal', color: task.status === 'In Progress' ? 'green' : '#c28b00'}}>{task.status}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ));
        }
        
        const handleMouseEnter = (event) => {
            let moduleForTooltip = null;
            let panelsForTooltip = []; // Panels to count for the tooltip

            if (isPanelLineStation && content.modules_with_active_panels && content.modules_with_active_panels.length > 0) {
                moduleForTooltip = content.modules_with_active_panels[0]; // Use first module for tooltip
                // For W stations, the tooltip should ideally show status of ALL panels for that module, not just active at station.
                // This requires fetching all panels for moduleForTooltip if not already available.
                // For simplicity now, we'll use a placeholder or assume backend might provide this if needed.
                // If moduleForTooltip.panels (all panels) is available, use that. Otherwise, it's tricky.
                // Let's assume for now the tooltip for W stations will be more generic or rely on a different data point if full panel list isn't in modules_with_active_panels.
                // For now, we'll use the active_panels_at_station for counting, which is not ideal for overall module panel status.
                // A better approach would be to ensure modules_with_active_panels also contains a full 'panels' list like modules_in_magazine.
                // Given current backend structure, this is a limitation.
                 panelsForTooltip = moduleForTooltip.active_panels_at_station; // This is NOT ideal for overall module panel status.
            } else if (isMagazineStation && content.modules_in_magazine && content.modules_in_magazine.length > 0) {
                moduleForTooltip = content.modules_in_magazine[0];
                panelsForTooltip = moduleForTooltip.panels || [];
            }

            if (moduleForTooltip) {
                const panelCounts = (panelsForTooltip).reduce((acc, panel) => {
                    const statusKey = panel.status ? panel.status.toLowerCase().replace(' ', '_') : 'unknown';
                    acc[statusKey] = (acc[statusKey] || 0) + 1;
                    return acc;
                }, { not_started: 0, in_progress: 0, completed: 0, paused: 0, unknown: 0 });

                const rect = event.currentTarget.getBoundingClientRect();
                setTooltipPosition({ x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 5 });
                setHoveredStationDetails({
                    stationId: stationId,
                    moduleName: `Módulo ${moduleForTooltip.module_number} (${moduleForTooltip.project_name} - ${moduleForTooltip.house_identifier})`,
                    panelCounts: panelCounts,
                    moduleStatus: moduleForTooltip.status || 'N/A' // ModuleProductionPlan status
                });
            }
        };

        const handleMouseLeave = () => {
            setHoveredStationDetails(null);
        };

        return (
            <div 
                key={stationId} 
                style={stationBoxStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div style={stationTitleStyle}>{station.station_name} ({stationId})</div>
                {displayContent ? (
                    <div key={`${stationId}-content-wrapper`}>{displayContent}</div>
                ) : (
                    <div key={`${stationId}-empty`} style={{...moduleInfoStyle, ...emptyStationStyle}}>(Vacío)</div>
                )}
            </div>
        );
    };
    
    const renderTooltip = () => {
        if (!hoveredStationDetails) return null;
        const { moduleName, panelCounts, moduleStatus } = hoveredStationDetails;
        return (
            <div style={{
                position: 'absolute',
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
                backgroundColor: 'rgba(20,20,20,0.9)', // Darker, more opaque
                color: 'white',
                padding: '12px', // Increased padding
                borderRadius: '6px', // Slightly more rounded
                zIndex: 10000, // Higher z-index
                fontSize: '0.95em', // Slightly larger font
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', // More pronounced shadow
                maxWidth: '320px',
                pointerEvents: 'none', 
                border: '1px solid rgba(255,255,255,0.2)', // Subtle border
            }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05em', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '5px' }}>{moduleName}</h4>
                <p style={{ margin: '0 0 5px 0' }}>Estado del Módulo: <strong style={{color: moduleStatus === 'Panels' || moduleStatus === 'Assembly' ? '#ffa726' : (moduleStatus === 'Completed' ? '#bdbdbd' : (moduleStatus === 'Magazine' ? '#66bb6a' : '#bdbdbd'))}}>{moduleStatus}</strong></p>
                <p style={{ margin: '0 0 5px 0' }}>Paneles No Iniciados: <strong style={{color: '#ffcc80'}}>{panelCounts.not_started || panelCounts.planned || 0}</strong></p>
                <p style={{ margin: '0 0 5px 0' }}>Paneles En Progreso: <strong style={{color: '#81d4fa'}}>{panelCounts.in_progress || 0}</strong></p>
                <p style={{ margin: '0 0 5px 0' }}>Paneles Pausados: <strong style={{color: '#fff176'}}>{panelCounts.paused || 0}</strong></p> {/* Assuming 'paused' is a possible status key */}
                <p style={{ margin: '0' }}>Paneles Completados: <strong style={{color: '#c5e1a5'}}>{panelCounts.completed || 0}</strong></p>
                {panelCounts.unknown > 0 && <p style={{ margin: '5px 0 0 0', color: '#ef9a9a' }}>Paneles con estado desconocido: {panelCounts.unknown}</p>}
            </div>
        );
    };


    const renderLine = (lineKey) => (
        <div key={`line-${lineKey}`} style={lineStyles}>
            {stationLayout[lineKey].map(stationId => renderStation(stationId))}
        </div>
    );

    return (
        <div style={styles.container} onClick={handleDeselectAll}>
            <h2 style={styles.header}>Estado Actual de Producción</h2>
            {error && <p style={styles.error}>{error}</p>}
            {isLoading && !stationStatusData.station_status.length && <p>Cargando...</p>}
            <div style={{ marginBottom: '10px', fontSize: '0.8em', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Última actualización: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'N/A'}</span>
                <div>
                    <button onClick={fetchData} disabled={isLoading} style={{ ...styles.button, ...styles.buttonSecondary, padding: '5px 10px', fontSize: '0.9em', marginRight: '10px' }}>Refrescar</button>
                    <button onClick={handleOpenAddBatchModal} disabled={isLoading || isLoadingHouseTypes} style={{ ...styles.button, ...styles.buttonPrimary, padding: '5px 10px', fontSize: '0.9em' }}>
                        Añadir Lote de Producción
                    </button>
                </div>
            </div>

            <h3>Línea de Paneles (W)</h3>{renderLine('W')}
            <h3>Magazine (M)</h3>{renderLine('M')}
            <h3>Líneas de Ensamblaje</h3>
            <div style={assemblyLinesContainer}>
                <div key="line-A-wrapper" style={{ flex: 1, marginRight: '10px' }}><h4>Línea A</h4>{stationLayout['A'].map(stationId => renderStation(stationId))}</div>
                <div key="line-B-wrapper" style={{ flex: 1, marginRight: '10px' }}><h4>Línea B</h4>{stationLayout['B'].map(stationId => renderStation(stationId))}</div>
                <div key="line-C-wrapper" style={{ flex: 1 }}><h4>Línea C</h4>{stationLayout['C'].map(stationId => renderStation(stationId))}</div>
            </div>

            <div style={{ marginTop: '30px' }} data-project-header-container="true">
                <h3 style={styles.header}>Proyectos Pendientes en Plan</h3>
                {uniqueProjects.length > 0 ? (
                    uniqueProjects.map(project => (
                        <div key={project.name} style={{ marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', padding: '8px 12px', backgroundColor: '#f8f8f8' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span>{project.name}</span>
                                {project.moduleNumbers.length > 0 && (
                                    <div><span style={{fontSize: '0.9em', marginRight: '5px'}}>Seleccionar Módulos:</span>
                                        {project.moduleNumbers.map(num => (
                                            <button key={num} style={{...styles.button, backgroundColor: projectColorMap.get(project.name) || '#6c757d', padding: '2px 6px', fontSize: '0.8em', marginRight: '3px'}} title={`Seleccionar todos los módulos #${num} en ${project.name}`} onClick={(e) => handleSelectModuleNumberInProject(e, project.name, num)}>[M{num}]</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (!isLoading && <p>No hay proyectos con elementos pendientes en el plan.</p>)}
            </div>

            <div style={{ marginTop: '20px' }}>
                <h3 style={styles.header}>Plan de Producción Pendiente ({upcomingItems.length} items)</h3>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
                    <SortableContext items={upcomingItems.map(item => item.plan_id)} strategy={verticalListSortingStrategy}>
                        <div style={upcomingListStyle}>
                            {upcomingItems.length > 0 ? (
                                upcomingItems.map((item, index) => {
                                    const prevItem = index > 0 ? upcomingItems[index - 1] : null;
                                    const showProjectSeparator = !prevItem || prevItem.project_name !== item.project_name; // Use project_name
                                    return (
                                        <SortableItem
                                            key={item.plan_id} id={item.plan_id} item={item} index={index}
                                            isSelected={selectedItemIds.has(item.plan_id)} onClick={handleItemClick}
                                            onChangeLine={handleChangeAssemblyLine} showProjectSeparator={showProjectSeparator}
                                            projectColor={projectColorMap.get(item.project_name) || '#000000'} // Use project_name
                                            disabled={isShiftKeyDown} formatPlannedDate={formatPlannedDate}
                                           onHouseTypeBadgeClick={() => handleOpenSubTypeModal(item.house_type_id, item.house_type_name, item.plan_id, item.sub_type_id)} // Pass sub_type_id
                                           onDateTimeBadgeClick={handleOpenDateTimeModal}
                                           onDeleteItem={handleDeleteItem} // Pass the delete handler
                                       />
                                   );
                               })
                            ) : (!isLoading && <p>No hay elementos planeados o programados en el plan de producción.</p>)}
                        </div>
                    </SortableContext>
                </DndContext>
                {subTypeModalOpen && ( // Renamed modal and props
                    <SetSubTypeModal
                        houseTypeName={subTypeHouseTypeName}
                        planIds={subTypePlanIds}
                        availableSubTypes={availableSubTypes} // Renamed prop
                        currentSubTypeId={currentSubTypeIdForModal} // Renamed prop
                        onSave={handleSetSubType} // Renamed handler
                        onClose={handleCloseSubTypeModal} // Renamed handler
                        isLoading={isLoadingSubTypes}
                    />
                )}
                {dateTimeModalOpen && (
                    <SetDateTimeModal
                        planIds={dateTimePlanIds}
                        currentItemDateTime={dateTimeCurrentValue}
                        onSave={handleSetDateTime}
                        onClose={handleCloseDateTimeModal}
                        isLoading={isSavingDateTime}
                    />
                )}
                {isAddBatchModalOpen && (
                    <AddProductionBatchModal
                        isOpen={isAddBatchModalOpen}
                        onClose={handleCloseAddBatchModal}
                        onAddBatch={handleAddProductionBatch}
                        houseTypes={allHouseTypes}
                        isLoadingHouseTypes={isLoadingHouseTypes}
                        // Pass any other necessary props like error display callback or loading state for the modal itself
                    />
                )}
            </div>
        </div>
    );
}

export default ActiveProductionDashboard;
