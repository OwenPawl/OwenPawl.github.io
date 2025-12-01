const normalizeSchedule = (scheduleData) => {
  const parse = (value) => { try { return value && JSON.parse(value); } catch (e) { console.error("Unable to parse schedule", e); } };
  if (Array.isArray(scheduleData)) return scheduleData;
  return parse(typeof scheduleData === "string" ? scheduleData.trim() : null) ?? parse(sessionStorage.getItem("schedule")) ?? [];
};

const showLoading = (tableId) => {
  const table = document.getElementById(tableId);
  if (table) table.innerHTML = "<tr><th>Loading...</th></tr>";
};

const formatName = (name = "") => {
  const parts = (name.trim().split(/\s+/).length > 1)
    ? [name.trim().split(/\s+/)[0], name.trim().split(/\s+/).at(-1)]
    : [name.trim()];
  return parts.filter(Boolean).map((part) => part[0].toUpperCase() + (/^[A-Z]+$/.test(part) ? part.slice(1).toLowerCase() : part.slice(1))).join(" ");
};
