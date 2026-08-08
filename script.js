(() => {
"use strict";

/*
  Set this to your actual backend URL.
  The backend must provide the endpoints listed below.
*/
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

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = id => document.getElementById(id);

function show(node){ if(node) node.classList.remove("hidden"); }
function hide(node){ if(node) node.classList.add("hidden"); }

function escapeHTML(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function formatValue(value){
  if(value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isNaN(n) ? escapeHTML(value) : n.toLocaleString();
}

function petName(pet){
  if(typeof pet === "string") return pet;
  return pet?.name || pet?.petName || pet?.itemName || pet?.displayName || "Unknown Pet";
}

function petValue(pet){
  if(typeof pet === "string") return 0;
  return pet?.value ?? pet?.normalValue ?? pet?.worth ?? pet?.price ?? 0;
}

function petImage(pet){
  if(typeof pet === "string"){
    return `https://amvgg.com/items/${encodeURIComponent(pet)}.webp`;
  }
  return pet?.image || pet?.imageUrl || pet?.icon || pet?.thumbnail ||
    `https://amvgg.com/items/${encodeURIComponent(petName(pet))}.webp`;
}

function toast(message){
  const box = el("toast");
  if(!box) return;
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(box._timeout);
  box._timeout = setTimeout(() => box.classList.remove("show"), 2500);
}

async function api(path, options = {}){
  let response;
  try{
    response = await fetch(`${BACKEND}${path}`, {
      credentials:"include",
      ...options,
      headers:{
        ...(options.body ? {"Content-Type":"application/json"} : {}),
        ...(options.headers || {})
      }
    });
  }catch(error){
    throw new Error("Backend is unreachable. Check that the ADMFLIP API is online.");
  }

  const text = await response.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }
  catch{ data = text; }

  if(!response.ok){
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

/* ========================= PAGES ========================= */

const pages = {
  coinflip:"coinflipPage",
  leaderboard:"leaderboardPage",
  values:"valuesPage",
  chat:"chatPage",
  profile:"profilePage"
};

function openPage(page){
  if(!pages[page]) page = "coinflip";
  state.page = page;

  Object.entries(pages).forEach(([name,id]) => {
    const node = el(id);
    if(node) node.classList.toggle("hidden", name !== page);
  });

  $$(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  if(page === "coinflip") loadCoinflips();
  if(page === "values") loadValues();
  if(page === "leaderboard") loadLeaderboard();
  if(page === "chat") loadChat();
  if(page === "profile") renderProfile();

  if(location.hash !== `#${page}`){
    history.replaceState(null,"",`#${page}`);
  }
}

function setupNavigation(){
  $$(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      if(button.id === "topChatButton"){
        toggleChat();
        return;
      }
      openPage(button.dataset.page);
    });
  });

  $$(".brand").forEach(brand => {
    brand.addEventListener("click", event => {
      event.preventDefault();
      openPage("coinflip");
    });
  });

  // Do not use #chat. Chat is a panel controlled only by the top Chat button.
  window.addEventListener("hashchange", () => {
    const page = location.hash.replace("#","") || "coinflip";
    if(page === "chat"){
      history.replaceState(null, "", location.pathname + location.search);
      openPage("coinflip");
      closeChat();
      return;
    }
    if(pages[page]) openPage(page);
  });

  const initial = location.hash.replace("#","") || "coinflip";
  openPage(pages[initial] && initial !== "chat" ? initial : "coinflip");
}

/* ========================= LOGIN ========================= */

function openLogin(){
  const modal = el("loginModal");
  if(!modal) return;

  show(modal);

  const input = el("username");
  if(input){ input.value = ""; input.focus(); }

  hide(el("loginProfile"));
  hide(el("phrase"));

  const verify = el("verify");
  if(verify){
    verify.style.display = "none";
    verify.disabled = false;
  }

  const message = el("loginMessage");
  if(message) message.textContent = "";

  setupLoginEvents();
}

let loginEventsBound = false;

function setupLoginEvents(){
  if(loginEventsBound) return;
  loginEventsBound = true;

  el("closeLogin")?.addEventListener("click", () => closeModal("loginModal"));

  el("username")?.addEventListener("keydown", event => {
    if(event.key === "Enter") startVerification();
  });

  el("verify")?.addEventListener("click", verifyRobloxBio);
}

function makeVerificationPhrase(){
  const words = [
    "silver","tiger","nova","pixel","shadow","comet","ember","frost",
    "orbit","neon","rocket","storm","velvet","lunar","maple","swift",
    "cosmic","prism","thunder","cobalt","sunset","raven","mint","blaze"
  ];

  const pick = () => words[Math.floor(Math.random() * words.length)];
  const number = String(Math.floor(1000 + Math.random() * 9000));

  return `admflip-${pick()}-${pick()}-${number}`;
}

async function robloxLookup(username){
  const clean = username.trim();
  if(!clean) throw new Error("Enter your Roblox username.");

  // Roblox documents this public GET search endpoint. Using it avoids
  // the browser preflight problem that can cause "Failed to fetch"
  // with the username POST endpoint.
  const searchUrl =
    `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(clean)}&limit=10`;

  let response;
  try{
    response = await fetch(searchUrl, {
      method:"GET",
      credentials:"omit",
      cache:"no-store",
      headers:{"Accept":"application/json"}
    });
  }catch(error){
    throw new Error(
      "Roblox could not be reached from this browser. Disable a blocking extension/VPN and try again."
    );
  }

  if(!response.ok){
    throw new Error(`Roblox search failed (${response.status}).`);
  }

  const data = await response.json();
  const users = Array.isArray(data?.data) ? data.data : [];

  if(!users.length){
    throw new Error(`No Roblox user found for "${clean}".`);
  }

  const exact = users.find(u =>
    String(u.name || "").toLowerCase() === clean.toLowerCase()
  );
  const match = exact || users[0];

  if(!match?.id){
    throw new Error("Roblox returned an invalid user result.");
  }

  let userResponse;
  try{
    userResponse = await fetch(
      `https://users.roblox.com/v1/users/${encodeURIComponent(match.id)}`,
      {
        method:"GET",
        credentials:"omit",
        cache:"no-store",
        headers:{"Accept":"application/json"}
      }
    );
  }catch(error){
    throw new Error("Found the Roblox user, but could not load their profile.");
  }

  if(!userResponse.ok){
    throw new Error(`Could not load the Roblox profile (${userResponse.status}).`);
  }

  return await userResponse.json();
}

async function startVerification(){
  const input = el("username");
  const message = el("loginMessage");
  if(!input) return;

  const username = input.value.trim();

  if(!username){
    if(message) message.textContent = "Enter your Roblox username.";
    return;
  }

  if(message) message.textContent = "Searching Roblox...";

  try{
    const robloxUser = await robloxLookup(username);

    state.verification = {
      username: robloxUser.name || username,
      robloxUser,
      phrase: makeVerificationPhrase()
    };

    renderLoginProfile(robloxUser);
    renderPhrase(state.verification.phrase);

    const verify = el("verify");
    if(verify){
      verify.style.display = "block";
      verify.disabled = false;
      verify.textContent = "Verify";
    }

    if(message){
      message.textContent =
        "Put the exact phrase into your Roblox profile About/Bio, then click Verify.";
    }

  }catch(error){
    console.error("ADMFLIP Roblox lookup:", error);
    if(message) message.textContent = error.message || "Unable to find Roblox account.";
  }
}

function renderLoginProfile(user){
  const box = el("loginProfile");
  if(!box) return;

  const username = user.username || user.name || "Roblox User";
  const userId = user.id || user.userId || "";

  // Roblox headshot thumbnail, not the ADMFLIP site logo.
  const avatar = userId
    ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(userId)}&width=150&height=150&format=png`
    : "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-DEFAULT-PNG/150/150/AvatarHeadshot/Png/noFilter";

  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <img src="${escapeHTML(avatar)}" alt="${escapeHTML(username)}"
           style="width:44px;height:44px;border-radius:10px;object-fit:cover"
           onerror="this.src='https://tr.rbxcdn.com/30DAY-AvatarHeadshot-DEFAULT-PNG/150/150/AvatarHeadshot/Png/noFilter'">
      <div>
        <strong style="display:block;font-size:13px">${escapeHTML(username)}</strong>
        <span style="display:block;margin-top:3px;color:var(--muted);font-size:10px">
          Roblox account found · ID ${escapeHTML(userId)}
        </span>
      </div>
    </div>`;
  show(box);
}

function renderPhrase(phrase){
  const box = el("phrase");
  if(!box) return;

  box.innerHTML = `
    <div style="color:var(--muted2);font-size:9px;font-weight:900;letter-spacing:.12em;margin-bottom:8px">
      VERIFICATION PHRASE
    </div>
    <strong style="display:block;padding:12px;border-radius:9px;background:var(--panel3);color:var(--text);font-size:14px;word-break:break-all;user-select:all">
      ${escapeHTML(phrase)}
    </strong>
    <p style="margin-top:9px;color:var(--muted);font-size:10px">
      Copy this exact phrase into your Roblox profile About/Bio.
    </p>`;
  show(box);
}

async function verifyRobloxBio(){
  const message = el("loginMessage");
  const button = el("verify");

  if(!state.verification?.robloxUser?.id || !state.verification?.phrase){
    if(message) message.textContent = "Search for your Roblox username first.";
    return;
  }

  if(button){
    button.disabled = true;
    button.textContent = "Checking...";
  }
  if(message) message.textContent = "Checking your Roblox profile bio...";

  try{
    // Re-fetch the public profile so the verification uses the latest bio.
    const userId = state.verification.robloxUser.id;
    const response = await fetch(
      `https://users.roblox.com/v1/users/${encodeURIComponent(userId)}`
    );

    if(!response.ok){
      throw new Error("Could not check the Roblox profile.");
    }

    const latestUser = await response.json();
    const description = String(latestUser?.description || "");
    const phrase = state.verification.phrase;

    if(!description.toLowerCase().includes(phrase.toLowerCase())){
      throw new Error(
        "Verification phrase was not found in your Roblox bio. Add it exactly, save your profile, then try again."
      );
    }

    state.user = {
      username: latestUser.name || state.verification.username,
      displayName: latestUser.displayName || latestUser.name || state.verification.username,
      id: latestUser.id,
      avatar: latestUser.id ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(latestUser.id)}&width=150&height=150&format=png` : "",
      verified: true
    };

    // Keep your backend available for account/session creation if it supports it.
    // This is deliberately best-effort and never sends a password or cookie.
    try{
      const account = await api("/check", {
        method:"POST",
        body:JSON.stringify({
          username: state.user.username,
          userId: state.user.id,
          phrase
        })
      });

      if(account?.user || account?.account || account?.data){
        const backendUser = account.user || account.account || account.data;
        state.user = {
          ...state.user,
          ...backendUser,
          username: backendUser.username || state.user.username,
          id: backendUser.id || backendUser.userId || state.user.id
        };
      }
    }catch(backendError){
      console.warn("ADMFLIP backend account sync skipped:", backendError);
    }

    saveUser();
    updateAccountUI();
    closeModal("loginModal");
    toast(`Verified as ${state.user.username}`);

    await Promise.allSettled([loadCoinflips(),loadChat()]);

  }catch(error){
    console.error("ADMFLIP bio verification:", error);
    if(message) message.textContent = error.message || "Verification failed.";
  }finally{
    if(button){
      button.disabled = false;
      button.textContent = "Verify";
    }
  }
}

/* ========================= ACCOUNT ========================= */

function saveUser(){
  try{ localStorage.setItem("admflip_user",JSON.stringify(state.user)); }catch{}
}

function loadSavedUser(){
  try{
    const saved = localStorage.getItem("admflip_user");
    if(saved) state.user = JSON.parse(saved);
  }catch{
    state.user = null;
  }
  updateAccountUI();
}

function updateAccountUI(){
  const login = el("loginBtn");
  const account = el("accountBox");

  if(!state.user){
    show(login);
    hide(account);
    return;
  }

  hide(login);
  show(account);

  const username = el("accountUsername");
  if(username) username.textContent = state.user.username || "User";

  const avatar = el("accountAvatar");
  if(avatar) avatar.src = state.user.avatar || (state.user.id ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(state.user.id)}&width=150&height=150&format=png` : "/logo.png");

  [el("chatInput"),el("panelChatInput")].forEach(input => {
    if(input) input.placeholder = "Type a message...";
  });
}

function logout(){
  state.user = null;
  state.verification = null;
  try{ localStorage.removeItem("admflip_user"); }catch{}
  updateAccountUI();
  toast("Signed out.");
}

function setupAccount(){
  el("loginBtn")?.addEventListener("click",openLogin);
  el("inventoryBtn")?.addEventListener("click",openInventory);
  el("logoutBtn")?.addEventListener("click",logout);
  el("profileBtn")?.addEventListener("click",() => openPage("profile"));
}

/* ========================= VALUES ========================= */

async function loadValues(){
  const grid = el("valuesGrid");
  if(!grid) return;
  grid.innerHTML = `<div class="loading">Loading values...</div>`;

  try{
    const data = await api("/pets");
    const pets = Array.isArray(data) ? data : data?.pets || data?.values || data?.items || data?.data || [];
    state.pets = pets;
    renderValues(pets);
  }catch(error){
    console.error("ADMFLIP pets:",error);
    grid.innerHTML = `<div class="loading">Values are currently unavailable.</div>`;
  }
}

function renderValues(pets){
  const grid = el("valuesGrid");
  if(!grid) return;

  if(!pets.length){
    grid.innerHTML = `<div class="loading">No pets found.</div>`;
    return;
  }

  grid.innerHTML = pets.map(petCard).join("");
}

function petCard(pet){
  const name = petName(pet);
  const image = petImage(pet);
  const value = petValue(pet);
  const rarity = pet?.rarity || pet?.type || "";

  return `
    <article class="pet-card" data-pet-name="${escapeHTML(name)}">
      <img class="pet-image" src="${escapeHTML(image)}"
           alt="${escapeHTML(name)}" loading="lazy"
           onerror="if(!this.dataset.failed){this.dataset.failed='1';this.src='/logo.png'}">
      <div class="pet-name">${escapeHTML(name)}</div>
      ${rarity ? `<div class="pet-rarity">${escapeHTML(rarity)}</div>` : ""}
      <div class="pet-meta">
        <span>Value</span>
        <strong class="pet-value">${formatValue(value)}</strong>
      </div>
    </article>`;
}

function setupValueSearch(){
  const input = el("valueSearch");
  if(!input) return;

  input.addEventListener("input",() => {
    const query = input.value.trim().toLowerCase();
    $$("#valuesGrid .pet-card").forEach(card => {
      const name = card.dataset.petName?.toLowerCase() || "";
      card.style.display = !query || name.includes(query) ? "" : "none";
    });
  });
}

/* ========================= COINFLIPS ========================= */

async function loadCoinflips(){
  const container = el("coinflips");
  if(!container) return;

  try{
    const data = await api("/coinflips");
    const flips = Array.isArray(data)
      ? data
      : data?.coinflips || data?.flips || data?.data || [];

    state.coinflips = flips;
    renderCoinflips(flips);

    const active = el("activeCount");
    if(active) active.textContent = formatNumber(flips.length);

    const total = flips.reduce((sum, flip) => {
      const pet = flip.pet || flip.item || {};
      const raw =
        flip.totalValue ??
        flip.value ??
        flip.petValue ??
        pet.value ??
        pet.val ??
        0;
      const value = Number(String(raw).replace(/[^0-9.]/g,""));
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const totalNode = el("totalValue");
    if(totalNode){
      totalNode.textContent = formatValue(total);
      totalNode.title = `${total.toLocaleString()} total value`;
    }

    // If the API returns an explicit online/active participant count,
    // prefer it. Otherwise the number of active flips is the useful
    // live "coinflipping now" figure.
    const online =
      data?.coinflippingNow ??
      data?.coinflipping ??
      data?.online ??
      data?.onlineCount ??
      flips.length;

    const onlineNode = el("coinflipOnline");
    if(onlineNode) onlineNode.textContent = formatNumber(online);

  }catch(error){
    console.error("ADMFLIP coinflips:",error);
    container.innerHTML = `<div class="loading">Unable to load coinflips right now.</div>`;

    const active = el("activeCount");
    const total = el("totalValue");
    const online = el("coinflipOnline");
    if(active) active.textContent = "0";
    if(total) total.textContent = "0";
    if(online) online.textContent = "0";
  }
}

function formatNumber(value){
  const n=Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "0";
}

function formatValue(value){
  const n=Number(value);
  if(!Number.isFinite(n) || n<=0) return "0";
  if(n>=1000000000) return `${(n/1000000000).toFixed(n>=10000000000?0:1)}B`;
  if(n>=1000000) return `${(n/1000000).toFixed(n>=10000000?0:1)}M`;
  if(n>=1000) return `${(n/1000).toFixed(n>=100000?0:1)}K`;
  return n.toLocaleString();
}

function renderCoinflips(flips){
  const container = el("coinflips");
  if(!container) return;

  if(!flips.length){
    container.innerHTML = `<div class="loading">No active coinflips.</div>`;
    return;
  }

  container.innerHTML = flips.map(flip => {
    const username = flip.username || flip.user?.username || "Player";
    const pet = flip.pet || flip.item || {name:flip.petName || "Pet"};
    const side = flip.side || "heads";
    const image = petImage(pet);
    const name = petName(pet);
    const value = petValue(pet);

    return `
      <article class="coinflip">
        <div class="cf-users">
          <span>${escapeHTML(username)}</span>
          <span>${escapeHTML(side)}</span>
        </div>
        <div class="cf-body">
          <div class="cf-side">
            <div class="cf-pet">
              <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}"
                   onerror="this.src='/logo.png'">
              <div>
                <b>${escapeHTML(name)}</b>
                <small>Value: ${formatValue(value)}</small>
              </div>
            </div>
          </div>
          <div class="cf-center">
            <div class="coin">FLIP</div>
            <small>Waiting</small>
          </div>
          <div class="cf-side">
            <div class="cf-pet">
              <div class="waiting-icon">?</div>
              <div>
                <b>Waiting for player</b>
                <small>Join this flip</small>
              </div>
            </div>
          </div>
        </div>
      </article>`;
  }).join("");
}

/* ========================= CREATE FLIP ========================= */

function setupCreateCoinflip(){
  el("createCoinflipBtn")?.addEventListener("click",openCreate);
}

async function openCreate(){
  if(!state.user){
    toast("Verify your Roblox account first.");
    openLogin();
    return;
  }

  const modal = createModal("createModal",`
    <div class="modal-box large">
      <button id="closeCreate" class="modal-close" type="button">×</button>
      <div class="eyebrow">NEW FLIP</div>
      <h2>Create Coinflip</h2>
      <p class="muted">Select a pet and choose your side.</p>

      <div id="createInventory" class="pet-grid">
        <div class="loading">Loading...</div>
      </div>

      <div id="sideArea" class="side-area hidden">
        <h3>Choose your side</h3>
        <div class="side-buttons">
          <button class="side-btn" data-side="heads" type="button"><span>H</span>HEADS</button>
          <button class="side-btn" data-side="tails" type="button"><span>T</span>TAILS</button>
        </div>
        <button id="postCoinflip" class="primary full" type="button">Post Coinflip</button>
      </div>
    </div>`);

  show(modal);
  state.selectedPet = null;
  state.selectedSide = null;

  el("closeCreate")?.addEventListener("click",() => closeModal("createModal"));

  $$("#createModal .side-btn").forEach(button => {
    button.addEventListener("click",() => {
      $$("#createModal .side-btn").forEach(x => x.classList.remove("selected"));
      button.classList.add("selected");
      state.selectedSide = button.dataset.side;
    });
  });

  el("postCoinflip")?.addEventListener("click",postCoinflip);

  try{
    const userId = state.user.id || state.user.userId;
    const data = await api(`/account/${encodeURIComponent(userId)}`);
    const pets = Array.isArray(data) ? data : data?.pets || data?.inventory || data?.items || data?.data || [];
    renderCreateInventory(pets);
  }catch(error){
    console.error("ADMFLIP inventory:",error);
    el("createInventory").innerHTML = `<div class="loading">Inventory unavailable.</div>`;
  }
}

function renderCreateInventory(pets){
  const grid = el("createInventory");
  if(!grid) return;

  if(!pets.length){
    grid.innerHTML = `<div class="loading">No pets available.</div>`;
    return;
  }

  grid.innerHTML = pets.map((pet,index) => `
    <article class="pet-card" data-index="${index}">
      <img class="pet-image" src="${escapeHTML(petImage(pet))}"
           alt="${escapeHTML(petName(pet))}"
           onerror="this.src='/logo.png'">
      <div class="pet-name">${escapeHTML(petName(pet))}</div>
      <div class="pet-meta">
        <span>Value</span>
        <strong class="pet-value">${formatValue(petValue(pet))}</strong>
      </div>
    </article>`).join("");

  $$("#createInventory .pet-card").forEach(card => {
    card.addEventListener("click",() => {
      $$("#createInventory .pet-card").forEach(x => x.classList.remove("selected"));
      card.classList.add("selected");
      state.selectedPet = pets[Number(card.dataset.index)];
      show(el("sideArea"));
    });
  });
}

async function postCoinflip(){
  if(!state.selectedPet){ toast("Select a pet first."); return; }
  if(!state.selectedSide){ toast("Choose heads or tails."); return; }

  try{
    await api("/coinflips",{
      method:"POST",
      body:JSON.stringify({
        username:state.user.username,
        userId:state.user.id || state.user.userId,
        pet:state.selectedPet,
        petName:petName(state.selectedPet),
        side:state.selectedSide
      })
    });

    toast("Coinflip created.");
    closeModal("createModal");
    await loadCoinflips();
  }catch(error){
    console.error("ADMFLIP create:",error);
    toast(error.message || "Could not create coinflip.");
  }
}

/* ========================= LEADERBOARD ========================= */

async function loadLeaderboard(){
  const container = el("leaderboard");
  if(!container) return;
  container.innerHTML = `<div class="loading">Loading leaderboard...</div>`;

  try{
    const data = await api("/leaderboard");
    const players = Array.isArray(data) ? data : data?.players || data?.leaderboard || data?.data || [];
    renderLeaderboard(players);
  }catch(error){
    console.error("ADMFLIP leaderboard:",error);
    container.innerHTML = `<div class="loading">Leaderboard unavailable.</div>`;
  }
}

function renderLeaderboard(players){
  const container = el("leaderboard");
  if(!container) return;

  if(!players.length){
    container.innerHTML = `<div class="loading">No leaderboard data yet.</div>`;
    return;
  }

  container.innerHTML = players.map((player,index) => {
    const username = player.username || player.name || "User";
    const avatar = player.avatar || "/logo.png";
    const wagered = player.wagered ?? player.total ?? player.value ?? 0;

    return `
      <div class="rank-row">
        <div class="rank">#${index+1}</div>
        <div class="rank-player">
          <img src="${escapeHTML(avatar)}" alt="" onerror="this.src='/logo.png'">
          <div>
            <strong>${escapeHTML(username)}</strong>
            <small>Trader</small>
          </div>
        </div>
        <div class="rank-value">${formatValue(wagered)}</div>
      </div>`;
  }).join("");
}

/* ========================= CHAT ========================= */

async function loadChat(){
  try{
    const data = await api("/chat/messages");
    const messages = Array.isArray(data) ? data : data?.messages || data?.data || [];
    renderChat(messages);

    try{
      const online = await api("/chat/online");
      setOnlineCount(online?.online ?? online?.count ?? online?.onlineCount ?? online ?? "--");
    }catch{
      setOnlineCount("--");
    }
  }catch(error){
    console.error("ADMFLIP chat:",error);
    renderChat([]);
  }
}

function renderChat(messages){
  const containers = [el("chatMessages"),el("panelChatMessages")].filter(Boolean);

  containers.forEach(container => {
    if(!messages.length){
      container.innerHTML = `<div class="loading">No messages yet.</div>`;
      return;
    }

    container.innerHTML = messages.map(message => {
      const username = message.username || message.user?.username || "User";
      const avatar = message.avatar || message.user?.avatar || "/logo.png";
      const text = message.text || message.message || "";

      return `
        <div class="chat-message">
          <img class="chat-avatar" src="${escapeHTML(avatar)}" alt=""
               onerror="this.src='/logo.png'">
          <div class="chat-content">
            <div class="chat-username">${escapeHTML(username)}</div>
            <div class="chat-text">${escapeHTML(text)}</div>
          </div>
        </div>`;
    }).join("");

    container.scrollTop = container.scrollHeight;
  });
}

function setOnlineCount(count){
  ["onlineCount","panelOnlineCount","coinflipOnline"].forEach(id => {
    const node = el(id);
    if(node) node.textContent = count;
  });
}

async function sendChatMessage(input){
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;

  if(!state.user){
    toast("Verify your Roblox account before chatting.");
    openLogin();
    return;
  }

  input.disabled = true;

  try{
    await api("/chat/messages",{
      method:"POST",
      body:JSON.stringify({
        username:state.user.username,
        userId:state.user.id || state.user.userId,
        message:text
      })
    });

    input.value = "";
    await loadChat();
  }catch(error){
    console.error("ADMFLIP send chat:",error);
    toast(error.message || "Unable to send message.");
  }finally{
    input.disabled = false;
    input.focus();
  }
}

function createChatPanel(){
  if(el("chatPanel")) return;

  const overlay = document.createElement("div");
  overlay.id = "chatOverlay";
  overlay.className = "chat-overlay";
  document.body.appendChild(overlay);

  const panel = document.createElement("aside");
  panel.id = "chatPanel";
  panel.className = "chat-panel";

  panel.innerHTML = `
    <div class="chat-header">
      <div>
        <strong>ADMFLIP CHAT</strong>
        <span><i class="online-dot"></i><b id="panelOnlineCount">--</b> online</span>
      </div>
      <div class="chat-actions">
        <button id="rulesBtnPanel" class="rules-icon" type="button">?</button>
        <button id="chatClose" class="chat-close" type="button">×</button>
      </div>
    </div>

    <div id="panelChatMessages" class="chat-messages">
      <div class="loading">Loading chat...</div>
    </div>

    <form id="panelChatForm" class="chat-form">
      <input id="panelChatInput" type="text" maxlength="250"
             autocomplete="off" placeholder="Sign in to chat...">
      <button type="submit">Send</button>
    </form>`;

  document.body.appendChild(panel);

  el("chatClose")?.addEventListener("click",closeChat);
  el("rulesBtnPanel")?.addEventListener("click",openRules);

  el("panelChatForm")?.addEventListener("submit",event => {
    event.preventDefault();
    sendChatMessage(el("panelChatInput"));
  });

  overlay.addEventListener("click",closeChat);
}

function openChat(){
  createChatPanel();
  const panel = el("chatPanel");
  const overlay = el("chatOverlay");
  if(!panel) return;

  panel.classList.add("open");
  overlay?.classList.add("open");
  state.chatOpen = true;
  el("topChatButton")?.classList.add("active");
  loadChat();
}

function closeChat(){
  el("chatPanel")?.classList.remove("open");
  el("chatOverlay")?.classList.remove("open");
  state.chatOpen = false;
  el("topChatButton")?.classList.remove("active");
}

function toggleChat(){
  if(state.chatOpen){
    closeChat();
  }else{
    openChat();
  }
}

function setupChat(){
  el("chatForm")?.addEventListener("submit",event => {
    event.preventDefault();
    sendChatMessage(el("chatInput"));
  });

  el("rulesBtn")?.addEventListener("click",openRules);

  createChatPanel();
}

/* ========================= INVENTORY ========================= */

function openInventory(){
  if(!state.user){
    toast("Verify your Roblox account first.");
    openLogin();
    return;
  }

  const modal = createModal("inventoryModal",`
    <div class="modal-box large">
      <button id="closeInventory" class="modal-close" type="button">×</button>
      <div class="eyebrow">YOUR ITEMS</div>
      <h2>Inventory</h2>
      <p class="muted">Pets available for coinflips.</p>
      <div id="inventoryGrid" class="pet-grid">
        <div class="loading">Loading...</div>
      </div>
    </div>`);

  show(modal);
  el("closeInventory")?.addEventListener("click",() => closeModal("inventoryModal"));
  loadInventory();
}

async function loadInventory(){
  const grid = el("inventoryGrid");
  if(!grid) return;

  try{
    const userId = state.user.id || state.user.userId;
    const data = await api(`/account/${encodeURIComponent(userId)}`);
    const pets = Array.isArray(data) ? data : data?.pets || data?.inventory || data?.items || data?.data || [];

    grid.innerHTML = pets.length
      ? pets.map(petCard).join("")
      : `<div class="loading">No pets found.</div>`;
  }catch(error){
    console.error("ADMFLIP inventory:",error);
    grid.innerHTML = `<div class="loading">Inventory unavailable.</div>`;
  }
}

/* ========================= RULES ========================= */

function openRules(){
  const modal = createModal("rulesModal",`
    <div class="modal-box">
      <button id="closeRules" class="modal-close" type="button">×</button>
      <div class="eyebrow">COMMUNITY</div>
      <h2>Chat Rules</h2>
      <p class="muted">Keep ADMFLIP welcoming and useful.</p>

      <div class="rule"><b>01 · Respect everyone</b><span>Harassment, hate speech and targeted abuse are not allowed.</span></div>
      <div class="rule"><b>02 · No spam</b><span>Avoid repeated messages, flooding and excessive caps.</span></div>
      <div class="rule"><b>03 · No begging</b><span>Do not repeatedly ask users for pets or benefits.</span></div>
      <div class="rule"><b>04 · No advertising</b><span>Unrelated websites and communities are not allowed.</span></div>
      <div class="rule"><b>05 · No scams</b><span>Do not impersonate staff or intentionally mislead users.</span></div>
      <div class="rule"><b>06 · Keep it appropriate</b><span>Sexual or adult content is not allowed.</span></div>
    </div>`);

  show(modal);
  el("closeRules")?.addEventListener("click",() => closeModal("rulesModal"));
}

/* ========================= PROFILE ========================= */

function renderProfile(){
  const container = el("profileContent");
  if(!container) return;

  if(!state.user){
    container.innerHTML = `
      <div class="profile-card">
        <h2>Not signed in</h2>
        <p class="muted">Verify your Roblox account to view your profile.</p>
        <button class="primary" id="profileLoginButton" type="button">Sign In</button>
      </div>`;
    el("profileLoginButton")?.addEventListener("click",openLogin);
    return;
  }

  container.innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        <img class="profile-avatar" src="${escapeHTML(state.user.avatar || (state.user.id ? `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(state.user.id)}&width=150&height=150&format=png` : "/logo.png"))}"
             alt="" onerror="this.src='/logo.png'">
        <h2>${escapeHTML(state.user.username || "User")}</h2>
        <p class="muted">ADMFLIP Trader</p>
      </div>
      <div class="profile-stat"><span>WAGERED</span><strong>${formatValue(state.user.wagered || 0)}</strong></div>
      <div class="profile-stat"><span>COINFLIPS</span><strong>${formatValue(state.user.coinflips || 0)}</strong></div>
      <div class="profile-stat"><span>WINS</span><strong>${formatValue(state.user.wins || 0)}</strong></div>
    </div>`;
}

/* ========================= MODALS ========================= */

function createModal(id,content){
  let modal = el(id);

  if(modal){
    modal.innerHTML = content;
    return modal;
  }

  modal = document.createElement("div");
  modal.id = id;
  modal.className = "modal hidden";
  modal.innerHTML = content;
  document.body.appendChild(modal);
  return modal;
}

function closeModal(id){
  hide(el(id));
}

document.addEventListener("click",event => {
  if(event.target.classList.contains("modal")){
    event.target.classList.add("hidden");
  }
});

document.addEventListener("keydown",event => {
  if(event.key !== "Escape") return;
  $$(".modal").forEach(modal => modal.classList.add("hidden"));
  closeChat();
});

/* ========================= INIT ========================= */

async function init(){
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

  setInterval(() => {
    if(state.page === "coinflip") loadCoinflips();
    if(state.page === "chat" || state.chatOpen) loadChat();
  },5000);
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded",init);
}else{
  init();
}

})();
