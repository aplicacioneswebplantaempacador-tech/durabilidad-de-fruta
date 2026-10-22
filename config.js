// =====================================================================
//  CONFIGURACIÓN DE LA APP  —  Este es el ÚNICO archivo que usted edita
// =====================================================================
window.CONFIG = {
  // 1) Pegue aquí los datos de su proyecto de Supabase
  //    (Supabase > Project Settings > API)
  SUPABASE_URL: "https://pcjwrmcshotohxojrulm.supabase.co",        // ej: "https://abcdxyz.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjandybWNzaG90b2h4b2pydWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzkwNDksImV4cCI6MjEwODI1NTA0OX0.JlPDXDQjmj8EijL1GXlWoVm-zwxWvmKSB6vRheg6NH8",   // la clave "anon public" (larga, empieza por eyJ...)

  // Si los dos campos de arriba están vacíos, la app abre en MODO DEMO
  // (guarda todo solo en el celular/computador, sirve para practicar).

  // 2) Valores por defecto del ensayo
  NUM_MUESTRAS: 10,
  DIAS_ENSAYO: 10,
  DIAS_LABORATORIO: [0, 3, 7, 10],   // días en que se piden Brix, acidez, translucidez y temperatura

  // 3) Novedades que la auxiliar puede marcar (puede agregar o quitar)
  NOVEDADES: [
    "Enferma",
    "Hongo / moho",
    "Pudrición en base",
    "Deshidratación de corona",
    "Corona seca / amarilla",
    "Golpe / magulladura",
    "Arrugamiento de cáscara",
    "Translucidez visible",
    "Exudado / lixiviado",
    "Olor a fermento",
    "Quemadura de sol",
    "Insectos / daño por plaga",
    "Otra (ver observación)"
  ],

  // 4) Criterio del "Concepto general" del informe:
  //    % de muestras que siguen comerciales al último día del ensayo
  CONCEPTO: { satisfactorio: 80, intermedio: 50 },

  // 5) Calidad de las fotos
  FOTO_LADO_MAX: 1920,     // píxeles del lado más largo (Full HD: alta calidad, ~400 KB por foto)
  FOTO_CALIDAD: 0.87,      // 0 a 1
  FOTO_INFORME_LADO: 1000  // tamaño de las fotos dentro del Word
};
