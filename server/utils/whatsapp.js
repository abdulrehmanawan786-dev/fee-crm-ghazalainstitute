const axios = require('axios');

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendWhatsAppMessage(phone, message) {
  let number = phone.replace(/[\s\-\(\)]/g, '');
  if (number.startsWith('0')) number = '92' + number.slice(1);
  if (!number.startsWith('92')) number = '92' + number;
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: number,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`WhatsApp sent to ${number}:`, response.data);
    return response.data;
  } catch (err) {
    console.error(`WhatsApp error for ${number}:`, err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendWhatsAppMessage };
