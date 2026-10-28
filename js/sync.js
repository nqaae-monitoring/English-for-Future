/* =========================================================================
   English for Future — sync.js
   Cloud-synced progress. The Postgres row user_state(user_id) is the source
   of truth; localStorage "elh_state_v1" is the offline cache. Writes are
   debounced (2 s), queued while offline, flushed on reconnect; last-write-
   wins with an updated_at check so newer data is never silently wiped.
   Exposes window.ELH_SYNC.
   ========================================================================= */
(function () {
  "use strict";
  var STORE_KEY = "elh_state_v1";
  var client = null, uid = null, offlineMode = false;
  var baseUpdatedAt = null;      // server updated_at of the version we last loaded/saved
  var dirty = false, pending = false, timer = null, retryTimer = null, inflight = false;
  var status = "saved";          // saved | syncing | offline | error | local
  var listeners = [];

  function setStatus(s, detail) {
    status = s;
    var el = document.getElementById("sync-status");
    if (el) {
      var map = { saved: ["✓", "Saved to cloud"], syncing: ["⟳", "Syncing…"], offline: ["⚠", "Offline — changes queued"], error: ["⚠", "Sync error — will retry"], local: ["💾", "Local only (no account)"] };
      var m = map[s] || map.saved;
      el.textContent = m[0]; el.title = m[1]; el.setAttribute("data-state", s); el.setAttribute("aria-label", m[1]);
    }
    listeners.forEach(function (f) { try { f(s, detail); } catch (e) { } });
  }

  function readLocal() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; } }
  function writeLocal(state) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { } }
  function hasProgress(st) { return !!(st && ((st.activity && st.activity.length) || (st.vocab && Object.keys(st.vocab).length) || (st.totals && st.totals.lessons))); }

  /* ---------- start: load the cloud state (or offer to import local) ---------- */
  function start(auth) {
    offlineMode = !!auth.offline;
    if (offlineMode || !window.ELH_AUTH.client || !auth.user) { client = null; uid = null; setStatus("local"); return Promise.resolve(); }
    client = window.ELH_AUTH.client; uid = auth.user.id;
    setStatus("syncing");
    return client.rpc("load_state").then(function (r) {
      if (r.error) throw r.error;
      var row = r.data;
      var local = readLocal();
      if (row && row.state) {
        baseUpdatedAt = row.updated_at;
        writeLocal(row.state);
        window.ELH.setState(row.state);
        setStatus("saved");
        return;
      }
      // No cloud state yet
      if (hasProgress(local) && !localStorage.getItem("elh_import_decided_" + uid)) {
        return offerImport(local);
      }
      window.ELH.setState(null); // fresh default
      return pushNow(true);
    }).catch(function (err) {
      console.warn("sync start failed", err);
      // fall back to local cache so the learner can continue
      setStatus("offline");
      window.ELH.setState(readLocal());
      scheduleRetry();
    });
  }

  function offerImport(local) {
    return new Promise(function (resolve) {
      var ui = window.ELH.ui, t = window.ELH.t;
      ui.modal('<h2>' + t("Import your existing progress?", "Avvalgi natijalaringizni import qilaysizmi?") + '</h2>' +
        '<p class="small muted">' + t("This browser already has progress saved from before you created an account (" + (local.activity || []).length + " activities, " + Object.keys(local.vocab || {}).length + " vocabulary records). Import it into your new account, or start fresh.",
          "Bu brauzerda hisob yaratishdan oldingi natijalar bor (" + (local.activity || []).length + " ta faoliyat, " + Object.keys(local.vocab || {}).length + " ta lug‘at yozuvi). Ularni yangi hisobingizga import qilasizmi yoki noldan boshlaysizmi?") + '</p>' +
        '<div class="btn-row mt2"><button class="btn primary" id="imp-yes">⬆ ' + t("Import my existing progress", "Avvalgi natijalarni import qilish") + '</button><button class="btn" id="imp-no">' + t("Start fresh", "Noldan boshlash") + '</button></div>');
      document.getElementById("imp-yes").onclick = function () {
        ui.closeModal(); try { localStorage.setItem("elh_import_decided_" + uid, "1"); } catch (e) { }
        window.ELH.setState(local); pushNow(true).then(resolve, resolve);
      };
      document.getElementById("imp-no").onclick = function () {
        ui.closeModal(); try { localStorage.setItem("elh_import_decided_" + uid, "1"); } catch (e) { }
        window.ELH.setState(null); pushNow(true).then(resolve, resolve);
      };
    });
  }

  /* ---------- save (debounced) ---------- */
  function save(state) {
    writeLocal(state);
    if (!client) { setStatus("local"); return; }
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(function () { pushNow(false); }, 2000);
    if (status !== "offline") setStatus("syncing");
  }

  function pushNow(initial) {
    if (!client) return Promise.resolve();
    if (inflight) { pending = true; return Promise.resolve(); }
    if (!navigator.onLine) { setStatus("offline"); scheduleRetry(); return Promise.resolve(); }
    inflight = true; dirty = false;
    var state = window.ELH.state();
    setStatus("syncing");
    return client.rpc("save_state", { p_state: state, p_base_updated_at: baseUpdatedAt }).then(function (r) {
      inflight = false;
      if (r.error) throw r.error;
      var d = r.data || {};
      if (d.conflict) return resolveConflict(d);
      baseUpdatedAt = d.updated_at;
      setStatus("saved");
      if (pending || dirty) { pending = false; return pushNow(false); }
    }).catch(function (err) {
      inflight = false;
      console.warn("save_state failed", err);
      dirty = true;
      setStatus(navigator.onLine ? "error" : "offline");
      scheduleRetry();
    });
  }

  function resolveConflict(d) {
    // Another device saved a newer version. Never silently overwrite it.
    return new Promise(function (resolve) {
      var ui = window.ELH.ui, t = window.ELH.t;
      var remote = d.state, local = window.ELH.state();
      var ra = (remote && remote.activity && remote.activity.length) || 0, la = (local.activity && local.activity.length) || 0;
      ui.modal('<h2>' + t("Newer progress found on another device", "Boshqa qurilmada yangiroq natijalar topildi") + '</h2>' +
        '<p class="small muted">' + t("The cloud copy was updated after this device last synced. Which version do you want to keep?", "Bulutdagi nusxa bu qurilma oxirgi marta sinxronlangandan keyin yangilangan. Qaysi nusxani saqlab qolamiz?") + '</p>' +
        '<div class="grid cols-2 mt"><div class="card"><b>☁️ ' + t("Cloud version", "Bulutdagi nusxa") + '</b><div class="small muted">' + ra + ' ' + t("activities", "faoliyat") + ' · ' + new Date(d.updated_at).toLocaleString() + '</div></div>' +
        '<div class="card"><b>💻 ' + t("This device", "Bu qurilma") + '</b><div class="small muted">' + la + ' ' + t("activities", "faoliyat") + '</div></div></div>' +
        '<div class="btn-row mt2"><button class="btn primary" id="cf-cloud">' + t("Use cloud version", "Bulutdagi nusxani olish") + '</button><button class="btn" id="cf-local">' + t("Keep this device’s version", "Bu qurilmadagi nusxani saqlash") + '</button></div>');
      document.getElementById("cf-cloud").onclick = function () {
        ui.closeModal(); baseUpdatedAt = d.updated_at; writeLocal(remote); window.ELH.setState(remote); window.ELH.rerender(); setStatus("saved"); resolve();
      };
      document.getElementById("cf-local").onclick = function () {
        ui.closeModal(); baseUpdatedAt = d.updated_at; pushNow(false).then(resolve, resolve);
      };
    });
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { if (dirty || status === "offline" || status === "error") pushNow(false); }, 30000);
  }

  function flush() {
    clearTimeout(timer);
    if (!client || (!dirty && !inflight)) return Promise.resolve();
    return pushNow(false);
  }

  /* ---------- keepalive flush when the tab is hidden/closed ---------- */
  function beaconFlush() {
    if (!client || !dirty || !navigator.onLine) return;
    try {
      var s = client.auth.getSession; // async; use cached session from storage instead
      var tok = null;
      var key = Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter(function (k) { return /^sb-.*-auth-token$/.test(k); })[0];
      if (key) { var raw = sessionStorage.getItem(key) || localStorage.getItem(key); tok = raw && JSON.parse(raw).access_token; }
      if (!tok) return;
      var cfg = window.EFUTURE_CONFIG;
      fetch(cfg.SUPABASE_URL + "/rest/v1/rpc/save_state", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + tok },
        body: JSON.stringify({ p_state: window.ELH.state(), p_base_updated_at: baseUpdatedAt })
      }).catch(function () { });
      dirty = false;
    } catch (e) { }
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") beaconFlush(); });
  window.addEventListener("pagehide", beaconFlush);
  window.addEventListener("online", function () { if (client) { setStatus("syncing"); pushNow(false); } });
  window.addEventListener("offline", function () { if (client) setStatus("offline"); });

  window.ELH_SYNC = {
    start: start, save: save, flush: flush, status: function () { return status; },
    onStatus: function (f) { listeners.push(f); }, online: function () { return !!client; }
  };
})();
