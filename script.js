/* =========================================================
   ADMFLIP — SCRIPT.JS
   Restored frontend controller
========================================================= */

(() => {
  "use strict";

  const BACKEND = "https://admflip-new.onrender.com";

  const state = {
    page: "coinflip",
    user: null,
    verification: null,
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

  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const el = (id) => document.getElementById(id);

  function show(element) {
    if (element) element.classList.remove("hidden");
  }

  function hide(element) {
    if (element) element.classList.add("hidden");
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
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    const number = Number(value);

    if (!Number.isNaN(number)) {
      return number.toLocaleString();
    }

    return escapeHTML(value);
  }

  function petName(pet) {
    if (typeof pet === "string") return pet;

    return (
      pet?.name ||
      pet?.petName ||
      pet?.itemName ||
      pet?.displayName ||
      "Unknown Pet"
    );
  }

  function petValue(pet) {
    if (typeof pet === "string") return 0;

    return (
      pet?.value ??
      pet?.normalValue ??
      pet?.worth ??
      pet?.price ??
      0
    );
  }

  function petImage(pet) {
    if (typeof pet === "string") {
      return `https://amvgg.com/items/${encodeURIComponent(pet)}.webp`;
    }

    if (
      pet?.image ||
      pet?.imageUrl ||
      pet?.icon ||
      pet?.thumbnail
    ) {
      return (
        pet.image ||
        pet.imageUrl ||
        pet.icon ||
        pet.thumbnail
      );
    }

    const name = petName(pet);

    return `https://amvgg.com/items/${encodeURIComponent(name)}.webp`;
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

  async function api(path, options = {}) {
    const response = await fetch(`${BACKEND}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      }
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

  /* =======================================================
     PAGES
  ======================================================= */

  const pages = {
    coinflip: "coinflipPage",
    leaderboard: "leaderboardPage",
    values: "valuesPage",
    chat: "chatPage",
    profile: "profilePage"
  };

  function openPage(page) {
    if (!pages[page]) {
      page = "coinflip";
    }

    state.page = page;

    Object.entries(pages).forEach(([name, id]) => {
      const pageElement = el(id);

      if (!pageElement) return;

      pageElement.classList.toggle(
        "hidden",
        name !== page
      );
    });

    $$(".nav-item").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    if (page === "coinflip") {
      loadCoinflips();
    }

    if (page === "values") {
      loadValues();
    }

    if (page === "leaderboard") {
      loadLeaderboard();
    }

    if (page === "chat") {
      loadChat();
    }

    if (page === "profile") {
      renderProfile();
    }

    if (location.hash !== `#${page}`) {
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
        openPage(page);
      }
    });

    const initial =
      location.hash.replace("#", "") ||
      "coinflip";

    openPage(
      pages[initial]
        ? initial
        : "coinflip"
    );
  }

  /* =======================================================
     ROBLOX BIO LOGIN
  ======================================================= */

  function createLoginModal() {
    let modal = el("loginModal");

    if (modal) return modal;

    modal = document.createElement("div");

    modal.id = "loginModal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-box">

        <button
          id="closeLogin"
          class="modal-close"
          type="button"
        >
          ×
        </button>

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
          Verify your Roblox account using your profile bio.
        </p>

        <input
          id="username"
          class="input"
          type="text"
          placeholder="Roblox username"
          autocomplete="off"
        >

        <div
          id="loginProfile"
          class="login-profile hidden"
        ></div>

        <div
          id="phrase"
          class="phrase hidden"
        ></div>

        <button
          id="verify"
          class="primary full"
          type="button"
          style="display:none"
        >
          Verify
        </button>

        <div
          id="loginMessage"
          class="message"
        ></div>

      </div>
    `;

    document.body.appendChild(modal);

    return modal;
  }

  function openLogin() {
    const modal = createLoginModal();

    show(modal);

    const username = el("username");

    if (username) {
      username.value = "";
      username.focus();
    }

    hide(el("loginProfile"));
    hide(el("phrase"));

    const verify = el("verify");

    if (verify) {
      verify.style.display = "none";
    }

    const message = el("loginMessage");

    if (message) {
      message.textContent = "";
    }

    setupLoginEvents();
  }

  function setupLoginEvents() {
    el("closeLogin")?.addEventListener(
      "click",
      () => closeModal("loginModal")
    );

    el("username")?.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          startVerification();
        }
      }
    );

    el("verify")?.addEventListener(
      "click",
      verifyRobloxBio
    );
  }

  async function startVerification() {
    const input = el("username");
    const message = el("loginMessage");

    if (!input) return;

    const username = input.value.trim();

    if (!username) {
      if (message) {
        message.textContent =
          "Enter your Roblox username.";
      }

      return;
    }

    if (message) {
      message.textContent =
        "Finding Roblox account...";
    }

    try {
      /*
        OLD WORKING FLOW:

        GET /user/:username

        This gets the Roblox profile first.
      */

      const userData = await api(
        `/user/${encodeURIComponent(username)}`
      );

      const robloxUser =
        userData?.user ||
        userData?.data ||
        userData;

      if (!robloxUser) {
        throw new Error(
          "Roblox user not found."
        );
      }

      state.verification = {
        username,
        robloxUser
      };

      renderLoginProfile(robloxUser);

      if (message) {
        message.textContent =
          "Generating verification phrase...";
      }

      /*
        OLD WORKING FLOW:

        POST /create

        Backend creates the random phrase.
      */

      const createData = await api(
        "/create",
        {
          method: "POST",
          body: JSON.stringify({
            username,
            userId:
              robloxUser.id ||
              robloxUser.userId
          })
        }
      );

      const phrase =
        createData?.phrase ||
        createData?.code ||
        createData?.verification ||
        createData?.message;

      if (!phrase) {
        throw new Error(
          "Verification phrase was not returned."
        );
      }

      state.verification.phrase = phrase;

      renderPhrase(phrase);

      const verify = el("verify");

      if (verify) {
        verify.style.display = "block";
      }

      if (message) {
        message.textContent =
          "Put the phrase in your Roblox bio, then click Verify.";
      }

    } catch (error) {
      console.error(
        "ADMFLIP verification:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Unable to find Roblox account.";
      }
    }
  }

  function renderLoginProfile(user) {
    const box = el("loginProfile");

    if (!box) return;

    const username =
      user.username ||
      user.name ||
      "Roblox User";

    const avatar =
      user.avatar ||
      user.avatarUrl ||
      user.image ||
      user.thumbnail ||
      "/logo.png";

    box.innerHTML = `
      <div class="login-profile-inner">

        <img
          src="${escapeHTML(avatar)}"
          alt=""
          onerror="this.src='/logo.png'"
        >

        <div>
          <strong>
            ${escapeHTML(username)}
          </strong>

          <span>
            Roblox account found
          </span>
        </div>

      </div>
    `;

    show(box);
  }

  function renderPhrase(phrase) {
    const box = el("phrase");

    if (!box) return;

    box.innerHTML = `
      <div class="phrase-label">
        VERIFICATION PHRASE
      </div>

      <strong>
        ${escapeHTML(phrase)}
      </strong>

      <p>
        Copy this exact phrase into your Roblox profile bio.
      </p>
    `;

    show(box);
  }

  async function verifyRobloxBio() {
    const message = el("loginMessage");

    if (
      !state.verification ||
      !state.verification.username ||
      !state.verification.phrase
    ) {
      if (message) {
        message.textContent =
          "Start verification first.";
      }

      return;
    }

    if (message) {
      message.textContent =
        "Checking your Roblox bio...";
    }

    const verifyButton = el("verify");

    if (verifyButton) {
      verifyButton.disabled = true;
      verifyButton.textContent =
        "Checking...";
    }

    try {
      /*
        OLD WORKING FLOW:

        POST /check

        The backend checks the Roblox bio
        for the generated phrase.

        No password, cookie, or .ROBLOSECURITY
        token is collected by this frontend.
      */

      const data = await api(
        "/check",
        {
          method: "POST",
          body: JSON.stringify({
            username:
              state.verification.username,

            phrase:
              state.verification.phrase
          })
        }
      );

      const success =
        data?.success === true ||
        data?.verified === true ||
        data?.valid === true ||
        data?.ok === true;

      if (!success) {
        throw new Error(
          data?.message ||
          "The verification phrase was not found in your Roblox bio."
        );
      }

      const verifiedUser =
        data?.user ||
        data?.account ||
        data?.data ||
        state.verification.robloxUser;

      state.user = {
        ...verifiedUser,

        username:
          verifiedUser?.username ||
          state.verification.username,

        id:
          verifiedUser?.id ||
          verifiedUser?.userId ||
          state.verification.robloxUser?.id
      };

      saveUser();
      updateAccountUI();

      closeModal("loginModal");

      toast(
        `Verified as ${state.user.username}`
      );

      loadCoinflips();
      loadChat();

    } catch (error) {
      console.error(
        "ADMFLIP bio verification:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Verification failed.";
      }
    } finally {
      if (verifyButton) {
        verifyButton.disabled = false;
        verifyButton.textContent =
          "Verify";
      }
    }
  }

  /* =======================================================
     ACCOUNT
  ======================================================= */

  function saveUser() {
    try {
      localStorage.setItem(
        "admflip_user",
        JSON.stringify(state.user)
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
        state.user = JSON.parse(saved);
      }
    } catch {
      state.user = null;
    }

    updateAccountUI();
  }

  function updateAccountUI() {
    const login = el("loginBtn");
    const account = el("accountBox");

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
    state.verification = null;

    try {
      localStorage.removeItem(
        "admflip_user"
      );
    } catch {}

    updateAccountUI();

    toast("Signed out.");
  }

  function setupAccount() {
    el("loginBtn")?.addEventListener(
      "click",
      openLogin
    );

    el("inventoryBtn")?.addEventListener(
      "click",
      openInventory
    );

    el("logoutBtn")?.addEventListener(
      "click",
      logout
    );

    el("profileBtn")?.addEventListener(
      "click",
      () => {
        openPage("profile");
        renderProfile();
      }
    );
  }

  /* =======================================================
     PET VALUES
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
      /*
        OLD WORKING ENDPOINT:

        GET /pets
      */

      const data = await api("/pets");

      const pets =
        Array.isArray(data)
          ? data
          : data?.pets ||
            data?.values ||
            data?.items ||
            data?.data ||
            [];

      state.pets = pets;

      renderValues(pets);

    } catch (error) {
      console.error(
        "ADMFLIP pets:",
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
    const name = petName(pet);
    const image = petImage(pet);
    const value = petValue(pet);

    const rarity =
      pet?.rarity ||
      pet?.type ||
      "";

    return `
      <article
        class="pet-card"
        data-pet-name="${escapeHTML(name)}"
      >

        <img
          class="pet-image"
          src="${escapeHTML(image)}"
          alt="${escapeHTML(name)}"
          loading="lazy"
          onerror="
            if (!this.dataset.failed) {
              this.dataset.failed='1';
              this.src='/logo.png';
            }
          "
        >

        <div class="pet-name">
          ${escapeHTML(name)}
        </div>

        ${
          rarity
            ? `
              <div class="pet-rarity">
                ${escapeHTML(rarity)}
              </div>
            `
            : ""
        }

        <div class="pet-meta">

          <span>
            Value
          </span>

          <strong class="pet-value">
            ${formatValue(value)}
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
                ?.toLowerCase() ||
              "";

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
        await api("/coinflips");

      const flips =
        Array.isArray(data)
          ? data
          : data?.coinflips ||
            data?.flips ||
            data?.data ||
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
      console.error(
        "ADMFLIP coinflips:",
        error
      );

      container.innerHTML = `
        <div class="loading">
          No active coinflips.
        </div>
      `;
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

    container.innerHTML =
      flips.map((flip) => {

        const username =
          flip.username ||
          flip.user?.username ||
          "Trader";

        const pet =
          flip.pet ||
          flip.item ||
          {
            name:
              flip.petName ||
              "Pet"
          };

        const side =
          flip.side ||
          "heads";

        const image =
          petImage(pet);

        const name =
          petName(pet);

        const value =
          petValue(pet);

        return `
          <article
            class="coinflip"
          >

            <div class="cf-users">

              <span>
                ${escapeHTML(username)}
              </span>

              <span
                class="cf-side-label"
              >
                ${escapeHTML(side)}
              </span>

            </div>

            <div class="cf-body">

              <div class="cf-side">

                <div class="cf-pet">

                  <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(name)}"
                    onerror="this.src='/logo.png'"
                  >

                  <div>

                    <b>
                      ${escapeHTML(name)}
                    </b>

                    <small>
                      Value:
                      ${formatValue(value)}
                    </small>

                  </div>

                </div>

              </div>

              <div class="cf-center">

                <div class="coin">
                  FLIP
                </div>

                <small
                  class="waiting"
                >
                  Waiting
                </small>

              </div>

              <div class="cf-side">

                <div class="cf-pet">

                  <div
                    class="waiting-icon"
                  >
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

      }).join("");
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
        "Verify your Roblox account first."
      );

      openLogin();

      return;
    }

    const modal =
      createModal(
        "createModal",
        `
          <div class="modal-box large">

            <button
              id="closeCreate"
              class="modal-close"
              type="button"
            >
              ×
            </button>

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
        `
      );

    show(modal);

    state.selectedPet = null;
    state.selectedSide = null;

    el("closeCreate")
      ?.addEventListener(
        "click",
        () => closeModal("createModal")
      );

    $$("#createModal .side-btn")
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            $$("#createModal .side-btn")
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

    const grid =
      el("createInventory");

    try {
      /*
        OLD INVENTORY ENDPOINT:

        GET /account/:id
      */

      const userId =
        state.user.id ||
        state.user.userId;

      const data =
        await api(
          `/account/${encodeURIComponent(userId)}`
        );

      const pets =
        Array.isArray(data)
          ? data
          : data?.pets ||
            data?.inventory ||
            data?.items ||
            data?.data ||
            [];

      renderCreateInventory(pets);

    } catch (error) {
      console.error(
        "ADMFLIP inventory:",
        error
      );

      if (grid) {
        grid.innerHTML = `
          <div class="loading">
            Inventory unavailable.
          </div>
        `;
      }
    }
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

    grid.innerHTML =
      pets.map((pet, index) => {

        const name =
          petName(pet);

        return `
          <article
            class="pet-card"
            data-index="${index}"
          >

            <img
              class="pet-image"
              src="${escapeHTML(
                petImage(pet)
              )}"
              alt="${escapeHTML(name)}"
              onerror="this.src='/logo.png'"
            >

            <div class="pet-name">
              ${escapeHTML(name)}
            </div>

            <div class="pet-meta">

              <span>
                Value
              </span>

              <strong
                class="pet-value"
              >
                ${formatValue(
                  petValue(pet)
                )}
              </strong>

            </div>

          </article>
        `;

      }).join("");

    $$("#createInventory .pet-card")
      .forEach((card) => {

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

            const index =
              Number(
                card.dataset.index
              );

            state.selectedPet =
              pets[index];

            show(
              el("sideArea")
            );
          }
        );

      });
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
        "/coinflips",
        {
          method: "POST",
          body: JSON.stringify({
            username:
              state.user.username,

            userId:
              state.user.id ||
              state.user.userId,

            pet:
              state.selectedPet,

            petName:
              petName(
                state.selectedPet
              ),

            side:
              state.selectedSide
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
      console.error(
        "ADMFLIP create:",
        error
      );

      toast(
        error.message ||
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
          "/leaderboard"
        );

      const players =
        Array.isArray(data)
          ? data
          : data?.players ||
            data?.leaderboard ||
            data?.data ||
            [];

      renderLeaderboard(
        players
      );

    } catch (error) {
      console.error(
        "ADMFLIP leaderboard:",
        error
      );

      container.innerHTML = `
        <div class="loading">
          Leaderboard unavailable.
        </div>
      `;
    }
  }

  function renderLeaderboard(
    players
  ) {
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
      players.map(
        (player, index) => {

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
            <div
              class="rank-row"
            >

              <div class="rank">
                #${index + 1}
              </div>

              <div
                class="rank-player"
              >

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

              <div
                class="rank-value"
              >
                ${formatValue(
                  wagered
                )}
              </div>

            </div>
          `;
        }
      ).join("");
  }

  /* =======================================================
     CHAT
  ======================================================= */

  async function loadChat() {
    try {
      const data =
        await api(
          "/chat/messages"
        );

      const messages =
        Array.isArray(data)
          ? data
          : data?.messages ||
            data?.data ||
            [];

      renderChat(messages);

      try {
        const online =
          await api(
            "/chat/online"
          );

        const count =
          online?.online ??
          online?.count ??
          online?.onlineCount ??
          online;

        setOnlineCount(
          count ?? "--"
        );

      } catch {
        setOnlineCount("--");
      }

    } catch (error) {
      console.error(
        "ADMFLIP chat:",
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

    containers.forEach(
      (container) => {

        if (!messages.length) {
          container.innerHTML = `
            <div class="loading">
              No messages yet.
            </div>
          `;

          return;
        }

        container.innerHTML =
          messages.map(
            (message) => {

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
                <div
                  class="chat-message"
                >

                  <img
                    class="chat-avatar"
                    src="${escapeHTML(
                      avatar
                    )}"
                    alt=""
                    onerror="this.src='/logo.png'"
                  >

                  <div
                    class="chat-content"
                  >

                    <div
                      class="chat-username"
                    >
                      ${escapeHTML(
                        username
                      )}
                    </div>

                    <div
                      class="chat-text"
                    >
                      ${escapeHTML(
                        text
                      )}
                    </div>

                  </div>

                </div>
              `;
            }
          ).join("");

        container.scrollTop =
          container.scrollHeight;
      }
    );
  }

  function setOnlineCount(count) {
    [
      "onlineCount",
      "panelOnlineCount",
      "coinflipOnline"
    ].forEach((id) => {

      const node =
        el(id);

      if (node) {
        node.textContent =
          count;
      }

    });
  }

  async function sendChatMessage(
    input
  ) {
    if (!input) return;

    const text =
      input.value.trim();

    if (!text) return;

    if (!state.user) {
      toast(
        "Verify your Roblox account before chatting."
      );

      openLogin();

      return;
    }

    input.disabled = true;

    try {
      await api(
        "/chat/messages",
        {
          method: "POST",
          body: JSON.stringify({
            username:
              state.user.username,

            userId:
              state.user.id ||
              state.user.userId,

            message:
              text
          })
        }
      );

      input.value = "";

      await loadChat();

    } catch (error) {
      console.error(
        "ADMFLIP send chat:",
        error
      );

      toast(
        error.message ||
        "Unable to send message."
      );

    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function setupChat() {
    el("chatForm")
      ?.addEventListener(
        "submit",
        (event) => {
          event.preventDefault();

          sendChatMessage(
            el("chatInput")
          );
        }
      );

    el("rulesBtn")
      ?.addEventListener(
        "click",
        openRules
      );

    createChatPanel();
    setupMobileChat();
  }

  function createChatPanel() {
    if (el("chatPanel")) return;

    const panel =
      document.createElement(
        "aside"
      );

    panel.id = "chatPanel";
    panel.className =
      "chat-panel";

    panel.innerHTML = `
      <div class="chat-header">

        <div>

          <strong>
            ADMFLIP CHAT
          </strong>

          <span>
            <i class="online-dot"></i>

            <b id="panelOnlineCount">
              --
            </b>

            online
          </span>

        </div>

        <div class="chat-actions">

          <button
            id="rulesBtnPanel"
            class="rules-icon"
            type="button"
          >
            ?
          </button>

          <button
            id="chatClose"
            class="chat-close"
            type="button"
          >
            ×
          </button>

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

        <button
          type="submit"
        >
          Send
        </button>

      </form>
    `;

    document.body.appendChild(
      panel
    );

    el("chatClose")
      ?.addEventListener(
        "click",
        closeChat
      );

    el("rulesBtnPanel")
      ?.addEventListener(
        "click",
        openRules
      );

    el("panelChatForm")
      ?.addEventListener(
        "submit",
        (event) => {
          event.preventDefault();

          sendChatMessage(
            el("panelChatInput")
          );
        }
      );

    panel.style.display =
      "none";
  }

  function setupMobileChat() {
    let button =
      el("mobileChatButton");

    if (!button) {
      button =
        document.createElement(
          "button"
        );

      button.id =
        "mobileChatButton";

      button.className =
        "mobile-chat-button";

      button.type =
        "button";

      button.textContent =
        "Chat";

      document.body.appendChild(
        button
      );
    }

    button.onclick =
      openChat;
  }

  function openChat() {
    const panel =
      el("chatPanel");

    if (!panel) return;

    panel.style.display =
      "flex";

    state.chatOpen = true;

    loadChat();
  }

  function closeChat() {
    const panel =
      el("chatPanel");

    if (!panel) return;

    panel.style.display =
      "none";

    state.chatOpen =
      false;
  }

  /* =======================================================
     INVENTORY
  ======================================================= */

  function openInventory() {
    if (!state.user) {
      toast(
        "Verify your Roblox account first."
      );

      openLogin();

      return;
    }

    const modal =
      createModal(
        "inventoryModal",
        `
          <div
            class="modal-box large"
          >

            <button
              id="closeInventory"
              class="modal-close"
              type="button"
            >
              ×
            </button>

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
        () =>
          closeModal(
            "inventoryModal"
          )
      );

    loadInventory();
  }

  async function loadInventory() {
    const grid =
      el("inventoryGrid");

    if (!grid) return;

    try {
      const userId =
        state.user.id ||
        state.user.userId;

      const data =
        await api(
          `/account/${encodeURIComponent(
            userId
          )}`
        );

      const pets =
        Array.isArray(data)
          ? data
          : data?.pets ||
            data?.inventory ||
            data?.items ||
            data?.data ||
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
        pets.map(
          (pet) =>
            petCard(pet)
        ).join("");

    } catch (error) {
      console.error(
        "ADMFLIP inventory:",
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
     RULES
  ======================================================= */

  function openRules() {
    const modal =
      createModal(
        "rulesModal",
        `
          <div
            class="modal-box rules-box"
          >

            <button
              id="closeRules"
              class="modal-close"
              type="button"
            >
              ×
            </button>

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
                Harassment, hate speech and targeted abuse are not allowed.
              </span>
            </div>

            <div class="rule">
              <b>
                02 · No spam
              </b>

              <span>
                Avoid repeated messages, flooding and excessive caps.
              </span>
            </div>

            <div class="rule">
              <b>
                03 · No begging
              </b>

              <span>
                Do not repeatedly ask users for pets or benefits.
              </span>
            </div>

            <div class="rule">
              <b>
                04 · No advertising
              </b>

              <span>
                Unrelated websites and communities are not allowed.
              </span>
            </div>

            <div class="rule">
              <b>
                05 · No scams
              </b>

              <span>
                Do not impersonate staff or intentionally mislead users.
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
        () =>
          closeModal(
            "rulesModal"
          )
      );
  }

  /* =======================================================
     PROFILE
  ======================================================= */

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
            Verify your Roblox account to view your profile.
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
     MODALS
  ======================================================= */

  function createModal(
    id,
    content
  ) {
    let modal = el(id);

    if (modal) {
      modal.innerHTML =
        content;

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
    hide(el(id));
  }

  document.addEventListener(
    "click",
    (event) => {

      if (
        event.target.classList
          .contains("modal")
      ) {
        event.target.classList
          .add("hidden");
      }

    }
  );

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key !== "Escape"
      ) {
        return;
      }

      $$(".modal")
        .forEach((modal) => {
          modal.classList.add(
            "hidden"
          );
        });

      closeChat();
    }
  );

  /* =======================================================
     INIT
  ======================================================= */

  async function init() {
    setupNavigation();
    setupChat();
    setupAccount();
    setupCreateCoinflip();
    setupValueSearch();

    loadSavedUser();

    await Promise.allSettled([
      loadValues(),
      loadCoinflips(),
      loadChat()
    ]);

    setInterval(
      () => {

        if (
          state.page ===
          "coinflip"
        ) {
          loadCoinflips();
        }

        if (
          state.page ===
            "chat" ||
          state.chatOpen
        ) {
          loadChat();
        }

      },
      15000
    );
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
