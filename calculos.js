// =====================================================================
//  CÁLCULOS Y RESUMEN EJECUTIVO (lo usa la pantalla Resumen y el Word)
// =====================================================================
(function () {
  const ESCALA = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

  // Escala de color de la piña: verde (0) -> amarillo (3-4) -> naranja (6)
  const PUNTOS = [[0, [46, 125, 50]], [1.5, [124, 179, 66]], [3, [205, 220, 57]], [4, [251, 192, 45]], [5, [245, 150, 30]], [6, [222, 100, 20]]];
  function colorRGB(v) {
    if (v == null || isNaN(v)) return [220, 220, 220];
    for (let i = 1; i < PUNTOS.length; i++) {
      const [a, ca] = PUNTOS[i - 1], [b, cb] = PUNTOS[i];
      if (v <= b) { const t = (v - a) / (b - a); return ca.map((c, k) => Math.round(c + (cb[k] - c) * t)); }
    }
    return PUNTOS[PUNTOS.length - 1][1];
  }
  const hex = rgb => "#" + rgb.map(c => c.toString(16).padStart(2, "0")).join("");
  const colorHex = v => hex(colorRGB(v));
  const textoSobre = v => (v == null ? "#555" : (v <= 1 ? "#fff" : "#1d2a12"));

  const num = (v, d = 1) => (v == null || isNaN(v)) ? "—" : Number(v).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
  const prom = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const fechaLarga = f => f ? new Date(f + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "—";

  function analizar({ ensayo, muestras, registros, lab }) {
    const D = ensayo.dias_ensayo;
    const dias = Array.from({ length: D + 1 }, (_, i) => i);
    const regDe = {}; registros.forEach(r => { (regDe[r.muestra_id] ||= {})[r.dia] = r; });
    const conColor = registros.filter(r => r.color != null);
    const ultimoDia = registros.length ? Math.max(...registros.map(r => r.dia)) : 0;

    const ms = muestras.map(m => {
      const rs = regDe[m.id] || {};
      const diasReg = Object.keys(rs).map(Number).sort((a, b) => a - b);
      const colorInicial = m.color_inicial ?? rs[0]?.color ?? null;
      const ultimoReg = diasReg.length ? rs[diasReg[diasReg.length - 1]] : null;
      const regsColor = diasReg.filter(d => rs[d].color != null);
      const colorFinal = regsColor.length ? rs[regsColor[regsColor.length - 1]].color : null;
      const diaFinalColor = regsColor.length ? regsColor[regsColor.length - 1] : null;
      const conNov = diasReg.filter(d => (rs[d].novedades || []).length);
      const primeraNovedad = conNov.length ? { dia: conNov[0], tipos: rs[conNov[0]].novedades } : null;
      const retirada = m.dia_fin_vida != null;
      return {
        id: m.id, numero: m.numero, colorInicial, colorFinal, diaFinalColor, ultimoReg,
        diaFin: m.dia_fin_vida, motivo: m.motivo_fin, retirada,
        durabilidad: retirada ? m.dia_fin_vida : ultimoDia,
        primeraNovedad, rs, diasReg
      };
    });

    const promColorPorDia = dias.map(d => {
      const v = conColor.filter(r => r.dia === d).map(r => Number(r.color));
      return { dia: d, n: v.length, prom: prom(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
    });
    const conDatos = promColorPorDia.filter(p => p.n);
    const colorIni = prom(ms.filter(m => m.colorInicial != null).map(m => Number(m.colorInicial)));
    const colorFin = conDatos.length ? conDatos[conDatos.length - 1].prom : null;
    const diaColorFin = conDatos.length ? conDatos[conDatos.length - 1].dia : null;
    const avance = (colorIni != null && colorFin != null) ? colorFin - colorIni : null;
    const velocidad = (avance != null && diaColorFin) ? avance / diaColorFin : null;
    let mayorSalto = null;
    for (let i = 1; i < conDatos.length; i++) {
      const dlt = conDatos[i].prom - conDatos[i - 1].prom;
      if (!mayorSalto || dlt > mayorSalto.delta) mayorSalto = { desde: conDatos[i - 1].dia, hasta: conDatos[i].dia, delta: dlt };
    }

    const N = ms.length;
    const retiradas = ms.filter(m => m.retirada);
    const nComerciales = N - retiradas.length;
    const pctComerciales = N ? nComerciales / N * 100 : 0;
    const durabilidadProm = prom(ms.map(m => m.durabilidad));
    const durRet = retiradas.map(m => m.diaFin);

    // Novedades
    const novedadesLista = registros
      .filter(r => (r.novedades || []).length || (r.observacion || "").trim() || r.no_comercial)
      .map(r => ({ dia: r.dia, fecha: r.fecha, muestra: (muestras.find(m => m.id === r.muestra_id) || {}).numero, tipos: r.novedades || [], observacion: r.observacion || "", auxiliar: r.auxiliar || "", noComercial: r.no_comercial, apariencia: r.apariencia }))
      .sort((a, b) => a.dia - b.dia || a.muestra - b.muestra);
    const porTipo = {};
    registros.forEach(r => (r.novedades || []).forEach(t => {
      const m = (muestras.find(x => x.id === r.muestra_id) || {}).numero;
      const o = (porTipo[t] ||= { tipo: t, muestras: new Set(), primerDia: r.dia });
      o.muestras.add(m); o.primerDia = Math.min(o.primerDia, r.dia);
    }));
    const novedadesPorTipo = Object.values(porTipo).map(o => ({ tipo: o.tipo, n: o.muestras.size, primerDia: o.primerDia, muestras: [...o.muestras].sort((a, b) => a - b) }))
      .sort((a, b) => b.n - a.n || a.primerDia - b.primerDia);
    const primeraNov = ms.filter(m => m.primeraNovedad).sort((a, b) => a.primeraNovedad.dia - b.primeraNovedad.dia)[0] || null;

    // Apariencia en el último día evaluado
    const apar = { Buena: 0, Regular: 0, Mala: 0 };
    ms.forEach(m => { const r = m.ultimoReg; if (r && r.apariencia) apar[r.apariencia]++; });

    // Laboratorio
    const labOrd = [...lab].sort((a, b) => a.dia - b.dia);
    const labIni = labOrd[0], labFin = labOrd.length > 1 ? labOrd[labOrd.length - 1] : null;

    // Concepto general
    const cfg = window.CONFIG.CONCEPTO;
    let concepto;
    if (!registros.length) concepto = { nivel: "Sin datos", color: "#888", texto: "Aún no hay registros para emitir un concepto." };
    else if (pctComerciales >= cfg.satisfactorio) concepto = { nivel: "Durabilidad satisfactoria", color: "#2e7d32", texto: `${num(pctComerciales, 0)} % de las muestras se mantuvo en condición comercial hasta el día ${ultimoDia}.` };
    else if (pctComerciales >= cfg.intermedio) concepto = { nivel: "Durabilidad intermedia", color: "#e0a400", texto: `Solo ${num(pctComerciales, 0)} % de las muestras llegó comercial al día ${ultimoDia}; requiere seguimiento.` };
    else concepto = { nivel: "Durabilidad baja", color: "#c62828", texto: `Únicamente ${num(pctComerciales, 0)} % de las muestras llegó comercial al día ${ultimoDia}; se recomienda revisar causas.` };
    if (registros.length && ultimoDia < D) concepto.texto += ` (Ensayo en curso: evaluado hasta el día ${ultimoDia} de ${D}.)`;

    // ---------------- Textos del resumen ejecutivo ----------------
    const t = [];
    const rangoIni = ms.filter(m => m.colorInicial != null).map(m => Number(m.colorInicial));
    t.push(`El ensayo de durabilidad del lote ${ensayo.lote}` + (ensayo.bloque ? `, bloque ${ensayo.bloque}` : "") +
      ` (Grupo Forza ${ensayo.grupo_forza}) inició el ${fechaLarga(ensayo.fecha_inicio)} con ${N} muestras` +
      (colorIni != null ? ` de color inicial promedio ${num(colorIni)} (rango ${num(Math.min(...rangoIni))} a ${num(Math.max(...rangoIni))})` : "") +
      (ensayo.temperatura_almacen ? `, almacenadas a ${ensayo.temperatura_almacen}` : "") +
      `. Se realizó seguimiento hasta el día ${ultimoDia}` + (ultimoDia < D ? ` de ${D} programados.` : "."));
    if (registros.length) {
      t.push(retiradas.length
        ? `${nComerciales} de ${N} muestras (${num(pctComerciales, 0)} %) se mantuvieron comerciales hasta el día ${ultimoDia}. ` +
          `${retiradas.length} muestra(s) fueron declaradas no comerciales entre el día ${Math.min(...durRet)} y el día ${Math.max(...durRet)}` +
          ` (promedio de retiro: día ${num(prom(durRet))}). La durabilidad promedio del lote es de ${nComerciales ? "al menos " : ""}${num(durabilidadProm)} días.`
        : `Todas las muestras (${N} de ${N}) se mantuvieron en condición comercial hasta el día ${ultimoDia}, por lo que la durabilidad del lote es de al menos ${ultimoDia} días.`);
    }
    if (avance != null) {
      t.push(`El color externo avanzó de ${num(colorIni)} a ${num(colorFin)} en promedio (${avance >= 0 ? "+" : ""}${num(avance)} grados en ${diaColorFin} días, ` +
        `≈ ${num(velocidad, 2)} grados por día).` +
        (mayorSalto && mayorSalto.delta > 0 ? ` El mayor cambio se observó entre el día ${mayorSalto.desde} y el día ${mayorSalto.hasta} (+${num(mayorSalto.delta)}).` : ""));
    }
    if (primeraNov) {
      t.push(`La primera novedad se presentó el día ${primeraNov.primeraNovedad.dia} en la muestra ${primeraNov.numero} (${primeraNov.primeraNovedad.tipos.join(", ").toLowerCase()}).` +
        (novedadesPorTipo.length ? ` La novedad más frecuente fue «${novedadesPorTipo[0].tipo}», presente en ${novedadesPorTipo[0].n} muestra(s) desde el día ${novedadesPorTipo[0].primerDia}.` : ""));
    } else if (registros.length) t.push("No se registraron novedades (daños o defectos) durante el seguimiento.");
    if (labIni && labFin) {
      const parte = (n, a, b, d) => (a != null && b != null) ? `${n} pasó de ${num(a, d)} a ${num(b, d)}` : null;
      const p = [parte("el Brix", labIni.brix, labFin.brix, 1), parte("la acidez", labIni.acidez, labFin.acidez, 2), parte("la translucidez", labIni.translucidez_pct, labFin.translucidez_pct, 0) && parte("la translucidez", labIni.translucidez_pct, labFin.translucidez_pct, 0) + " %"].filter(Boolean);
      if (p.length) t.push(`En laboratorio (día ${labIni.dia} a día ${labFin.dia}), ${p.join("; ")}.`);
    } else if (labIni) {
      t.push(`Laboratorio día ${labIni.dia}: Brix ${num(labIni.brix)}, acidez ${num(labIni.acidez, 2)}, translucidez ${num(labIni.translucidez_pct, 0)} %.`);
    }
    const totA = apar.Buena + apar.Regular + apar.Mala;
    if (totA) t.push(`Apariencia en el último registro de cada muestra: ${apar.Buena} buena, ${apar.Regular} regular y ${apar.Mala} mala.`);

    return {
      D, dias, ultimoDia, ms, promColorPorDia, colorIni, colorFin, diaColorFin, avance, velocidad, mayorSalto,
      N, nComerciales, pctComerciales, retiradas, durabilidadProm, novedadesLista, novedadesPorTipo, primeraNov,
      apar, lab: labOrd, concepto, textos: t
    };
  }

  // ---------------- Gráfica de evolución del color (SVG) ----------------
  function graficaSVG(a, ancho = 720, alto = 360) {
    const m = { l: 48, r: 18, t: 18, b: 42 };
    const W = ancho - m.l - m.r, H = alto - m.t - m.b;
    const x = d => m.l + (a.D ? d / a.D : 0) * W;
    const y = v => m.t + H - (v / 6) * H;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" font-family="Arial, sans-serif">`;
    s += `<rect width="${ancho}" height="${alto}" fill="#ffffff"/>`;
    // bandas de color de fondo
    for (let v = 0; v < 6; v += 0.5) s += `<rect x="${m.l - 10}" y="${y(v + 0.5)}" width="8" height="${H / 12}" fill="${colorHex(v + 0.25)}"/>`;
    for (let v = 0; v <= 6; v++) {
      s += `<line x1="${m.l}" x2="${m.l + W}" y1="${y(v)}" y2="${y(v)}" stroke="#e6e6e6"/>`;
      s += `<text x="${m.l - 14}" y="${y(v) + 4}" font-size="12" text-anchor="end" fill="#666">${v}</text>`;
    }
    a.dias.forEach(d => s += `<text x="${x(d)}" y="${m.t + H + 18}" font-size="12" text-anchor="middle" fill="#666">${d}</text>`);
    s += `<text x="${m.l + W / 2}" y="${alto - 4}" font-size="12" text-anchor="middle" fill="#444">Día del ensayo</text>`;
    // líneas por muestra
    a.ms.forEach(mu => {
      const pts = mu.diasReg.filter(d => mu.rs[d].color != null).map(d => `${x(d)},${y(Number(mu.rs[d].color))}`);
      if (pts.length > 1) s += `<polyline points="${pts.join(" ")}" fill="none" stroke="#b9c4b0" stroke-width="1.2"/>`;
    });
    // banda min-max y promedio
    const cd = a.promColorPorDia.filter(p => p.n);
    if (cd.length > 1) {
      const banda = cd.map(p => `${x(p.dia)},${y(p.max)}`).concat([...cd].reverse().map(p => `${x(p.dia)},${y(p.min)}`)).join(" ");
      s += `<polygon points="${banda}" fill="#f5b400" fill-opacity="0.14"/>`;
      s += `<polyline points="${cd.map(p => `${x(p.dia)},${y(p.prom)}`).join(" ")}" fill="none" stroke="#1b5e20" stroke-width="3"/>`;
    }
    cd.forEach(p => s += `<circle cx="${x(p.dia)}" cy="${y(p.prom)}" r="5" fill="${colorHex(p.prom)}" stroke="#1b5e20" stroke-width="2"/>`);
    // retiros
    a.retiradas.forEach(mu => {
      const r = mu.rs[mu.diaFin]; const v = r && r.color != null ? Number(r.color) : null;
      if (v != null) s += `<text x="${x(mu.diaFin)}" y="${y(v) + 5}" font-size="15" text-anchor="middle" fill="#c62828" font-weight="bold">×</text>`;
    });
    // leyenda
    s += `<g font-size="11" fill="#444"><line x1="${m.l + 8}" x2="${m.l + 30}" y1="${m.t + 8}" y2="${m.t + 8}" stroke="#1b5e20" stroke-width="3"/><text x="${m.l + 36}" y="${m.t + 12}">Promedio</text>`;
    s += `<line x1="${m.l + 100}" x2="${m.l + 122}" y1="${m.t + 8}" y2="${m.t + 8}" stroke="#b9c4b0" stroke-width="1.5"/><text x="${m.l + 128}" y="${m.t + 12}">Cada muestra</text>`;
    s += `<text x="${m.l + 222}" y="${m.t + 13}" fill="#c62828" font-weight="bold" font-size="15">×</text><text x="${m.l + 234}" y="${m.t + 12}">No comercial</text></g>`;
    return s + "</svg>";
  }

  window.CALC = { ESCALA, colorHex, colorRGB, textoSobre, num, fechaLarga, analizar, graficaSVG };
})();
