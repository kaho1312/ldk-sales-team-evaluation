export interface QuizQuestion {
  id: string;
  en: {
    question: string;
    options: string[];
    explanation: string;
  };
  es: {
    question: string;
    options: string[];
    explanation: string;
  };
  correct: string; // "A" | "B" | "C" | "D"
  category: string;
  tier: string; // "All" | "Mid" | "Senior" | "Lead"
}

// Fallback questions if Google Sheets fetch fails
const FALLBACK_QUESTIONS: QuizQuestion[] = [
  {
    id: "Q001",
    en: {
      question: "What is the LDK pass threshold for Sales Certification?",
      options: ["70%", "80%", "90%", "100%"],
      explanation: "The LDK Sales Handbook requires a minimum score of 90% on certification quizzes to ensure agents meet our quality standards.",
    },
    es: {
      question: "¿Cuál es el mínimo requerido para aprobar la Certificación de Ventas LDK?",
      options: ["70%", "80%", "90%", "100%"],
      explanation: "El Manual de Ventas LDK requiere un puntaje mínimo de 90% en los quizzes de certificación.",
    },
    correct: "C",
    category: "Policy",
    tier: "All",
  },
  {
    id: "Q002",
    en: {
      question: "When a travel advisor client requests a fully private snorkeling tour, which LDK product line should be offered first?",
      options: ["Standard group tour", "OTA listed product", "Living Dreams Mexico private experience", "Refer to competitor"],
      explanation: "Travel advisors are LDK's fastest-growing channel. Living Dreams Mexico handles private, premium experiences.",
    },
    es: {
      question: "Cuando un asesor de viajes solicita un tour de snorkel completamente privado, ¿qué línea de productos LDK se debe ofrecer primero?",
      options: ["Tour grupal estándar", "Producto listado en OTA", "Experiencia privada Living Dreams Mexico", "Referir a la competencia"],
      explanation: "Los asesores de viajes son el canal de más rápido crecimiento de LDK. Living Dreams Mexico maneja experiencias privadas y premium.",
    },
    correct: "C",
    category: "Sales",
    tier: "All",
  },
  {
    id: "Q003",
    en: {
      question: "How long must an agent wait before retaking a failed certification quiz?",
      options: ["1 hour", "12 hours", "24 hours", "48 hours"],
      explanation: "The retake lockout period is 24 hours.",
    },
    es: {
      question: "¿Cuánto tiempo debe esperar un agente antes de volver a intentar un quiz fallido?",
      options: ["1 hora", "12 horas", "24 horas", "48 horas"],
      explanation: "El período de bloqueo para reintentos es de 24 horas.",
    },
    correct: "C",
    category: "Policy",
    tier: "All",
  },
  {
    id: "Q004",
    en: {
      question: "Which booking platform does LDK primarily use for tour management?",
      options: ["Fareharbor", "Peek Pro", "Rezdy", "Bookeo"],
      explanation: "LDK uses Peek Pro as its primary booking platform.",
    },
    es: {
      question: "¿Qué plataforma de reservas usa LDK principalmente para la gestión de tours?",
      options: ["Fareharbor", "Peek Pro", "Rezdy", "Bookeo"],
      explanation: "LDK utiliza Peek Pro como su plataforma principal de reservas.",
    },
    correct: "B",
    category: "CORAA",
    tier: "All",
  },
  {
    id: "Q005",
    en: {
      question: "LDK's 'First in Class' philosophy primarily refers to:",
      options: [
        "Being the lowest price in the market",
        "Transformation-oriented, premium service delivery",
        "Having the most tours in the Riviera Maya",
        "Offering the fastest booking process",
      ],
      explanation: "LDK's core philosophy is 'First in Class' — transformation-oriented service delivery that creates premium, memorable experiences.",
    },
    es: {
      question: "La filosofía 'Primero en su Clase' de LDK se refiere principalmente a:",
      options: [
        "Tener el precio más bajo del mercado",
        "Entrega de servicio orientada a la transformación y premium",
        "Tener el mayor número de tours en la Riviera Maya",
        "Ofrecer el proceso de reserva más rápido",
      ],
      explanation: "La filosofía central de LDK es 'Primero en su Clase' — entrega de servicio orientada a la transformación.",
    },
    correct: "B",
    category: "Brand",
    tier: "All",
  },
];

const LETTERS = ["A", "B", "C", "D"];

/**
 * Fetch questions from a published Google Sheet CSV.
 * Expected columns: ID, Question_EN, OptionA_EN, OptionB_EN, OptionC_EN, OptionD_EN, Explanation_EN,
 *                   Question_ES, OptionA_ES, OptionB_ES, OptionC_ES, OptionD_ES, Explanation_ES,
 *                   CorrectAnswer, Category, Tier
 */
export async function fetchQuestionsFromSheet(sheetUrl: string): Promise<QuizQuestion[]> {
  try {
    const res = await fetch(sheetUrl);
    if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("Sheet has no data rows");

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const questions: QuizQuestion[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 16) continue;
      const get = (col: string) => {
        const idx = headers.indexOf(col.toLowerCase());
        return idx >= 0 ? row[idx]?.trim() || "" : "";
      };

      const correct = get("correctanswer").toUpperCase();
      if (!LETTERS.includes(correct)) continue;

      questions.push({
        id: get("id") || `Q${String(i).padStart(3, "0")}`,
        en: {
          question: get("question_en"),
          options: [get("optiona_en"), get("optionb_en"), get("optionc_en"), get("optiond_en")],
          explanation: get("explanation_en"),
        },
        es: {
          question: get("question_es"),
          options: [get("optiona_es"), get("optionb_es"), get("optionc_es"), get("optiond_es")],
          explanation: get("explanation_es"),
        },
        correct,
        category: get("category") || "General",
        tier: get("tier") || "All",
      });
    }

    return questions.length > 0 ? questions : FALLBACK_QUESTIONS;
  } catch (err) {
    console.warn("Failed to load questions from Google Sheet, using fallback:", err);
    return FALLBACK_QUESTIONS;
  }
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(field);
        field = "";
        if (current.some((c) => c.trim())) rows.push(current);
        current = [];
        if (ch === "\r") i++;
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length) {
    current.push(field);
    if (current.some((c) => c.trim())) rows.push(current);
  }

  return rows;
}

export function getQuestionsForTier(questions: QuizQuestion[], tier: string): QuizQuestion[] {
  return questions.filter((q) => q.tier === "All" || q.tier === tier);
}

export { FALLBACK_QUESTIONS };
