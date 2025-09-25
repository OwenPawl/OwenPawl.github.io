window.addEventListener("scheduleUpdated", (e) => {
  updateTable(e.detail.map(item => item.slice(3, 9)));
});
function updateTable(schedule) {
  const data = [["start","end","name","level","new?","age"],...JSON.parse(schedule))];

  const table = document.getElementById("myTable");

  // Build HTML once for performance
  let html = "";
  data.forEach((rowData, rowIndex) => {
    html += "<tr>";
    rowData.forEach(cellData => {
      // convert everything to a string for display
      let display = (cellData === null || cellData === undefined) ? "" : cellData.toString();
      html += `<${rowIndex === 0 ? "th" : "td"}>${display}</${rowIndex === 0 ? "th" : "td"}>`;
    });
    html += "</tr>";
  });
  console.log(html);
  table.innerHTML = html;
};
updateTable(sessionStorage.getItem("schedule")).map(item=>item.slice(3,9));
