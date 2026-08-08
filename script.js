```javascript
(() => {
  "use strict";

  /*
    ============================================================
    ADMFLIP FRONTEND
    ============================================================

    IMPORTANT:
    Roblox is NEVER requested directly by the browser.

    All Roblox requests go through the Express backend:
      /user/:username
      /check
      /roblox-avatar/:id
      /pets
      /pet-image/:name

    CHANGE THIS URL if your frontend is hosted separately
    from your backend.
  */

  const BACKEND = window.ADMFLIP_BACKEND || "";

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

  const $ = selector =>
    document.querySelector(selector);

  const $$ = selector =>
    [...document.querySelectorAll(selector)];

  const el = id =>
    document.getElementById(id);

  function show(node) {
    if (node) {
      node.classList.remove("hidden");
    }
  }

  function hide(node) {
    if (node) {
      node.classList.add("hidden");
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

  function formatNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number.toLocaleString("en-US")
      : "0";
  }

  function formatValue(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
      return "0";
    }

    if (number >= 1000000000) {
      return `${(
        number / 1000000000
      ).toFixed(
        number >= 10000000000 ? 0 : 1
      )}B`;
    }

    if (number >= 1000000) {
      return `${(
        number / 1000000
      ).toFixed(
        number >= 10000000 ? 0 : 1
      )}M`;
    }

    if (number >= 1000) {
      return `${(
        number / 1000
      ).toFixed(
        number >= 100000 ? 0 : 1
      )}K`;
    }

    return number.toLocaleString("en-US");
  }

  function petName(pet) {
    if (typeof pet === "string") {
      return pet;
    }

    return (
      pet?.name ||
      pet?.petName ||
      pet?.itemName ||
      pet?.displayName ||
      "Unknown Pet"
    );
  }

  function petValue(pet) {
    if (typeof pet === "string") {
      return 0;
    }

    return (
      pet?.value ??
      pet?.normalValue ??
      pet?.worth ??
      pet?.price ??
      0
    );
  }

  function petImage(pet) {
    const name = petName(pet);

    if (!name || name === "Unknown Pet") {
      return "/logo.png";
    }

    return `${BACKEND}/pet-image/${encodeURIComponent(name)}`;
  }

  function robloxAvatar(id) {
    if (!id) {
      return "/logo.png";
    }

    return `${BACKEND}/roblox-avatar/${encodeURIComponent(id)}`;
  }

  /*
    ============================================================
    API
    ============================================================
  */

  async function api(endpoint, options = {}) {
    const cleanPath =
      String(endpoint || "").startsWith("/")
        ? String(endpoint)
        : `/${String(endpoint)}`;

    const url =
      `${BACKEND}${cleanPath}`;

    let response;

    try {
      response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,

        headers: {
          ...(options.body
            ? {
                "Content-Type":
                  "application/json"
              }
            : {}),

          ...(options.headers || {})
        }
      });
    } catch (error) {
      console.error(
        "ADMFLIP backend connection error:",
        error
      );

      throw new Error(
        "Backend is unreachable. Check your backend URL."
      );
    }

    const text =
      await response.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        data &&
        typeof data === "object"
          ? (
              data.message ||
              data.error
            )
          : null;

      throw new Error(
        message ||
        `Request failed (${response.status})`
      );
    }

    return data;
  }

  /*
    ============================================================
    ROBLOX
    ============================================================
  */

  async function robloxLookup(username) {
    const clean =
      String(username || "").trim();

    if (!clean) {
      throw new Error(
        "Enter your Roblox username."
      );
    }

    /*
      IMPORTANT:
      This MUST call our backend.
      Never put users.roblox.com here.
    */

    const data =
      await api(
        `/user/${encodeURIComponent(clean)}`
      );

    const user =
      data?.user ||
      data?.data ||
      data;

    if (!user?.id) {
      throw new Error(
        "Roblox user was not returned by the server."
      );
    }

    return user;
  }

  /*
    ============================================================
    VALUES
    ============================================================
  */

  async function loadValues() {
    const grid =
      el("valuesGrid");

    if (!grid) {
      return;
    }

    grid.innerHTML =
      `<div class="loading">Loading values...</div>`;

    try {
      const data =
        await api("/pets");

      const pets =
        Array.isArray(data)
          ? data
          : (
              data?.pets ||
              data?.values ||
              data?.items ||
              data?.data ||
              []
            );

      state.pets = pets;

      renderValues(pets);

    } catch (error) {
      console.error(
        "ADMFLIP pets error:",
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
    const grid =
      el("valuesGrid");

    if (!grid) {
      return;
    }

    if (!pets.length) {
      grid.innerHTML =
        `<div class="loading">No pets found.</div>`;

      return;
    }

    grid.innerHTML =
      pets
        .map(petCard)
        .join("");
  }

  function petCard(pet) {
    const name =
      petName(pet);

    const value =
      petValue(pet);

    const image =
      petImage(pet);

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
            if(!this.dataset.failed){
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
          <span>Value</span>

          <strong class="pet-value">
            ${escapeHTML(
              formatValue(value)
            )}
          </strong>
        </div>

      </article>
    `;
  }

  /*
    ============================================================
    VALUE SEARCH
    ============================================================
  */

  function setupValueSearch() {
    const input =
      el("valueSearch");

    if (!input) {
      return;
    }

    input.addEventListener(
      "input",
      () => {
        const query =
          input.value
            .trim()
            .toLowerCase();

        $$("#valuesGrid .pet-card")
          .forEach(card => {
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

  /*
    ============================================================
    LOGIN
    ============================================================
  */

  function openLogin() {
    const modal =
      el("loginModal");

    if (!modal) {
      console.error(
        "loginModal element missing"
      );

      return;
    }

    show(modal);

    const input =
      el("username");

    if (input) {
      input.value = "";

      setTimeout(
        () => input.focus(),
        50
      );
    }

    hide(
      el("loginProfile")
    );

    hide(
      el("phrase")
    );

    const verify =
      el("verify");

    if (verify) {
      verify.style.display =
        "none";

      verify.disabled =
        false;
    }

    const message =
      el("loginMessage");

    if (message) {
      message.textContent = "";
    }
  }

  function makeVerificationPhrase() {
    const words = [
      "silver",
      "tiger",
      "nova",
      "pixel",
      "shadow",
      "comet",
      "ember",
      "frost",
      "orbit",
      "rocket",
      "storm",
      "velvet",
      "lunar",
      "maple",
      "swift",
      "cosmic",
      "prism",
      "thunder",
      "cobalt",
      "sunset",
      "raven",
      "mint",
      "blaze"
    ];

    const pick =
      () =>
        words[
          Math.floor(
            Math.random() *
            words.length
          )
        ];

    const number =
      String(
        Math.floor(
          1000 +
          Math.random() *
          9000
        )
      );

    return `admflip-${pick()}-${pick()}-${number}`;
  }

  async function startVerification() {
    const input =
      el("username");

    const message =
      el("loginMessage");

    if (!input) {
      return;
    }

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
        "Searching Roblox...";
    }

    try {
      const robloxUser =
        await robloxLookup(
          username
        );

      state.verification = {
        username:
          robloxUser.name ||
          username,

        robloxUser,

        phrase:
          makeVerificationPhrase()
      };

      renderLoginProfile(
        robloxUser
      );

      renderPhrase(
        state.verification.phrase
      );

      const verify =
        el("verify");

      if (verify) {
        verify.style.display =
          "block";

        verify.disabled =
          false;

        verify.textContent =
          "Verify";
      }

      if (message) {
        message.textContent =
          "Put the exact phrase into your Roblox profile About/Bio, then click Verify.";
      }

    } catch (error) {
      console.error(
        "ADMFLIP Roblox lookup:",
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
    const box =
      el("loginProfile");

    if (!box) {
      return;
    }

    const username =
      user.username ||
      user.name ||
      "Roblox User";

    const userId =
      user.id ||
      user.userId ||
      "";

    const avatar =
      robloxAvatar(userId);

    box.innerHTML = `
      <div class="login-profile-inner">

        <img
          src="${escapeHTML(avatar)}"
          alt="${escapeHTML(username)}"
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
    const box =
      el("phrase");

    if (!box) {
      return;
    }

    box.innerHTML = `
      <div class="phrase-label">
        VERIFICATION PHRASE
      </div>

      <strong>
        ${escapeHTML(phrase)}
      </strong>

      <p>
        Copy this exact phrase into your Roblox profile About/Bio.
      </p>
    `;

    show(box);
  }

  async function verifyRobloxBio() {
    const message =
      el("loginMessage");

    const button =
      el("verify");

    if (
      !state.verification?.robloxUser?.id ||
      !state.verification?.phrase
    ) {
      if (message) {
        message.textContent =
          "Search for your Roblox username first.";
      }

      return;
    }

    if (button) {
      button.disabled =
        true;

      button.textContent =
        "Checking...";
    }

    try {
      const account =
        await api("/check", {
          method: "POST",

          body:
            JSON.stringify({
              username:
                state.verification.username,

              userId:
                state.verification.robloxUser.id,

              phrase:
                state.verification.phrase
            })
        });

      if (!account?.success) {
        throw new Error(
          account?.message ||
          "Verification failed."
        );
      }

      state.user = {
        username:
          account.username ||
          state.verification.username,

        id:
          account.id ||
          state.verification.robloxUser.id,

        avatar:
          robloxAvatar(
            account.id ||
            state.verification.robloxUser.id
          ),

        verified: true
      };

      saveUser();
      updateAccountUI();

      closeModal(
        "loginModal"
      );

      toast(
        `Verified as ${state.user.username}`
      );

    } catch (error) {
      console.error(
        "ADMFLIP verification:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Verification failed.";
      }

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "Verify";
      }
    }
  }

  /*
    ============================================================
    ACCOUNT
    ============================================================
  */

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
      state.user =
        null;
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

    if (avatar) {
      avatar.src =
        state.user.avatar ||
        robloxAvatar(
          state.user.id
        );
    }
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

    toast(
      "Signed out."
    );
  }

  /*
    ============================================================
    NAVIGATION
    ============================================================
  */

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

    Object.entries(pages)
      .forEach(
        ([name, id]) => {
          const node =
            el(id);

          if (node) {
            node.classList.toggle(
              "hidden",
              name !== page
            );
          }
        }
      );

    if (page === "values") {
      loadValues();
    }

    if (
      location.hash !==
      `#${page}`
    ) {
      history.replaceState(
        null,
        "",
        `#${page}`
      );
    }
  }

  function setupNavigation() {
    $$(".nav-item")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            openPage(
              button.dataset.page
            );
          }
        );
      });

    $$(".brand")
      .forEach(brand => {
        brand.addEventListener(
          "click",
          event => {
            event.preventDefault();
            openPage("coinflip");
          }
        );
      });

    window.addEventListener(
      "hashchange",
      () => {
        const page =
          location.hash
            .replace("#", "") ||
          "coinflip";

        if (pages[page]) {
          openPage(page);
        }
      }
    );

    const initial =
      location.hash
        .replace("#", "") ||
      "coinflip";

    openPage(
      pages[initial]
        ? initial
        : "coinflip"
    );
  }

  /*
    ============================================================
    HELPERS
    ============================================================
  */

  function toast(message) {
    const box =
      el("toast");

    if (!box) {
      return;
    }

    box.textContent =
      message;

    box.classList.add(
      "show"
    );

    clearTimeout(
      box._timeout
    );

    box._timeout =
      setTimeout(
        () =>
          box.classList.remove(
            "show"
          ),
        2500
      );
  }

  function closeModal(id) {
    hide(
      el(id)
    );
  }

  /*
    ============================================================
    EVENTS
    ============================================================
  */

  function setupAccount() {
    el("loginBtn")
      ?.addEventListener(
        "click",
        openLogin
      );

    el("logoutBtn")
      ?.addEventListener(
        "click",
        logout
      );

    el("closeLogin")
      ?.addEventListener(
        "click",
        () =>
          closeModal(
            "loginModal"
          )
      );

    el("username")
      ?.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
            "Enter"
          ) {
            event.preventDefault();
            startVerification();
          }
        }
      );

    el("continueLogin")
      ?.addEventListener(
        "click",
        startVerification
      );

    el("startLogin")
      ?.addEventListener(
        "click",
        startVerification
      );

    el("verify")
      ?.addEventListener(
        "click",
        verifyRobloxBio
      );
  }

  document.addEventListener(
    "click",
    event => {
      if (
        event.target.classList
          ?.contains("modal")
      ) {
        event.target.classList.add(
          "hidden"
        );
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        $$(".modal")
          .forEach(
            modal =>
              modal.classList.add(
                "hidden"
              )
          );
      }
    }
  );

  /*
    ============================================================
    INIT
    ============================================================
  */

  function init() {
    setupNavigation();
    setupAccount();
    setupValueSearch();
    loadSavedUser();

    /*
      Load values immediately so the values page
      is ready when opened.
    */
    loadValues();
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
```
