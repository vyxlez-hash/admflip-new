const BACKEND = "https://admflip-new.onrender.com";

const state = {
  user: null,
  pets: [],
  selectedPet: null,
  selectedSide: null,
  currentPage: "coinflip"
};

const $ = id => document.getElementById(id);

function toast(message){
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(()=>{
    el.classList.remove("show");
  },3000);
}

async function api(path, options = {}){

  const response = await fetch(
    BACKEND + path,
    {
      ...options,
      headers:{
        "Content-Type":"application/json",
        ...(options.headers || {})
      }
    }
  );

  let data;

  try{
    data = await response.json();
  }catch{
    throw new Error("Invalid server response");
  }

  if(!response.ok){
    throw new Error(data.message || "Server error");
  }

  return data;
}


/* -------------------------
   LOGIN
------------------------- */

function saveUser(){
  if(state.user){
    localStorage.setItem(
      "admflipUser",
      JSON.stringify(state.user)
    );
  }
}

function restoreUser(){

  const saved = localStorage.getItem("admflipUser");

  if(!saved) return;

  try{
    state.user = JSON.parse(saved);
    showLoggedIn();
  }catch{
    localStorage.removeItem("admflipUser");
  }
}

function showLoggedIn(){

  if(!state.user) return;

  $("loginBtn").classList.add("hidden");
  $("accountBox").classList.remove("hidden");

  $("accountUsername").textContent =
    state.user.username || "User";

  $("accountAvatar").src =
    state.user.avatar || "/logo.png";

  $("chatInput").placeholder =
    "Message chat...";

  loadInventory();
}

function logout(){

  state.user = null;

  localStorage.removeItem("admflipUser");

  $("loginBtn").classList.remove("hidden");
  $("accountBox").classList.add("hidden");

  $("chatInput").placeholder =
    "Sign in to chat...";

  toast("Signed out");
}

$("loginBtn").onclick = ()=>{
  $("loginModal").classList.remove("hidden");
};

$("closeLogin").onclick = ()=>{
  $("loginModal").classList.add("hidden");
};

$("logoutBtn").onclick = logout;


/* -------------------------
   ROBLOX VERIFICATION
------------------------- */

$("username").addEventListener("change", async ()=>{

  const username =
    $("username").value.trim();

  if(!username) return;

  $("loginMessage").textContent =
    "Checking Roblox username...";

  try{

    const data =
      await api(
        "/user/" + encodeURIComponent(username)
      );

    if(!data.success){
      $("loginMessage").textContent =
        "Roblox username not found.";
      return;
    }

    state.user = data.user;

    $("loginProfile").classList.remove("hidden");

    $("loginProfile").innerHTML = `
      <img src="${escapeAttr(state.user.avatar)}">
      <div><b>${escapeHtml(state.user.username)}</b></div>
    `;

    $("loginMessage").textContent =
      "Creating verification phrase...";

    const phraseData =
      await api("/create");

    $("phrase").classList.remove("hidden");

    $("phrase").innerHTML = `
      Put this phrase in your Roblox bio:
      <br><br>
      <b>${escapeHtml(phraseData.phrase)}</b>
    `;

    state.phrase =
      phraseData.phrase;

    $("verify").style.display =
      "block";

    $("loginMessage").textContent = "";

  }catch(error){

    console.error(error);

    $("loginMessage").textContent =
      error.message || "Server error.";

  }

});


$("verify").onclick = async ()=>{

  if(!state.user || !state.phrase)
    return;

  $("verify").disabled = true;
  $("verify").textContent = "Checking...";

  try{

    const data =
      await api(
        "/check",
        {
          method:"POST",
          body:JSON.stringify({
            username:state.user.username,
            phrase:state.phrase
          })
        }
      );

    if(!data.success){

      toast(
        "Verification phrase was not found."
      );

      $("verify").disabled = false;
      $("verify").textContent = "Verify";

      return;
    }

    state.user = {
      ...state.user,
      id:data.id,
      username:data.username
    };

    saveUser();

    $("loginModal").classList.add("hidden");

    $("username").value = "";
    $("loginProfile").classList.add("hidden");
    $("phrase").classList.add("hidden");
    $("verify").style.display = "none";

    showLoggedIn();

    toast("Verified successfully");

    loadChat();

  }catch(error){

    toast(error.message);

    $("verify").disabled = false;
    $("verify").textContent = "Verify";
  }

};


/* -------------------------
   PAGES
------------------------- */

function showPage(page){

  state.currentPage = page;

  document
    .querySelectorAll(".page")
    .forEach(el => el.classList.add("hidden"));

  const target =
    $(page + "Page");

  if(target)
    target.classList.remove("hidden");

  if(page === "coinflip")
    loadCoinflips();

  if(page === "values")
    loadValues();

  if(page === "leaderboard")
    loadLeaderboard();

  if(page === "chat")
    openChat();

  localStorage.setItem(
    "admflipPage",
    page
  );
}

document
  .querySelectorAll("[data-page]")
  .forEach(link =>{

    link.onclick = e =>{

      e.preventDefault();

      const page =
        link.dataset.page;

      if(page === "chat"){
        openChat();
        return;
      }

      showPage(page);

      history.replaceState(
        null,
        "",
        "#" + page
      );
    };

  });


function restorePage(){

  const hash =
    location.hash.replace("#","");

  const saved =
    localStorage.getItem("admflipPage");

  const page =
    hash ||
    saved ||
    "coinflip";

  if(page === "chat"){
    showPage("coinflip");
    openChat();
  }else{
    showPage(page);
  }
}


/* -------------------------
   VALUES
------------------------- */

async function loadValues(){

  if(state.pets.length){

    renderValues(
      state.pets
    );

    return;
  }

  try{

    const data =
      await api("/pets");

    state.pets =
      Array.isArray(data.pets)
        ? data.pets
        : [];

    renderValues(state.pets);

  }catch(error){

    $("valuesGrid").innerHTML = `
      <div class="loading">
        Unable to load pet values.
        <br>
        ${escapeHtml(error.message)}
      </div>
    `;

  }

}


function petImage(pet){

  if(pet.image)
    return pet.image;

  const name =
    String(pet.name || "")
      .trim()
      .replace(/\s+/g," ");

  if(!name)
    return "";

  return (
    "https://amvgg.com/items/" +
    encodeURIComponent(name) +
    ".webp"
  );
}


function makePetCard(pet, selectable = false){

  const image =
    petImage(pet);

  const card =
    document.createElement("div");

  card.className =
    "pet-card" +
    (pet._selected ? " selected" : "");

  const imageHtml =
    image
      ? `
        <img
          class="pet-image"
          src="${escapeAttr(image)}"
          alt="${escapeAttr(pet.name)}"
          onerror="this.classList.add('missing');this.removeAttribute('src')"
        >
      `
      : "";

  card.innerHTML = `
    ${imageHtml}

    <div class="pet-name">
      ${escapeHtml(pet.name)}
    </div>

    <div class="pet-meta">
      <span>
        ${escapeHtml(pet.rarity || "")}
      </span>

      <span class="pet-value">
        ${formatValue(pet.value)}
      </span>
    </div>

    ${
      pet.neon ? `<div class="pet-meta">Neon</div>` : ""
    }

    ${
      pet.mega ? `<div class="pet-meta">Mega Neon</div>` : ""
    }

    ${
      pet.fly || pet.ride
      ? `
        <div class="pet-meta">
          ${pet.fly ? "F" : ""}
          ${pet.ride ? " R" : ""}
        </div>
      `
      : ""
    }
  `;

  if(selectable){

    card.onclick = ()=>{
      document
        .querySelectorAll("#createInventory .pet-card")
        .forEach(x =>
          x.classList.remove("selected")
        );

      card.classList.add("selected");

      state.selectedPet =
        pet;

      $("sideArea")
        .classList.remove("hidden");
    };

  }

  return card;
}


function renderValues(pets){

  const grid =
    $("valuesGrid");

  grid.innerHTML = "";

  if(!pets.length){

    grid.innerHTML =
      `<div class="loading">No values found.</div>`;

    return;
  }

  pets.forEach(pet =>{
    grid.appendChild(
      makePetCard(pet)
    );
  });

}


$("valueSearch").addEventListener(
  "input",
  ()=>{
    const query =
      $("valueSearch").value
        .toLowerCase()
        .trim();

    const filtered =
      state.pets.filter(p =>
        String(p.name)
          .toLowerCase()
          .includes(query)
      );

    renderValues(filtered);
  }
);


/* -------------------------
   INVENTORY
------------------------- */

async function loadInventory(){

  if(!state.user) return;

  try{

    const data =
      await api(
        "/inventory/" +
        encodeURIComponent(state.user.id)
      );

    state.user.inventory =
      data.inventory || [];

  }catch{

    state.user.inventory =
      state.user.inventory || [];

  }

}


$("inventoryBtn").onclick = async ()=>{

  if(!state.user){
    $("loginModal").classList.remove("hidden");
    return;
  }

  $("inventoryModal")
    .classList.remove("hidden");

  await loadInventory();

  renderInventory();

};

$("closeInventory").onclick = ()=>{
  $("inventoryModal").classList.add("hidden");
};


function renderInventory(){

  const grid =
    $("inventoryGrid");

  grid.innerHTML = "";

  const inventory =
    state.user?.inventory || [];

  if(!inventory.length){

    grid.innerHTML = `
      <div class="loading">
        Your inventory is empty.
      </div>
    `;

    return;
  }

  inventory.forEach(pet =>{
    grid.appendChild(
      makePetCard(pet)
    );
  });

}


/* -------------------------
   CREATE COINFLIP
------------------------- */

$("createCoinflipBtn").onclick =
  async ()=>{

    if(!state.user){

      $("loginModal")
        .classList.remove("hidden");

      toast("Sign in first");

      return;
    }

    $("createModal")
      .classList.remove("hidden");

    $("sideArea")
      .classList.add("hidden");

    state.selectedPet = null;
    state.selectedSide = null;

    await loadInventory();

    const grid =
      $("createInventory");

    grid.innerHTML = "";

    const inventory =
      state.user.inventory || [];

    if(!inventory.length){

      grid.innerHTML = `
        <div class="loading">
          No pets in your inventory.
          <br><br>
          <button
            class="primary"
            onclick="toast('Deposit via Discord is coming soon.')"
          >
            Deposit
          </button>
        </div>
      `;

      return;
    }

    inventory.forEach(pet =>{

      grid.appendChild(
        makePetCard(pet,true)
      );

    });

  };


$("closeCreate").onclick = ()=>{
  $("createModal")
    .classList.add("hidden");
};


document
  .querySelectorAll(".side-btn")
  .forEach(button =>{

    button.onclick = ()=>{

      document
        .querySelectorAll(".side-btn")
        .forEach(x =>
          x.classList.remove("selected")
        );

      button.classList.add("selected");

      state.selectedSide =
        button.dataset.side;
    };

  });


$("postCoinflip").onclick =
  async ()=>{

    if(!state.user ||
       !state.selectedPet ||
       !state.selectedSide){

      toast(
        "Choose a pet and side first."
      );

      return;
    }

    try{

      await api(
        "/coinflips",
        {
          method:"POST",
          body:JSON.stringify({
            userId:state.user.id,
            petId:state.selectedPet.id,
            petName:state.selectedPet.name,
            petValue:state.selectedPet.value,
            side:state.selectedSide
          })
        }
      );

      toast("Coinflip posted");

      $("createModal")
        .classList.add("hidden");

      await loadInventory();
      await loadCoinflips();

    }catch(error){

      toast(error.message);

    }

  };


/* -------------------------
   COINFLIPS
------------------------- */

async function loadCoinflips(){

  try{

    const data =
      await api("/coinflips");

    renderCoinflips(
      data.coinflips || []
    );

  }catch(error){

    $("coinflips").innerHTML = `
      <div class="loading">
        ${escapeHtml(error.message)}
      </div>
    `;

  }

}


function renderCoinflips(list){

  const container =
    $("coinflips");

  container.innerHTML = "";

  if(!list.length){

    container.innerHTML = `
      <div class="loading">
        No active coinflips yet.
      </div>
    `;

    return;
  }

  list.forEach(cf =>{

    const el =
      document.createElement("div");

    el.className =
      "coinflip";

    const mine =
      state.user &&
      String(cf.userId) ===
      String(state.user.id);

    const image =
      petImage(cf);

    el.innerHTML = `
      <div class="cf-users">
        <span>${escapeHtml(cf.username)}</span>
        <span>${escapeHtml(cf.side)}</span>
      </div>

      <div class="cf-body">

        <div class="cf-side">

          <div class="cf-pet">

            ${
              image
              ? `<img src="${escapeAttr(image)}"
                    onerror="this.remove()">`
              : ""
            }

            <div>
              <b>${escapeHtml(cf.petName)}</b>
              <div class="muted">
                ${formatValue(cf.petValue)}
              </div>
            </div>

          </div>

        </div>

        <div class="cf-center">

          <div class="coin">
            ${escapeHtml(cf.side)}
          </div>

          ${
            mine
              ? `<small class="muted">Waiting...</small>`
              : `
                <button
                  class="primary cf-join"
                  data-id="${escapeAttr(cf._id)}"
                >
                  Join
                </button>
              `
          }

        </div>

        <div class="cf-side">

          <div class="cf-pet">
            Waiting for trader...
          </div>

        </div>

      </div>
    `;

    const join =
      el.querySelector(".cf-join");

    if(join){

      join.onclick = async ()=>{

        if(!state.user){

          $("loginModal")
            .classList.remove("hidden");

          return;
        }

        try{

          await api(
            "/coinflips/" +
            encodeURIComponent(cf._id) +
            "/join",
            {
              method:"POST",
              body:JSON.stringify({
                userId:state.user.id
              })
            }
          );

          toast(
            "Coinflip joined. Result generated by server."
          );

          await loadCoinflips();
          await loadInventory();

        }catch(error){

          toast(error.message);

        }

      };

    }

    container.appendChild(el);

  });

}


/* -------------------------
   LEADERBOARD
------------------------- */

async function loadLeaderboard(){

  try{

    const data =
      await api("/leaderboard");

    const container =
      $("leaderboard");

    container.innerHTML = "";

    (data.players || [])
      .slice(0,10)
      .forEach((player,index)=>{

        const row =
          document.createElement("div");

        row.className =
          "rank-row";

        row.innerHTML = `
          <div class="rank">
            #${index + 1}
          </div>

          <div class="rank-name">
            ${escapeHtml(player.username)}
          </div>

          <div class="rank-value">
            ${formatValue(player.wagered)}
          </div>
        `;

        container.appendChild(row);

      });

  }catch(error){

    $("leaderboard").innerHTML =
      `<div class="loading">
        ${escapeHtml(error.message)}
      </div>`;

  }

}


/* -------------------------
   CHAT
------------------------- */

function openChat(){

  $("chatPanel")
    .classList.add("mobile-open");

  if(state.user){

    $("chatInput").placeholder =
      "Message chat...";

  }else{

    $("chatInput").placeholder =
      "Sign in to chat...";

  }

  loadChat();
}

function closeChat(){

  $("chatPanel")
    .classList.remove("mobile-open");

}

$("chatClose").onclick =
  closeChat;

$("mobileChatButton").onclick =
  ()=>{

    $("chatPanel")
      .classList.toggle("mobile-open");

    loadChat();

  };


async function loadChat(){

  try{

    const data =
      await api("/chat");

    $("onlineCount").textContent =
      data.online;

    renderChat(
      data.messages || []
    );

  }catch(error){

    console.error(error);

  }

}


function renderChat(messages){

  const container =
    $("chatMessages");

  container.innerHTML = "";

  messages.forEach(message =>{

    const el =
      document.createElement("div");

    el.className =
      "chat-message";

    el.innerHTML = `

      <img
        class="chat-avatar"
        src="${escapeAttr(message.avatar || "/logo.png")}"
        onerror="this.src='/logo.png'"
      >

      <div class="chat-content">

        <div class="chat-username">
          ${escapeHtml(message.username)}
        </div>

        <div class="chat-text">
          ${escapeHtml(message.message)}
        </div>

      </div>

    `;

    container.appendChild(el);

  });

  container.scrollTop =
    container.scrollHeight;
}


$("chatForm").onsubmit =
  async event =>{

    event.preventDefault();

    if(!state.user){

      toast("Sign in to chat.");

      $("loginModal")
        .classList.remove("hidden");

      return;
    }

    const input =
      $("chatInput");

    const message =
      input.value.trim();

    if(!message) return;

    try{

      await api(
        "/chat",
        {
          method:"POST",
          body:JSON.stringify({
            userId:state.user.id,
            username:state.user.username,
            avatar:state.user.avatar,
            message
          })
        }
      );

      input.value = "";

      await loadChat();

    }catch(error){

      toast(error.message);

    }

  };


/* -------------------------
   RULES
------------------------- */

$("rulesBtn").onclick = ()=>{
  $("rulesModal")
    .classList.remove("hidden");
};

$("closeRules").onclick = ()=>{
  $("rulesModal")
    .classList.add("hidden");
};


/* -------------------------
   PROFILE
------------------------- */

$("profileBtn").onclick = ()=>{
  showPage("profile");
  renderProfile();
};

function renderProfile(){

  if(!state.user) return;

  $("profileContent").innerHTML = `

    <div class="page-head">

      <div>

        <div class="eyebrow">
          PROFILE
        </div>

        <h1>
          ${escapeHtml(state.user.username)}
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
          src="${escapeAttr(state.user.avatar)}"
        >

        <div class="pet-name">
          ${escapeHtml(state.user.username)}
        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Wagered
        </div>

        <div class="pet-value">
          ${formatValue(state.user.wagered || 0)}
        </div>

      </div>

      <div class="pet-card">

        <div class="pet-name">
          Profit
        </div>

        <div class="pet-value">
          ${formatValue(state.user.profit || 0)}
        </div>

      </div>

    </div>
  `;

}


/* -------------------------
   HELPERS
------------------------- */

function formatValue(value){

  const number =
    Number(value || 0);

  return number.toLocaleString(
    "en-US",
    {
      maximumFractionDigits:6
    }
  );
}

function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeAttr(value){

  return escapeHtml(value);
}


/* -------------------------
   INITIALIZE
------------------------- */

restoreUser();
restorePage();

loadValues();
loadCoinflips();
loadChat();

setInterval(
  loadChat,
  10000
);

setInterval(
  loadCoinflips,
  10000
);
