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
      html+=`<button style="font-size: 16px" id="${merged[i].vids[j]}" data-state="${merged[i].states[j]}" onclick='if (this.textContent === "Check In") {this.textContent = "No Show";} else {this.textContent = "Check In";}'>${(merged[i].states[j]=="noshowed")?"No Show":"Check In"}</button><br>`;
    };
    html+=`</th><th><button style="font-size: 16px" onclick="location.href='https://mcdonaldswimschool.pike13.com/people/${merged[i].id}/notes';" id="${merged[i].id}">Notes</button></th></tr>`;
  };
  console.log((merged.length>0)?html:"<tr><th>No Events</th></tr>");
  document.getElementById("myTable").innerHTML = (merged.length>0)?html:"<tr><th>No Events</th></tr>";
};
updateTable();
document.getElementById("submit").addEventListener("click", (event) => {
  let attendance=[];
  [...document.getElementById("myTable").rows].forEach(row=>{
    attendance=attendance.concat(([...row.cells[2].querySelectorAll("button")].map(btn=>({vid:btn.id,state:btn.getAttribute("data-state"),type:btn.textContent}))));
  });
  console.log(attendance);
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Attendance(){
    document.getElementById("myTable").innerHTML = "<tr><th>Attendance Submitted!</th></tr>";
    await Promise.allSettled(attendance.filter(visit=>(visit.type=="Check In"?"complete":"noshow")!=visit.state&&visit.state!="registered").map(visit=>fetch(desk+`visits/${visit.vid}`,{body:JSON.stringify({"visit":{"state_event":"reset"}}),method:"PUT",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"})));
    await Promise.allSettled(attendance.filter(visit=>visit.type=="Check In"?"complete":"noshow"!=visit.state).map(visit=>fetch(desk+`visits/${visit.vid}`,{body:JSON.stringify({"visit":{"state_event":visit.type=="Check In"?"complete":"noshow"}}),method:"PUT",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"})));
    await Promise.allSettled(attendance.filter(visit=>visit.type=="No Show"&&visit.state!="noshow").map(visit=>fetch(desk+`punches`,{body:JSON.stringify({"punch":{"visit_id":visit.vid}}),method:"POST",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"})));
    await new Promise(resolve => setTimeout(resolve, 500));
    document.getElementById("dateInput").dispatchEvent(new Event("change"));
  };
  if (new Date()>new Date(document.getElementById("dateInput").value+" "+JSON.parse(sessionStorage.getItem("schedule")).filter(item=>(item[2]!="late_canceled"&&![11485475,11559838,13602611,13167161,''].includes(item[0]))).map(i=>i[4]).at(-1))){
    Attendance();
  }else{
    document.getElementById("myTable").innerHTML = "<tr><th>All Events Must Be In the Past</th></tr>";
    await new Promise(resolve => setTimeout(resolve, 1000));
    updateTable();
  }
});
document.getElementById("reset").addEventListener("click", (event) => {
  let attendance=[];
  [...document.getElementById("myTable").rows].forEach(row=>{
    attendance=attendance.concat(([...row.cells[2].querySelectorAll("button")].map(btn=>({vid:btn.id,state:btn.getAttribute("data-state"),type:btn.textContent}))));
  });
  console.log(attendance);
  const desk="https://mcdonaldswimschool.pike13.com/api/v2/desk/";
  async function Reset(){
    document.getElementById("myTable").innerHTML = "<tr><th>Attendance Reset!</th></tr>";
    await Promise.allSettled(attendance.map(visit=>fetch(desk+`visits/${visit.vid}`,{body:JSON.stringify({"visit":{"state_event":"reset"}}),method:"PUT",headers: {"Authorization": `Bearer ${localStorage.getItem("access_token")}`,"Content-Type": "application/json"},redirect: "follow"})));
    await new Promise(resolve => setTimeout(resolve, 500));
    document.getElementById("dateInput").dispatchEvent(new Event("change"));
  };
  Reset();
});
