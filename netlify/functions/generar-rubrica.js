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

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con esta forma exacta:
{"desempenos":[{"nombre":"...","niveles":{"I":"...","II":"...","III":"...","IV":"..."}}]}
Debe incluir exactamente 5 desempeños.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: errorText }) };
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const clean = (textBlock?.text || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      body: JSON.stringify(parsed)
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
