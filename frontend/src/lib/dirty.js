// Tracks unsaved form edits so leaving a project never discards them silently.
let dirty = false;
export const setDirty = (v) => { dirty = v; };
export const confirmLeave = () => !dirty || window.confirm("You have unsaved edits in this project. Leave without saving?");
