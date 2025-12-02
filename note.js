const skillsByLevel = {
  "BABY (0-2 YEARS)": [
    "Water familiarity - Bubbles / mouth in water",
    "Dolphin dive",
    "Scooping arms",
    "Kicking with support",
    "Rolling over by instinct",
    "Jumping / slide in from side",
    "Jumping / slide with rollover"
  ],
  "TOTS (2-4 YEARS)": [
    "Bubbles from mouth",
    "Head bobs with bubbles",
    "Rocket to instructor then kick and bubble with support",
    "Roll off noodle and kick to safety",
    "Jump then roll and kick to safety"
  ],
  "LEVEL 1 (BEGINNER)": [
    "Pool safety - Water depth, lifeguards, walking, how to call for help",
    "Pool entry and exit with support",
    "Blow bubbles with mouth and nose",
    "Floats - front and back with support",
    "Rollover with support",
    "Rocket streamline with support",
    "Intro to arm scoops",
    "Intro to elementary backstroke",
    "Wall crawl to steps with support and calling for help",
    "Jump in with support and roll"
  ],
  "LEVEL 2 (UNDERWATER DISCOVERY)": [
    "Sun safety",
    "5 independent head bobs - ears under",
    "Float on front and back with assistance",
    "Roll front to back with assistance",
    "Kick on front with support",
    "Rocket and kicks assisted",
    "Intro to 1 ear in the water",
    "Intro to kicking on side",
    "Elementary backstroke with support",
    "Intro to swim float swim",
    "Arm scoops with support",
    "Assisted standing jump from side",
    "Climb out of pool with minimal assistance"
  ],
  "LEVEL 3 (ADVENTURER)": [
    "Emergency identification - Lifeguards, safety tools, calling for help, when to call 911",
    "Kick on back with assistance",
    "Kick on front with bubbles assisted",
    "Unassisted floats on front and back 10 seconds",
    "Rockets unassisted for 3+ body lengths",
    "Arm scoops with face underwater assisted",
    "Swim, float, swim with assistance",
    "Elementary backstroke with assistance",
    "Intro to scissor kicks",
    "Intro to breaststroke arms",
    "Side breathing with kick board with support",
    "Independent jump in and assisted kick to wall",
    "Climb out of pool unassisted"
  ],
  "LEVEL 4 (WATER SAFE)": [
    "Basic rescue skills - Calling for an adult or lifeguard, reach or throw",
    "Independent floats",
    "Rocket independently 4+ body lengths",
    "Freestyle with assistance for side breathing",
    "Swim float swim unassisted across long way",
    "Kick on back unassisted",
    "Intro to backstroke arms",
    "Swim, flip, swim - kick and arms",
    "Clothes on jump in and swim across pool",
    "Elementary backstroke without assistance",
    "Breaststroke with assistance",
    "Intro to sculling / treading",
    "Sit dives"
  ],
  "LEVEL 5 (STROKE DEVELOPMENT)": [
    "Diving safety",
    "Treading water 10 sec",
    "Freestyle - High elbow",
    "Backstroke - Straight leg kick and tall straight arms",
    "Breaststroke with assistance, arms, and legs",
    "Intro dolphin kick",
    "Intro butterfly arms",
    "Kneeling dive",
    "Intro to in-water surface and deep dives",
    "Feet and headfirst"
  ],
  "LEVEL 6 (FINE TUNING)": [
    "Freestyle: Body roll",
    "Freestyle: Consistent kick",
    "Freestyle: Consistent side breathing (both sides)",
    "Freestyle: Dolphin kick off wall",
    "Backstroke: Body roll",
    "Backstroke: Thumb out pinky in",
    "Backstroke: Hips and kicks at the surface",
    "Breaststroke: Consistent glide with hips near surface",
    "Breaststroke: Timing - pull, breathe, kick, glide",
    "Breaststroke: No kicks during glide",
    "Breaststroke: Underwater pullout",
    "Butterfly: Straight arms",
    "Butterfly: Dolphin kick",
    "Butterfly: 2 kicks one pull",
    "Proper turns for all strokes",
    "Treading water",
    "Standing dives (shallow, deep, starting)"
  ],
  "ADULT COACHING": [
    "Overcoming fear or improving comfort in deep water",
    "Breathing technique and body alignment",
    "Freestyle: Body roll",
    "Freestyle: Consistent kick",
    "Freestyle: Consistent side breathing (both sides)",
    "Freestyle: Dolphin kick off wall",
    "Backstroke: Body roll",
    "Backstroke: Thumb out pinky in",
    "Backstroke: Hips and kicks at the surface",
    "Breaststroke: Consistent glide with hips near surface",
    "Breaststroke: Timing - pull, breathe, kick, glide",
    "Breaststroke: No kicks during glide",
    "Breaststroke: Underwater pullout",
    "Butterfly: Straight arms",
    "Butterfly: Dolphin kick",
    "Butterfly: 2 kicks one pull",
    "Treading water",
    "Flip turns and streamlines",
    "Endurance and efficiency training"
  ]
};

function resolveLevelKey(rawLevel) {
  if (!rawLevel) return null;
  const normalized = rawLevel.toString().trim().toUpperCase();
  const exactMatch = Object.keys(skillsByLevel).find(level => level.toUpperCase() === normalized);
  if (exactMatch) return exactMatch;

  const digitMatch = normalized.match(/(\d+)/);
  if (digitMatch) {
    const number = digitMatch[1];
    return Object.keys(skillsByLevel).find(level => level.startsWith("LEVEL " + number));
  }

  if (normalized.startsWith("BABY")) return "BABY (0-2 YEARS)";
  if (normalized.startsWith("TOTS")) return "TOTS (2-4 YEARS)";
  if (normalized.startsWith("ADULT")) return "ADULT COACHING";
  return null;
}

function renderSkillList(skills, containerId, groupName) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!skills || !skills.length) {
    container.innerHTML = "<p class=\"muted\">No skills available for this level.</p>";
    return;
  }
  const list = document.createElement("div");
  list.className = "skill-list";
  skills.forEach(skill => {
    const item = document.createElement("label");
    item.className = "skill-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = skill;
    checkbox.dataset.group = groupName;
    const text = document.createElement("span");
    text.textContent = skill;
    item.appendChild(checkbox);
    item.appendChild(text);
    list.appendChild(item);
  });
  container.appendChild(list);
}

function collectSelections(groupName) {
  return Array.from(document.querySelectorAll(`input[data-group="${groupName}"]:checked`)).map(el => el.value);
}

function populateStudentDetails(context, levelKey) {
  document.getElementById("studentName").textContent = context?.personName || "Unknown student";
  const levelLabel = document.getElementById("studentLevel");
  if (levelKey) {
    levelLabel.textContent = levelKey;
    levelLabel.classList.remove("muted");
  } else {
    levelLabel.textContent = context?.level ? `No skills found for level "${context.level}"` : "No level provided";
    levelLabel.classList.add("muted");
  }
}

async function submitNote(context) {
  const workedOn = collectSelections("worked");
  const nextTime = collectSelections("next");
  const noteContent = [
    workedOn.length ? `Worked on today: ${workedOn.join(", ")}` : "",
    nextTime.length ? `Next time: ${nextTime.join(", ")}` : ""
  ].filter(Boolean).join("\n");
  const status = document.getElementById("noteStatus");

  if (!context?.personId) {
    status.textContent = "Missing person information for this note.";
    status.className = "status error";
    return;
  }

  const apiKey = sessionStorage.getItem("api_key");
  if (!apiKey) {
    status.textContent = "No API key found in session storage.";
    status.className = "status error";
    return;
  }

  try {
    const response = await fetch(`https://mcdonaldswimschool.pike13.com/api/v2/desk/people/${context.personId}/notes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ note: { body: noteContent || "Lesson notes" } })
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed with status ${response.status}`);
    }
    status.textContent = "Note saved successfully.";
    status.className = "status success";
  } catch (error) {
    console.error("Error saving note", error);
    status.textContent = "Unable to save note. Please try again.";
    status.className = "status error";
  }
}

function initializeNotes() {
  const context = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("noteContext"));
    } catch (e) {
      console.error("Unable to parse note context", e);
      return null;
    }
  })();

  const levelKey = resolveLevelKey(context?.level);
  populateStudentDetails(context, levelKey);

  if (levelKey) {
    renderSkillList(skillsByLevel[levelKey], "workedList", "worked");
    renderSkillList(skillsByLevel[levelKey], "nextList", "next");
  } else {
    renderSkillList([], "workedList", "worked");
    renderSkillList([], "nextList", "next");
  }

  const submitBtn = document.getElementById("submitNote");
  submitBtn.addEventListener("click", () => submitNote(context));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNotes);
} else {
  initializeNotes();
}
