// =====================================================================
//  INFORME WORD (.docx) — se genera en el celular/computador
// =====================================================================
(function () {
  const K = () => window.CALC;
  const VERDE = "1B5E20", VERDE_CLARO = "E8F3E3", GRIS = "F3F5F1", BORDE = "D5DCCF";

  async function svgAPng(svg, ancho, alto, escala = 2) {
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement("canvas"); cv.width = ancho * escala; cv.height = alto * escala;
    const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const b = await new Promise(r => cv.toBlob(r, "image/png"));
    return new Uint8Array(await b.arrayBuffer());
  }

  async function reducir(blob, lado) {
    let bmp;
    try { bmp = await createImageBitmap(blob); }
    catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); }); }
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const cx = cv.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const b = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.86));
    return { data: new Uint8Array(await b.arrayBuffer()), w: cv.width, h: cv.height };
  }

  async function generar(datos, A, opc) {
    const d = window.docx, C = window.CONFIG, k = K();
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer, PageNumber,
      AlignmentType, HeadingLevel, WidthType, ShadingType, BorderStyle, VerticalAlign, PageBreak, TableLayoutType } = d;
    const e = datos.ensayo;
    const ANCHO = 10200; // ancho útil (carta, márgenes 1,8 cm) en twips

    // ---------- ayudantes ----------
    const T = (text, o = {}) => new TextRun({ text: String(text ?? ""), ...o });
    const P = (hijos, o = {}) => new Paragraph({ children: Array.isArray(hijos) ? hijos : [typeof hijos === "string" ? T(hijos) : hijos], spacing: { after: 100 }, ...o });
    const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [T(t)] });
    const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [T(t)] });
    const bordes = { top: { style: BorderStyle.SINGLE, size: 4, color: BORDE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE }, left: { style: BorderStyle.SINGLE, size: 4, color: BORDE }, right: { style: BorderStyle.SINGLE, size: 4, color: BORDE } };
    const sinBordes = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
    const celda = (contenido, ancho, o = {}) => new TableCell({
      width: { size: ancho, type: WidthType.DXA }, borders: o.bordes || bordes, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      shading: o.fondo ? { fill: o.fondo, type: ShadingType.CLEAR, color: "auto" } : undefined,
      columnSpan: o.span,
      children: Array.isArray(contenido) ? contenido : [new Paragraph({ alignment: o.alinear || AlignmentType.LEFT, spacing: { after: 0 }, children: [T(contenido, { bold: o.negrita, color: o.color, size: o.tam })] })]
    });
    const tabla = (anchos, filas) => new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: anchos, layout: TableLayoutType.FIXED, rows: filas });
    const fila = (celdas, cab = false) => new TableRow({ children: celdas, tableHeader: cab, cantSplit: true });
    const cabecera = (titulos, anchos) => fila(titulos.map((t, i) => celda(t, anchos[i], { fondo: VERDE, color: "FFFFFF", negrita: true, tam: 18 })), true);
    const hexSin = v => k.colorHex(v).slice(1).toUpperCase();
    const txtSobre = v => k.textoSobre(v).slice(1).toUpperCase();
    const espacio = () => new Paragraph({ spacing: { after: 120 }, children: [] });

    const hijos = [];

    // ---------- PORTADA / ENCABEZADO DEL INFORME ----------
    hijos.push(new Paragraph({ spacing: { after: 40 }, children: [T("AGRÍCOLA GUAPA · ÁREA DE CALIDAD", { bold: true, color: "7A8A70", size: 18 })] }));
    hijos.push(new Paragraph({ spacing: { after: 60 }, children: [T("Informe de Durabilidad de Fruta", { bold: true, color: VERDE, size: 44 })] }));
    hijos.push(new Paragraph({ spacing: { after: 200 }, children: [T(`Piña MD2 · Lote ${e.lote}${e.bloque ? " · Bloque " + e.bloque : ""} · Grupo Forza ${e.grupo_forza}`, { size: 24, color: "444444" })] }));

    // Concepto general (franja de color)
    const colConcepto = A.concepto.color.replace("#", "").toUpperCase();
    hijos.push(tabla([ANCHO], [fila([new TableCell({
      width: { size: ANCHO, type: WidthType.DXA }, borders: sinBordes, shading: { fill: colConcepto, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 160, bottom: 160, left: 220, right: 220 },
      children: [P([T("CONCEPTO GENERAL", { bold: true, color: "FFFFFF", size: 16 })], { spacing: { after: 40 } }),
      P([T(A.concepto.nivel, { bold: true, color: "FFFFFF", size: 32 })], { spacing: { after: 40 } }),
      P([T(A.concepto.texto, { color: "FFFFFF", size: 21 })], { spacing: { after: 0 } })]
    })])]));
    hijos.push(espacio());

    // Indicadores clave
    const kpis = [
      [(A.nComerciales && A.ultimoDia ? "≥ " : "") + k.num(A.durabilidadProm), "Durabilidad promedio (días)"],
      [`${A.nComerciales}/${A.N}`, `Comerciales al día ${A.ultimoDia}`],
      [`${k.num(A.colorIni)} → ${k.num(A.colorFin)}`, "Color promedio inicial → final"],
      [A.velocidad != null ? "+" + k.num(A.velocidad, 2) : "—", "Avance de color por día"],
      [A.primeraNov ? "Día " + A.primeraNov.primeraNovedad.dia : "Ninguna", "Primera novedad"]
    ];
    const aK = ANCHO / 5;
    hijos.push(tabla(kpis.map(() => aK), [fila(kpis.map(([v, l]) => new TableCell({
      width: { size: aK, type: WidthType.DXA }, borders: { ...sinBordes, left: { style: BorderStyle.SINGLE, size: 18, color: "F5B400" } },
      shading: { fill: GRIS, type: ShadingType.CLEAR, color: "auto" }, margins: { top: 100, bottom: 100, left: 140, right: 80 },
      children: [P([T(v, { bold: true, size: 30, color: "1F2A1C" })], { spacing: { after: 20 } }), P([T(l, { size: 16, color: "6B7566" })], { spacing: { after: 0 } })]
    })))]));

    // ---------- 1. DATOS DEL ENSAYO ----------
    hijos.push(H1("1. Datos del ensayo"));
    const datosE = [
      ["Fecha de inicio (Día 0)", k.fechaLarga(e.fecha_inicio)], ["Semana", e.semana ?? "—"],
      ["Lote", e.lote], ["Bloque", e.bloque || "—"],
      ["Grupo Forza", e.grupo_forza], ["Subgrupo de maduración", e.subgrupo_maduracion || "—"],
      ["Calibre", e.calibre || "—"], ["Temperatura de almacenamiento", e.temperatura_almacen || "—"],
      ["Aplicación con", e.aplicacion || "No aplica"], ["Dosis", e.dosis || "—"],
      ["Número de muestras", e.num_muestras], ["Días programados / evaluados", `${e.dias_ensayo} / ${A.ultimoDia}`],
      ["Estado", e.estado === "cerrado" ? "Cerrado" : "En curso"], ["Auxiliares que registraron", [...new Set(datos.registros.map(r => r.auxiliar).filter(Boolean))].join(", ") || "—"]
    ];
    const a4 = [2300, 2800, 2300, 2800];
    const filasD = [];
    for (let i = 0; i < datosE.length; i += 2) {
      const [a, b] = [datosE[i], datosE[i + 1] || ["", ""]];
      filasD.push(fila([celda(a[0], a4[0], { fondo: VERDE_CLARO, negrita: true, tam: 18 }), celda(a[1], a4[1]), celda(b[0], a4[2], { fondo: VERDE_CLARO, negrita: true, tam: 18 }), celda(b[1], a4[3])]));
    }
    hijos.push(tabla(a4, filasD));

    // ---------- 2. RESUMEN EJECUTIVO ----------
    hijos.push(H1("2. Resumen ejecutivo"));
    A.textos.forEach(t => hijos.push(P([T(t)], { spacing: { after: 140, line: 300 }, alignment: AlignmentType.JUSTIFIED })));

    // ---------- 3. EVOLUCIÓN DEL COLOR ----------
    hijos.push(H1("3. Evolución del color externo"));
    hijos.push(P([T("Escala de color de 0,0 (verde) a 6,0 (amarillo-naranja), en pasos de 0,5. La línea gruesa es el promedio; las líneas grises son cada muestra; la franja muestra el rango mínimo–máximo.", { size: 18, color: "6B7566" })]));
    opc.progreso && opc.progreso("Dibujando gráfica…");
    const png = await svgAPng(k.graficaSVG(A, 720, 340), 720, 340);
    hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: png, transformation: { width: 660, height: 312 } })] }));

    hijos.push(H2("Color por muestra y día"));
    const nCol = A.dias.length + 1;
    const aPrim = 1000, aDia = Math.floor((ANCHO - aPrim) / (nCol - 1));
    const anchosM = [aPrim, ...A.dias.map(() => aDia)];
    const filasM = [cabecera(["Muestra", ...A.dias.map(x => "D" + x)], anchosM)];
    A.ms.forEach(m => {
      filasM.push(fila([celda("M" + m.numero, aPrim, { negrita: true, fondo: GRIS }), ...A.dias.map(dd => {
        const r = m.rs[dd];
        if (!r || r.color == null) return celda(m.retirada && dd > m.diaFin ? "·" : "", aDia, { alinear: AlignmentType.CENTER, fondo: "FAFAFA", color: "BBBBBB" });
        const marca = m.diaFin === dd ? " ×" : ((r.novedades || []).length ? " ▲" : "");
        return celda(k.num(r.color) + marca, aDia, { alinear: AlignmentType.CENTER, fondo: hexSin(r.color), color: m.diaFin === dd ? "B71C1C" : txtSobre(r.color), negrita: true, tam: 17 });
      })]));
    });
    filasM.push(fila([celda("Prom.", aPrim, { negrita: true, fondo: VERDE_CLARO }), ...A.promColorPorDia.map(p => p.n
      ? celda(k.num(p.prom), aDia, { alinear: AlignmentType.CENTER, fondo: hexSin(p.prom), color: txtSobre(p.prom), negrita: true, tam: 17 })
      : celda("", aDia))]));
    hijos.push(tabla(anchosM, filasM));
    hijos.push(P([T("▲ = novedad registrada ese día · × = día en que la muestra se declaró no comercial · · = fuera del ensayo", { size: 16, color: "6B7566" })], { spacing: { before: 60, after: 120 } }));

    // ---------- 4. DURABILIDAD POR MUESTRA ----------
    hijos.push(H1("4. Durabilidad por muestra"));
    hijos.push(P([T("Días comercial: día del ensayo en que la auxiliar declaró la muestra como no comercial. «≥» indica que la muestra seguía comercial en el último día evaluado.", { size: 18, color: "6B7566" })]));
    const aDur = [1000, 1150, 1150, 1300, 2800, 2800];
    hijos.push(tabla(aDur, [cabecera(["Muestra", "Color inicial", "Color final", "Días comercial", "Primera novedad", "Motivo de retiro"], aDur),
    ...A.ms.map(m => fila([
      celda("M" + m.numero, aDur[0], { negrita: true }), celda(k.num(m.colorInicial), aDur[1], { alinear: AlignmentType.CENTER, fondo: m.colorInicial != null ? hexSin(m.colorInicial) : undefined, color: m.colorInicial != null ? txtSobre(m.colorInicial) : undefined }),
      celda(k.num(m.colorFinal), aDur[2], { alinear: AlignmentType.CENTER, fondo: m.colorFinal != null ? hexSin(m.colorFinal) : undefined, color: m.colorFinal != null ? txtSobre(m.colorFinal) : undefined }),
      celda(m.retirada ? String(m.diaFin) : "≥ " + A.ultimoDia, aDur[3], { alinear: AlignmentType.CENTER, negrita: true, color: m.retirada ? "C62828" : "2E7D32" }),
      celda(m.primeraNovedad ? `Día ${m.primeraNovedad.dia}: ${m.primeraNovedad.tipos.join(", ")}` : "—", aDur[4], { tam: 18 }),
      celda(m.motivo || "—", aDur[5], { tam: 18 })
    ]))]));

    // ---------- 5. NOVEDADES ----------
    hijos.push(H1("5. Novedades y observaciones"));
    if (A.novedadesPorTipo.length) {
      hijos.push(H2("Novedades por tipo"));
      const aT = [4000, 1700, 1700, 2800];
      hijos.push(tabla(aT, [cabecera(["Novedad", "N.º muestras", "Desde el día", "Muestras afectadas"], aT),
      ...A.novedadesPorTipo.map(n => fila([celda(n.tipo, aT[0], { negrita: true }), celda(String(n.n), aT[1], { alinear: AlignmentType.CENTER }), celda(String(n.primerDia), aT[2], { alinear: AlignmentType.CENTER }), celda(n.muestras.map(x => "M" + x).join(", "), aT[3])]))]));
    } else hijos.push(P("No se registraron novedades durante el ensayo."));
    if (A.novedadesLista.length) {
      hijos.push(H2("Bitácora diaria"));
      const aB = [700, 900, 1200, 5400, 2000];
      hijos.push(tabla(aB, [cabecera(["Día", "Muestra", "Apariencia", "Novedad / observación", "Registró"], aB),
      ...A.novedadesLista.map(n => fila([celda(String(n.dia), aB[0], { alinear: AlignmentType.CENTER }), celda("M" + n.muestra, aB[1], { alinear: AlignmentType.CENTER, negrita: true }),
      celda(n.apariencia || "—", aB[2], { tam: 18, color: n.apariencia === "Mala" ? "C62828" : undefined }),
      celda([new Paragraph({ spacing: { after: 0 }, children: [...(n.noComercial ? [T("NO COMERCIAL. ", { bold: true, color: "C62828", size: 18 })] : []), T(n.tipos.join(", ") + (n.tipos.length && n.observacion ? " — " : "") + n.observacion, { size: 18 })] })], aB[3]),
      celda(n.auxiliar, aB[4], { tam: 16, color: "6B7566" })]))]));
    }

    // ---------- 6. LABORATORIO ----------
    hijos.push(H1("6. Resultados de laboratorio"));
    const diasL = C.DIAS_LABORATORIO.filter(x => x <= e.dias_ensayo);
    const aL = [1400, 2200, 2200, 2200, 2200];
    hijos.push(tabla(aL, [cabecera(["Día", "Brix (°Bx)", "Acidez (%)", "Translucidez (%)", "Temperatura (°C)"], aL),
    ...diasL.map(x => { const l = A.lab.find(z => z.dia === x) || {}; return fila([celda("Día " + x, aL[0], { negrita: true, fondo: GRIS }), celda(k.num(l.brix), aL[1], { alinear: AlignmentType.CENTER }), celda(k.num(l.acidez, 2), aL[2], { alinear: AlignmentType.CENTER }), celda(l.translucidez_pct != null ? k.num(l.translucidez_pct, 0) : "—", aL[3], { alinear: AlignmentType.CENTER }), celda(k.num(l.temperatura), aL[4], { alinear: AlignmentType.CENTER })]); })]));

    // ---------- 7. CONCLUSIONES ----------
    hijos.push(H1("7. Conclusiones y recomendaciones"));
    const concl = (e.conclusion || "").trim();
    if (concl) concl.split(/\n+/).forEach(p => hijos.push(P([T(p)], { spacing: { after: 120, line: 300 }, alignment: AlignmentType.JUSTIFIED })));
    else hijos.push(P([T("(Pendiente: el responsable del ensayo debe escribir sus conclusiones en la app.)", { italics: true, color: "999999" })]));

    // Firmas
    hijos.push(espacio()); hijos.push(espacio());
    const aF = [4800, 600, 4800];
    const linea = { ...sinBordes, top: { style: BorderStyle.SINGLE, size: 6, color: "333333" } };
    hijos.push(tabla(aF, [fila([
      celda([P([T("Elaboró (Auxiliar de calidad)", { bold: true, size: 18 })], { spacing: { after: 0 } })], aF[0], { bordes: linea }),
      celda("", aF[1], { bordes: sinBordes }),
      celda([P([T("Revisó (Líder de cosecha / calidad)", { bold: true, size: 18 })], { spacing: { after: 0 } })], aF[2], { bordes: linea })])]));

    // ---------- 8. REGISTRO FOTOGRÁFICO ----------
    const fotos = [];
    A.ms.forEach(m => {
      const clave = new Set([0, ...diasL, m.diaFin, ...m.diasReg.filter(x => (m.rs[x].novedades || []).length || m.rs[x].observacion), m.diasReg[m.diasReg.length - 1]].filter(x => x != null));
      m.diasReg.forEach(x => { const r = m.rs[x]; if (r.foto_path && (opc.fotos === "todas" || clave.has(x))) fotos.push({ m, dia: x, r }); });
    });
    if (fotos.length) {
      hijos.push(new Paragraph({ children: [new PageBreak()] }));
      hijos.push(H1("8. Registro fotográfico"));
      hijos.push(P([T(opc.fotos === "todas" ? "Todas las fotos tomadas durante el ensayo, por muestra y día." : "Fotos de días clave: inicio, días de laboratorio, novedades, retiro y último registro.", { size: 18, color: "6B7566" })]));
      const COLS = 3, aC = Math.floor(ANCHO / COLS), anchoImg = 205;
      let hechas = 0;
      for (const m of A.ms) {
        const fm = fotos.filter(f => f.m === m); if (!fm.length) continue;
        hijos.push(H2(`Muestra ${m.numero}` + (m.retirada ? ` — no comercial desde el día ${m.diaFin}` : " — comercial hasta el final")));
        const celdas = [];
        for (const f of fm) {
          opc.progreso && opc.progreso(`Agregando fotos… ${++hechas}/${fotos.length}`);
          let img = null;
          try { img = await reducir(await opc.urlFoto(f.r.foto_path), C.FOTO_INFORME_LADO); } catch (err) { console.warn(err); }
          const alto = img ? Math.round(anchoImg * img.h / img.w) : 0;
          celdas.push(new TableCell({
            width: { size: aC, type: WidthType.DXA }, borders: sinBordes, margins: { top: 60, bottom: 100, left: 60, right: 60 },
            children: [
              img ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new ImageRun({ data: img.data, transformation: { width: anchoImg, height: alto } })] })
                : P([T("(foto no disponible)", { italics: true, color: "999999", size: 16 })]),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [
                T(`Día ${f.dia}`, { bold: true, size: 17 }), T(`  ·  Color ${k.num(f.r.color)}  ·  ${f.r.apariencia || ""}`, { size: 16, color: "555555" }),
                ...(m.diaFin === f.dia ? [T("  ·  NO COMERCIAL", { bold: true, size: 15, color: "C62828" })] : (f.r.novedades || []).length ? [T("  ·  " + f.r.novedades.join(", "), { size: 15, color: "A35400" })] : [])
              ] })
            ]
          }));
        }
        while (celdas.length % COLS) celdas.push(new TableCell({ width: { size: aC, type: WidthType.DXA }, borders: sinBordes, children: [new Paragraph("")] }));
        const filasF = []; for (let i = 0; i < celdas.length; i += COLS) filasF.push(new TableRow({ cantSplit: true, children: celdas.slice(i, i + COLS) }));
        hijos.push(new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: Array(COLS).fill(aC), layout: TableLayoutType.FIXED, rows: filasF }));
      }
    }

    // ---------- DOCUMENTO ----------
    opc.progreso && opc.progreso("Armando el documento…");
    const doc = new Document({
      creator: "App Durabilidad · Agrícola Guapa", title: `Informe de durabilidad lote ${e.lote}`,
      styles: {
        default: { document: { run: { font: "Calibri", size: 21, color: "1F2A1C" } } },
        paragraphStyles: [
          { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: VERDE, font: "Calibri" }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "F5B400", space: 4 } } } },
          { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "2E7D32", font: "Calibri" }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true } }
        ]
      },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1020, bottom: 1020, left: 1020, right: 1020, header: 500, footer: 500 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [T(`Agrícola Guapa · Durabilidad de fruta · Lote ${e.lote}`, { size: 16, color: "8A9682" })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [T(`Generado el ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })} · Página `, { size: 16, color: "8A9682" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "8A9682" }), T(" de ", { size: 16, color: "8A9682" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "8A9682" })] })] }) },
        children: hijos
      }]
    });
    const blob = await Packer.toBlob(doc);
    const nombre = `Informe_Durabilidad_Lote_${String(e.lote).replace(/[^\w-]+/g, "_")}_${e.fecha_inicio}.docx`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    window.__ultimoInforme = blob; // (para pruebas)
    return nombre;
  }

  window.INFORME = { generar };
})();
