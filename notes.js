{
  window.cleanupView = () => {};

  // --- REFACTORED RENDER FUNCTION ---
  // IMPORTANT: We now pass the exact container element, not document
  window.renderNotes = (container) => {
    // Fallback if container is missing (shouldn't happen with new nav logic)
    if (!container) container = document.getElementById("app");

    // SCOPED SELECTOR: Only find elements inside this specific container
    const getEl = (id) => container.querySelector(`#${id}`);

    const noteData = JSON.parse(sessionStorage.getItem("noteContext") || "{}");
    const { id, name, fullLevel, age } = noteData;

    const customFieldInstanceId = "51183690";
    let originalLevel = fullLevel;

    function decodeHtml(html) {
      const txt = document.createElement("textarea");
      txt.innerHTML = html;
      return txt.value;
    }

    function normalize(str) {
      return str ? str.toLowerCase().trim() : "";
    }

    if (!id) {
      // If no ID and we are in the main app, redirect
      if (container.id === "app") navigate("attendance");
      return;
    }

    const titleEl = getEl("noteTitle");
    if (titleEl) titleEl.textContent = `Notes for ${name}`;

    // --- NEXT STUDENT LOGIC ---
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
    const nextBtn = getEl("nextStudent");

    if (nextBtn) {
      if (currentIndex !== -1 && currentIndex < uniqueStudents.length - 1) {
        nextBtn.style.display = "inline-flex";
        
        // Simplified Logic: Use onclick to override previous listeners
        // This avoids DOM thrashing with cloneNode which caused issues
        
        // Only active in main app
        if (container.id === "app") {
            nextBtn.onclick = () => {
              const nextStudent = uniqueStudents[currentIndex + 1];
              sessionStorage.setItem("noteContext", JSON.stringify(nextStudent));
              navigate("notes");
            };
        } else {
            nextBtn.onclick = null; // Disable in preview
        }
      } else {
        nextBtn.style.display = "none";
      }
    }

    // --- LEVEL DROPDOWN LOGIC ---
    const levelSelect = getEl("levelSelect");
    
    if (levelSelect) {
        levelSelect.innerHTML = "";
        
        // Check for SKILLS global definition
        if (typeof SKILLS !== 'undefined') {
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

            const staticLabelId = "staticLevelLabel";
            // Check inside container scope for label
            let staticLabel = container.querySelector(`#${staticLabelId}`);

            if (isLocked) {
              levelSelect.style.display = "none";
              if (!staticLabel) {
                staticLabel = document.createElement("div");
                staticLabel.id = staticLabelId;
                staticLabel.className = "pill"; 
                staticLabel.style.marginBottom = "4px";
                levelSelect.parentNode.insertBefore(staticLabel, levelSelect);
              }
              staticLabel.textContent = lockedText;
              staticLabel.style.display = "inline-flex";
              currentDisplayLevel = lockedSkillsKey;
            } else {
              levelSelect.style.display = "block";
              if (staticLabel) staticLabel.style.display = "none";
              currentDisplayLevel = levelSelect.value;
            }

            const checkContainer = getEl("checklistContainer");

            function renderChecklist(levelName) {
              if (!checkContainer) return;
              const keyToUse = isLocked ? lockedSkillsKey : levelName;
              const skills = SKILLS[keyToUse];

              if (!skills || skills.length === 0) {
                checkContainer.innerHTML = "<p>No skills found for this level.</p>";
              } else {
                let html = `<div class="checklist-container">`;
                html += `
                  <div class="checklist-header-row">
                    <div class="col-header">Skill</div>
                    <div class="col-header center">Worked</div>
                    <div class="col-header center">Next</div>
                  </div>
                `;
                skills.forEach((skill) => {
                  const safeSkill = skill.replace(/"/g, '&quot;');
                  html += `
                    <div class="checklist-row">
                      <div class="skill-label">${skill}</div>
                      <div class="skill-check">
                        <input type="checkbox" data-skill="${safeSkill}" class="custom-checkbox worked-on" ${container.id !== "app" ? 'disabled' : ''}>
                      </div>
                      <div class="skill-check">
                        <input type="checkbox" data-skill="${safeSkill}" class="custom-checkbox next-time" ${container.id !== "app" ? 'disabled' : ''}>
                      </div>
                    </div>
                  `;
                });
                html += "</div>";
                checkContainer.innerHTML = html;
              }
            }

            renderChecklist(currentDisplayLevel);

            if (!isLocked && container.id === "app") {
              // use onclick to avoid stacking listeners if re-run
              levelSelect.onchange = () => {
                renderChecklist(levelSelect.value);
              };
            }
        }
    }

    const openPikeBtn = getEl("openPike13");
    if (openPikeBtn && container.id === "app") {
        openPikeBtn.onclick = () => {
            window.location.href = `https://mcdonaldswimschool.pike13.com/people/${id}/notes`;
        };
    }

    // --- SUBMIT HANDLER ---
    const submitBtn = getEl("submitNote");
    if (submitBtn && container.id === "app") {
        submitBtn.onclick = async () => {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";

            const checkContainer = getEl("checklistContainer");
            const workedOn = [];
            const nextTime = [];

            checkContainer.querySelectorAll(".worked-on:checked").forEach(cb => {
              workedOn.push(cb.dataset.skill);
            });
            checkContainer.querySelectorAll(".next-time:checked").forEach(cb => {
              nextTime.push(cb.dataset.skill);
            });

            if (workedOn.length === 0 && nextTime.length === 0) {
              showNotification("Please select at least one skill.", "error");
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit";
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

            const customNoteEl = getEl("customNote");
            const customNote = customNoteEl ? customNoteEl.value : "";
            if (customNote) {
                noteBody += `<br>${customNote}`;
            }

            try {
              const promises = [];

              promises.push(pikeFetch(`people/${id}/notes`, "POST", {
                  note: {
                    note: noteBody,
                    public: true,
                    send_notifications: true
                  }
              }));

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
        };
    }

    // --- PRE-FILL CHECKBOXES FROM PREVIOUS NOTES ---
    if (container.id === "app") {
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

                const checkContainer = getEl("checklistContainer");
                if (checkContainer) {
                    const checkboxes = Array.from(checkContainer.querySelectorAll(".worked-on"));
                    previousNextSkills.forEach(skillText => {
                        const match = checkboxes.find(cb => cb.dataset.skill === skillText);
                        if (match) {
                            match.checked = true;
                        }
                    });
                }
            }
          } catch (e) {
              console.error("Error fetching previous notes", e);
          }
        })();
    }
  };

  // Initial Render call
  window.renderNotes(document.getElementById("app"));
}