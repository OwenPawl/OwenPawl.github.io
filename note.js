
const LEVEL_SKILLS = {
  "Level 1": [
    "Comfortable with water entry",
    "Assisted back float",
    "Assisted front float",
    "Blowing bubbles",
    "Kicking with support"
  ],
  "Level 2": [
    "Unassisted back float",
    "Unassisted front float",
    "Back glide",
    "Front glide",
    "Kicking with kickboard"
  ],
  "Level 3": [
    "Streamline push-off",
    "Side breathing practice",
    "Freestyle kick endurance",
    "Backstroke arm coordination",
    "Rollover breathing"
  ],
  "Level 4": [
    "Freestyle with side breathing",
    "Backstroke timing",
    "Breaststroke kick intro",
    "Dolphin kick basics",
    "Treading water"
  ],
  "Level 5": [
    "Breaststroke pull and kick",
    "Butterfly timing drills",
    "Flip turns",
    "Endurance sets",
    "Streamline starts"
  ],
  default: [
    "Warm-up laps",
    "Kickboard drills",
    "Breathing control",
    "Stroke refinement",
    "Cool down"
  ]
};

const deskEndpoint = "https://mcdonaldswimschool.pike13.com/api/v2/desk/";

function getStudentContext() {
  try {
    const stored = sessionStorage.getItem("selectedStudent");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error("Unable to read selected student", e);
    return null;
  }
}

function skillItemsForLevel(level) {
  if (!level) return LEVEL_SKILLS.default;
  return LEVEL_SKILLS[level] || LEVEL_SKILLS.default;
}

function renderSkills(listElement, skills, selectedSet, groupName) {
  listElement.innerHTML = "";
  skills.forEach((skill, index) => {
    const checkboxId = `${groupName}-${index}`;
    const li = document.createElement("li");
    li.style.padding = "8px 10px";
    li.style.border = "1px solid rgba(0,0,0,0.06)";
    li.style.borderRadius = "10px";
    li.style.marginBottom = "8px";

    const label = document.createElement("label");
    label.setAttribute("for", checkboxId);
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "10px";
    label.style.cursor = "pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = checkboxId;
    checkbox.name = groupName;
    checkbox.value = skill;
    checkbox.checked = selectedSet.has(skill);

    const text = document.createElement("span");
    text.textContent = skill;

    label.appendChild(checkbox);
    label.appendChild(text);
    li.appendChild(label);
    listElement.appendChild(li);
  });
}

function readSavedState(studentId) {
  try {
    const raw = localStorage.getItem(`notes_${studentId}`);
    return raw ? JSON.parse(raw) : { workedOn: [], nextTime: [] };
  } catch (e) {
    console.error("Unable to read saved notes", e);
    return { workedOn: [], nextTime: [] };
  }
}

function collectSelections(groupName) {
  return Array.from(document.querySelectorAll(`input[name="${groupName}"]`))
    .filter((input) => input.checked)
    .map((input) => input.value);
}

async function syncNotesToServer(student, state) {
  const token = localStorage.getItem("access_token");
  if (!token || !student?.id) return;

  const content = `Worked on today: ${state.workedOn.join(", ") || "None"}. To work on next time: ${state.nextTime.join(", ") || "None"}.`;

  try {
    await fetch(`${deskEndpoint}people/${student.id}/notes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ note: { content } })
    });
  } catch (e) {
    console.error("Unable to sync notes", e);
  }
}

async function saveNotes(student) {
  const state = {
    workedOn: collectSelections("workedOn"),
    nextTime: collectSelections("nextTime"),
    level: student.level || null,
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(`notes_${student.id}`, JSON.stringify(state));
  } catch (e) {
    console.error("Unable to save notes", e);
  }

  await syncNotesToServer(student, state);
}

function restoreUi(student, skills) {
  const saved = readSavedState(student.id);
  const workedOnSet = new Set(saved.workedOn || []);
  const nextTimeSet = new Set(saved.nextTime || []);

  renderSkills(document.getElementById("workedOnList"), skills, workedOnSet, "workedOn");
  renderSkills(document.getElementById("nextTimeList"), skills, nextTimeSet, "nextTime");
}

function setStudentInfo(student, skills) {
  const info = document.getElementById("studentInfo");
  if (!student) {
    info.textContent = "No student selected";
    return;
  }
  info.textContent = `Student #${student.id}${student.level ? ` • Level: ${student.level}` : ""} • ${skills.length} skills available`;
}

function initNotes() {
  const student = getStudentContext();
  const skills = skillItemsForLevel(student?.level);

  setStudentInfo(student, skills);
  if (!student) return;

  restoreUi(student, skills);

  const saveButton = document.getElementById("saveNotes");
  if (saveButton) {
    saveButton.addEventListener("click", () => saveNotes(student));
  }

  const backButton = document.getElementById("backToAttendance");
  if (backButton) {
    backButton.addEventListener("click", () => load("attendance.html", "attendance.js", "attendance"));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotes);
} else {
  initNotes();
}
