document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});

window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    console.error("Unable to parse schedule", e);
    return null;
  }
}

function normalizeSchedule(scheduleData) {
  if (Array.isArray(scheduleData)) return scheduleData;
  if (typeof scheduleData === "string" && scheduleData.trim()) {
    const parsed = parseJson(scheduleData);
    if (parsed) return parsed;
  }
  const stored = sessionStorage.getItem("schedule");
  if (stored) return parseJson(stored) || [];
  return [];
}

function formatDisplayName(name) {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  const compact = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return compact
    .map((word) => word[0].toUpperCase() + (/^[A-Z]+$/.test(word) ? word.slice(1).toLowerCase() : word.slice(1)))
    .join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function toDisplayString(value) {
  return value === null || value === undefined ? "" : value.toString();
}

function renderNameContent(value) {
  if (Array.isArray(value)) {
    return `<div class="name-stack">${value.map(renderNameContent).join("")}</div>`;
  }
  const text = typeof value === "object" && value !== null ? toDisplayString(value.text) : toDisplayString(value);
  const badge = value && value.isNew ? '<span class="badge-new">NEW</span>' : "";
  return `<div class="name-cell"><span class="name-text">${text}</span>${badge}</div>`;
}

function updateTable(schedule) {
  const data = normalizeSchedule(schedule);
  if (!data.length) {
    document.getElementById("myTable").innerHTML = "<tr><th>No Lessons For This Day</th></tr>";
    return;
  }
  const merged = [];
  for (let i = 0; i < data.length; ) {
    const [id,,state, start, end, name, level, New, age] = data[i];
    let blockEnd = end;
    let j = i + 1;
    while (
      j < data.length &&
      data[j][0] === id &&
      data[j][5] === name &&
      data[j][3] === blockEnd // next start matches previous end
    ) {
      blockEnd = data[j][4];
      j++;
    }
    merged.push({
      start,
      end: blockEnd,
      name: state === "late_canceled" || state === "canceled" ? "CANCELED" : formatDisplayName(name),
      level,
      age,
      isNew: state === "late_canceled" || state === "canceled" ? false : Boolean(New),
    });
    i = j;
  }
  
  // 2. Group by start time
  const groups = merged.reduce((acc, r) => {
    (acc[r.start] ??= []).push(r);
    return acc;
  }, {});
  
  // 3. Build final output
  const output = Object.entries(groups).map(([start, rows]) => {
    // duration = minutes from first start to last end (if multiple)
    const duration = (new Date(`Jan 1 2000 ${rows.length === 1 ? rows[0].end : rows.at(-1).end}`) - new Date(`Jan 1 2000 ${start}`)) / 60000;
    const startTime = start.split(" ")[0];
    if (rows.length === 1) {
      const r = rows[0];
      return [startTime, duration, { text: r.name, isNew: r.isNew }, r.level, r.age];
    }
    return [
      startTime,
      duration,
      rows.map((r) => ({ text: r.name, isNew: r.isNew })),
      rows.map((r) => r.level),
      rows.map((r) => r.age),
    ];
  });
  let tableRows;

  if (output.length === 0) {
    tableRows = [["No Lessons For This Day"]];
  } else {
    tableRows = [["Start", "Min.", "Name", "Lvl", "Age"], ...output];
  }
  
  const table = document.getElementById("myTable");
  
  let html = "";
  tableRows.forEach((rowData, rowIndex) => {
    html += "<tr>";
    rowData.forEach((cellData, cellIndex) => {
      const isHeader = rowIndex === 0;
      const tag = isHeader ? "th" : "td";
      let display;

      if (!isHeader && cellIndex === 2) {
        display = renderNameContent(cellData);
      } else if (Array.isArray(cellData)) {
        display = asArray(cellData).map(toDisplayString).join("<br>");
      } else {
        display = toDisplayString(cellData);
      }

      html += `<${tag}>${display}</${tag}>`;
    });
    html += "</tr>";
  });

  table.innerHTML = html;
};
updateTable(sessionStorage.getItem("schedule"));
