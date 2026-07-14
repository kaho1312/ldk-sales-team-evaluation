// ─────────────────────────────────────────────────────────────────────────────
// LDK Sales Quiz — Question types & loaders
// Supports: open-ended questions graded by Claude AI
// Sources:  1) CSV file upload  2) Google Sheet CSV URL  3) Hardcoded fallback
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = "Junior" | "Mid-Level" | "Senior";
export type Section = "A" | "B" | "C" | "D" | "E" | "F" | "All";

export interface QuizQuestion {
  id: string;
  tier: Tier;
  section: Section;
  question: string;
  modelAnswer: string;
  tags?: string;
  notes?: string;
}

// ── Tier metadata ────────────────────────────────────────────────────────────
export const TIER_CONFIG: Record<Tier, {
  label: string;
  description: string;
  color: string;
  passThreshold: number;
}> = {
  "Junior": {
    label: "Junior Sales Agent",
    description: "Product knowledge, daily operations & CORAA basics",
    color: "teal",
    passThreshold: 90,
  },
  "Mid-Level": {
    label: "Mid-Level Sales Agent",
    description: "Advanced sales, Travel Advisor channel & group management",
    color: "blue",
    passThreshold: 90,
  },
  "Senior": {
    label: "Senior Sales Agent",
    description: "Strategic accounts, team mentoring & exception handling",
    color: "amber",
    passThreshold: 90,
  },
};

// ── Section metadata ─────────────────────────────────────────────────────────
export const SECTION_CONFIG: Record<Section, {
  label: string;
  description: string;
}> = {
  "A": { label: "Sección A", description: "Operación diaria y producto" },
  "B": { label: "Sección B", description: "Herramientas del día a día (Acordeón)" },
  "C": { label: "Sección C", description: "Plataformas (CORAA, ODS)" },
  "D": { label: "Sección D", description: "Canales" },
  "E": { label: "Sección E", description: "CORAA y operación" },
  "F": { label: "Sección F", description: "Pricing" },
  "All": { label: "All Sections", description: "Applies to all sections" },
};

// ─────────────────────────────────────────────────────────────────────────────
// PER-TIER SECTION STRUCTURE — single source of truth for which sections a tier
// has and how each is labelled. Every "how many sections?" / section-list / label
// lookup should read from here so the tier flows never desync.
//   Junior    → A/B/C (3 sections, 55 questions)
//   Mid-Level → A/B/C/D/E/F (6 sections, 60 questions)
//   Senior    → none yet
// ─────────────────────────────────────────────────────────────────────────────
export const TIER_SECTIONS: Record<Tier, Section[]> = {
  "Junior": ["A", "B", "C"],
  "Mid-Level": ["A", "B", "C", "D", "E", "F"],
  "Senior": [],
};

export interface SectionMeta {
  title_es: string;
  title_en: string;
  desc_es: string;
  desc_en: string;
}

// Labels differ per tier for the SAME letter (Junior A = daily operations,
// Mid-Level A = Value Engine), so metadata is keyed by tier THEN section.
export const TIER_SECTION_META: Record<Tier, Partial<Record<Section, SectionMeta>>> = {
  "Junior": {
    A: { title_es: "Sección A", title_en: "Section A", desc_es: "Operación diaria y producto", desc_en: "Daily operations & product" },
    B: { title_es: "Sección B", title_en: "Section B", desc_es: "Herramientas del día a día", desc_en: "Daily tools (Acordeón)" },
    C: { title_es: "Sección C", title_en: "Section C", desc_es: "Plataformas (CORAA, ODS)", desc_en: "Platforms (CORAA, ODS)" },
  },
  "Mid-Level": {
    A: { title_es: "Sección A", title_en: "Section A", desc_es: "Value Engine aplicado", desc_en: "Applied Value Engine" },
    B: { title_es: "Sección B", title_en: "Section B", desc_es: "Producto (Master File)", desc_en: "Product (Master File)" },
    C: { title_es: "Sección C", title_en: "Section C", desc_es: "Acordeón y respuestas", desc_en: "Acordeón & responses" },
    D: { title_es: "Sección D", title_en: "Section D", desc_es: "Canales", desc_en: "Channels" },
    E: { title_es: "Sección E", title_en: "Section E", desc_es: "CORAA y operación", desc_en: "CORAA & operations" },
    F: { title_es: "Sección F", title_en: "Section F", desc_es: "Pricing", desc_en: "Pricing" },
  },
  "Senior": {},
};

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED FALLBACK — 55 Junior questions (always available offline)
// ─────────────────────────────────────────────────────────────────────────────
export const FALLBACK_QUESTIONS: QuizQuestion[] = [
  // ── Section A ──
  { id:"JR-A-01", tier:"Junior", section:"A", question:"Explica la diferencia entre un tour privado y un tour compartido (Small Group) e incluye 2 ventajas de cada modalidad.", modelAnswer:"Un tour privado es operado únicamente con la familia reservada en su propio vehículo, sin paradas adicionales. Un Small Group opera con máximo 4 paradas de pick-up y entre 11–14 invitados. Ventajas privado: horario flexible, experiencia 100% personalizada. Ventajas Small Group: precio más económico, ideal para conocer otras personas." },
  { id:"JR-A-02", tier:"Junior", section:"A", question:"¿Por qué Chichén Itzá normalmente requiere salidas tempranas? Menciona al menos 3 motivos.", modelAnswer:"1) Diferente zona horaria — llegamos justo a la apertura. 2) Evitamos el tráfico. 3) Menos aglomeraciones. 4) Menos calor. 5) Mejores fotos y experiencia de mayor calidad." },
  { id:"JR-A-03", tier:"Junior", section:"A", question:"Para una familia con niños, ¿qué tipo de tour recomendarías primero y por qué?", modelAnswer:"Cenotes, nado con tortugas, Tankah/Zapote o parques de Xcaret — actividades sencillas donde los niños están seguros y se divierten." },
  { id:"JR-A-04", tier:"Junior", section:"A", question:"Define qué es un cenote tipo caverna y menciona 1 recomendación de seguridad.", modelAnswer:"Cuerpo de agua subterráneo con estalactitas y estalagmitas conectado a ríos subterráneos. Recomendación: uso obligatorio de chaleco salvavidas y verificar buena movilidad del invitado." },
  { id:"JR-A-05", tier:"Junior", section:"A", question:"Si los invitados se hospedan en Cancún, ¿qué locación de cenotes recomendarías por logística?", modelAnswer:"Cancun Mayan Jungle Expedition — la más cercana y conveniente logísticamente." },
  { id:"JR-A-06", tier:"Junior", section:"A", question:"Menciona 3 servicios que incluyen alimentos y 3 que normalmente no los incluyen.", modelAnswer:"Con alimentos: Chichen Itza, Ek Balam, Mayan Jungle, Cancun Mayan Jungle, Las Coloradas, Mariposas Monarca, Mayan Cooking Class, Taste of Mexico. Sin alimentos: Snorkel Puerto Morelos, Crystal Cancun, Aquatic Turtle Dream." },
  { id:"JR-A-07", tier:"Junior", section:"A", question:"Menciona al menos 5 add-ons que podemos ofrecer y explica cuándo conviene sugerirlos.", modelAnswer:"Nado con tortugas, ATVs, cenote extra, Laguna Yalku, snorkel Puerto Morelos, guía Chichen Itza, Crystal Cancun, Wild Monkey Reserve, speed boats, temazcal. Sugerirlos cuando el invitado quiere personalizar y completar la experiencia." },
  { id:"JR-A-08", tier:"Junior", section:"A", question:"Explica la diferencia entre Chichén Itzá Express vs Clásico vs Premium.", modelAnswer:"Clásico: zona arqueológica + cenote Samal con almuerzo + Valladolid, guía incluido. Premium: Clásico + cenote Chukum extra. Express: solo visita a Chichen Itza, sin paradas extras; guía opcional." },
  { id:"JR-A-09", tier:"Junior", section:"A", question:"¿Con cuánta anticipación debe cancelarse un servicio para aplicar cancelación sin penalización?", modelAnswer:"24 horas estándar. Grupos 10+ personas: 48 horas. Catamaranes privados, pescas o yates: mínimo 7 días." },
  { id:"JR-A-10", tier:"Junior", section:"A", question:"¿Qué es un fuel surcharge, por qué existe y en qué casos se aplica? Especifica dónde y cómo.", modelAnswer:"Cargo por gasolina en servicios de larga distancia. PT Chichen Itza/Ek Balam al norte de Xcaret: +$68 USD al total. SG Chichen Itza al norte de Xcaret: $9 USD/persona. SG Tiburón Ballena al sur de Xcaret: $20 USD/persona. SP Tiburón Ballena al sur de Xcaret: +$40 USD al total." },
  { id:"JR-A-11", tier:"Junior", section:"A", question:"Explica la diferencia entre el perfil/operación de clientes de LDM vs KTM.", modelAnswer:"KTM: clientes directos, proceso consultivo con orientación y cierre directo. LDM: clientes vía travel advisors; enfoque en información clara y premium para que el intermediario venda con confianza." },
  { id:"JR-A-12", tier:"Junior", section:"A", question:"¿Por qué es obligatorio solicitar hotel + ubicación exacta antes de cerrar un servicio? Menciona 2 riesgos.", modelAnswer:"Sin esta información podríamos enviar al anfitrión al lugar equivocado (gastos de rescate) o causar retraso en el inicio (insatisfacción del invitado)." },
  { id:"JR-A-13", tier:"Junior", section:"A", question:"Menciona los vehículos más comunes y su capacidad máxima. ¿Cuándo conviene Sprinter vs Hiace?", modelAnswer:"Sedan: 2. Hiace: 8. JAC: 12. Sprinter: 16. Minibus: 26. Autobús: 51. Hiace para grupos hasta 8; Sprinter para 9–16." },
  { id:"JR-A-14", tier:"Junior", section:"A", question:"¿Cuál es la información mínima para cotizar correctamente un tour?", modelAnswer:"Hotel de hospedaje, número de invitados, edades de menores si aplica, posibles fechas del servicio." },
  { id:"JR-A-15", tier:"Junior", section:"A", question:"Explica la política de cancelación para servicios afectados por clima.", modelAnswer:"Si las autoridades portuarias cancelan (bandera roja o puertos cerrados), se ofrece reembolso completo o reagendamiento según disponibilidad del invitado." },
  { id:"JR-A-16", tier:"Junior", section:"A", question:"¿Cuándo se confirma el horario de pick-up en Small Group y por qué no se confirma desde el primer contacto?", modelAnswer:"La tarde anterior al servicio, ya que el horario depende de la ruta operativa del día. Se puede dar ventana aproximada como 'entre 6 y 7 am'." },
  { id:"JR-A-17", tier:"Junior", section:"A", question:"¿Los invitados pueden elegir libremente su horario de inicio? Explica cuándo sí y cuándo no.", modelAnswer:"Privados: sí, totalmente personalizables. Servicios con cita fija (Muyil, Speedboat, Crystal Boat, Puerto Morelos, Boca Paila): se ofrecen horarios disponibles. Small Group: no pueden elegir." },
  { id:"JR-A-18", tier:"Junior", section:"A", question:"Si el invitado ya hizo lo más icónico, ¿qué experiencias 'diferentes' recomendarías?", modelAnswer:"Muyil, Sian Ka'an, Boca Paila, Las Coloradas, Río Lagartos, Holbox, Isla Contoy, Bacalar, Mayan Cooking Class, Taste of México — experiencias que profundizan en cultura y naturaleza." },
  { id:"JR-A-19", tier:"Junior", section:"A", question:"Para huéspedes en Tulum, ¿qué locación de snorkel recomendarías y por qué?", modelAnswer:"Akumal y Yalku — cercanía al hotel, comodidad logística y excelente calidad de experiencia de snorkel." },
  { id:"JR-A-20", tier:"Junior", section:"A", question:"¿Cuál es la capacidad máxima del Small Group y qué implica en la venta?", modelAnswer:"11–14 invitados. Garantiza pocas paradas y una experiencia íntima, personalizada y confortable a pesar de ser compartida." },
  { id:"JR-A-21", tier:"Junior", section:"A", question:"¿Cuál es la zona arqueológica más vendida y qué argumento de valor usarías?", modelAnswer:"Chichen Itza — una de las 7 Nuevas Maravillas del Mundo, sitio más visitado de México. En privado y temprano se disfruta con poca gente y flexibilidad total." },
  { id:"JR-A-22", tier:"Junior", section:"A", question:"Menciona 5 servicios donde es indispensable consultar disponibilidad antes de reservar.", modelAnswer:"Yates, catamaranes, pescas, Snorkel Puerto Morelos, Muyil/Sian Ka'an, Crystal Cancun, Speed Boat, Isla Mujeres — cualquier proveedor con capacidad máxima u horarios fijos." },
  { id:"JR-A-23", tier:"Junior", section:"A", question:"Si el cliente dice 'está fuera de mi presupuesto', ¿qué línea de acción tomas? Menciona 2 alternativas.", modelAnswer:"1) Ajustar itinerario o cambiar a Small Group. 2) Si sigue sin aplicar, ofrecer VR-Tours como alternativa más económica." },
  { id:"JR-A-24", tier:"Junior", section:"A", question:"¿Qué información debes confirmar antes de subir cualquier reserva al sistema?", modelAnswer:"Nombre completo del líder, # invitados + edades de menores, ubicación + pin, fecha correcta, horario de inicio preferencial y solicitudes especiales." },
  { id:"JR-A-25", tier:"Junior", section:"A", question:"¿Pueden los invitados hacer servicios acuáticos si no saben nadar? ¿Qué medidas aplican?", modelAnswer:"Sí. Chaleco salvavidas obligatorio y anfitrión acompañando en todo momento. Se anota en observaciones de operación para que el guía esté preparado." },
  { id:"JR-A-26", tier:"Junior", section:"A", question:"¿Por qué la claridad en inclusiones, horarios y políticas reduce cancelaciones y quejas?", modelAnswer:"Alinea expectativas, evita malentendidos, genera compromiso informado, reduce fricción operativa y refuerza confianza y profesionalismo desde el primer contacto." },
  { id:"JR-A-27", tier:"Junior", section:"A", question:"¿Cuál es la edad mínima y máxima para tarifa de menor?", modelAnswer:"De 4 a 17 años." },
  { id:"JR-A-28", tier:"Junior", section:"A", question:"¿Cómo funciona el descuento de menor en KTM vs LDM?", modelAnswer:"KTM: $15 USD de descuento. LDM: $18 USD. Algunos productos ofrecen solo $10 USD menos. Siempre consultar el Master Sheet." },

  // ── Section B ──
  { id:"JR-B-29", tier:"Junior", section:"B", question:"¿Qué contiene el Acordeón y por qué es clave en ventas? ¿Dónde se encuentra?", modelAnswer:"Información curiosa de servicios, enlaces a herramientas de venta y templates para respuestas rápidas. Permite responder con agilidad y precisión. Se encuentra en el Knowledge Base de CORAA." },
  { id:"JR-B-30", tier:"Junior", section:"B", question:"Para un catamarán privado, ¿en qué sección del Acordeón lo buscas y qué datos confirmas antes de cotizar?", modelAnswer:"Sección Catamaranes y Yates. Confirmar: # invitados, lugar de hospedaje, posible fecha." },
  { id:"JR-B-31", tier:"Junior", section:"B", question:"Si el cliente no puede costear un privado, ¿cómo presentas alternativas sin devaluar el producto?", modelAnswer:"Destacar ventajas del privado primero. Opciones válidas cuando el presupuesto no alcanza: 1) Adaptar y personalizar el itinerario del privado al presupuesto del cliente, ajustando destinos o actividades para hacer el privado accesible — esto no devalúa el producto sino que lo flexibiliza. 2) Presentar el Small Group como alternativa de calidad a menor costo, sujeto a días operativos. 3) Ofrecer VR-Tours como opción económica adicional. El objetivo es encontrar la opción que mejor se adapte al cliente sin sacrificar la calidad del servicio." },
  { id:"JR-B-32", tier:"Junior", section:"B", question:"¿Qué ventaja tiene conocer los tiempos reales de traslado? Menciona 2 beneficios.", modelAnswer:"1) Itinerarios certeros con horario de inicio adecuado. 2) Los invitados llegan a tiempo a sus citas de actividades." },
  { id:"JR-B-33", tier:"Junior", section:"B", question:"¿Por qué el clima es clave en ventas y cuáles son las herramientas para anticiparlo en tours marítimos?", modelAnswer:"Permite recomendaciones 'First in Class' y anticipar la política de cancelación para generar confianza. Herramientas: Windguru y mapa SEMAR." },
  { id:"JR-B-34", tier:"Junior", section:"B", question:"¿Qué sección del Acordeón consultas con más frecuencia y para qué preguntas?", modelAnswer:"Respuestas Especiales — para información no disponible en el Master: peso para arneses, marinas de inicio, edades mínimas para ATVs, etc." },
  { id:"JR-B-35", tier:"Junior", section:"B", question:"Cuando el cliente no sabe qué hacer, ¿qué herramienta le envías y qué preguntas haces?", modelAnswer:"Catálogo o mobile brochure. Preguntar: gustos y preferencias, lugar de hospedaje y # invitados para recomendar actividades convenientes." },
  { id:"JR-B-36", tier:"Junior", section:"B", question:"Explica cómo funcionan las tarifas dinámicas y qué variables las hacen cambiar.", modelAnswer:"Los precios de privados se ajustan según # invitados (fijos a partir de 16). La variable más relevante son los menores con sus descuentos por marca y tipo de servicio." },
  { id:"JR-B-37", tier:"Junior", section:"B", question:"Si un grupo quiere catamarán pero no completa para privado, ¿qué opción recomiendas y cómo la explicas?", modelAnswer:"Semiprivado: transporte privado a la marina, precio accesible, posibilidad de convivir. Mencionar que el catamarán es de proveedor externo confiable con estándares de calidad." },
  { id:"JR-B-38", tier:"Junior", section:"B", question:"¿Por qué no debemos improvisar información de tours, políticas o inclusiones?", modelAnswer:"Somos 'First in Class'. Crear expectativas incorrectas genera incomodidad, quejas y daña la reputación de las marcas." },
  { id:"JR-B-39", tier:"Junior", section:"B", question:"¿Qué herramientas te ayudan a responder rápido y con precisión?", modelAnswer:"Catálogos de servicios, Respuestas Especiales del Acordeón y descripciones del Master Sheet." },
  { id:"JR-B-40", tier:"Junior", section:"B", question:"¿Qué ocurre si compartes información incorrecta con otros departamentos? Menciona 3 consecuencias.", modelAnswer:"1) Fallas operativas (pick-up equivocado, logística incorrecta). 2) Mala experiencia del cliente (frustración, quejas). 3) Impacto financiero (reembolsos, retrabajo, correcciones)." },
  { id:"JR-B-41", tier:"Junior", section:"B", question:"¿Cuándo consultas el Acordeón y cuándo escalas la duda?", modelAnswer:"Consultar para información fuera de lo común. Escalar cuando no se encuentra la respuesta, no queda clara, o hay cambios que operación/administración deben saber." },

  // ── Section C ──
  { id:"JR-C-42", tier:"Junior", section:"C", question:"Explica paso a paso cómo subir una reservación en CORAA desde creación hasta confirmación.", modelAnswer:"1) Crear reserva: nombre, correo y teléfono. 2) Seleccionar tour, fecha, horario e invitados con edades. 3) Ubicación + pin. 4) Inclusiones, solicitudes especiales, Obs. OP y AD. 5) Balance, depósito, forma de pago. 6) Doble chequeo. 7) Guardar — se envía confirmación automáticamente." },
  { id:"JR-C-43", tier:"Junior", section:"C", question:"¿Qué información es indispensable al crear un booking en CORAA para tours y para yates/catamaranes?", modelAnswer:"Tours: nombre, correo, teléfono, fecha, horario, # invitados + edades, ubicación + pin, solicitudes, balance, depósito, pago. Yates/Cats: añadir marina, dock fee y quién paga, hora de salida, duración, inclusiones y si incluye transporte." },
  { id:"JR-C-44", tier:"Junior", section:"C", question:"Menciona 5 errores comunes al registrar reservas en CORAA, por qué son problemáticos y cómo prevenirlos.", modelAnswer:"Errores en: fecha, horario, hotel, # invitados, omisión de solicitudes especiales. Provocan servicios erróneos e insatisfacción. Prevención: doble chequeo completo antes de confirmar." },
  { id:"JR-C-45", tier:"Junior", section:"C", question:"¿Cuál es la diferencia entre Observ. AD y Observ. OP? Da 5 ejemplos de cada una.", modelAnswer:"AD (dinero): descuentos, promociones, reembolsos, dock fees, comisiones. OP (operación): edades de menores, alergias, sillas de bebé, limitaciones de movilidad, parada adicional." },
  { id:"JR-C-46", tier:"Junior", section:"C", question:"¿Qué información va en Special Requests? Da 3 ejemplos.", modelAnswer:"Solicitudes fuera de lo común: flores o pastel para celebración, licor específico, tiempo libre extra para compras." },
  { id:"JR-C-47", tier:"Junior", section:"C", question:"¿Qué es el Knowledge Base, para qué sirve y cuándo lo consultarías?", modelAnswer:"Fuente central de información oficial: tours, procesos, políticas, proveedores, logística. Se consulta ante cualquier duda o antes de enviar información a un cliente u otro departamento." },
  { id:"JR-C-48", tier:"Junior", section:"C", question:"¿Qué significa 'First in Class' para nosotros y por qué no es un eslogan?", modelAnswer:"Es un comportamiento diario: reducir fricción, eliminar incertidumbre y prevenir problemas antes de que aparezcan. El estándar de calidad, claridad y cuidado aplicado en cada interacción." },
  { id:"JR-C-49", tier:"Junior", section:"C", question:"¿Cuándo se envía el correo de confirmación y qué condiciones deben cumplirse antes?", modelAnswer:"Se envía automáticamente al guardar en CORAA, después de completar el doble chequeo con todos los datos correctos." },
  { id:"JR-C-50", tier:"Junior", section:"C", question:"¿Qué es el handoff de ventas a operaciones como punto crítico de control?", modelAnswer:"La transición donde la intención se convierte en ejecución. Un handoff 'First in Class' transfiere claridad para que operaciones prepare todo con confianza y la ejecución sea calmada y predecible." },
  { id:"JR-C-51", tier:"Junior", section:"C", question:"¿Por qué importa el número de habitación?", modelAnswer:"Es requisito de la ODS como documento oficial: autoriza el servicio, confirma que somos proveedores precontratados, facilita ubicar al invitado y agiliza comunicación ante incidencias." },
  { id:"JR-C-52", tier:"Junior", section:"C", question:"¿Qué es la ODS y por qué es importante tener todos los datos completos?", modelAnswer:"Orden de Servicio: centraliza información clave de la reserva para que todos trabajen con los mismos datos. Reduce errores, evita malentendidos y sirve como respaldo ante hoteles, marinas o terceros." },
  { id:"JR-C-53", tier:"Junior", section:"C", question:"¿Cuáles son las condiciones especiales en Princess, Vidanta, Hard Rock Riviera Maya y Hyatt Ziva?", modelAnswer:"Princess: main gate. Vidanta: Central Lobby. Hard Rock: confirmar Hacienda (familiar) o Heaven (azul). Hyatt Ziva: dos propiedades (Cancún y Riviera Maya) — siempre confirmar cuál." },
  { id:"JR-C-54", tier:"Junior", section:"C", question:"¿Qué significa DMC?", modelAnswer:"Destination Management Company — empresa especializada en planificación, coordinación y operación de servicios turísticos dentro de un destino específico." },
  { id:"JR-C-55", tier:"Junior", section:"C", question:"¿En qué año se fundaron LDM y KTM?", modelAnswer:"2014." },

  // ═══════════════════════════════════════════════════════════════════════════
  // MID-LEVEL — 60 questions across 6 sections (A–F)
  //   A: Value Engine aplicado (8)   B: Producto/Master File (14)
  //   C: Acordeón y respuestas (10)  D: Canales (8)
  //   E: CORAA y operación (10)      F: Pricing (10)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Section A — Value Engine aplicado ──
  { id:"ML-A-01", tier:"Mid-Level", section:"A", question:"Si un cliente te hace la misma pregunta varias veces durante la conversación, ¿qué significa esto sobre tu explicación y qué deberías cambiar?", modelAnswer:"Significa que la explicación no fue clara o no generó confianza. Se debe reorganizar la respuesta, simplificarla y abordar la duda de forma más directa." },
  { id:"ML-A-02", tier:"Mid-Level", section:"A", question:"Si el cliente dice \"sí entiendo\", pero no toma decisión, ¿qué elemento falta en tu comunicación?", modelAnswer:"Falta un siguiente paso claro que lo guíe a decidir." },
  { id:"ML-A-03", tier:"Mid-Level", section:"A", question:"Si envías un mensaje muy completo pero el cliente sigue confundido, ¿cuál fue el problema principal?", modelAnswer:"La falta de claridad. Dar mucha información sin estructura no genera valor." },
  { id:"ML-A-04", tier:"Mid-Level", section:"A", question:"Si un cliente está comparando muchas opciones y no logra decidir, ¿cómo debes intervenir?", modelAnswer:"Reduciendo opciones y recomendando una alternativa concreta." },
  { id:"ML-A-05", tier:"Mid-Level", section:"A", question:"Si el cliente sigue pidiendo más detalles después de varias explicaciones, ¿qué indica esto sobre la conversación?", modelAnswer:"Que no se ha generado suficiente confianza ni claridad." },
  { id:"ML-A-06", tier:"Mid-Level", section:"A", question:"¿Qué sucede cuando das demasiada información sin orden ni prioridad?", modelAnswer:"Se genera confusión y se frena la decisión." },
  { id:"ML-A-07", tier:"Mid-Level", section:"A", question:"¿Qué debe lograr cada mensaje que envías al cliente?", modelAnswer:"Que el cliente avance hacia una decisión con mayor claridad." },
  { id:"ML-A-08", tier:"Mid-Level", section:"A", question:"¿Qué efecto tiene presionar al cliente para que compre rápido?", modelAnswer:"Genera desconfianza y resistencia." },

  // ── Section B — Producto (Master File) ──
  { id:"ML-B-01", tier:"Mid-Level", section:"B", question:"Si un cliente asume que un tour incluye algo que no aparece en la descripción, ¿cómo debes manejar la situación antes de cerrar?", modelAnswer:"Aclarando explícitamente qué incluye y qué no, antes de confirmar." },
  { id:"ML-B-02", tier:"Mid-Level", section:"B", question:"Si el cliente está fuera de la zona incluida en el transporte, ¿qué pasos debes seguir antes de confirmar el servicio?", modelAnswer:"Verificar si hay suplemento o alternativa disponible." },
  { id:"ML-B-03", tier:"Mid-Level", section:"B", question:"Si el cliente quiere modificar el itinerario base del tour, ¿cómo debes tratar esa solicitud?", modelAnswer:"Evaluarla como servicio personalizado o escalarla." },
  { id:"ML-B-04", tier:"Mid-Level", section:"B", question:"Si el cliente no entiende cuánto dura realmente el tour, ¿cómo debes explicarlo?", modelAnswer:"Separando claramente traslados y actividad principal." },
  { id:"ML-B-05", tier:"Mid-Level", section:"B", question:"Si un cliente quiere agregar una actividad adicional que no está incluida, ¿qué debes hacer antes de confirmarla?", modelAnswer:"Validar disponibilidad real." },
  { id:"ML-B-06", tier:"Mid-Level", section:"B", question:"Si el cliente cree que todo el tour es flexible, ¿qué debes aclarar?", modelAnswer:"Qué partes son fijas y cuáles pueden cambiar." },
  { id:"ML-B-07", tier:"Mid-Level", section:"B", question:"Si el cliente cuestiona un cargo adicional obligatorio, ¿cómo debes explicarlo?", modelAnswer:"Como un costo externo que no controlamos." },
  { id:"ML-B-08", tier:"Mid-Level", section:"B", question:"Si el cliente pide cambiar un horario fijo, ¿qué debes evaluar antes de aceptar?", modelAnswer:"El impacto en la operación." },
  { id:"ML-B-09", tier:"Mid-Level", section:"B", question:"Si el cliente compara tu tour con uno más barato, ¿cómo debes responder?", modelAnswer:"Explicando diferencias de valor, no solo precio." },
  { id:"ML-B-10", tier:"Mid-Level", section:"B", question:"Si el cliente no pregunta por restricciones, ¿qué responsabilidad tienes tú?", modelAnswer:"Anticiparlas y comunicarlas." },
  { id:"ML-B-11", tier:"Mid-Level", section:"B", question:"Si el cliente te pregunta algo que no está claro en el producto, ¿qué debes hacer?", modelAnswer:"Confirmar antes de responder." },
  { id:"ML-B-12", tier:"Mid-Level", section:"B", question:"Si el cliente pide garantía sobre el clima, ¿cómo debes responder correctamente?", modelAnswer:"Explicando que no se puede garantizar y detallando políticas." },
  { id:"ML-B-13", tier:"Mid-Level", section:"B", question:"Si el cliente solicita algo fuera del alcance del tour, ¿qué debes evitar hacer?", modelAnswer:"Evitar asumir o prometer sin validar." },
  { id:"ML-B-14", tier:"Mid-Level", section:"B", question:"¿Cuál es el error más grave que puedes cometer al explicar un tour?", modelAnswer:"Prometer algo que no está incluido." },

  // ── Section C — Acordeón y respuestas ──
  { id:"ML-C-01", tier:"Mid-Level", section:"C", question:"Si un cliente hace una pregunta sencilla, ¿cómo debe ser tu respuesta?", modelAnswer:"Directa, clara y sin información innecesaria." },
  { id:"ML-C-02", tier:"Mid-Level", section:"C", question:"Si un cliente pide muchos detalles complejos en chat, ¿qué canal es más adecuado y por qué?", modelAnswer:"Email, porque permite estructurar mejor la información." },
  { id:"ML-C-03", tier:"Mid-Level", section:"C", question:"¿Qué problema genera una respuesta larga sin estructura?", modelAnswer:"Confusión y pérdida de atención." },
  { id:"ML-C-04", tier:"Mid-Level", section:"C", question:"Si el cliente necesita una respuesta rápida, ¿cómo debes estructurarla?", modelAnswer:"Clara, corta y organizada." },
  { id:"ML-C-05", tier:"Mid-Level", section:"C", question:"Si presentas demasiadas opciones al cliente, ¿qué efecto puede tener?", modelAnswer:"Paraliza la decisión." },
  { id:"ML-C-06", tier:"Mid-Level", section:"C", question:"Si el cliente deja de responder después de un mensaje largo, ¿qué pudo haber pasado?", modelAnswer:"Se saturó de información." },
  { id:"ML-C-07", tier:"Mid-Level", section:"C", question:"Si el cliente hace una pregunta directa, ¿cómo debes responder?", modelAnswer:"Responder primero y luego ampliar si es necesario." },
  { id:"ML-C-08", tier:"Mid-Level", section:"C", question:"Si el cliente necesita confirmación rápida, ¿cómo debe ser tu respuesta?", modelAnswer:"Concreta y segura." },
  { id:"ML-C-09", tier:"Mid-Level", section:"C", question:"¿Qué transmite una respuesta genérica al cliente?", modelAnswer:"Falta de atención y reduce confianza." },
  { id:"ML-C-10", tier:"Mid-Level", section:"C", question:"¿Qué elemento nunca debe faltar en una respuesta?", modelAnswer:"El siguiente paso claro." },

  // ── Section D — Canales ──
  { id:"ML-D-01", tier:"Mid-Level", section:"D", question:"Si un cliente pide una cotización completa por chat, ¿qué debes hacer?", modelAnswer:"Dar resumen y mover a email." },
  { id:"ML-D-02", tier:"Mid-Level", section:"D", question:"Si acuerdas algo en llamada, ¿qué debes hacer después?", modelAnswer:"Confirmarlo por escrito." },
  { id:"ML-D-03", tier:"Mid-Level", section:"D", question:"Si un cliente OTA pide un upgrade pagado, ¿qué debes hacer?", modelAnswer:"No vender; solo asistir." },
  { id:"ML-D-04", tier:"Mid-Level", section:"D", question:"Si hablas con un cliente B2B, ¿cómo debe ser tu comunicación?", modelAnswer:"Clara y reenviable." },
  { id:"ML-D-05", tier:"Mid-Level", section:"D", question:"Si hablas con un cliente B2C, ¿cómo debe ser tu comunicación?", modelAnswer:"Simple y directa." },
  { id:"ML-D-06", tier:"Mid-Level", section:"D", question:"Si el cliente pide cambios por WhatsApp, ¿qué debes hacer?", modelAnswer:"Documentarlo en sistema." },
  { id:"ML-D-07", tier:"Mid-Level", section:"D", question:"Si el cliente usa un tono informal, ¿cómo debes responder?", modelAnswer:"Manteniendo profesionalismo." },
  { id:"ML-D-08", tier:"Mid-Level", section:"D", question:"Si el cliente no decide, ¿qué debes hacer?", modelAnswer:"Guiarlo con una recomendación clara." },

  // ── Section E — CORAA y operación ──
  { id:"ML-E-01", tier:"Mid-Level", section:"E", question:"Si hay un cambio en el horario del servicio, ¿dónde debe registrarse y por qué?", modelAnswer:"En Observ. OP, porque afecta la ejecución." },
  { id:"ML-E-02", tier:"Mid-Level", section:"E", question:"Si hay un cambio en el precio, ¿dónde se registra?", modelAnswer:"En Observ. AD." },
  { id:"ML-E-03", tier:"Mid-Level", section:"E", question:"Si el cliente tiene una preferencia especial, ¿dónde se documenta?", modelAnswer:"Special Requests." },
  { id:"ML-E-04", tier:"Mid-Level", section:"E", question:"¿Por qué es un error dejar cambios solo en WhatsApp?", modelAnswer:"Porque no queda registro oficial." },
  { id:"ML-E-05", tier:"Mid-Level", section:"E", question:"¿Qué riesgo genera una reserva incompleta?", modelAnswer:"Errores en la operación." },
  { id:"ML-E-06", tier:"Mid-Level", section:"E", question:"Si operación no tiene información suficiente, ¿qué sucede?", modelAnswer:"Debe improvisar." },
  { id:"ML-E-07", tier:"Mid-Level", section:"E", question:"¿Cómo debe ser un handoff correcto?", modelAnswer:"Claro, completo y sin dudas." },
  { id:"ML-E-08", tier:"Mid-Level", section:"E", question:"Si no documentas una necesidad especial, ¿qué puede pasar?", modelAnswer:"Mala experiencia del cliente." },
  { id:"ML-E-09", tier:"Mid-Level", section:"E", question:"¿Qué permite una buena documentación?", modelAnswer:"Ejecución sin errores." },
  { id:"ML-E-10", tier:"Mid-Level", section:"E", question:"¿Qué ocurre si no escalas un problema a tiempo?", modelAnswer:"Se convierte en un problema mayor." },

  // ── Section F — Pricing ──
  { id:"ML-F-01", tier:"Mid-Level", section:"F", question:"Si un cliente pide descuento de inmediato, ¿cómo debes responder correctamente?", modelAnswer:"Reforzando valor antes de considerar cualquier ajuste." },
  { id:"ML-F-02", tier:"Mid-Level", section:"F", question:"Si el cliente compara precios con otra opción, ¿qué debes hacer?", modelAnswer:"Explicar diferencias de valor." },
  { id:"ML-F-03", tier:"Mid-Level", section:"F", question:"Si el cliente no percibe valor, ¿qué debes ajustar?", modelAnswer:"La forma de comunicar." },
  { id:"ML-F-04", tier:"Mid-Level", section:"F", question:"Si el cliente quiere negociar, ¿qué debes mantener?", modelAnswer:"La estructura de precios." },
  { id:"ML-F-05", tier:"Mid-Level", section:"F", question:"Si el cliente solo busca precio bajo, ¿qué debes evaluar?", modelAnswer:"Si es el cliente adecuado." },
  { id:"ML-F-06", tier:"Mid-Level", section:"F", question:"Si el cliente duda por precio, ¿qué debes reforzar?", modelAnswer:"Confianza y valor." },
  { id:"ML-F-07", tier:"Mid-Level", section:"F", question:"Si el cliente pide una excepción, ¿qué debes hacer?", modelAnswer:"Evaluar o escalar." },
  { id:"ML-F-08", tier:"Mid-Level", section:"F", question:"¿Qué pasa si das precio sin contexto?", modelAnswer:"Genera objeciones." },
  { id:"ML-F-09", tier:"Mid-Level", section:"F", question:"¿Qué efecto tiene un precio bien explicado?", modelAnswer:"Reduce resistencia." },
  { id:"ML-F-10", tier:"Mid-Level", section:"F", question:"¿Cómo sabes que una venta fue correcta?", modelAnswer:"El cliente entiende, confía y decide con claridad." },
];

// ─────────────────────────────────────────────────────────────────────────────
// CSV PARSER
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { current.push(field); field = ""; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(field); field = "";
        if (current.some((c) => c.trim())) rows.push(current);
        current = [];
        if (ch === "\r") i++;
      } else { field += ch; }
    }
  }
  if (field || current.length) {
    current.push(field);
    if (current.some((c) => c.trim())) rows.push(current);
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSE QUESTIONS FROM CSV TEXT
// Accepts LDK template columns: id, tier, section, question, model_answer,
// tags, notes — matched by header name, any column order
// ─────────────────────────────────────────────────────────────────────────────
export function parseQuestionsFromCSV(csvText: string): {
  questions: QuizQuestion[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    return { questions: FALLBACK_QUESTIONS, errors: ["CSV is empty or has no data rows — using built-in questions."] };
  }

  const headers = rows[0].map(normalizeHeader);

  const idx = {
    id:          headers.indexOf("id"),
    tier:        headers.indexOf("tier"),
    section:     headers.indexOf("section"),
    question:    headers.indexOf("question"),
    modelAnswer: (["modelanswer","model_answer","answer","modelandswer"] as const)
                   .map((k) => headers.indexOf(k)).find((i) => i >= 0) ?? -1,
    tags:        headers.indexOf("tags"),
    notes:       headers.indexOf("notes"),
  };

  const missing = (["tier","question","modelAnswer"] as const)
    .filter((k) => idx[k] === -1);
  if (missing.length > 0) {
    return {
      questions: FALLBACK_QUESTIONS,
      errors: [`Missing required columns: ${missing.join(", ")}. Check your CSV headers match the template.`],
    };
  }

  const get = (row: string[], colIdx: number) =>
    colIdx >= 0 ? (row[colIdx] ?? "").trim() : "";

  const VALID_TIERS    = ["Junior","Mid-Level","Senior"] as const;
  const VALID_SECTIONS = ["A","B","C","D","E","F","All"] as const;

  const questions: QuizQuestion[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const tier    = get(row, idx.tier) as Tier;
    const section = (get(row, idx.section) || "All") as Section;
    const question    = get(row, idx.question);
    const modelAnswer = get(row, idx.modelAnswer);

    if (!question)    { errors.push(`Row ${rowNum}: empty question — skipped`); continue; }
    if (!modelAnswer) { errors.push(`Row ${rowNum}: missing model answer — skipped`); continue; }
    if (!VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) {
      errors.push(`Row ${rowNum}: invalid tier '${tier}' (use: Junior, Mid-Level, Senior) — skipped`); continue;
    }
    if (!VALID_SECTIONS.includes(section as typeof VALID_SECTIONS[number])) {
      errors.push(`Row ${rowNum}: invalid section '${section}' (use: A, B, C, All) — skipped`); continue;
    }

    const rawId = get(row, idx.id);
    const id = rawId || `${tier.replace("-","").toUpperCase()}-${section}-${String(questions.length + 1).padStart(2,"0")}`;

    questions.push({ id, tier, section, question, modelAnswer,
      tags:  get(row, idx.tags)  || undefined,
      notes: get(row, idx.notes) || undefined,
    });
  }

  return {
    questions: questions.length > 0 ? questions : FALLBACK_QUESTIONS,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH FROM GOOGLE SHEET — must be published as CSV (not just shared)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchQuestionsFromSheet(sheetUrl: string): Promise<{
  questions: QuizQuestion[];
  errors: string[];
}> {
  try {
    const res = await fetch(sheetUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseQuestionsFromCSV(text);
  } catch (err) {
    return {
      questions: FALLBACK_QUESTIONS,
      errors: [
        `Could not load Google Sheet: ${String(err)}. ` +
        `Use File → Share → Publish to web → CSV (not the normal share link).`,
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function getByTier(questions: QuizQuestion[], tier: Tier): QuizQuestion[] {
  return questions.filter((q) => q.tier === tier);
}

export function getByTierAndSection(
  questions: QuizQuestion[], tier: Tier, section: Section
): QuizQuestion[] {
  return questions.filter(
    (q) => q.tier === tier && (q.section === section || q.section === "All")
  );
}

export function getSectionCounts(questions: QuizQuestion[], tier: Tier): Record<string, number> {
  const filtered = getByTier(questions, tier);
  const counts: Record<string, number> = { All: filtered.length };
  for (const sec of TIER_SECTIONS[tier]) {
    counts[sec] = filtered.filter((q) => q.section === sec || q.section === "All").length;
  }
  return counts;
}
