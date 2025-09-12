const axios = require('axios');
const { getForticsToken, refresh, login } = require('./forticsAuth');

async function sendHSM({ to,agent_id,channel_id,close_session,agent,type,is_hsm,deviceToken,attendance_id,hsm_template_name,placeholders,contact_name}) {
  let token = await getForticsToken();

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
    placeholders,
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
      token = await refresh();

      const { data } = await axios.post(
        'https://hortopedico.sz.chat/api/v4/messages/send',
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
