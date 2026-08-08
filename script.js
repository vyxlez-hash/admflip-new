// =====================================================
// ADMFLIP FRONTEND
// Matched to the Express/MongoDB backend
// =====================================================

const BACKEND =
  "https://admflip-new.onrender.com";

const state = {
  user: null,
  pets: [],
  selectedPet: null,
  selectedSide: null,
  currentPage: "coinflip",
  phrase: null
};

// =====================================================
// HELPERS
// =====================================================

const $ = id => document.getElementById(id);

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

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server returned ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

// =====================================================
// LOGIN STATE
// =====================================================

function saveUser() {
  if (!state.user) return;

  localStorage.setItem(
    "admflipUser",
    JSON.stringify(state.user)
  );
}

function restoreUser() {
  const saved =
    localStorage.getItem("admflipUser");

  if (!saved) return;

  try {
    state.user = JSON.parse(saved);

    showLoggedIn();

    loadAccount();
  } catch {
    localStorage.removeItem("admflipUser");
  }
}

function showLoggedIn() {
  if (!state.user) return;

  const loginBtn = $("loginBtn");
  const accountBox = $("accountBox");
  const username = $("accountUsername");
  const avatar = $("accountAvatar");
  const chatInput = $("chatInput");

  if (loginBtn) {
    loginBtn.classList.add("hidden");
  }

  if (accountBox) {
    accountBox.classList.remove("hidden");
  }

  if (username) {
    username.textContent =
      state.user.username || "User";
  }

  if (avatar) {
    avatar.src =
      state.user.avatar || "/logo.png";
  }

  if (chatInput) {
    chatInput.placeholder =
      "Message chat...";
  }
}

function showLoggedOut() {
  const loginBtn = $("loginBtn");
  const accountBox = $("accountBox");
  const chatInput = $("chatInput");

  if (loginBtn) {
    loginBtn.classList.remove("hidden");
  }

  if (accountBox) {
    accountBox.classList.add("hidden");
  }

  if (chatInput) {
    chatInput.placeholder =
      "Sign in to chat...";
  }
}

function logout() {
  state.user = null;
  state.selectedPet = null;
  state.selectedSide = null;

  localStorage.removeItem("admflipUser");

  showLoggedOut();

  toast("Signed out");
}

// =====================================================
// LOGIN MODAL
// =====================================================

function openLogin() {
  const modal = $("loginModal");

  if (modal) {
    modal.classList.remove("hidden");
  }
}

function closeLogin() {
  const modal = $("loginModal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

if ($("loginBtn")) {
  $("loginBtn").onclick = openLogin;
}

if ($("closeLogin")) {
  $("closeLogin").onclick = closeLogin;
}

if ($("logoutBtn")) {
  $("logoutBtn").onclick = logout;
}

// =====================================================
// ROBLOX USER LOOKUP
// =====================================================

if ($("username")) {
  $("username").addEventListener(
    "change",
    lookupRobloxUser
  );

  $("username").addEventListener(
    "blur",
    lookupRobloxUser
  );
}

async function lookupRobloxUser() {
  const input = $("username");

  if (!input) return;

  const username =
    input.value.trim();

  if (!username) return;

  $("loginMessage").textContent =
    "Checking Roblox username...";

  try {
    const data =
      await api(
        "/user/" +
        encodeURIComponent(username)
      );

    if (!data.success || !data.user) {
      $("loginMessage").textContent =
        "Roblox username not found.";

      return;
    }

    state.user = data.user;

    const profile =
      $("loginProfile");

    if (profile) {
      profile.classList.remove("hidden");

      profile.innerHTML = `
        <img
          src="${escapeAttr(
            state.user.avatar || "/logo.png"
          )}"
          alt=""
          onerror="this.src='/logo.png'"
        >

        <div>
          <b>
            ${escapeHtml(
              state.user.username
            )}
          </b>

          <span class="muted">
            Roblox account found
          </span>
        </div>
      `;
    }

    $("loginMessage").textContent =
      "Creating verification phrase...";

    const phraseData =
      await api("/create");

    state.phrase =
      phraseData.phrase;

    const phrase =
      $("phrase");

    if (phrase) {
      phrase.classList.remove("hidden");

      phrase.innerHTML = `
        <div class="muted">
          Put this phrase in your Roblox
          profile About section:
        </div>

        <br>

        <strong>
          ${escapeHtml(
            state.phrase
          )}
        </strong>
      `;
    }

    const verify =
      $("verify");

    if (verify) {
      verify.style.display = "block";
      verify.disabled = false;
      verify.textContent = "Verify";
    }

    $("loginMessage").textContent =
      "Add the phrase to your Roblox profile, then click Verify.";
  } catch (error) {
    console.error(error);

    $("loginMessage").textContent =
      error.message ||
      "Unable to check username.";
  }
}

// =====================================================
// VERIFY ROBLOX ACCOUNT
// =====================================================

if ($("verify")) {
  $("verify").onclick =
    verifyRobloxAccount;
}

async function verifyRobloxAccount() {
  if (!state.user || !state.phrase) {
    toast("Enter your Roblox username first.");
    return;
  }

  const verify =
    $("verify");

  verify.disabled = true;
  verify.textContent = "Checking...";

  try {
    const data =
      await api(
        "/check",
        {
          method: "POST",

          body: JSON.stringify({
            username:
              state.user.username,

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
        state.user.avatar ||
        "/logo.png"
    };

    saveUser();

    showLoggedIn();

    closeLogin();

    resetLoginModal();

    await loadAccount();

    toast("Verified successfully!");

    loadChat();
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      "Verification failed."
    );

    verify.disabled = false;
    verify.textContent = "Verify";
  }
}

function resetLoginModal() {
  if ($("username")) {
    $("username").value = "";
  }

  if ($("loginProfile")) {
    $("loginProfile").classList.add("hidden");
    $("loginProfile").innerHTML = "";
  }

  if ($("phrase")) {
    $("phrase").classList.add("hidden");
    $("phrase").innerHTML = "";
  }

  if ($("verify")) {
    $("verify").style.display = "none";
  }

  if ($("loginMessage")) {
    $("loginMessage").textContent = "";
  }

  state.phrase = null;
}

// =====================================================
// ACCOUNT
// =====================================================

async function loadAccount() {
  if (!state.user) return;

  const id =
    state.user.id ||
    state.user.robloxId;

  if (!id) return;

  try {
    const data =
      await api(
        "/account/" +
        encodeURIComponent(id)
      );

    if (!data.success || !data.user) {
      return;
    }

    state.user = {
      ...state.user,
      ...data.user,
      id:
        data.user.id ||
        id,
      robloxId:
        data.user.id ||
        id
    };

    saveUser();

    showLoggedIn();
  } catch (error) {
    console.error(
      "Account:",
      error
    );
  }
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(page) {
  const allowed = [
    "coinflip",
    "values",
    "leaderboard",
    "profile"
  ];

  if (!allowed.includes(page)) {
    page = "coinflip";
  }

  state.currentPage = page;

  document
    .querySelectorAll(".page")
    .forEach(el => {
      el.classList.add("hidden");
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
  .forEach(link => {
    link.addEventListener(
      "click",
      event => {
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
    location.hash
      .replace("#", "")
      .trim();

  const saved =
    localStorage.getItem(
      "admflipPage"
    );

  const page =
    hash ||
    saved ||
    "coinflip";

  if (page === "chat") {
    showPage("coinflip");
    openChat();
  } else {
    showPage(page);
  }
}

// =====================================================
// PET VALUES
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

  grid.innerHTML =
    `<div class="loading">
      Loading values...
    </div>`;

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

  if (pet._selected) {
    card.classList.add(
      "selected"
    );
  }

  const image =
    pet.image ||
    petImage(pet.name);

  const imageHtml =
    image
      ? `
        <img
          class="pet-image"
          src="${escapeAttr(image)}"
          alt="${escapeAttr(
            pet.name
          )}"
          onerror="
            this.style.display='none';
            this.parentElement.classList.add('no-image');
          "
        >
      `
      : `
        <div class="pet-image no-image">
          <span>?</span>
        </div>
      `;

  const variant =
    pet.variant || "";

  card.innerHTML = `
    ${imageHtml}

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
      variant
        ? `
          <div class="pet-meta">
            ${escapeHtml(
              variant
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
          .forEach(el => {
            el.classList.remove(
              "selected"
            );
          });

        card.classList.add(
          "selected"
        );

        state.selectedPet =
          pet;

        const sideArea =
          $("sideArea");

        if (sideArea) {
          sideArea.classList.remove(
            "hidden"
          );
        }
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
    grid.innerHTML =
      `<div class="loading">
        No values found.
      </div>`;

    return;
  }

  pets.forEach(pet => {
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
          pet =>
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
  if (!state.user) {
    return [];
  }

  await loadAccount();

  return (
    state.user.inventory ||
    []
  );
}

function renderInventoryGrid(
  containerId,
  selectable = false
) {
  const grid =
    $(containerId);

  if (!grid) return;

  grid.innerHTML = "";

  const inventory =
    state.user?.inventory ||
    [];

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
      makePetCard(
        {
          ...item,
          id:
            item.itemId ||
            item._id ||
            item.id,
          image:
            item.image ||
            petImage(item.name)
        },
        selectable
      )
    );
  });
}

if ($("inventoryBtn")) {
  $("inventoryBtn").onclick =
    async () => {
      if (!state.user) {
        openLogin();
        return;
      }

      const modal =
        $("inventoryModal");

      if (modal) {
        modal.classList.remove(
          "hidden"
        );
      }

      await loadInventory();

      renderInventoryGrid(
        "inventoryGrid"
      );
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

// =====================================================
// CREATE COINFLIP
// =====================================================

if ($("createCoinflipBtn")) {
  $("createCoinflipBtn").onclick =
    async () => {
      if (!state.user) {
        toast(
          "Sign in first."
        );

        openLogin();

        return;
      }

      const modal =
        $("createModal");

      if (modal) {
        modal.classList.remove(
          "hidden"
        );
      }

      state.selectedPet = null;
      state.selectedSide = null;

      const sideArea =
        $("sideArea");

      if (sideArea) {
        sideArea.classList.add(
          "hidden"
        );
      }

      document
        .querySelectorAll(
          ".side-btn"
        )
        .forEach(button => {
          button.classList.remove(
            "selected"
          );
        });

      await loadInventory();

      renderInventoryGrid(
        "createInventory",
        true
      );
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

// =====================================================
// COINFLIP SIDE
// =====================================================

document
  .querySelectorAll(".side-btn")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        document
          .querySelectorAll(
            ".side-btn"
          )
          .forEach(btn => {
            btn.classList.remove(
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
// CREATE COINFLIP
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
        state.selectedPet.itemId ||
        state.selectedPet._id ||
        state.selectedPet.id;

      if (!itemId) {
        toast(
          "This inventory item has no ID."
        );

        return;
      }

      const robloxId =
        state.user.id ||
        state.user.robloxId;

      try {
        const button =
          $("postCoinflip");

        button.disabled = true;
        button.textContent =
          "Posting...";

        const data =
          await api(
            "/coinflips",
            {
              method: "POST",

              body: JSON.stringify({
                robloxId,
                itemId,
                side:
                  state.selectedSide
              })
            }
          );

        if (!data.success) {
          throw new Error(
            data.message ||
            "Could not create coinflip."
          );
        }

        toast(
          "Coinflip posted!"
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
        const button =
          $("postCoinflip");

        if (button) {
          button.disabled =
            false;

          button.textContent =
            "Post Coinflip";
        }
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
        Unable to load coinflips.
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
      document.createElement(
        "div"
      );

    element.className =
      "coinflip";

    const image =
      cf.image ||
      petImage(cf.petName);

    element.innerHTML = `
      <div class="cf-users">
        <span>
          ${escapeHtml(
            cf.username ||
            "Trader"
          )}
        </span>

        <span>
          ${escapeHtml(
            String(
              cf.side || ""
            ).toUpperCase()
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
                    src="${escapeAttr(
                      image
                    )}"
                    alt="${escapeAttr(
                      cf.petName
                    )}"
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
                  cf.petName
                )}
              </b>

              <div class="muted">
                ${formatValue(
                  cf.petValue
                )}
              </div>
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
            Waiting for trader...
          </small>

        </div>

        <div class="cf-side">

          <div class="cf-pet">
            Waiting for trader...
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
      Array.isArray(data.users)
        ? data.users
        : [];

    container.innerHTML = "";

    if (!players.length) {
      container.innerHTML = `
        <div class="loading">
          No players yet.
        </div>
      `;

      return;
    }

    players
      .slice(0, 10)
      .forEach(
        (player, index) => {
          const row =
            document.createElement(
              "div"
            );

          row.className =
            "rank-row";

          row.innerHTML = `
            <div class="rank">
              #${index + 1}
            </div>

            <div class="rank-name">

              ${
                player.avatar
                  ? `
                    <img
                      src="${escapeAttr(
                        player.avatar
                      )}"
                      alt=""
                      class="rank-avatar"
                      onerror="
                        this.src='/logo.png'
                      "
                    >
                  `
                  : ""
              }

              <span>
                ${escapeHtml(
                  player.username ||
                  "Unknown"
                )}
              </span>

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
        Unable to load leaderboard.
      </div>
    `;
  }
}

// =====================================================
// PROFILE
// =====================================================

if ($("profileBtn")) {
  $("profileBtn").onclick =
    () => {
      if (!state.user) {
        openLogin();
        return;
      }

      showPage("profile");
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

  const avatar =
    state.user.avatar ||
    "/logo.png";

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

    <div class="pet-grid">

      <div class="pet-card">

        <img
          class="pet-image"
          src="${escapeAttr(
            avatar
          )}"
          alt=""
          onerror="
            this.src='/logo.png'
          "
        >

        <div class="pet-name">
          ${escapeHtml(
            state.user.username
          )}
        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Balance
        </div>

        <div class="pet-value">
          ${formatValue(
            state.user.balance
          )}
        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Wagered
        </div>

        <div class="pet-value">
          ${formatValue(
            state.user.wagered
          )}
        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Profit
        </div>

        <div class="pet-value">
          ${formatValue(
            state.user.profit
          )}
        </div>

      </div>

    </div>
  `;
}

// =====================================================
// CHAT
// =====================================================

function openChat() {
  const panel =
    $("chatPanel");

  if (panel) {
    panel.classList.add(
      "mobile-open"
    );
  }

  if ($("chatInput")) {
    $("chatInput").placeholder =
      state.user
        ? "Message chat..."
        : "Sign in to chat...";
  }

  loadChat();
}

function closeChat() {
  const panel =
    $("chatPanel");

  if (panel) {
    panel.classList.remove(
      "mobile-open"
    );
  }
}

if ($("chatClose")) {
  $("chatClose").onclick =
    closeChat;
}

if ($("mobileChatButton")) {
  $("mobileChatButton").onclick =
    () => {
      const panel =
        $("chatPanel");

      if (!panel) return;

      panel.classList.toggle(
        "mobile-open"
      );

      loadChat();
    };
}

async function loadChat() {
  try {
    const [
      messagesData,
      onlineData
    ] = await Promise.all([
      api(
        "/chat/messages"
      ),
      api(
        "/chat/online"
      )
    ]);

    const online =
      onlineData?.online ?? 37;

    if ($("onlineCount")) {
      $("onlineCount")
        .textContent =
        online;
    }

    renderChat(
      messagesData?.messages ||
      []
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
      document.createElement(
        "div"
      );

    element.className =
      "chat-message";

    const avatar =
      message.avatar ||
      "/logo.png";

    element.innerHTML = `
      <img
        class="chat-avatar"
        src="${escapeAttr(
          avatar
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
  });

  container.scrollTop =
    container.scrollHeight;
}

if ($("chatForm")) {
  $("chatForm").onsubmit =
    async event => {
      event.preventDefault();

      if (!state.user) {
        toast(
          "Sign in to chat."
        );

        openLogin();

        return;
      }

      const input =
        $("chatInput");

      const message =
        input.value.trim();

      if (!message) return;

      const robloxId =
        state.user.id ||
        state.user.robloxId;

      try {
        const button =
          $("chatForm")
            .querySelector(
              "button"
            );

        if (button) {
          button.disabled =
            true;
        }

        await api(
          "/chat/messages",
          {
            method: "POST",

            body: JSON.stringify({
              robloxId,
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
        console.error(error);

        toast(
          error.message ||
          "Could not send message."
        );
      } finally {
        const button =
          $("chatForm")
            .querySelector(
              "button"
            );

        if (button) {
          button.disabled =
            false;
        }
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
// CLOSE MODALS WHEN CLICKING OUTSIDE
// =====================================================

document
  .querySelectorAll(".modal")
  .forEach(modal => {
    modal.addEventListener(
      "click",
      event => {
        if (
          event.target === modal
        ) {
          modal.classList.add(
            "hidden"
          );
        }
      }
    );
  });

// =====================================================
// ESC KEY
// =====================================================

document.addEventListener(
  "keydown",
  event => {
    if (event.key !== "Escape") {
      return;
    }

    document
      .querySelectorAll(".modal")
      .forEach(modal => {
        modal.classList.add(
          "hidden"
        );
      });

    closeChat();
  }
);

// =====================================================
// INITIALIZE
// =====================================================

async function initialize() {
  restoreUser();

  restorePage();

  loadValues();
  loadCoinflips();
  loadLeaderboard();
  loadChat();

  if (state.user) {
    loadAccount();
  }
}

initialize();

// =====================================================
// AUTO REFRESH
// =====================================================

setInterval(
  loadChat,
  10000
);

setInterval(
  loadCoinflips,
  10000
);
