export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cookie = request.headers.get("Cookie") || "";
    const loggedIn = await isValidSession(cookie, env.ADMIN_PASSWORD);

    if (url.pathname === "/admin") {
      return new Response(
        loggedIn ? adminPage() : loginPage(),
        {
          headers: {
            "Content-Type": "text/html; charset=UTF-8"
          }
        }
      );
    }

    // LOGIN
    if (
      url.pathname === "/api/admin/login" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        if (
          !env.ADMIN_PASSWORD ||
          body.password !== env.ADMIN_PASSWORD
        ) {
          return Response.json(
            {
              success: false,
              error: "Invalid password"
            },
            { status: 401 }
          );
        }

        const session = await createSession(
          env.ADMIN_PASSWORD
        );

        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie":
                `admin_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
            }
          }
        );
      } catch {
        return Response.json(
          {
            success: false,
            error: "Invalid request"
          },
          { status: 400 }
        );
      }
    }

    // LOGOUT
    if (url.pathname === "/api/admin/logout") {
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              "admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
          }
        }
      );
    }

    // PUBLIC ANIME API
    if (url.pathname === "/api/public/anime" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          `SELECT id, title, poster, description, movie, available
           FROM anime
           ORDER BY id DESC`
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

    // PUBLIC EPISODES API
    if (url.pathname.startsWith("/api/public/anime/") && url.pathname.endsWith("/episodes") && request.method === "GET") {
      try {
        const parts = url.pathname.split("/");
        const animeId = Number(parts[4]);
        if (!animeId) {
          return Response.json({ success:false, error:"Invalid anime ID" }, {status:400});
        }
        const result = await env.DB.prepare(
          `SELECT id, anime_id, season, episode, language, title, url_360, url_720, url_1080, url_360_server2, url_720_server2, url_1080_server2
           FROM episodes
           WHERE anime_id = ?
           ORDER BY season ASC, episode ASC`
        ).bind(animeId).all();
        return Response.json({ success:true, episodes:result.results });
      } catch (error) {
        return Response.json({ success:false, error:error.message }, {status:500});
      }
    }

    // PUBLIC MOVIE LINKS API
    if (url.pathname.startsWith("/api/public/anime/") && url.pathname.endsWith("/movies") && request.method === "GET") {
      try {
        const parts = url.pathname.split("/");
        const animeId = Number(parts[4]);
        if (!animeId) {
          return Response.json({ success:false, error:"Invalid anime ID" }, {status:400});
        }
        const result = await env.DB.prepare(
          `SELECT id, anime_id, language, quality, url, url_server2
           FROM movie_links
           WHERE anime_id = ?
           ORDER BY language ASC, quality ASC`
        ).bind(animeId).all();
        return Response.json({ success:true, movies:result.results });
      } catch (error) {
        return Response.json({ success:false, error:error.message }, {status:500});
      }
    }

    // ADMIN API LOGIN CHECK
    if (
      url.pathname.startsWith("/api/admin/") &&
      !loggedIn
    ) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized"
        },
        { status: 401 }
      );
    }

    // =====================================================
    // ANIME API
    // =====================================================

    // GET ALL ANIME
    if (
      url.pathname === "/api/admin/anime" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB.prepare(
          `SELECT id, title, poster, description, movie, created_at
           FROM anime
           ORDER BY id DESC`
        ).all();

        return Response.json({
          success: true,
          anime: result.results
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
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
        const description =
          String(body.description || "").trim();

        const movie =
          body.movie ? 1 : 0;

        if (!title) {
          return Response.json(
            {
              success: false,
              error: "Title required"
            },
            { status: 400 }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO anime
           (title, poster, description, movie)
           VALUES (?, ?, ?, ?)`
        )
          .bind(title, poster, description, movie)
          .run();

        return Response.json({
          success: true,
          id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // EDIT ANIME
    if (
      /^\/api\/admin\/anime\/\d+$/.test(url.pathname) &&
      request.method === "PUT"
    ) {
      try {
        const id = Number(
          url.pathname.split("/").pop()
        );

        const body = await request.json();

        const title = String(body.title || "").trim();
        const poster = String(body.poster || "").trim();
        const description =
          String(body.description || "").trim();

        const movie =
          body.movie ? 1 : 0;

        if (!Number.isInteger(id) || id <= 0) {
          return Response.json(
            {
              success: false,
              error: "Invalid anime ID"
            },
            { status: 400 }
          );
        }

        if (!title) {
          return Response.json(
            {
              success: false,
              error: "Title required"
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          `UPDATE anime
           SET title=?, poster=?, description=?, movie=?
           WHERE id=?`
        )
          .bind(
            title,
            poster,
            description,
            movie,
            id
          )
          .run();

        return Response.json({
          success: true
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // DELETE ANIME
    if (
      /^\/api\/admin\/anime\/\d+$/.test(url.pathname) &&
      request.method === "DELETE"
    ) {
      try {
        const id = Number(
          url.pathname.split("/").pop()
        );

        if (!Number.isInteger(id) || id <= 0) {
          return Response.json(
            {
              success: false,
              error: "Invalid anime ID"
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          "DELETE FROM episodes WHERE anime_id=?"
        )
          .bind(id)
          .run();

        await env.DB.prepare(
          "DELETE FROM anime WHERE id=?"
        )
          .bind(id)
          .run();

        return Response.json({
          success: true
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // =====================================================
    // EPISODE API
    // =====================================================

    // GET EPISODES FOR ANIME
    if (
      /^\/api\/admin\/anime\/\d+\/episodes$/.test(
        url.pathname
      ) &&
      request.method === "GET"
    ) {
      try {
        const parts = url.pathname.split("/");
        const animeId = Number(parts[4]);

        const result = await env.DB.prepare(
          `SELECT *
           FROM episodes
           WHERE anime_id=?
           ORDER BY season, episode`
        )
          .bind(animeId)
          .all();

        return Response.json({
          success: true,
          episodes: result.results
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
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

        const animeId = Number(data.anime_id);
        const season = Number(data.season || 1);
        const episode = Number(data.episode);

        if (
          !Number.isInteger(animeId) ||
          animeId <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Select anime"
            },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(episode) ||
          episode <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Episode number required"
            },
            { status: 400 }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO episodes
           (
             anime_id,
             season,
             episode,
             language,
             title,
             url_360,
             url_720,
             url_1080,
             url_360_server2,
             url_720_server2,
             url_1080_server2
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            animeId,
            season,
            episode,
            String(data.language || "Hindi"),
            String(data.title || ""),
            String(data.url_360 || ""),
            String(data.url_720 || ""),
            String(data.url_1080 || ""),
            String(data.url_360_server2 || ""),
            String(data.url_720_server2 || ""),
            String(data.url_1080_server2 || "")
          )
          .run();

        return Response.json({
          success: true,
          id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // EDIT EPISODE
    if (
      /^\/api\/admin\/episodes\/\d+$/.test(
        url.pathname
      ) &&
      request.method === "PUT"
    ) {
      try {
        const id = Number(
          url.pathname.split("/").pop()
        );

        const data = await request.json();

        const animeId = Number(data.anime_id);
        const season = Number(data.season || 1);
        const episode = Number(data.episode);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Invalid episode ID"
            },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(animeId) ||
          animeId <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Select anime"
            },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(episode) ||
          episode <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Episode number required"
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          `UPDATE episodes
           SET
             anime_id=?,
             season=?,
             episode=?,
             language=?,
             title=?,
             url_360=?,
             url_720=?,
             url_1080=?,
             url_360_server2=?,
             url_720_server2=?,
             url_1080_server2=?
           WHERE id=?`
        )
          .bind(
            animeId,
            season,
            episode,
            String(data.language || "Hindi"),
            String(data.title || ""),
            String(data.url_360 || ""),
            String(data.url_720 || ""),
            String(data.url_1080 || ""),
            String(data.url_360_server2 || ""),
            String(data.url_720_server2 || ""),
            String(data.url_1080_server2 || ""),
            id
          )
          .run();

        return Response.json({
          success: true
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // DELETE EPISODE
    if (
      /^\/api\/admin\/episodes\/\d+$/.test(
        url.pathname
      ) &&
      request.method === "DELETE"
    ) {
      try {
        const id = Number(
          url.pathname.split("/").pop()
        );

        await env.DB.prepare(
          "DELETE FROM episodes WHERE id=?"
        )
          .bind(id)
          .run();

        return Response.json({
          success: true
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }
    // =====================================================
    // MOVIE LINK API
    // =====================================================

    // GET MOVIE LINKS FOR ANIME
    if (
      /^\/api\/admin\/anime\/\d+\/movies$/.test(url.pathname) &&
      request.method === "GET"
    ) {
      try {
        const animeId = Number(url.pathname.split("/")[4]);

        const result = await env.DB.prepare(
          `SELECT *
           FROM movie_links
           WHERE anime_id=?
           ORDER BY language, quality`
        )
          .bind(animeId)
          .all();

        return Response.json({
          success: true,
          movies: result.results
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // ADD MOVIE LINK
    if (
      url.pathname === "/api/admin/movie-links" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        const animeId = Number(data.anime_id);
        const language = String(data.language || "").trim();
        const quality = String(data.quality || "").trim();
        const link = String(data.url || "").trim();
        const linkServer2 = String(data.url_server2 || "").trim();

        if (
          !Number.isInteger(animeId) ||
          animeId <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Select anime"
            },
            { status: 400 }
          );
        }

        if (!language) {
          return Response.json(
            {
              success: false,
              error: "Language required"
            },
            { status: 400 }
          );
        }

        if (!quality) {
          return Response.json(
            {
              success: false,
              error: "Quality required"
            },
            { status: 400 }
          );
        }

        if (!link && !linkServer2) {
          return Response.json(
            {
              success: false,
              error: "Enter a Vidmoly URL or an Abyss URL"
            },
            { status: 400 }
          );
        }

        const result = await env.DB.prepare(
          `INSERT INTO movie_links
           (anime_id, language, quality, url, url_server2)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(
            animeId,
            language,
            quality,
            link,
            linkServer2
          )
          .run();

        return Response.json({
          success: true,
          id: result.meta.last_row_id
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // EDIT MOVIE LINK
    if (
      /^\/api\/admin\/movie-links\/\d+$/.test(url.pathname) &&
      request.method === "PUT"
    ) {
      try {
        const id = Number(
          url.pathname.split("/").pop()
        );

        const data = await request.json();

        const animeId = Number(data.anime_id);
        const language = String(data.language || "").trim();
        const quality = String(data.quality || "").trim();
        const link = String(data.url || "").trim();
        const linkServer2 = String(data.url_server2 || "").trim();

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Invalid movie link ID"
            },
            { status: 400 }
          );
        }

        if (
          !Number.isInteger(animeId) ||
          animeId <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Select anime"
            },
            { status: 400 }
          );
        }

        if (!language || !quality || (!link && !linkServer2)) {
          return Response.json(
            {
              success: false,
              error: "Language, quality, and at least one video URL are required"
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          `UPDATE movie_links
           SET
             anime_id=?,
             language=?,
             quality=?,
             url=?,
             url_server2=?
           WHERE id=?`
        )
          .bind(
            animeId,
            language,
            quality,
            link,
            linkServer2,
            id
          )
          .run();

        return Response.json({
          success: true
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    // DELETE MOVIE LINK
    if (
      /^\/api\/admin\/movie-links\/\d+$/.test(url.pathname) &&
      request.method === "DELETE"
    ) {
      try {
        const id = Number(
          url.pathname.split("/").pop()
        );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return Response.json(
            {
              success: false,
              error: "Invalid movie link ID"
            },
            { status: 400 }
          );
        }

        await env.DB.prepare(
          "DELETE FROM movie_links WHERE id=?"
        )
          .bind(id)
          .run();

        return Response.json({
          success: true
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
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
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  return [...new Uint8Array(signature)]
    .map(b =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

function loginPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1">
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

<button type="submit">
Login
</button>

<div id="error"></div>

</form>

</div>

<script>
document
.getElementById("login")
.addEventListener("submit",async function(e){

e.preventDefault();

const password =
document.getElementById("password").value;

const res=await fetch(
"/api/admin/login",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({password})
}
);

if(res.ok){
location.href="/admin";
}else{
document.getElementById("error")
.textContent="Wrong password";
}

});
</script>

</body>
</html>`;
}

function adminPage() {
  return `<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>Anime Super Admin</title>

<style>

*{
box-sizing:border-box;
}

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
position:sticky;
top:0;
z-index:10;
}

header h2{
margin:0;
}

.container{
max-width:900px;
margin:auto;
padding:18px;
}

.card{
background:#15151d;
padding:18px;
border-radius:14px;
margin-bottom:18px;
}

input,
textarea,
select,
button{
width:100%;
padding:13px;
border:0;
border-radius:8px;
font-size:15px;
}

input,
textarea,
select{
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

.small{
width:auto;
padding:9px 12px;
margin:5px 4px 0 0;
}

.edit{
background:#3498db;
}

.delete{
background:#e74c3c;
}

.cancel{
background:#555;
}

.status{
margin-top:12px;
font-size:14px;
}

.anime{
background:#20202a;
padding:12px;
border-radius:10px;
margin-top:10px;
}

.animeTop{
display:flex;
gap:12px;
align-items:center;
}

.poster{
width:65px;
height:90px;
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

.actions{
margin-top:8px;
}

.episode{
background:#292934;
padding:12px;
border-radius:10px;
margin-top:8px;
}

.episodeTitle{
font-weight:bold;
}

.urlText{
color:#999;
font-size:12px;
overflow-wrap:anywhere;
margin-top:5px;
}

.hidden{
display:none;
}

.sectionTitle{
margin-top:0;
}

hr{
border:0;
border-top:1px solid #333;
margin:18px 0;
}

</style>

</head>

<body>

<header>

<h2>Anime Super Admin</h2>

<button
class="logout"
onclick="logout()"
>
Logout
</button>

</header>

<div class="container">

<!-- ================= ANIME ================= -->

<div class="card">

<h3 class="sectionTitle">
Anime Manager
</h3>

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

<label style="display:block;margin:8px 0;">
<input type="checkbox" id="movie"> Movie
</label>

<textarea
id="description"
placeholder="Description"
></textarea>

<button id="animeSave">
Add Anime
</button>

<button
type="button"
id="animeCancel"
class="cancel hidden"
onclick="cancelAnimeEdit()"
>
Cancel Edit
</button>

</form>

<div
id="status"
class="status"
></div>

</div>

<div class="card">

<h3 class="sectionTitle">
Anime List
</h3>

<div id="animeList">
Loading...
</div>

</div>

<!-- ================= EPISODES ================= -->

<div class="card">

<h3 class="sectionTitle">
Episode Manager
</h3>

<input id="episodeAnimeSearch" type="text" placeholder="Search Anime..." style="margin-bottom:8px;">
<select id="episodeAnime">

<option value="">
Select Anime
</option>

</select>

<input
id="episodeSeason"
type="number"
min="1"
value="1"
placeholder="Season"
>

<input
id="episodeNumber"
type="number"
min="1"
placeholder="Episode Number"
>

<select id="episodeLanguage">
<option value="Hindi">Hindi Dub</option>
<option value="English">English Dub</option>
<option value="Japanese">Japanese Dub</option>
</select>

<input
id="episodeTitle"
placeholder="Episode Title"
>

<input
id="url360"
placeholder="360p Video URL"
>

<input
id="url720"
placeholder="720p Video URL"
>

<input
id="url1080"
placeholder="1080p Video URL"
>

<input
id="urlServer2"
placeholder="Abyss Video URL (one link)"
>

<button type="button" id="episodeSave">
Add Episode
</button>

<button
type="button"
id="episodeCancel"
class="cancel hidden"
onclick="cancelEpisodeEdit()"
>
Cancel Edit
</button>

<div
id="episodeStatus"
class="status"
></div>

<hr>

<div id="episodeList">
Select an anime to see episodes.
</div>

</div>

</div>
<!-- MOVIE MANAGER -->
<div class="card">
  <h2>🎬 Movie Manager</h2>

<input id="movieAnimeSearch" type="text" placeholder="Search Anime / Movie..." style="margin-bottom:8px;">
  <select id="movieAnime">
    <option value="">Select Anime / Movie</option>
  </select>

  <select id="movieLanguage">
    <option value="Japanese">Japanese Dub</option>
    <option value="English">English Dub</option>
    <option value="Hindi">Hindi Dub</option>
  </select>

  <input type="text" id="movieUrl360" placeholder="Vidmoly 360p URL">

  <input type="text" id="movieUrl720" placeholder="Vidmoly 720p URL">

  <input type="text" id="movieUrl1080" placeholder="Vidmoly 1080p URL">

  <input type="text" id="movieUrlServer2" placeholder="Abyss Video URL (one link)">

  <button type="button" id="movieSave">
    Add Movie Link
  </button>

  <button
    type="button"
    id="movieCancel"
    style="display:none"
  >
    Cancel Edit
  </button>

  <div id="movieStatus"></div>

  <div id="movieList"></div>
</div>
<script>

const statusBox =
document.getElementById("status");

const animeList =
document.getElementById("animeList");

let animeCache=[];
// =====================================================
// MOVIE MANAGER
// =====================================================

let movieEditId = null;

const movieAnime =
document.getElementById("movieAnime");

const movieLanguage =
document.getElementById("movieLanguage");

const movieUrl360 =
document.getElementById("movieUrl360");

const movieUrl720 =
document.getElementById("movieUrl720");

const movieUrl1080 =
document.getElementById("movieUrl1080");

const movieUrlServer2 =
document.getElementById("movieUrlServer2");

const movieSave =
document.getElementById("movieSave");

const movieCancel =
document.getElementById("movieCancel");

const movieStatus =
document.getElementById("movieStatus");

const movieList =
document.getElementById("movieList");

async function loadMovieAnime(){

  movieAnime.innerHTML =
    '<option value="">Select Anime / Movie</option>';

  animeCache.forEach(anime => {

    const option =
    document.createElement("option");

    option.value = anime.id;
    option.textContent = anime.title;

    movieAnime.appendChild(option);

  });

}


function filterMovieAnime(){

const search=document.getElementById("movieAnimeSearch").value.toLowerCase();
const select=document.getElementById("movieAnime");

Array.from(select.options).forEach((option,index)=>{
if(index===0)return;
option.hidden=!option.textContent.toLowerCase().includes(search);
});

}

document.getElementById("movieAnimeSearch").addEventListener("input",filterMovieAnime);

async function loadMovieLinks(){

  const animeId =
    movieAnime.value;

  movieList.innerHTML =
    "Loading movie links...";

  if(!animeId){
    movieList.innerHTML =
      "Select an anime/movie.";
    return;
  }

  try{

    const res =
      await fetch(
        "/api/admin/anime/" +
        animeId +
        "/movies"
      );

    const data =
      await res.json();

    if(!data.success){
      movieList.innerHTML =
        data.error || "Failed to load.";
      return;
    }

    if(!data.movies.length){
      movieList.innerHTML =
        "No movie links found.";
      return;
    }

    movieList.innerHTML = "";

    data.movies.forEach(movie => {

      const div =
        document.createElement("div");

      div.className = "item";

      div.innerHTML = \`
         <b>\${movie.language} Dub</b>
        - \${movie.quality}
        <br>

        <small>
          \${movie.url}
        </small>

        <br><br>

        <button type="button"
          onclick='editMovieLink(\${JSON.stringify(movie)})'>
          Edit
        </button>

        <button type="button"
          onclick="deleteMovieLink(\${movie.id})">
          Delete
        </button>
      \`;

      movieList.appendChild(div);

    });

  }catch(error){

    movieList.innerHTML =
      "Error loading movie links.";

  }

}

function resetMovieForm(){

  movieEditId = null;

  movieLanguage.value = "Japanese";
  movieUrl360.value = "";
  movieUrl720.value = "";
  movieUrl1080.value = "";
  movieUrlServer2.value = "";

  movieSave.textContent =
    "Add Movie Link";

  movieCancel.style.display =
    "none";

  movieStatus.textContent = "";

}

function editMovieLink(movie){

  movieEditId = movie.id;

  movieAnime.value =
    movie.anime_id;

  movieLanguage.value =
    movie.language;

  movieUrl360.value = "";
  movieUrl720.value = "";
  movieUrl1080.value = "";
  movieUrlServer2.value = movie.url_server2 || "";

  if (movie.quality === "360p") movieUrl360.value = movie.url || "";
  if (movie.quality === "720p") movieUrl720.value = movie.url || "";
  if (movie.quality === "1080p") movieUrl1080.value = movie.url || "";

  movieSave.textContent =
    "Update Movie Link";

  movieCancel.style.display =
    "inline-block";

  movieStatus.textContent =
    "Editing movie link...";

}

movieAnime.addEventListener(
  "change",
  loadMovieLinks
);

movieCancel.addEventListener(
  "click",
  resetMovieForm
);

movieSave.addEventListener(
  "click",
  async function(){

    const animeId = Number(movieAnime.value);
    const language = movieLanguage.value;
    const abyssUrl = movieUrlServer2.value.trim();

    const qualityUrls = {
      "360p": movieUrl360.value.trim(),
      "720p": movieUrl720.value.trim(),
      "1080p": movieUrl1080.value.trim()
    };

    if(!animeId){
      movieStatus.textContent = "Select anime/movie.";
      return;
    }

    if(!Object.values(qualityUrls).some(Boolean) && !abyssUrl){
      movieStatus.textContent = "Enter at least one Vidmoly URL or Abyss URL.";
      return;
    }

    movieStatus.textContent = "Saving...";

    try{
      const listRes = await fetch("/api/admin/anime/" + animeId + "/movies");
      const listData = await listRes.json();

      if(!listData.success){
        movieStatus.textContent = listData.error || "Could not load existing movie links.";
        return;
      }

      const existing = (listData.movies || []).filter(movie => movie.language === language);
      let savedCount = 0;

      for(const quality of ["360p", "720p", "1080p"]){
        const old = existing.find(movie => movie.quality === quality);
        const enteredUrl = qualityUrls[quality];
        const url = enteredUrl || (old ? old.url : "");
        const url_server2 = abyssUrl || (old ? (old.url_server2 || "") : "");

        if(!url && !url_server2) continue;
        if(!enteredUrl && !abyssUrl) continue;

        const apiUrl = old
          ? "/api/admin/movie-links/" + old.id
          : "/api/admin/movie-links";

        const res = await fetch(apiUrl, {
          method: old ? "PUT" : "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            anime_id: animeId,
            language,
            quality,
            url,
            url_server2
          })
        });

        const data = await res.json();

        if(!data.success){
          movieStatus.textContent = data.error || "Failed to save " + quality + ".";
          return;
        }

        savedCount++;
      }

      if(!savedCount){
        movieStatus.textContent = "No movie links were saved. Enter a Vidmoly URL for at least one quality.";
        return;
      }

      movieStatus.textContent = "Movie links saved successfully.";
      resetMovieForm();
      movieAnime.value = animeId;
      await loadMovieLinks();

    }catch(error){
      movieStatus.textContent = "Error: " + error.message;
    }
  }
);

async function deleteMovieLink(id){

  if(!confirm(
    "Delete this movie link?"
  )){
    return;
  }

  try{

    const res =
      await fetch(
        "/api/admin/movie-links/" + id,
        {
          method:"DELETE"
        }
      );

    const data =
      await res.json();

    if(!data.success){

      movieStatus.textContent =
        data.error ||
        "Delete failed.";

      return;
    }

    movieStatus.textContent =
      "Movie link deleted successfully.";

    await loadMovieLinks();

  }catch(error){

    movieStatus.textContent =
      "Error: " + error.message;

  }

}

// =====================================================
// LOAD ANIME
// =====================================================

async function loadAnime(){

animeList.textContent="Loading...";

try{

const res=await fetch(
"/api/admin/anime"
);

if(res.status===401){

location.href="/admin";
return;

}

const data=await res.json();

if(!data.success){

animeList.textContent=
data.error || "Could not load anime";

return;

}

animeCache=data.anime || [];

animeList.innerHTML="";

if(!animeCache.length){

animeList.textContent=
"No anime added yet.";

}else{

animeCache.forEach(function(item){

const row=
document.createElement("div");

row.className="anime";

const top=
document.createElement("div");

top.className="animeTop";

const img=
document.createElement("img");

img.className="poster";

if(item.poster){

img.src=item.poster;

img.alt=item.title;

}

const info=
document.createElement("div");

info.className="info";

const title=
document.createElement("div");

title.className="title";

title.textContent=item.title;

const desc=
document.createElement("div");

desc.className="desc";

desc.textContent=
item.description || "";

info.appendChild(title);

info.appendChild(desc);

top.appendChild(img);

top.appendChild(info);

row.appendChild(top);


// ACTIONS

const actions=
document.createElement("div");

actions.className="actions";

const edit=
document.createElement("button");

edit.className="small edit";

edit.textContent="Edit";

edit.onclick=function(){

editAnime(item);

};


const episodes=
document.createElement("button");

episodes.className="small";

episodes.textContent="Episodes";

episodes.onclick=function(){

document.getElementById(
"episodeAnime"
).value=item.id;

loadEpisodes();

document.getElementById(
"episodeAnime"
).scrollIntoView({
behavior:"smooth",
block:"center"
});

};


const del=
document.createElement("button");

del.className="small delete";

del.textContent="Delete";

del.onclick=function(){

deleteAnime(
item.id,
item.title
);

};

actions.appendChild(edit);

actions.appendChild(episodes);

actions.appendChild(del);

row.appendChild(actions);

animeList.appendChild(row);

});

}

loadEpisodeAnime(); loadMovieAnime();

}catch(error){

animeList.textContent=
"Network error";

}

}


// =====================================================
// ADD / EDIT ANIME
// =====================================================

document
.getElementById("animeForm")
.addEventListener(
"submit",
async function(e){

e.preventDefault();

const saveButton=
document.getElementById("animeSave");

const editId=
saveButton.dataset.editId;

const title=
document
.getElementById("title")
.value
.trim();

const poster=
document
.getElementById("poster")
.value
.trim();

const description=
document
.getElementById("description")
.value
.trim();

const movie=
document
.getElementById("movie")
.checked;

if(!title){

statusBox.textContent=
"Title required.";

return;

}

statusBox.textContent=
editId ? "Updating..." : "Saving...";

const url=editId
? "/api/admin/anime/"+editId
: "/api/admin/anime";

const method=editId
? "PUT"
: "POST";

try{

const res=await fetch(
url,
{
method,
headers:{
"Content-Type":
"application/json"
},
body:JSON.stringify({
title,
poster,
description,
movie
})
}
);

const data=await res.json();

if(data.success){

statusBox.textContent=
editId
? "Anime updated successfully."
: "Anime added successfully.";

resetAnimeForm();

await loadAnime();

}else{

statusBox.textContent=
data.error ||
"Could not save anime";

}

}catch(error){

statusBox.textContent=
"Network error";

}

}
);


// =====================================================
// EDIT ANIME
// =====================================================

function editAnime(item){

document
.getElementById("title")
.value=item.title || "";

document
.getElementById("poster")
.value=item.poster || "";

document
.getElementById("description")
.value=
item.description || "";

document
.getElementById("movie")
.checked=Boolean(item.movie);

const saveButton=
document.getElementById("animeSave");

saveButton.textContent=
"Update Anime";

saveButton.dataset.editId=
item.id;

document
.getElementById("animeCancel")
.classList.remove("hidden");

statusBox.textContent=
"Editing: "+item.title;

document
.getElementById("animeForm")
.scrollIntoView({
behavior:"smooth",
block:"center"
});

}


// =====================================================
// CANCEL ANIME EDIT
// =====================================================

function cancelAnimeEdit(){

resetAnimeForm();

statusBox.textContent=
"Anime edit cancelled.";

}


// =====================================================
// RESET ANIME FORM
// =====================================================

function resetAnimeForm(){

document
.getElementById("animeForm")
.reset();

const saveButton=
document.getElementById("animeSave");

delete saveButton.dataset.editId;

saveButton.textContent=
"Add Anime";

document
.getElementById("animeCancel")
.classList.add("hidden");

}


// =====================================================
// DELETE ANIME
// =====================================================

async function deleteAnime(id,title){

if(!confirm(
"Delete "+title+
" and ALL its episodes?"
)){

return;

}

try{

const res=await fetch(
"/api/admin/anime/"+id,
{
method:"DELETE"
}
);

const data=await res.json();

if(data.success){

statusBox.textContent=
"Anime deleted.";

await loadAnime();

document
.getElementById("episodeList")
.textContent=
"Select an anime to see episodes.";

}else{

alert(
data.error ||
"Delete failed"
);

}

}catch(error){

alert("Network error");

}

}


// =====================================================
// EPISODE ANIME DROPDOWN
// =====================================================

async function loadEpisodeAnime(){

const select=
document.getElementById(
"episodeAnime"
);

const res=await fetch(
"/api/admin/anime"
);

const data=await res.json();

if(!data.success)return;

const oldValue=
select.value;

select.innerHTML=
'<option value="">Select Anime</option>';

data.anime.forEach(
function(item){

const option=
document.createElement(
"option"
);

option.value=item.id;

option.textContent=
item.title;

select.appendChild(option);

});

if(oldValue){

select.value=oldValue;

}

}

function filterEpisodeAnime(){

const search=document.getElementById("episodeAnimeSearch").value.toLowerCase();
const select=document.getElementById("episodeAnime");

Array.from(select.options).forEach((option,index)=>{
if(index===0)return;
option.hidden=!option.textContent.toLowerCase().includes(search);
});

}

document.getElementById("episodeAnimeSearch").addEventListener("input",filterEpisodeAnime);



// =====================================================
// LOAD EPISODES
// =====================================================

async function loadEpisodes(){

const animeId=
document.getElementById(
"episodeAnime"
).value;

const list=
document.getElementById(
"episodeList"
);

if(!animeId){

list.innerHTML=
"Select an anime to see episodes.";

return;

}

list.textContent=
"Loading episodes...";

try{

const res=await fetch(
"/api/admin/anime/"
+animeId+
"/episodes"
);

const data=await res.json();

list.innerHTML="";

if(!data.success){

list.textContent=
data.error ||
"Could not load episodes";

return;

}

if(!data.episodes.length){

list.textContent=
"No episodes added yet.";

return;

}

data.episodes.forEach(
function(ep){

const row=
document.createElement("div");

row.className="episode";

const title=
document.createElement("div");

title.className=
"episodeTitle";

title.textContent=
"S"+ep.season+
" E"+ep.episode+
" ["+(ep.language || "Hindi")+"]"+
(ep.title
? " — "+ep.title
: "");

row.appendChild(title);


// URL INFO

const urls=
document.createElement("div");

urls.className="urlText";

const abyssUrl=
ep.url_360_server2 ||
ep.url_720_server2 ||
ep.url_1080_server2 ||
"Not set";

urls.innerHTML=
"Vidmoly 360p: "+
escapeHtml(ep.url_360 || "Not set")+
"<br>Vidmoly 720p: "+
escapeHtml(ep.url_720 || "Not set")+
"<br>Vidmoly 1080p: "+
escapeHtml(ep.url_1080 || "Not set")+
"<br>Abyss Video: "+
escapeHtml(abyssUrl);

row.appendChild(urls);


// ACTIONS

const actions=
document.createElement("div");

const edit=
document.createElement("button");

edit.className="small edit";

edit.textContent="Edit";

edit.onclick=function(){

editEpisode(ep);

};


const del=
document.createElement("button");

del.className=
"small delete";

del.textContent="Delete";

del.onclick=function(){

deleteEpisode(
ep.id
);

};

actions.appendChild(edit);

actions.appendChild(del);

row.appendChild(actions);

list.appendChild(row);

});

}catch(error){

list.textContent=
"Network error";

}

}


// =====================================================
// EDIT EPISODE
// =====================================================

function editEpisode(ep){

document
.getElementById("episodeAnime")
.value=ep.anime_id;

document
.getElementById("episodeSeason")
.value=ep.season || 1;

document
.getElementById("episodeNumber")
.value=ep.episode || "";

document
.getElementById("episodeLanguage")
.value=ep.language || "Hindi";

document
.getElementById("episodeTitle")
.value=ep.title || "";

document
.getElementById("url360")
.value=ep.url_360 || "";

document
.getElementById("url720")
.value=ep.url_720 || "";

document
.getElementById("url1080")
.value=ep.url_1080 || "";

document
.getElementById("urlServer2")
.value=ep.url_360_server2 || ep.url_720_server2 || ep.url_1080_server2 || "";

const saveButton=
document.getElementById(
"episodeSave"
);

saveButton.textContent=
"Update Episode";

saveButton.dataset.editId=
ep.id;

document
.getElementById("episodeCancel")
.classList.remove(
"hidden"
);

document
.getElementById("episodeStatus")
.textContent=
"Editing S"+
ep.season+
" E"+
ep.episode;

document
.getElementById("episodeSave")
.scrollIntoView({
behavior:"smooth",
block:"center"
});

}


// =====================================================
// CANCEL EPISODE EDIT
// =====================================================

function cancelEpisodeEdit(){

resetEpisodeForm();

document
.getElementById("episodeStatus")
.textContent=
"Episode edit cancelled.";

}


// =====================================================
// RESET EPISODE
// =====================================================

function resetEpisodeForm(){

document
.getElementById("episodeSeason")
.value=1;

document
.getElementById("episodeNumber")
.value="";

document
.getElementById("episodeTitle")
.value="";

document
.getElementById("url360")
.value="";

document
.getElementById("url720")
.value="";

document
.getElementById("url1080")
.value="";

document
.getElementById("urlServer2")
.value="";

const saveButton=
document.getElementById(
"episodeSave"
);

delete saveButton.dataset.editId;

saveButton.textContent=
"Add Episode";

document
.getElementById("episodeCancel")
.classList.add(
"hidden"
);

}


// =====================================================
// ADD / UPDATE EPISODE
// =====================================================

document
.getElementById("episodeSave")
.addEventListener(
"click",
async function(){

const anime_id=
document
.getElementById("episodeAnime")
.value;

const season=
document
.getElementById("episodeSeason")
.value;

const episode=
document
.getElementById("episodeNumber")
.value;

const language=
document
.getElementById("episodeLanguage")
.value;

const title=
document
.getElementById("episodeTitle")
.value
.trim();

const url_360=
document
.getElementById("url360")
.value
.trim();

const url_720=
document
.getElementById("url720")
.value
.trim();

const url_1080=
document
.getElementById("url1080")
.value
.trim();

const url_server2=
document
.getElementById("urlServer2")
.value
.trim();

const url_360_server2=url_server2;
const url_720_server2=url_server2;
const url_1080_server2=url_server2;

const saveButton=
document.getElementById(
"episodeSave"
);

const editId=
saveButton.dataset.editId;

if(!anime_id){

document
.getElementById("episodeStatus")
.textContent=
"Select anime.";

return;

}

if(!episode){

document
.getElementById("episodeStatus")
.textContent=
"Enter episode number.";

return;

}

document
.getElementById("episodeStatus")
.textContent=
editId
? "Updating..."
: "Saving...";

const url=editId
? "/api/admin/episodes/"+editId
: "/api/admin/episodes";

const method=editId
? "PUT"
: "POST";

try{

const res=await fetch(
url,
{
method,
headers:{
"Content-Type":
"application/json"
},
body:JSON.stringify({
anime_id,
season,
episode,
language,
title,
url_360,
url_720,
url_1080,
url_360_server2,
url_720_server2,
url_1080_server2
})
}
);

const data=await res.json();

if(data.success){

document
.getElementById("episodeStatus")
.textContent=
editId
? "Episode updated successfully."
: "Episode added successfully.";

resetEpisodeForm();

await loadEpisodes();

}else{

document
.getElementById("episodeStatus")
.textContent=
data.error ||
"Could not save episode";

}

}catch(error){

document
.getElementById("episodeStatus")
.textContent=
"Network error";

}

}
);


// =====================================================
// DELETE EPISODE
// =====================================================

async function deleteEpisode(id){

if(!confirm(
"Delete this episode?"
)){

return;

}

try{

const res=await fetch(
"/api/admin/episodes/"+id,
{
method:"DELETE"
}
);

const data=await res.json();

if(data.success){

document
.getElementById("episodeStatus")
.textContent=
"Episode deleted.";

await loadEpisodes();

}else{

alert(
data.error ||
"Delete failed"
);

}

}catch(error){

alert("Network error");

}

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHtml(value){

return String(value)
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");

}


// =====================================================
// LOGOUT
// =====================================================

async function logout(){

await fetch(
"/api/admin/logout"
);

location.href="/admin";

}


// =====================================================
// START
// =====================================================

loadAnime();

</script>

</body>

</html>`;
}
