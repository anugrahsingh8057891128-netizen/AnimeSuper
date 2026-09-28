export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cookie = request.headers.get("Cookie") || "";
    const loggedIn = await isValidSession(cookie, env.ADMIN_PASSWORD);

    // ADMIN PAGE
    if (url.pathname === "/admin") {
      return new Response(loggedIn ? adminPage() : loginPage(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    // LOGIN
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      try {
        const body = await request.json();

        if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
          return Response.json(
            { success: false, error: "Invalid password" },
            { status: 401 }
          );
        }

        const session = await createSession(env.ADMIN_PASSWORD);

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              `admin_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
          }
        });
      } catch {
        return Response.json(
          { success: false, error: "Invalid request" },
          { status: 400 }
        );
      }
    }

    // LOGOUT
    if (url.pathname === "/api/admin/logout") {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie":
            "admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
        }
      });
    }

    // EVERYTHING BELOW REQUIRES LOGIN
    if (url.pathname.startsWith("/api/admin/") && !loggedIn) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // GET ANIME
    if (
      url.pathname === "/api/admin/anime" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB.prepare(
          "SELECT id, title, poster, description, created_at FROM anime ORDER BY id DESC"
        ).all();

        return Response.json({
          success: true,
          anime: result.results
        });
      } catch (error) {
        return Response.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    // ADD ANIME
    if (
      url.pathname === "/api/admin/anime" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        const title = String(body.title || "").trim();
        const poster = String(body.poster || "").trim();
        const description = String(body.description || "").trim();

        if (!title) {
          return Response.json(
            { success: false, error: "Title required" },
            { status: 400 }
          );
        }

        const result = await env.DB.prepare(
          "INSERT INTO anime (title, poster, description) VALUES (?, ?, ?)"
        )
          .bind(title, poster, description)
          .run();

        return Response.json({
          success: true,
          id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    // DELETE ANIME
    if (
      url.pathname.startsWith("/api/admin/anime/") &&
      request.method === "DELETE"
    ) {
      try {
        const id = Number(url.pathname.split("/").pop());

        if (!Number.isInteger(id) || id <= 0) {
          return Response.json(
            { success: false, error: "Invalid anime ID" },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          "DELETE FROM episodes WHERE anime_id = ?"
        ).bind(id).run();

        await env.DB.prepare(
          "DELETE FROM anime WHERE id = ?"
        ).bind(id).run();

        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

// EPISODE API

// GET EPISODES
if (
  url.pathname.startsWith("/api/admin/anime/") &&
  url.pathname.endsWith("/episodes") &&
  request.method === "GET"
) {
  try {
    const animeId = Number(url.pathname.split("/")[4]);

    const result = await env.DB.prepare(
      "SELECT * FROM episodes WHERE anime_id = ? ORDER BY season, episode"
    ).bind(animeId).all();

    return Response.json({
      success: true,
      episodes: result.results
    });
  } catch (error) {
    return Response.json(
      { success:false, error:error.message },
      {status:500}
    );
  }
}

// ADD EPISODE
if (
  url.pathname === "/api/admin/episodes" &&
  request.method === "POST"
) {
  try {
    const data = await request.json();

    if (!data.anime_id || !data.episode) {
      return Response.json(
        {success:false,error:"Anime ID and episode required"},
        {status:400}
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO episodes
      (anime_id, season, episode, title, url_360, url_720, url_1080)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      Number(data.anime_id),
      Number(data.season || 1),
      Number(data.episode),
      data.title || "",
      data.url_360 || "",
      data.url_720 || "",
      data.url_1080 || ""
    ).run();

    return Response.json({
      success:true,
      id:result.meta.last_row_id
    });
  } catch (error) {
    return Response.json(
      {success:false,error:error.message},
      {status:500}
    );
  }
}

// EDIT EPISODE
if (
  /^\/api\/admin\/episodes\/\d+$/.test(url.pathname) &&
  request.method === "PUT"
) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const data = await request.json();

    await env.DB.prepare(
      `UPDATE episodes SET
      anime_id=?,
      season=?,
      episode=?,
      title=?,
      url_360=?,
      url_720=?,
      url_1080=?
      WHERE id=?`
    ).bind(
      Number(data.anime_id),
      Number(data.season || 1),
      Number(data.episode),
      data.title || "",
      data.url_360 || "",
      data.url_720 || "",
      data.url_1080 || "",
      id
    ).run();

    return Response.json({success:true});
  } catch (error) {
    return Response.json(
      {success:false,error:error.message},
      {status:500}
    );
  }
}

// DELETE EPISODE
if (
  /^\/api\/admin\/episodes\/\d+$/.test(url.pathname) &&
  request.method === "DELETE"
) {
  try {
    const id = Number(url.pathname.split("/").pop());

    await env.DB.prepare(
      "DELETE FROM episodes WHERE id=?"
    ).bind(id).run();

    return Response.json({success:true});
  } catch (error) {
    return Response.json(
      {success:false,error:error.message},
      {status:500}
    );
  }
}
    // NORMAL ANIME SUPER WEBSITE
    return env.ASSETS.fetch(request);
  }
};

async function createSession(secret) {
  return hmac(secret, "AnimeSuperAdmin");
}

async function isValidSession(cookieHeader, secret) {
  if (!secret) return false;

  const match = cookieHeader.match(
    /(?:^|;\s*)admin_session=([^;]+)/
  );

  if (!match) return false;

  const expected = await createSession(secret);
  return match[1] === expected;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  return [...new Uint8Array(signature)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function loginPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anime Super Admin</title>

<style>
*{box-sizing:border-box}

body{
  margin:0;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#0b0b0f;
  color:#fff;
  font-family:Arial,sans-serif;
}

.box{
  width:min(90%,380px);
  padding:25px;
  background:#15151d;
  border-radius:16px;
}

h2{
  text-align:center;
  margin-top:0;
}

input,button{
  width:100%;
  padding:14px;
  margin-top:12px;
  border:0;
  border-radius:9px;
  font-size:15px;
}

input{
  background:#242430;
  color:#fff;
}

button{
  background:#6c5ce7;
  color:#fff;
  font-weight:bold;
  cursor:pointer;
}

#error{
  color:#ff6b6b;
  text-align:center;
  margin-top:12px;
}
</style>
</head>

<body>

<div class="box">
  <h2>Anime Super Admin</h2>

  <form id="login">
    <input
      id="password"
      type="password"
      placeholder="Admin password"
      required
    >

    <button type="submit">Login</button>

    <div id="error"></div>
  </form>
</div>

<script>
document.getElementById("login").addEventListener(
  "submit",
  async function(e){
    e.preventDefault();

    const password =
      document.getElementById("password").value;

    const res = await fetch("/api/admin/login", {
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({password})
    });

    if(res.ok){
      location.href="/admin";
    }else{
      document.getElementById("error").textContent =
        "Wrong password";
    }
  }
);
</script>

</body>
</html>`;
}

function adminPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anime Super Admin</title>

<style>
*{box-sizing:border-box}

body{
  margin:0;
  background:#0b0b0f;
  color:#fff;
  font-family:Arial,sans-serif;
}

header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:18px;
  background:#15151d;
}

header h2{
  margin:0;
}

.container{
  max-width:800px;
  margin:auto;
  padding:18px;
}

.card{
  background:#15151d;
  padding:18px;
  border-radius:14px;
  margin-bottom:18px;
}

input,textarea,button{
  width:100%;
  padding:13px;
  border:0;
  border-radius:8px;
  font-size:15px;
}

input,textarea{
  background:#242430;
  color:#fff;
  margin-top:10px;
}

textarea{
  min-height:90px;
  resize:vertical;
}

button{
  background:#6c5ce7;
  color:#fff;
  font-weight:bold;
  margin-top:12px;
  cursor:pointer;
}

.logout{
  width:auto;
  margin:0;
  padding:10px 14px;
  background:#e74c3c;
}

.status{
  margin-top:12px;
  font-size:14px;
}

.anime{
  display:flex;
  gap:12px;
  align-items:center;
  background:#20202a;
  padding:12px;
  border-radius:10px;
  margin-top:10px;
}

.poster{
  width:55px;
  height:75px;
  border-radius:6px;
  object-fit:cover;
  background:#333;
}

.info{
  flex:1;
  min-width:0;
}

.title{
  font-weight:bold;
  overflow-wrap:anywhere;
}

.desc{
  color:#aaa;
  font-size:13px;
  margin-top:5px;
  overflow-wrap:anywhere;
}

.delete{
  width:auto;
  background:#e74c3c;
  padding:9px 12px;
  margin:0;
}
</style>
</head>

<body>

<header>
  <h2>Anime Super Admin</h2>
  <button class="logout" onclick="logout()">Logout</button>
</header>

<div class="container">

  <div class="card">
    <h3>Add Anime</h3>

    <form id="animeForm">
      <input
        id="title"
        placeholder="Anime title"
        required
      >

      <input
        id="poster"
        placeholder="Poster URL"
      >

      <textarea
        id="description"
        placeholder="Description"
      ></textarea>

      <button type="submit">Add Anime</button>
    </form>

    <div id="status" class="status"></div>
  </div>

  <div class="card">
    <h3>Anime List</h3>
    <div id="animeList">Loading...</div>
<div class="card">
  <h3>Episode Manager</h3>

  <select id="episodeAnime">
    <option value="">Select Anime</option>
  </select>

  <input id="episodeSeason" type="number" min="1" value="1" placeholder="Season">

  <input id="episodeNumber" type="number" min="1" placeholder="Episode Number">

  <input id="episodeTitle" placeholder="Episode Title">

  <input id="url360" placeholder="360p Video URL">

  <input id="url720" placeholder="720p Video URL">

  <input id="url1080" placeholder="1080p Video URL">

  <button id="episodeSave">Add Episode</button>

  <div id="episodeStatus" class="status"></div>

  <div id="episodeList"></div>
</div>
  </div>

</div>

<script>
const statusBox = document.getElementById("status");
const animeList = document.getElementById("animeList");

async function loadAnime(){
  animeList.textContent = "Loading...";

  try{
    const res = await fetch("/api/admin/anime");

    if(res.status === 401){
      location.href="/admin";
      return;
    }

    const data = await res.json();

    if(!data.success){
      animeList.textContent =
        data.error || "Could not load anime";
      return;
    }

    animeList.innerHTML="";

    if(!data.anime.length){
      animeList.textContent="No anime added yet.";
      return;
    }

    data.anime.forEach(function(item){
      const row=document.createElement("div");
      row.className="anime";

      const img=document.createElement("img");
      img.className="poster";

      if(item.poster){
        img.src=item.poster;
        img.alt=item.title;
      }

      const info=document.createElement("div");
      info.className="info";

      const title=document.createElement("div");
      title.className="title";
      title.textContent=item.title;

      const desc=document.createElement("div");
      desc.className="desc";
      desc.textContent=item.description || "";

      info.appendChild(title);
      info.appendChild(desc);

      const del=document.createElement("button");
      del.className="delete";
      del.textContent="Delete";

      del.addEventListener("click", function(){
        deleteAnime(item.id, item.title);
      });

      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(del);

      animeList.appendChild(row);
    });
  }catch(error){
    animeList.textContent="Network error";
  }
}

document.getElementById("animeForm").addEventListener(
  "submit",
  async function(e){
    e.preventDefault();

    statusBox.textContent="Saving...";

    const title =
      document.getElementById("title").value.trim();

    const poster =
      document.getElementById("poster").value.trim();

    const description =
      document.getElementById("description").value.trim();

    try{
      const res=await fetch("/api/admin/anime",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          title,
          poster,
          description
        })
      });

      const data=await res.json();

      if(data.success){
        statusBox.textContent="Anime added successfully.";
        document.getElementById("animeForm").reset();
        await loadAnime();
      }else{
        statusBox.textContent =
          data.error || "Could not add anime";
      }
    }catch(error){
      statusBox.textContent="Network error";
    }
  }
);

async function deleteAnime(id,title){
  if(!confirm("Delete " + title + "?")){
    return;
  }

  try{
    const res=await fetch(
      "/api/admin/anime/" + id,
      {method:"DELETE"}
    );

    const data=await res.json();

    if(data.success){
      await loadAnime();
    }else{
      alert(data.error || "Delete failed");
    }
  }catch(error){
    alert("Network error");
  }
}

async function logout(){
  await fetch("/api/admin/logout");
  location.href="/admin";
}

loadAnime();
async function loadEpisodeAnime(){
  const select=document.getElementById("episodeAnime");

  const res=await fetch("/api/admin/anime");
  const data=await res.json();

  if(!data.success)return;

  select.innerHTML='<option value="">Select Anime</option>';

  data.anime.forEach(function(item){
    const option=document.createElement("option");
    option.value=item.id;
    option.textContent=item.title;
    select.appendChild(option);
  });
}

async function loadEpisodes(){
  const animeId=document.getElementById("episodeAnime").value;
  const list=document.getElementById("episodeList");

  if(!animeId){
    list.innerHTML="";
    return;
  }

  list.textContent="Loading episodes...";

  const res=await fetch(
    "/api/admin/anime/"+animeId+"/episodes"
  );

  const data=await res.json();

  list.innerHTML="";

  if(!data.success){
    list.textContent=data.error || "Could not load episodes";
    return;
  }

  if(!data.episodes.length){
    list.textContent="No episodes added yet.";
    return;
  }

  data.episodes.forEach(function(ep){
    const row=document.createElement("div");
    row.className="anime";

    const info=document.createElement("div");
    info.className="info";

    const title=document.createElement("div");
    title.className="title";
    title.textContent=
      "S"+ep.season+" E"+ep.episode+
      (ep.title ? " — "+ep.title : "");

    info.appendChild(title);

    const del=document.createElement("button");
    del.className="delete";
    del.textContent="Delete";

    del.onclick=async function(){
      if(!confirm("Delete this episode?"))return;

      const r=await fetch(
        "/api/admin/episodes/"+ep.id,
        {method:"DELETE"}
      );

      const d=await r.json();

      if(d.success){
        loadEpisodes();
      }else{
        alert(d.error || "Delete failed");
      }
    };

    row.appendChild(info);
    row.appendChild(del);
    list.appendChild(row);
  });
}

document.getElementById("episodeAnime")
.addEventListener("change",loadEpisodes);

document.getElementById("episodeSave")
.addEventListener("click",async function(){

  const anime_id=
    document.getElementById("episodeAnime").value;

  const season=
    document.getElementById("episodeSeason").value;

  const episode=
    document.getElementById("episodeNumber").value;

  const title=
    document.getElementById("episodeTitle").value.trim();

  const url_360=
    document.getElementById("url360").value.trim();

  const url_720=
    document.getElementById("url720").value.trim();

  const url_1080=
    document.getElementById("url1080").value.trim();

  if(!anime_id || !episode){
    document.getElementById("episodeStatus").textContent=
      "Select anime and enter episode number.";
    return;
  }

  document.getElementById("episodeStatus").textContent=
    "Saving...";

  const res=await fetch("/api/admin/episodes",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      anime_id,
      season,
      episode,
      title,
      url_360,
      url_720,
      url_1080
    })
  });

  const data=await res.json();

  if(data.success){
    document.getElementById("episodeStatus").textContent=
      "Episode added successfully.";

    document.getElementById("episodeNumber").value="";
    document.getElementById("episodeTitle").value="";
    document.getElementById("url360").value="";
    document.getElementById("url720").value="";
    document.getElementById("url1080").value="";

    loadEpisodes();
  }else{
    document.getElementById("episodeStatus").textContent=
      data.error || "Could not add episode";
  }
});

loadEpisodeAnime();
</script>

</body>
</html>`;
}
