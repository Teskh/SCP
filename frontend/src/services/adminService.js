// Using fetch API. Replace with Axios if preferred.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/admin'; // Use environment variable or default

// Helper function to handle response status and parsing
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

// === Specialties ===

export const getSpecialties = async () => {
    const response = await fetch(`${API_BASE_URL}/specialties`);
    return handleResponse(response);
};

export const addSpecialty = async (specialtyData) => {
    const response = await fetch(`${API_BASE_URL}/specialties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specialtyData),
    });
    return handleResponse(response);
};

// === Station Context & Task Management (for StationContextSelector.js) ===

// Removed mockModulesDataStore and related update functions as we'll use backend calls.

export const getStationContext = async (stationId) => {
    console.log(`adminService.getStationContext called for stationId: ${stationId}`);
    // This will call the new backend endpoint: GET /api/admin/station-context/<station_id>
    // The backend will determine the module and its panels.
    const response = await fetch(`${API_BASE_URL}/station-context/${stationId}`);
    return handleResponse(response); // Expects { module: {...} or null, panels: [...] }
};


// These functions (startPanel, pausePanel, etc.) will now interact with the generic task start/update endpoints.
// The backend's task start/update logic will handle module creation/status changes.
// The panelId parameter should correspond to panel_definition_id.
// The moduleId parameter should correspond to the module_id of the currently active module.
// The stationId is the current station context.

// For starting/resuming a panel task.
// Assumes a task_definition_id is known or can be determined for the panel at this station.
// This is a simplification. A real system might need to specify which task_definition_id.
// For now, we assume the backend's /tasks/start can infer or has a default task for a panel at a station.
export const startOrResumePanelTask = async (planId, taskDefinitionId, workerId, stationId, panelDefinitionId) => {
    console.log(`adminService.startOrResumePanelTask: planId=${planId}, taskDefinitionId=${taskDefinitionId}, panelDefinitionId=${panelDefinitionId}`);
    // This will call the existing POST /api/admin/tasks/start endpoint
    // The backend will handle creating TaskLog/PanelTaskLog and updating statuses.
    const payload = {
        plan_id: planId, // plan_id is used to find/create the module instance
        task_definition_id: taskDefinitionId, // This needs to be determined by the frontend or a fixed value for "panel work"
        worker_id: workerId, // Assuming worker context is available
        station_start: stationId,
        panel_definition_id: panelDefinitionId 
    };
    // This is a placeholder for the actual task_definition_id that should be started for this panel.
    // The current StationContextSelector doesn't manage task_definition_ids for panels directly.
    // This will require further changes if each panel has multiple distinct tasks selectable by user.
    // For now, let's assume a generic "work on panel" task.
    // The existing /tasks/start endpoint needs to be robust.
    
    // The current /tasks/start endpoint in admin_definitions.py is what we'll use.
    // It requires plan_id, task_definition_id, worker_id, station_start, and optional panel_definition_id.
    // The frontend will need to supply a relevant task_definition_id.
    // This is a GAP: StationContextSelector doesn't know which task_definition_id to start for a panel.
    // For now, this function cannot be fully implemented without that info.
    // Let's assume the old mock behavior for panel actions for now, and focus on module fetching.
    // TODO: Revisit panel task starting with specific task_definition_ids.

    // TODO: Revisit panel task starting with specific task_definition_ids.
    // The StationContextSelector currently passes a placeholder taskDefinitionId.
    // This function now calls the generic startTask endpoint.
    console.log(`Attempting to start/resume panel task via generic startTask endpoint.`);
    try {
        // Call the generic startTask function which posts to /api/admin/tasks/start
        const result = await startTask(planId, taskDefinitionId, workerId, stationId, panelDefinitionId);
        // The backend's /tasks/start should return a meaningful response,
        // including new_status if applicable, or log_id.
        // For now, we adapt the expected mock response structure if needed, or rely on startTask's actual return.
        return { 
            success: true, // Assuming startTask throws on failure
            message: result.message || `Panel ${panelDefinitionId} task action processed.`, 
            panel_id: panelDefinitionId, // Keep for consistency with old mock if needed by UI
            new_status: result.new_status || "in_progress", // Or derive from result if backend provides it
            log_id: result.log_id 
        };
    } catch (error) {
        console.error("Error in startOrResumePanelTask calling startTask:", error);
        // Re-throw or handle as per application's error handling strategy
        throw error; 
    }
};

export const pausePanelTask = async (planId, taskDefinitionId, workerId, stationId, panelDefinitionId) => {
    console.log(`adminService.pausePanelTask: panelDefinitionId=${panelDefinitionId}`);
    // This would call a backend endpoint to update PanelTaskLog status to 'Paused'.
    // e.g., PUT /api/admin/tasks/panel-log/<log_id>/status { status: "Paused" }
    // This requires knowing the panel_task_log_id.
    // TODO: Revisit panel task pausing.
    console.warn("pausePanelTask is using mock behavior.");
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true, message: `Panel ${panelDefinitionId} task paused (mocked)`, panel_id: panelDefinitionId, new_status: "paused" };
};

export const finishPanelTask = async (planId, taskDefinitionId, workerId, stationId, panelDefinitionId) => {
    console.log(`adminService.finishPanelTask: panelDefinitionId=${panelDefinitionId}`);
    // This would call a backend endpoint to update PanelTaskLog status to 'Completed'.
    // e.g., PUT /api/admin/tasks/panel-log/<log_id>/status { status: "Completed" }
    // TODO: Revisit panel task finishing.
    console.warn("finishPanelTask is using mock behavior.");
    await new Promise(resolve => setTimeout(resolve, 300));
     return { success: true, message: `Panel ${panelDefinitionId} task finished (mocked)`, panel_id: panelDefinitionId, new_status: "completed" };
};


// This function will call the backend to update the ModuleProductionPlan item's status and optionally its assembly line.
export const updatePlanStatus = async (planId, newStatus, newLine = null) => {
    console.log(`adminService.updatePlanStatus: planId=${planId}, newStatus=${newStatus}, newLine=${newLine}`);
    
    const updateData = { status: newStatus };
    if (newLine !== null) {
        updateData.planned_assembly_line = newLine;
    }

    // This uses the existing generic update endpoint for ModuleProductionPlan items.
    // PUT /api/admin/module-production-plan/<plan_id>
    try {
        const updatedItem = await updateModuleProductionPlanItem(planId, updateData);
        return { 
            success: true, 
            message: `Plan ${planId} status updated to ${newStatus}` + (newLine ? ` and line to ${newLine}.` : '.'),
            plan_id: planId, // Changed from module_id
            new_status: updatedItem.status, // Reflect actual status from response
            // Potentially include other details from updatedItem if needed by UI
        };
    } catch (error) {
        console.error(`Error updating plan ${planId} status:`, error);
        // Re-throw or handle as per application's error handling strategy
        // For consistency with mock, we can return a similar structure on failure,
        // but throwing is often better for React Query/SWR.
        throw error; 
        // return { success: false, message: error.message || `Failed to update plan ${planId} status.` };
    }
};

export const updateSpecialty = async (id, specialtyData) => {
    const response = await fetch(`${API_BASE_URL}/specialties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specialtyData),
    });
    return handleResponse(response);
};

export const deleteSpecialty = async (id) => {
    const response = await fetch(`${API_BASE_URL}/specialties/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};


// === Workers ===

export const getWorkers = async () => {
    const response = await fetch(`${API_BASE_URL}/workers`);
    return handleResponse(response);
};

export const addWorker = async (workerData) => {
    const payload = {
        ...workerData,
        specialty_id: workerData.specialty_id || null,
        supervisor_id: workerData.supervisor_id || null,
        is_active: Boolean(workerData.is_active)
    };
    const response = await fetch(`${API_BASE_URL}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateWorker = async (id, workerData) => {
     const payload = {
        ...workerData,
        specialty_id: workerData.specialty_id || null,
        supervisor_id: workerData.supervisor_id || null,
        is_active: Boolean(workerData.is_active)
    };
    const response = await fetch(`${API_BASE_URL}/workers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteWorker = async (id) => {
    const response = await fetch(`${API_BASE_URL}/workers/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};

// === Panel Definitions (formerly HouseTypePanels) ===

export const getPanelDefinitions = async (houseTypeId, moduleSequenceNumber, subTypeId = null) => {
    let url = `${API_BASE_URL}/house_types/${houseTypeId}/modules/${moduleSequenceNumber}/panel_definitions`;
    if (subTypeId !== null) {
        url += `?sub_type_id=${subTypeId}`;
    }
    const response = await fetch(url);
    return handleResponse(response);
};

export const addPanelDefinition = async (houseTypeId, moduleSequenceNumber, panelData) => {
    // panelData includes panel_group, panel_code, sub_type_id (optional), multiwall_id (optional)
    const payload = {
        ...panelData,
        sub_type_id: panelData.sub_type_id || null,
        multiwall_id: panelData.multiwall_id || null
    };
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/modules/${moduleSequenceNumber}/panel_definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updatePanelDefinition = async (panelDefinitionId, panelData) => {
     const payload = {
        ...panelData,
        sub_type_id: panelData.sub_type_id || null,
        multiwall_id: panelData.multiwall_id || null 
    };
    const response = await fetch(`${API_BASE_URL}/panel_definitions/${panelDefinitionId}`, { // URL changed
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deletePanelDefinition = async (panelDefinitionId) => {
    const response = await fetch(`${API_BASE_URL}/panel_definitions/${panelDefinitionId}`, { // URL changed
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};

// === Multiwalls ===
// moduleSequenceNumber is removed as Multiwalls are per HouseType now.
export const getMultiwalls = async (houseTypeId) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/multiwalls`);
    return handleResponse(response);
};

export const addMultiwall = async (houseTypeId, multiwallData) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/multiwalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiwallData),
    });
    return handleResponse(response);
};

export const updateMultiwall = async (multiwallId, multiwallData) => {
    const response = await fetch(`${API_BASE_URL}/multiwalls/${multiwallId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiwallData),
    });
    return handleResponse(response);
};

export const deleteMultiwall = async (multiwallId) => {
    const response = await fetch(`${API_BASE_URL}/multiwalls/${multiwallId}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};


// === Supervisors (Subset of Admin Team) ===

export const getSupervisors = async () => {
    const response = await fetch(`${API_BASE_URL}/supervisors`);
    return handleResponse(response);
};

// === Admin Team ===

export const getAdminTeam = async () => {
    const response = await fetch(`${API_BASE_URL}/admin_team`);
    return handleResponse(response);
};

export const addAdminTeamMember = async (memberData) => {
    const payload = {
        ...memberData,
        is_active: Boolean(memberData.is_active)
    };
    const response = await fetch(`${API_BASE_URL}/admin_team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateAdminTeamMember = async (id, memberData) => {
     const payload = {
        ...memberData,
        is_active: Boolean(memberData.is_active)
    };
    const response = await fetch(`${API_BASE_URL}/admin_team/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteAdminTeamMember = async (id) => {
    const response = await fetch(`${API_BASE_URL}/admin_team/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};

// === Task Definitions ===

export const getTaskDefinitions = async () => {
    const response = await fetch(`${API_BASE_URL}/task_definitions`);
    return handleResponse(response);
};

export const addTaskDefinition = async (taskDefData) => {
    const payload = {
        ...taskDefData,
        house_type_id: taskDefData.house_type_id || null,
        specialty_id: taskDefData.specialty_id || null,
        station_sequence_order: taskDefData.station_sequence_order || null,
        is_panel_task: Boolean(taskDefData.is_panel_task) // Added is_panel_task
    };
    const response = await fetch(`${API_BASE_URL}/task_definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateTaskDefinition = async (id, taskDefData) => {
     const payload = {
        ...taskDefData,
        house_type_id: taskDefData.house_type_id || null,
        specialty_id: taskDefData.specialty_id || null,
        station_sequence_order: taskDefData.station_sequence_order || null,
        is_panel_task: Boolean(taskDefData.is_panel_task) // Added is_panel_task
    };
    const response = await fetch(`${API_BASE_URL}/task_definitions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteTaskDefinition = async (id) => {
    const response = await fetch(`${API_BASE_URL}/task_definitions/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};

// === Fetching related data for dropdowns ===
// getHouseTypes now fetches detailed house types including sub_types and parameters
export const getHouseTypes = async () => {
    const response = await fetch(`${API_BASE_URL}/house_types`);
    return handleResponse(response); // Expects array of house types with their sub_types and parameters
};

export const addHouseType = async (houseTypeData) => {
    // houseTypeData should include name, description, number_of_modules, and sub_types array
    // e.g., { name: 'Type A', ..., sub_types: [{name: 'Standard'}, {name: 'Premium'}] }
    const response = await fetch(`${API_BASE_URL}/house_types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(houseTypeData),
    });
    return handleResponse(response);
};

export const updateHouseType = async (id, houseTypeData) => {
    // houseTypeData should include name, description, number_of_modules, and sub_types array
    const response = await fetch(`${API_BASE_URL}/house_types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(houseTypeData),
    });
    return handleResponse(response);
};

export const deleteHouseType = async (id) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};


export const getStations = async () => {
    const response = await fetch(`${API_BASE_URL}/stations`);
    return handleResponse(response);
};

// === House Parameters ===

export const getHouseParameters = async () => {
    const response = await fetch(`${API_BASE_URL}/house_parameters`);
    return handleResponse(response);
};

export const addHouseParameter = async (parameterData) => {
    const response = await fetch(`${API_BASE_URL}/house_parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameterData),
    });
    return handleResponse(response);
};

export const updateHouseParameter = async (id, parameterData) => {
    const response = await fetch(`${API_BASE_URL}/house_parameters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameterData),
    });
    return handleResponse(response);
};

export const deleteHouseParameter = async (id) => {
    const response = await fetch(`${API_BASE_URL}/house_parameters/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};


// === ProjectModules related functions are removed as they are deprecated ===


// === House SubTypes (formerly Tipologias) ===

export const getHouseSubTypes = async (houseTypeId) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/sub_types`);
    return handleResponse(response);
};

export const addHouseSubType = async (houseTypeId, subTypeData) => {
    // subTypeData should include name, description (optional)
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/sub_types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subTypeData),
    });
    return handleResponse(response);
};

export const updateHouseSubType = async (subTypeId, subTypeData) => {
    const response = await fetch(`${API_BASE_URL}/sub_types/${subTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subTypeData),
    });
    return handleResponse(response);
};

export const deleteHouseSubType = async (subTypeId) => {
    const response = await fetch(`${API_BASE_URL}/sub_types/${subTypeId}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};


// === House Type Parameters (Linking) ===

export const getParametersForHouseType = async (houseTypeId) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/parameters`);
    return handleResponse(response);
};

export const setHouseTypeParameter = async (houseTypeId, parameterId, moduleSequenceNumber, value, subTypeId = null) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            parameter_id: parameterId,
            module_sequence_number: moduleSequenceNumber,
            value: value,
            sub_type_id: subTypeId // Changed from tipologia_id
        }),
    });
    return handleResponse(response);
};

export const deleteParameterFromHouseTypeModule = async (houseTypeId, parameterId, moduleSequenceNumber, subTypeId = null) => {
    let url = `${API_BASE_URL}/house_types/${houseTypeId}/parameters/${parameterId}/module/${moduleSequenceNumber}`;
    if (subTypeId !== null) {
        url += `/sub_type/${subTypeId}`; // Changed from /tipologia/
    }
    const response = await fetch(url, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};


// === Module Production Plan ===
// (Replaces old Production Plan and Project management)

export const addModuleProductionPlanItem = async (itemData) => {
    // itemData: { project_name, house_identifier, module_number, house_type_id, sub_type_id, planned_sequence, planned_start_datetime, planned_assembly_line, status }
    const response = await fetch(`${API_BASE_URL}/module-production-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
    });
    return handleResponse(response);
};

export const addModuleProductionPlanBatch = async (batchData) => {
    // batchData: { project_name, house_type_id, number_of_houses }
    // house_identifier_base is removed from payload
    const response = await fetch(`${API_BASE_URL}/module-production-plan/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData),
    });
    return handleResponse(response);
};

export const getModuleProductionPlan = async (params = {}) => {
    // params = { projectName, houseTypeId, status, startDateAfter, subTypeId, sortBy, sortOrder, limit, offset }
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/module-production-plan?${query}`);
    return handleResponse(response);
};

export const getModuleProductionPlanItemById = async (planId) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/${planId}`);
    return handleResponse(response);
};

export const updateModuleProductionPlanItem = async (planId, updateData) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
    });
    return handleResponse(response);
};

export const deleteModuleProductionPlanItem = async (planId) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/${planId}`, {
        method: 'DELETE',
    });
     if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true;
};

export const reorderModuleProductionPlan = async (orderedPlanIds) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_plan_ids: orderedPlanIds }),
    });
    return handleResponse(response);
};

export const changeModuleProductionPlanItemsLineBulk = async (planIds, newLine) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/bulk-update-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_ids: planIds, new_line: newLine }),
    });
    return handleResponse(response);
};

export const setModuleProductionPlanItemsSubTypeBulk = async (planIds, subTypeId) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/bulk-update-sub-type`, { // URL changed
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_ids: planIds, sub_type_id: subTypeId }), // Key changed
    });
    return handleResponse(response);
};

export const setModuleProductionPlanItemsDateTimeBulk = async (planIds, newDateTime) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/bulk-update-datetime`, { // URL changed
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_ids: planIds, new_datetime: newDateTime }),
    });
    return handleResponse(response);
};

// === Potential Task Dependencies ===
export const getPotentialTaskDependencies = async (stationSequenceOrder, isPanelTask) => {
    const params = new URLSearchParams();
    if (stationSequenceOrder !== null && stationSequenceOrder !== undefined) {
        params.append('station_sequence_order', stationSequenceOrder);
    }
    if (isPanelTask !== null && isPanelTask !== undefined) {
        params.append('is_panel_task', isPanelTask);
    }
    const response = await fetch(`${API_BASE_URL}/task_definitions/potential_dependencies?${params.toString()}`);
    return handleResponse(response);
};


// === Production Status Dashboard / Station Overview ===

export const getStationStatusOverview = async () => {
    const response = await fetch(`${API_BASE_URL}/station-status-overview`); // URL changed
    return handleResponse(response);
};

export const getStationOverviewData = async (stationId, specialtyId, panelDefinitionId = null) => {
    // The endpoint /station_overview/{station_id} was replaced by /station-context/{station_id}.
    // The new endpoint does not accept specialty_id or panel_definition_id as query parameters.
    let url = `${API_BASE_URL}/station-context/${stationId}`;

    // Query parameters for specialty_id and panel_definition_id are removed as they are not used by /station-context.
    // const params = new URLSearchParams();
    // if (specialtyId !== undefined && specialtyId !== null) {
    //     params.append('specialty_id', specialtyId);
    // } else {
    //     params.append('specialty_id', 'null');
    // }
    // if (panelDefinitionId !== undefined && panelDefinitionId !== null) {
    //     params.append('panel_definition_id', panelDefinitionId);
    // }
    //
    // const queryString = params.toString();
    // if (queryString) {
    //     url += `?${queryString}`;
    // }
    const response = await fetch(url);
    return handleResponse(response);
};

export const startTask = async (planId, taskDefinitionId, workerId, stationStart, panelDefinitionId = null) => { // Renamed houseTypePanelId
    const payload = {
        plan_id: planId,
        task_definition_id: taskDefinitionId,
        worker_id: workerId,
        station_start: stationStart,
        panel_definition_id: panelDefinitionId, // Renamed key
    };

    const response = await fetch(`${API_BASE_URL}/tasks/start`, { // URL might need /admin prefix if not already in API_BASE_URL for this specific route
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};
