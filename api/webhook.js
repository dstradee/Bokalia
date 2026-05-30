import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ESTO ES EL PARCHE VITAL PARA VERCEL
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Función para leer los datos en crudo
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(buf.toString(), sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Si la suscripción se crea (con los 30 días gratis o al pagar)
  if (event.type === 'customer.subscription.created' || event.type === 'invoice.payment_succeeded') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.supabaseUserId;

    if(userId) {
       await supabase.from('subscriptions').update({ 
           status: 'activa',
           stripe_subscription_id: subscription.id 
       }).eq('id', userId);
    }
  }

  // Si el pago falla
  if (event.type === 'invoice.payment_failed' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.supabaseUserId;
    if(userId) {
       await supabase.from('subscriptions').update({ status: 'inactiva' }).eq('id', userId);
    }
  }

  res.status(200).json({ received: true });
}
