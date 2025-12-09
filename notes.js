(function() {
  const noteData = JSON.parse(sessionStorage.getItem("noteContext") || "{}");
  const { id, name, fullLevel, age } = noteData;

  // State to track for updates
  const customFieldInstanceId = "51183690";
  let originalLevel = fullLevel;

  window.cleanupView = () => {};

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

  // --- UNIFIED STORAGE FOR NEXT STUDENT LOGIC ---
  const scheduleData = normalizeSchedule(null); 
  const uniqueStudents = [];
  const seenIds = new Set();
  
  scheduleData.forEach(row => {
    const sId = row.id;
    if (!EXCLUDED_IDS.includes(sId) && !seenIds.has(sId)) {
      seenIds.add(sId);
      uniqueStudents.push({ id: sId, name: row.name, fullLevel: row.fullLevel, age: row.age });
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
      // --- REFACTORED TO GRID ---
      let html = `
        <div class="checklist-grid">
          <div class="col-header">Skill</div>
          <div class="col-header center">Worked</div>
          <div class="col-header center">Next</div>
      `;

      skills.forEach((skill) => {
        const safeSkill = skill.replace(/"/g, '&quot;');
        html += `
          <div class="skill-label">${skill}</div>
          <div class="skill-check">
            <input type="checkbox" data-skill="${safeSkill}" class="custom-checkbox worked-on">
          </div>
          <div class="skill-check">
            <input type="checkbox" data-skill="${safeSkill}" class="custom-checkbox next-time">
          </div>
        `;
      });
      html += "</div>";
      container.innerHTML = html;
    }
  }

  renderChecklist(currentDisplayLevel);

  // Update Checklist immediately on dropdown change
  if (!isLocked) {
    levelSelect.addEventListener("change", () => {
      renderChecklist(levelSelect.value);
    });
  }

  document.getElementById("openPike13").addEventListener("click", () => {
    window.location.href = `https://mcdonaldswimschool.pike13.com/people/${id}/notes`;
  });

  // --- SUBMIT HANDLER ---
  document.getElementById("submitNote").addEventListener("click", async () => {
    const submitBtn = document.getElementById("submitNote");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

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
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
      return;
    }

    // 1. Build Note Body
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

    try {
      const promises = [];

      // 2. Queue Note Submission
      promises.push(pikeFetch(`people/${id}/notes`, "POST", {
          note: {
            note: noteBody,
            public: true,
            send_notifications: true
          }
      }));

      // 3. Queue Level Update (if changed and ID found)
      const newLevel = levelSelect.value;
      if (!isLocked && customFieldInstanceId && newLevel !== originalLevel) {
          console.log(`Updating level from ${originalLevel} to ${newLevel}`);
          
          const fd = new FormData();
          fd.append("_method", "patch"); 
          fd.append("person[person_custom_fields_attributes][0][id]", customFieldInstanceId);
          fd.append("person[person_custom_fields_attributes][0][custom_field_id]", "180098");
          fd.append("person[person_custom_fields_attributes][0][value]", newLevel);

          const levelUpdate = fetch(`${PIKE13_API_V2}people/${id}`, {
              method: "POST", 
              headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` },
              body: fd
          }).then(async r => {
             if (!r.ok) throw new Error(await r.text());
             return r;
          });
          
          promises.push(levelUpdate);
      }

      await Promise.all(promises);

      showNotification("Submitted successfully!", "success");
      submitBtn.textContent = "Submitted";
      
      if (!isLocked && newLevel !== originalLevel) {
        noteData.fullLevel = newLevel;
        sessionStorage.setItem("noteContext", JSON.stringify(noteData));
      }
      
    } catch (error) {
      console.error("Error submitting:", error);
      showNotification("Failed to submit. Please try again.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  // --- PRE-FILL CHECKBOXES FROM PREVIOUS NOTES ---
  (async () => {
      try {
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