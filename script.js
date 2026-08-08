
const BACKEND = "https://admflip-new.onrender.com";

const state = {
  user: null,
  pets: [],
  selectedPet: null,
  selectedSide: null,
  currentPage: "coinflip",
  phrase: null
};

const $ = id => document.getElementById(id);

/* =====================================================
   API
===================================================== */

async function api(path, options = {}) {
  const response = await fetch(BACKEND + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok) {
    throw new Error(data?.message || `Server error (${response.status})`);
  }

  return data;
}

/* =====================================================
   TOAST
===================================================== */

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

/* =====================================================
   HELPERS
===================================================== */

function formatValue(value) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 6
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function petImage(pet) {
  if (!pet) return "";

  if (pet.image) {
    return pet.image;
  }

  const name = String(pet.name || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!name) return "";

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(name) +
    ".webp"
  );
}

/* =====================================================
   USER STORAGE
===================================================== */

function saveUser() {
  if (!state.user) return;

  localStorage.setItem(
    "admflipUser",
    JSON.stringify(state.user)
  );
}

function clearSavedUser() {
  localStorage.removeItem("admflipUser");
}

async function restoreUser() {
  const saved = localStorage.getItem("admflipUser");

  if (!saved) return;

  try {
    state.user = JSON.parse(saved);

    if (!state.user?.id) {
      clearSavedUser();
      return;
    }

    await refreshAccount();
    showLoggedIn();

  } catch (error) {
    console.error("Restore user:", error);

    clearSavedUser();
    state.user = null;
  }
}

async function refreshAccount() {
  if (!state.user?.id) return;

  try {
    const data = await api(
      "/account/" +
      encodeURIComponent(state.user.id)
    );

    if (data.success && data.user) {
      state.user = {
        ...state.user,
        ...data.user
      };

      saveUser();
    }

  } catch (error) {
    console.warn("Account refresh failed:", error.message);
  }
}

/* =====================================================
   LOGIN UI
===================================================== */

function showLoggedIn() {
  if (!state.user) return;

  const loginBtn = $("loginBtn");
  const accountBox = $("accountBox");
  const accountUsername = $("accountUsername");
  const accountAvatar = $("accountAvatar");
  const chatInput = $("chatInput");

  if (loginBtn) {
    loginBtn.classList.add("hidden");
  }

  if (accountBox) {
    accountBox.classList.remove("hidden");
  }

  if (accountUsername) {
    accountUsername.textContent =
      state.user.username || "User";
  }

  if (accountAvatar) {
    accountAvatar.src =
      state.user.avatar || "/logo.png";
  }

  if (chatInput) {
    chatInput.placeholder = "Message chat...";
  }
}

function logout() {
  state.user = null;
  state.selectedPet = null;
  state.selectedSide = null;

  clearSavedUser();

  $("loginBtn")?.classList.remove("hidden");
  $("accountBox")?.classList.add("hidden");

  if ($("chatInput")) {
    $("chatInput").placeholder = "Sign in to chat...";
  }

  toast("Signed out");
}

/* =====================================================
   LOGIN MODAL
===================================================== */

$("loginBtn")?.addEventListener("click", () => {
  $("loginModal")?.classList.remove("hidden");
});

$("closeLogin")?.addEventListener("click", () => {
  $("loginModal")?.classList.add("hidden");
});

$("logoutBtn")?.addEventListener("click", logout);

/* =====================================================
   ROBLOX USER LOOKUP
===================================================== */

$("username")?.addEventListener("change", async () => {
  const username = $("username").value.trim();

  if (!username) return;

  $("loginMessage").textContent =
    "Checking Roblox username...";

  $("verify").style.display = "none";
  $("phrase").classList.add("hidden");

  try {
    const data = await api(
      "/user/" +
      encodeURIComponent(username)
    );

    if (!data.success || !data.user) {
      $("loginMessage").textContent =
        data.message || "Roblox username not found.";

      return;
    }

    state.user = data.user;

    $("loginProfile").classList.remove("hidden");

    $("loginProfile").innerHTML = `
      <img
        src="${escapeAttr(state.user.avatar || "/logo.png")}"
        alt=""
        onerror="this.src='/logo.png'"
      >

      <div>
        <b>${escapeHtml(state.user.username)}</b>
      </div>
    `;

    $("loginMessage").textContent =
      "Creating verification phrase...";

    const phraseData =
      await api("/create");

    state.phrase = phraseData.phrase;

    $("phrase").classList.remove("hidden");

    $("phrase").innerHTML = `
      <div class="phrase-title">
        Put this phrase in your Roblox bio:
      </div>

      <br>

      <b>${escapeHtml(state.phrase)}</b>
    `;

    $("verify").style.display = "block";

    $("loginMessage").textContent =
      "After adding it to your Roblox profile, click Verify.";

  } catch (error) {
    console.error(error);

    $("loginMessage").textContent =
      error.message || "Server error.";
  }
});

/* =====================================================
   VERIFY ROBLOX BIO
===================================================== */

$("verify")?.addEventListener("click", async () => {
  if (!state.user || !state.phrase) {
    toast("Enter your Roblox username first.");
    return;
  }

  $("verify").disabled = true;
  $("verify").textContent = "Checking...";

  try {
    const data = await api("/check", {
      method: "POST",

      body: JSON.stringify({
        username: state.user.username,
        phrase: state.phrase
      })
    });

    if (!data.success) {
      toast(
        data.message ||
        "Verification phrase was not found."
      );

      $("verify").disabled = false;
      $("verify").textContent = "Verify";

      return;
    }

    state.user = {
      id: data.id,
      username: data.username,
      avatar: data.avatar || state.user.avatar || "",
      inventory: []
    };

    await refreshAccount();

    saveUser();

    $("loginModal").classList.add("hidden");

    $("username").value = "";

    $("loginProfile").classList.add("hidden");
    $("phrase").classList.add("hidden");

    $("verify").style.display = "none";
    $("verify").disabled = false;
    $("verify").textContent = "Verify";

    $("loginMessage").textContent = "";

    showLoggedIn();

    toast("Verified successfully");

    await loadChat();

  } catch (error) {
    console.error(error);

    toast(error.message);

    $("verify").disabled = false;
    $("verify").textContent = "Verify";
  }
});

/* =====================================================
   PAGES
===================================================== */

function showPage(page) {
  const validPages = [
    "coinflip",
    "values",
    "leaderboard",
    "profile"
  ];

  if (!validPages.includes(page)) {
    page = "coinflip";
  }

  state.currentPage = page;

  document
    .querySelectorAll(".page")
    .forEach(el => {
      el.classList.add("hidden");
    });

  const target = $(page + "Page");

  if (target) {
    target.classList.remove("hidden");
  }

  if (page === "coinflip") {
    loadCoinflips();
  }

  if (page === "values") {
    loadValues();
  }

  if (page === "leaderboard") {
    loadLeaderboard();
  }

  if (page === "profile") {
    renderProfile();
  }

  localStorage.setItem(
    "admflipPage",
    page
  );
}

document
  .querySelectorAll("[data-page]")
  .forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      const page =
        link.dataset.page;

      if (page === "chat") {
        openChat();
        return;
      }

      showPage(page);

      history.replaceState(
        null,
        "",
        "#" + page
      );
    });
  });

function restorePage() {
  const hash =
    location.hash.replace("#", "");

  const saved =
    localStorage.getItem("admflipPage");

  const page =
    hash ||
    saved ||
    "coinflip";

  if (page === "chat") {
    showPage("coinflip");
    openChat();
    return;
  }

  showPage(page);
}

/* =====================================================
   VALUES
===================================================== */

async function loadValues() {
  if (state.pets.length) {
    renderValues(state.pets);
    return;
  }

  try {
    const data =
      await api("/pets");

    state.pets =
      Array.isArray(data.pets)
        ? data.pets
        : [];

    renderValues(state.pets);

  } catch (error) {
    console.error("Values:", error);

    $("valuesGrid").innerHTML = `
      <div class="loading">
        Unable to load pet values.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function makePetCard(pet, selectable = false) {
  const card =
    document.createElement("div");

  card.className =
    "pet-card";

  const image =
    petImage(pet);

  card.innerHTML = `
    ${
      image
        ? `
          <img
            class="pet-image"
            src="${escapeAttr(image)}"
            alt="${escapeAttr(pet.name)}"
            loading="lazy"
            onerror="this.classList.add('missing')"
          >
        `
        : `
          <div class="pet-image missing"></div>
        `
    }

    <div class="pet-name">
      ${escapeHtml(pet.name)}
    </div>

    <div class="pet-meta">

      <span>
        ${escapeHtml(pet.variant || pet.rarity || "")}
      </span>

      <span class="pet-value">
        ${formatValue(pet.value)}
      </span>

    </div>
  `;

  if (selectable) {
    card.addEventListener("click", () => {

      document
        .querySelectorAll(
          "#createInventory .pet-card"
        )
        .forEach(x => {
          x.classList.remove("selected");
        });

      card.classList.add("selected");

      state.selectedPet = pet;

      $("sideArea")?.classList.remove("hidden");
    });
  }

  return card;
}

function renderValues(pets) {
  const grid = $("valuesGrid");

  if (!grid) return;

  grid.innerHTML = "";

  if (!pets.length) {
    grid.innerHTML =
      `<div class="loading">No values found.</div>`;

    return;
  }

  pets.forEach(pet => {
    grid.appendChild(
      makePetCard(pet)
    );
  });
}

$("valueSearch")?.addEventListener(
  "input",
  () => {
    const query =
      $("valueSearch")
        .value
        .toLowerCase()
        .trim();

    const filtered =
      state.pets.filter(pet =>
        String(pet.name)
          .toLowerCase()
          .includes(query)
      );

    renderValues(filtered);
  }
);

/* =====================================================
   INVENTORY
===================================================== */

async function loadInventory() {
  if (!state.user?.id) return [];

  try {
    /*
      IMPORTANT:
      Your current backend does NOT have
      /inventory/:id.

      It exposes:
      /account/:robloxId
    */

    const data =
      await api(
        "/account/" +
        encodeURIComponent(
          state.user.id
        )
      );

    state.user.inventory =
      data.user?.inventory || [];

    state.user.balance =
      data.user?.balance || 0;

    state.user.wagered =
      data.user?.wagered || 0;

    state.user.profit =
      data.user?.profit || 0;

    saveUser();

    return state.user.inventory;

  } catch (error) {
    console.error(
      "Inventory:",
      error.message
    );

    state.user.inventory =
      state.user.inventory || [];

    return state.user.inventory;
  }
}

$("inventoryBtn")?.addEventListener(
  "click",
  async () => {

    if (!state.user) {
      $("loginModal")
        ?.classList.remove("hidden");

      return;
    }

    $("inventoryModal")
      ?.classList.remove("hidden");

    await loadInventory();

    renderInventory();
  }
);

$("closeInventory")?.addEventListener(
  "click",
  () => {
    $("inventoryModal")
      ?.classList.add("hidden");
  }
);

function renderInventory() {
  const grid =
    $("inventoryGrid");

  if (!grid) return;

  grid.innerHTML = "";

  const inventory =
    state.user?.inventory || [];

  if (!inventory.length) {
    grid.innerHTML = `
      <div class="loading">
        Your inventory is empty.
      </div>
    `;

    return;
  }

  inventory.forEach(item => {
    grid.appendChild(
      makePetCard({
        ...item,
        id: item.itemId
      })
    );
  });
}

/* =====================================================
   CREATE COINFLIP
===================================================== */

$("createCoinflipBtn")?.addEventListener(
  "click",
  async () => {

    if (!state.user) {
      $("loginModal")
        ?.classList.remove("hidden");

      toast("Sign in first.");

      return;
    }

    $("createModal")
      ?.classList.remove("hidden");

    $("sideArea")
      ?.classList.add("hidden");

    state.selectedPet = null;
    state.selectedSide = null;

    document
      .querySelectorAll(".side-btn")
      .forEach(button => {
        button.classList.remove("selected");
      });

    await loadInventory();

    const grid =
      $("createInventory");

    if (!grid) return;

    grid.innerHTML = "";

    const inventory =
      state.user.inventory || [];

    if (!inventory.length) {
      grid.innerHTML = `
        <div class="loading">
          No pets in your inventory.
          <br><br>
          Your backend currently has no
          public deposit endpoint.
        </div>
      `;

      return;
    }

    inventory.forEach(item => {

      grid.appendChild(
        makePetCard(
          {
            ...item,
            id: item.itemId
          },
          true
        )
      );

    });
  }
);

$("closeCreate")?.addEventListener(
  "click",
  () => {
    $("createModal")
      ?.classList.add("hidden");
  }
);

/* =====================================================
   SIDES
===================================================== */

document
  .querySelectorAll(".side-btn")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".side-btn")
          .forEach(x => {
            x.classList.remove("selected");
          });

        button.classList.add("selected");

        /*
          HTML uses H/T.

          Backend expects:
          heads / tails
        */

        state.selectedSide =
          button.dataset.side === "H"
            ? "heads"
            : "tails";
      }
    );
  });

/* =====================================================
   POST COINFLIP
===================================================== */

$("postCoinflip")?.addEventListener(
  "click",
  async () => {

    if (
      !state.user ||
      !state.selectedPet ||
      !state.selectedSide
    ) {
      toast(
        "Choose a pet and side first."
      );

      return;
    }

    const itemId =
      state.selectedPet.itemId ||
      state.selectedPet.id;

    if (!itemId) {
      toast(
        "This inventory item has no ID."
      );

      return;
    }

    try {

      await api(
        "/coinflips",
        {
          method: "POST",

          body: JSON.stringify({
            robloxId:
              Number(state.user.id),

            itemId,

            side:
              state.selectedSide
          })
        }
      );

      toast(
        "Coinflip posted."
      );

      $("createModal")
        ?.classList.add("hidden");

      state.selectedPet = null;
      state.selectedSide = null;

      await loadInventory();
      await loadCoinflips();

    } catch (error) {

      console.error(
        "Create coinflip:",
        error
      );

      toast(error.message);
    }
  }
);

/* =====================================================
   COINFLIPS
===================================================== */

async function loadCoinflips() {
  try {

    const data =
      await api("/coinflips");

    renderCoinflips(
      data.coinflips || []
    );

  } catch (error) {

    console.error(
      "Coinflips:",
      error
    );

    $("coinflips").innerHTML = `
      <div class="loading">
        Unable to load coinflips.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function renderCoinflips(list) {
  const container =
    $("coinflips");

  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `
      <div class="loading">
        No active coinflips yet.
      </div>
    `;

    return;
  }

  list.forEach(cf => {

    const element =
      document.createElement("div");

    element.className =
      "coinflip";

    const image =
      petImage(cf);

    element.innerHTML = `
      <div class="cf-users">

        <span>
          ${escapeHtml(
            cf.username || "Trader"
          )}
        </span>

        <span class="cf-side-label">
          ${escapeHtml(
            String(cf.side || "").toUpperCase()
          )}
        </span>

      </div>

      <div class="cf-body">

        <div class="cf-side">

          <div class="cf-pet">

            ${
              image
                ? `
                  <img
                    src="${escapeAttr(image)}"
                    alt="${escapeAttr(cf.petName)}"
                    loading="lazy"
                    onerror="this.classList.add('missing')"
                  >
                `
                : ""
            }

            <div>

              <b>
                ${escapeHtml(
                  cf.petName || "Pet"
                )}
              </b>

              <div class="muted">
                ${formatValue(
                  cf.petValue
                )}
              </div>

              ${
                cf.variant
                  ? `
                    <div class="muted">
                      ${escapeHtml(
                        cf.variant
                      )}
                    </div>
                  `
                  : ""
              }

            </div>

          </div>

        </div>

        <div class="cf-center">

          <div class="coin">
            ${escapeHtml(
              String(
                cf.side || "?"
              ).toUpperCase()
            )}
          </div>

          <small class="muted">
            Waiting for trader
          </small>

        </div>

        <div class="cf-side">

          <div class="cf-pet waiting-pet">
            <div class="waiting-icon">
              ?
            </div>

            <span>
              Waiting for trader...
            </span>
          </div>

        </div>

      </div>
    `;

    container.appendChild(element);
  });
}

/* =====================================================
   LEADERBOARD
===================================================== */

async function loadLeaderboard() {
  try {

    const data =
      await api("/leaderboard");

    const container =
      $("leaderboard");

    if (!container) return;

    container.innerHTML = "";

    const users =
      Array.isArray(data.users)
        ? data.users
        : [];

    if (!users.length) {
      container.innerHTML = `
        <div class="loading">
          No leaderboard data yet.
        </div>
      `;

      return;
    }

    users
      .slice(0, 10)
      .forEach((player, index) => {

        const row =
          document.createElement("div");

        row.className =
          "rank-row";

        row.innerHTML = `
          <div class="rank">
            #${index + 1}
          </div>

          <div class="rank-player">

            <img
              src="${escapeAttr(
                player.avatar || "/logo.png"
              )}"
              alt=""
              onerror="this.src='/logo.png'"
            >

            <span>
              ${escapeHtml(
                player.username || "Unknown"
              )}
            </span>

          </div>

          <div class="rank-value">
            ${formatValue(
              player.wagered
            )}
          </div>
        `;

        container.appendChild(row);
      });

  } catch (error) {

    console.error(
      "Leaderboard:",
      error
    );

    $("leaderboard").innerHTML = `
      <div class="loading">
        Unable to load leaderboard.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

/* =====================================================
   CHAT
===================================================== */

function openChat() {
  $("chatPanel")
    ?.classList.add("mobile-open");

  if ($("chatInput")) {
    $("chatInput").placeholder =
      state.user
        ? "Message chat..."
        : "Sign in to chat...";
  }

  loadChat();
}

function closeChat() {
  $("chatPanel")
    ?.classList.remove("mobile-open");
}

$("chatClose")?.addEventListener(
  "click",
  closeChat
);

$("mobileChatButton")?.addEventListener(
  "click",
  () => {

    $("chatPanel")
      ?.classList.toggle("mobile-open");

    loadChat();
  }
);

async function loadChat() {
  try {

    /*
      Backend uses:
      GET /chat/messages
      GET /chat/online
    */

    const [
      messagesData,
      onlineData
    ] = await Promise.all([
      api("/chat/messages"),
      api("/chat/online")
    ]);

    if ($("onlineCount")) {
      $("onlineCount").textContent =
        onlineData.online ?? 37;
    }

    renderChat(
      messagesData.messages || []
    );

  } catch (error) {

    console.error(
      "Chat:",
      error
    );
  }
}

function renderChat(messages) {
  const container =
    $("chatMessages");

  if (!container) return;

  container.innerHTML = "";

  if (!messages.length) {
    container.innerHTML = `
      <div class="loading">
        No messages yet.
      </div>
    `;

    return;
  }

  messages.forEach(message => {

    const element =
      document.createElement("div");

    element.className =
      "chat-message";

    element.innerHTML = `
      <img
        class="chat-avatar"
        src="${escapeAttr(
          message.avatar || "/logo.png"
        )}"
        alt=""
        onerror="this.src='/logo.png'"
      >

      <div class="chat-content">

        <div class="chat-username">
          ${escapeHtml(
            message.username || "User"
          )}
        </div>

        <div class="chat-text">
          ${escapeHtml(
            message.message
          )}
        </div>

      </div>
    `;

    container.appendChild(element);
  });

  container.scrollTop =
    container.scrollHeight;
}

$("chatForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!state.user) {
      toast("Sign in to chat.");

      $("loginModal")
        ?.classList.remove("hidden");

      return;
    }

    const input =
      $("chatInput");

    const message =
      input.value.trim();

    if (!message) return;

    if (message.length > 300) {
      toast("Message is too long.");
      return;
    }

    try {

      await api(
        "/chat/messages",
        {
          method: "POST",

          body: JSON.stringify({
            robloxId:
              Number(state.user.id),

            username:
              state.user.username,

            avatar:
              state.user.avatar || "",

            message
          })
        }
      );

      input.value = "";

      await loadChat();

    } catch (error) {

      toast(error.message);
    }
  }
);

/* =====================================================
   RULES
===================================================== */

$("rulesBtn")?.addEventListener(
  "click",
  () => {
    $("rulesModal")
      ?.classList.remove("hidden");
  }
);

$("closeRules")?.addEventListener(
  "click",
  () => {
    $("rulesModal")
      ?.classList.add("hidden");
  }
);

/* =====================================================
   PROFILE
===================================================== */

$("profileBtn")?.addEventListener(
  "click",
  async () => {

    if (!state.user) {
      $("loginModal")
        ?.classList.remove("hidden");

      return;
    }

    await refreshAccount();

    showPage("profile");
  }
);

function renderProfile() {
  if (!state.user) return;

  $("profileContent").innerHTML = `
    <div class="page-head">

      <div>

        <div class="eyebrow">
          PROFILE
        </div>

        <h1>
          ${escapeHtml(
            state.user.username
          )}
        </h1>

        <p>
          Your ADMFLIP account.
        </p>

      </div>

    </div>

    <div class="profile-grid">

      <div class="pet-card profile-card">

        <img
          class="profile-avatar"
          src="${escapeAttr(
            state.user.avatar || "/logo.png"
          )}"
          alt=""
          onerror="this.src='/logo.png'"
        >

        <div class="pet-name">
          ${escapeHtml(
            state.user.username
          )}
        </div>

      </div>

      <div class="pet-card">

        <div class="eyebrow">
          BALANCE
        </div>

        <div class="profile-stat">
          ${formatValue(
            state.user.balance
          )}
        </div>

      </div>

      <div class="pet-card">

        <div class="eyebrow">
          WAGERED
        </div>

        <div class="profile-stat">
          ${formatValue(
            state.user.wagered
          )}
        </div>

      </div>

      <div class="pet-card">

        <div class="eyebrow">
          PROFIT
        </div>

        <div class="profile-stat">
          ${formatValue(
            state.user.profit
          )}
        </div>

      </div>

    </div>
  `;
}

/* =====================================================
   CLOSE MODALS WHEN CLICKING BACKDROP
===================================================== */

document
  .querySelectorAll(".modal")
  .forEach(modal => {

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target === modal
        ) {
          modal.classList.add("hidden");
        }
      }
    );

  });

/* =====================================================
   ESC KEY
===================================================== */

document.addEventListener(
  "keydown",
  event => {

    if (event.key !== "Escape") return;

    document
      .querySelectorAll(".modal")
      .forEach(modal => {
        modal.classList.add("hidden");
      });

    closeChat();
  }
);

/* =====================================================
   INITIALIZE
===================================================== */

(async function init() {

  try {
    await restoreUser();
  } catch (error) {
    console.error(
      "User initialization:",
      error
    );
  }

  restorePage();

  loadValues();
  loadCoinflips();
  loadChat();

  /*
    Refresh live data.
  */

  setInterval(
    loadChat,
    10000
  );

  setInterval(
    loadCoinflips,
    10000
  );

})();
