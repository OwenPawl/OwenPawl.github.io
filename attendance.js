document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});
window.addEventListener("scheduleUpdated", (e) => {
  updateTable();
});
function updateTable(){
  const schedule = sessionStorage.getItem("schedule")
  const rows=JSON.parse(schedule).filter(item=>(item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,''].includes(item[0]))).map(i=>[i[0],i[1],i[2],i[3].split(" ")[0],i[5]]);
  let html="";
  for (let i = 0; i < rows.length; i++){
    html+="<tr>"
    for (let j = 3; j < rows[i].length; j++){
      html+=`<td>${rows[i][j]}</td>`
    }
    html+=`<th><button id="${rows[i][1]}" onclick='if (this.textContent === "Check In") {this.textContent = "No Show";} else {this.textContent = "Check In";}'>${(rows[i][2]=="noshowed")?"No Show":"Check In"}</button></th>`
    html+="</tr>"
  }
  console.log((rows.length>0)?html:"<tr><th>No Events</th></tr>");
  document.getElementById("myTable").innerHTML = (rows.length>0)?html:"<tr><th>No Events</th></tr>";
};
updateTable();
document.getElementById("submit").addEventListener("onclick", (event) => {
  [...document.getElementById("myTable").rows].forEach(row=>{
    console.log(row.cells[2].textContent);
    console.log(row.cells[2].querySelector("button").id);
  });
});
