{
  const handleAttendanceLoading = () => {
    const table = document.getElementById("myTable");
    if (table) {
      table.innerHTML = "";
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.innerHTML = "<b>Loading...</b>";
    }
  };

  const handleScheduleUpdate = (e) => {
    console.log("Attendance scheduleUpdated event received", e.detail);
    updateTable(e.detail);
  };

  const dateInput = document.getElementById("dateInput");
  
  if (dateInput) dateInput.addEventListener("change", handleAttendanceLoading);
  window.addEventListener("scheduleUpdated", handleScheduleUpdate);
  window.addEventListener("scheduleLoading", handleAttendanceLoading);

  window.cleanupView = () => {
    if (dateInput) dateInput.removeEventListener("change", handleAttendanceLoading);
    window.removeEventListener("scheduleUpdated", handleScheduleUpdate);
    window.removeEventListener("scheduleLoading", handleAttendanceLoading);
  };

  function updateTable(schedule) {
    const table = document.getElementById("myTable");
    table.innerHTML = "";

    // Normalize and Filter
    const rawData = normalizeSchedule(schedule).filter(item => (!EXCLUDED_IDS.includes(item.id)));
    
    if (!rawData.length) {
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.textContent = "No Events";
      cell.style.fontWeight = "bold";
      return;
    }
    
    // --- Data Processing (Via Utils) ---
    const merged = mergeConsecutiveSlots(rawData);
    
    // --- DOM Construction ---
    
    // 1. Create Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Name", "Showed", "Notes"].forEach((text, index) => {
      const th = document.createElement("th");
      th.textContent = text;
      if (index > 0) th.style.textAlign = "center";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 2. Create Body
    const tbody = document.createElement("tbody");
    
    merged.forEach(item => {
      const tr = document.createElement("tr");

      // --- Name Cell ---
      const nameTd = document.createElement("td");
      const nameDiv = document.createElement("div");
      nameDiv.className = "text";
      
      const allCompleted = item.states.every(s => s === 'completed');
      const hasNoshow = item.states.some(s => s === 'noshowed');
      
      if (allCompleted) nameDiv.style.color = "#00833D"; // Green
      else if (hasNoshow) nameDiv.style.color = "#850000"; // Red
      else nameDiv.style.color = "#007BB4"; // Blue

      if (item.isNew) {
        const badge = document.createElement("span");
        badge.className = "badge-new";
        badge.textContent = "NEW";
        nameDiv.appendChild(badge);
        nameDiv.appendChild(document.createTextNode(" "));
      }
      nameDiv.appendChild(document.createTextNode(formatName(item.name)));
      nameTd.appendChild(nameDiv);
      tr.appendChild(nameTd);

      // --- Checkins Cell ---
      const checkinsTd = document.createElement("td");
      checkinsTd.className = "actions-cell checkins-cell";
      const checkinStack = document.createElement("div");
      checkinStack.className = "checkin-stack";

      item.vids.forEach((vid, index) => {
        const state = item.states[index];
        const isChecked = (state !== 'late_canceled' && state !== 'noshowed');

        const label = document.createElement("label");
        label.className = "checkbox-wrapper";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "custom-checkbox";
        input.dataset.role = "checkin";
        input.id = vid;
        input.dataset.state = state;
        input.dataset.eventIndex = index;
        input.checked = isChecked;

        label.appendChild(input);
        checkinStack.appendChild(label);
      });
      checkinsTd.appendChild(checkinStack);
      tr.appendChild(checkinsTd);

      // --- Notes Cell ---
      const notesTd = document.createElement("td");
      notesTd.className = "actions-cell notes-cell";
      
      const notesBtn = document.createElement("button");
      notesBtn.className = "checkIn notes-btn"; // Cleaned up class usage
      notesBtn.dataset.role = "note";
      notesBtn.id = item.id;
      notesBtn.ariaLabel = "Edit Notes";

      notesBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ffffff" viewBox="0 0 256 256"><path d="M216,40H176V24a8,8,0,0,0-16,0V40H96V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H80V72a8,8,0,0,0,16,0V56h64V72a8,8,0,0,0,16,0V56h40ZM96,120h64a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16Zm64,32H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Z"></path></svg>`;
      
      notesBtn.onclick = () => {
        const noteData = {
          id: item.id,
          name: item.name,
          fullLevel: item.fullLevel,
          age: item.age
        };
        sessionStorage.setItem("noteContext", JSON.stringify(noteData));
        navigate("notes");
      };

      notesTd.appendChild(notesBtn);
      tr.appendChild(notesTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
  };

  updateTable(sessionStorage.getItem("schedule"));

  const submitBtn = document.getElementById("submit");
  if (submitBtn) {
    submitBtn.addEventListener("click", (event) => {
      async function Attendance() {
        if (new Date() >= new Date(document.getElementById("dateInput").value)) {
          let attendance = [];
          [...document.getElementById("myTable").rows].forEach(row => {
            const checkboxes = row.querySelectorAll("input[data-role='checkin']");
            checkboxes.forEach(cb => {
              attendance.push({
                vid: cb.id,
                currentState: cb.getAttribute("data-state"),
                isChecked: cb.checked,
                eventIndex: parseInt(cb.getAttribute("data-event-index"))
              });
            });
          });

          const table = document.getElementById("myTable");
          table.innerHTML = "";
          const row = table.insertRow();
          const cell = row.insertCell();
          cell.textContent = "Attendance Submitted!";
          cell.style.fontWeight = "bold";

          const headers = {
            "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
            "Content-Type": "application/json"
          };
          
          const updates = attendance.map(item => {
            let newState;
            if (item.isChecked) {
              newState = "complete";
            } else {
              if (item.currentState === "late_canceled") {
                newState = "late_canceled"; 
              } else {
                newState = "noshow";
              }
            }
            let needsUpdate = false;
            if (newState === "complete") {
              if (item.currentState !== "completed") needsUpdate = true;
            } else if (newState === "noshow") {
              if (item.currentState !== "noshowed") needsUpdate = true;
            } else if (newState === "late_canceled") {
              needsUpdate = false;
            }
            return { ...item, newState, needsUpdate };
          }).filter(item => item.needsUpdate);

          const rounds = {};
          updates.forEach(u => {
            if (!rounds[u.eventIndex]) rounds[u.eventIndex] = [];
            rounds[u.eventIndex].push(u);
          });
          const maxIndex = Math.max(...updates.map(u => u.eventIndex), -1);

          for (let i = 0; i <= maxIndex; i++) {
            if (rounds[i]) {
              await Promise.all(rounds[i].map(async (u) => {
                if (u.currentState !== 'registered') {
                  await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${u.vid}`, {
                    method: "PUT",
                    headers,
                    body: JSON.stringify({ visit: { state_event: "reset" } })
                  });
                }
                await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${u.vid}`, {
                  method: "PUT",
                  headers,
                  body: JSON.stringify({ visit: { state_event: u.newState } })
                });
                if (u.newState === "noshow") {
                  await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/punches`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ punch: { visit_id: u.vid } })
                  });
                }
              }));
              await new Promise(r => setTimeout(r, 200));
            }
          }
          await new Promise(r => setTimeout(r, 500));
          document.getElementById("dateInput").dispatchEvent(new Event("change"));
        } else {
          const table = document.getElementById("myTable");
          table.innerHTML = "";
          const row = table.insertRow();
          const cell = row.insertCell();
          cell.textContent = "All Events Must Be In the Past";
          cell.style.fontWeight = "bold";
          
          await new Promise(r => setTimeout(r, 2000));
          updateTable(sessionStorage.getItem("schedule")); 
        }
      }
      Attendance();
    });
  }

  const resetBtn = document.getElementById("reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", (event) => {
      let attendance = [];
      [...document.getElementById("myTable").rows].forEach(row => {
        const checkboxes = row.querySelectorAll("input[data-role='checkin']");
        checkboxes.forEach(cb => {
          attendance.push({ vid: cb.id });
        });
      });
      
      async function Reset() {
        const table = document.getElementById("myTable");
        table.innerHTML = "";
        const row = table.insertRow();
        const cell = row.insertCell();
        cell.textContent = "Attendance Reset!";
        cell.style.fontWeight = "bold";
        
        await Promise.allSettled(attendance.map(visit => 
          fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${visit.vid}`, {
            body: JSON.stringify({ "visit": { "state_event": "reset" } }),
            method: "PUT",
            headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}`, "Content-Type": "application/json" },
            redirect: "follow"
          })
        ));
        await new Promise(resolve => setTimeout(resolve, 500));
        document.getElementById("dateInput").dispatchEvent(new Event("change"));
      };
      Reset();
    });
  }
}