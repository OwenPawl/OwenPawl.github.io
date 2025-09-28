window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});

function getDuration(start, end) {
  const st = new Date(start);
  const en = new Date(end);
  if (isNaN(st) || isNaN(en)) return "";
  let diff = (en - st) / 1000; // in seconds
  if (diff < 60) return `${Math.round(diff)} sec`;
  if (diff < 3600) return `${Math.round(diff/60)} min`;
  return `${(diff/3600).toFixed(1)} hr`;
}

function updateTable(schedule) {
  // Robust JSON parsing with error handling
  let rawData = [];
  try {
    rawData = JSON.parse(sessionStorage.getItem("schedule") || "[]") || [];
  } catch (err) {
    console.error('Could not parse schedule JSON:', sessionStorage.getItem("schedule"), err);
    rawData = [];
  }

  // Group by start time, but for consecutive events with the same person, handle specially
  // Each item: [start, end, name, level, new?, age]
  const rows = rawData.map(x => x.slice(3, 9));
  let grouped = {};

  // Group by start time, but preserve sequence info for consecutive same-person events
  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const start = item[0];
    if (!grouped[start]) grouped[start] = [];
    grouped[start].push({ idx: i, data: item });
  }

  // Prepare table header (FIX: duration instead of end)
  const data = [
    ["start", "duration", "name", "level", "new?", "age"],
  ];

  // For each group (start time)
  for (const group of Object.values(grouped)) {
    // All start times in group are identical by construction
    const start = group[0].data[0];
    const end = group[0].data[1];

    // If all end times in group are the same, use one value
    const allEndsSame = group.every(e => e.data[1] === end);

    // Compute duration
    const duration = getDuration(start, end);

    // Now, for each column after duration (name, level, new?, age): 
    // - Concatenate consecutive same-person events with no break
    // - Otherwise, join by <br>

    // We'll build arrays for each of the columns (name, level, new?, age)
    const cols = [[], [], [], []];
    for (let i = 0; i < group.length; i++) {
      const cur = group[i].data;
      // For consecutive same-person, concatenate details
      if (i > 0 && cur[2] === group[i-1].data[2]) {
        // Concat to previous (no break)
        for (let c = 0; c < 4; c++) {
          cols[c][cols[c].length-1] += ' ' + (cur[c+2] ?? '');
        }
      } else {
        // New person or first row: push as new entry
        for (let c = 0; c < 4; c++) {
          cols[c].push(cur[c+2] ?? '');
        }
      }
    }
    // Now join columns with <br>
    const finalCols = cols.map(arr => arr.join('<br>'));

    // Push this row: [start, duration, ...finalCols]
    data.push([
      start,
      duration,
      ...finalCols
    ]);
  }

  const table = document.getElementById("myTable");

  // Build HTML for the table
  let html = "";
  data.forEach((rowData, rowIndex) => {
    html += "<tr>";
    rowData.forEach(cellData => {
      let display = (cellData === null || cellData === undefined) ? "" : cellData.toString();
      html += `<${rowIndex === 0 ? "th" : "td"}>${display}</${rowIndex === 0 ? "th" : "td"}>`;
    });
    html += "</tr>";
  });

  table.innerHTML = html;
}

updateTable(sessionStorage.getItem("schedule"));
