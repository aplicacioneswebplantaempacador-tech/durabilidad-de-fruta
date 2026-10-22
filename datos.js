// =====================================================================
//  CAPA DE DATOS: Supabase (real) o Demo (guardado local en el equipo)
// =====================================================================
(function () {
  const C = window.CONFIG;
  const BUCKET = "fotos-durabilidad";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    }));
  const ahora = () => new Date().toISOString();

  // ------------------------------------------------------------------
  //  SUPABASE
  // ------------------------------------------------------------------
  function crearSupabase() {
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    return {
      modo: "supabase",
      async verificarPin(pin) { return ok(await sb.rpc("verificar_pin", { p_pin: pin })) === true; },
      async listarAuxiliares() {
        return ok(await sb.from("auxiliares").select("nombre").eq("activo", true).order("nombre")).map(a => a.nombre);
      },
      async listarEnsayos() {
        return ok(await sb.from("ensayos").select("*").neq("estado", "anulado").order("fecha_inicio", { ascending: false }).order("created_at", { ascending: false }));
      },
      async crearEnsayo(e) {
        const ens = ok(await sb.from("ensayos").insert(e).select().single());
        const muestras = Array.from({ length: ens.num_muestras }, (_, i) => ({ ensayo_id: ens.id, numero: i + 1 }));
        ok(await sb.from("muestras").insert(muestras));
        return ens;
      },
      async obtenerEnsayo(id) {
        const [ensayo, muestras, registros, lab] = await Promise.all([
          sb.from("ensayos").select("*").eq("id", id).single().then(ok),
          sb.from("muestras").select("*").eq("ensayo_id", id).order("numero").then(ok),
          sb.from("registros").select("*").eq("ensayo_id", id).then(ok),
          sb.from("laboratorio").select("*").eq("ensayo_id", id).order("dia").then(ok)
        ]);
        return { ensayo, muestras, registros, lab };
      },
      async actualizarEnsayo(id, campos) {
        return ok(await sb.from("ensayos").update({ ...campos, updated_at: ahora() }).eq("id", id).select().single());
      },
      async actualizarMuestra(id, campos) {
        return ok(await sb.from("muestras").update(campos).eq("id", id).select().single());
      },
      async guardarRegistro(r) {
        return ok(await sb.from("registros").upsert({ ...r, updated_at: ahora() }, { onConflict: "muestra_id,dia" }).select().single());
      },
      async guardarLab(l) {
        return ok(await sb.from("laboratorio").upsert({ ...l, updated_at: ahora() }, { onConflict: "ensayo_id,dia" }).select().single());
      },
      async subirFoto(blob, ruta) {
        ok(await sb.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" }));
        return ruta;
      },
      urlFoto(ruta) {
        if (!ruta) return null;
        return sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
      },
      async blobFoto(ruta) {
        const r = await fetch(this.urlFoto(ruta));
        if (!r.ok) throw new Error("No se pudo descargar la foto " + ruta);
        return r.blob();
      }
    };
  }

  // ------------------------------------------------------------------
  //  DEMO (IndexedDB local)
  // ------------------------------------------------------------------
  function crearDemo() {
    let dbp;
    const abrir = () => dbp || (dbp = new Promise((res, rej) => {
      const q = indexedDB.open("durabilidad-demo", 1);
      q.onupgradeneeded = () => { q.result.createObjectStore("kv"); };
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    }));
    const get = async k => { const db = await abrir(); return new Promise((res, rej) => { const t = db.transaction("kv").objectStore("kv").get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); };
    const put = async (k, v) => { const db = await abrir(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); };
    const tabla = async n => (await get("t_" + n)) || [];
    const guardarTabla = (n, v) => put("t_" + n, v);
    const urls = {};
    return {
      modo: "demo",
      async verificarPin(pin) { return pin === "2026"; },
      async listarAuxiliares() { return ["Auxiliar Demo 1", "Auxiliar Demo 2", "Auxiliar Demo 3"]; },
      async listarEnsayos() {
        return (await tabla("ensayos")).filter(e => e.estado !== "anulado")
          .sort((a, b) => (b.fecha_inicio + b.created_at).localeCompare(a.fecha_inicio + a.created_at));
      },
      async crearEnsayo(e) {
        const ens = { id: uid(), estado: "activo", created_at: ahora(), updated_at: ahora(), conclusion: null, ...e };
        const t = await tabla("ensayos"); t.push(ens); await guardarTabla("ensayos", t);
        const m = await tabla("muestras");
        for (let i = 1; i <= ens.num_muestras; i++) m.push({ id: uid(), ensayo_id: ens.id, numero: i, color_inicial: null, dia_fin_vida: null, motivo_fin: null });
        await guardarTabla("muestras", m);
        return ens;
      },
      async obtenerEnsayo(id) {
        const ensayo = (await tabla("ensayos")).find(e => e.id === id);
        const muestras = (await tabla("muestras")).filter(m => m.ensayo_id === id).sort((a, b) => a.numero - b.numero);
        const registros = (await tabla("registros")).filter(r => r.ensayo_id === id);
        const lab = (await tabla("laboratorio")).filter(r => r.ensayo_id === id).sort((a, b) => a.dia - b.dia);
        return { ensayo, muestras, registros, lab };
      },
      async actualizarEnsayo(id, campos) {
        const t = await tabla("ensayos"); const e = t.find(x => x.id === id); Object.assign(e, campos, { updated_at: ahora() });
        await guardarTabla("ensayos", t); return e;
      },
      async actualizarMuestra(id, campos) {
        const t = await tabla("muestras"); const e = t.find(x => x.id === id); Object.assign(e, campos);
        await guardarTabla("muestras", t); return e;
      },
      async guardarRegistro(r) {
        const t = await tabla("registros");
        let e = t.find(x => x.muestra_id === r.muestra_id && x.dia === r.dia);
        if (e) Object.assign(e, r, { updated_at: ahora() });
        else { e = { id: uid(), created_at: ahora(), updated_at: ahora(), novedades: [], ...r }; t.push(e); }
        await guardarTabla("registros", t); return e;
      },
      async guardarLab(l) {
        const t = await tabla("laboratorio");
        let e = t.find(x => x.ensayo_id === l.ensayo_id && x.dia === l.dia);
        if (e) Object.assign(e, l, { updated_at: ahora() });
        else { e = { id: uid(), created_at: ahora(), ...l }; t.push(e); }
        await guardarTabla("laboratorio", t); return e;
      },
      async subirFoto(blob, ruta) { await put("f_" + ruta, blob); delete urls[ruta]; return ruta; },
      urlFoto(ruta) {
        if (!ruta) return null;
        if (!urls[ruta]) {
          urls[ruta] = "about:blank";
          get("f_" + ruta).then(b => {
            if (!b) return;
            urls[ruta] = URL.createObjectURL(b);
            document.querySelectorAll(`img[data-ruta="${CSS.escape(ruta)}"]`).forEach(img => img.src = urls[ruta]);
          });
        }
        return urls[ruta] === "about:blank" ? "" : urls[ruta];
      },
      async blobFoto(ruta) { const b = await get("f_" + ruta); if (!b) throw new Error("Foto no encontrada"); return b; }
    };
  }

  window.DB = (C.SUPABASE_URL && C.SUPABASE_ANON_KEY) ? crearSupabase() : crearDemo();
})();
