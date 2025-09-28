window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail);
});

function updateTable(schedule) {
  // Robust JSON parsing with error handling
  let rawData = [];
  try {
    rawData = JSON.parse(sessionStorage.getItem("schedule") || "[]") || [];
  } catch (err) {
    console.error('Could not parse schedule JSON:', sessionStorage.getItem("schedule"), err);
    rawData = [];
  }

  // Group by start time (index 0 of each item after slicing)
  const grouped = {};
  for (const item of rawData.map(x => x.slice(3, 9))) {
    const start = item[0];
    if (!grouped[start]) grouped[start] = [];
    grouped[start].push(item);
  }

  // Prepare table rows: first row is header, then group rows by start time
  const data = [
    ["start", "end", "name", "level", "new?", "age"],
    ...Object.values(grouped).map(group => {
      // For each column, join all values with <br> if multiple exist
      return group[0].map((_, colIdx) =>
        group.map(row => row[colIdx] ?? "").join("<br>")
      );
    })
  ];

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
