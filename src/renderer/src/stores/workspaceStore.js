import { reactive } from 'vue';
import { useWorkspaceActions } from '../composables/useWorkspaceActions.mjs';

const workspaceActions = useWorkspaceActions();

export const workspaceState = reactive({
    workspaces: [],
    selectedWorkspaceId: '',
    themeCatalog: null,
    workspaceThemeConfirmations: {}
});

export async function refreshWorkspaces() {
    workspaceState.workspaces = await workspaceActions.listWorkspaces();
    const activeWorkspaceIds = new Set(workspaceState.workspaces.map((item) => item.id));
    for (const workspaceId of Object.keys(workspaceState.workspaceThemeConfirmations)) {
        if (!activeWorkspaceIds.has(workspaceId)) {
            delete workspaceState.workspaceThemeConfirmations[workspaceId];
        }
    }
    const selectedExists = workspaceState.workspaces.some((item) => item.id === workspaceState.selectedWorkspaceId);
    if (!selectedExists) {
        workspaceState.selectedWorkspaceId = '';
    }
    if (!workspaceState.selectedWorkspaceId && workspaceState.workspaces.length > 0) {
        workspaceState.selectedWorkspaceId = workspaceState.workspaces[0].id;
    }
}

export async function refreshThemeCatalog() {
    workspaceState.themeCatalog = await workspaceActions.getThemeCatalog();
}

export function getSelectedWorkspace() {
    return workspaceState.workspaces.find((item) => item.id === workspaceState.selectedWorkspaceId);
}

export function getWorkspaceThemeConfirmation(workspaceId) {
    if (!workspaceId) {
        return null;
    }
    return workspaceState.workspaceThemeConfirmations[workspaceId] || null;
}

export function confirmWorkspaceSupportedTheme(workspaceId, themeId) {
    if (!workspaceId || !themeId) {
        return;
    }
    workspaceState.workspaceThemeConfirmations[workspaceId] = {
        kind: 'supported',
        themeId
    };
}

export function confirmWorkspaceUnsupportedTheme(workspaceId, originalTheme) {
    if (!workspaceId) {
        return;
    }
    workspaceState.workspaceThemeConfirmations[workspaceId] = {
        kind: 'unsupported',
        originalTheme: originalTheme || 'custom'
    };
}
