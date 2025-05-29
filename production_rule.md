Production System rules:
The production system relies on gathering the right context and information to know which write operations to perform. Operators at stations must select tasks for modules/panels. It's crucial for the system to narrow down what module/panel/task to show the user in order to save time and ensure data integrity, and then also to update the relevant infromation so that we keep the context updated. 

**Producing what's not yet done for the panel / module in our station**
Generally, we should first try to see what panel/module is currently in our present station, check which of the overall set of tasks which correspond to that module/station (and to our specialty if relevant) are still not finished and offer to start those. If the user has a task in progress he should not be able to start a new one unless he finishes it or pauses it.

**Starting the process**
The root of this process is Station W1: Here we must first decide whether we're currently in the middle of producing panels for a module in progress or having to start a new module. One way in which we can solve this is by looking at the lowest planned_sequence plan_id in ModuleProductionPlan which doesn't have status = completed, and check all the PanelProductionPlan panel_plan_ids to see if they're if any of them are "planned", in which case we can offer the user the possibility to start a task for any of those panels. If they're all "in progress", it means all its pannels are already being produced and we can look at the next plan_id in ModuleProductionPlan and check the panel_plan_ids for that module, and so on.

**Keeping our data updated**
In order to keep our data updated, we want to ensure that whenever a module's or panel's tasks for a given station are all done, we automatically move it to the next station. On the same note, when a module is moved into the assembly line, all of its panels should be defined as status = 'Consumed', and both modules and panels should set their 'current_station' to null after they're finished.

If we've done things correctly, our StationContextSelector.js page should allow the worker to seamlessly be offered the right context for which to start, pause and finish tasks into, which should in turn dynamically write the correct set of instructions

**Module Station Context Determination**
Each station identifies its "current module" based on its ModuleProductionPlan status and assigned line. Only one module is active per station/line at a time. In the case of panels, each   

**Task Availability**
For the active module, only TaskDefinitions relevant to the station's sequence and the  
worker's specialty, and which are not yet Completed, are presented.

**Automated Progression**
Upon completion of all relevant tasks for a module at a given station, the module's 
status automatically advances to the next logical production stage. Completing the final assembly station  
marks the module as Completed and its panels as Consumed.