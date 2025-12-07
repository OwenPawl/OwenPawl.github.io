{
  const handleTableLoading = () => {
    const table = document.getElementById("myTable");
    if (table) {
      table.innerHTML = "";
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.innerHTML = "<b>Loading...</b>";
    }
  };

  const handleTableUpdate = (e) => {
    updateTable(e.detail);
  };

  const dateInput = document.getElementById("dateInput");

  if (dateInput) dateInput.addEventListener("change", handleTableLoading);
  window.addEventListener("scheduleUpdated", handleTableUpdate);
  window.addEventListener("scheduleLoading", handleTableLoading);

  window.cleanupView = () => {
    if (dateInput) dateInput.removeEventListener("change", handleTableLoading);
    window.removeEventListener("scheduleUpdated", handleTableUpdate);
    window.removeEventListener("scheduleLoading", handleTableLoading);
  };

  function updateTable(schedule) {
    const table = document.getElementById("myTable");
    table.innerHTML = "";

    const data = normalizeSchedule(schedule);
    
    if (!data.length) {
      const row = table.insertRow();
      const cell = row.insertCell();
      cell.textContent = "No Lessons For This Day";
      cell.style.fontWeight = "bold";
      return;
    }

    // --- Data Processing (Via Utils) ---
    const mergedRaw = mergeConsecutiveSlots(data);
    
    // Post-process for "CANCELED" logic specific to this view
    const merged = mergedRaw.map(row => {
      const state = row.states[0]; // Check state of first slot in block
      if (state == "late_canceled" || state == "canceled") {
        return { 
          ...row, 
          name: "CANCELED", 
          shortLevel: "\u3164", 
          age: "\u3164",
          isNew: false 
        };
      }
      return {
        ...row,
        name: formatName(row.name)
      };
    });
    
    // Group by Start Time for visual grid
    const groups = merged.reduce((acc, r) => {
      (acc[r.start] ??= []).push(r);
      return acc;
    }, {});
    
    // Create Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Start", "Min.", "Name", "Lvl", "Age"].forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create Body
    const tbody = document.createElement("tbody");

    Object.entries(groups).forEach(([start, rows]) => {
      const duration = (new Date(`Jan 1 2000 ${rows.length === 1 ? rows[0].end : rows.at(-1).end}`) - new Date(`Jan 1 2000 ${start}`)) / 60000;
      
      const tr = document.createElement("tr");
      
      // 1. Start Time
      const startTd = document.createElement("td");
      startTd.textContent = start.split(" ")[0];
      tr.appendChild(startTd);

      // 2. Duration (Min)
      const durTd = document.createElement("td");
      durTd.textContent = duration;
      tr.appendChild(durTd);

      // 3. Name
      const nameTd = document.createElement("td");
      rows.forEach((r, idx) => {
        if (idx > 0) nameTd.appendChild(document.createElement("br"));
        
        const span = document.createElement("span");
        span.className = "name-text";
        
        if (r.isNew) {
            const badge = document.createElement("span");
            badge.className = "badge-new";
            badge.textContent = "NEW";
            span.appendChild(badge);
            span.appendChild(document.createTextNode(" "));
        }
        
        span.appendChild(document.createTextNode(r.name));
        nameTd.appendChild(span);
      });
      tr.appendChild(nameTd);

      // 4. Level
      const lvlTd = document.createElement("td");
      rows.forEach((r, idx) => {
        if (idx > 0) lvlTd.appendChild(document.createElement("br"));
        lvlTd.appendChild(document.createTextNode(r.shortLevel || ""));
      });
      tr.appendChild(lvlTd);

      // 5. Age
      const ageTd = document.createElement("td");
      rows.forEach((r, idx) => {
        if (idx > 0) ageTd.appendChild(document.createElement("br"));
        ageTd.appendChild(document.createTextNode(r.age || ""));
      });
      tr.appendChild(ageTd);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
  };
  
  updateTable(sessionStorage.getItem("schedule"));
}