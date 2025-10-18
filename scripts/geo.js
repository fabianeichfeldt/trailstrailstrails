import * as axios from 'axios';
import { trails } from '../js/data/trails.js';

const api_key = process.env.API_KEY;
async function getState(lat, lon) {
  const response = await axios.default.get(`https://api.geoapify.com/v1/geocode/reverse?lang=de&lat=${lat}&lon=${lon}&format=json&apiKey=${api_key}`);
  return response.data.results[0].state;
}

(async () => {
  const states = [];
  for (const trail of trails) {
    const state = await getState(trail.coords[0], trail.coords[1]);
    states.push(state);
    console.log(`Trail: ${trail.name} => ${state}`);
  }

    const counts = states.reduce((acc, state) => {
        acc[state] = (acc[state] || 0) + 1;
        return acc;
    }, {});
    console.log(counts);
})();
