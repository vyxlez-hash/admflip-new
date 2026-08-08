const BACKEND = "https://admflip-new.onrender.com";

let currentUser = null;
let currentAccount = null;
let currentRoute = "";
let selectedCoinflipPet = null;

const $ = id => document.getElementById(id);

const app = $("app");


// =====================================================
// HELPERS
// =====================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatValue(value) {
  const n = Number(value) || 0;

  if (n >= 1000000) {
    return (n / 1000000).toFixed(2).replace(/\.00$/, "") + "M";
  }

  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }

  return n.toLocaleString();
}


function petImage(name) {
  if (!name) return "";

  return "https://amvgg.com/items/" +
    encodeURIComponent(name) +
    ".webp";
}


function showToast(message, type = "") {
  const container = $("toastContainer");

  const toast = document.createElement("div");

  toast.className =
    "toast " + type;

  toast.textContent =
    message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}


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

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Server request failed"
    );
  }

  return data;
}


function openModal(id) {
  $(id).classList.add("show");
}


function closeModal(id) {
  $(id).classList.remove("show");
}


// =====================================================
// LOGIN
// =====================================================

function loadSavedUser() {
  try {
    const saved =
      localStorage.getItem("admflipUser");

    if (!saved) return;

    currentUser =
      JSON.parse(saved);

    if (
      !currentUser ||
      !currentUser.id ||
      !currentUser.username
    ) {
      throw new Error("Invalid login");
    }

    updateAccountUI();

    loadAccount();

  } catch {
    localStorage.removeItem("admflipUser");

    currentUser = null;
  }
}


function updateAccountUI() {
  const loginBtn = $("loginBtn");
  const accountUser = $("accountUser");

  if (!currentUser) {

    loginBtn.classList.remove("hidden");

    accountUser.classList.add("hidden");

    return;
  }

  loginBtn.classList.add("hidden");

  accountUser.classList.remove("hidden");

  $("accountAvatar").src =
    currentUser.avatar ||
    "/logo.png";

  $("accountUsername").textContent =
    currentUser.username;
}


async function startLogin() {
  const username =
    $("usernameInput")
      .value
      .trim();

  if (!username) {
    $("loginStatus").textContent =
      "Enter your Roblox username.";

    return;
  }

  $("loginStatus").textContent =
    "Looking up your Roblox profile...";

  try {

    const data =
      await api(
        "/user/" +
        encodeURIComponent(username)
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        "Roblox username not found."
      );
    }

    currentUser = data.user;

    $("loginProfile").innerHTML = `
      <img
        src="${escapeHTML(data.user.avatar || "/logo.png")}"
        alt=""
      >

      <div>
        <strong>
          ${escapeHTML(data.user.username)}
        </strong>

        <div class="muted">
          Roblox account found
        </div>
      </div>
    `;

    $("loginProfile")
      .classList
      .remove("hidden");

    const phraseData =
      await api("/create");

    $("verificationPhrase")
      .textContent =
      phraseData.phrase;

    $("verificationBox")
      .classList
      .remove("hidden");

    $("loginStatus").textContent =
      "Add the phrase to your Roblox bio, then verify.";

  } catch (error) {

    $("loginStatus").textContent =
      error.message ||
      "Could not connect to the server.";
  }
}


async function verifyLogin() {
  if (!currentUser) return;

  const button =
    $("verifyBtn");

  button.disabled = true;

  button.textContent =
    "Checking...";

  try {

    const phrase =
      $("verificationPhrase")
        .textContent;

    const data =
      await api(
        "/check",
        {
          method: "POST",

          body: JSON.stringify({
            username:
              currentUser.username,

            phrase
          })
        }
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        "Verification failed."
      );
    }

    currentUser = {
      id: data.id,

      username:
        data.username,

      avatar:
        data.avatar ||
        currentUser.avatar ||
        "/logo.png"
    };

    localStorage.setItem(
      "admflipUser",
      JSON.stringify(currentUser)
    );

    updateAccountUI();

    closeModal("loginModal");

    $("usernameInput").value = "";

    $("loginProfile")
      .classList
      .add("hidden");

    $("verificationBox")
      .classList
      .add("hidden");

    $("loginStatus").textContent = "";

    await loadAccount();

    showToast(
      "You are verified and signed in.",
      "success"
    );

    renderRoute();

  } catch (error) {

    $("loginStatus").textContent =
      error.message;

  } finally {

    button.disabled = false;

    button.textContent =
      "Verify";
  }
}


async function loadAccount() {
  if (!currentUser) return;

  try {

    const data =
      await api(
        "/account/" +
        encodeURIComponent(
          currentUser.id
        )
      );

    if (data.success) {
      currentAccount =
        data.user;
    }

  } catch (error) {
    console.error(error);
  }
}


function logout() {
  localStorage.removeItem(
    "admflipUser"
  );

  currentUser = null;
  currentAccount = null;

  updateAccountUI();

  showToast(
    "You have been signed out."
  );

  renderRoute();
}


// =====================================================
// CHAT
// =====================================================

let chatTimer = null;

function desktopChat() {
  return window.innerWidth > 760;
}


function openChat() {
  const panel =
    $("chatPanel");

  if (desktopChat()) {

    panel.classList.remove("closed");

    app.classList.remove("chat-hidden");

  } else {

    panel.classList.add(
      "mobile-open"
    );

    $("chatOverlay")
      .classList
      .add("show");
  }

  loadChat();
}


function closeChat() {
  const panel =
    $("chatPanel");

  if (desktopChat()) {

    panel.classList.add("closed");

    app.classList.add("chat-hidden");

  } else {

    panel.classList.remove(
      "mobile-open"
    );

    $("chatOverlay")
      .classList
      .remove("show");
  }
}


function setupChatLayout() {
  const panel =
    $("chatPanel");

  if (desktopChat()) {

    panel.classList.remove(
      "mobile-open"
    );

    $("chatOverlay")
      .classList
      .remove("show");

    panel.classList.remove(
      "closed"
    );

    app.classList.remove(
      "chat-hidden"
    );

  } else {

    panel.classList.remove(
      "closed"
    );

    panel.classList.remove(
      "mobile-open"
    );

    $("chatOverlay")
      .classList
      .remove("show");
  }
}


async function loadChat() {
  try {

    const data =
      await api(
        "/chat/messages"
      );

    renderChat(
      data.messages || []
    );

  } catch (error) {

    $("chatMessages").innerHTML = `
      <div class="chat-empty">
        Chat is temporarily unavailable.
      </div>
    `;
  }
}


function renderChat(messages) {
  const box =
    $("chatMessages");

  if (!messages.length) {

    box.innerHTML = `
      <div class="chat-empty">
        No messages yet.
      </div>
    `;

    return;
  }

  box.innerHTML =
    messages.map(msg => {

      const avatar =
        msg.avatar ||
        "/logo.png";

      return `
        <div class="chat-message">

          <img
            class="chat-avatar"
            src="${escapeHTML(avatar)}"
            alt=""
          >

          <div class="chat-message-body">

            <div class="chat-message-top">

              <span
                class="chat-username"
                data-profile-id="${escapeHTML(msg.robloxId || "")}"
              >
                ${escapeHTML(msg.username)}
              </span>

            </div>

            <div class="chat-text">
              ${escapeHTML(msg.message)}
            </div>

          </div>

        </div>
      `;

    }).join("");

  box.scrollTop =
    box.scrollHeight;
}


async function sendChat() {
  if (!currentUser) {

    showToast(
      "Sign in first to use chat."
    );

    openModal("loginModal");

    return;
  }

  const input =
    $("chatInput");

  const message =
    input.value.trim();

  if (!message) return;

  if (
    /(https?:\/\/|www\.|discord\.gg|discord\.com\/invite|\.com\b|\.net\b|\.gg\b|\.org\b)/i
      .test(message)
  ) {

    showToast(
      "Links are not allowed in chat.",
      "error"
    );

    return;
  }

  input.disabled = true;

  try {

    const data =
      await api(
        "/chat/messages",
        {
          method: "POST",

          body: JSON.stringify({
            robloxId:
              currentUser.id,

            username:
              currentUser.username,

            avatar:
              currentUser.avatar,

            message
          })
        }
      );

    if (!data.success) {
      throw new Error(
        data.message ||
        "Message failed."
      );
    }

    input.value = "";

    await loadChat();

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  } finally {

    input.disabled = false;

    input.focus();
  }
}


async function loadOnlineCount() {
  try {

    const data =
      await api(
        "/chat/online"
      );

    if (
      data.success &&
      Number.isFinite(
        Number(data.online)
      )
    ) {

      $("onlineCount")
        .textContent =
        data.online;
    }

  } catch {
    // Keep the existing number.
  }
}


// =====================================================
// PET CARD
// =====================================================

function petCard(pet, selectable = false) {

  const image =
    pet.image ||
    petImage(pet.name);

  const selected =
    selectedCoinflipPet &&
    String(selectedCoinflipPet.itemId) ===
      String(pet.itemId);

  return `
    <div
      class="pet-card ${selected ? "selected" : ""}"
      ${selectable ? `data-pet-id="${escapeHTML(pet.itemId)}"` : ""}
    >

      <div class="pet-image-wrap">

        <img
          class="pet-image"
          src="${escapeHTML(image)}"
          alt="${escapeHTML(pet.name)}"
          loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
        >

        <div
          class="pet-image-placeholder"
          style="display:none"
        >
          ✦
        </div>

      </div>

      <div class="pet-name">
        ${escapeHTML(pet.name)}
      </div>

      <div class="pet-value">
        ${formatValue(pet.value)}
      </div>

      ${
        pet.variant
          ? `
            <div class="variant-tags">
              ${escapeHTML(pet.variant)}
            </div>
          `
          : ""
      }

    </div>
  `;
}


// =====================================================
// HOME
// =====================================================

function renderHome() {

  app.innerHTML = `
    <div class="page">

      <section class="hero">

        <h1>
          Trade smarter.
          <span>Flip better.</span>
        </h1>

        <p>
          A clean Adopt Me trading community built
          for traders. Flip pets, check values and
          connect with other players.
        </p>

        <div class="hero-buttons">

          <button
            class="primary-btn"
            data-route="#/coinflip"
          >
            Start Coinflip
          </button>

          <button
            class="secondary-btn"
            data-route="#/values"
          >
            View Values
          </button>

        </div>

      </section>

      <section class="section-card">

        <div class="card-heading">

          <h2>Active Coinflips</h2>

          <button
            class="secondary-btn"
            data-route="#/coinflip"
          >
            View all
          </button>

        </div>

        <div
          id="homeCoinflips"
          class="coinflip-list"
        >
          Loading...
        </div>

      </section>

    </div>
  `;

  loadCoinflips("homeCoinflips");
}


// =====================================================
// COINFLIP
// =====================================================

async function renderCoinflip() {

  app.innerHTML = `
    <div class="page">

      <div class="page-title">
        Coinflip
      </div>

      <div class="page-subtitle">
        Find another trader and post your side.
      </div>

      <div
        class="coinflip-actions"
        style="margin-top:20px"
      >

        <button
          id="createFlipBtn"
          class="primary-btn"
        >
          Create
        </button>

        <button
          id="historyBtn"
          class="secondary-btn"
        >
          History
        </button>

      </div>

      <div class="section-card">

        <div class="card-heading">
          <h2>Active Coinflips</h2>
        </div>

        <div
          id="coinflipList"
          class="coinflip-list"
        >
          Loading...
        </div>

      </div>

    </div>
  `;

  $("createFlipBtn")
    .onclick =
    openCreateCoinflip;

  await loadCoinflips(
    "coinflipList"
  );
}


async function loadCoinflips(targetId) {

  try {

    const data =
      await api(
        "/coinflips"
      );

    const target =
      $(targetId);

    if (
      !data.coinflips ||
      !data.coinflips.length
    ) {

      target.innerHTML = `
        <div class="empty-state">
          No active coinflips yet.
        </div>
      `;

      return;
    }

    target.innerHTML =
      data.coinflips.map(flip => {

        return `
          <div class="coinflip-card">

            <div class="flip-player">

              <img
                src="${escapeHTML(flip.avatar || "/logo.png")}"
                alt=""
              >

              <strong>
                ${escapeHTML(flip.username)}
              </strong>

            </div>

            <div class="flip-pet">

              <img
                src="${escapeHTML(flip.image || petImage(flip.petName))}"
                alt=""
                onerror="this.style.display='none'"
              >

              <div>

                <strong>
                  ${escapeHTML(flip.petName)}
                </strong>

                <span>
                  ${formatValue(flip.petValue)}
                </span>

              </div>

            </div>

            <div class="flip-side">
              ${escapeHTML(flip.side)}
            </div>

            <button
              class="primary-btn"
              data-join-flip="${escapeHTML(flip.id)}"
            >
              Join
            </button>

          </div>
        `;

      }).join("");

  } catch {

    $(targetId).innerHTML = `
      <div class="empty-state">
        Unable to load active coinflips.
      </div>
    `;
  }
}


async function openCreateCoinflip() {

  if (!currentUser) {

    showToast(
      "Sign in first to create a coinflip.",
      "error"
    );

    openModal("loginModal");

    return;
  }

  await loadAccount();

  if (
    !currentAccount ||
    !currentAccount.inventory ||
    !currentAccount.inventory.length
  ) {

    app.insertAdjacentHTML(
      "beforeend",

      `
        <div id="depositNotice" class="modal show">

          <div class="modal-box">

            <button
              class="modal-close"
              id="closeDepositNotice"
            >
              ×
            </button>

            <h2>No pets available</h2>

            <p class="muted">
              Your inventory is empty.
            </p>

            <button
              class="primary-btn"
              id="depositDiscordBtn"
            >
              Deposit via Discord
            </button>

          </div>

        </div>
      `
    );

    $("closeDepositNotice")
      .onclick = () =>
        $("depositNotice").remove();

    $("depositDiscordBtn")
      .onclick = () =>
        showToast(
          "Discord deposit is coming soon."
        );

    return;
  }

  selectedCoinflipPet = null;

  const modal =
    document.createElement("div");

  modal.id =
    "createFlipModal";

  modal.className =
    "modal show";

  modal.innerHTML = `

    <div class="modal-box large-modal">

      <button
        class="modal-close"
        id="closeCreateFlip"
      >
        ×
      </button>

      <h2>Create Coinflip</h2>

      <p class="muted">
        Choose a pet from your inventory.
      </p>

      <div
        id="createInventory"
        class="pet-grid"
      >
        ${currentAccount.inventory.map(
          item =>
            petCard({
              itemId: item.itemId,
              name: item.name,
              value: item.value,
              variant: item.variant,
              image: item.image
            }, true)
        ).join("")}
      </div>

      <div
        id="sideChooser"
        class="hidden"
        style="margin-top:20px"
      >

        <h3>
          Choose your side
        </h3>

        <div
          style="
            display:flex;
            gap:8px;
            margin-top:10px;
          "
        >

          <button
            id="headsBtn"
            class="secondary-btn"
          >
            Heads
          </button>

          <button
            id="tailsBtn"
            class="secondary-btn"
          >
            Tails
          </button>

        </div>

        <button
          id="postFlipBtn"
          class="primary-btn"
          style="margin-top:14px"
          disabled
        >
          Post Coinflip
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  $("closeCreateFlip")
    .onclick = () =>
      modal.remove();

  let selectedSide = "";

  const chooseSide =
    side => {

      selectedSide = side;

      $("headsBtn")
        .classList.remove(
          "primary-btn"
        );

      $("tailsBtn")
        .classList.remove(
          "primary-btn"
        );

      $("headsBtn")
        .classList.add(
          "secondary-btn"
        );

      $("tailsBtn")
        .classList.add(
          "secondary-btn"
        );

      $(side === "heads"
        ? "headsBtn"
        : "tailsBtn"
      ).classList.remove(
        "secondary-btn"
      );

      $(side === "heads"
        ? "headsBtn"
        : "tailsBtn"
      ).classList.add(
        "primary-btn"
      );

      $("postFlipBtn")
        .disabled =
        !selectedCoinflipPet;
    };

  $("headsBtn")
    .onclick =
    () => chooseSide("heads");

  $("tailsBtn")
    .onclick =
    () => chooseSide("tails");


  $("createInventory")
    .addEventListener(
      "click",
      event => {

        const card =
          event.target.closest(
            "[data-pet-id]"
          );

        if (!card) return;

        selectedCoinflipPet =
          currentAccount.inventory.find(
            item =>
              String(item.itemId) ===
              String(card.dataset.petId)
          );

        document
          .querySelectorAll(
            "#createInventory .pet-card"
          )
          .forEach(el =>
            el.classList.remove(
              "selected"
            )
          );

        card.classList.add(
          "selected"
        );

        $("sideChooser")
          .classList
          .remove("hidden");

        if (selectedSide) {
          $("postFlipBtn")
            .disabled = false;
        }
      }
    );


  $("postFlipBtn")
    .onclick =
    async () => {

      if (
        !selectedCoinflipPet ||
        !selectedSide
      ) return;

      const btn =
        $("postFlipBtn");

      btn.disabled = true;

      btn.textContent =
        "Posting...";

      try {

        await api(
          "/coinflips",
          {
            method: "POST",

            body: JSON.stringify({
              robloxId:
                currentUser.id,

              itemId:
                selectedCoinflipPet.itemId,

              side:
                selectedSide
            })
          }
        );

        modal.remove();

        showToast(
          "Coinflip posted.",
          "success"
        );

        await loadAccount();

        await loadCoinflips(
          "coinflipList"
        );

      } catch (error) {

        showToast(
          error.message,
          "error"
        );

        btn.disabled = false;

        btn.textContent =
          "Post Coinflip";
      }
    };
}


// =====================================================
// JOIN
// =====================================================

async function joinCoinflip(id) {

  if (!currentUser) {

    showToast(
      "Sign in first to join a coinflip."
    );

    openModal("loginModal");

    return;
  }

  await loadAccount();

  if (
    !currentAccount ||
    !currentAccount.inventory.length
  ) {

    showToast(
      "You need a pet in your inventory."
    );

    return;
  }

  const matching =
    currentAccount.inventory;

  const modal =
    document.createElement("div");

  modal.className =
    "modal show";

  modal.innerHTML = `

    <div class="modal-box large-modal">

      <button
        class="modal-close"
        id="closeJoin"
      >
        ×
      </button>

      <h2>
        Choose your joining pet
      </h2>

      <p class="muted">
        Select the pet you want to use.
      </p>

      <div
        id="joinPets"
        class="pet-grid"
      >
        ${matching.map(item =>
          petCard({
            itemId: item.itemId,
            name: item.name,
            value: item.value,
            variant: item.variant,
            image: item.image
          }, true)
        ).join("")}
      </div>

      <button
        id="confirmJoin"
        class="primary-btn"
        disabled
        style="margin-top:15px"
      >
        Join Coinflip
      </button>

    </div>
  `;

  document.body.appendChild(modal);

  let chosen = null;

  $("closeJoin")
    .onclick = () =>
      modal.remove();

  $("joinPets")
    .addEventListener(
      "click",
      event => {

        const card =
          event.target.closest(
            "[data-pet-id]"
          );

        if (!card) return;

        chosen =
          matching.find(
            item =>
              String(item.itemId) ===
              String(card.dataset.petId)
          );

        document
          .querySelectorAll(
            "#joinPets .pet-card"
          )
          .forEach(x =>
            x.classList.remove(
              "selected"
            )
          );

        card.classList.add(
          "selected"
        );

        $("confirmJoin")
          .disabled = !chosen;
      }
    );


  $("confirmJoin")
    .onclick =
    async () => {

      if (!chosen) return;

      const btn =
        $("confirmJoin");

      btn.disabled = true;

      btn.textContent =
        "Flipping...";

      try {

        const result =
          await api(
            "/coinflips/" +
            encodeURIComponent(id) +
            "/join",
            {
              method: "POST",

              body: JSON.stringify({
                robloxId:
                  currentUser.id,

                itemId:
                  chosen.itemId
              })
            }
          );

        modal.remove();

        await loadAccount();

        showCoinflipResult(
          result
        );

        if (
          document.getElementById(
            "coinflipList"
          )
        ) {
          await loadCoinflips(
            "coinflipList"
          );
        }

      } catch (error) {

        showToast(
          error.message,
          "error"
        );

        btn.disabled = false;

        btn.textContent =
          "Join Coinflip";
      }
    };
}


function showCoinflipResult(result) {

  const modal =
    document.createElement("div");

  modal.className =
    "modal show";

  modal.innerHTML = `

    <div class="modal-box">

      <div
        style="
          text-align:center;
          padding:20px 0;
        "
      >

        <div
          style="
            font-size:58px;
            margin-bottom:15px;
          "
        >
          🪙
        </div>

        <h2>
          ${result.winnerId === currentUser.id
            ? "You Won!"
            : "Coinflip Finished"}
        </h2>

        <p class="muted">
          The coin landed on
          <strong>
            ${escapeHTML(result.winnerSide)}
          </strong>.
        </p>

        <button
          class="primary-btn"
          id="closeResult"
          style="margin-top:12px"
        >
          Continue
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  $("closeResult")
    .onclick = () =>
      modal.remove();
}


// =====================================================
// VALUES
// =====================================================

async function renderValues() {

  app.innerHTML = `
    <div class="page">

      <div class="page-title">
        Pet Values
      </div>

      <div class="page-subtitle">
        Browse current community values.
      </div>

      <div
        class="section-card"
        style="margin-top:20px"
      >

        <input
          id="petSearch"
          class="search-bar"
          placeholder="Search pets..."
        >

        <div
          id="valuesGrid"
          class="pet-grid"
        >
          Loading...
        </div>

      </div>

    </div>
  `;

  let pets = [];

  try {

    const data =
      await api("/pets");

    pets =
      data.pets || [];

    renderPetValues(
      pets
    );

  } catch {

    $("valuesGrid").innerHTML = `
      <div class="empty-state">
        Unable to load pet values.
      </div>
    `;
  }

  $("petSearch")
    .addEventListener(
      "input",
      event => {

        const query =
          event.target.value
            .toLowerCase()
            .trim();

        renderPetValues(
          pets.filter(
            pet =>
              pet.name
                .toLowerCase()
                .includes(query)
          )
        );
      }
    );
}


function renderPetValues(pets) {

  const grid =
    $("valuesGrid");

  if (!pets.length) {

    grid.innerHTML = `
      <div class="empty-state">
        No pets found.
      </div>
    `;

    return;
  }

  grid.innerHTML =
    pets.map(
      pet =>
        petCard({
          name: pet.name,
          value: pet.value,
          image: pet.image
        })
    ).join("");
}


// =====================================================
// LEADERBOARD
// =====================================================

async function renderLeaderboard() {

  app.innerHTML = `
    <div class="page">

      <div class="page-title">
        TOP FLIPPERS
      </div>

      <div class="page-subtitle">
        The 10 players with the highest total wagered value.
      </div>

      <div
        class="section-card"
        style="margin-top:20px"
      >

        <div
          id="leaderboard"
          class="leaderboard"
        >
          Loading...
        </div>

      </div>

    </div>
  `;

  try {

    const data =
      await api(
        "/leaderboard"
      );

    if (
      !data.users ||
      !data.users.length
    ) {

      $("leaderboard").innerHTML = `
        <div class="empty-state">
          No leaderboard data yet.
        </div>
      `;

      return;
    }

    $("leaderboard").innerHTML =
      data.users.map(
        user => `
          <div class="leader-row">

            <div class="leader-place">
              #${user.place}
            </div>

            <div class="leader-user">

              <img
                src="${escapeHTML(user.avatar || "/logo.png")}"
                alt=""
              >

              <strong>
                ${escapeHTML(user.username)}
              </strong>

            </div>

            <div class="leader-value">
              ${formatValue(user.wagered)}
            </div>

          </div>
        `
      ).join("");

  } catch {

    $("leaderboard").innerHTML = `
      <div class="empty-state">
        Unable to load leaderboard.
      </div>
    `;
  }
}


// =====================================================
// PROFILE
// =====================================================

async function renderProfile() {

  if (!currentUser) {

    openModal("loginModal");

    location.hash = "#/";

    return;
  }

  await loadAccount();

  if (!currentAccount) {

    app.innerHTML = `
      <div class="page">
        <div class="empty-state">
          Unable to load your profile.
        </div>
      </div>
    `;

    return;
  }

  app.innerHTML = `

    <div class="page">

      <div class="profile-header">

        <img
          src="${escapeHTML(currentAccount.avatar || "/logo.png")}"
          alt=""
        >

        <div>

          <div class="profile-name">
            ${escapeHTML(currentAccount.username)}
          </div>

          <div class="muted">
            Verified Roblox account
          </div>

        </div>

      </div>

      <div class="profile-stat-grid">

        <div class="stat-card">
          <span>Balance</span>
          <strong>
            ${formatValue(currentAccount.balance)}
          </strong>
        </div>

        <div class="stat-card">
          <span>Wagered</span>
          <strong>
            ${formatValue(currentAccount.wagered)}
          </strong>
        </div>

        <div class="stat-card">
          <span>Profit</span>
          <strong>
            ${formatValue(currentAccount.profit)}
          </strong>
        </div>

      </div>

      <div class="section-card">

        <div class="card-heading">

          <h2>
            Inventory
          </h2>

          <button
            id="profileInventoryBtn"
            class="secondary-btn"
          >
            Inventory
          </button>

        </div>

        <div class="pet-grid">

          ${
            currentAccount.inventory.length
              ? currentAccount.inventory
                  .slice(0, 12)
                  .map(item =>
                    petCard(item)
                  )
                  .join("")
              : `
                <div class="empty-state">
                  Your inventory is empty.
                </div>
              `
          }

        </div>

      </div>

    </div>
  `;

  $("profileInventoryBtn")
    .onclick = () =>
      openInventory();
}


function openInventory() {

  if (!currentAccount) {
    return;
  }

  $("inventoryGrid").innerHTML =
    currentAccount.inventory.length
      ? currentAccount.inventory
          .map(item =>
            petCard(item)
          )
          .join("")
      : `
        <div class="empty-state">
          Your inventory is empty.
        </div>
      `;

  openModal(
    "inventoryModal"
  );
}


// =====================================================
// ROUTING
// =====================================================

async function renderRoute() {

  const route =
    location.hash || "#/";

  currentRoute =
    route;

  document
    .querySelectorAll(
      ".desktop-nav button[data-route]"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.route === route
      );

    });

  if (route === "#/coinflip") {
    await renderCoinflip();
    return;
  }

  if (route === "#/values") {
    await renderValues();
    return;
  }

  if (route === "#/leaderboard") {
    await renderLeaderboard();
    return;
  }

  if (route === "#/profile") {
    await renderProfile();
    return;
  }

  renderHome();
}


// =====================================================
// EVENTS
// =====================================================

$("loginBtn")
  .onclick = () =>
    openModal("loginModal");


$("logoutBtn")
  .onclick =
  logout;


$("profileBtn")
  .onclick = () => {

    location.hash =
      "#/profile";
  };


$("inventoryBtn")
  .onclick =
  openInventory;


$("usernameInput")
  .addEventListener(
    "change",
    startLogin
  );


$("verifyBtn")
  .onclick =
  verifyLogin;


$("chatSendBtn")
  .onclick =
  sendChat;


$("chatInput")
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {
        event.preventDefault();

        sendChat();
      }

    }
  );


$("chatCloseBtn")
  .onclick =
  closeChat;


$("mobileChatBtn")
  .onclick =
  openChat;


$("chatOverlay")
  .onclick =
  closeChat;


$("mobileChatNav")
  .onclick =
  openChat;


$("chatRulesBtn")
  .onclick = () =>
    openModal("rulesModal");


document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        closeModal(
          button.dataset.close
        );

      }
    );

  });


document.addEventListener(
  "click",
  event => {

    const routeButton =
      event.target.closest(
        "[data-route]"
      );

    if (routeButton) {

      location.hash =
        routeButton.dataset.route;

      return;
    }

    const joinButton =
      event.target.closest(
        "[data-join-flip]"
      );

    if (joinButton) {

      joinCoinflip(
        joinButton.dataset.joinFlip
      );

      return;
    }

    const profile =
      event.target.closest(
        "[data-profile-id]"
      );

    if (
      profile &&
      profile.dataset.profileId
    ) {

      showUserProfile(
        profile.dataset.profileId
      );
    }

  }
);


// =====================================================
// USER PROFILE POPUP
// =====================================================

async function showUserProfile(id) {

  if (!id || id === "0") {
    return;
  }

  $("profileContent").innerHTML = `
    <div class="page-loader">
      <div class="spinner"></div>
    </div>
  `;

  openModal(
    "profileModal"
  );

  try {

    const data =
      await api(
        "/account/" +
        encodeURIComponent(id)
      );

    if (!data.success) {
      throw new Error(
        "User not found."
      );
    }

    const user =
      data.user;

    $("profileContent").innerHTML = `

      <div class="profile-header">

        <img
          src="${escapeHTML(user.avatar || "/logo.png")}"
          alt=""
        >

        <div>

          <div class="profile-name">
            ${escapeHTML(user.username)}
          </div>

          <div class="muted">
            ADMFLIP trader
          </div>

        </div>

      </div>

      <div class="profile-stat-grid">

        <div class="stat-card">
          <span>Wagered</span>
          <strong>
            ${formatValue(user.wagered)}
          </strong>
        </div>

        <div class="stat-card">
          <span>Profit</span>
          <strong>
            ${formatValue(user.profit)}
          </strong>
        </div>

        <div class="stat-card">
          <span>Pets</span>
          <strong>
            ${user.inventory.length}
          </strong>
        </div>

      </div>

    `;

  } catch (error) {

    $("profileContent").innerHTML = `
      <div class="empty-state">
        ${escapeHTML(error.message)}
      </div>
    `;
  }
}


// =====================================================
// ONLINE COUNT
// =====================================================

loadOnlineCount();

// IMPORTANT:
// This does NOT run on every page refresh.
// It only checks the server every 100 seconds.
// The server should keep a persistent count.
setInterval(
  loadOnlineCount,
  100000
);


// =====================================================
// START
// =====================================================

window.addEventListener(
  "hashchange",
  renderRoute
);

window.addEventListener(
  "resize",
  setupChatLayout
);


loadSavedUser();

setupChatLayout();

renderRoute();

loadChat();
