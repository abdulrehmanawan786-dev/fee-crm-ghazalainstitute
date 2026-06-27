const axios = require('axios');

async function sendWhatsAppMessage(phone, message) {
  let number = phone.replace(/[\s\-\(\)]/g, '');
  if (number.startsWith('0')) number = '92' + number.slice(1);
  if (!number.startsWith('92')) number = '92' + number;

  try {
    const response = await axios.post(
      'http://localhost:3000/api/internal/send-message',
      { phone: number, message },
      {
        headers: {
          'x-api-secret': process.env.INTERNAL_API_SECRET,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`WhatsApp sent to ${number}`);
    return response.data;
  } catch (err) {
    console.error(`WhatsApp error for ${number}:`, err.message);
    throw err;
  }
}

module.exports = { sendWhatsAppMessage };
