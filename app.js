// =====================================================================
//  APP · Durabilidad de Fruta · Agrícola Guapa
// =====================================================================
(function () {
  const C = window.CONFIG, DB = window.DB, K = window.CALC;
  const $ = s => document.querySelector(s);
  const app = $("#app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const difDias = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
  const semanaISO = f => { const d = new Date(f + "T12:00:00"); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const s1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - s1) / 864e5 - 3 + (s1.getDay() + 6) % 7) / 7); };
  const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

  const S = { auxiliar: null, ensayoId: null, dia: 0, datos: null };

  // ---------------- utilidades de interfaz ----------------
  let tt;
  function toast(msg, error = false) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast" + (error ? " error" : ""); t.hidden = false;
    clearTimeout(tt); tt = setTimeout(() => t.hidden = true, error ? 4500 : 2200);
  }
  function cargando(on, txt = "Cargando…") { $("#cargando").hidden = !on; $("#cargandoTxt").textContent = txt; }
  async function tarea(txt, fn) {
    cargando(true, txt);
    try { return await fn(); }
    catch (e) { console.error(e); toast("Error: " + (e.message || e), true); throw e; }
    finally { cargando(false); }
  }

  // ---------------- arranque ----------------
  function iniciar() {
    if (DB.modo === "demo") $("#avisoDemo").hidden = false;
    $("#btnInicio").onclick = () => S.auxiliar && irInicio();
    $("#chipAux").onclick = () => vistaAuxiliar();
    const pin = ls.get("pin_ok");
    if (!pin || pin < Date.now()) return vistaPin();
    const aux = ls.get("auxiliar");
    if (!aux || aux.fecha !== hoyISO()) return vistaAuxiliar();
    ponerAuxiliar(aux.nombre);
    const ult = ls.get("ultimo_ensayo");
    ult ? abrirEnsayo(ult).catch(irInicio) : irInicio();
  }

  function ponerAuxiliar(n) {
    S.auxiliar = n; const c = $("#chipAux"); c.hidden = !n; c.textContent = "👤 " + n;
  }

  // ---------------- PIN ----------------
  function vistaPin() {
    let pin = "";
    $("#chipAux").hidden = true;
    app.innerHTML = `<div class="pin-caja">
      <img src="icono-512.png" class="pin-logo" alt="Durabilidad de Fruta">
      <h2>Ingrese el PIN</h2><p class="suave">Solo para auxiliares de calidad</p>
      <div class="pin-puntos">${"<i></i>".repeat(4)}</div>
      <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map(n => n === "" ? "<span></span>" : `<button data-n="${n}">${n}</button>`).join("")}</div>
      ${DB.modo === "demo" ? `<p class="suave peq" style="margin-top:18px">Modo demo: el PIN es <b>2026</b></p>` : ""}
    </div>`;
    const puntos = [...app.querySelectorAll(".pin-puntos i")];
    const pintar = () => puntos.forEach((p, i) => p.classList.toggle("lleno", i < pin.length));
    app.querySelectorAll(".teclado button").forEach(b => b.onclick = async () => {
      const n = b.dataset.n;
      if (n === "⌫") pin = pin.slice(0, -1); else if (pin.length < 4) pin += n;
      pintar();
      if (pin.length >= 4) {
        let ok = false;
        try { ok = await DB.verificarPin(pin); } catch (e) { toast("Sin conexión: " + e.message, true); return; }
        if (ok) { ls.set("pin_ok", Date.now() + 12 * 3600e3); vistaAuxiliar(); }
        else { toast("PIN incorrecto", true); pin = ""; setTimeout(pintar, 250); }
      }
    });
  }

  // ---------------- AUXILIAR ----------------
  async function vistaAuxiliar() {
    app.innerHTML = `<div class="tarjeta" style="max-width:460px;margin:20px auto;text-align:left"><img src="icono-192.png" alt="" style="width:64px;height:64px;border-radius:16px;float:right;margin-left:10px"><h2>¿Quién registra hoy?</h2>
      <p class="suave">Seleccione su nombre. Quedará en cada dato y foto que tome hoy.</p><div class="lista-aux" id="listaAux"><p class="suave">Cargando…</p></div></div>`;
    let lista = [];
    try { lista = await DB.listarAuxiliares(); } catch (e) { toast(e.message, true); }
    $("#listaAux").innerHTML = lista.length ? lista.map(n => `<button data-n="${esc(n)}">${esc(n)}</button>`).join("")
      : `<p class="suave">No hay auxiliares registrados. Pídale al líder que los agregue en Supabase.</p>`;
    $("#listaAux").querySelectorAll("button").forEach(b => b.onclick = () => {
      ls.set("auxiliar", { nombre: b.dataset.n, fecha: hoyISO() }); ponerAuxiliar(b.dataset.n);
      S.ensayoId ? abrirEnsayo(S.ensayoId) : irInicio();
    });
  }

  // ---------------- INICIO: lista de ensayos ----------------
  async function irInicio() {
    S.ensayoId = null; ls.set("ultimo_ensayo", null);
    app.innerHTML = `<div class="fila entre"><h2>Ensayos</h2></div><div id="lista"><p class="suave">Cargando…</p></div>
      <button class="btn btn-pri btn-flotante" id="btnNuevo">＋ Nuevo ensayo</button>`;
    $("#btnNuevo").onclick = vistaNuevo;
    let ens = [];
    try { ens = await DB.listarEnsayos(); } catch (e) { toast(e.message, true); }
    const activos = ens.filter(e => e.estado === "activo"), cerrados = ens.filter(e => e.estado === "cerrado");
    const item = e => {
      const dia = Math.max(0, Math.min(e.dias_ensayo, difDias(e.fecha_inicio, hoyISO())));
      const pct = e.estado === "cerrado" ? 100 : Math.round(dia / e.dias_ensayo * 100);
      return `<div class="tarjeta ensayo-item" data-id="${e.id}">
        <div class="fila entre"><h3>Lote ${esc(e.lote)}${e.bloque ? " · Bloque " + esc(e.bloque) : ""}</h3>
        <span class="etq ${e.estado === "activo" ? "verde" : "gris"}">${e.estado === "activo" ? "Día " + dia + " de " + e.dias_ensayo : "Cerrado"}</span></div>
        <div class="etiquetas"><span class="etq">Forza ${esc(e.grupo_forza)}</span>${e.subgrupo_maduracion ? `<span class="etq">Subgrupo ${esc(e.subgrupo_maduracion)}</span>` : ""}
        <span class="etq">Inicio ${K.fechaLarga(e.fecha_inicio)}</span><span class="etq">${e.num_muestras} muestras</span></div>
        <div class="barra-prog"><div style="width:${pct}%"></div></div></div>`;
    };
    $("#lista").innerHTML = (!ens.length ? `<div class="vacio"><img src="icono-192.png" alt="" style="width:84px;height:84px;border-radius:20px;box-shadow:0 6px 18px rgba(27,94,32,.25)"><p>Aún no hay ensayos.<br>Toque <b>Nuevo ensayo</b> para empezar.</p></div>` : "") +
      (activos.length ? `<div class="titulo-seccion">En curso (${activos.length})</div>` + activos.map(item).join("") : "") +
      (cerrados.length ? `<div class="titulo-seccion">Cerrados (${cerrados.length})</div>` + cerrados.map(item).join("") : "");
    app.querySelectorAll(".ensayo-item").forEach(el => el.onclick = () => abrirEnsayo(el.dataset.id));
  }

  // ---------------- NUEVO ENSAYO ----------------
  function vistaNuevo() {
    const h = hoyISO();
    app.innerHTML = `<h2 style="margin-bottom:12px">Nuevo ensayo de durabilidad</h2>
    <form id="fNuevo">
      <div class="tarjeta">
        <div class="titulo-seccion" style="margin-top:0">Origen de la fruta</div>
        <div class="rejilla2">
          <label class="campo"><span>Lote *</span><input class="entrada" name="lote" required inputmode="numeric"></label>
          <label class="campo"><span>Bloque</span><input class="entrada" name="bloque"></label>
          <label class="campo"><span>Grupo Forza *</span><input class="entrada" name="grupo_forza" required></label>
          <label class="campo"><span>Subgrupo maduración</span><input class="entrada" name="subgrupo_maduracion" placeholder="Ej: 1 - C"></label>
          <label class="campo"><span>Calibre</span><input class="entrada" name="calibre" placeholder="Ej: PE1"></label>
          <label class="campo"><span>Temperatura de almacenamiento</span><input class="entrada" name="temperatura_almacen" placeholder="Ej: 30 °C ambiente"></label>
        </div>
      </div>
      <div class="tarjeta">
        <div class="titulo-seccion" style="margin-top:0">Tratamiento (si aplica)</div>
        <div class="rejilla2">
          <label class="campo"><span>Aplicación con</span><input class="entrada" name="aplicacion" placeholder="Producto aplicado"></label>
          <label class="campo"><span>Dosis</span><input class="entrada" name="dosis"></label>
        </div>
      </div>
      <div class="tarjeta">
        <div class="titulo-seccion" style="margin-top:0">Plan del ensayo</div>
        <div class="rejilla3">
          <label class="campo"><span>Fecha inicio (Día 0)</span><input class="entrada" type="date" name="fecha_inicio" value="${h}" required></label>
          <label class="campo"><span>N.º de muestras</span><input class="entrada" type="number" name="num_muestras" value="${C.NUM_MUESTRAS}" min="1" max="30" required></label>
          <label class="campo"><span>Días de seguimiento</span><input class="entrada" type="number" name="dias_ensayo" value="${C.DIAS_ENSAYO}" min="1" max="30" required></label>
        </div>
        <p class="suave peq">Laboratorio (Brix, acidez, translucidez, temperatura) se pedirá los días ${C.DIAS_LABORATORIO.join(", ")}.</p>
      </div>
      <div class="fila"><button type="button" class="btn btn-borde" id="cancelar">Cancelar</button><button class="btn btn-pri" style="flex:1">Crear ensayo</button></div>
    </form>`;
    $("#cancelar").onclick = irInicio;
    $("#fNuevo").onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      Object.keys(f).forEach(k => { f[k] = String(f[k]).trim(); if (f[k] === "") f[k] = null; });
      f.num_muestras = +f.num_muestras; f.dias_ensayo = +f.dias_ensayo;
      f.semana = semanaISO(f.fecha_inicio); f.creado_por = S.auxiliar;
      const ens = await tarea("Creando ensayo…", () => DB.crearEnsayo(f));
      toast("Ensayo creado ✓"); abrirEnsayo(ens.id);
    };
  }

  // ---------------- ENSAYO: tablero diario ----------------
  async function recargar() { S.datos = await DB.obtenerEnsayo(S.ensayoId); }

  async function abrirEnsayo(id, dia) {
    S.ensayoId = id; ls.set("ultimo_ensayo", id);
    await tarea("Abriendo ensayo…", recargar);
    if (!S.datos.ensayo) { ls.set("ultimo_ensayo", null); return irInicio(); }
    const e = S.datos.ensayo;
    S.dia = dia ?? Math.max(0, Math.min(e.dias_ensayo, difDias(e.fecha_inicio, hoyISO())));
    vistaEnsayo();
  }

  const diasLab = e => C.DIAS_LABORATORIO.filter(d => d <= e.dias_ensayo);
  const regDe = (mid, d) => S.datos.registros.find(r => r.muestra_id === mid && r.dia === d);
  const activaEnDia = (m, d) => m.dia_fin_vida == null || d <= m.dia_fin_vida;

  function vistaEnsayo() {
    const { ensayo: e, muestras, registros, lab } = S.datos;
    const hoyDia = difDias(e.fecha_inicio, hoyISO());
    const dl = diasLab(e);
    const conteo = d => registros.filter(r => r.dia === d).length;
    const activasEn = d => muestras.filter(m => activaEnDia(m, d)).length;
    const d = S.dia;
    const labHoy = lab.find(l => l.dia === d) || {};
    const fechaDia = new Date(e.fecha_inicio + "T12:00:00"); fechaDia.setDate(fechaDia.getDate() + d);
    const hechas = muestras.filter(m => regDe(m.id, d)).length, pend = muestras.filter(m => activaEnDia(m, d) && !regDe(m.id, d)).length;

    app.innerHTML = `
    <div class="tarjeta cab-ensayo">
      <div class="fila entre"><h2>Lote ${esc(e.lote)}${e.bloque ? " · Bloque " + esc(e.bloque) : ""}</h2>
        <span class="etq ${e.estado === "activo" ? "verde" : "gris"}">${e.estado === "activo" ? "En curso" : "Cerrado"}</span></div>
      <div class="datos-mini">
        <div>Grupo Forza<b>${esc(e.grupo_forza)}</b></div>
        <div>Subgrupo<b>${esc(e.subgrupo_maduracion || "—")}</b></div>
        <div>Calibre<b>${esc(e.calibre || "—")}</b></div>
        <div>Inicio · Sem ${e.semana || "—"}<b>${K.fechaLarga(e.fecha_inicio)}</b></div>
        ${e.aplicacion ? `<div>Aplicación<b>${esc(e.aplicacion)} ${e.dosis ? "· " + esc(e.dosis) : ""}</b></div>` : ""}
      </div>
    </div>

    <div class="dias" id="dias">${Array.from({ length: e.dias_ensayo + 1 }, (_, i) => {
      const c = conteo(i), a = activasEn(i);
      return `<div class="dia ${i === d ? "activo" : ""} ${c && c >= a ? "completo" : ""} ${i === hoyDia ? "hoy" : ""}" data-d="${i}">
        <small>${i === hoyDia ? "HOY" : "Día"}</small><b>${i}</b><small>${c}/${a}</small>${dl.includes(i) ? `<div class="lab">LAB</div>` : ""}</div>`;
    }).join("")}</div>

    <div class="fila entre" style="margin:6px 2px 12px">
      <div><b style="font-size:18px">Día ${d}</b> <span class="suave">· ${fechaDia.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" })}</span></div>
      <div class="suave peq">${hechas} registradas${pend ? ` · <b style="color:var(--naranja)">${pend} pendientes</b>` : ""}</div>
    </div>
    ${d > hoyDia ? `<div class="tarjeta" style="background:#fff8e1">⚠️ Este día todavía no ha llegado según la fecha de inicio. Verifique que está en el día correcto.</div>` : ""}

    ${dl.includes(d) ? `<div class="tarjeta lab-card">
      <div class="fila entre"><h3>🧪 Laboratorio · Día ${d}</h3>${labHoy.id ? `<span class="etq verde">Guardado</span>` : `<span class="etq rojo">Pendiente</span>`}</div>
      <form id="fLab" class="rejilla2" style="margin-top:12px">
        <label class="campo"><span>Brix (°Bx)</span><input class="entrada" name="brix" type="number" step="0.1" inputmode="decimal" value="${labHoy.brix ?? ""}"></label>
        <label class="campo"><span>Acidez (%)</span><input class="entrada" name="acidez" type="number" step="0.01" inputmode="decimal" value="${labHoy.acidez ?? ""}"></label>
        <label class="campo"><span>Translucidez (%)</span><input class="entrada" name="translucidez_pct" type="number" step="0.1" min="0" max="100" inputmode="decimal" value="${labHoy.translucidez_pct ?? ""}" placeholder="0 a 100"></label>
        <label class="campo"><span>Temperatura (°C)</span><input class="entrada" name="temperatura" type="number" step="0.1" inputmode="decimal" value="${labHoy.temperatura ?? ""}"></label>
        <button class="btn btn-sec" style="grid-column:1/-1">Guardar laboratorio</button>
      </form></div>` : ""}

    <div class="titulo-seccion">Muestras · toque una para registrar</div>
    <div class="muestras">${muestras.map(m => tarjetaMuestra(m, d)).join("")}</div>

    <div class="fila" style="margin-top:22px">
      <button class="btn btn-borde" id="btnVolver">← Ensayos</button>
      <button class="btn btn-pri" style="flex:1" id="btnResumen">📊 Ver resumen e informe</button>
    </div>`;

    app.querySelectorAll(".dia").forEach(el => el.onclick = () => { S.dia = +el.dataset.d; vistaEnsayo(); });
    const act = app.querySelector(".dia.activo"); act && act.scrollIntoView({ inline: "center", block: "nearest" });
    app.querySelectorAll(".muestra").forEach(el => el.onclick = () => abrirRegistro(el.dataset.id));
    $("#btnVolver").onclick = irInicio;
    $("#btnResumen").onclick = vistaResumen;
    const fl = $("#fLab");
    if (fl) fl.onsubmit = async ev => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(fl));
      const val = k => f[k] === "" ? null : Number(String(f[k]).replace(",", "."));
      const reg = { ensayo_id: e.id, dia: d, brix: val("brix"), acidez: val("acidez"), translucidez_pct: val("translucidez_pct"), temperatura: val("temperatura"), auxiliar: S.auxiliar };
      if (reg.translucidez_pct != null && (reg.translucidez_pct < 0 || reg.translucidez_pct > 100)) return toast("La translucidez va de 0 a 100 %", true);
      await tarea("Guardando…", () => DB.guardarLab(reg)); await recargar(); toast("Laboratorio guardado ✓"); vistaEnsayo();
    };
  }

  function tarjetaMuestra(m, d) {
    const r = regDe(m.id, d);
    const ret = m.dia_fin_vida != null && d > m.dia_fin_vida;
    const retHoy = m.dia_fin_vida === d;
    const nov = r && (r.novedades || []).length;
    let cls = "muestra", sello = "";
    if (ret) { cls += " retirada"; sello = `<span class="sello ret">✖ Retirada día ${m.dia_fin_vida}</span>`; }
    else if (retHoy) { cls += " retirada"; sello = `<span class="sello ret">✖ No comercial</span>`; }
    else if (nov) { cls += " novedad"; sello = `<span class="sello nov">⚠ Novedad</span>`; }
    else if (r) { cls += " hecha"; sello = `<span class="sello ok">✓ Listo</span>`; }
    const url = r && r.foto_path ? DB.urlFoto(r.foto_path) : null;
    return `<div class="${cls}" data-id="${m.id}">${sello}
      <div class="foto">${url !== null && r && r.foto_path ? `<img data-ruta="${esc(r.foto_path)}" src="${url}" loading="lazy" alt="">` : `<span style="font-size:30px">📷</span>${ret ? "Fuera del ensayo" : "Sin registro"}`}</div>
      <div class="info"><span class="num">M${m.numero}</span>
      ${r && r.color != null ? `<span class="burbuja" style="background:${K.colorHex(r.color)};color:${K.textoSobre(r.color)}">${K.num(r.color)}</span>` : `<span class="suave peq">${m.color_inicial != null ? "Ini " + K.num(m.color_inicial) : ""}</span>`}</div></div>`;
  }

  // ---------------- HOJA DE REGISTRO DE UNA MUESTRA ----------------
  async function prepararFoto(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
    const w = bmp.width, h = bmp.height, k = Math.min(1, C.FOTO_LADO_MAX / Math.max(w, h));
    const cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const cx = cv.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise(res => cv.toBlob(res, "image/jpeg", C.FOTO_CALIDAD));
  }

  function abrirRegistro(mid) {
    const { ensayo: e, muestras } = S.datos;
    const m = muestras.find(x => x.id === mid), d = S.dia;
    const r = regDe(mid, d) || {};
    const prev = [...S.datos.registros].filter(x => x.muestra_id === mid && x.dia < d && x.color != null).sort((a, b) => b.dia - a.dia)[0];
    const st = {
      color: r.color != null ? Number(r.color) : null, apariencia: r.apariencia || null, novedades: [...(r.novedades || [])],
      observacion: r.observacion || "", noComercial: m.dia_fin_vida === d || !!r.no_comercial, motivo: m.motivo_fin || "",
      fotoBlob: null, fotoURL: r.foto_path ? DB.urlFoto(r.foto_path) : null, fotoPath: r.foto_path || null
    };
    const retiradaAntes = m.dia_fin_vida != null && m.dia_fin_vida < d;
    const hoja = $("#hoja");
    const idx = muestras.indexOf(m);

    hoja.innerHTML = `<div class="hoja-cuerpo">
      <div class="hoja-cab">
        <button class="nav-m" id="mAnt" ${idx === 0 ? "disabled" : ""}>‹</button>
        <div style="text-align:center"><h2>Muestra ${m.numero}</h2><div class="suave peq">Día ${d} · Lote ${esc(e.lote)}</div></div>
        <div class="fila" style="gap:6px"><button class="nav-m" id="mSig" ${idx === muestras.length - 1 ? "disabled" : ""}>›</button><button class="x" id="cerrarH">✕</button></div>
      </div>
      ${retiradaAntes ? `<div class="tarjeta" style="background:var(--rojo-claro)">Esta muestra fue declarada <b>no comercial el día ${m.dia_fin_vida}</b>. Puede registrar si quiere seguir observándola, pero no es obligatorio.</div>` : ""}

      <div class="bloque-form"><div class="lbl">1. Foto <small>${d === 0 ? "foto inicial" : ""}</small></div>
        <div class="zona-foto" id="zonaFoto">${st.fotoPath ? `<img src="${st.fotoURL}" ${st.fotoPath ? `data-ruta="${esc(st.fotoPath)}"` : ""}>` : `<div class="cam">📷</div>Tomar foto`}</div>
        <div class="acciones-foto"><button class="btn btn-sec" id="bCam">📷 Cámara</button><button class="btn btn-borde" id="bGal">🖼️ Galería</button></div>
        <input type="file" accept="image/*" capture="environment" id="inCam" hidden>
        <input type="file" accept="image/*" id="inGal" hidden>
      </div>

      <div class="bloque-form"><div class="lbl">2. Color externo <small>${prev ? `día ${prev.dia}: <b>${K.num(prev.color)}</b>` : "escala 0 a 6"}</small></div>
        <div class="colores" id="colores">${K.ESCALA.map(v => `<button type="button" data-v="${v}" class="${st.color === v ? "sel" : ""} ${prev && Number(prev.color) === v ? "prev" : ""}" style="background:${K.colorHex(v)};color:${K.textoSobre(v)}">${K.num(v)}</button>`).join("")}</div>
      </div>

      <div class="bloque-form"><div class="lbl">3. Apariencia general</div>
        <div class="segmento" id="apar">${["Buena", "Regular", "Mala"].map(v => `<button type="button" data-v="${v}" class="${st.apariencia === v ? "sel" : ""}">${v}</button>`).join("")}</div>
      </div>

      <div class="bloque-form"><div class="lbl">4. Novedades <small>marque todas las que vea</small></div>
        <div class="chips" id="novs">${C.NOVEDADES.map(n => `<button type="button" class="${st.novedades.includes(n) ? "sel" : ""}" data-v="${esc(n)}">${esc(n)}</button>`).join("")}</div>
      </div>

      <div class="bloque-form"><div class="lbl">5. Observación del día</div>
        <textarea class="entrada" id="obs" placeholder="¿Cómo se ve la fruta? corona, base, cáscara, olor…">${esc(st.observacion)}</textarea>
      </div>

      ${!retiradaAntes ? `<div class="bloque-form">
        <div class="interruptor ${st.noComercial ? "on" : ""}" id="swNC"><div><b>Ya no es comercial</b><div class="suave peq">Márquelo el día en que la fruta deja de servir para la venta. La muestra sale del ensayo.</div></div><div class="sw"></div></div>
        <label class="campo" id="motivoBox" style="margin-top:10px" ${st.noComercial ? "" : "hidden"}><span>Motivo principal</span><input class="entrada" id="motivo" value="${esc(st.motivo)}" placeholder="Ej: pudrición en base"></label>
      </div>` : ""}
    </div>
    <div class="hoja-pie"><button class="btn btn-borde" id="gSolo">Guardar</button><button class="btn btn-pri" id="gSig">${idx < muestras.length - 1 ? "Guardar y siguiente ›" : "Guardar y terminar"}</button></div>`;
    hoja.hidden = false; document.body.style.overflow = "hidden";

    const cerrar = () => { hoja.hidden = true; hoja.innerHTML = ""; document.body.style.overflow = ""; };
    $("#cerrarH").onclick = () => { cerrar(); vistaEnsayo(); };
    $("#mAnt").onclick = () => abrirRegistro(muestras[idx - 1].id);
    $("#mSig").onclick = () => abrirRegistro(muestras[idx + 1].id);

    const tomar = async inp => {
      const f = inp.files[0]; if (!f) return;
      cargando(true, "Procesando foto…");
      try {
        st.fotoBlob = await prepararFoto(f);
        st.fotoURL = URL.createObjectURL(st.fotoBlob);
        $("#zonaFoto").innerHTML = `<img src="${st.fotoURL}">`;
      } catch (e) { toast("No se pudo leer la foto", true); }
      finally { cargando(false); inp.value = ""; }
    };
    $("#zonaFoto").onclick = $("#bCam").onclick = () => $("#inCam").click();
    $("#bGal").onclick = () => $("#inGal").click();
    $("#inCam").onchange = ev => tomar(ev.target);
    $("#inGal").onchange = ev => tomar(ev.target);

    hoja.querySelectorAll("#colores button").forEach(b => b.onclick = () => {
      st.color = Number(b.dataset.v); hoja.querySelectorAll("#colores button").forEach(x => x.classList.toggle("sel", x === b));
    });
    hoja.querySelectorAll("#apar button").forEach(b => b.onclick = () => {
      st.apariencia = b.dataset.v; hoja.querySelectorAll("#apar button").forEach(x => x.classList.toggle("sel", x === b));
    });
    hoja.querySelectorAll("#novs button").forEach(b => b.onclick = () => {
      const v = b.dataset.v, i = st.novedades.indexOf(v);
      i >= 0 ? st.novedades.splice(i, 1) : st.novedades.push(v); b.classList.toggle("sel", i < 0);
    });
    const sw = $("#swNC");
    if (sw) sw.onclick = () => { st.noComercial = !st.noComercial; sw.classList.toggle("on", st.noComercial); $("#motivoBox").hidden = !st.noComercial; };

    const guardar = async siguiente => {
      st.observacion = $("#obs").value.trim();
      if ($("#motivo")) st.motivo = $("#motivo").value.trim();
      if (st.color == null) return toast("Seleccione el color", true);
      if (!st.apariencia) return toast("Seleccione la apariencia", true);
      if (!st.fotoBlob && !st.fotoPath && !confirm("No ha tomado foto. ¿Guardar sin foto?")) return;
      if (st.noComercial && !st.motivo && !st.novedades.length) return toast("Indique el motivo por el que ya no es comercial", true);
      await tarea("Guardando…", async () => {
        let ruta = st.fotoPath;
        if (st.fotoBlob) ruta = await DB.subirFoto(st.fotoBlob, `${e.id}/M${String(m.numero).padStart(2, "0")}_D${String(d).padStart(2, "0")}_${Date.now()}.jpg`);
        await DB.guardarRegistro({
          ensayo_id: e.id, muestra_id: m.id, dia: d, fecha: hoyISO(), color: st.color, apariencia: st.apariencia,
          novedades: st.novedades, observacion: st.observacion || null, foto_path: ruta, no_comercial: st.noComercial, auxiliar: S.auxiliar
        });
        const cambios = {};
        if (d === 0 || m.color_inicial == null) { if (d === 0) cambios.color_inicial = st.color; }
        if (!retiradaAntes) {
          if (st.noComercial && m.dia_fin_vida !== d) { cambios.dia_fin_vida = d; cambios.motivo_fin = st.motivo || st.novedades.join(", "); }
          else if (st.noComercial) cambios.motivo_fin = st.motivo || st.novedades.join(", ");
          else if (!st.noComercial && m.dia_fin_vida === d) { cambios.dia_fin_vida = null; cambios.motivo_fin = null; }
        }
        if (Object.keys(cambios).length) await DB.actualizarMuestra(m.id, cambios);
        await recargar();
      });
      toast(`Muestra ${m.numero} guardada ✓`);
      const sig = muestras.slice(idx + 1).find(x => activaEnDia(x, d) && !regDe(x.id, d)) || muestras[idx + 1];
      if (siguiente && sig && idx < muestras.length - 1) abrirRegistro(sig.id);
      else { cerrar(); vistaEnsayo(); }
    };
    $("#gSolo").onclick = () => guardar(false).catch(() => { });
    $("#gSig").onclick = () => guardar(true).catch(() => { });
  }

  // ---------------- RESUMEN ----------------
  async function vistaResumen() {
    await tarea("Calculando…", recargar);
    const { ensayo: e } = S.datos;
    const A = K.analizar(S.datos);
    const dl = diasLab(e);
    app.innerHTML = `
    <div class="fila entre" style="margin-bottom:12px"><button class="btn btn-borde" id="volverE">← Volver</button><h2 style="text-align:right">Resumen · Lote ${esc(e.lote)}</h2></div>
    <div class="concepto" style="background:${A.concepto.color}"><div class="peq" style="opacity:.85;font-weight:700">CONCEPTO GENERAL</div><h3>${A.concepto.nivel}</h3><div>${esc(A.concepto.texto)}</div></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${A.nComerciales && A.ultimoDia ? "≥ " : ""}${K.num(A.durabilidadProm)}</div><div class="l">Durabilidad promedio (días)${A.nComerciales && A.ultimoDia ? " · aún hay muestras comerciales" : ""}</div></div>
      <div class="kpi"><div class="v">${A.nComerciales}/${A.N}</div><div class="l">Muestras comerciales al día ${A.ultimoDia}</div></div>
      <div class="kpi"><div class="v"><span style="color:${K.colorHex(A.colorIni)}">${K.num(A.colorIni)}</span> → <span style="color:${K.colorHex(A.colorFin)}">${K.num(A.colorFin)}</span></div><div class="l">Color promedio inicial → final</div></div>
      <div class="kpi"><div class="v">${A.velocidad != null ? "+" + K.num(A.velocidad, 2) : "—"}</div><div class="l">Avance de color por día</div></div>
      <div class="kpi"><div class="v">${A.primeraNov ? "Día " + A.primeraNov.primeraNovedad.dia : "—"}</div><div class="l">Primera novedad ${A.primeraNov ? "(M" + A.primeraNov.numero + ")" : ""}</div></div>
    </div>

    <div class="titulo-seccion">Resumen ejecutivo</div>
    <div class="tarjeta parrafos">${A.textos.map(t => `<p>${esc(t)}</p>`).join("") || "<p class='suave'>Sin datos aún.</p>"}</div>

    <div class="titulo-seccion">Evolución del color</div>
    <div class="tarjeta grafica">${K.graficaSVG(A)}</div>

    <div class="titulo-seccion">Color por muestra y día</div>
    <div class="tarjeta tabla-scroll">${matrizHTML(A)}
      <div class="leyenda-escala">${K.ESCALA.map(v => `<div style="background:${K.colorHex(v)};color:${K.textoSobre(v)}">${K.num(v)}</div>`).join("")}</div>
      <p class="suave peq">⚠ = novedad ese día · ✖ = día en que se declaró no comercial</p></div>

    <div class="titulo-seccion">Durabilidad por muestra</div>
    <div class="tarjeta tabla-scroll"><table class="simple"><tr><th>Muestra</th><th>Color ini.</th><th>Color final</th><th>Días comercial</th><th>Primera novedad</th><th>Motivo de retiro</th></tr>
      ${A.ms.map(m => `<tr><td><b>M${m.numero}</b></td><td>${K.num(m.colorInicial)}</td><td>${K.num(m.colorFinal)}</td>
      <td>${m.retirada ? `<b style="color:var(--rojo)">${m.diaFin}</b>` : `≥ ${A.ultimoDia}`}</td>
      <td>${m.primeraNovedad ? "Día " + m.primeraNovedad.dia + ": " + esc(m.primeraNovedad.tipos.join(", ")) : "—"}</td><td>${esc(m.motivo || "—")}</td></tr>`).join("")}</table></div>

    ${A.novedadesPorTipo.length ? `<div class="titulo-seccion">Novedades por tipo</div>
    <div class="tarjeta tabla-scroll"><table class="simple"><tr><th>Novedad</th><th>N.º muestras</th><th>Desde el día</th><th>Muestras</th></tr>
    ${A.novedadesPorTipo.map(n => `<tr><td>${esc(n.tipo)}</td><td><b>${n.n}</b></td><td>${n.primerDia}</td><td>${n.muestras.map(x => "M" + x).join(", ")}</td></tr>`).join("")}</table></div>` : ""}

    <div class="titulo-seccion">Laboratorio</div>
    <div class="tarjeta tabla-scroll"><table class="simple"><tr><th>Día</th><th>Brix</th><th>Acidez</th><th>Translucidez</th><th>Temp.</th></tr>
      ${dl.map(d => { const l = A.lab.find(x => x.dia === d) || {}; return `<tr><td><b>${d}</b></td><td>${K.num(l.brix)}</td><td>${K.num(l.acidez, 2)}</td><td>${l.translucidez_pct != null ? K.num(l.translucidez_pct, 0) + " %" : "—"}</td><td>${l.temperatura != null ? K.num(l.temperatura) + " °C" : "—"}</td></tr>`; }).join("")}</table></div>

    <div class="titulo-seccion">Bitácora de observaciones</div>
    <div class="tarjeta tabla-scroll">${A.novedadesLista.length ? `<label class="peq suave" style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><input type="checkbox" id="verTodas"> Ver también observaciones sin novedad</label><table class="simple" id="tBit"><tr><th>Día</th><th>Muestra</th><th>Novedad / observación</th><th>Registró</th></tr>
      ${A.novedadesLista.map(n => (n.tipos.length || n.noComercial ? "<tr>" : "<tr class='solo-obs' hidden>") + `<td>${n.dia}</td><td>M${n.muestra}</td><td>${n.noComercial ? "<b style='color:var(--rojo)'>NO COMERCIAL.</b> " : ""}${esc(n.tipos.join(", "))}${n.tipos.length && n.observacion ? " — " : ""}${esc(n.observacion)}</td><td class="peq">${esc(n.auxiliar)}</td></tr>`).join("")}</table>` : `<p class="suave">Sin observaciones registradas.</p>`}</div>

    <div class="titulo-seccion">Conclusiones y recomendaciones (las escribe el responsable)</div>
    <div class="tarjeta"><textarea class="entrada" id="concl" style="min-height:120px" placeholder="Ej: El lote presenta buena durabilidad para despacho a mercado nacional de hasta 7 días…">${esc(e.conclusion || "")}</textarea>
      <button class="btn btn-sec btn-bloque" id="gConcl" style="margin-top:10px">Guardar conclusión</button></div>

    <div class="titulo-seccion">Informe en Word</div>
    <div class="tarjeta">
      <label class="campo"><span>Fotos a incluir</span><select class="entrada" id="selFotos">
        <option value="todas">Todas las fotos (informe completo)</option>
        <option value="clave">Solo días clave (inicio, laboratorio, novedades, retiro y final)</option>
      </select></label>
      <button class="btn btn-pri btn-bloque" id="bWord">📄 Generar informe Word</button>
    </div>

    ${e.estado === "activo" ? `<button class="btn btn-borde btn-bloque" id="bCerrar" style="margin-top:6px">🔒 Cerrar ensayo (finalizado)</button>`
        : `<button class="btn btn-borde btn-bloque" id="bReabrir" style="margin-top:6px">🔓 Reabrir ensayo</button>`}
    `;
    $("#volverE").onclick = () => vistaEnsayo();
    const vt = $("#verTodas"); if (vt) vt.onchange = () => app.querySelectorAll("#tBit .solo-obs").forEach(tr => tr.hidden = !vt.checked);
    $("#gConcl").onclick = async () => { await tarea("Guardando…", () => DB.actualizarEnsayo(e.id, { conclusion: $("#concl").value.trim() || null })); await recargar(); toast("Conclusión guardada ✓"); };
    $("#bWord").onclick = async () => {
      const txt = $("#concl").value.trim();
      if (txt !== (e.conclusion || "")) { await DB.actualizarEnsayo(e.id, { conclusion: txt || null }); await recargar(); }
      await tarea("Preparando informe…", () => window.INFORME.generar(S.datos, K.analizar(S.datos), { fotos: $("#selFotos").value, urlFoto: DB.blobFoto.bind(DB), progreso: t => $("#cargandoTxt").textContent = t }));
      toast("Informe descargado ✓");
    };
    const bc = $("#bCerrar"), br = $("#bReabrir");
    if (bc) bc.onclick = async () => { if (!confirm("¿Cerrar el ensayo? Podrá reabrirlo si lo necesita.")) return; await tarea("Cerrando…", () => DB.actualizarEnsayo(e.id, { estado: "cerrado" })); toast("Ensayo cerrado"); vistaResumen(); };
    if (br) br.onclick = async () => { await tarea("Reabriendo…", () => DB.actualizarEnsayo(e.id, { estado: "activo" })); vistaResumen(); };
    window.scrollTo(0, 0);
  }

  function matrizHTML(A) {
    let h = `<table class="matriz"><tr><th></th>${A.dias.map(d => `<th>D${d}</th>`).join("")}</tr>`;
    A.ms.forEach(m => {
      h += `<tr><td class="m"><b>M${m.numero}</b></td>`;
      A.dias.forEach(d => {
        const r = m.rs[d];
        if (m.retirada && d > m.diaFin && !r) { h += `<td style="background:#f3f3f3;color:#bbb">·</td>`; return; }
        if (!r || r.color == null) { h += `<td style="background:#f7f8f5;color:#ccc">—</td>`; return; }
        const marca = m.diaFin === d ? "✖" : ((r.novedades || []).length ? "⚠" : "");
        h += `<td style="background:${K.colorHex(r.color)};color:${K.textoSobre(r.color)}${m.diaFin === d ? ";outline:2px solid #c62828" : ""}">${K.num(r.color)}${marca ? "<br>" + marca : ""}</td>`;
      });
      h += "</tr>";
    });
    h += `<tr><td class="m">Prom.</td>${A.promColorPorDia.map(p => p.n ? `<td style="background:${K.colorHex(p.prom)};color:${K.textoSobre(p.prom)};border:2px solid #1b5e20">${K.num(p.prom)}</td>` : `<td>—</td>`).join("")}</tr>`;
    return h + "</table>";
  }

  window.addEventListener("error", e => console.error(e));
  iniciar();
})();
