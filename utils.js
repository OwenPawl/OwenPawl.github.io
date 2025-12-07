// --- CONSTANTS ---
const PIKE13_API_V2 = "https://mcdonaldswimschool.pike13.com/api/v2/desk/";
const PIKE13_API_V3 = "https://mcdonaldswimschool.pike13.com/desk/api/v3/";
//Excluding Note Time, BONUS TIME, Bonus Time, PAID BREAK, Open
const EXCLUDED_IDS = [11485475, 11559838, 13602611, 13167161, ""];

// Correctly encrypted token (XOR of Token and UUID) provided by user
const ENCRYPTED_REPORTS_TOKEN = "536d73072e15275e6e0a40414a1559225c01426d4464767b2543636053010e637f5b0a750f52532b";

// --- SECURITY HELPERS ---

/**
 * Simple XOR decrypt/encrypt function.
 * @param {string} hex - The hex encoded string to decrypt
 * @param {string} key - The UUID string to use as key
 */
function xorDecrypt(hex, key) {
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substr(i, 2), 16);
    const keyChar = key.charCodeAt((i / 2) % key.length);
    result += String.fromCharCode(charCode ^ keyChar);
  }
  return result;
}

/**
 * Retrieves the Reports API Token.
 */
async function getReportsToken() {
  const cachedToken = localStorage.getItem("decrypted_reports_token");
  if (cachedToken) return cachedToken;

  try {
    console.log("Fetching key decryption material...");
    const response = await pikeFetch("custom_fields"); 
    if (!response || !response.custom_fields) throw new Error("Failed to load custom fields");

    const field = response.custom_fields.find(f => f.id === 198765);
    if (!field || !field.why) throw new Error("InternalAPIKey field not found or empty");

    const uuid = field.why.trim(); 
    const decryptedToken = xorDecrypt(ENCRYPTED_REPORTS_TOKEN, uuid);

    localStorage.setItem("decrypted_reports_token", decryptedToken);
    return decryptedToken;

  } catch (e) {
    console.error("Critical Security Error: Could not decrypt reports token.", e);
    return null;
  }
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

/**
 * Merges consecutive time slots for the same person into a single block.
 * @param {Array} data - The raw schedule array
 * @returns {Array} - Array of merged objects with `vids` and `states` arrays
 */
function mergeConsecutiveSlots(data) {
  if (!data || !data.length) return [];
  
  const merged = [];
  for (let i = 0; i < data.length;) {
    const current = data[i];
    // Destructure common fields to keep in the parent object
    const { id, name, shortLevel, isNew, age, fullLevel, start, end, vid, state } = current;
    
    let blockEnd = end;
    let vids = [vid];
    let states = [state];
    let j = i + 1;
    
    // Look ahead for consecutive slots with the same ID
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
      id, name, shortLevel, isNew, age, fullLevel, start,
      end: blockEnd,
      vids,
      states
    });
    i = j;
  }
  return merged;
}

// --- FORMATTING HELPERS ---

function formatName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  const relevantParts = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  
  return relevantParts.map(x => {
      return x[0].toUpperCase() + 
             (/^[A-Z]+$/.test(x) ? x.slice(1).toLowerCase() : x.slice(1));
  }).join(" ");
}

function getShortLevel(fullLevel, ageYears) {
  if (!fullLevel) return "...";

  if (ageYears < 2) {
    return "B"; 
  } else if (ageYears < 4) {
    return "T"; 
  } else {
    const upperLvl = fullLevel.toUpperCase();
    if (upperLvl.includes("BABY") || upperLvl.includes("TOTS")) {
       return "1"; 
    } else {
       if (fullLevel.startsWith("Level ")) {
         const match = fullLevel.match(/\d+/);
         return match ? match[0] : fullLevel.charAt(0);
       } else {
         const capitals = fullLevel.match(/[A-Z]/g);
         return capitals ? capitals.join("") : fullLevel.charAt(0);
       }
    }
  }
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