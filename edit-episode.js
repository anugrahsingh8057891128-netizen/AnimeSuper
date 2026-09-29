const edit=document.createElement("button");
edit.textContent="Edit";

edit.onclick=function(){
  document.getElementById("episodeSeason").value=ep.season;
  document.getElementById("episodeNumber").value=ep.episode;
  document.getElementById("episodeTitle").value=ep.title || "";
  document.getElementById("url360").value=ep.url_360 || "";
  document.getElementById("url720").value=ep.url_720 || "";
  document.getElementById("url1080").value=ep.url_1080 || "";

  document.getElementById("episodeSave").textContent="Update Episode";
  document.getElementById("episodeSave").dataset.editId=ep.id;

  document.getElementById("episodeStatus").textContent=
    "Editing S"+ep.season+" E"+ep.episode;
};

row.appendChild(edit);
