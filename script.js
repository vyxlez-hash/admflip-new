// =====================================================
// ADMFLIP FRONTEND SCRIPT
// =====================================================

const BACKEND = "https://admflip-new.onrender.com";

const state = {
  user: null,
  pets: [],
  inventory: [],
  selectedPet: null,
  selectedSide: null,
  currentPage: "coinflip"
};

// =====================================================
// HELPERS
// =====================================================

const $ = (id) => document.getElementById(id);

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatValue(value) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 6
  });
}

function petImage(name) {
  if (!name) return "";

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(String(name).trim()) +
    ".webp"
  );
}

// =====================================================
// API
// =====================================================

async function api(path, options = {}) {
  const response = await fetch(
    BACKEND + path,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      `Server error (${response.status})`
    );
  }

  return data;
}

// =====================================================
// LOGIN / ACCOUNT
// =====================================================

function saveUser() {
  if (!state.user) return;

  localStorage.setItem(
    "admflipUser",
    JSON.stringify(state.user)
  );
}

function restoreUser() {
  const saved = localStorage.getItem("admflipUser");

  if (!saved) return;

  try {
    state.user = JSON.parse(saved);

    if (
      state.user &&
      state.user.id
    ) {
      showLoggedIn();

      loadAccount();
    }
  } catch {
    localStorage.removeItem("admflipUser");
  }
}

function showLoggedIn() {
  if (!state.user) return;

  const loginBtn = $("loginBtn");
  const accountBox = $("accountBox");

  if (loginBtn) {
    loginBtn.classList.add("hidden");
  }

  if (accountBox) {
    accountBox.classList.remove("hidden");
  }

  if ($("accountUsername")) {
    $("accountUsername").textContent =
      state.user.username || "User";
  }

  if ($("accountAvatar")) {
    $("accountAvatar").src =
      state.user.avatar || "/logo.png";
  }

  if ($("chatInput")) {
    $("chatInput").placeholder =
      "Message chat...";
  }
}

function logout() {
  state.user = null;
  state.inventory = [];
  state.selectedPet = null;
  state.selectedSide = null;

  localStorage.removeItem("admflipUser");

  $("loginBtn")?.classList.remove("hidden");
  $("accountBox")?.classList.add("hidden");

  if ($("chatInput")) {
    $("chatInput").placeholder =
      "Sign in to chat...";
  }

  toast("Signed out.");
}

async function loadAccount() {
  if (!state.user?.id) return;

  try {
    const data = await api(
      "/account/" +
      encodeURIComponent(state.user.id)
    );

    if (!data.success || !data.user) {
      return;
    }

    state.user = {
      ...state.user,
      ...data.user
    };

    state.inventory =
      Array.isArray(data.user.inventory)
        ? data.user.inventory
        : [];

    saveUser();

    showLoggedIn();

  } catch (error) {
    console.error(
      "Account error:",
      error
    );
  }
}

// =====================================================
// LOGIN BUTTONS
// =====================================================

if ($("loginBtn")) {
  $("loginBtn").onclick = () => {
    $("loginModal")?.classList.remove("hidden");
  };
}

if ($("closeLogin")) {
  $("closeLogin").onclick = () => {
    $("loginModal")?.classList.add("hidden");
  };
}

if ($("logoutBtn")) {
  $("logoutBtn").onclick = logout;
}

// Close modal when clicking background
document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

// =====================================================
// ROBLOX USER LOOKUP
// =====================================================

if ($("username")) {
  let usernameTimer;

  $("username").addEventListener("input", () => {
    clearTimeout(usernameTimer);

    const username =
      $("username").value.trim();

    if (!username) {
      $("loginProfile")?.classList.add("hidden");
      $("phrase")?.classList.add("hidden");

      if ($("verify")) {
        $("verify").style.display = "none";
      }

      if ($("loginMessage")) {
        $("loginMessage").textContent = "";
      }

      return;
    }

    usernameTimer = setTimeout(
      lookupRobloxUser,
      500
    );
  });
}

async function lookupRobloxUser() {
  const username =
    $("username").value.trim();

  if (!username) return;

  if ($("loginMessage")) {
    $("loginMessage").textContent =
      "Checking Roblox username...";
  }

  try {
    const data = await api(
      "/user/" +
      encodeURIComponent(username)
    );

    if (!data.success) {
      throw new Error(
        data.message ||
        "Roblox username not found."
      );
    }

    state.loginRobloxUser =
      data.user;

    if ($("loginProfile")) {
      $("loginProfile").classList.remove("hidden");

      $("loginProfile").innerHTML = `
        <img
          src="${escapeAttr(
            data.user.avatar || "/logo.png"
          )}"
          alt=""
        >

        <div>
          <strong>
            ${escapeHtml(data.user.username)}
          </strong>

          <small>
            Roblox ID: ${escapeHtml(data.user.id)}
          </small>
        </div>
      `;
    }

    if ($("loginMessage")) {
      $("loginMessage").textContent =
        "Creating verification phrase...";
    }

    const phraseData =
      await api("/create");

    state.phrase =
      phraseData.phrase;

    if ($("phrase")) {
      $("phrase").classList.remove("hidden");

      $("phrase").innerHTML = `
        <span>Add this phrase to your Roblox profile bio:</span>

        <strong>
          ${escapeHtml(state.phrase)}
        </strong>
      `;
    }

    if ($("verify")) {
      $("verify").style.display =
        "block";

      $("verify").disabled = false;
      $("verify").textContent =
        "Verify";
    }

    if ($("loginMessage")) {
      $("loginMessage").textContent =
        "Add the phrase to your Roblox bio, then click Verify.";
    }

  } catch (error) {
    console.error(error);

    if ($("loginMessage")) {
      $("loginMessage").textContent =
        error.message ||
        "Could not find Roblox user.";
    }
  }
}

// =====================================================
// VERIFY
// =====================================================

if ($("verify")) {
  $("verify").onclick =
    verifyRoblox;
}

async function verifyRoblox() {
  if (
    !state.loginRobloxUser ||
    !state.phrase
  ) {
    toast(
      "Enter your Roblox username first."
    );

    return;
  }

  $("verify").disabled = true;
  $("verify").textContent =
    "Checking...";

  try {
    const data = await api(
      "/check",
      {
        method: "POST",

        body: JSON.stringify({
          username:
            state.loginRobloxUser.username,

          phrase:
            state.phrase
        })
      }
    );

    if (!data.success) {
      throw new Error(
        data.message ||
        "Verification failed."
      );
    }

    state.user = {
      id: data.id,
      robloxId: data.id,
      username: data.username,
      avatar:
        data.avatar ||
        state.loginRobloxUser.avatar ||
        "/logo.png"
    };

    saveUser();

    $("loginModal")?.classList.add("hidden");

    if ($("username")) {
      $("username").value = "";
    }

    $("loginProfile")?.classList.add("hidden");
    $("phrase")?.classList.add("hidden");

    if ($("verify")) {
      $("verify").style.display =
        "none";
    }

    if ($("loginMessage")) {
      $("loginMessage").textContent = "";
    }

    showLoggedIn();

    await loadAccount();
    await loadChat();

    toast(
      "Roblox account verified."
    );

  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      "Verification failed."
    );

    $("verify").disabled = false;
    $("verify").textContent =
      "Verify";
  }
}

// =====================================================
// PAGES
// =====================================================

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
    .forEach((element) => {
      element.classList.add("hidden");
    });

  const target =
    $(page + "Page");

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
  .forEach((link) => {

    link.addEventListener(
      "click",
      (event) => {

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
      }
    );

  });

function restorePage() {
  const hash =
    location.hash.replace("#", "");

  const saved =
    localStorage.getItem(
      "admflipPage"
    );

  showPage(
    hash ||
    saved ||
    "coinflip"
  );
}

// =====================================================
// VALUES
// =====================================================

async function loadValues() {
  const grid =
    $("valuesGrid");

  if (!grid) return;

  if (state.pets.length) {
    renderValues(
      state.pets
    );

    return;
  }

  try {
    const data =
      await api("/pets");

    state.pets =
      Array.isArray(data.pets)
        ? data.pets
        : [];

    renderValues(
      state.pets
    );

  } catch (error) {
    console.error(error);

    grid.innerHTML = `
      <div class="loading">
        Unable to load values.
        <br><br>
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  }
}

function makePetCard(
  pet,
  selectable = false
) {
  const card =
    document.createElement("div");

  card.className =
    "pet-card";

  const image =
    pet.image ||
    petImage(pet.name);

  card.innerHTML = `
    ${
      image
        ? `
          <img
            class="pet-image"
            src="${escapeAttr(image)}"
            alt="${escapeAttr(
              pet.name
            )}"
            loading="lazy"
            onerror="
              this.style.display='none'
            "
          >
        `
        : `
          <div class="pet-image missing-image">
            ?
          </div>
        `
    }

    <div class="pet-name">
      ${escapeHtml(
        pet.name
      )}
    </div>

    <div class="pet-meta">

      <span>
        ${escapeHtml(
          pet.rarity || ""
        )}
      </span>

      <span class="pet-value">
        ${formatValue(
          pet.value
        )}
      </span>

    </div>

    ${
      pet.variant
        ? `
          <div class="pet-meta">
            ${escapeHtml(
              pet.variant
            )}
          </div>
        `
        : ""
    }
  `;

  if (selectable) {
    card.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            "#createInventory .pet-card"
          )
          .forEach((item) => {
            item.classList.remove(
              "selected"
            );
          });

        card.classList.add(
          "selected"
        );

        state.selectedPet =
          pet;

        $("sideArea")
          ?.classList.remove(
            "hidden"
          );
      }
    );
  }

  return card;
}

function renderValues(pets) {
  const grid =
    $("valuesGrid");

  if (!grid) return;

  grid.innerHTML = "";

  if (!pets.length) {
    grid.innerHTML = `
      <div class="loading">
        No pet values found.
      </div>
    `;

    return;
  }

  pets.forEach((pet) => {
    grid.appendChild(
      makePetCard(pet)
    );
  });
}

if ($("valueSearch")) {
  $("valueSearch").addEventListener(
    "input",
    () => {

      const query =
        $("valueSearch")
          .value
          .toLowerCase()
          .trim();

      const filtered =
        state.pets.filter(
          (pet) =>
            String(
              pet.name || ""
            )
              .toLowerCase()
              .includes(query)
        );

      renderValues(
        filtered
      );
    }
  );
}

// =====================================================
// INVENTORY
// =====================================================

async function loadInventory() {
  if (!state.user?.id) {
    state.inventory = [];
    return;
  }

  try {
    const data =
      await api(
        "/account/" +
        encodeURIComponent(
          state.user.id
        )
      );

    state.inventory =
      Array.isArray(
        data.user?.inventory
      )
        ? data.user.inventory
        : [];

    state.user = {
      ...state.user,
      ...data.user
    };

    saveUser();

  } catch (error) {
    console.error(
      "Inventory error:",
      error
    );

    state.inventory = [];
  }
}

if ($("inventoryBtn")) {
  $("inventoryBtn").onclick =
    async () => {

      if (!state.user) {
        $("loginModal")
          ?.classList.remove(
            "hidden"
          );

        return;
      }

      $("inventoryModal")
        ?.classList.remove(
          "hidden"
        );

      await loadInventory();

      renderInventory();
    };
}

if ($("closeInventory")) {
  $("closeInventory").onclick =
    () => {
      $("inventoryModal")
        ?.classList.add(
          "hidden"
        );
    };
}

function renderInventory() {
  const grid =
    $("inventoryGrid");

  if (!grid) return;

  grid.innerHTML = "";

  if (!state.inventory.length) {
    grid.innerHTML = `
      <div class="loading">
        Your inventory is empty.
      </div>
    `;

    return;
  }

  state.inventory.forEach(
    (item) => {

      const pet = {
        ...item,

        id:
          item.itemId ||
          item._id,

        name:
          item.name,

        value:
          item.value,

        variant:
          item.variant || "",

        image:
          item.image ||
          petImage(
            item.name
          )
      };

      grid.appendChild(
        makePetCard(
          pet,
          false
        )
      );
    }
  );
}

// =====================================================
// CREATE COINFLIP
// =====================================================

if ($("createCoinflipBtn")) {
  $("createCoinflipBtn").onclick =
    async () => {

      if (!state.user) {
        $("loginModal")
          ?.classList.remove(
            "hidden"
          );

        toast(
          "Sign in first."
        );

        return;
      }

      $("createModal")
        ?.classList.remove(
          "hidden"
        );

      state.selectedPet = null;
      state.selectedSide = null;

      document
        .querySelectorAll(
          ".side-btn"
        )
        .forEach((button) => {
          button.classList.remove(
            "selected"
          );
        });

      $("sideArea")
        ?.classList.add(
          "hidden"
        );

      await loadInventory();

      renderCreateInventory();
    };
}

if ($("closeCreate")) {
  $("closeCreate").onclick =
    () => {
      $("createModal")
        ?.classList.add(
          "hidden"
        );
    };
}

function renderCreateInventory() {
  const grid =
    $("createInventory");

  if (!grid) return;

  grid.innerHTML = "";

  if (!state.inventory.length) {
    grid.innerHTML = `
      <div class="loading">
        You don't have any pets
        available to coinflip.
        <br><br>
        <small>
          Your backend currently has no
          deposit endpoint, so inventory
          must be added server-side.
        </small>
      </div>
    `;

    return;
  }

  state.inventory.forEach(
    (item) => {

      const pet = {
        ...item,

        id:
          item.itemId ||
          item._id,

        name:
          item.name,

        value:
          item.value,

        variant:
          item.variant || "",

        image:
          item.image ||
          petImage(
            item.name
          )
      };

      grid.appendChild(
        makeSelectableInventoryCard(
          pet
        )
      );
    }
  );
}

function makeSelectableInventoryCard(
  pet
) {
  const card =
    makePetCard(
      pet,
      true
    );

  return card;
}

// =====================================================
// SIDE BUTTONS
// =====================================================

document
  .querySelectorAll(".side-btn")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".side-btn"
          )
          .forEach((item) => {
            item.classList.remove(
              "selected"
            );
          });

        button.classList.add(
          "selected"
        );

        state.selectedSide =
          button.dataset.side;
      }
    );

  });

// =====================================================
// POST COINFLIP
// =====================================================

if ($("postCoinflip")) {
  $("postCoinflip").onclick =
    async () => {

      if (!state.user) {
        toast(
          "Sign in first."
        );

        return;
      }

      if (!state.selectedPet) {
        toast(
          "Choose a pet first."
        );

        return;
      }

      if (!state.selectedSide) {
        toast(
          "Choose heads or tails."
        );

        return;
      }

      const itemId =
        state.selectedPet.id ||
        state.selectedPet.itemId ||
        state.selectedPet._id;

      if (!itemId) {
        toast(
          "This inventory item has no ID."
        );

        return;
      }

      // Backend expects lowercase.
      const side =
        String(
          state.selectedSide
        ).toLowerCase();

      if (
        side !== "heads" &&
        side !== "tails"
      ) {
        toast(
          "Invalid side."
        );

        return;
      }

      const button =
        $("postCoinflip");

      button.disabled = true;
      button.textContent =
        "Posting...";

      try {

        await api(
          "/coinflips",
          {
            method: "POST",

            body: JSON.stringify({
              robloxId:
                state.user.id,

              itemId,

              side
            })
          }
        );

        toast(
          "Coinflip posted."
        );

        $("createModal")
          ?.classList.add(
            "hidden"
          );

        state.selectedPet = null;
        state.selectedSide = null;

        await loadAccount();
        await loadCoinflips();

      } catch (error) {

        console.error(error);

        toast(
          error.message ||
          "Could not create coinflip."
        );

      } finally {

        button.disabled = false;
        button.textContent =
          "Post Coinflip";
      }
    };
}

// =====================================================
// COINFLIPS
// =====================================================

async function loadCoinflips() {
  const container =
    $("coinflips");

  if (!container) return;

  try {
    const data =
      await api(
        "/coinflips"
      );

    renderCoinflips(
      Array.isArray(
        data.coinflips
      )
        ? data.coinflips
        : []
    );

  } catch (error) {

    console.error(error);

    container.innerHTML = `
      <div class="loading">
        Could not load coinflips.
        <br><br>
        ${escapeHtml(
          error.message
        )}
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

  list.forEach((flip) => {

    const element =
      document.createElement(
        "div"
      );

    element.className =
      "coinflip";

    const side =
      String(
        flip.side || ""
      ).toUpperCase();

    const image =
      flip.image ||
      petImage(
        flip.petName
      );

    element.innerHTML = `
      <div class="cf-users">

        <span>
          ${escapeHtml(
            flip.username ||
            "Trader"
          )}
        </span>

        <span class="cf-side-label">
          ${escapeHtml(side)}
        </span>

      </div>

      <div class="cf-body">

        <div class="cf-side">

          <div class="cf-pet">

            ${
              image
                ? `
                  <img
                    src="${escapeAttr(
                      image
                    )}"
                    alt=""
                    onerror="
                      this.style.display='none'
                    "
                  >
                `
                : ""
            }

            <div>

              <b>
                ${escapeHtml(
                  flip.petName ||
                  "Unknown Pet"
                )}
              </b>

              <div class="muted">
                ${formatValue(
                  flip.petValue
                )}
              </div>

              ${
                flip.variant
                  ? `
                    <small>
                      ${escapeHtml(
                        flip.variant
                      )}
                    </small>
                  `
                  : ""
              }

            </div>

          </div>

        </div>

        <div class="cf-center">

          <div class="coin">
            ${escapeHtml(side)}
          </div>

          <small class="muted">
            Waiting for trader
          </small>

        </div>

        <div class="cf-side">

          <div class="cf-pet waiting">
            <div class="waiting-icon">
              ?
            </div>

            <span>
              Waiting...
            </span>
          </div>

        </div>

      </div>
    `;

    container.appendChild(
      element
    );
  });
}

// =====================================================
// LEADERBOARD
// =====================================================

async function loadLeaderboard() {
  const container =
    $("leaderboard");

  if (!container) return;

  try {
    const data =
      await api(
        "/leaderboard"
      );

    const players =
      Array.isArray(
        data.users
      )
        ? data.users
        : [];

    container.innerHTML = "";

    if (!players.length) {
      container.innerHTML = `
        <div class="loading">
          No leaderboard data yet.
        </div>
      `;

      return;
    }

    players.forEach(
      (player, index) => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "rank-row";

        row.innerHTML = `
          <div class="rank">
            #${escapeHtml(
              player.place ||
              index + 1
            )}
          </div>

          <div class="rank-player">

            <img
              src="${escapeAttr(
                player.avatar ||
                "/logo.png"
              )}"
              alt=""
              onerror="
                this.src='/logo.png'
              "
            >

            <div>
              <strong>
                ${escapeHtml(
                  player.username ||
                  "Unknown"
                )}
              </strong>

              <small>
                Profit:
                ${formatValue(
                  player.profit
                )}
              </small>
            </div>

          </div>

          <div class="rank-value">
            ${formatValue(
              player.wagered
            )}
          </div>
        `;

        container.appendChild(
          row
        );
      }
    );

  } catch (error) {

    console.error(error);

    container.innerHTML = `
      <div class="loading">
        Could not load leaderboard.
      </div>
    `;
  }
}

// =====================================================
// CHAT
// =====================================================

function openChat() {
  $("chatPanel")
    ?.classList.add(
      "mobile-open"
    );

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
    ?.classList.remove(
      "mobile-open"
    );
}

if ($("chatClose")) {
  $("chatClose").onclick =
    closeChat;
}

if ($("mobileChatButton")) {
  $("mobileChatButton").onclick =
    () => {

      $("chatPanel")
        ?.classList.toggle(
          "mobile-open"
        );

      loadChat();
    };
}

async function loadOnlineCount() {
  try {
    const data =
      await api(
        "/chat/online"
      );

    if ($("onlineCount")) {
      $("onlineCount").textContent =
        data.online ?? 37;
    }

  } catch {
    if ($("onlineCount")) {
      $("onlineCount").textContent =
        "37";
    }
  }
}

async function loadChat() {
  try {

    const [
      chatData
    ] = await Promise.all([
      api(
        "/chat/messages"
      ),

      loadOnlineCount()
    ]);

    renderChat(
      Array.isArray(
        chatData.messages
      )
        ? chatData.messages
        : []
    );

  } catch (error) {

    console.error(
      "Chat error:",
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

  messages.forEach(
    (message) => {

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "chat-message";

      element.innerHTML = `
        <img
          class="chat-avatar"
          src="${escapeAttr(
            message.avatar ||
            "/logo.png"
          )}"
          alt=""
          onerror="
            this.src='/logo.png'
          "
        >

        <div class="chat-content">

          <div class="chat-username">
            ${escapeHtml(
              message.username ||
              "User"
            )}
          </div>

          <div class="chat-text">
            ${escapeHtml(
              message.message
            )}
          </div>

        </div>
      `;

      container.appendChild(
        element
      );
    }
  );

  container.scrollTop =
    container.scrollHeight;
}

if ($("chatForm")) {
  $("chatForm").onsubmit =
    async (event) => {

      event.preventDefault();

      if (!state.user) {
        toast(
          "Sign in to chat."
        );

        $("loginModal")
          ?.classList.remove(
            "hidden"
          );

        return;
      }

      const input =
        $("chatInput");

      const message =
        input.value.trim();

      if (!message) return;

      try {

        await api(
          "/chat/messages",
          {
            method: "POST",

            body: JSON.stringify({
              robloxId:
                state.user.id,

              username:
                state.user.username,

              avatar:
                state.user.avatar,

              message
            })
          }
        );

        input.value = "";

        await loadChat();

      } catch (error) {

        toast(
          error.message ||
          "Could not send message."
        );
      }
    };
}

// =====================================================
// RULES
// =====================================================

if ($("rulesBtn")) {
  $("rulesBtn").onclick =
    () => {

      $("rulesModal")
        ?.classList.remove(
          "hidden"
        );
    };
}

if ($("closeRules")) {
  $("closeRules").onclick =
    () => {

      $("rulesModal")
        ?.classList.add(
          "hidden"
        );
    };
}

// =====================================================
// PROFILE
// =====================================================

if ($("profileBtn")) {
  $("profileBtn").onclick =
    () => {

      if (!state.user) {
        $("loginModal")
          ?.classList.remove(
            "hidden"
          );

        return;
      }

      showPage(
        "profile"
      );
    };
}

function renderProfile() {
  const container =
    $("profileContent");

  if (!container) return;

  if (!state.user) {
    container.innerHTML = `
      <div class="loading">
        Sign in to view your profile.
      </div>
    `;

    return;
  }

  container.innerHTML = `
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

      <div class="profile-card">

        <img
          class="profile-avatar"
          src="${escapeAttr(
            state.user.avatar ||
            "/logo.png"
          )}"
          alt=""
        >

        <h2>
          ${escapeHtml(
            state.user.username
          )}
        </h2>

        <span class="muted">
          Roblox ID:
          ${escapeHtml(
            state.user.id
          )}
        </span>

      </div>

      <div class="profile-stat">

        <span>
          Balance
        </span>

        <strong>
          ${formatValue(
            state.user.balance
          )}
        </strong>

      </div>

      <div class="profile-stat">

        <span>
          Wagered
        </span>

        <strong>
          ${formatValue(
            state.user.wagered
          )}
        </strong>

      </div>

      <div class="profile-stat">

        <span>
          Profit
        </span>

        <strong>
          ${formatValue(
            state.user.profit
          )}
        </strong>

      </div>

    </div>
  `;
}

// =====================================================
// INITIALIZE
// =====================================================

async function initialize() {
  restoreUser();

  restorePage();

  await Promise.allSettled([
    loadValues(),
    loadCoinflips(),
    loadChat()
  ]);

  // Refresh chat without hammering Render.
  setInterval(
    loadChat,
    10000
  );

  setInterval(
    loadCoinflips,
    10000
  );
}

initialize();
