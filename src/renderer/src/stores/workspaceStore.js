import { reactive } from 'vue';

export const workspaceState = reactive({
    workspaces: [],
    selectedWorkspaceId: '',
    themeCatalog: null
});

export async function refreshWorkspaces() {
    workspaceState.workspaces = await window.bfeApi.listWorkspaces();
    if (!workspaceState.selectedWorkspaceId && workspaceState.workspaces.length > 0) {
        workspaceState.selectedWorkspaceId = workspaceState.workspaces[0].id;
    }
}

export async function refreshThemeCatalog() {
    workspaceState.themeCatalog = await window.bfeApi.getThemeCatalog();
}

export function getSelectedWorkspace() {
    return workspaceState.workspaces.find((item) => item.id === workspaceState.selectedWorkspaceId);
}
