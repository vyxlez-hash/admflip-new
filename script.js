const BACKEND = "https://admflip-new.onrender.com";

const $ = id => document.getElementById(id);

let currentUser = null;
let phrase = "";
let pets = [];
let selectedPet = null;
let selectedSide = null;
let chatOpen = false;

const saved = localStorage.getItem("admflipUser");
if (saved) {
  try {
    currentUser = JSON.parse(saved);
    showUser();
  } catch {
    localStorage.removeItem("admflipUser");
  }
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  $("toastContainer").appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function openModal(id) {
  $(id).classList.add("show");
}

function closeModal(id) {
  $(id).classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.onclick = () => closeModal(btn.dataset.close);
});

function showUser() {
  if (!currentUser) return;

  $("loginBtn").innerHTML = `
    <img src="${escapeAttr(currentUser.avatar || "roblox.png")}" alt="">
    <span>${escapeHtml(currentUser.username)}</span>
  `;

  $("logoutBtn").style.display = "block";
  $("inventoryBtn").style.display = "block";
}

$("loginBtn").onclick = () => {
  if (!currentUser) openModal("loginModal");
};

$("logoutBtn").onclick = () => {
  localStorage.removeItem("admflipUser");
  currentUser = null;

  $("loginBtn").innerHTML =
    `<img src="roblox.png" alt=""><span>Sign In</span>`;

  $("logoutBtn").style.display = "none";
  $("inventoryBtn").style.display = "none";
};

$("username").addEventListener("change", async () => {
  const username = $("username").value.trim();
  if (!username) return;

  $("loginMessage").classList.add("hidden");

  try {
    const response = await fetch(
      `${BACKEND}/user/${encodeURIComponent(username)}`
    );

    if (!response.ok) throw new Error("Server");

    const data = await response.json();

    if (!data.success) {
      showLoginMessage("Roblox username not found.");
      return;
    }

    currentUser = data.user;

    $("profile").classList.remove("hidden");
    $("profile").innerHTML = `
      <img src="${escapeAttr(currentUser.avatar)}">
      <div>
        <b>${escapeHtml(currentUser.username)}</b>
        <small>Roblox profile found</small>
      </div>
    `;

    const phraseResponse = await fetch(`${BACKEND}/create`);
    const phraseData = await phraseResponse.json();

    phrase = phraseData.phrase;

    $("phrase").classList.remove("hidden");
    $("phrase").innerHTML = `
      Put this phrase in your Roblox bio:
      <strong>${escapeHtml(phrase)}</strong>
    `;

    $("verify").style.display = "block";
  } catch (err) {
    showLoginMessage("Unable to connect to the verification server.");
  }
});

function showLoginMessage(text) {
  $("loginMessage").textContent = text;
  $("loginMessage").classList.remove("hidden");
}

$("verify").onclick = async () => {
  $("verify").disabled = true;
  $("verify").textContent = "Checking...";

  try {
    const response = await fetch(`${BACKEND}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUser.username,
        phrase
      })
    });

    const data = await response.json();

    if (!data.success) {
      showLoginMessage("Verification phrase was not found in your bio.");
      $("verify").disabled = false;
      $("verify").textContent = "Verify";
      return;
    }

    localStorage.setItem(
      "admflipUser",
      JSON.stringify(currentUser)
    );

    $("loginModal").classList.remove("show");
    showUser();

    toast("Successfully signed in.");
    loadInventory();
  } catch {
    showLoginMessage("Verification server error.");
  }

  $("verify").disabled = false;
  $("verify").textContent = "Verify";
};

async function loadInventory() {
  if (!currentUser) return;

  try {
    const r = await fetch(
      `${BACKEND}/inventory/${encodeURIComponent(currentUser.id)}`
    );

    if (!r.ok) return;

    const data = await r.json();
    currentUser.inventory = data.inventory || [];
    localStorage.setItem("admflipUser", JSON.stringify(currentUser));

    renderInventory("inventoryGrid", currentUser.inventory);
  } catch {}
}

function renderInventory(id, inventory) {
  const box = $(id);

  if (!inventory || !inventory.length) {
    box.innerHTML = `
      <div class="emptyInventory">
        <h3>No pets yet</h3>
        <p>Deposit pets to start flipping.</p>
        <button class="primary" onclick="deposit()">Deposit</button>
      </div>
    `;
    return;
  }

  box.innerHTML = inventory.map((pet, index) => `
    <button class="petCard"
      data-index="${index}"
      onclick="selectPet('${id}', ${index})">
      <div class="petImage">
        ${pet.image
          ? `<img src="${escapeAttr(pet.image)}" onerror="this.style.display='none'">`
          : `<span>${escapeHtml((pet.name || "?")[0])}</span>`}
      </div>
      <strong>${escapeHtml(pet.name || "Unknown Pet")}</strong>
      <small>${formatValue(pet.value)}</small>
    </button>
  `).join("");
}

window.selectPet = function(id, index) {
  const inventory =
    id === "tipInventory"
      ? currentUser.inventory || []
      : currentUser.inventory || [];

  selectedPet = inventory[index];

  document.querySelectorAll(`#${id} .petCard`)
    .forEach(x => x.classList.remove("selected"));

  const card = document.querySelector(
    `#${id} .petCard[data-index="${index}"]`
  );

  if (card) card.classList.add("selected");

  if (id === "tipInventory") {
    tipPet();
  }
};

$("inventoryBtn").onclick = async () => {
  await loadInventory();
  openModal("inventoryModal");
};

$("depositBtn").onclick = deposit;
$("withdrawBtn").onclick = withdraw;

function deposit() {
  toast("Deposit is currently a Discord-assisted feature.");
}

function withdraw() {
  toast("Withdraw requests will be processed through the trade system.");
}

async function loadPets() {
  try {
    const r = await fetch(`${BACKEND}/pets`);
    const data = await r.json();

    pets = data.pets || [];
    renderValues();
  } catch {
    $("valuesGrid").innerHTML =
      `<div class="emptyInventory">Unable to load values right now.</div>`;
  }
}

function renderValues() {
  if (!pets.length) {
    $("valuesGrid").innerHTML =
      `<div class="emptyInventory">No values available.</div>`;
    return;
  }

  $("valuesGrid").innerHTML = pets.map(pet => `
    <div class="valueCard">
      <div class="valueImage">
        ${pet.image
          ? `<img src="${escapeAttr(pet.image)}"
              onerror="this.style.display='none'">`
          : `<span>${escapeHtml((pet.name || "?")[0])}</span>`}
      </div>
      <div>
        <strong>${escapeHtml(pet.name)}</strong>
        <span>${formatValue(pet.value)}</span>
      </div>
    </div>
  `).join("");
}

function formatValue(value) {
  const n = Number(value) || 0;
  return n.toLocaleString();
}

document.querySelectorAll("[data-page]").forEach(link => {
  link.onclick = e => {
    e.preventDefault();
    showPage(link.dataset.page);
  };
});

function showPage(page) {
  document.querySelectorAll(".page")
    .forEach(x => x.classList.add("hidden"));

  const target = $(`${page}Page`);
  if (target) target.classList.remove("hidden");

  localStorage.setItem("admflipPage", page);

  if (page === "values") loadPets();
  if (page === "leaderboard") loadLeaderboard();
  if (page === "coinflip") loadCoinflips();
}

$("chatNav").onclick = e => {
  e.preventDefault();
  toggleChat();
};

$("mobileChatBtn").onclick = toggleChat;
$("closeChat").onclick = () => toggleChat(false);

function toggleChat(force) {
  chatOpen = typeof force === "boolean" ? force : !chatOpen;

  $("chatPanel").classList.toggle("open", chatOpen);
  $("mobileChatBtn").classList.toggle("hidden", chatOpen);

  localStorage.setItem("admflipChatOpen", chatOpen ? "1" : "0");
}

$("rulesBtn").onclick = () => {
  toast("Rules: no advertising, no harassment, no sexual content, no spam, and no scams.");
};

$("sendChat").onclick = sendChat;

$("chatText").addEventListener("keydown", e => {
  if (e.key === "Enter") sendChat();
});

async function sendChat() {
  if (!currentUser) {
    toast("Sign in first to chat.");
    return;
  }

  const input = $("chatText");
  const message = input.value.trim();

  if (!message) return;

  if (/(https?:\/\/|www\.|discord\.gg|\.com\b|\.net\b|\.gg\b|\.org\b)/i.test(message)) {
    toast("Links are not allowed in chat.");
    return;
  }

  try {
    const r = await fetch(`${BACKEND}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        robloxId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
        message
      })
    });

    const data = await r.json();

    if (!data.success) {
      toast(data.message || "Could not send message.");
      return;
    }

    input.value = "";
    loadChat();
  } catch {
    toast("Chat server unavailable.");
  }
}

async function loadChat() {
  try {
    const r = await fetch(`${BACKEND}/chat`);
    const data = await r.json();

    $("chatMessages").innerHTML = (data.messages || []).map(msg => `
      <div class="chatMessage">
        <img src="${escapeAttr(msg.avatar || "roblox.png")}">
        <div>
          <button class="chatUser"
            onclick='openUser(${JSON.stringify(msg.robloxId)})'>
            ${escapeHtml(msg.username)}
          </button>
          <p>${escapeHtml(msg.message)}</p>
        </div>
      </div>
    `).join("");

    $("chatMessages").scrollTop =
      $("chatMessages").scrollHeight;
  } catch {}
}

window.openUser = async function(id) {
  try {
    const r = await fetch(`${BACKEND}/user-stats/${id}`);
    const data = await r.json();

    $("userProfile").innerHTML = `
      <div class="bigProfile">
        <img src="${escapeAttr(data.avatar || "roblox.png")}">
        <h2>${escapeHtml(data.username || "User")}</h2>
        <div class="stats">
          <div><b>${formatValue(data.wagered)}</b><small>Wagered</small></div>
          <div><b>${formatValue(data.profit)}</b><small>Profit</small></div>
        </div>
        <button class="primary full"
          onclick='openTip(${JSON.stringify(id)})'>
          Tip
        </button>
      </div>
    `;

    openModal("userModal");
  } catch {
    toast("Could not load profile.");
  }
};

window.openTip = async function(id) {
  if (!currentUser) {
    toast("Sign in first.");
    return;
  }

  closeModal("userModal");

  await loadInventory();

  $("tipInventory").innerHTML =
    (currentUser.inventory || []).map((pet, index) => `
      <button class="petCard"
        onclick="sendTip('${id}', ${index})">
        <div class="petImage">
          ${pet.image
            ? `<img src="${escapeAttr(pet.image)}">`
            : `<span>${escapeHtml((pet.name || "?")[0])}</span>`}
        </div>
        <strong>${escapeHtml(pet.name)}</strong>
        <small>${formatValue(pet.value)}</small>
      </button>
    `).join("");

  openModal("tipModal");
};

window.sendTip = async function(targetId, index) {
  const pet = currentUser.inventory[index];
  if (!pet) return;

  if (!confirm(`Tip ${pet.name}?`)) return;

  try {
    const r = await fetch(`${BACKEND}/tip`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        fromId: currentUser.id,
        toId: targetId,
        petId: pet._id || pet.id,
        petName: pet.name
      })
    });

    const data = await r.json();

    if (!data.success) {
      toast(data.message || "Tip failed.");
      return;
    }

    toast("Pet tipped successfully.");
    closeModal("tipModal");
    await loadInventory();
  } catch {
    toast("Tip server unavailable.");
  }
};

function tipPet() {}

async function loadCoinflips() {
  try {
    const r = await fetch(`${BACKEND}/coinflips`);
    const data = await r.json();

    const flips = data.coinflips || [];

    if (!flips.length) {
      $("coinflips").innerHTML =
        `<div class="emptyState">No active coinflips yet.</div>`;
      return;
    }

    $("coinflips").innerHTML = flips.map(f => `
      <div class="flipCard">
        <div class="flipUser">
          <img src="${escapeAttr(f.avatar || "roblox.png")}">
          <div>
            <strong>${escapeHtml(f.username)}</strong>
            <small>${escapeHtml(f.side)}</small>
          </div>
        </div>

        <div class="flipPet">
          ${f.petImage
            ? `<img src="${escapeAttr(f.petImage)}">`
            : ""}
          <div>
            <strong>${escapeHtml(f.petName)}</strong>
            <span>${formatValue(f.petValue)}</span>
          </div>
        </div>

        <button class="primary"
          onclick="joinFlip('${escapeAttr(f._id)}')">
          Join
        </button>
      </div>
    `).join("");
  } catch {
    $("coinflips").innerHTML =
      `<div class="emptyState">Coinflips are temporarily unavailable.</div>`;
  }
}

$("createFlipBtn").onclick = async () => {
  if (!currentUser) {
    openModal("loginModal");
    toast("Sign in first to create a coinflip.");
    return;
  }

  await loadInventory();
  renderInventory("createInventory", currentUser.inventory || []);
  selectedPet = null;
  selectedSide = null;
  $("botArea").classList.add("hidden");
  openModal("createModal");
};

document.querySelectorAll(".sideBtn").forEach(btn => {
  btn.onclick = () => {
    selectedSide = btn.dataset.side;
    document.querySelectorAll(".sideBtn")
      .forEach(x => x.classList.remove("selected"));
    btn.classList.add("selected");
  };
});

$("submitFlip").onclick = async () => {
  if (!selectedPet) {
    toast("Choose a pet first.");
    return;
  }

  if (!selectedSide) {
    toast("Choose heads or tails.");
    return;
  }

  try {
    const r = await fetch(`${BACKEND}/coinflips`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        robloxId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
        petId: selectedPet._id || selectedPet.id,
        petName: selectedPet.name,
        petValue: selectedPet.value,
        petImage: selectedPet.image || "",
        side: selectedSide
      })
    });

    const data = await r.json();

    if (!data.success) {
      toast(data.message || "Could not create flip.");
      return;
    }

    toast("Coinflip created.");
    $("botArea").classList.remove("hidden");
    loadCoinflips();
  } catch {
    toast("Coinflip server unavailable.");
  }
};

$("callBot").onclick = async () => {
  if (!currentUser) return;

  try {
    const r = await fetch(`${BACKEND}/coinflips/bot`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        robloxId: currentUser.id
      })
    });

    const data = await r.json();

    if (!data.success) {
      toast(data.message || "Bot unavailable.");
      return;
    }

    closeModal("createModal");

    showCoinflipResult(data.result);
    loadInventory();
    loadCoinflips();
  } catch {
    toast("Bot unavailable.");
  }
};

window.joinFlip = async function(id) {
  if (!currentUser) {
    openModal("loginModal");
    toast("Sign in first.");
    return;
  }

  try {
    const r = await fetch(`${BACKEND}/coinflips/${id}/join`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        robloxId: currentUser.id
      })
    });

    const data = await r.json();

    if (!data.success) {
      toast(data.message || "Unable to join.");
      return;
    }

    showCoinflipResult(data.result);
    loadInventory();
    loadCoinflips();
  } catch {
    toast("Join failed.");
  }
};

function showCoinflipResult(result) {
  const winner =
    result.winnerUsername || "Winner";

  toast(`Flip finished — ${winner} won!`);
}

async function loadLeaderboard() {
  try {
    const r = await fetch(`${BACKEND}/leaderboard`);
    const data = await r.json();

    $("leaderboard").innerHTML =
      (data.users || []).slice(0, 10).map((u, i) => `
        <div class="leaderRow">
          <div class="rank">${i + 1}</div>
          <img src="${escapeAttr(u.avatar || "roblox.png")}">
          <div class="leaderName">
            <strong>${escapeHtml(u.username)}</strong>
            <small>TOP FLIPPER</small>
          </div>
          <b>${formatValue(u.wagered)}</b>
        </div>
      `).join("");
  } catch {
    $("leaderboard").innerHTML =
      `<div class="emptyState">Leaderboard unavailable.</div>`;
  }
}

function updateOnline() {
  const n = 20 + Math.floor(Math.random() * 26);
  $("onlineCount").textContent = n;
}

loadPets();
loadCoinflips();
loadChat();
updateOnline();

setInterval(loadChat, 4000);
setInterval(updateOnline, 100000);

const savedPage = localStorage.getItem("admflipPage") || "coinflip";
showPage(savedPage);

if (localStorage.getItem("admflipChatOpen") === "1") {
  toggleChat(true);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
