document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});

window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});

function normalizeSchedule(scheduleData) {
  if (Array.isArray(scheduleData)) return scheduleData;
  if (typeof scheduleData === "string" && scheduleData.trim()) {
    try {
      return JSON.parse(scheduleData);
    } catch (e) {
      console.error("Unable to parse schedule", e);
    }
  }
  const stored = sessionStorage.getItem("schedule");
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { console.error("Unable to parse stored schedule", e); }
  }
  return [];
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
    if (state == "late_canceled"||state=="canceled"){
      merged.push({ start, end: blockEnd, name: "CANCELED", level: "&#12644;", New: false, age: "&#12644;" });
    } else {
      const formattedName = (s =>(w = s.trim().split(/\s+/),(w.length > 1 ? [w[0], w[w.length-1]] : [w[0]]).map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1))).join(" ")))(name);
      const nameWithBadge = New ? `<span class="badge-new">NEW</span> ${formattedName}` : formattedName;
      merged.push({ start, end: blockEnd, name: nameWithBadge, level, age });
    }
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
    if (rows.length === 1) {
      const r = rows[0];
      return [start.split(" ")[0], duration, r.name, r.level, r.age];
    }
    return [start.split(" ")[0],duration,rows.map(r => r.name),rows.map(r => r.level),rows.map(r => r.age)];
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
      let display;
      if (Array.isArray(cellData)) {
        display = cellData.map(x => {
          const content = (x === null || x === undefined) ? "" : x.toString();
          return cellIndex === 2 ? `<span class="name-text">${content}</span>` : content;
        }).join(cellIndex === 2 ? "" : "<br>");
      } else {
        const content = (cellData === null || cellData === undefined) ? "" : cellData.toString();
        display = (cellIndex === 2 && rowIndex !== 0) ? `<span class="name-text">${content}</span>` : content;
      }
      html += `<${rowIndex === 0 ? "th" : "td"}>${display}</${rowIndex === 0 ? "th" : "td"}>`;
    });
    html += "</tr>";
  });
  
  console.log(html);
  table.innerHTML = html; 
};
updateTable(sessionStorage.getItem("schedule"));
