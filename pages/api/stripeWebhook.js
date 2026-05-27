import Stripe from 'stripe';
import axios from 'axios';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe requires the raw body to verify webhook signatures
export const config = {
  api: { bodyParser: false },
};

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Map Stripe price IDs back to plan names
function planFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID]: 'starter',
    [process.env.STRIPE_STARTER_ANNUAL_PRICE_ID]: 'starter',
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID]: 'pro',
    [process.env.STRIPE_PRO_ANNUAL_PRICE_ID]: 'pro',
  };
  return map[priceId] || null;
}

function intervalFromPriceId(priceId) {
  const annualIds = [
    process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  ];
  return annualIds.includes(priceId) ? 'annual' : 'monthly';
}

async function updateUserPlan(strapiUserId, plan, subscriptionId, interval) {
  const mvcurl = process.env.NEXT_PUBLIC_STRAPI_HOST || 'http://localhost:1337';
  // Webhooks have no user JWT, so the Strapi endpoint (auth:false) is
  // authenticated with a shared secret sent in the x-webhook-secret header.
  // Must match WEBHOOK_SECRET on the Strapi backend.
  await axios.put(`${mvcurl}/api/updateUserPlan`, {
    userId: strapiUserId,
    plan,
    stripeSubscriptionId: subscriptionId,
    billingInterval: interval,
  }, {
    headers: { 'x-webhook-secret': process.env.WEBHOOK_SECRET || '' },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const strapiUserId = session.metadata?.strapiUserId;
        const plan = session.metadata?.plan;
        const interval = session.metadata?.interval;
        if (strapiUserId && plan) {
          await updateUserPlan(strapiUserId, plan, session.subscription, interval || 'monthly');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const strapiUserId = customer.metadata?.strapiUserId;
        if (strapiUserId) {
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = planFromPriceId(priceId);
          const interval = intervalFromPriceId(priceId);
          if (plan) {
            await updateUserPlan(strapiUserId, plan, subscription.id, interval);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const strapiUserId = customer.metadata?.strapiUserId;
        if (strapiUserId) {
          await updateUserPlan(strapiUserId, 'free', null, 'monthly');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn('Payment failed for customer:', invoice.customer, 'invoice:', invoice.id);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed.' });
  }

  return res.status(200).json({ received: true });
}
