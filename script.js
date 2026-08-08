/* ADMFLIP script.js - fixed frontend login + chat */

(() => {
  "use strict";

  const state = {
    roblox: null,
    phrase: null,
    loginBusy: false
  };

  const $ = (s, root = document) => root.querySelector(s);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getBackendBase() {
    const configured =
      window.ADMFLIP_API ||
      document.body?.dataset?.api ||
      "";

    return configured ? String(configured).replace(/\/+$/, "") : "";
  }

  async function api(path, options = {}) {
    const response = await fetch(getBackendBase() + path, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
  }

  function getLoginModal() {
    let modal = $("#admflipLoginModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "admflipLoginModal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-box login-modal-box" role="dialog" aria-modal="true">
        <button class="modal-close" type="button" aria-label="Close" data-login-close>×</button>

        <div class="login-step" data-login-step="username">
          <div class="login-banner-wrap">
            <img class="login-banner" src="/login-banner.png"
                 alt="ADMFLIP Roblox sign in"
                 onerror="this.style.display='none';">
          </div>

          <div class="eyebrow">ACCOUNT</div>
          <h2>Roblox Sign In</h2>
          <p class="muted">Enter your Roblox username to continue.</p>

          <div class="login-search-row">
            <input id="robloxUsernameInput" class="input" type="text"
              maxlength="20" autocomplete="off" autocapitalize="none"
              spellcheck="false" placeholder="Roblox username">
            <button class="primary" type="button" id="robloxFindButton">Continue</button>
          </div>

          <div class="message" id="loginMessage" aria-live="polite"></div>
        </div>

        <div class="login-step hidden" data-login-step="phrase">
          <div class="login-banner-wrap">
            <img class="login-banner" src="/login-banner.png"
                 alt="ADMFLIP Roblox verification">
          </div>

          <div class="eyebrow">VERIFY</div>
          <h2>Verify your Roblox account</h2>
          <p class="muted">Put this temporary phrase in your public Roblox profile bio.</p>

          <div class="login-profile" id="loginProfile"></div>

          <div class="phrase">
            <div class="eyebrow">YOUR PHRASE</div>
            <strong id="verificationPhrase"></strong>
          </div>

          <button class="primary full" type="button" id="verifyRobloxButton" style="margin-top:14px">
            Verify Roblox
          </button>

          <button class="small-button full" type="button" id="backToUsernameButton" style="margin-top:9px">
            Back
          </button>

          <div class="message" id="verifyMessage" aria-live="polite"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function setMessage(el, text, error = false) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = error ? "var(--red)" : "var(--muted)";
  }

  function setLoginStep(step) {
    const modal = getLoginModal();
    modal.querySelectorAll("[data-login-step]").forEach(node => {
      node.classList.toggle("hidden", node.dataset.loginStep !== step);
    });
  }

  function openLogin() {
    const modal = getLoginModal();
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setLoginStep("username");

    const input = $("#robloxUsernameInput", modal);
    setMessage($("#loginMessage", modal), "");
    setMessage($("#verifyMessage", modal), "");

    requestAnimationFrame(() => input?.focus());
  }

  function closeLogin() {
    const modal = $("#admflipLoginModal");
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    state.loginBusy = false;
  }

  async function findRobloxUser() {
    if (state.loginBusy) return;

    const modal = getLoginModal();
    const input = $("#robloxUsernameInput", modal);
    const button = $("#robloxFindButton", modal);
    const message = $("#loginMessage", modal);
    const username = String(input?.value || "").trim();

    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      setMessage(message, "Enter a valid Roblox username.", true);
      input?.focus();
      return;
    }

    state.loginBusy = true;
    button.disabled = true;
    button.textContent = "Searching...";
    setMessage(message, "Finding Roblox user...");

    try {
      /*
       * IMPORTANT:
       * Your backend must expose GET /user/:username and POST /create.
       * If your backend uses /api/user/:username instead, set:
       * <body data-api="/api">
       */
      const data = await api(`/user/${encodeURIComponent(username)}`);

      if (!data.success || !data.user) {
        throw new Error(data.message || "Roblox username not found.");
      }

      state.roblox = data.user;

      const phraseData = await api("/create");
      if (!phraseData.success || !phraseData.phrase) {
        throw new Error("Could not create verification phrase.");
      }

      state.phrase = phraseData.phrase;

      $("#loginProfile", modal).innerHTML = `
        <div class="login-profile-row">
          <img src="${escapeHtml(data.user.avatar || "/roblox.png")}" alt="">
          <div>
            <strong>${escapeHtml(data.user.username)}</strong>
            <span>Roblox ID: ${escapeHtml(data.user.id)}</span>
          </div>
        </div>
      `;

      $("#verificationPhrase", modal).textContent = state.phrase;
      setMessage(
        $("#verifyMessage", modal),
        "Add the phrase to your public Roblox bio, then verify."
      );
      setLoginStep("phrase");
    } catch (error) {
      console.error("Roblox lookup:", error);
      setMessage(
        message,
        error.message || "Roblox could not be reached. Try again.",
        true
      );
    } finally {
      state.loginBusy = false;
      button.disabled = false;
      button.textContent = "Continue";
    }
  }

  async function verifyRoblox() {
    if (state.loginBusy || !state.roblox || !state.phrase) return;

    const modal = getLoginModal();
    const button = $("#verifyRobloxButton", modal);
    const message = $("#verifyMessage", modal);

    state.loginBusy = true;
    button.disabled = true;
    button.textContent = "Checking...";
    setMessage(message, "Checking your public Roblox bio...");

    try {
      const data = await api("/check", {
        method: "POST",
        body: JSON.stringify({
          username: state.roblox.username,
          phrase: state.phrase
        })
      });

      if (!data.success) {
        throw new Error(data.message || "Verification phrase not found.");
      }

      const verifiedUser = {
        id: data.id || state.roblox.id,
        username: data.username || state.roblox.username,
        avatar: data.avatar || state.roblox.avatar || ""
      };

      state.roblox = verifiedUser;
      localStorage.setItem("admflipRobloxUser", JSON.stringify(verifiedUser));

      closeLogin();
      applySignedInUser(verifiedUser);

      window.dispatchEvent(new CustomEvent("admflip:login", {
        detail: verifiedUser
      }));
    } catch (error) {
      console.error("Roblox verification:", error);
      setMessage(
        message,
        error.message || "Verification failed. Check your public bio.",
        true
      );
    } finally {
      state.loginBusy = false;
      button.disabled = false;
      button.textContent = "Verify Roblox";
    }
  }

  function applySignedInUser(user) {
    if (!user) return;

    document.querySelectorAll(".login").forEach(button => {
      button.classList.add("hidden");
    });

    let account = $(".account-box");
    if (!account) {
      account = document.createElement("div");
      account.className = "account-box";
      $(".header-right")?.prepend(account);
    }

    account.innerHTML = `
      <button class="profile-button" type="button" id="admflipProfileButton">
        <img src="${escapeHtml(user.avatar || "/roblox.png")}" alt="">
        <span>${escapeHtml(user.username)}</span>
      </button>
      <button class="small-button" type="button" id="admflipLogoutButton">Log out</button>
    `;

    $("#admflipLogoutButton", account)?.addEventListener("click", logout);
  }

  function logout() {
    localStorage.removeItem("admflipRobloxUser");
    state.roblox = null;
    state.phrase = null;

    document.querySelectorAll(".account-box").forEach(node => node.remove());
    document.querySelectorAll(".login").forEach(button => {
      button.classList.remove("hidden");
    });

    window.dispatchEvent(new CustomEvent("admflip:logout"));
  }

  function restoreLogin() {
    try {
      const saved = localStorage.getItem("admflipRobloxUser");
      if (!saved) return;

      const user = JSON.parse(saved);
      if (user && user.id && user.username) {
        state.roblox = user;
        applySignedInUser(user);
      }
    } catch (_) {
      localStorage.removeItem("admflipRobloxUser");
    }
  }

  function setupLoginButtons() {
    document.addEventListener("click", event => {
      const loginButton = event.target.closest(".login");
      if (loginButton) {
        event.preventDefault();
        openLogin();
        return;
      }

      if (event.target.closest("[data-login-close]")) {
        closeLogin();
        return;
      }

      if (event.target.id === "robloxFindButton") {
        findRobloxUser();
        return;
      }

      if (event.target.id === "verifyRobloxButton") {
        verifyRoblox();
        return;
      }

      if (event.target.id === "backToUsernameButton") {
        setLoginStep("username");
        setMessage($("#loginMessage", getLoginModal()), "");
        setTimeout(() => $("#robloxUsernameInput", getLoginModal())?.focus(), 0);
        return;
      }

      const modal = $("#admflipLoginModal");
      if (event.target === modal) closeLogin();
    });

    document.addEventListener("keydown", event => {
      const modal = $("#admflipLoginModal");
      if (!modal || modal.classList.contains("hidden")) return;

      if (event.key === "Escape") closeLogin();

      if (
        event.key === "Enter" &&
        document.activeElement?.id === "robloxUsernameInput"
      ) {
        event.preventDefault();
        findRobloxUser();
      }
    });
  }

  function setupChatToggle() {
    const button = $("#topChatButton");
    const panel = $(".chat-panel");
    const overlay = $(".chat-overlay");
    if (!button || !panel) return;

    const setOpen = open => {
      panel.classList.toggle("open", open);
      overlay?.classList.toggle("open", open);
      button.classList.toggle("active", open);
      button.setAttribute("aria-expanded", String(open));
    };

    button.addEventListener("click", event => {
      event.preventDefault();
      setOpen(!panel.classList.contains("open"));
    });

    overlay?.addEventListener("click", () => setOpen(false));

    document.addEventListener("click", event => {
      if (event.target.closest(".chat-close")) setOpen(false);
    });
  }

  function setupChatSending() {
    const form = $(".chat-form");
    const input = $(".chat-form input");
    if (!form || !input) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const content = input.value.trim();
      if (!content) return;

      const button = form.querySelector("button");
      if (button) button.disabled = true;

      try {
        const data = await api("/chat", {
          method: "POST",
          body: JSON.stringify({
            content,
            username: state.roblox?.username || "Guest",
            userId: state.roblox?.id || null,
            avatar: state.roblox?.avatar || ""
          })
        });

        if (!data.success) {
          throw new Error(data.message || "Message could not be sent.");
        }

        input.value = "";

        window.dispatchEvent(new CustomEvent("admflip:chat-message", {
          detail: data.message || data
        }));

        /*
         * If your existing site has a chat refresh function, use it.
         */
        if (typeof window.loadChat === "function") {
          await window.loadChat();
        }
      } catch (error) {
        console.error("Chat send:", error);
        alert(error.message || "Message could not be sent.");
      } finally {
        if (button) button.disabled = false;
        input.focus();
      }
    });
  }

  function setupMobileViewport() {
    if (!document.querySelector('meta[name="viewport"]')) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
      document.head.appendChild(meta);
    }
  }

  function init() {
    setupMobileViewport();
    setupLoginButtons();
    setupChatToggle();
    setupChatSending();
    restoreLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.ADMFLIP = {
    openLogin,
    closeLogin,
    logout,
    getCurrentUser: () => state.roblox
  };
})();
