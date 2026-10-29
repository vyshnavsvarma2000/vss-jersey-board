const $ = (sel) => document.querySelector(sel);

const setupPanel = $("#setupPanel");
const boardPanel = $("#boardPanel");
const setupStatus = $("#setupStatus");
const formStatus = $("#formStatus");
const boardTitle = $("#boardTitle");

const joinRoomCode = $("#joinRoomCode");
const createTitle = $("#createTitle");
const createRoomCode = $("#createRoomCode");

const activeRoomCodeEl = $("#activeRoomCode");
const rosterBody = $("#rosterBody");
const suggestionList = $("#suggestionList");
const teamSuggestionsList = $("#teamSuggestionsList");
const rosterSummary = $("#rosterSummary");

const entryForm = $("#entryForm");
const displayNameInput = $("#displayName");
const playerSelect = $("#playerSelect");
const playerSelectField = $("#playerSelectField");
const displayNameField = $("#displayNameField");
const jerseyNumberInput = $("#jerseyNumber");
const jerseySizeInput = $("#jerseySize");

const progressPanel = $("#progressPanel");
const progressBadge = $("#progressBadge");
const pendingBlock = $("#pendingBlock");
const pendingList = $("#pendingList");

const entryFormEl = $("#entryForm");
const submitEntryBtn = $("#submitEntryBtn");
const cancelEditBtn = $("#cancelEditBtn");
const teamPreferenceInput = $("#teamPreference");
const noteInput = $("#note");

let activeRoom = null;
let lastBoardData = null;
let editingEntryId = null;
let formDirty = false;
let pollTimer = null;
const POLL_MS = 4000;

const savedNameKey = "jerseyBoard.displayName";

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("room") || "").trim().toUpperCase();
}

function setRoomInUrl(code) {
  const url = new URL(window.location.href);
  if (code) {
    url.searchParams.set("room", code);
  } else {
    url.searchParams.delete("room");
  }
  window.history.replaceState({}, "", url);
}

function boardUrl(code) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("room", code);
  return url.toString();
}

function setStatus(el, message, type = "") {
  el.textContent = message || "";
  el.classList.remove("ok", "err");
  if (type) el.classList.add(type);
}

function selectedPlayerName() {
  if (!playerSelectField.classList.contains("hidden") && playerSelect.value) {
    return playerSelect.value.trim();
  }
  return displayNameInput.value.trim();
}

function syncPlayerSelectFromSaved(name) {
  if (!name || playerSelectField.classList.contains("hidden")) return;
  const opt = [...playerSelect.options].find((o) => o.value === name);
  if (opt) playerSelect.value = name;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function isEntryFormFocused() {
  return entryFormEl.contains(document.activeElement);
}

function nameKeyClient(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function entryByName(entries, name) {
  const key = nameKeyClient(name);
  return entries.find((e) => nameKeyClient(e.display_name) === key);
}

function currentIdentityName() {
  return selectedPlayerName() || localStorage.getItem(savedNameKey) || "";
}

function canManageEntry(entry) {
  const identity = currentIdentityName();
  if (!identity) return false;
  return nameKeyClient(entry.display_name) === nameKeyClient(identity);
}

function syncFormFromBoard(data) {
  if (formDirty || isEntryFormFocused()) return;

  if (editingEntryId) {
    const entry = data.entries.find((e) => e.id === editingEntryId);
    if (entry) loadEntryIntoForm(entry);
    else clearEntryForm({ keepName: false });
    return;
  }
  loadEntryForSelectedName(data.entries);
}

function configureNameInput(data) {
  const hasRoster = data.roster?.players?.length;
  if (hasRoster) {
    playerSelectField.classList.remove("hidden");
    displayNameField.classList.add("hidden");
    displayNameInput.removeAttribute("required");
    playerSelect.required = true;

    const responded = new Set(data.entries.map((e) => nameKeyClient(e.display_name)));
    const previous = playerSelect.value;
    playerSelect.innerHTML = '<option value="">Choose from squad list…</option>';
    for (const p of data.roster.players) {
      const opt = document.createElement("option");
      opt.value = p.name;
      const suffix = responded.has(nameKeyClient(p.name)) ? " ✓ submitted" : "";
      opt.textContent = `${p.name}${suffix}`;
      playerSelect.appendChild(opt);
    }
    const restore = previous || localStorage.getItem(savedNameKey);
    if (restore && [...playerSelect.options].some((o) => o.value === restore)) {
      playerSelect.value = restore;
    }
    syncFormFromBoard(data);
  } else {
    playerSelectField.classList.add("hidden");
    displayNameField.classList.remove("hidden");
    playerSelect.required = false;
    displayNameInput.required = true;
    syncFormFromBoard(data);
  }
}

function setEditMode(entry) {
  editingEntryId = entry ? entry.id : null;
  submitEntryBtn.textContent = entry ? "Update my pick" : "Save my pick";
  cancelEditBtn.classList.toggle("hidden", !entry);
}

function loadEntryIntoForm(entry) {
  if (!entry) {
    setEditMode(null);
    return;
  }
  if (!playerSelectField.classList.contains("hidden")) {
    playerSelect.value = entry.display_name;
  } else {
    displayNameInput.value = entry.display_name;
  }
  jerseyNumberInput.value = entry.jersey_number;
  jerseySizeInput.value = entry.jersey_size || "";
  teamPreferenceInput.value = entry.team_preference;
  noteInput.value = entry.note || "";
  setEditMode(entry);
  formDirty = false;
}

function loadEntryForSelectedName(entries) {
  const name = selectedPlayerName();
  if (!name) {
    setEditMode(null);
    return;
  }
  const mine = entryByName(entries, name);
  if (mine) loadEntryIntoForm(mine);
  else {
    jerseyNumberInput.value = "";
    jerseySizeInput.value = "";
    teamPreferenceInput.value = "";
    noteInput.value = "";
    setEditMode(null);
  }
}

function clearEntryForm({ keepName = true } = {}) {
  const name = keepName ? selectedPlayerName() : "";
  entryFormEl.reset();
  if (keepName && name) {
    if (!playerSelectField.classList.contains("hidden")) playerSelect.value = name;
    else displayNameInput.value = name;
  }
  setEditMode(null);
  formDirty = false;
}

function renderRosterTable(data) {
  rosterBody.innerHTML = "";
  for (const e of data.entries) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${e.jersey_number}</strong></td>
      <td>${escapeHtml(e.display_name)}</td>
      <td>${escapeHtml(e.jersey_size || "—")}</td>
      <td>${escapeHtml(e.team_preference)}</td>
      <td>${escapeHtml(e.note || "—")}</td>
      <td></td>
    `;
    const actionsCell = tr.lastElementChild;
    if (canManageEntry(e)) {
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => {
        loadEntryIntoForm(e);
        setStatus(formStatus, "Editing your submission — change fields and click Update.", "ok");
        entryFormEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-danger";
      removeBtn.textContent = "Delete";
      removeBtn.addEventListener("click", () => removeEntry(e.id, e.display_name));
      actions.appendChild(editBtn);
      actions.appendChild(removeBtn);
      actionsCell.appendChild(actions);
    }
    rosterBody.appendChild(tr);
  }

  if (data.entries.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="muted">No submissions yet.</td>`;
    rosterBody.appendChild(tr);
  }
}

function renderProgress(data) {
  const hasRoster = data.totalPlayers > 0 && data.roster;
  progressPanel.classList.toggle("hidden", !hasRoster);
  if (!hasRoster) return;

  progressBadge.textContent = `${data.respondedCount} / ${data.totalPlayers} responded`;
  pendingList.innerHTML = "";

  const pending = data.pendingPlayers || [];
  pendingBlock.classList.toggle("hidden", pending.length === 0);

  for (const name of pending) {
    const li = document.createElement("li");
    li.textContent = name;
    pendingList.appendChild(li);
  }

  if (pending.length === 0) {
    const li = document.createElement("li");
    li.className = "done";
    li.textContent = "All squad members have submitted";
    pendingList.appendChild(li);
    pendingBlock.classList.remove("hidden");
  }
}

function renderBoard(data) {
  lastBoardData = data;
  boardTitle.textContent = data.room.title;
  activeRoomCodeEl.textContent = data.room.code;

  configureNameInput(data);
  renderProgress(data);

  if (data.totalPlayers > 0) {
    rosterSummary.textContent = `${data.respondedCount} / ${data.totalPlayers} squad · ${data.entries.length} picks logged`;
  } else {
    rosterSummary.textContent = `${data.entries.length} player${data.entries.length === 1 ? "" : "s"}`;
  }

  renderRosterTable(data);

  suggestionList.innerHTML = "";
  teamSuggestionsList.innerHTML = "";
  for (const s of data.teamSuggestions) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(s.name)}</strong>
        <span class="supporters">${escapeHtml(s.supporters.join(", "))}</span>
      </div>
      <span class="count">${s.count}</span>
    `;
    suggestionList.appendChild(li);

    const opt = document.createElement("option");
    opt.value = s.name;
    teamSuggestionsList.appendChild(opt);
  }

  if (data.teamSuggestions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No suggestions yet — be the first to add a team name.";
    suggestionList.appendChild(empty);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadRoom(code, { silent = false } = {}) {
  if (!silent) setStatus(setupStatus, "Loading board…");
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(code)}`);
    activeRoom = data.room.code;
    setRoomInUrl(activeRoom);
    setupPanel.classList.add("hidden");
    boardPanel.classList.remove("hidden");
    renderBoard(data);
    setStatus(setupStatus, "");
    startPolling();
  } catch (err) {
    if (!silent) setStatus(setupStatus, err.message, "err");
    throw err;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!activeRoom) return;
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(activeRoom)}`);
      renderBoard(data);
    } catch {
      /* ignore transient errors while polling */
    }
  }, POLL_MS);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function createRoom() {
  setStatus(setupStatus, "Creating board…");
  try {
    const body = {
      title: createTitle.value.trim() || "Team jersey board",
      code: createRoomCode.value.trim() || undefined,
    };
    const { room } = await api("/api/rooms", { method: "POST", body: JSON.stringify(body) });
    await loadRoom(room.code);
    setStatus(formStatus, "Board created. Share the link on WhatsApp.", "ok");
  } catch (err) {
    setStatus(setupStatus, err.message, "err");
  }
}

async function joinRoom() {
  const code = joinRoomCode.value.trim().toUpperCase();
  if (!code) {
    setStatus(setupStatus, "Enter a room code.", "err");
    return;
  }
  try {
    await loadRoom(code);
  } catch (err) {
    setStatus(setupStatus, err.message, "err");
  }
}

async function submitEntry(ev) {
  ev.preventDefault();
  if (!activeRoom) return;

  const displayName = selectedPlayerName();
  const jerseyNumber = jerseyNumberInput.value;
  const jerseySize = jerseySizeInput.value.trim();
  const teamPreference = $("#teamPreference").value.trim();
  const note = $("#note").value.trim();

  if (!jerseySize) {
    setStatus(formStatus, "Select your jersey size.", "err");
    return;
  }

  if (!displayName) {
    setStatus(formStatus, "Select your name from the squad list.", "err");
    return;
  }

  if (editingEntryId) {
    const existing = lastBoardData?.entries?.find((x) => x.id === editingEntryId);
    if (existing && !canManageEntry(existing)) {
      setStatus(formStatus, "You can only update your own submission.", "err");
      clearEntryForm({ keepName: true });
      return;
    }
  }

  localStorage.setItem(savedNameKey, displayName);

  const isUpdate = Boolean(editingEntryId);
  setStatus(formStatus, isUpdate ? "Updating…" : "Saving…");
  try {
    const payload = { displayName, jerseyNumber, jerseySize, teamPreference, note };
    const data = editingEntryId
      ? await api(`/api/rooms/${encodeURIComponent(activeRoom)}/entries/${editingEntryId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      : await api(`/api/rooms/${encodeURIComponent(activeRoom)}/entries`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
    formDirty = false;
    editingEntryId = null;
    renderBoard(data);
    setStatus(formStatus, isUpdate ? "Updated." : "Saved.", "ok");
    const saved = entryByName(data.entries, displayName);
    clearEntryForm({ keepName: true });
    playerSelect.value = displayName;
    if (saved) loadEntryIntoForm(saved);
  } catch (err) {
    setStatus(formStatus, err.message, "err");
  }
}

async function removeEntry(id, rosterName) {
  if (!activeRoom) return;
  const displayName =
    rosterName ||
    selectedPlayerName() ||
    localStorage.getItem(savedNameKey) ||
    prompt("Enter your name to confirm deletion:");
  if (!displayName) return;
  const row = lastBoardData?.entries?.find((x) => x.id === id);
  if (row && !canManageEntry(row)) {
    setStatus(formStatus, "You can only delete your own submission.", "err");
    return;
  }
  if (!confirm("Delete your submission (jersey number, size, and team name)?")) return;

  setStatus(formStatus, "Deleting…");
  try {
    const data = await api(
      `/api/rooms/${encodeURIComponent(activeRoom)}/entries/${id}`,
      { method: "DELETE", body: JSON.stringify({ displayName: displayName.trim() }) }
    );
    if (editingEntryId === id) clearEntryForm({ keepName: false });
    renderBoard(data);
    setStatus(formStatus, "Deleted.", "ok");
  } catch (err) {
    setStatus(formStatus, err.message, "err");
  }
}

function whatsappShareText() {
  const url = activeRoom ? boardUrl(activeRoom) : window.location.href.split("?")[0];
  const title = boardTitle.textContent || "Team jersey board";
  const code = activeRoom || "—";
  const lines = [
    `${title}`,
    "",
    "Submit your jersey number, jersey size, and team name preference here:",
    url,
    "",
    `Room code: ${code}`,
  ];

  if (lastBoardData?.totalPlayers > 0) {
    lines.push("", `Responses: ${lastBoardData.respondedCount}/${lastBoardData.totalPlayers}`);
  }

  return lines.join("\n");
}

function shareWhatsApp() {
  const text = whatsappShareText();
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}

function exportExcel() {
  if (!activeRoom) return;
  window.location.href = `/api/rooms/${encodeURIComponent(activeRoom)}/export`;
}

async function copyLink() {
  if (!activeRoom) return;
  const url = boardUrl(activeRoom);
  try {
    await navigator.clipboard.writeText(url);
    setStatus(formStatus, "Link copied.", "ok");
  } catch {
    prompt("Copy this link:", url);
  }
}

function leaveRoom() {
  stopPolling();
  activeRoom = null;
  lastBoardData = null;
  editingEntryId = null;
  setRoomInUrl("");
  boardPanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
  setStatus(formStatus, "");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    document.getElementById("tab-join").classList.toggle("hidden", tab.dataset.tab !== "join");
    document.getElementById("tab-create").classList.toggle("hidden", tab.dataset.tab !== "create");
  });
});

$("#joinRoomBtn").addEventListener("click", joinRoom);
$("#createRoomBtn").addEventListener("click", createRoom);
$("#openVssBtn").addEventListener("click", () => {
  joinRoomCode.value = "VSS";
  joinRoom();
});
$("#refreshBtn").addEventListener("click", () => activeRoom && loadRoom(activeRoom, { silent: true }));
$("#whatsappShareBtn").addEventListener("click", shareWhatsApp);
$("#copyLinkBtn").addEventListener("click", copyLink);
$("#exportExcelBtn").addEventListener("click", exportExcel);
$("#leaveRoomBtn").addEventListener("click", leaveRoom);
entryForm.addEventListener("submit", submitEntry);
entryForm.addEventListener("input", () => {
  formDirty = true;
});
playerSelect.addEventListener("change", () => {
  formDirty = false;
  if (!lastBoardData) return;
  localStorage.setItem(savedNameKey, playerSelect.value);
  loadEntryForSelectedName(lastBoardData.entries);
  renderRosterTable(lastBoardData);
});
cancelEditBtn.addEventListener("click", () => {
  clearEntryForm({ keepName: true });
  setStatus(formStatus, "");
});

const savedName = localStorage.getItem(savedNameKey);
if (savedName) {
  displayNameInput.value = savedName;
  playerSelect.value = savedName;
}

const urlRoom = getRoomFromUrl();
if (urlRoom) {
  joinRoomCode.value = urlRoom;
  loadRoom(urlRoom).catch(() => {
    setupPanel.classList.remove("hidden");
    boardPanel.classList.add("hidden");
  });
}
