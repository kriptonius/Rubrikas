// netlify/functions/generar-rubrica.js
//
// Requiere la variable de entorno ANTHROPIC_API_KEY en Netlify
// (Site settings > Environment variables). Sácala de console.anthropic.com
// (Account Settings > API Keys > Create Key).

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { nivel, area, tema } = JSON.parse(event.body);

    const prompt = `Eres un especialista en evaluación docente del MINEDU (Perú). Genera una rúbrica de observación de aula para una sesión de nivel ${nivel}, área curricular "${area}", con este tema/propósito: "${tema}".

Basa la rúbrica en los 5 desempeños oficiales del Dominio 2 (Enseñanza para el aprendizaje) del Marco de Buen Desempeño Docente, adaptando los indicadores de cada nivel (I a IV) al tema y nivel dados, de forma concreta y observable.

Además, sugiere 3 a 4 actividades concretas y prácticas que el profesor podría usar en esa sesión sobre "${tema}", listas para aplicar sin necesitar más preparación.

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con esta forma exacta:
{"actividades":["...","...","..."],"desempenos":[{"nombre":"...","niveles":{"I":"...","II":"...","III":"...","IV":"..."}}]}
Debe incluir exactamente 5 desempeños y entre 3 y 4 actividades. Cada actividad debe ser concreta y accionable, máximo 25 palabras. Cada descripción de nivel debe ser concisa, máximo 20 palabras. El JSON debe ser válido y estar completo: sin comas finales sobrantes, sin comentarios, sin texto antes o después.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2200,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: errorText }) };
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    let texto = (textBlock?.text || "").replace(/```json|```/g, "").trim();
    // Por si el modelo agrega texto antes/después del JSON, nos quedamos solo con lo que está entre { y }
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (inicio !== -1 && fin !== -1) {
      texto = texto.slice(inicio, fin + 1);
    }
    const parsed = JSON.parse(texto);

    return {
      statusCode: 200,
      body: JSON.stringify(parsed)
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
