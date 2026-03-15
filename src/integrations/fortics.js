const axios = require('axios');
const { getForticsToken, refresh, login } = require('./forticsAuth');

async function sendHSM({ to, agent_id, channel_id, close_session, agent, type, is_hsm, deviceToken, attendance_id, hsm_template_name, hsm_placeholders, contact_name }) {
  let token = await getForticsToken();

  console.log("🟩 TOKEN USADO NO SEND:", token);
  console.log("🟩 TOKEN LENGTH:", token?.length);


  const body = {
    platform_id: to,
    agent_id,
    channel_id,
    close_session,
    agent,
    type,
    is_hsm,
    deviceToken,
    attendance_id,
    hsm_template_name,
    hsm_placeholders,
    contact_name,
  };

  try {
    const { data } = await axios.post(
      'https://hortopedico.sz.chat/api/v4/message/send',
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return data;
  } catch (err) {
    if (err.response?.status === 401) {
      console.warn('Token expirado, tentando refresh...');
      console.log("🔥 SEND STATUS:", err.response?.status);
      console.log("🔥 SEND DATA:", err.response?.data);
      token = await refresh();

      const { data } = await axios.post(
        'https://hortopedico.sz.chat/api/v4/message/send',
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return data;
    } else {
      throw err;
    }
  }
}

module.exports = { sendHSM };
