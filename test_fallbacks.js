import axios from 'axios';

async function testFallbacks() {
  const imdbId = 'tt32338669'; // Mutiny
  console.log('Testing Apibay:');
  try {
    const res = await axios.get(`https://apibay.org/q.php?q=${imdbId}`, { timeout: 5000 });
    console.log('Apibay results:', res.data.length);
    if (res.data[0]?.info_hash) {
      console.log('Top from Apibay:', res.data[0].name, 'Seeds:', res.data[0].seeders);
    }
  } catch (e) {
    console.log('Apibay error:', e.message);
  }

  console.log('\nTesting YTS:');
  try {
    const res = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${imdbId}`, { timeout: 5000 });
    console.log('YTS status:', res.data.status, 'Movies:', res.data.data?.movie_count);
  } catch (e) {
    console.log('YTS error:', e.message);
  }
}

testFallbacks();
