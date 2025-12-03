(function() {
  const noteData = JSON.parse(sessionStorage.getItem("noteContext") || "{}");
  const { id, name, fullLevel } = noteData;

  if (!id) {
    navigate("attendance");
    return;
  }

  document.getElementById("noteTitle").textContent = `Notes for ${name}`;

  // Next Student Logic
  const studentList = JSON.parse(sessionStorage.getItem("studentList") || "[]");
  const currentIndex = studentList.findIndex(s => s.id === id);
  const nextBtn = document.getElementById("nextStudent");

  if (currentIndex !== -1 && currentIndex < studentList.length - 1) {
    nextBtn.style.display = "inline-flex";
    nextBtn.addEventListener("click", () => {
      const nextStudent = studentList[currentIndex + 1];
      sessionStorage.setItem("noteContext", JSON.stringify(nextStudent));
      navigate("notes");
    });
  }

  const LEVELS = [
    "Baby (Under 12 Months)",
    "Level 1 (Beginner)",
    "Level 2 (Underwater Explorer)",
    "Level 3 (Adventurer)",
    "Level 4 (Water Safe)",
    "Level 5 (Stroke Development)",
    "Level 6 (Fine Tuning & Endurance)",
    "Adult Coaching"
  ];

  const levelSelect = document.getElementById("levelSelect");
  LEVELS.forEach(lvl => {
    const opt = document.createElement("option");
    opt.value = lvl;
    opt.textContent = lvl;
    levelSelect.appendChild(opt);
  });

  // Set initial value
  if (fullLevel) {
    const match = LEVELS.find(l => l.toLowerCase() === fullLevel.toLowerCase());
    levelSelect.value = match || fullLevel;
  }

  const container = document.getElementById("checklistContainer");

  function renderChecklist(levelName) {
    const skills = (levelName && (SKILLS[levelName] || SKILLS[levelName.toUpperCase()])) || [];

    if (skills.length === 0) {
      container.innerHTML = "<p>No skills found for this level.</p>";
    } else {
      let html = `
        <div class="checklist-section">
          <div class="checklist-header">Skills Checklist</div>
      `;

      skills.forEach((skill) => {
        html += `
          <div class="skill-item">
            <span class="skill-label">${skill}</span>
            <div class="skill-controls">
              <div class="checkbox-wrapper">
                <label class="checkbox-label">Worked</label>
                <input type="checkbox" data-skill="${skill}" class="worked-on">
              </div>
              <div class="checkbox-wrapper">
                <label class="checkbox-label">Next</label>
                <input type="checkbox" data-skill="${skill}" class="next-time">
              </div>
            </div>
          </div>
        `;
      });
      html += "</div>";
      container.innerHTML = html;
    }
  }

  renderChecklist(levelSelect.value);

  // Handle level change
  levelSelect.addEventListener("change", async () => {
    const newLevel = levelSelect.value;
    renderChecklist(newLevel);

    // Update API
    try {
      // Fetch person to get custom field value ID
      const personRes = await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/people/${id}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("access_token")}` }
      });
      if (!personRes.ok) throw new Error("Failed to fetch person details");
      const personData = await personRes.json();
      const person = personData.people[0];
      const cfEntry = person.custom_fields.find(cf => cf.custom_field_id === 180098);

      const formData = new FormData();
      formData.append("_method", "patch");
      formData.append("person[person_custom_fields_attributes][0][value]", newLevel);
      formData.append("person[person_custom_fields_attributes][0][custom_field_id]", "180098");
      if (cfEntry) {
        formData.append("person[person_custom_fields_attributes][0][id]", cfEntry.id);
      }

      const response = await fetch(`https://mcdonaldswimschool.pike13.com/people/${id}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to update level: ${response.status} ${errText}`);
      }
      // Update local context
      noteData.fullLevel = newLevel;
      sessionStorage.setItem("noteContext", JSON.stringify(noteData));
    } catch (e) {
      console.error("Error updating level:", e);
      alert(`Failed to update level. ${e.message}`);
    }
  });

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
      alert("Please select at least one skill.");
      return;
    }

    // New HTML Format
    // Skills we worked on:<br><ul><li>1</li><li>2</li></ul>Skills to work focus on next time:<br><ul><li>1</li><li>2</li></ul>
    let noteBody = "";
    if (workedOn.length > 0) {
      noteBody += "Skills we worked on:<br><ul>";
      workedOn.forEach(s => noteBody += `<li>${s}</li>`);
      noteBody += "</ul>";
    }
    if (nextTime.length > 0) {
      noteBody += "Skills to work focus on next time:<br><ul>";
      nextTime.forEach(s => noteBody += `<li>${s}</li>`);
      noteBody += "</ul>";
    }

    // Append custom note if any
    const customNote = document.getElementById("customNote") ? document.getElementById("customNote").value : "";
    if (customNote) {
        noteBody += `<br>${customNote}`;
    }

    const submitBtn = document.getElementById("submitNote");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      const response = await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/people/${id}/notes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          note: {
            note: noteBody,
            public: true
          }
        })
      });

      if (response.ok) {
        alert("Note submitted successfully!");
        navigate("attendance");
      } else {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error submitting note:", error);
      alert("Failed to submit note. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  // Auto-populate logic
  (async () => {
      try {
        const response = await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/people/${id}/notes`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
              "Content-Type": "application/json"
            }
        });
        if (!response.ok) return;
        const data = await response.json();
        const notes = data.notes || [];

        // Find recent note
        const lastChecklistNote = notes.find(n => n.note && (n.note.includes("next time") || n.note.includes("Next time")));

        if (lastChecklistNote) {
            let previousNextSkills = [];
            // Handle HTML format
            if (lastChecklistNote.note.includes("<ul>")) {
                const parts = lastChecklistNote.note.split(/next time/i);
                if (parts[1]) {
                    const listPart = parts[1].match(/<ul>(.*?)<\/ul>/);
                    if (listPart && listPart[1]) {
                        const items = listPart[1].match(/<li>(.*?)<\/li>/g);
                        if (items) {
                            previousNextSkills = items.map(i => i.replace(/<\/?li>/g, ""));
                        }
                    }
                }
            } else {
                // Fallback to old format
                const nextTimeSection = lastChecklistNote.note.split("Next time:")[1];
                if (nextTimeSection) {
                    const lines = nextTimeSection.split("\n").map(l => l.trim()).filter(l => l.startsWith("- "));
                    previousNextSkills = lines.map(l => l.substring(2));
                }
            }

            previousNextSkills.forEach(skill => {
                const cb = container.querySelector(`.worked-on[data-skill="${skill}"]`);
                if (cb) cb.checked = true;
            });
        }
      } catch (e) {
          console.error("Error fetching previous notes", e);
      }
  })();

})();
