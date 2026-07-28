import { describe, it, expect } from "vitest";
import { parseSheetQuestions, getSectionsForTier } from "@/lib/questions";

// A faithful slice of the real Senior sheet's CSV export shape: a title row, then
// "SECCIÓN N: …" header rows, each question a numbered row followed by a
// "Respuesta: …" row. Fields with commas are quoted (as Google exports them).
const NATURAL_CSV = [
  `,SENIOR LEVEL – EVALUACIÓN`,
  `,`,
  `,SECCIÓN 1: DECISIÓN BAJO PRESIÓN (10)`,
  `1,"Un cliente quiere cerrar hoy mismo, pero solo si recibe un descuento. ¿Cómo decides?"`,
  `,"Respuesta: No ceder a presión. Evaluar si está dentro de políticas."`,
  `2,Un cliente pide una excepción. ¿Qué analizas?`,
  `,Respuesta: El impacto financiero y el precedente.`,
  `,SECCIÓN 2: PRODUCTO Y OPERACIÓN AVANZADA (10)`,
  `11,Un tour depende de varios proveedores. ¿Qué haces antes de confirmarlo?`,
  `,Respuesta: Verificar disponibilidad de todos los elementos.`,
].join("\n");

describe("parseSheetQuestions — natural LDK layout", () => {
  const parsed = parseSheetQuestions(NATURAL_CSV, "Senior");

  it("extracts every question with its model answer", () => {
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.errors).toHaveLength(0);
  });

  it("maps SECCIÓN headers to sequential section letters A, B, …", () => {
    expect(parsed.sections).toEqual(["A", "B"]);
    expect(parsed.questions.filter((q) => q.section === "A")).toHaveLength(2);
    expect(parsed.questions.filter((q) => q.section === "B")).toHaveLength(1);
  });

  it("stamps the tier and generates stable per-section ids", () => {
    expect(parsed.questions.every((q) => q.tier === "Senior")).toBe(true);
    expect(parsed.questions.map((q) => q.id)).toEqual(["SR-A-01", "SR-A-02", "SR-B-01"]);
  });

  it("strips the 'Respuesta:' prefix from model answers", () => {
    expect(parsed.questions[0].modelAnswer).toBe(
      "No ceder a presión. Evaluar si está dentro de políticas.",
    );
    expect(parsed.questions[0].modelAnswer).not.toMatch(/respuesta/i);
  });

  it("keeps the embedded comma inside a quoted question", () => {
    expect(parsed.questions[0].question).toContain("cerrar hoy mismo, pero solo si");
  });

  it("derives section labels from the sheet headers (count suffix removed)", () => {
    expect(parsed.sectionMeta.A?.desc_es).toBe("DECISIÓN BAJO PRESIÓN");
    expect(parsed.sectionMeta.B?.desc_es).toBe("PRODUCTO Y OPERACIÓN AVANZADA");
  });
});

describe("parseSheetQuestions — robustness", () => {
  it("skips a question that has no following answer, with an error note", () => {
    const csv = [
      `,SECCIÓN 1: X (2)`,
      `1,Pregunta sin respuesta`,
      `2,Pregunta con respuesta`,
      `,Respuesta: la respuesta`,
    ].join("\n");
    const parsed = parseSheetQuestions(csv, "Senior");
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].modelAnswer).toBe("la respuesta");
    expect(parsed.errors.some((e) => /pregunta sin respuesta/i.test(e))).toBe(true);
  });

  // Regression test for a real incident: a question was added to the live Senior
  // sheet whose answer row was typed WITHOUT the "Respuesta:" label (just the raw
  // answer text). The old parser required that literal label to recognize an
  // answer row, so it silently dropped both the question and the next one. The
  // parser now uses the sheet's own numbered-question column (a bare integer in
  // column 0) as the signal for "new question" instead, so any non-question row
  // that follows is treated as the answer, labeled or not.
  it("accepts an answer row that's missing the 'Respuesta:' label entirely", () => {
    const csv = [
      `,SECCIÓN 2: PRODUCTO Y OPERACIÓN AVANZADA (10)`,
      `20,Detectas un error en la descripción del producto. ¿Qué haces?`,
      `,Respuesta: Escalar de inmediato.`,
      `21,Escribe los url's de las 4 paginas de web.`,
      `,"www.kay.tours, www.livingdreamsmexico.com, www.livingdreamsmexico.city"`,
      `,SECCIÓN 3: ESCALACIÓN AVANZADA (10)`,
    ].join("\n");
    const parsed = parseSheetQuestions(csv, "Senior");
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.questions[1].question).toContain("4 paginas de web");
    expect(parsed.questions[1].modelAnswer).toBe(
      "www.kay.tours, www.livingdreamsmexico.com, www.livingdreamsmexico.city",
    );
  });

  it("reports an error for an empty sheet", () => {
    expect(parseSheetQuestions("", "Senior").errors.length).toBeGreaterThan(0);
    expect(parseSheetQuestions("", "Senior").questions).toHaveLength(0);
  });

  it("does not lose a trailing question that ends the sheet with no answer logged silently", () => {
    const csv = [
      `,SECCIÓN 1: X (1)`,
      `1,Pregunta al final sin respuesta`,
    ].join("\n");
    const parsed = parseSheetQuestions(csv, "Senior");
    expect(parsed.questions).toHaveLength(0);
    expect(parsed.errors.some((e) => /pregunta sin respuesta/i.test(e))).toBe(true);
  });
});

describe("parseSheetQuestions — template layout", () => {
  it("parses the strict header-based template and keeps only the tier's rows", () => {
    const csv = [
      `id,tier,section,question,model_answer`,
      `SR-A-01,Senior,A,¿Pregunta uno?,Respuesta uno`,
      `SR-B-01,Senior,B,¿Pregunta dos?,Respuesta dos`,
      `JR-A-01,Junior,A,Otra,Otra respuesta`,
    ].join("\n");
    const parsed = parseSheetQuestions(csv, "Senior");
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions.every((q) => q.tier === "Senior")).toBe(true);
    expect(parsed.sections).toEqual(["A", "B"]);
  });
});

describe("getSectionsForTier", () => {
  it("derives sections from loaded questions when a tier has none hardcoded", () => {
    const { questions } = parseSheetQuestions(NATURAL_CSV, "Senior");
    expect(getSectionsForTier(questions, "Senior")).toEqual(["A", "B"]);
  });
});
