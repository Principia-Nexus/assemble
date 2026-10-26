// Tracks unsaved form edits so leaving a project never discards them silently.
let dirty = false;
const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
export const setDirty = (v) => {
  if (v === dirty) return;
  dirty = v;
  if (v) window.addEventListener("beforeunload", warn);
  else window.removeEventListener("beforeunload", warn);
};
export const confirmLeave = () => !dirty || window.confirm("You have unsaved edits in this project. Leave without saving?");
