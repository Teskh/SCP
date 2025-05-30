// Using fetch API. Replace with Axios if preferred.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/admin';

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


export const getTasksForPanel = async (planId, panelDefinitionId) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/${planId}/panel/${panelDefinitionId}/tasks`);
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

// === Panel Definitions ===

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
    const response = await fetch(`${API_BASE_URL}/panel_definitions/${panelDefinitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deletePanelDefinition = async (panelDefinitionId) => {
    const response = await fetch(`${API_BASE_URL}/panel_definitions/${panelDefinitionId}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; 
};

// === Multiwalls ===
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
        is_panel_task: Boolean(taskDefData.is_panel_task)
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
        is_panel_task: Boolean(taskDefData.is_panel_task)
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
            sub_type_id: subTypeId
        }),
    });
    return handleResponse(response);
};

export const deleteParameterFromHouseTypeModule = async (houseTypeId, parameterId, moduleSequenceNumber, subTypeId = null) => {
    let url = `${API_BASE_URL}/house_types/${houseTypeId}/parameters/${parameterId}/module/${moduleSequenceNumber}`;
    if (subTypeId !== null) {
        url += `/sub_type/${subTypeId}`;
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
    const response = await fetch(`${API_BASE_URL}/module-production-plan/bulk-update-sub-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_ids: planIds, sub_type_id: subTypeId }),
    });
    return handleResponse(response);
};

export const setModuleProductionPlanItemsDateTimeBulk = async (planIds, newDateTime) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/bulk-update-datetime`, {
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
    const response = await fetch(`${API_BASE_URL}/station-status-overview`);
    return handleResponse(response);
};

export const getInfoForNextModulePanels = async () => {
    const response = await fetch(`${API_BASE_URL}/panel-production/info-for-next-module`);
    return handleResponse(response);
};

export const getCurrentStationPanels = async (stationId) => {
    const response = await fetch(`${API_BASE_URL}/stations/${stationId}/current-panels`);
    return handleResponse(response);
};


export const startTask = async (planId, taskDefinitionId, workerId, stationStart) => {
    const payload = {
        plan_id: planId,
        task_definition_id: taskDefinitionId,
        worker_id: workerId,
        station_start: stationStart,
    };

    const response = await fetch(`${API_BASE_URL}/tasks/start`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const pauseTask = async (planId, taskDefinitionId, workerId, reason = '') => {
    const payload = {
        plan_id: planId,
        task_definition_id: taskDefinitionId,
        worker_id: workerId,
        reason: reason,
    };

    const response = await fetch(`${API_BASE_URL}/tasks/pause`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const resumeTask = async (planId, taskDefinitionId) => {
    const payload = {
        plan_id: planId,
        task_definition_id: taskDefinitionId,
    };

    const response = await fetch(`${API_BASE_URL}/tasks/resume`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const completeTask = async (planId, taskDefinitionId, stationFinish, notes = '') => {
    const payload = {
        plan_id: planId,
        task_definition_id: taskDefinitionId,
        station_finish: stationFinish,
        notes: notes,
    };

    const response = await fetch(`${API_BASE_URL}/tasks/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};
