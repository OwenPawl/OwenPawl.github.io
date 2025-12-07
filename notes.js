(function() {
  const noteData = JSON.parse(sessionStorage.getItem("noteContext") || "{}");
  const { id, name, fullLevel, age } = noteData;

  // --- CLEANUP LOGIC ---
  // Notes view doesn't attach global listeners, but we define cleanupView 
  // to ensure previous cleanups (from other views) are replaced.
  window.cleanupView = () => {
    // No global listeners to remove for notes view currently
  };

  function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  }

  function normalize(str) {
    return str ? str.toLowerCase().trim() : "";
  }

  if (!id) {
    navigate("attendance");
    return;
  }

  document.getElementById("noteTitle").textContent = `Notes for ${name}`;

  // --- UNIFIED STORAGE ---
  const scheduleData = normalizeSchedule(null); 
  
  const uniqueStudents = [];
  const seenIds = new Set();
  
  scheduleData.forEach(row => {
    const sId = row.id;
    const sName = row.name;
    const sFullLevel = row.fullLevel;
    const sAge = row.age;
    
    if (!EXCLUDED_IDS.includes(sId) && !seenIds.has(sId)) {
      seenIds.add(sId);
      uniqueStudents.push({ id: sId, name: sName, fullLevel: sFullLevel, age: sAge });
    }
  });

  const currentIndex = uniqueStudents.findIndex(s => s.id === id);
  const nextBtn = document.getElementById("nextStudent");

  if (currentIndex !== -1 && currentIndex < uniqueStudents.length - 1) {
    nextBtn.style.display = "inline-flex";
    const newBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newBtn, nextBtn);
    
    newBtn.addEventListener("click", () => {
      const nextStudent = uniqueStudents[currentIndex + 1];
      sessionStorage.setItem("noteContext", JSON.stringify(nextStudent));
      navigate("notes");
    });
  } else {
    nextBtn.style.display = "none";
  }

  // --- LEVEL DROPDOWN LOGIC ---
  const levelSelect = document.getElementById("levelSelect");
  levelSelect.innerHTML = "";
  
  const skillKeys = Object.keys(SKILLS);
  
  let currentDisplayLevel = fullLevel;
  let isLocked = false;
  let lockedText = "";
  let lockedSkillsKey = "";

  if (age < 2) {
    isLocked = true;
    lockedText = "Baby (0-2 years)";
    lockedSkillsKey = "Baby (0-2 years)";
  } else if (age < 4) {
    isLocked = true;
    lockedText = "Tots (2-4 years)";
    lockedSkillsKey = "Tots (2-4 years)";
  } else {
    isLocked = false;
    const dropdownOptions = skillKeys.filter(k => 
      !k.toLowerCase().includes("baby") && 
      !k.toLowerCase().includes("tots")
    );

    dropdownOptions.forEach(lvl => {
      const opt = document.createElement("option");
      opt.value = lvl;
      opt.textContent = lvl;
      levelSelect.appendChild(opt);
    });

    const target = normalize(fullLevel);
    let match = dropdownOptions.find(l => normalize(l) === target);

    if (match) {
      levelSelect.value = match;
    } else {
      const defaultLvl = dropdownOptions.find(l => l.toLowerCase().includes("level 1")) || dropdownOptions[0];
      levelSelect.value = defaultLvl;
    }
  }

  if (isLocked) {
    levelSelect.style.display = "none";
    let staticLabel = document.getElementById("staticLevelLabel");
    if (!staticLabel) {
      staticLabel = document.createElement("div");
      staticLabel.id = "staticLevelLabel";
      staticLabel.className = "pill"; 
      staticLabel.style.marginBottom = "4px";
      levelSelect.parentNode.insertBefore(staticLabel, levelSelect);
    }
    staticLabel.textContent = lockedText;
    staticLabel.style.display = "inline-flex";
    currentDisplayLevel = lockedSkillsKey;
  } else {
    levelSelect.style.display = "block";
    const staticLabel = document.getElementById("staticLevelLabel");
    if (staticLabel) staticLabel.style.display = "none";
    currentDisplayLevel = levelSelect.value;
  }

  const container = document.getElementById("checklistContainer");

  function renderChecklist(levelName) {
    const keyToUse = isLocked ? lockedSkillsKey : levelName;
    const skills = SKILLS[keyToUse];

    if (!skills || skills.length === 0) {
      container.innerHTML = "<p>No skills found for this level.</p>";
    } else {
      let html = `
        <div class="checklist-section">
          <div class="checklist-header">Skills Checklist</div>
      `;

      skills.forEach((skill) => {
        const safeSkill = skill.replace(/"/g, '&quot;');
        html += `
          <div class="skill-item">
            <span class="skill-label">${skill}</span>
            <div class="skill-controls">
              <div class="checkbox-wrapper">
                <label class="checkbox-label">Worked</label>
                <input type="checkbox" data-skill="${safeSkill}" class="worked-on">
              </div>
              <div class="checkbox-wrapper">
                <label class="checkbox-label">Next</label>
                <input type="checkbox" data-skill="${safeSkill}" class="next-time">
              </div>
            </div>
          </div>
        `;
      });
      html += "</div>";
      container.innerHTML = html;
    }
  }

  renderChecklist(currentDisplayLevel);

  if (!isLocked) {
    levelSelect.addEventListener("change", async () => {
      const newLevel = levelSelect.value;
      renderChecklist(newLevel);

      try {
        const response = await fetch(`${PIKE13_API_V2}people/${id}`, {
             method: "POST",
             headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
             body: (function() {
                 const fd = new FormData();
                 fd.append("_method", "patch");
                 fd.append("person[person_custom_fields_attributes][0][value]", newLevel);
                 fd.append("person[person_custom_fields_attributes][0][custom_field_id]", "180098");
                 fd.append("person[person_custom_fields_attributes][0][id]", "51183690");
                 return fd;
             })()
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }
        noteData.fullLevel = newLevel;
        sessionStorage.setItem("noteContext", JSON.stringify(noteData));
      } catch (e) {
        console.error("Error updating level:", e);
        showNotification(`Failed to update level. ${e.message}`, "error");
      }
    });
  }

  document.getElementById("openPike13").addEventListener("click", () => {
    window.location.href = `https://mcdonaldswimschool.pike13.com/people/${id}/notes`;
  });

  document.getElementById("submitNote").addEventListener("click", async () => {
    const workedOn = [];
    const nextTime = [];

    container.querySelectorAll(".worked-on:checked").forEach(cb => {
      workedOn.push(cb.dataset.skill);
    });
    container.querySelectorAll(".next-time:checked").forEach(cb => {
      nextTime.push(cb.dataset.skill);
    });

    if (workedOn.length === 0 && nextTime.length === 0) {
      showNotification("Please select at least one skill.", "error");
      return;
    }

    let noteBody = "";
    if (workedOn.length > 0) {
      noteBody += "Skills we worked on:<br><ul>";
      workedOn.forEach(s => noteBody += `<li>${s}</li>`);
      noteBody += "</ul>";
    }
    if (nextTime.length > 0) {
      noteBody += "Skills to work on next time:<br><ul>";
      nextTime.forEach(s => noteBody += `<li>${s}</li>`);
      noteBody += "</ul>";
    }

    const customNote = document.getElementById("customNote") ? document.getElementById("customNote").value : "";
    if (customNote) {
        noteBody += `<br>${customNote}`;
    }

    const submitBtn = document.getElementById("submitNote");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      // Use pikeFetch
      await pikeFetch(`people/${id}/notes`, "POST", {
          note: {
            note: noteBody,
            public: true,
            send_notifications: true
          }
      });

      showNotification("Note submitted successfully!", "success");
      submitBtn.textContent = "Submitted";
      submitBtn.disabled = true;
      
    } catch (error) {
      console.error("Error submitting note:", error);
      showNotification("Failed to submit note. Please try again.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  (async () => {
      try {
        // Use pikeFetch
        const data = await pikeFetch(`people/${id}/notes`);
        if (!data) return;
        
        const notes = data.notes || [];
        const lastChecklistNote = notes.find(n => n.note && (n.note.toLowerCase().includes("next time")));

        if (lastChecklistNote) {
            let previousNextSkills = [];
            const noteText = lastChecklistNote.note;
            const parts = noteText.split(/next time/i);
            
            if (parts.length > 1) {
                const relevantPart = parts[1];
                const listMatch = relevantPart.match(/<ul>([\s\S]*?)<\/ul>/);
                if (listMatch && listMatch[1]) {
                    const items = listMatch[1].match(/<li>([\s\S]*?)<\/li>/g);
                    if (items) {
                        previousNextSkills = items.map(i => {
                            const raw = i.replace(/<\/?li>/g, "");
                            return decodeHtml(raw).trim();
                        });
                    }
                } else {
                   const lines = relevantPart.split("\n");
                   lines.forEach(line => {
                       const trimmed = line.trim();
                       if (trimmed.startsWith("-")) {
                           const txt = trimmed.substring(1).trim();
                           previousNextSkills.push(decodeHtml(txt));
                       }
                   });
                }
            }

            const checkboxes = Array.from(container.querySelectorAll(".worked-on"));
            previousNextSkills.forEach(skillText => {
                const match = checkboxes.find(cb => cb.dataset.skill === skillText);
                if (match) {
                    match.checked = true;
                }
            });
        }
      } catch (e) {
          console.error("Error fetching previous notes", e);
      }
  })();

})();