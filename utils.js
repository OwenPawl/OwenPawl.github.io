// --- CONSTANTS ---
const PIKE13_API_V2 = "https://mcdonaldswimschool.pike13.com/api/v2/desk/";
const PIKE13_API_V3 = "https://mcdonaldswimschool.pike13.com/desk/api/v3/";
const EXCLUDED_IDS = [11485475, 11559838, 13602611, 13167161, ""];
const STATE_KEY = "app_persistence";

// --- STATE MANAGEMENT ---
function getAppState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function updateAppState(updates) {
  const current = getAppState();
  const newState = { ...current, ...updates };
  localStorage.setItem(STATE_KEY, JSON.stringify(newState));
  return newState;
}

// --- SCROLL HANDLING (Auto-Hide Nav) ---
{
  let lastScrollY = window.scrollY;
  let currentTranslateY = 0;
  const NAV_HEIGHT = 74; 

  const updateNav = () => {
    const scrollY = Math.max(0, window.scrollY);
    const deltaY = scrollY - lastScrollY;
    const scrollHeight = document.body.scrollHeight;
    const innerHeight = window.innerHeight;
    const distToBottom = scrollHeight - innerHeight - scrollY;

    currentTranslateY += deltaY;
    currentTranslateY = Math.max(0, Math.min(NAV_HEIGHT, currentTranslateY));

    if (distToBottom < NAV_HEIGHT) {
      currentTranslateY = Math.min(currentTranslateY, distToBottom);
      currentTranslateY = Math.max(0, currentTranslateY);
    }

    document.documentElement.style.setProperty('--nav-translate-y', `${currentTranslateY}px`);

    lastScrollY = scrollY;
    requestAnimationFrame(updateNav);
  };

  requestAnimationFrame(updateNav);
}

// --- API HELPERS ---
async function pikeFetch(endpoint, method = "GET", body = null) {
  const headers = {
    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
    "Content-Type": "application/json"
  };
  
  const config = { method, headers, redirect: "follow" };
  if (body) config.body = JSON.stringify(body);

  const url = endpoint.startsWith("http") ? endpoint : `${PIKE13_API_V2}${endpoint}`;

  const response = await fetch(url, config);
  
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${await response.text()}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// --- DATA PROCESSING HELPERS ---
function mergeConsecutiveSlots(data) {
  if (!data || !data.length) return [];
  
  const merged = [];
  for (let i = 0; i < data.length;) {
    const current = data[i];
    const { id, name, firstName, lastName, shortLevel, isNew, age, fullLevel, start, end, vid, state, locationId } = current;
    
    let blockEnd = end;
    let vids = [vid];
    let states = [state];
    let j = i + 1;
    
    while (
      j < data.length &&
      data[j].id === id &&
      data[j].start === blockEnd
    ) {
      blockEnd = data[j].end;
      vids.push(data[j].vid);
      states.push(data[j].state);
      j++;
    }
    
    merged.push({
      id, name, firstName, lastName, shortLevel, isNew, age, fullLevel, start,
      end: blockEnd,
      vids,
      states,
      locationId
    });
    i = j;
  }
  return merged;
}

// --- FORMATTING HELPERS ---

function formatName(personObj) {
  if (typeof personObj === 'string') {
    return capitalizeWords(personObj);
  }
  if (personObj.firstName && personObj.lastName) {
    return `${capitalizeWords(personObj.firstName)} ${capitalizeWords(personObj.lastName)}`;
  }
  return capitalizeWords(personObj.name || "");
}

function capitalizeWords(str) {
  if (!str) return "";
  const parts = str.trim().split(/\s+/);
  return parts.map(x => {
      return x[0].toUpperCase() + 
             (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1));
  }).join(" ");
}

function getShortLevel(fullLevel, ageYears) {
  if (!fullLevel) return "...";
  const levelMatch = fullLevel.match(/^Level\s+(\d+)/i);
  if (levelMatch) {
    return levelMatch[1]; 
  }
  if (ageYears < 2) return "B"; 
  else if (ageYears < 4) return "T"; 

  const capitals = fullLevel.match(/[A-Z]/g);
  return capitals ? capitals.join("") : fullLevel.charAt(0);
}

function normalizeSchedule(scheduleData) {
  if (Array.isArray(scheduleData)) return scheduleData;
  if (typeof scheduleData === "string" && scheduleData.trim()) {
    try {
      return JSON.parse(scheduleData);
    } catch (e) {
      console.error("Unable to parse schedule", e);
    }
  }
  const stored = sessionStorage.getItem("schedule");
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { console.error("Unable to parse stored schedule", e); }
  }
  return [];
}

// --- UI HELPERS ---
function showNotification(message, type = "info", duration = 3000) {
  let container = document.querySelector(".notification-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "notification-container";
    document.body.appendChild(container);
  }

  const notification = document.createElement("div");
  notification.className = `notification-banner ${type}`;

  const messageEl = document.createElement("span");
  messageEl.className = "notification-message";
  messageEl.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "notification-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.onclick = () => removeNotification(notification);

  notification.appendChild(messageEl);
  notification.appendChild(closeBtn);
  container.appendChild(notification);

  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification);
    }, duration);
  }
}

function removeNotification(notification) {
  notification.style.animation = "fadeOut 0.3s ease-out forwards";
  notification.addEventListener("animationend", () => {
    notification.remove();
    const container = document.querySelector(".notification-container");
    if (container && container.children.length === 0) {
      container.remove();
    }
  });
}