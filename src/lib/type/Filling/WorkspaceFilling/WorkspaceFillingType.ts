import type {ScarfSettingsType} from "$lib/type/Settings/ScarfSettings/ScarfSettingsType.js";

/**
 * Fillings for the workspace determining position and width (via grid columns) of items in the workspace.
 * Such as scarf plots, loading screens, and empty spaces.
 */
export interface WorkspaceFillingType {
    id: number;
    size: 'small' | 'medium' | 'large';
    position: 'left' | 'right' | 'center';
    content: 'load' | 'empty' | 'alone-enforcer' | ScarfSettingsType;
    isAlone: boolean;
}