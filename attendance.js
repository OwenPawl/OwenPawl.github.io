document.getElementById("dateInput").addEventListener("change", (event) => {
  document.getElementById("myTable").innerHTML = "<tr><th>Loading...</th></tr>";
});
window.addEventListener("scheduleUpdated", (e) => {
  updateTable();
});
function updateTable(){
  const data=JSON.parse(sessionStorage.getItem("schedule")).filter(item=>(item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,''].includes(item[0]))).map(i=>i.splice(0,7));
  const merged = [];
  for (let i = 0; i < data.length; ) {
    const [id,vid,state, start, end, name, level] = data[i];
    let blockEnd = end;
    let vids = [vid];
    let states=[state];
    let j = i + 1;
    while (
      j < data.length &&
      data[j][0] === id &&
      data[j][3] === blockEnd // next start matches previous end
    ) {
      blockEnd = data[j][4];
      vids.push(data[j][1]);
      states.push(data[j][2]);
      j++;
    }
    merged.push({start,end: blockEnd,name: (s =>(w = s.trim().split(/\s+/),(w.length > 1 ? [w[0], w[w.length-1]] : [w[0]]).map(x => x[0].toUpperCase() + (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1))).join(" ")))(name),level,id,vids,states});
    i = j;
  }
  let html="";
  for (let i = 0; i < merged.length; i++){
    html+=`<tr><td>${merged[i].start.split(" ")[0]}</td><td>${merged[i].name}</td><th>`
    for (let j = 0; j < merged[i].vids.length; j++){
      html+=`<button id="${merged[i].vids[j]}" onclick='if (this.textContent === "Check In") {this.textContent = "No Show";} else {this.textContent = "Check In";}'>${(merged[i].states[j]=="noshowed")?"No Show":"Check In"}</button><br>`;
    };
    html+=`</th><th><button id="${merged[i].id}">Notes</button></th></tr>`;
  };
  console.log((merged.length>0)?html:"<tr><th>No Events</th></tr>");
  document.getElementById("myTable").innerHTML = (merged.length>0)?html:"<tr><th>No Events</th></tr>";
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  [...document.getElementById("myTable").rows].forEach(row=>{
    console.log(row.cells[2].textContent);
    console.log(row.cells[2].querySelector("button").id);
  });
});
