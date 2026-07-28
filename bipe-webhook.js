// netlify/functions/bipe-webhook.js
//
// Configuración previa requerida:
// 1. Crea cuenta en BiPe Alerta (bipealerta.com) y regístrala sobre tu
//    Yape/Plin personal (948 213 679).
// 2. En BiPe Alerta > Configuración > Webhooks, registra esta URL:
//    https://TU-SITIO.netlify.app/.netlify/functions/bipe-webhook
// 3. En Netlify, agrega las variables de entorno:
//    SUPABASE_URL, SUPABASE_SERVICE_KEY (la service_role, no la anon)
//
// Payload que envía BiPe Alerta (referencia):
// { "NombreCliente": "Juan Perez", "Monto": 8.03, "Tipo": "Yape", "FechaHora": "..." }
//
// Estrategia de matching: cada profesor recibe un monto único con centavos
// (S/8.01, S/8.02...) al ir a pagar (ver asignar_monto en supabase-schema.sql).
// El webhook activa el plan del profesor cuyo monto_asignado coincide exacto
// con lo que BiPe reportó — sin depender de nombres, que pueden repetirse o
// llegar con variaciones de escritura.

const { createClient } = require('@supabase/supabase-js');

const PLAN_DIAS = 30;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const monto = Number(payload.Monto);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Busca el profesor pendiente cuyo monto asignado coincide exacto
    const { data: profesor, error: errBusqueda } = await supabase
      .from('profesores')
      .select('*')
      .eq('monto_asignado', monto)
      .eq('plan_activo', false)
      .order('monto_asignado_en', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errBusqueda) throw errBusqueda;

    if (!profesor) {
      // No hay ninguna asignación pendiente con ese monto exacto (podría ser
      // un pago de otro producto tuyo, ej. KIRU, o alguien pagó fuera de la app)
      return { statusCode: 200, body: JSON.stringify({ ignorado: true, razon: 'sin match de monto' }) };
    }

    const vence_el = new Date(Date.now() + PLAN_DIAS * 86400000).toISOString();

    const { error: errUpdate } = await supabase
      .from('profesores')
      .update({ plan_activo: true, vence_el, monto_asignado: null })
      .eq('id', profesor.id);

    if (errUpdate) throw errUpdate;

    return { statusCode: 200, body: JSON.stringify({ activado: true, profesor_id: profesor.id }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

