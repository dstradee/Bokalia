import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, email } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_collection: 'always', // OBLIGA A PEDIR TARJETA AUNQUE SEA 0€
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // El ID de tu producto en Stripe de 50€
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 30, // 30 DÍAS GRATIS
        metadata: { supabaseUserId: userId }, // Guardamos el ID para el Webhook
      },
      customer_email: email,
      success_url: `${req.headers.origin}/clientes.html?success=true`,
      cancel_url: `${req.headers.origin}/clientes.html?canceled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
