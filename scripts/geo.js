import * as axios from 'axios';
import { getTrails } from '../js/communication/trails.ts';

const api_key = process.env.GEO_API_KEY;
async function getDetails(lat, lon) {
  const response = await axios.default.get(`https://api.geoapify.com/v1/geocode/reverse?lang=de&lat=${lat}&lon=${lon}&format=json&apiKey=${api_key}`);
  return {
    state: response.data.results[0].state,
    postCode: response.data.results[0].postcode
  }
}

(async () => {
  const states = [];
  const postCodes = [];
  const trails = await getTrails();
  for (const trail of trails) {
    const {state, postCode} = await getDetails(trail.latitude, trail.longitude);
    states.push(state);
    postCodes.push(postCode);
    console.log(`Trail: ${trail.name} => ${state}, ${postCode}`);
  }

    const countStates = states.reduce((acc, state) => {
        acc[state] = (acc[state] || 0) + 1;
        return acc;
    }, {});
    const countPostCodes = postCodes.reduce((acc, postCode) => {
      acc[postCode] = (acc[postCode] || 0) + 1;
      return acc;
  }, {});
    console.log(countStates);
    console.log(countPostCodes);
})();
