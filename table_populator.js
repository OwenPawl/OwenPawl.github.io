{
  const handleTableLoading = () => {
    // Look for grid container instead of table
    const container = document.getElementById("scheduleContainer");
    if (container) {
      container.innerHTML = "<div style='padding:20px; text-align:center;'><b>Loading...</b></div>";
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
    // If container doesn't exist (because HTML might still have table), create it or find wrapper
    let container = document.getElementById("scheduleContainer");
    if (!container) {
      // Logic to swap table for div if running for first time
      const table = document.getElementById("myTable");
      if (table) {
        container = document.createElement("div");
        container.id = "scheduleContainer";
        container.className = "schedule-grid";
        table.parentNode.replaceChild(container, table);
      } else {
        return; // Safety
      }
    }
    
    container.innerHTML = "";

    const data = normalizeSchedule(schedule);
    
    if (!data.length) {
      container.innerHTML = "<div style='grid-column:1/-1; padding:20px; text-align:center; font-weight:bold;'>No Lessons For This Day</div>";
      return;
    }

    const mergedRaw = mergeConsecutiveSlots(data);
    
    const merged = mergedRaw.map(row => {
      const state = row.states[0]; 
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
        name: formatName(row) 
      };
    });
    
    // Group by Start Time
    const groups = merged.reduce((acc, r) => {
      (acc[r.start] ??= []).push(r);
      return acc;
    }, {});
    
    // Create Header Row (DIVs)
    const headers = ["Time", "Name", "Lvl", "Age"];
    headers.forEach(text => {
      const headerDiv = document.createElement("div");
      headerDiv.className = "header-cell";
      headerDiv.textContent = text;
      container.appendChild(headerDiv);
    });

    // Generate Rows
    Object.entries(groups).forEach(([start, rows], groupIndex) => {
      const duration = (new Date(`Jan 1 2000 ${rows.length === 1 ? rows[0].end : rows.at(-1).end}`) - new Date(`Jan 1 2000 ${start}`)) / 60000;
      const stripeClass = groupIndex % 2 === 0 ? "group-even" : "group-odd";

      rows.forEach((r, idx) => {
        // --- 1. Time Column (First row only) ---
        if (idx === 0) {
          const timeDiv = document.createElement("div");
          timeDiv.className = `schedule-cell time-cell ${stripeClass}`;
          
          if (rows.length > 1) {
            timeDiv.style.gridRow = `span ${rows.length}`;
            timeDiv.style.alignSelf = "center"; 
          }

          const timeVal = document.createElement("div");
          timeVal.textContent = start.split(" ")[0];
          timeVal.style.fontWeight = "800";
          timeDiv.appendChild(timeVal);

          const durVal = document.createElement("div");
          durVal.className = "muted";
          durVal.style.fontSize = "0.85em";
          durVal.textContent = `+${duration}`;
          timeDiv.appendChild(durVal);
          
          container.appendChild(timeDiv);
        }

        // --- 2. Name ---
        const nameDiv = document.createElement("div");
        nameDiv.className = `schedule-cell ${stripeClass}`;
        if (rows.length > 1 && idx < rows.length - 1) nameDiv.classList.add("row-separator");
        
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
        nameDiv.appendChild(span);
        container.appendChild(nameDiv);

        // --- 3. Level ---
        const lvlDiv = document.createElement("div");
        lvlDiv.className = `schedule-cell ${stripeClass}`;
        if (rows.length > 1 && idx < rows.length - 1) lvlDiv.classList.add("row-separator");
        lvlDiv.textContent = r.shortLevel || "";
        container.appendChild(lvlDiv);

        // --- 4. Age ---
        const ageDiv = document.createElement("div");
        ageDiv.className = `schedule-cell ${stripeClass}`;
        if (rows.length > 1 && idx < rows.length - 1) ageDiv.classList.add("row-separator");
        ageDiv.textContent = r.age || "";
        container.appendChild(ageDiv);
      });
    });
  };
  
  updateTable(sessionStorage.getItem("schedule"));
}