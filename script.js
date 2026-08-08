/* =========================================================
   ADMFLIP — SCRIPT.JS
   Frontend controller
========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIG
  ======================================================= */

  const API_BASE = window.ADMFLIP_API || "";

  const state = {
    page: "coinflip",
    user: null,
    pets: [],
    selectedPet: null,
    selectedSide: null,
    coinflips: [],
    chatOpen: false
  };

  /* =======================================================
     HELPERS
  ======================================================= */

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => [
    ...document.querySelectorAll(selector)
  ];

  const el = (id) => document.getElementById(id);

  function show(element) {
    if (element) {
      element.classList.remove("hidden");
    }
  }

  function hide(element) {
    if (element) {
      element.classList.add("hidden");
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const number = Number(value);

    if (!Number.isNaN(number)) {
      return number.toLocaleString();
    }

    return escapeHTML(value);
  }

  function petImage(pet) {
    return (
      pet?.image ||
      pet?.imageUrl ||
      pet?.icon ||
      pet?.thumbnail ||
      "/logo.png"
    );
  }

  function petName(pet) {
    return (
      pet?.name ||
      pet?.petName ||
      "Unknown Pet"
    );
  }

  function petValue(pet) {
    return (
      pet?.value ??
      pet?.normalValue ??
      pet?.worth ??
      pet?.price ??
      0
    );
  }

  async function api(path, options = {}) {
    const url = `${API_BASE}${path}`;

    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`
      );
    }

    return data;
  }

  function toast(message) {
    let box = el("toast");

    if (!box) {
      box = document.createElement("div");
      box.id = "toast";
      box.className = "toast";
      document.body.appendChild(box);
    }

    box.textContent = message;
    box.classList.add("show");

    clearTimeout(box._timeout);

    box._timeout = setTimeout(() => {
      box.classList.remove("show");
    }, 2500);
  }

  /* =======================================================
     PAGE NAVIGATION
  ======================================================= */

  const pages = {
    coinflip: "coinflipPage",
    leaderboard: "leaderboardPage",
    values: "valuesPage",
    chat: "chatPage",
    profile: "profilePage"
  };

  function openPage(page, updateHash = true) {
    if (!pages[page]) {
      page = "coinflip";
    }

    state.page = page;

    Object.entries(pages).forEach(
      ([name, id]) => {
        const pageElement = el(id);

        if (!pageElement) return;

        pageElement.classList.toggle(
          "hidden",
          name !== page
        );
      }
    );

    $$(".nav-item").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    if (page === "values") {
      loadValues();
    }

    if (page === "leaderboard") {
      loadLeaderboard();
    }

    if (page === "chat") {
      loadChat();
    }

    if (page === "coinflip") {
      loadCoinflips();
    }

    if (page === "profile") {
      renderProfile();
    }

    if (updateHash) {
      history.replaceState(
        null,
        "",
        `#${page}`
      );
    }
  }

  function setupNavigation() {
    $$(".nav-item").forEach((button) => {
      button.addEventListener("click", () => {
        openPage(button.dataset.page);
      });
    });

    $$(".brand").forEach((brand) => {
      brand.addEventListener("click", (event) => {
        event.preventDefault();
        openPage("coinflip");
      });
    });

    window.addEventListener("hashchange", () => {
      const page =
        location.hash.replace("#", "") ||
        "coinflip";

      if (pages[page]) {
        openPage(page, false);
      }
    });

    const initialPage =
      location.hash.replace("#", "") ||
      "coinflip";

    openPage(
      pages[initialPage]
        ? initialPage
        : "coinflip",
      false
    );
  }

  /* =======================================================
     CHAT SIDE PANEL
  ======================================================= */

  function createChatPanel() {
    if (el("chatPanel")) return;

    const panel = document.createElement("aside");

    panel.id = "chatPanel";
    panel.className = "chat-panel";

    panel.innerHTML = `
      <div class="chat-head">

        <div>
          <strong>ADMFLIP CHAT</strong>

          <span>
            <i class="online-dot"></i>
            <b id="panelOnlineCount">--</b>
            online
          </span>
        </div>

        <div class="chat-actions">

          <button
            id="rulesBtnPanel"
            class="rules-icon"
            type="button"
            title="Chat rules"
          >?</button>

          <button
            id="chatClose"
            class="chat-close"
            type="button"
            title="Close"
          >×</button>

        </div>

      </div>

      <div
        id="panelChatMessages"
        class="chat-messages"
      >
        <div class="loading">
          Loading chat...
        </div>
      </div>

      <form
        id="panelChatForm"
        class="chat-form"
      >

        <input
          id="panelChatInput"
          type="text"
          maxlength="250"
          autocomplete="off"
          placeholder="Sign in to chat..."
        >

        <button type="submit">
          Send
        </button>

      </form>
    `;

    document.body.appendChild(panel);

    el("chatClose")?.addEventListener(
      "click",
      closeChat
    );

    el("rulesBtnPanel")?.addEventListener(
      "click",
      openRules
    );

    el("panelChatForm")?.addEventListener(
      "submit",
      sendPanelMessage
    );

    closeChat();
  }

  function openChat() {
    const panel = el("chatPanel");

    if (!panel) return;

    panel.classList.add("open");
    panel.style.display = "flex";

    state.chatOpen = true;

    loadChat();
  }

  function closeChat() {
    const panel = el("chatPanel");

    if (!panel) return;

    panel.classList.remove("open");
    panel.style.display = "none";

    state.chatOpen = false;
  }

  function setupMobileChat() {
    let button = el("mobileChatButton");

    if (!button) {
      button = document.createElement("button");

      button.id = "mobileChatButton";
      button.className = "mobile-chat-button";
      button.type = "button";
      button.textContent = "Chat";

      document.body.appendChild(button);
    }

    button.addEventListener(
      "click",
      openChat
    );
  }

  /* =======================================================
     CHAT
  ======================================================= */

  async function loadChat() {
    try {
      const data = await api("/api/chat");

      const messages =
        Array.isArray(data)
          ? data
          : data?.messages || [];

      renderChat(messages);

      const online =
        data?.online ??
        data?.onlineCount ??
        "--";

      setOnlineCount(online);

    } catch (error) {
      console.warn(
        "Chat loading failed:",
        error
      );

      renderChat([]);
    }
  }

  function renderChat(messages) {
    const containers = [
      el("chatMessages"),
      el("panelChatMessages")
    ].filter(Boolean);

    containers.forEach((container) => {
      if (!messages.length) {
        container.innerHTML = `
          <div class="loading">
            No messages yet.
          </div>
        `;

        return;
      }

      container.innerHTML = messages
        .map((message) => {
          const username =
            message.username ||
            message.user?.username ||
            "User";

          const avatar =
            message.avatar ||
            message.user?.avatar ||
            "/logo.png";

          const text =
            message.text ||
            message.message ||
            "";

          return `
            <div class="chat-message">

              <img
                class="chat-avatar"
                src="${escapeHTML(avatar)}"
                alt=""
                onerror="this.src='/logo.png'"
              >

              <div class="chat-content">

                <div class="chat-username">
                  ${escapeHTML(username)}
                </div>

                <div class="chat-text">
                  ${escapeHTML(text)}
                </div>

              </div>

            </div>
          `;
        })
        .join("");

      container.scrollTop =
        container.scrollHeight;
    });
  }

  function setOnlineCount(count) {
    [
      "onlineCount",
      "panelOnlineCount",
      "coinflipOnline"
    ].forEach((id) => {
      const node = el(id);

      if (node) {
        node.textContent = count;
      }
    });
  }

  async function sendChatMessage(input) {
    if (!input) return;

    const text =
      input.value.trim();

    if (!text) return;

    if (!state.user) {
      toast(
        "Sign in before chatting."
      );
      openLogin();
      return;
    }

    input.disabled = true;

    try {
      await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text
        })
      });

      input.value = "";

      await loadChat();

    } catch (error) {
      console.warn(
        "Message failed:",
        error
      );

      toast(
        "Unable to send message."
      );

    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function sendPageMessage(event) {
    event.preventDefault();

    sendChatMessage(
      el("chatInput")
    );
  }

  function sendPanelMessage(event) {
    event.preventDefault();

    sendChatMessage(
      el("panelChatInput")
    );
  }

  function setupChat() {
    el("chatForm")?.addEventListener(
      "submit",
      sendPageMessage
    );

    el("rulesBtn")?.addEventListener(
      "click",
      openRules
    );

    createChatPanel();
    setupMobileChat();
  }

  /* =======================================================
     VALUES
  ======================================================= */

  async function loadValues() {
    const grid = el("valuesGrid");

    if (!grid) return;

    grid.innerHTML = `
      <div class="loading">
        Loading values...
      </div>
    `;

    try {
      const data =
        await api("/api/values");

      const pets =
        Array.isArray(data)
          ? data
          : data?.pets ||
            data?.values ||
            [];

      state.pets = pets;

      renderValues(pets);

    } catch (error) {
      console.warn(
        "Values loading failed:",
        error
      );

      grid.innerHTML = `
        <div class="loading">
          Values are currently unavailable.
        </div>
      `;
    }
  }

  function renderValues(pets) {
    const grid = el("valuesGrid");

    if (!grid) return;

    if (!pets.length) {
      grid.innerHTML = `
        <div class="loading">
          No pets found.
        </div>
      `;

      return;
    }

    grid.innerHTML = pets
      .map((pet) => petCard(pet))
      .join("");
  }

  function petCard(pet) {
    const name =
      petName(pet);

    return `
      <article
        class="pet-card"
        data-pet-name="${escapeHTML(name)}"
      >

        <img
          class="pet-image"
          src="${escapeHTML(
            petImage(pet)
          )}"
          alt="${escapeHTML(name)}"
          loading="lazy"
          onerror="this.src='/logo.png'"
        >

        <div class="pet-name">
          ${escapeHTML(name)}
        </div>

        <div class="pet-meta">

          <span>
            Value
          </span>

          <strong class="pet-value">
            ${formatValue(
              petValue(pet)
            )}
          </strong>

        </div>

      </article>
    `;
  }

  function setupValueSearch() {
    const input =
      el("valueSearch");

    if (!input) return;

    input.addEventListener(
      "input",
      () => {
        const query =
          input.value
            .trim()
            .toLowerCase();

        $$("#valuesGrid .pet-card")
          .forEach((card) => {
            const name =
              card.dataset.petName
                ?.toLowerCase() || "";

            card.style.display =
              !query ||
              name.includes(query)
                ? ""
                : "none";
          });
      }
    );
  }

  /* =======================================================
     COINFLIPS
  ======================================================= */

  async function loadCoinflips() {
    const container =
      el("coinflips");

    if (!container) return;

    try {
      const data =
        await api("/api/coinflips");

      const flips =
        Array.isArray(data)
          ? data
          : data?.coinflips ||
            data?.flips ||
            [];

      state.coinflips = flips;

      renderCoinflips(flips);

      const count =
        el("activeCount");

      if (count) {
        count.textContent =
          flips.length;
      }

    } catch (error) {
      console.warn(
        "Coinflip loading failed:",
        error
      );

      renderCoinflips([]);
    }
  }

  function renderCoinflips(flips) {
    const container =
      el("coinflips");

    if (!container) return;

    if (!flips.length) {
      container.innerHTML = `
        <div class="loading">
          No active coinflips.
        </div>
      `;

      return;
    }

    container.innerHTML = flips
      .map((flip) => {
        const username =
          flip.username ||
          flip.user?.username ||
          "Trader";

        const pet =
          flip.pet ||
          flip.item ||
          {};

        const image =
          petImage(pet);

        const name =
          petName(pet);

        const value =
          petValue(pet);

        const side =
          flip.side ||
          "heads";

        return `
          <article class="coinflip">

            <div class="cf-users">

              <span>
                ${escapeHTML(
                  username
                )}
              </span>

              <span class="cf-side-label">
                ${escapeHTML(
                  side
                )}
              </span>

            </div>

            <div class="cf-body">

              <div class="cf-side">

                <div class="cf-pet">

                  <img
                    src="${escapeHTML(
                      image
                    )}"
                    alt="${escapeHTML(
                      name
                    )}"
                    onerror="this.src='/logo.png'"
                  >

                  <div>

                    <b>
                      ${escapeHTML(
                        name
                      )}
                    </b>

                    <small>
                      Value:
                      ${formatValue(
                        value
                      )}
                    </small>

                  </div>

                </div>

              </div>

              <div class="cf-center">

                <div class="coin">
                  FLIP
                </div>

                <small class="waiting">
                  Waiting
                </small>

              </div>

              <div class="cf-side">

                <div class="cf-pet">

                  <div class="waiting-icon">
                    ?
                  </div>

                  <div>

                    <b>
                      Waiting for player
                    </b>

                    <small>
                      Join this flip
                    </small>

                  </div>

                </div>

              </div>

            </div>

          </article>
        `;
      })
      .join("");
  }

  /* =======================================================
     CREATE COINFLIP
  ======================================================= */

  function setupCreateCoinflip() {
    el("createCoinflipBtn")
      ?.addEventListener(
        "click",
        openCreate
      );

    $$(".side-btn")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            $$(".side-btn")
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

    el("postCoinflip")
      ?.addEventListener(
        "click",
        postCoinflip
      );
  }

  async function openCreate() {
    if (!state.user) {
      toast(
        "Sign in before creating a coinflip."
      );

      openLogin();

      return;
    }

    const modal =
      createModal(
        "createModal",
        createModalHTML()
      );

    show(modal);

    const grid =
      el("createInventory");

    if (!grid) return;

    state.selectedPet = null;
    state.selectedSide = null;

    hide(el("sideArea"));

    $$(".side-btn")
      .forEach((button) => {
        button.classList.remove(
          "selected"
        );
      });

    grid.innerHTML = `
      <div class="loading">
        Loading inventory...
      </div>
    `;

    try {
      const data =
        await api("/api/inventory");

      const pets =
        Array.isArray(data)
          ? data
          : data?.pets ||
            data?.inventory ||
            [];

      renderCreateInventory(pets);

    } catch (error) {
      console.warn(
        "Inventory failed:",
        error
      );

      grid.innerHTML = `
        <div class="loading">
          Inventory unavailable.
        </div>
      `;
    }
  }

  function createModalHTML() {
    return `
      <div class="modal-card large">

        <button
          id="closeCreate"
          class="modal-close"
          type="button"
        >×</button>

        <div class="eyebrow">
          NEW FLIP
        </div>

        <h2>
          Create Coinflip
        </h2>

        <p class="muted">
          Select a pet and choose your side.
        </p>

        <div
          id="createInventory"
          class="pet-grid"
        >
          <div class="loading">
            Loading...
          </div>
        </div>

        <div
          id="sideArea"
          class="side-area hidden"
        >

          <h3>
            Choose your side
          </h3>

          <div class="side-buttons">

            <button
              class="side-btn"
              data-side="heads"
              type="button"
            >
              <span>H</span>
              HEADS
            </button>

            <button
              class="side-btn"
              data-side="tails"
              type="button"
            >
              <span>T</span>
              TAILS
            </button>

          </div>

          <button
            id="postCoinflip"
            class="primary full"
            type="button"
          >
            Post Coinflip
          </button>

        </div>

      </div>
    `;
  }

  function renderCreateInventory(pets) {
    const grid =
      el("createInventory");

    if (!grid) return;

    if (!pets.length) {
      grid.innerHTML = `
        <div class="loading">
          No pets available.
        </div>
      `;

      return;
    }

    grid.innerHTML = pets
      .map((pet, index) => `
        <article
          class="pet-card"
          data-inventory-index="${index}"
        >

          <img
            class="pet-image"
            src="${escapeHTML(
              petImage(pet)
            )}"
            alt="${escapeHTML(
              petName(pet)
            )}"
            onerror="this.src='/logo.png'"
          >

          <div class="pet-name">
            ${escapeHTML(
              petName(pet)
            )}
          </div>

          <div class="pet-meta">

            <span>
              Value
            </span>

            <strong class="pet-value">
              ${formatValue(
                petValue(pet)
              )}
            </strong>

          </div>

        </article>
      `)
      .join("");

    $$("#createInventory .pet-card")
      .forEach((card, index) => {
        card.addEventListener(
          "click",
          () => {
            $$("#createInventory .pet-card")
              .forEach((item) => {
                item.classList.remove(
                  "selected"
                );
              });

            card.classList.add(
              "selected"
            );

            state.selectedPet =
              pets[index];

            show(el("sideArea"));
          }
        );
      });

    el("closeCreate")
      ?.addEventListener(
        "click",
        () => closeModal("createModal")
      );

    $$(".side-btn")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            $$(".side-btn")
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

    el("postCoinflip")
      ?.addEventListener(
        "click",
        postCoinflip
      );
  }

  async function postCoinflip() {
    if (!state.selectedPet) {
      toast(
        "Select a pet first."
      );

      return;
    }

    if (!state.selectedSide) {
      toast(
        "Choose heads or tails."
      );

      return;
    }

    try {
      await api(
        "/api/coinflips",
        {
          method: "POST",
          body: JSON.stringify({
            pet: state.selectedPet,
            side: state.selectedSide
          })
        }
      );

      toast(
        "Coinflip created."
      );

      closeModal(
        "createModal"
      );

      await loadCoinflips();

    } catch (error) {
      console.warn(
        "Coinflip creation failed:",
        error
      );

      toast(
        "Could not create coinflip."
      );
    }
  }

  /* =======================================================
     LEADERBOARD
  ======================================================= */

  async function loadLeaderboard() {
    const container =
      el("leaderboard");

    if (!container) return;

    container.innerHTML = `
      <div class="loading">
        Loading leaderboard...
      </div>
    `;

    try {
      const data =
        await api(
          "/api/leaderboard"
        );

      const players =
        Array.isArray(data)
          ? data
          : data?.players ||
            data?.leaderboard ||
            [];

      renderLeaderboard(
        players
      );

    } catch (error) {
      console.warn(
        "Leaderboard failed:",
        error
      );

      container.innerHTML = `
        <div class="loading">
          Leaderboard unavailable.
        </div>
      `;
    }
  }

  function renderLeaderboard(players) {
    const container =
      el("leaderboard");

    if (!container) return;

    if (!players.length) {
      container.innerHTML = `
        <div class="loading">
          No leaderboard data yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      players
        .map((player, index) => {
          const username =
            player.username ||
            player.name ||
            "User";

          const avatar =
            player.avatar ||
            "/logo.png";

          const wagered =
            player.wagered ??
            player.total ??
            player.value ??
            0;

          return `
            <div class="rank-row">

              <div class="rank">
                #${index + 1}
              </div>

              <div class="rank-player">

                <img
                  src="${escapeHTML(
                    avatar
                  )}"
                  alt=""
                  onerror="this.src='/logo.png'"
                >

                <div>

                  <strong>
                    ${escapeHTML(
                      username
                    )}
                  </strong>

                  <small>
                    Trader
                  </small>

                </div>

              </div>

              <div class="rank-value">
                ${formatValue(
                  wagered
                )}
              </div>

            </div>
          `;
        })
        .join("");
  }

  /* =======================================================
     MODALS
  ======================================================= */

  function createModal(id, content) {
    let modal = el(id);

    if (modal) {
      return modal;
    }

    modal =
      document.createElement(
        "div"
      );

    modal.id = id;
    modal.className =
      "modal hidden";

    modal.innerHTML =
      content;

    document.body.appendChild(
      modal
    );

    return modal;
  }

  function closeModal(id) {
    const modal = el(id);

    if (modal) {
      hide(modal);
    }
  }

  function openLogin() {
    const modal =
      createModal(
        "loginModal",
        `
          <div class="modal-card">

            <button
              id="closeLogin"
              class="modal-close"
              type="button"
            >×</button>

            <div class="login-logo">
              <img
                src="/logo.png"
                alt="ADMFLIP"
              >
            </div>

            <div class="eyebrow">
              ACCOUNT
            </div>

            <h2>
              Roblox Sign In
            </h2>

            <p class="muted">
              Enter your Roblox username to continue.
            </p>

            <input
              id="username"
              class="input"
              type="text"
              placeholder="Roblox username"
              autocomplete="off"
            >

            <button
              id="loginContinue"
              class="primary full"
              type="button"
            >
              Continue
            </button>

            <div
              id="loginMessage"
              class="message"
            ></div>

          </div>
        `
      );

    show(modal);

    setupLoginModal();
  }

  function setupLoginModal() {
    el("closeLogin")
      ?.addEventListener(
        "click",
        () => {
          closeModal(
            "loginModal"
          );
        }
      );

    el("loginContinue")
      ?.addEventListener(
        "click",
        performLogin
      );

    el("username")
      ?.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key === "Enter"
          ) {
            performLogin();
          }
        }
      );

    setTimeout(() => {
      el("username")?.focus();
    }, 50);
  }

  async function performLogin() {
    const input =
      el("username");

    const message =
      el("loginMessage");

    if (!input) return;

    const username =
      input.value.trim();

    if (!username) {
      if (message) {
        message.textContent =
          "Enter your Roblox username.";
      }

      return;
    }

    if (message) {
      message.textContent =
        "Checking account...";
    }

    try {
      const data =
        await api(
          "/api/login",
          {
            method: "POST",
            body: JSON.stringify({
              username
            })
          }
        );

      state.user =
        data?.user || {
          username
        };

      saveUser();
      updateAccountUI();

      closeModal(
        "loginModal"
      );

      toast(
        `Welcome, ${state.user.username}!`
      );

    } catch (error) {
      console.warn(
        "Login endpoint failed:",
        error
      );

      /*
        Local frontend fallback.
        This does NOT collect passwords,
        cookies, .ROBLOSECURITY or tokens.
      */

      state.user = {
        username
      };

      saveUser();
      updateAccountUI();

      closeModal(
        "loginModal"
      );

      toast(
        `Signed in as ${username}`
      );
    }
  }

  function openRules() {
    const modal =
      createModal(
        "rulesModal",
        `
          <div class="modal-card rules-box">

            <button
              id="closeRules"
              class="modal-close"
              type="button"
            >×</button>

            <div class="eyebrow">
              COMMUNITY
            </div>

            <h2>
              Chat Rules
            </h2>

            <p class="muted">
              Keep ADMFLIP welcoming and useful.
            </p>

            <div class="rule">
              <b>
                01 · Respect everyone
              </b>
              <span>
                Harassment, hate speech and targeted
                abuse are not allowed.
              </span>
            </div>

            <div class="rule">
              <b>
                02 · No spam
              </b>
              <span>
                Avoid repeated messages and flooding.
              </span>
            </div>

            <div class="rule">
              <b>
                03 · No begging
              </b>
              <span>
                Do not repeatedly ask users for pets.
              </span>
            </div>

            <div class="rule">
              <b>
                04 · No advertising
              </b>
              <span>
                Unrelated websites and communities
                are not allowed.
              </span>
            </div>

            <div class="rule">
              <b>
                05 · No scams
              </b>
              <span>
                Do not impersonate staff or intentionally
                mislead users.
              </span>
            </div>

            <div class="rule">
              <b>
                06 · Keep it appropriate
              </b>
              <span>
                Sexual or adult content is not allowed.
              </span>
            </div>

          </div>
        `
      );

    show(modal);

    el("closeRules")
      ?.addEventListener(
        "click",
        () => {
          closeModal(
            "rulesModal"
          );
        }
      );
  }

  function openInventory() {
    if (!state.user) {
      toast(
        "Sign in first."
      );

      openLogin();

      return;
    }

    const modal =
      createModal(
        "inventoryModal",
        `
          <div class="modal-card large">

            <button
              id="closeInventory"
              class="modal-close"
              type="button"
            >×</button>

            <div class="eyebrow">
              YOUR ITEMS
            </div>

            <h2>
              Inventory
            </h2>

            <p class="muted">
              Pets available for coinflips.
            </p>

            <div
              id="inventoryGrid"
              class="pet-grid"
            >
              <div class="loading">
                Loading...
              </div>
            </div>

          </div>
        `
      );

    show(modal);

    el("closeInventory")
      ?.addEventListener(
        "click",
        () => {
          closeModal(
            "inventoryModal"
          );
        }
      );

    loadInventory();
  }

  async function loadInventory() {
    const grid =
      el("inventoryGrid");

    if (!grid) return;

    try {
      const data =
        await api(
          "/api/inventory"
        );

      const pets =
        Array.isArray(data)
          ? data
          : data?.pets ||
            data?.inventory ||
            [];

      if (!pets.length) {
        grid.innerHTML = `
          <div class="loading">
            No pets found.
          </div>
        `;

        return;
      }

      grid.innerHTML =
        pets
          .map((pet) =>
            petCard(pet)
          )
          .join("");

    } catch (error) {
      console.warn(
        "Inventory failed:",
        error
      );

      grid.innerHTML = `
        <div class="loading">
          Inventory unavailable.
        </div>
      `;
    }
  }

  /* =======================================================
     ACCOUNT
  ======================================================= */

  function saveUser() {
    try {
      localStorage.setItem(
        "admflip_user",
        JSON.stringify(
          state.user
        )
      );
    } catch {}
  }

  function loadSavedUser() {
    try {
      const saved =
        localStorage.getItem(
          "admflip_user"
        );

      if (saved) {
        state.user =
          JSON.parse(saved);
      }

    } catch {
      state.user = null;
    }

    updateAccountUI();
  }

  function updateAccountUI() {
    const login =
      el("loginBtn");

    const account =
      el("accountBox");

    if (!state.user) {
      show(login);
      hide(account);

      return;
    }

    hide(login);
    show(account);

    const username =
      el("accountUsername");

    if (username) {
      username.textContent =
        state.user.username ||
        "User";
    }

    const avatar =
      el("accountAvatar");

    if (
      avatar &&
      state.user.avatar
    ) {
      avatar.src =
        state.user.avatar;
    }

    [
      el("chatInput"),
      el("panelChatInput")
    ].forEach((input) => {
      if (input) {
        input.placeholder =
          "Type a message...";
      }
    });
  }

  function logout() {
    state.user = null;

    try {
      localStorage.removeItem(
        "admflip_user"
      );
    } catch {}

    updateAccountUI();

    toast(
      "Signed out."
    );
  }

  function setupAccount() {
    el("loginBtn")
      ?.addEventListener(
        "click",
        openLogin
      );

    el("inventoryBtn")
      ?.addEventListener(
        "click",
        openInventory
      );

    el("logoutBtn")
      ?.addEventListener(
        "click",
        logout
      );

    el("profileBtn")
      ?.addEventListener(
        "click",
        () => {
          openPage("profile");
        }
      );
  }

  function renderProfile() {
    const container =
      el("profileContent");

    if (!container) return;

    if (!state.user) {
      container.innerHTML = `
        <div class="profile-card">

          <h2>
            Not signed in
          </h2>

          <p class="muted">
            Sign in to view your profile.
          </p>

          <button
            class="primary"
            id="profileLoginButton"
            type="button"
          >
            Sign In
          </button>

        </div>
      `;

      el("profileLoginButton")
        ?.addEventListener(
          "click",
          openLogin
        );

      return;
    }

    container.innerHTML = `
      <div class="profile-grid">

        <div class="profile-card">

          <img
            class="profile-avatar"
            src="${escapeHTML(
              state.user.avatar ||
              "/logo.png"
            )}"
            alt=""
            onerror="this.src='/logo.png'"
          >

          <h2>
            ${escapeHTML(
              state.user.username ||
              "User"
            )}
          </h2>

          <p class="muted">
            ADMFLIP Trader
          </p>

        </div>

        <div class="profile-stat">

          <span>
            WAGERED
          </span>

          <strong>
            ${formatValue(
              state.user.wagered ||
              0
            )}
          </strong>

        </div>

        <div class="profile-stat">

          <span>
            COINFLIPS
          </span>

          <strong>
            ${formatValue(
              state.user.coinflips ||
              0
            )}
          </strong>

        </div>

        <div class="profile-stat">

          <span>
            WINS
          </span>

          <strong>
            ${formatValue(
              state.user.wins ||
              0
            )}
          </strong>

        </div>

      </div>
    `;
  }

  /* =======================================================
     MODAL EVENTS
  ======================================================= */

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.classList.contains(
          "modal"
        )
      ) {
        hide(event.target);
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      $$(".modal").forEach(
        (modal) => {
          hide(modal);
        }
      );

      closeChat();
    }
  );

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  async function init() {
    setupNavigation();
    setupChat();
    setupAccount();
    setupCreateCoinflip();
    setupValueSearch();
    loadSavedUser();

    await Promise.allSettled([
      loadCoinflips(),
      loadValues(),
      loadChat()
    ]);

    setInterval(() => {
      if (
        state.page === "coinflip"
      ) {
        loadCoinflips();
      }

      if (
        state.page === "chat" ||
        state.chatOpen
      ) {
        loadChat();
      }
    }, 15000);
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
