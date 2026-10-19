import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const TRANZUPI_PUBLIC_KEY = process.env.TRANZUPI_PUBLIC_KEY;
const TRANZUPI_SECRET_KEY = process.env.TRANZUPI_SECRET_KEY;
const TRANZUPI_MID = process.env.TRANZUPI_MID;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const BASE_URL = 'https://api.upitranzact.com';

app.use(express.static(__dirname));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/success.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'success.html'));
});

app.post('/create-payment-link', async (req, res) => {
  try {
    const { amount, customer_name, customer_email, customer_mobile, product_id, user_id, note } = req.body || {};

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ msg: 'Valid amount is required.' });
    }

    if (!TRANZUPI_PUBLIC_KEY || !TRANZUPI_SECRET_KEY || !TRANZUPI_MID) {
      const demoOrderId = `demo_${Date.now()}`;
      const demoUrl = `${FRONTEND_URL}/success.html?demo=1`;
      return res.json({
        payment_link: demoUrl,
        order_id: demoOrderId,
        demo: true,
        message: 'Demo mode: configure TranzUPI keys in the environment to enable real payments.'
      });
    }

    const order_id = `ord_${Date.now()}`;
    const auth = Buffer.from(`${TRANZUPI_PUBLIC_KEY}:${TRANZUPI_SECRET_KEY}`).toString('base64');
    const params = new URLSearchParams({
      mid: TRANZUPI_MID,
      amount: String(amount),
      note: note || 'PDF purchase',
      customer_name: customer_name || 'Customer',
      customer_email: customer_email || 'guest@example.com',
      customer_mobile: customer_mobile || '9999999999'
    });

    const response = await axios.post(`${BASE_URL}/v1/payments/createPaymentLink`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`
      }
    });

    const paymentLink = response?.data?.data?.payment_link;
    if (!paymentLink) {
      return res.status(500).json({ msg: 'Payment link not generated', raw: response?.data || null });
    }

    return res.json({
      payment_link: paymentLink,
      order_id,
      product_id: product_id || null,
      user_id: user_id || null
    });
  } catch (error) {
    console.error('Create payment link error:', error?.response?.data || error.message);
    return res.status(500).json({ msg: 'Payment initiation failed', details: error?.response?.data || error.message });
  }
});

app.post('/create-order', async (req, res) => {
  try {
    const body = req.body || {};
    const response = await app._router ? null : null;
    return res.json({
      payment_url: `${FRONTEND_URL}/success.html?demo=1`,
      order_id: `compat_${Date.now()}`,
      demo: true,
      message: 'Legacy route: use /create-payment-link in the new frontend.'
    });
  } catch (error) {
    console.error('Legacy create-order error:', error);
    return res.status(500).json({ msg: 'Order creation failed' });
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Webhook received:', payload);

    if (payload?.txnStatus === 'SUCCESS') {
      const orderId = payload?.data?.orderId || payload?.data?.order_id || payload?.order_id;
      console.log('✅ Payment successful for order:', orderId);
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).send('Error');
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log('Set TRANZUPI_PUBLIC_KEY, TRANZUPI_SECRET_KEY, and TRANZUPI_MID in your environment to enable real payments.');
});
