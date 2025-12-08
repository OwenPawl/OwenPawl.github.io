{
  // --- STATE MANAGEMENT ---
  // We use a Map to store the current state of every visit, decoupled from the DOM.
  // Key: vid (string), Value: { currentState, originalState, eventIndex }
  const visitState = new Map();

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
    // When fresh data comes in, we must rebuild our state map
    updateTable(e.detail);
  };

  const handleInteraction = (e) => {
    // Event Delegation: Listen for changes on the table, not individual inputs
    if (e.target.matches("input[data-role='checkin']")) {
      const vid = e.target.id;
      const isChecked = e.target.checked;
      
      if (visitState.has(vid)) {
        const record = visitState.get(vid);
        
        // Determine the simplified visual state based on the checkbox
        // Note: The actual Pike13 state logic (noshow vs late_canceled) is handled in Submit
        record.isChecked = isChecked;
        
        // Update the Map
        visitState.set(vid, record);
      }
    }
  };

  // --- INIT & CLEANUP ---
  const dateInput = document.getElementById("dateInput");
  const table = document.getElementById("myTable");

  if (dateInput) dateInput.addEventListener("change", handleAttendanceLoading);
  if (table) table.addEventListener("change", handleInteraction);
  
  window.addEventListener("scheduleUpdated", handleScheduleUpdate);
  window.addEventListener("scheduleLoading", handleAttendanceLoading);

  window.cleanupView = () => {
    if (dateInput) dateInput.removeEventListener("change", handleAttendanceLoading);
    if (table) table.removeEventListener("change", handleInteraction);
    window.removeEventListener("scheduleUpdated", handleScheduleUpdate);
    window.removeEventListener("scheduleLoading", handleAttendanceLoading);
    visitState.clear();
  };

  // --- RENDER LOGIC ---

  function updateTable(schedule) {
    const table = document.getElementById("myTable");
    table.innerHTML = "";
    visitState.clear(); // Reset state on new data load

    const rawData = normalizeSchedule(schedule).filter(item => (!EXCLUDED_IDS.includes(item.id)));
    
    if (!rawData.length) {
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.textContent = "No Events";
      cell.style.fontWeight = "bold";
      return;
    }
    
    // Merge slots using the utility
    const merged = mergeConsecutiveSlots(rawData);
    
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
      
      if (allCompleted) nameDiv.style.color = "#00833D"; 
      else if (hasNoshow) nameDiv.style.color = "#850000"; 
      else nameDiv.style.color = "#007BB4"; 

      if (item.isNew) {
        const badge = document.createElement("span");
        badge.className = "badge-new";
        badge.textContent = "NEW";
        nameDiv.appendChild(badge);
        nameDiv.appendChild(document.createTextNode(" "));
      }
      nameDiv.textContent += formatName(item.name); // Safer than InnerHTML/TextNode mix
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

        // Populate State Map
        visitState.set(vid.toString(), {
          vid: vid.toString(),
          originalState: state, // Store the API state
          isChecked: isChecked, // Store the UI state
          eventIndex: index
        });

        const label = document.createElement("label");
        label.className = "checkbox-wrapper";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "custom-checkbox";
        input.dataset.role = "checkin";
        input.id = vid;
        // We no longer store data attributes for logic, only for UI identification
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
      notesBtn.className = "checkIn notes-btn";
      notesBtn.dataset.role = "note";
      notesBtn.ariaLabel = "Edit Notes";
      notesBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#ffffff" viewBox="0 0 256 256"><path d="M216,40H176V24a8,8,0,0,0-16,0V40H96V24a8,8,0,0,0-16,0V40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H80V72a8,8,0,0,0,16,0V56h64V72a8,8,0,0,0,16,0V56h40ZM96,120h64a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16Zm64,32H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Z"></path></svg>`;
      
      notesBtn.onclick = () => {
        sessionStorage.setItem("noteContext", JSON.stringify({
          id: item.id,
          name: item.name,
          fullLevel: item.fullLevel,
          age: item.age
        }));
        navigate("notes");
      };

      notesTd.appendChild(notesBtn);
      tr.appendChild(notesTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
  }

  updateTable(sessionStorage.getItem("schedule"));

  // --- SUBMIT LOGIC (Refactored) ---
  const submitBtn = document.getElementById("submit");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const dateVal = document.getElementById("dateInput").value;
      
      // Validation: Future dates
      if (new Date() < new Date(dateVal)) {
         updateTable(sessionStorage.getItem("schedule")); // Reset view
         const table = document.getElementById("myTable");
         // Quick UI feedback
         const row = table.insertRow(0);
         const cell = row.insertCell();
         cell.colSpan = 3;
         cell.textContent = "Cannot submit future attendance";
         cell.style.fontWeight = "bold";
         cell.style.color = "#850000";
         await new Promise(r => setTimeout(r, 2000));
         updateTable(sessionStorage.getItem("schedule"));
         return;
      }

      // UI Feedback
      const table = document.getElementById("myTable");
      table.innerHTML = "";
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.textContent = "Attendance Submitted!";
      cell.style.fontWeight = "bold";

      // Calculate Diff using State Map
      const updates = [];
      for (const record of visitState.values()) {
        const { vid, originalState, isChecked, eventIndex } = record;
        
        let newState;
        if (isChecked) {
          newState = "complete";
        } else {
          // Preserve late_canceled if it was already that way, otherwise mark noshow
          if (originalState === "late_canceled") {
            newState = "late_canceled"; 
          } else {
            newState = "noshow";
          }
        }

        let needsUpdate = false;
        if (newState === "complete") {
          if (originalState !== "completed") needsUpdate = true;
        } else if (newState === "noshow") {
          if (originalState !== "noshowed") needsUpdate = true;
        }
        // late_canceled never needs update in this logic flow as we don't change it to late_canceled, we just preserve it.

        if (needsUpdate) {
          updates.push({ vid, newState, originalState, eventIndex });
        }
      }

      // Process Updates
      const headers = {
        "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
        "Content-Type": "application/json"
      };

      // Group by event index to handle multi-lesson blocks nicely
      const rounds = {};
      updates.forEach(u => {
        if (!rounds[u.eventIndex]) rounds[u.eventIndex] = [];
        rounds[u.eventIndex].push(u);
      });
      
      // PARALLEL EXECUTION OF EVENTS, SEQUENTIAL EXECUTION OF STUDENTS WITHIN EVENT
      // This ensures we don't hit race conditions for a single event, but keeps the app fast.
      await Promise.all(Object.values(rounds).map(async (group) => {
          for (const u of group) {
            // If strictly needed to reset before changing state (Pike13 quirk)
            if (u.originalState !== 'registered') {
              await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${u.vid}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ visit: { state_event: "reset" } })
              }).catch(e => console.error(e));
            }
            
            await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${u.vid}`, {
              method: "PUT",
              headers,
              body: JSON.stringify({ visit: { state_event: u.newState } })
            }).catch(e => console.error(e));

            if (u.newState === "noshow") {
              await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/punches`, {
                method: "POST",
                headers,
                body: JSON.stringify({ punch: { visit_id: u.vid } })
              }).catch(e => console.error(e));
            }
          }
      }));
      
      await new Promise(r => setTimeout(r, 500));
      document.getElementById("dateInput").dispatchEvent(new Event("change"));
    });
  }

  // --- RESET LOGIC ---
  const resetBtn = document.getElementById("reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      // Gather VIDs directly from state
      const vidsToReset = Array.from(visitState.keys());
      
      const table = document.getElementById("myTable");
      table.innerHTML = "";
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.textContent = "Attendance Reset!";
      cell.style.fontWeight = "bold";
      
      await Promise.allSettled(vidsToReset.map(vid => 
        fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/visits/${vid}`, {
          body: JSON.stringify({ "visit": { "state_event": "reset" } }),
          method: "PUT",
          headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}`, "Content-Type": "application/json" },
          redirect: "follow"
        })
      ));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      document.getElementById("dateInput").dispatchEvent(new Event("change"));
    });
  }
}