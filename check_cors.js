import axios from 'axios';

async function checkCors() {
  try {
    const res = await axios.options('https://torrentio.strem.fun/stream/movie/tt32338669.json', {
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    console.log('OPTIONS status:', res.status);
    console.log('CORS headers:', res.headers);
  } catch (e) {
    console.log('OPTIONS error:', e.message);
  }

  try {
    const getRes = await axios.get('https://torrentio.strem.fun/stream/movie/tt32338669.json', {
      headers: { 'Origin': 'https://example.com' }
    });
    console.log('GET status:', getRes.status);
    console.log('GET CORS header:', getRes.headers['access-control-allow-origin']);
  } catch (e) {
    console.log('GET error:', e.message);
  }
}

checkCors();
