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

// Mock data store for getAvailablePanelsForStation
// This is a simple in-memory store to simulate backend changes.
// In a real app, this state would live on the backend.
let mockModulesDataStore = {
    'W1': [
        {
            module_id: "mod123_w1", // Unique ID for W1's context
            module_name: "Modulo Alpha (Casa X - M1)",
            project_name: "Proyecto Sol",
            house_identifier: "Casa X",
            module_number: "M1",
            status: "pending", 
            sequence_number: 1,
            panels: [
                { panel_id: "panelA_w1", panel_code: "P01-A", status: "not_started", sequence: 1 },
                { panel_id: "panelB_w1", panel_code: "P01-B", status: "not_started", sequence: 2 }
            ]
        },
        {
            module_id: "mod456_w1",
            module_name: "Modulo Beta (Casa Y - M2)",
            project_name: "Proyecto Luna",
            house_identifier: "Casa Y",
            module_number: "M2",
            status: "pending",
            sequence_number: 2,
            panels: [
                { panel_id: "panelC_w1", panel_code: "P02-C", status: "not_started", sequence: 1 },
            ]
        },
        {
            module_id: "mod789_w1",
            module_name: "Modulo Gamma (Casa Z - M3)",
            project_name: "Proyecto Estrella",
            house_identifier: "Casa Z",
            module_number: "M3",
            status: "completed", 
            sequence_number: 3,
            panels: [
                { panel_id: "panelD_w1", panel_code: "P03-D", status: "completed", sequence: 1 },
            ]
        }
    ],
    'W2': [
        {
            module_id: "mod123_w2", // Potentially different module ID if context is different
            module_name: "Modulo Alpha (Casa X - M1) @ W2", // Name might reflect station context
            project_name: "Proyecto Sol",
            house_identifier: "Casa X",
            module_number: "M1",
            status: "in_production", 
            sequence_number: 1,
            panels: [
                { panel_id: "panelA_w2", panel_code: "P01-A", status: "in_progress", sequence: 1 }, 
                { panel_id: "panelB_w2", panel_code: "P01-B", status: "not_started", sequence: 2 }
            ]
        }
    ],
    // Add more stations as needed
};


export const getAvailablePanelsForStation = async (stationId) => {
    console.log(`adminService.getAvailablePanelsForStation called for stationId: ${stationId}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

    // Return a deep copy to prevent direct modification of the mock store from outside
    const stationData = mockModulesDataStore[stationId] || [];
    return JSON.parse(JSON.stringify(stationData));
};

const updatePanelStatusInDataStore = (stationId, moduleId, panelId, newStatus) => {
    if (mockModulesDataStore[stationId]) {
        const module = mockModulesDataStore[stationId].find(m => m.module_id === moduleId);
        if (module) {
            const panel = module.panels.find(p => p.panel_id === panelId);
            if (panel) {
                panel.status = newStatus;
                // If a panel starts, update module status to 'in_production' if it's 'pending'
                if (newStatus === 'in_progress' && module.status === 'pending') {
                    module.status = 'in_production';
                }
                return true;
            }
        }
    }
    return false;
};

const updateModuleStatusInDataStore = (stationId, moduleId, newStatus) => {
    // Note: This simple mock assumes module IDs are unique across stations in the store,
    // or that we only care about the first station that has it.
    // A more robust mock might need to iterate through all station data if moduleId isn't station-specific.
    let stationsToSearch = stationId ? [stationId] : Object.keys(mockModulesDataStore);

    for (const sId of stationsToSearch) {
        if (mockModulesDataStore[sId]) {
            const module = mockModulesDataStore[sId].find(m => m.module_id === moduleId);
            if (module) {
                module.status = newStatus;
                // If module is completed, ensure all its panels are also marked completed (consistency)
                if (newStatus === 'completed') {
                    module.panels.forEach(p => p.status = 'completed');
                }
                return true;
            }
        }
    }
    return false;
};


export const startPanel = async (stationId, moduleId, panelId) => {
    console.log(`adminService.startPanel: stationId=${stationId}, moduleId=${moduleId}, panelId=${panelId}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (Math.random() < 0.05) { // Simulate a 5% chance of error
        console.error("Simulated API Error in startPanel");
        throw new Error("Simulated API Error: Could not start panel.");
    }

    const updated = updatePanelStatusInDataStore(stationId, moduleId, panelId, 'in_progress');
    if (updated) {
        return { success: true, message: `Panel ${panelId} started`, panel_id: panelId, new_status: "in_progress" };
    }
    throw new Error(`Panel ${panelId} or Module ${moduleId} not found in station ${stationId} for starting.`);
};

export const pausePanel = async (stationId, moduleId, panelId) => {
    console.log(`adminService.pausePanel: stationId=${stationId}, moduleId=${moduleId}, panelId=${panelId}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    const updated = updatePanelStatusInDataStore(stationId, moduleId, panelId, 'paused');
     if (updated) {
        return { success: true, message: `Panel ${panelId} paused`, panel_id: panelId, new_status: "paused" };
    }
    throw new Error(`Panel ${panelId} or Module ${moduleId} not found in station ${stationId} for pausing.`);
};

export const resumePanel = async (stationId, moduleId, panelId) => {
    console.log(`adminService.resumePanel: stationId=${stationId}, moduleId=${moduleId}, panelId=${panelId}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    const updated = updatePanelStatusInDataStore(stationId, moduleId, panelId, 'in_progress');
    if (updated) {
        return { success: true, message: `Panel ${panelId} resumed`, panel_id: panelId, new_status: "in_progress" };
    }
    throw new Error(`Panel ${panelId} or Module ${moduleId} not found in station ${stationId} for resuming.`);
};

export const finishPanel = async (stationId, moduleId, panelId) => {
    console.log(`adminService.finishPanel: stationId=${stationId}, moduleId=${moduleId}, panelId=${panelId}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    const updated = updatePanelStatusInDataStore(stationId, moduleId, panelId, 'completed');

    if (updated) {
         // Check if all panels in this module are now completed
        const module = mockModulesDataStore[stationId]?.find(m => m.module_id === moduleId);
        if (module && module.panels.every(p => p.status === 'completed')) {
            console.log(`All panels for module ${moduleId} completed. Updating module status in mock store.`);
            updateModuleStatusInDataStore(stationId, moduleId, 'completed'); // Mark module as completed
        }
        return { success: true, message: `Panel ${panelId} finished`, panel_id: panelId, new_status: "completed" };
    }
    throw new Error(`Panel ${panelId} or Module ${moduleId} not found in station ${stationId} for finishing.`);
};

export const updateModuleStatus = async (moduleId, status) => {
    // This mock assumes moduleId is globally unique or we update it wherever we find it.
    // StationContextSelector currently calls this without stationId, so we search all stations.
    console.log(`adminService.updateModuleStatus: moduleId=${moduleId}, newStatus=${status}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const updated = updateModuleStatusInDataStore(null, moduleId, status); // Pass null for stationId to search all
    
    if (updated) {
        return { success: true, message: `Module ${moduleId} status updated to ${status}`, module_id: moduleId, new_status: status };
    }
    // If you want to be strict and only allow updates if the module exists:
    console.warn(`Module ${moduleId} not found in any station data store for status update, but reporting success as per mock.`);
    // To simulate a case where the module MUST exist for an update to be "successful":
    // throw new Error(`Module ${moduleId} not found for status update.`); 
    // For now, let's assume the backend would create/update, so we report success.
    return { success: true, message: `Module ${moduleId} status update to ${status} (simulated, module might not exist in current mock view for a specific station but assumed globally updated).`, module_id: moduleId, new_status: status };
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
    let url = `${API_BASE_URL}/station_overview/${stationId}`;
    const params = new URLSearchParams();
    if (specialtyId !== undefined && specialtyId !== null) {
        params.append('specialty_id', specialtyId);
    } else {
        params.append('specialty_id', 'null');
    }
    if (panelDefinitionId !== undefined && panelDefinitionId !== null) {
        params.append('panel_definition_id', panelDefinitionId);
    }
    
    const queryString = params.toString();
    if (queryString) {
        url += `?${queryString}`;
    }
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
