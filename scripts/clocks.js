function formatNavClock(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function renderNavClocks() {
  const chinaClock = document.getElementById("chinaClock");
  const laClock = document.getElementById("laClock");
  const nyClock = document.getElementById("nyClock");

  if (!chinaClock && !laClock && !nyClock) return;

  const now = new Date();
  if (chinaClock) chinaClock.textContent = formatNavClock(now, "Asia/Shanghai");
  if (laClock) laClock.textContent = formatNavClock(now, "America/Los_Angeles");
  if (nyClock) nyClock.textContent = formatNavClock(now, "America/New_York");
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavClocks();
  window.setInterval(renderNavClocks, 1000);
});

