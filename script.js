const BACKEND = "https://admflip-new.onrender.com";

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const loginOverlay = document.getElementById("loginOverlay");
const loginClose = document.getElementById("loginClose");

const usernameInput = document.getElementById("username");
const loginStatus = document.getElementById("loginStatus");
const profile = document.getElementById("profile");
const phraseText = document.getElementById("phrase");
const verifyBtn = document.getElementById("verify");

const chatPanel = document.getElementById("chatPanel");
const chatOpenBtn = document.getElementById("chatOpenBtn");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const mobileChatBtn = document.getElementById("mobileChatBtn");

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const rulesBtn = document.getElementById("rulesBtn");
const rulesBox = document.getElementById("rulesBox");

const coinflipList = document.getElementById("coinflipList");
const valuesGrid = document.getElementById("valuesGrid");
const leaderboard = document.getElementById("leaderboard");

const createFlipBtn = document.getElementById("createFlipBtn");
const historyBtn = document.getElementById("historyBtn");

const flipOverlay = document.getElementById("flipOverlay");
const flipClose = document.getElementById("flipClose");
const createFlipContent = document.getElementById("createFlipContent");

const toastContainer = document.getElementById("toastContainer");

let currentUser = null;
let phrase = "";
let pets = [];
let chatTimer = null;
let onlineTimer = null;

const stateKey = "admflipPage";

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;

  toastContainer.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 3500);
}

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (currentUser?.token) {
    headers.Authorization = `Bearer ${currentUser.token}`;
  }

  const response = await fetch(BACKEND + path, {
    ...options,
    headers
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned invalid data");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

/* =========================
   PAGE NAVIGATION
========================= */

function openPage(page) {
  document.querySelectorAll(".page").forEach(x => {
    x.classList.remove("active");
  });

  const target = document.getElementById(`page-${page}`);

  if (target) {
    target.classList.add("active");
  }

  localStorage.setItem(stateKey, page);

  if (page === "coinflip") {
    loadCoinflips();
  }

  if (page === "values") {
    loadValues();
  }

  if (page === "leaderboard") {
    loadLeaderboard();
  }
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    openPage(button.dataset.page);
  });
});

/* =========================
   CHAT
========================= */

function openChat() {
  chatPanel.classList.add("open");
  loadChat();
}

function closeChat() {
  chatPanel.classList.remove("open");
}

chatOpenBtn.addEventListener("click", openChat);
mobileChatBtn.addEventListener("click", openChat);
chatCloseBtn.addEventListener("click", closeChat);

rulesBtn.addEventListener("click", () => {
  rulesBox.classList.toggle("hidden");
});

async function loadChat() {
  try {
    const data = await api("/chat");

    chatMessages.innerHTML = "";

    if (data.announcement) {
      const announcement = document.createElement("div");
      announcement.className = "chat-announcement";

      announcement.innerHTML = `
        <div class="chat-announcement-title">ADMFLIP ANNOUNCEMENT</div>
        <div class="chat-text"></div>
      `;

      announcement.querySelector(".chat-text").textContent =
        data.announcement;

      chatMessages.appendChild(announcement);
    }

    for (const message of data.messages || []) {
      addChatMessage(message);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    chatMessages.innerHTML = `
      <div class="chat-text">
        Unable to load community chat.
      </div>
    `;
  }
}

function addChatMessage(message) {
  const wrapper = document.createElement("div");
  wrapper.className = "chat-message";

  const name = document.createElement("span");
  name.className = "chat-user";
  name.textContent = message.username || "User";

  const time = document.createElement("span");
  time.className = "chat-time";

  if (message.createdAt) {
    time.textContent = new Date(message.createdAt)
      .toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
  }

  const text = document.createElement("div");
  text.className = "chat-text";
  text.textContent = message.message || "";

  wrapper.appendChild(name);
  wrapper.appendChild(time);
  wrapper.appendChild(text);

  chatMessages.appendChild(wrapper);
}

chatForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    openLogin();
    return;
  }

  const message = chatInput.value.trim();

  if (!message) return;

  try {
    await api("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message
      })
    });

    chatInput.value = "";
    await loadChat();
  } catch (error) {
    toast(error.message);
  }
});

/* =========================
   ONLINE COUNT
========================= */

async function updateOnline() {
  try {
    const data = await api("/status");

    document.getElementById("onlineCount").textContent =
      data.onlineCount;

  } catch {
    document.getElementById("onlineCount").textContent = "42";
  }
}

updateOnline();

onlineTimer = setInterval(updateOnline, 70000 + Math.random() * 70000);

/* =========================
   LOGIN
========================= */

function openLogin() {
  loginOverlay.classList.remove("hidden");
  usernameInput.focus();
}

function closeLogin() {
  loginOverlay.classList.add("hidden");
}

loginBtn.addEventListener("click", () => {
  if (!currentUser) {
    openLogin();
  }
});

loginClose.addEventListener("click", closeLogin);

loginOverlay.addEventListener("click", event => {
  if (event.target === loginOverlay) {
    closeLogin();
  }
});

function showUser() {
  if (!currentUser) return;

  loginBtn.innerHTML = `
    <img src="${escapeAttribute(currentUser.avatar || "/roblox.png")}" alt="">
    <span>${escapeHtml(currentUser.username)}</span>
  `;

  loginBtn.classList.add("logged");
  logoutBtn.style.display = "block";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return String(value).replaceAll('"', "&quot;");
}

usernameInput.addEventListener("change", async () => {
  const username = usernameInput.value.trim();

  if (!username) return;

  loginStatus.textContent = "Finding Roblox account...";
  profile.classList.add("hidden");
  phraseText.classList.add("hidden");
  verifyBtn.style.display = "none";

  try {
    const data = await api(
      `/user/${encodeURIComponent(username)}`
    );

    if (!data.success) {
      loginStatus.textContent =
        data.message || "Roblox username not found.";
      return;
    }

    currentUser = {
      ...data.user
    };

    profile.classList.remove("hidden");

    profile.innerHTML = `
      <img src="${escapeAttribute(currentUser.avatar)}" alt="">
      <br>
      <strong>${escapeHtml(currentUser.username)}</strong>
    `;

    const phraseData = await api("/create");

    phrase = phraseData.phrase;

    phraseText.classList.remove("hidden");

    phraseText.innerHTML = `
      Put this phrase in your Roblox bio:
      <br><br>
      <strong>${escapeHtml(phrase)}</strong>
    `;

    verifyBtn.style.display = "block";
    loginStatus.textContent = "";

  } catch (error) {
    loginStatus.textContent =
      error.message || "Unable to contact the server.";
  }
});

verifyBtn.addEventListener("click", async () => {
  if (!currentUser || !phrase) return;

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Checking...";
  loginStatus.textContent = "";

  try {
    const data = await api("/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: currentUser.username,
        phrase
      })
    });

    if (!data.success) {
      throw new Error(
        data.message || "Verification phrase not found."
      );
    }

    currentUser = {
      ...currentUser,
      token: data.token
    };

    localStorage.setItem(
      "admflipUser",
      JSON.stringify(currentUser)
    );

    showUser();
    closeLogin();

    toast("Roblox account verified.");

    await loadCoinflips();

  } catch (error) {
    loginStatus.textContent = error.message;
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify";
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("admflipUser");
  currentUser = null;

  loginBtn.innerHTML = `
    <img src="/roblox.png" alt="">
    <span>Sign In</span>
  `;

  loginBtn.classList.remove("logged");
  logoutBtn.style.display = "none";
});

/* Restore login after refresh */

try {
  const saved = localStorage.getItem("admflipUser");

  if (saved) {
    currentUser = JSON.parse(saved);
    showUser();
  }
} catch {
  localStorage.removeItem("admflipUser");
}

/* =========================
   VALUES
========================= */

function formatValue(value) {
  return Number(value || 0).toLocaleString();
}

async function loadValues() {
  valuesGrid.innerHTML = `
    <div class="chat-text">Loading values...</div>
  `;

  try {
    const data = await api("/pets");

    pets = data.pets || [];

    renderValues(pets);

  } catch {
    valuesGrid.innerHTML = `
      <div class="chat-text">
        Pet values are currently unavailable.
      </div>
    `;
  }
}

function renderValues(list) {
  valuesGrid.innerHTML = "";

  if (!list.length) {
    valuesGrid.innerHTML = `
      <div class="chat-text">
        No pet values found.
      </div>
    `;
    return;
  }

  list.forEach(pet => {
    const card = document.createElement("div");
    card.className = "value-card";

    if (!pet.image) {
      card.classList.add("no-image");
    }

    card.innerHTML = `
      ${
        pet.image
          ? `<img src="${escapeAttribute(pet.image)}" alt="">`
          : ""
      }

      <h3>${escapeHtml(pet.name)}</h3>

      <div class="value-number">
        ${formatValue(pet.value)}
      </div>
    `;

    valuesGrid.appendChild(card);
  });
}

document.getElementById("valueSearch")
  .addEventListener("input", event => {
    const search = event.target.value
      .toLowerCase()
      .trim();

    const filtered = pets.filter(pet =>
      pet.name.toLowerCase().includes(search)
    );

    renderValues(filtered);
  });

/* =========================
   LEADERBOARD
========================= */

async function loadLeaderboard() {
  leaderboard.innerHTML = `
    <div class="chat-text">Loading leaderboard...</div>
  `;

  try {
    const data = await api("/leaderboard");

    leaderboard.innerHTML = "";

    if (!data.players?.length) {
      leaderboard.innerHTML = `
        <div class="chat-text">
          No wager history yet.
        </div>
      `;
      return;
    }

    data.players.forEach((player, index) => {
      const card = document.createElement("div");
      card.className = "leader-card";

      card.innerHTML = `
        <div class="rank">${index + 1}</div>

        <img
          class="leader-avatar"
          src="${escapeAttribute(player.avatar || "/roblox.png")}"
          alt=""
        >

        <div class="leader-info">
          <div class="leader-name">
            ${escapeHtml(player.username)}
          </div>

          <div class="leader-wager">
            ${formatValue(player.wagered)} value wagered
          </div>
        </div>
      `;

      leaderboard.appendChild(card);
    });

  } catch {
    leaderboard.innerHTML = `
      <div class="chat-text">
        Unable to load leaderboard.
      </div>
    `;
  }
}

/* =========================
   COINFLIPS
========================= */

async function loadCoinflips() {
  coinflipList.innerHTML = `
    <div class="chat-text">Loading active coinflips...</div>
  `;

  try {
    const data = await api("/coinflips");

    coinflipList.innerHTML = "";

    if (!data.coinflips?.length) {
      coinflipList.innerHTML = `
        <div class="chat-text">
          No active coinflips yet.
        </div>
      `;
      return;
    }

    data.coinflips.forEach(flip => {
      const card = document.createElement("div");
      card.className = "flip-card";

      card.innerHTML = `
        <div class="flip-left">
          ${
            flip.pet?.image
              ? `<img class="pet-image" src="${escapeAttribute(flip.pet.image)}">`
              : `<div class="pet-image"></div>`
          }

          <div>
            <div class="pet-name">
              ${escapeHtml(flip.pet.name)}
            </div>

            <div class="pet-value">
              ${formatValue(flip.pet.value)}
            </div>

            <span class="side-badge">
              SIDE ${escapeHtml(flip.side)}
            </span>

            <div class="chat-text">
              by ${escapeHtml(flip.username)}
            </div>
          </div>
        </div>

        <button class="purple-btn join-flip">
          Join
        </button>
      `;

      card.querySelector(".join-flip")
        .addEventListener("click", () => joinFlip(flip._id));

      coinflipList.appendChild(card);
    });

  } catch (error) {
    coinflipList.innerHTML = `
      <div class="chat-text">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

createFlipBtn.addEventListener("click", async () => {
  if (!currentUser) {
    openLogin();
    return;
  }

  flipOverlay.classList.remove("hidden");
  createFlipContent.innerHTML = `
    <div class="chat-text">Loading inventory...</div>
  `;

  try {
    const data = await api("/me");

    const inventory = data.user?.inventory || [];

    if (!inventory.length) {
      createFlipContent.innerHTML = `
        <div class="deposit-box">
          <p>You don't have any pets deposited.</p>

          <button class="purple-btn" id="depositBtn">
            Deposit
          </button>

          <p class="muted">
            Deposit via Discord — safe option.
            Automatic bot deposits coming soon.
          </p>
        </div>
      `;

      document.getElementById("depositBtn")
        .addEventListener("click", () => {
          toast("Discord deposit is coming soon.");
        });

      return;
    }

    createFlipContent.innerHTML = `
      <div class="inventory-list">
        ${inventory.map((item, index) => `
          <button
            class="inventory-item"
            data-index="${index}"
          >
            ${
              item.image
                ? `<img src="${escapeAttribute(item.image)}">`
                : `<div class="pet-image small"></div>`
            }

            <span>
              <strong>${escapeHtml(item.name)}</strong>
              <br>
              <small>
                ${formatValue(item.value)}
              </small>
            </span>
          </button>
        `).join("")}
      </div>
    `;

    createFlipContent
      .querySelectorAll(".inventory-item")
      .forEach(button => {
        button.addEventListener("click", () => {
          showSideChoice(
            inventory[Number(button.dataset.index)]
          );
        });
      });

  } catch (error) {
    createFlipContent.innerHTML = `
      <div class="chat-text">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
});

function showSideChoice(item) {
  createFlipContent.innerHTML = `
    <h3>${escapeHtml(item.name)}</h3>

    <p class="muted">
      Value: ${formatValue(item.value)}
    </p>

    <p>Choose your side:</p>

    <div class="page-actions">
      <button class="purple-btn" id="headsBtn">
        HEADS
      </button>

      <button class="ghost-btn" id="tailsBtn">
        TAILS
      </button>
    </div>
  `;

  document.getElementById("headsBtn")
    .addEventListener("click", () => createFlip(item, "HEADS"));

  document.getElementById("tailsBtn")
    .addEventListener("click", () => createFlip(item, "TAILS"));
}

async function createFlip(item, side) {
  try {
    await api("/coinflips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        itemId: item._id,
        side
      })
    });

    flipOverlay.classList.add("hidden");
    toast("Coinflip created.");
    await loadCoinflips();

  } catch (error) {
    toast(error.message);
  }
}

async function joinFlip(id) {
  if (!currentUser) {
    openLogin();
    return;
  }

  try {
    await api(`/coinflips/${id}/join`, {
      method: "POST"
    });

    toast("Coinflip joined.");
    await loadCoinflips();

  } catch (error) {
    toast(error.message);
  }
}

historyBtn.addEventListener("click", async () => {
  if (!currentUser) {
    openLogin();
    return;
  }

  try {
    const data = await api("/coinflips/history");

    if (!data.history?.length) {
      toast("No coinflip history yet.");
      return;
    }

    toast(`${data.history.length} completed coinflip(s).`);

  } catch (error) {
    toast(error.message);
  }
});

flipClose.addEventListener("click", () => {
  flipOverlay.classList.add("hidden");
});

flipOverlay.addEventListener("click", event => {
  if (event.target === flipOverlay) {
    flipOverlay.classList.add("hidden");
  }
});

/* =========================
   STARTUP
========================= */

const savedPage =
  localStorage.getItem(stateKey) || "coinflip";

openPage(savedPage);

setInterval(() => {
  if (chatPanel.classList.contains("open")) {
    loadChat();
  }
}, 15000);
