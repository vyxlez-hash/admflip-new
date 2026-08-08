(() => {
  "use strict";

  /*
    =========================================================
    ADMFLIP FRONTEND
    =========================================================

    IMPORTANT:

    The frontend and backend are served by the same Express
    server.

    Therefore all API calls use the current origin.

    Browser
       |
       v
    Express backend
       |
       +----> Roblox
       |
       +----> MongoDB
       |
       +----> Pet image source
  */

  const BACKEND = "";

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

  const $ =
    selector =>
      document.querySelector(
        selector
      );

  const $$ =
    selector =>
      [
        ...document.querySelectorAll(
          selector
        )
      ];

  const el =
    id =>
      document.getElementById(
        id
      );

  /* =======================================================
     BASIC HELPERS
  ======================================================= */

  function show(node) {
    if (node) {
      node.classList.remove(
        "hidden"
      );
    }
  }

  function hide(node) {
    if (node) {
      node.classList.add(
        "hidden"
      );
    }
  }

  function escapeHTML(value) {
    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  function formatNumber(
    value
  ) {
    const n =
      Number(value);

    return Number.isFinite(n)
      ? n.toLocaleString()
      : "0";
  }

  function formatValue(
    value
  ) {
    const n =
      Number(value);

    if (
      !Number.isFinite(n) ||
      n <= 0
    ) {
      return "0";
    }

    if (
      n >= 1000000000
    ) {
      return `${(
        n / 1000000000
      ).toFixed(
        n >= 10000000000
          ? 0
          : 1
      )}B`;
    }

    if (
      n >= 1000000
    ) {
      return `${(
        n / 1000000
      ).toFixed(
        n >= 10000000
          ? 0
          : 1
      )}M`;
    }

    if (
      n >= 1000
    ) {
      return `${(
        n / 1000
      ).toFixed(
        n >= 100000
          ? 0
          : 1
      )}K`;
    }

    return n.toLocaleString();
  }

  function petName(
    pet
  ) {
    if (
      typeof pet ===
      "string"
    ) {
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

  function petValue(
    pet
  ) {
    if (
      typeof pet ===
      "string"
    ) {
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

  /*
    Use the backend image proxy.

    This is important because the browser no longer needs
    to directly request images from amvgg.com.
  */

  function petImage(
    pet
  ) {
    const name =
      petName(pet);

    if (!name) {
      return "/logo.png";
    }

    return (
      `${BACKEND}/pet-image/` +
      encodeURIComponent(name)
    );
  }

  function avatarImage(
    user
  ) {
    if (
      user?.avatar
    ) {
      return user.avatar;
    }

    if (
      user?.id
    ) {
      return (
        `${BACKEND}/roblox-avatar/` +
        encodeURIComponent(
          user.id
        )
      );
    }

    return "/logo.png";
  }

  function toast(
    message
  ) {
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
        () => {
          box.classList.remove(
            "show"
          );
        },
        2500
      );
  }

  /* =======================================================
     CENTRAL API FUNCTION
  ======================================================= */

  async function api(
    path,
    options = {}
  ) {
    const cleanPath =
      String(
        path || ""
      ).startsWith("/")
        ? String(path)
        : `/${String(path)}`;

    let response;

    try {
      response =
        await fetch(
          `${BACKEND}${cleanPath}`,
          {
            credentials:
              "include",

            cache:
              "no-store",

            ...options,

            headers: {
              ...(options.body
                ? {
                    "Content-Type":
                      "application/json"
                  }
                : {}),

              ...(options.headers ||
                {})
            }
          }
        );
    } catch (error) {
      console.error(
        "ADMFLIP API connection error:",
        error
      );

      throw new Error(
        "Backend is unreachable. Check that the site server is online."
      );
    }

    const text =
      await response.text();

    let data = null;

    try {
      data =
        text
          ? JSON.parse(text)
          : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        data &&
        typeof data ===
          "object"
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

  /* =======================================================
     PAGES
  ======================================================= */

  const pages = {
    coinflip:
      "coinflipPage",

    leaderboard:
      "leaderboardPage",

    values:
      "valuesPage",

    chat:
      "chatPage",

    profile:
      "profilePage"
  };

  function openPage(
    page
  ) {
    if (
      !pages[page]
    ) {
      page =
        "coinflip";
    }

    state.page =
      page;

    Object.entries(
      pages
    ).forEach(
      ([name, id]) => {
        const node =
          el(id);

        if (!node) {
          return;
        }

        if (
          name === page
        ) {
          show(node);
        } else {
          hide(node);
        }
      }
    );

    $$(
      "[data-page]"
    ).forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        );
      }
    );

    if (
      page ===
      "values"
    ) {
      loadValues();
    }

    if (
      page ===
      "leaderboard"
    ) {
      loadLeaderboard();
    }

    if (
      page ===
      "chat"
    ) {
      loadChat();
    }

    if (
      page ===
      "profile"
    ) {
      loadAccount();
    }
  }

  /* =======================================================
     LOGIN
  ======================================================= */

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
        () =>
          input.focus(),
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
      message.textContent =
        "";
    }

    setupLoginEvents();
  }

  function closeModal(
    id
  ) {
    hide(
      el(id)
    );
  }

  let loginEventsBound =
    false;

  function setupLoginEvents() {
    if (
      loginEventsBound
    ) {
      return;
    }

    loginEventsBound =
      true;

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

  /* =======================================================
     VERIFICATION PHRASE
  ======================================================= */

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

    return (
      `admflip-${pick()}-${pick()}-${number}`
    );
  }

  /* =======================================================
     ROBLOX LOOKUP
  ======================================================= */

  /*
    IMPORTANT:

    OLD CODE:

      Browser -> users.roblox.com

    NEW CODE:

      Browser -> our /user/:username endpoint
               -> Express
               -> Roblox

    This fixes:

      "Roblox could not be reached from this browser."
  */

  async function robloxLookup(
    username
  ) {
    const clean =
      String(
        username || ""
      ).trim();

    if (!clean) {
      throw new Error(
        "Enter your Roblox username."
      );
    }

    let data;

    try {
      data =
        await api(
          `/user/${encodeURIComponent(
            clean
          )}`
        );
    } catch (error) {
      console.error(
        "Roblox lookup failed:",
        error
      );

      throw new Error(
        error.message ||
        "Could not find that Roblox user."
      );
    }

    if (
      !data?.success ||
      !data?.user
    ) {
      throw new Error(
        data?.message ||
        "No Roblox user found."
      );
    }

    return data.user;
  }

  /* =======================================================
     START VERIFICATION
  ======================================================= */

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

    const verify =
      el("verify");

    const profile =
      el("loginProfile");

    const phrase =
      el("phrase");

    try {
      if (message) {
        message.textContent =
          "Finding Roblox account...";
      }

      if (verify) {
        verify.disabled =
          true;
      }

      const user =
        await robloxLookup(
          username
        );

      const verificationPhrase =
        makeVerificationPhrase();

      state.verification = {
        username:
          user.username,

        id:
          user.id,

        phrase:
          verificationPhrase
      };

      state.user =
        user;

      if (profile) {
        show(profile);

        const profileAvatar =
          profile.querySelector(
            "img"
          );

        if (
          profileAvatar
        ) {
          profileAvatar.src =
            avatarImage(
              user
            );
        }

        const profileName =
          profile.querySelector(
            "[data-username]"
          );

        if (
          profileName
        ) {
          profileName.textContent =
            user.username;
        }
      }

      if (phrase) {
        phrase.textContent =
          verificationPhrase;

        show(phrase);
      }

      if (verify) {
        verify.style.display =
          "block";

        verify.disabled =
          false;
      }

      if (message) {
        message.textContent =
          "Add the phrase above to your Roblox bio, then click Verify.";
      }
    } catch (error) {
      console.error(
        "Start verification:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Could not find your Roblox account.";
      }

      if (verify) {
        verify.disabled =
          false;
      }
    }
  }

  /* =======================================================
     VERIFY ROBLOX BIO
  ======================================================= */

  async function verifyRobloxBio() {
    const message =
      el("loginMessage");

    const verify =
      el("verify");

    if (
      !state.verification
    ) {
      if (message) {
        message.textContent =
          "Start the verification first.";
      }

      return;
    }

    try {
      if (verify) {
        verify.disabled =
          true;
      }

      if (message) {
        message.textContent =
          "Checking your Roblox bio...";
      }

      const data =
        await api(
          "/check",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                username:
                  state
                    .verification
                    .username,

                phrase:
                  state
                    .verification
                    .phrase
              })
          }
        );

      if (
        !data?.success
      ) {
        throw new Error(
          data?.message ||
          "Verification failed."
        );
      }

      state.user =
        data.user;

      try {
        localStorage.setItem(
          "admflip_user",
          JSON.stringify(
            state.user
          )
        );
      } catch {}

      updateAccountUI();

      closeModal(
        "loginModal"
      );

      toast(
        "Roblox account verified!"
      );
    } catch (error) {
      console.error(
        "Verification:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Verification failed.";
      }

      if (verify) {
        verify.disabled =
          false;
      }
    }
  }

  /* =======================================================
     ACCOUNT UI
  ======================================================= */

  function updateAccountUI() {
    const loginBtn =
      el("loginBtn");

    const logoutBtn =
      el("logoutBtn");

    const profileBtn =
      el("profileBtn");

    const inventoryBtn =
      el("inventoryBtn");

    if (
      state.user
    ) {
      hide(loginBtn);

      show(logoutBtn);
      show(profileBtn);
      show(inventoryBtn);
    } else {
      show(loginBtn);

      hide(logoutBtn);
      hide(profileBtn);
      hide(inventoryBtn);
    }

    const usernameNodes =
      $$(
        "[data-account-username]"
      );

    usernameNodes.forEach(
      node => {
        node.textContent =
          state.user
            ?.username ||
          "Guest";
      }
    );

    const avatarNodes =
      $$(
        "[data-account-avatar]"
      );

    avatarNodes.forEach(
      node => {
        node.src =
          avatarImage(
            state.user
          );
      }
    );
  }

  function logout() {
    state.user =
      null;

    state.verification =
      null;

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
        () =>
          openPage(
            "profile"
          )
      );
  }

  function openInventory() {
    if (
      !state.user
    ) {
      openLogin();
      return;
    }

    openPage(
      "profile"
    );
  }

  async function loadAccount() {
    if (
      !state.user?.id
    ) {
      return;
    }

    try {
      const data =
        await api(
          `/account/${encodeURIComponent(
            state.user.id
          )}`
        );

      if (
        data?.success &&
        data?.user
      ) {
        state.user =
          {
            ...state.user,
            ...data.user
          };

        try {
          localStorage.setItem(
            "admflip_user",
            JSON.stringify(
              state.user
            )
          );
        } catch {}

        updateAccountUI();

        renderProfile(
          state.user
        );
      }
    } catch (error) {
      console.error(
        "Account load:",
        error
      );
    }
  }

  function renderProfile(
    user
  ) {
    const username =
      el("profileUsername");

    const avatar =
      el("profileAvatar");

    const balance =
      el("profileBalance");

    const wagered =
      el("profileWagered");

    const profit =
      el("profileProfit");

    if (username) {
      username.textContent =
        user.username ||
        "User";
    }

    if (avatar) {
      avatar.src =
        avatarImage(user);
    }

    if (balance) {
      balance.textContent =
        formatValue(
          user.balance
        );
    }

    if (wagered) {
      wagered.textContent =
        formatValue(
          user.wagered
        );
    }

    if (profit) {
      profit.textContent =
        formatValue(
          user.profit
        );
    }

    const inventory =
      user.inventory ||
      [];

    const inventoryGrid =
      el(
        "inventoryGrid"
      );

    if (!inventoryGrid) {
      return;
    }

    if (
      !inventory.length
    ) {
      inventoryGrid.innerHTML =
        `<div class="loading">No pets in inventory.</div>`;

      return;
    }

    inventoryGrid.innerHTML =
      inventory
        .map(
          item => `
            <article class="pet-card">
              <img
                class="pet-image"
                src="${escapeHTML(
                  petImage(
                    item
                  )
                )}"
                alt="${escapeHTML(
                  petName(
                    item
                  )
                )}"
                loading="lazy"
                onerror="this.src='/logo.png'"
              >

              <div class="pet-name">
                ${escapeHTML(
                  petName(item)
                )}
              </div>

              <div class="pet-meta">
                <span>Value</span>

                <strong>
                  ${formatValue(
                    petValue(item)
                  )}
                </strong>
              </div>
            </article>
          `
        )
        .join("");
  }

  /* =======================================================
     VALUES
  ======================================================= */

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
        await api(
          "/pets"
        );

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

      /*
        Normalize values here as a second layer of
        protection in case an older backend returns
        string values.
      */

      state.pets =
        pets.map(
          pet => {
            if (
              typeof pet ===
              "string"
            ) {
              return {
                name: pet,
                value: 0,
                image:
                  petImage(pet)
              };
            }

            return {
              ...pet,

              value:
                normalizeFrontendValue(
                  pet.value
                ),

              image:
                pet.image ||
                petImage(pet)
            };
          }
        );

      renderValues(
        state.pets
      );
    } catch (error) {
      console.error(
        "ADMFLIP pets:",
        error
      );

      grid.innerHTML =
        `<div class="loading">Values are currently unavailable.</div>`;
    }
  }

  function normalizeFrontendValue(
    value
  ) {
    if (
      typeof value ===
      "number"
    ) {
      return Number.isFinite(
        value
      )
        ? value
        : 0;
    }

    if (
      value === undefined ||
      value === null
    ) {
      return 0;
    }

    const text =
      String(value)
        .trim()
        .replace(/\s+/g, "");

    if (
      /^\d{1,3}(?:\.\d{3})+$/.test(
        text
      )
    ) {
      return Number(
        text.replace(
          /\./g,
          ""
        )
      );
    }

    if (
      /^\d{1,3}(?:,\d{3})+$/.test(
        text
      )
    ) {
      return Number(
        text.replace(
          /,/g,
          ""
        )
      );
    }

    const n =
      Number(
        text.replace(
          /,/g,
          ""
        )
      );

    return Number.isFinite(n)
      ? n
      : 0;
  }

  function renderValues(
    pets
  ) {
    const grid =
      el("valuesGrid");

    if (!grid) {
      return;
    }

    if (
      !pets.length
    ) {
      grid.innerHTML =
        `<div class="loading">No pets found.</div>`;

      return;
    }

    grid.innerHTML =
      pets
        .map(petCard)
        .join("");
  }

  function petCard(
    pet
  ) {
    const name =
      petName(pet);

    const image =
      petImage(pet);

    const value =
      petValue(pet);

    const rarity =
      pet?.rarity ||
      pet?.type ||
      "";

    return `
      <article
        class="pet-card"
        data-pet-name="${escapeHTML(
          name
        )}"
      >
        <img
          class="pet-image"
          src="${escapeHTML(
            image
          )}"
          alt="${escapeHTML(
            name
          )}"
          loading="lazy"
          onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='/logo.png'}"
        >

        <div class="pet-name">
          ${escapeHTML(
            name
          )}
        </div>

        ${
          rarity
            ? `
              <div class="pet-rarity">
                ${escapeHTML(
                  rarity
                )}
              </div>
            `
            : ""
        }

        <div class="pet-meta">
          <span>Value</span>

          <strong
            class="pet-value"
            title="${escapeHTML(
              Number(
                value || 0
              ).toLocaleString()
            )}"
          >
            ${formatValue(
              value
            )}
          </strong>
        </div>
      </article>
    `;
  }

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
          .forEach(
            card => {
              const name =
                card.dataset
                  .petName
                  ?.toLowerCase() ||
                "";

              card.style.display =
                !query ||
                name.includes(
                  query
                )
                  ? ""
                  : "none";
            }
          );
      }
    );
  }

  /* =======================================================
     LEADERBOARD
  ======================================================= */

  async function loadLeaderboard() {
    const container =
      el("leaderboard");

    if (!container) {
      return;
    }

    container.innerHTML =
      `<div class="loading">Loading leaderboard...</div>`;

    try {
      const data =
        await api(
          "/leaderboard"
        );

      const players =
        Array.isArray(data)
          ? data
          : (
              data?.players ||
              data?.users ||
              data?.leaderboard ||
              data?.data ||
              []
            );

      renderLeaderboard(
        players
      );
    } catch (error) {
      console.error(
        "Leaderboard:",
        error
      );

      container.innerHTML =
        `<div class="loading">Unable to load leaderboard.</div>`;
    }
  }

  function renderLeaderboard(
    players
  ) {
    const container =
      el("leaderboard");

    if (!container) {
      return;
    }

    if (
      !players.length
    ) {
      container.innerHTML =
        `<div class="loading">No leaderboard data yet.</div>`;

      return;
    }

    container.innerHTML =
      players
        .map(
          (
            player,
            index
          ) => {
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
          }
        )
        .join("");
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
          : (
              data?.messages ||
              data?.data ||
              []
            );

      renderChat(
        messages
      );

      try {
        const online =
          await api(
            "/chat/online"
          );

        setOnlineCount(
          online?.online ??
          online?.count ??
          online?.onlineCount ??
          online ??
          "--"
        );
      } catch {
        setOnlineCount(
          "--"
        );
      }
    } catch (error) {
      console.error(
        "ADMFLIP chat:",
        error
      );

      renderChat([]);
    }
  }

  function setOnlineCount(
    value
  ) {
    [
      el("onlineCount"),
      el("chatOnline"),
      el("chatOnlineCount")
    ]
      .filter(Boolean)
      .forEach(
        node => {
          node.textContent =
            formatNumber(
              value
            );
        }
      );
  }

  function renderChat(
    messages
  ) {
    const containers =
      [
        el("chatMessages"),
        el(
          "panelChatMessages"
        )
      ].filter(Boolean);

    containers.forEach(
      container => {
        if (
          !messages.length
        ) {
          container.innerHTML =
            `<div class="loading">No messages yet.</div>`;

          return;
        }

        container.innerHTML =
          messages
            .map(
              message => {
                const username =
                  message.username ||
                  message.user
                    ?.username ||
                  "User";

                const avatar =
                  message.avatar ||
                  message.user
                    ?.avatar ||
                  "/logo.png";

                const text =
                  message.text ||
                  message.message ||
                  "";

                const pinned =
                  Boolean(
                    message.pinned
                  ) ||
                  message.type ===
                    "announcement";

                if (pinned) {
                  return `
                    <div class="chat-message chat-announcement">
                      <div>
                        <div class="chat-announcement-pin">
                          📌 PINNED
                        </div>

                        <div class="chat-username">
                          ${escapeHTML(
                            username
                          )}
                        </div>

                        <div class="chat-text">
                          ${escapeHTML(
                            text
                          )}
                        </div>
                      </div>
                    </div>
                  `;
                }

                return `
                  <div class="chat-message">
                    <img
                      class="chat-avatar"
                      src="${escapeHTML(
                        avatar
                      )}"
                      alt=""
                      onerror="this.src='/logo.png'"
                    >

                    <div class="chat-content">
                      <div class="chat-username">
                        ${escapeHTML(
                          username
                        )}
                      </div>

                      <div class="chat-text">
                        ${escapeHTML(
                          text
                        )}
                      </div>
                    </div>
                  </div>
                `;
              }
            )
            .join("");
      }
    );
  }

  async function sendChat(
    input
  ) {
    if (
      !state.user
    ) {
      openLogin();
      return;
    }

    const message =
      String(
        input?.value ||
          ""
      ).trim();

    if (!message) {
      return;
    }

    try {
      await api(
        "/chat/messages",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              robloxId:
                state.user.id,

              username:
                state.user.username,

              avatar:
                state.user.avatar ||
                "",

              message
            })
        }
      );

      input.value =
        "";

      await loadChat();
    } catch (error) {
      toast(
        error.message ||
        "Could not send message."
      );
    }
  }

  function setupChat() {
    const sendButtons =
      [
        el("sendChat"),
        el("sendChatBtn"),
        el("panelSendChat")
      ].filter(Boolean);

    const inputs =
      [
        el("chatInput"),
        el("panelChatInput")
      ].filter(Boolean);

    sendButtons.forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const input =
              inputs[0];

            sendChat(
              input
            );
          }
        );
      }
    );

    inputs.forEach(
      input => {
        input.addEventListener(
          "keydown",
          event => {
            if (
              event.key ===
              "Enter"
            ) {
              event.preventDefault();

              sendChat(
                input
              );
            }
          }
        );
      }
    );
  }

  /* =======================================================
     COINFLIPS
  ======================================================= */

  async function loadCoinflips() {
    const container =
      el("coinflips");

    if (!container) {
      return;
    }

    try {
      const data =
        await api(
          "/coinflips"
        );

      const flips =
        Array.isArray(data)
          ? data
          : (
              data?.coinflips ||
              data?.flips ||
              data?.data ||
              []
            );

      state.coinflips =
        flips;

      renderCoinflips(
        flips
      );

      const active =
        el("activeCount");

      if (active) {
        active.textContent =
          formatNumber(
            flips.length
          );
      }

      const total =
        flips.reduce(
          (
            sum,
            flip
          ) => {
            const pet =
              flip.pet ||
              flip.item ||
              {};

            const raw =
              flip.totalValue ??
              flip.value ??
              flip.petValue ??
              pet.value ??
              pet.val ??
              0;

            const value =
              normalizeFrontendValue(
                raw
              );

            return (
              sum +
              (
                Number.isFinite(
                  value
                )
                  ? value
                  : 0
              )
            );
          },
          0
        );

      const totalNode =
        el("totalValue");

      if (totalNode) {
        totalNode.textContent =
          formatValue(
            total
          );

        totalNode.title =
          `${total.toLocaleString()} total value`;
      }

      const online =
        data?.coinflippingNow ??
        data?.coinflipping ??
        data?.online ??
        data?.onlineCount ??
        flips.length;

      const onlineNode =
        el(
          "coinflipOnline"
        );

      if (onlineNode) {
        onlineNode.textContent =
          formatNumber(
            online
          );
      }
    } catch (error) {
      console.error(
        "ADMFLIP coinflips:",
        error
      );

      container.innerHTML =
        `<div class="loading">Unable to load coinflips right now.</div>`;

      const active =
        el("activeCount");

      const total =
        el("totalValue");

      const online =
        el("coinflipOnline");

      if (active) {
        active.textContent =
          "0";
      }

      if (total) {
        total.textContent =
          "0";
      }

      if (online) {
        online.textContent =
          "0";
      }
    }
  }

  function renderCoinflips(
    flips
  ) {
    const container =
      el("coinflips");

    if (!container) {
      return;
    }

    if (
      !flips.length
    ) {
      container.innerHTML =
        `<div class="loading">No active coinflips.</div>`;

      return;
    }

    container.innerHTML =
      flips
        .map(
          flip => {
            const username =
              flip.username ||
              flip.user
                ?.username ||
              "Player";

            const pet =
              flip.pet ||
              flip.item ||
              {
                name:
                  flip.petName ||
                  "Pet",

                value:
                  flip.petValue ||
                  0,

                image:
                  flip.image ||
                  ""
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
              <article class="coinflip">

                <div class="cf-users">
                  <span>
                    ${escapeHTML(
                      username
                    )}
                  </span>

                  <span>
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
                        onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='/logo.png'}"
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

                    <small>
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
          }
        )
        .join("");
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function setupNavigation() {
    $$(
      "[data-page]"
    ).forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            openPage(
              button.dataset.page
            );
          }
        );
      }
    );
  }

  /* =======================================================
     STATUS
  ======================================================= */

  async function loadStatus() {
    try {
      const data =
        await api(
          "/status"
        );

      const online =
        data?.online ??
        data?.onlineCount ??
        0;

      const active =
        data?.activeCount ??
        0;

      const total =
        data?.totalValue ??
        0;

      [
        el("onlineCount"),
        el("online"),
        el("siteOnlineCount")
      ]
        .filter(Boolean)
        .forEach(
          node => {
            node.textContent =
              formatNumber(
                online
              );
          }
        );

      if (
        el("activeCount") &&
        !state.coinflips.length
      ) {
        el(
          "activeCount"
        ).textContent =
          formatNumber(
            active
          );
      }

      if (
        el("totalValue") &&
        !state.coinflips.length
      ) {
        el(
          "totalValue"
        ).textContent =
          formatValue(
            total
          );
      }
    } catch (error) {
      console.error(
        "Status:",
        error
      );
    }
  }

  /* =======================================================
     LOCAL STORAGE
  ======================================================= */

  function restoreUser() {
    try {
      const raw =
        localStorage.getItem(
          "admflip_user"
        );

      if (!raw) {
        return;
      }

      const user =
        JSON.parse(raw);

      if (
        user &&
        user.id &&
        user.username
      ) {
        state.user =
          user;

        updateAccountUI();
      }
    } catch (error) {
      console.warn(
        "Could not restore user:",
        error
      );

      try {
        localStorage.removeItem(
          "admflip_user"
        );
      } catch {}
    }
  }

  /* =======================================================
     INIT
  ======================================================= */

  async function init() {
    setupNavigation();

    setupAccount();

    setupLoginEvents();

    setupValueSearch();

    setupChat();

    restoreUser();

    openPage(
      "coinflip"
    );

    await Promise.allSettled(
      [
        loadStatus(),
        loadValues(),
        loadCoinflips(),
        loadLeaderboard(),
        loadChat()
      ]
    );

    /*
      Refresh live information periodically.
    */

    setInterval(
      () => {
        loadStatus();
        loadCoinflips();
      },
      10000
    );

    /*
      Reload values periodically so changing
      values.txt becomes visible without a
      browser refresh.
    */

    setInterval(
      () => {
        loadValues();
      },
      60000
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
