export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Admin login page
    if (url.pathname === "/admin") {
      const cookie = request.headers.get("Cookie") || "";

      if (await isValidSession(cookie, env.ADMIN_PASSWORD)) {
        return new Response(adminPage(), {
          headers: { "Content-Type": "text/html; charset=UTF-8" }
        });
      }

      return new Response(loginPage(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    // Login API
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      try {
        const body = await request.json();
        const password = body.password || "";

        if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
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

    // Logout
    if (url.pathname === "/api/admin/logout") {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie":
            "admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
        }
      });
    }

    // Normal Anime Super website
    return env.ASSETS.fetch(request);
  }
};

async function createSession(secret) {
  const data = "AnimeSuperAdmin";
  return await hmac(secret, data);
}

async function isValidSession(cookieHeader, secret) {
  if (!secret) return false;

  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
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
body{
  margin:0;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#0b0b0f;
  color:white;
  font-family:Arial,sans-serif;
}
.box{
  width:min(90%,360px);
  background:#15151d;
  padding:25px;
  border-radius:16px;
  box-sizing:border-box;
}
h2{text-align:center;margin-top:0}
input,button{
  width:100%;
  padding:13px;
  margin-top:12px;
  border:0;
  border-radius:8px;
  box-sizing:border-box;
}
input{background:#242430;color:white}
button{background:#6c5ce7;color:white;font-weight:bold}
#error{color:#ff6b6b;text-align:center;margin-top:12px}
</style>
</head>
<body>
<div class="box">
<h2>Anime Super Admin</h2>
<form id="login">
<input id="password" type="password" placeholder="Admin password" required>
<button type="submit">Login</button>
<div id="error"></div>
</form>
</div>

<script>
document.getElementById("login").addEventListener("submit", async e=>{
  e.preventDefault();

  const password=document.getElementById("password").value;

  const res=await fetch("/api/admin/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });

  if(res.ok){
    location.href="/admin";
  }else{
    document.getElementById("error").textContent="Wrong password";
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
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anime Super Admin</title>
<style>
body{
  margin:0;
  padding:25px;
  background:#0b0b0f;
  color:white;
  font-family:Arial,sans-serif;
}
button{
  padding:12px 18px;
  border:0;
  border-radius:8px;
  background:#6c5ce7;
  color:white;
}
</style>
</head>
<body>
<h1>Anime Super Admin</h1>
<p>Login successful.</p>
<button onclick="logout()">Logout</button>

<script>
async function logout(){
  await fetch("/api/admin/logout");
  location.href="/admin";
}
</script>
</body>
</html>`;
}
