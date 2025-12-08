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
    
    // Create Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Time", "Name", "Lvl", "Age"].forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    // Convert groups to array for index tracking (striping)
    Object.entries(groups).forEach(([start, rows], groupIndex) => {
      const duration = (new Date(`Jan 1 2000 ${rows.length === 1 ? rows[0].end : rows.at(-1).end}`) - new Date(`Jan 1 2000 ${start}`)) / 60000;
      
      const stripeClass = groupIndex % 2 === 0 ? "group-even" : "group-odd";

      rows.forEach((r, idx) => {
        const tr = document.createElement("tr");
        tr.classList.add(stripeClass);
        
        // --- 1. Time Column (First row only) ---
        if (idx === 0) {
          const timeTd = document.createElement("td");
          timeTd.classList.add("time-cell");
          timeTd.style.textAlign = "center";
          
          if (rows.length > 1) {
            timeTd.style.gridRow = `span ${rows.length}`;
            timeTd.style.alignSelf = "center"; 
          }

          const timeVal = document.createElement("div");
          timeVal.textContent = start.split(" ")[0];
          timeVal.style.fontWeight = "800";
          timeTd.appendChild(timeVal);

          const durVal = document.createElement("div");
          durVal.className = "muted";
          durVal.style.fontSize = "0.85em";
          durVal.textContent = `+${duration}`;
          timeTd.appendChild(durVal);
          
          tr.appendChild(timeTd);
        }

        // --- 2. Name ---
        const nameTd = document.createElement("td");
        // Apply separator to Name, Level, and Age if it's NOT the last student
        if (rows.length > 1 && idx < rows.length - 1) nameTd.classList.add("row-separator");
        
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
        tr.appendChild(nameTd);

        // --- 3. Level ---
        const lvlTd = document.createElement("td");
        if (rows.length > 1 && idx < rows.length - 1) lvlTd.classList.add("row-separator");
        lvlTd.appendChild(document.createTextNode(r.shortLevel || ""));
        tr.appendChild(lvlTd);

        // --- 4. Age ---
        const ageTd = document.createElement("td");
        if (rows.length > 1 && idx < rows.length - 1) ageTd.classList.add("row-separator");
        ageTd.appendChild(document.createTextNode(r.age || ""));
        tr.appendChild(ageTd);

        tbody.appendChild(tr);
      });
    });

    table.appendChild(tbody);
  };
  
  updateTable(sessionStorage.getItem("schedule"));
}