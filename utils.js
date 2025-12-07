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

/**
 * Shows a notification banner at the top of the screen.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', or 'info' (default).
 * @param {number} duration - Duration in ms before auto-dismissing (default 3000).
 */
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
