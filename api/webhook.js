import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Usamos la Service Role Key para poder escribir en la base de datos saltándonos el RLS
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Configuración de firma webhooks...
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    // req.body raw se captura en Next/Vercel (necesitas configuración extra para raw parser si usas express)
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Si la suscripción se crea (con los 30 días gratis o al pagar)
  if (event.type === 'customer.subscription.created' || event.type === 'invoice.payment_succeeded') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.supabaseUserId; // Lo pasamos en el archivo 1

    if(userId) {
       // Actualizamos a 'activa'
       await supabase.from('subscriptions').update({ 
           status: 'activa',
           stripe_subscription_id: subscription.id 
       }).eq('id', userId);
    }
  }

  if (event.type === 'invoice.payment_failed' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const userId = subscription.metadata?.supabaseUserId;
    if(userId) {
       // Bloqueamos la cuenta
       await supabase.from('subscriptions').update({ status: 'inactiva' }).eq('id', userId);
    }
  }

  res.status(200).json({ received: true });
}
