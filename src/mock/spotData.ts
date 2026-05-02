/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SPOT DATA — add your real GPX data here
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  HOW TO ADD A SPOT
 *  ──────────────────
 *  1. Find the spot's ID from the database.
 *     Tip: open the app, click the spot marker → the ID appears in the
 *     browser console as "open trail <id>".
 *
 *  2. For each trail, paste the <trkpt> lines from your GPX file.
 *     You can paste a full GPX file or just the <trkpt>...</trkpt> lines.
 *
 *  3. For each tour, list the trail names in riding order.
 *     Uphill transfers between trails are auto-generated.
 *
 *  DIFFICULTY  →  'green' | 'blue' | 'red' | 'black' | 'double-black'
 *  DIRECTION   →  'one-way-down' | 'one-way-up' | 'cw' | 'ccw' | 'both'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { registerSpot } from './spotBuilder';

// ─────────────────────────────────────────────────────────────────────────────
//  Example — replace with your real spot ID and GPX data
// ─────────────────────────────────────────────────────────────────────────────

registerSpot('091de017-bce6-4912-8d39-887b8a5f6160', {
  trails: [
    {
      name: "Hobbit",
      direction: "one-way-down",
      difficulty: "blue",
      gpx: `<?xml version='1.0' encoding='UTF-8'?>
<gpx version="1.1" creator="https://www.komoot.de" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Heidenbergtrails - Hobbit - blau/rot - IGH - sponsored by TREK</name>
    <author>
      <link href="https://www.komoot.de">
        <text>komoot</text>
        <type>text/html</type>
      </link>
    </author>
  </metadata>
  <trk>
    <name>Heidenbergtrails - Hobbit - blau/rot - IGH - sponsored by TREK</name>
    <trkseg>
      <trkpt lat="49.280652" lon="10.998709">
        <ele>456.273966</ele>
        <time>2023-10-11T21:35:31.192Z</time>
      </trkpt>
      <trkpt lat="49.280335" lon="10.998669">
        <ele>456.273966</ele>
        <time>2023-10-11T21:35:37.001Z</time>
      </trkpt>
      <trkpt lat="49.279549" lon="10.998133">
        <ele>453.169702</ele>
        <time>2023-10-11T21:35:51.907Z</time>
      </trkpt>
      <trkpt lat="49.279333" lon="10.997830">
        <ele>449.912182</ele>
        <time>2023-10-11T21:35:56.884Z</time>
      </trkpt>
      <trkpt lat="49.279183" lon="10.997677">
        <ele>447.907638</ele>
        <time>2023-10-11T21:35:59.895Z</time>
      </trkpt>
      <trkpt lat="49.279172" lon="10.997266">
        <ele>444.922067</ele>
        <time>2023-10-11T21:36:04.421Z</time>
      </trkpt>
      <trkpt lat="49.279210" lon="10.996934">
        <ele>442.475586</ele>
        <time>2023-10-11T21:36:08.109Z</time>
      </trkpt>
      <trkpt lat="49.279118" lon="10.996832">
        <ele>441.212358</ele>
        <time>2023-10-11T21:36:10.003Z</time>
      </trkpt>
      <trkpt lat="49.279018" lon="10.996827">
        <ele>440.099206</ele>
        <time>2023-10-11T21:36:11.680Z</time>
      </trkpt>
      <trkpt lat="49.278669" lon="10.997062">
        <ele>435.824291</ele>
        <time>2023-10-11T21:36:18.053Z</time>
      </trkpt>
      <trkpt lat="49.278435" lon="10.997706">
        <ele>430.024971</ele>
        <time>2023-10-11T21:36:26.086Z</time>
      </trkpt>
      <trkpt lat="49.278297" lon="10.997866">
        <ele>427.938362</ele>
        <time>2023-10-11T21:36:28.959Z</time>
      </trkpt>
      <trkpt lat="49.278382" lon="10.996769">
        <ele>419.247336</ele>
        <time>2023-10-11T21:36:40.987Z</time>
      </trkpt>
      <trkpt lat="49.278076" lon="10.996817">
        <ele>415.537947</ele>
        <time>2023-10-11T21:36:46.086Z</time>
      </trkpt>
      <trkpt lat="49.277872" lon="10.996805">
        <ele>414.572756</ele>
        <time>2023-10-11T21:36:49.515Z</time>
      </trkpt>
      <trkpt lat="49.277660" lon="10.997147">
        <ele>414.572756</ele>
        <time>2023-10-11T21:36:54.698Z</time>
      </trkpt>
      <trkpt lat="49.277537" lon="10.997165">
        <ele>414.572756</ele>
        <time>2023-10-11T21:36:56.769Z</time>
      </trkpt>
      <trkpt lat="49.277355" lon="10.997346">
        <ele>414.572756</ele>
        <time>2023-10-11T21:37:00.502Z</time>
      </trkpt>
      <trkpt lat="49.277152" lon="10.997274">
        <ele>414.572756</ele>
        <time>2023-10-11T21:37:04.073Z</time>
      </trkpt>
      <trkpt lat="49.276838" lon="10.997488">
        <ele>414.572756</ele>
        <time>2023-10-11T21:37:10.151Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`
    },
    {
      name: 'Enduro Fit',
      difficulty: "red",
      direction: "one-way-down",
      gpx: `<?xml version='1.0' encoding='UTF-8'?>
<gpx version="1.1" creator="https://www.komoot.de" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Heidenbergtrails - Enduro Fit - blau/rot/mittel - IGH - sponsored bei HUMPENÖDER</name>
    <author>
      <link href="https://www.komoot.de">
        <text>komoot</text>
        <type>text/html</type>
      </link>
    </author>
  </metadata>
  <trk>
    <name>Heidenbergtrails - Enduro Fit - blau/rot/mittel - IGH - sponsored bei HUMPENÖDER</name>
    <trkseg>
      <trkpt lat="49.280375" lon="10.988671">
        <ele>442.985226</ele>
        <time>2023-10-11T21:12:38.496Z</time>
      </trkpt>
      <trkpt lat="49.280186" lon="10.988603">
        <ele>442.985226</ele>
        <time>2023-10-11T21:12:42.343Z</time>
      </trkpt>
      <trkpt lat="49.279812" lon="10.988634">
        <ele>442.985226</ele>
        <time>2023-10-11T21:12:49.785Z</time>
      </trkpt>
      <trkpt lat="49.279511" lon="10.988258">
        <ele>442.684825</ele>
        <time>2023-10-11T21:12:57.375Z</time>
      </trkpt>
      <trkpt lat="49.279377" lon="10.988033">
        <ele>441.649187</ele>
        <time>2023-10-11T21:13:01.288Z</time>
      </trkpt>
      <trkpt lat="49.278930" lon="10.987498">
        <ele>438.694056</ele>
        <time>2023-10-11T21:13:12.214Z</time>
      </trkpt>
      <trkpt lat="49.278842" lon="10.987214">
        <ele>437.625264</ele>
        <time>2023-10-11T21:13:16.150Z</time>
      </trkpt>
      <trkpt lat="49.278629" lon="10.987005">
        <ele>436.307447</ele>
        <time>2023-10-11T21:13:21.040Z</time>
      </trkpt>
      <trkpt lat="49.278548" lon="10.986838">
        <ele>435.600035</ele>
        <time>2023-10-11T21:13:23.609Z</time>
      </trkpt>
      <trkpt lat="49.278132" lon="10.986425">
        <ele>432.696261</ele>
        <time>2023-10-11T21:13:32.994Z</time>
      </trkpt>
      <trkpt lat="49.277911" lon="10.986082">
        <ele>430.173638</ele>
        <time>2023-10-11T21:13:38.755Z</time>
      </trkpt>
      <trkpt lat="49.277874" lon="10.985454">
        <ele>426.874083</ele>
        <time>2023-10-11T21:13:46.154Z</time>
      </trkpt>
      <trkpt lat="49.278020" lon="10.985048">
        <ele>424.448205</ele>
        <time>2023-10-11T21:13:51.508Z</time>
      </trkpt>
      <trkpt lat="49.278193" lon="10.984827">
        <ele>422.641873</ele>
        <time>2023-10-11T21:13:55.441Z</time>
      </trkpt>
      <trkpt lat="49.278372" lon="10.984708">
        <ele>421.076910</ele>
        <time>2023-10-11T21:13:58.839Z</time>
      </trkpt>
      <trkpt lat="49.278462" lon="10.984274">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:03.941Z</time>
      </trkpt>
      <trkpt lat="49.278634" lon="10.984199">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:06.979Z</time>
      </trkpt>
      <trkpt lat="49.278826" lon="10.983891">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:11.761Z</time>
      </trkpt>
      <trkpt lat="49.278857" lon="10.983805">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:12.864Z</time>
      </trkpt>
      <trkpt lat="49.278942" lon="10.983569">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:15.928Z</time>
      </trkpt>
      <trkpt lat="49.278973" lon="10.982809">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:24.749Z</time>
      </trkpt>
      <trkpt lat="49.278902" lon="10.982573">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:27.831Z</time>
      </trkpt>
      <trkpt lat="49.278972" lon="10.982396">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:30.356Z</time>
      </trkpt>
      <trkpt lat="49.278938" lon="10.982203">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:32.787Z</time>
      </trkpt>
      <trkpt lat="49.278957" lon="10.982139">
        <ele>419.186132</ele>
        <time>2023-10-11T21:14:33.651Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`
    },
    {
      name:       'BMC',
      difficulty: 'black',
      direction:  'one-way-down',
      gpx: `
              <trkpt lat="49.286290" lon="10.993692">
        <ele>438.421958</ele>
        <time>2024-07-04T19:56:57.496Z</time>
      </trkpt>
      <trkpt lat="49.286296" lon="10.993825">
        <ele>438.421958</ele>
        <time>2024-07-04T19:56:59.357Z</time>
      </trkpt>
      <trkpt lat="49.286421" lon="10.994015">
        <ele>438.421958</ele>
        <time>2024-07-04T19:57:03.038Z</time>
      </trkpt>
      <trkpt lat="49.286440" lon="10.993992">
        <ele>438.421958</ele>
        <time>2024-07-04T19:57:03.544Z</time>
      </trkpt>
      <trkpt lat="49.286546" lon="10.993869">
        <ele>438.421958</ele>
        <time>2024-07-04T19:57:06.319Z</time>
      </trkpt>
      <trkpt lat="49.286714" lon="10.993435">
        <ele>438.421958</ele>
        <time>2024-07-04T19:57:13.033Z</time>
      </trkpt>
      <trkpt lat="49.287287" lon="10.992932">
        <ele>435.141825</ele>
        <time>2024-07-04T19:57:25.899Z</time>
      </trkpt>
      <trkpt lat="49.287547" lon="10.992621">
        <ele>433.022007</ele>
        <time>2024-07-04T19:57:32.103Z</time>
      </trkpt>
      <trkpt lat="49.287764" lon="10.992363">
        <ele>431.256807</ele>
        <time>2024-07-04T19:57:37.154Z</time>
      </trkpt>
      <trkpt lat="49.287801" lon="10.992138">
        <ele>430.283905</ele>
        <time>2024-07-04T19:57:39.905Z</time>
      </trkpt>
      <trkpt lat="49.288140" lon="10.991677">
        <ele>427.371064</ele>
        <time>2024-07-04T19:57:47.978Z</time>
      </trkpt>
      <trkpt lat="49.288385" lon="10.991553">
        <ele>425.105999</ele>
        <time>2024-07-04T19:57:52.516Z</time>
      </trkpt>
      <trkpt lat="49.288517" lon="10.991685">
        <ele>423.557430</ele>
        <time>2024-07-04T19:57:55.258Z</time>
      </trkpt>
      <trkpt lat="49.288546" lon="10.991714">
        <ele>423.217215</ele>
        <time>2024-07-04T19:57:55.854Z</time>
      </trkpt>
      <trkpt lat="49.288692" lon="10.992182">
        <ele>419.892328</ele>
        <time>2024-07-04T19:58:01.717Z</time>
      </trkpt>
      <trkpt lat="49.289044" lon="10.994101">
        <ele>409.186320</ele>
        <time>2024-07-04T19:58:23.879Z</time>
      </trkpt>
      <trkpt lat="49.289270" lon="10.994841">
        <ele>409.186320</ele>
        <time>2024-07-04T19:58:33.026Z</time>
      </trkpt>
      <trkpt lat="49.289457" lon="10.995635">
        <ele>409.186320</ele>
        <time>2024-07-04T19:58:42.817Z</time>
      </trkpt>
      <trkpt lat="49.289594" lon="10.996099">
        <ele>409.186320</ele>
        <time>2024-07-04T19:58:48.971Z</time>
      </trkpt>
      <trkpt lat="49.289682" lon="10.996189">
        <ele>409.186320</ele>
        <time>2024-07-04T19:58:50.945Z</time>
      </trkpt>
      `,
    },
  ],
  tours: [
    {
      name:             'Big 7',
      duration_minutes: 90,
      direction:        'cw',
      trailNames: ['BMC', 'Enduro Fit','Hobbit'],
      // Paste the full recorded tour GPX here.
      // When provided, the tour's own elevation profile and full route line come from this.
      // When omitted, transfers between trails are auto-generated.
      gpx: `
              <trkpt lat="49.291824" lon="11.014400">
        <ele>367.858172</ele>
        <time>2024-07-04T20:25:31.225Z</time>
      </trkpt>
      <trkpt lat="49.291814" lon="11.014185">
        <ele>367.858172</ele>
        <time>2024-07-04T20:25:36.318Z</time>
      </trkpt>
      <trkpt lat="49.291806" lon="11.014085">
        <ele>367.858172</ele>
        <time>2024-07-04T20:25:38.610Z</time>
      </trkpt>
      <trkpt lat="49.291794" lon="11.013814">
        <ele>367.858172</ele>
        <time>2024-07-04T20:25:45.184Z</time>
      </trkpt>
      <trkpt lat="49.291724" lon="11.012261">
        <ele>368.453228</ele>
        <time>2024-07-04T20:26:23.207Z</time>
      </trkpt>
      <trkpt lat="49.291692" lon="11.011574">
        <ele>368.988459</ele>
        <time>2024-07-04T20:26:39.782Z</time>
      </trkpt>
      <trkpt lat="49.291623" lon="11.011060">
        <ele>369.396265</ele>
        <time>2024-07-04T20:26:52.573Z</time>
      </trkpt>
      <trkpt lat="49.291546" lon="11.010696">
        <ele>369.693638</ele>
        <time>2024-07-04T20:27:02.069Z</time>
      </trkpt>
      <trkpt lat="49.291564" lon="11.009202">
        <ele>371.091515</ele>
        <time>2024-07-04T20:27:40.119Z</time>
      </trkpt>
      <trkpt lat="49.291581" lon="11.008927">
        <ele>371.365699</ele>
        <time>2024-07-04T20:27:47.171Z</time>
      </trkpt>
      <trkpt lat="49.291570" lon="11.008715">
        <ele>371.576791</ele>
        <time>2024-07-04T20:27:52.546Z</time>
      </trkpt>
      <trkpt lat="49.291527" lon="11.008548">
        <ele>371.755003</ele>
        <time>2024-07-04T20:27:57.079Z</time>
      </trkpt>
      <trkpt lat="49.291233" lon="11.007676">
        <ele>372.729347</ele>
        <time>2024-07-04T20:28:22.638Z</time>
      </trkpt>
      <trkpt lat="49.291090" lon="11.006409">
        <ele>374.209812</ele>
        <time>2024-07-04T20:28:57.203Z</time>
      </trkpt>
      <trkpt lat="49.291174" lon="11.004962">
        <ele>375.884107</ele>
        <time>2024-07-04T20:29:34.442Z</time>
      </trkpt>
      <trkpt lat="49.291145" lon="11.004872">
        <ele>376.145917</ele>
        <time>2024-07-04T20:29:36.981Z</time>
      </trkpt>
      <trkpt lat="49.291047" lon="11.004425">
        <ele>377.647716</ele>
        <time>2024-07-04T20:29:50.136Z</time>
      </trkpt>
      <trkpt lat="49.290908" lon="11.004185">
        <ele>378.669877</ele>
        <time>2024-07-04T20:29:59.382Z</time>
      </trkpt>
      <trkpt lat="49.290661" lon="11.003680">
        <ele>380.680099</ele>
        <time>2024-07-04T20:30:21.078Z</time>
      </trkpt>
      <trkpt lat="49.290191" lon="11.003111">
        <ele>383.604170</ele>
        <time>2024-07-04T20:30:58.817Z</time>
      </trkpt>
      <trkpt lat="49.289789" lon="11.002721">
        <ele>387.305402</ele>
        <time>2024-07-04T20:31:33.331Z</time>
      </trkpt>
      <trkpt lat="49.289400" lon="11.002412">
        <ele>391.846376</ele>
        <time>2024-07-04T20:32:08.733Z</time>
      </trkpt>
      <trkpt lat="49.288975" lon="11.002074">
        <ele>396.808859</ele>
        <time>2024-07-04T20:32:49.905Z</time>
      </trkpt>
      <trkpt lat="49.288892" lon="11.002009">
        <ele>397.774881</ele>
        <time>2024-07-04T20:32:58.361Z</time>
      </trkpt>
      <trkpt lat="49.288793" lon="11.001932">
        <ele>398.925498</ele>
        <time>2024-07-04T20:33:08.519Z</time>
      </trkpt>
      <trkpt lat="49.288584" lon="11.001465">
        <ele>402.754385</ele>
        <time>2024-07-04T20:33:42.761Z</time>
      </trkpt>
      <trkpt lat="49.288310" lon="11.000785">
        <ele>408.132896</ele>
        <time>2024-07-04T20:34:31.032Z</time>
      </trkpt>
      <trkpt lat="49.288131" lon="11.000198">
        <ele>412.490762</ele>
        <time>2024-07-04T20:35:07.711Z</time>
      </trkpt>
      <trkpt lat="49.287957" lon="10.999752">
        <ele>415.985848</ele>
        <time>2024-07-04T20:35:35.140Z</time>
      </trkpt>
      <trkpt lat="49.287607" lon="10.999016">
        <ele>422.038561</ele>
        <time>2024-07-04T20:36:21.419Z</time>
      </trkpt>
      <trkpt lat="49.287490" lon="10.998768">
        <ele>423.426108</ele>
        <time>2024-07-04T20:36:36.225Z</time>
      </trkpt>
      <trkpt lat="49.286885" lon="10.997479">
        <ele>430.625354</ele>
        <time>2024-07-04T20:37:47.478Z</time>
      </trkpt>
      <trkpt lat="49.286363" lon="10.995787">
        <ele>436.331130</ele>
        <time>2024-07-04T20:38:56.836Z</time>
      </trkpt>
      <trkpt lat="49.286329" lon="10.994792">
        <ele>438.189245</ele>
        <time>2024-07-04T20:39:26.722Z</time>
      </trkpt>
      <trkpt lat="49.286296" lon="10.993825">
        <ele>439.028492</ele>
        <time>2024-07-04T20:39:48.582Z</time>
      </trkpt>
      <trkpt lat="49.286421" lon="10.994015">
        <ele>438.483386</ele>
        <time>2024-07-04T20:39:53.649Z</time>
      </trkpt>
      <trkpt lat="49.286546" lon="10.993869">
        <ele>437.996747</ele>
        <time>2024-07-04T20:39:58.118Z</time>
      </trkpt>
      <trkpt lat="49.286714" lon="10.993435">
        <ele>436.977336</ele>
        <time>2024-07-04T20:40:06.994Z</time>
      </trkpt>
      <trkpt lat="49.286903" lon="10.993269">
        <ele>436.302801</ele>
        <time>2024-07-04T20:40:12.541Z</time>
      </trkpt>
      <trkpt lat="49.287287" lon="10.992932">
        <ele>434.932589</ele>
        <time>2024-07-04T20:40:23.477Z</time>
      </trkpt>
      <trkpt lat="49.287764" lon="10.992363">
        <ele>431.573196</ele>
        <time>2024-07-04T20:40:37.571Z</time>
      </trkpt>
      <trkpt lat="49.287801" lon="10.992138">
        <ele>430.329793</ele>
        <time>2024-07-04T20:40:41.010Z</time>
      </trkpt>
      <trkpt lat="49.288140" lon="10.991677">
        <ele>426.607080</ele>
        <time>2024-07-04T20:40:51.101Z</time>
      </trkpt>
      <trkpt lat="49.288385" lon="10.991553">
        <ele>424.487475</ele>
        <time>2024-07-04T20:40:56.774Z</time>
      </trkpt>
      <trkpt lat="49.288546" lon="10.991714">
        <ele>422.908315</ele>
        <time>2024-07-04T20:41:00.946Z</time>
      </trkpt>
      <trkpt lat="49.288692" lon="10.992182">
        <ele>420.128471</ele>
        <time>2024-07-04T20:41:08.276Z</time>
      </trkpt>
      <trkpt lat="49.289044" lon="10.994101">
        <ele>408.246126</ele>
        <time>2024-07-04T20:41:35.977Z</time>
      </trkpt>
      <trkpt lat="49.289270" lon="10.994841">
        <ele>403.327919</ele>
        <time>2024-07-04T20:41:47.621Z</time>
      </trkpt>
      <trkpt lat="49.289457" lon="10.995635">
        <ele>402.769650</ele>
        <time>2024-07-04T20:42:00.777Z</time>
      </trkpt>
      <trkpt lat="49.289567" lon="10.996006">
        <ele>402.873353</ele>
        <time>2024-07-04T20:42:08.113Z</time>
      </trkpt>
      <trkpt lat="49.289594" lon="10.996099">
        <ele>402.899257</ele>
        <time>2024-07-04T20:42:10.063Z</time>
      </trkpt>
      <trkpt lat="49.289682" lon="10.996189">
        <ele>402.940527</ele>
        <time>2024-07-04T20:42:13.159Z</time>
      </trkpt>
      <trkpt lat="49.289458" lon="10.995123">
        <ele>403.225516</ele>
        <time>2024-07-04T20:42:47.988Z</time>
      </trkpt>
      <trkpt lat="49.288980" lon="10.993350">
        <ele>413.314778</ele>
        <time>2024-07-04T20:44:27.265Z</time>
      </trkpt>
      <trkpt lat="49.288829" lon="10.992517">
        <ele>418.495681</ele>
        <time>2024-07-04T20:45:15.130Z</time>
      </trkpt>
      <trkpt lat="49.288773" lon="10.992274">
        <ele>420.003529</ele>
        <time>2024-07-04T20:45:28.697Z</time>
      </trkpt>
      <trkpt lat="49.288700" lon="10.991951">
        <ele>421.722659</ele>
        <time>2024-07-04T20:45:46.621Z</time>
      </trkpt>
      <trkpt lat="49.288473" lon="10.991143">
        <ele>426.147040</ele>
        <time>2024-07-04T20:46:29.674Z</time>
      </trkpt>
      <trkpt lat="49.287726" lon="10.991945">
        <ele>433.178461</ele>
        <time>2024-07-04T20:47:20.951Z</time>
      </trkpt>
      <trkpt lat="49.287055" lon="10.992624">
        <ele>436.325911</ele>
        <time>2024-07-04T20:47:57.933Z</time>
      </trkpt>
      <trkpt lat="49.286280" lon="10.993483">
        <ele>439.749611</ele>
        <time>2024-07-04T20:48:30.826Z</time>
      </trkpt>
      <trkpt lat="49.285306" lon="10.994493">
        <ele>441.288677</ele>
        <time>2024-07-04T20:49:03.625Z</time>
      </trkpt>
      <trkpt lat="49.284696" lon="10.993913">
        <ele>442.070839</ele>
        <time>2024-07-04T20:49:27.652Z</time>
      </trkpt>
      <trkpt lat="49.283144" lon="10.992438">
        <ele>442.741813</ele>
        <time>2024-07-04T20:50:31.507Z</time>
      </trkpt>
      <trkpt lat="49.281462" lon="10.990849">
        <ele>440.587309</ele>
        <time>2024-07-04T20:51:28.133Z</time>
      </trkpt>
      <trkpt lat="49.280965" lon="10.990380">
        <ele>439.935383</ele>
        <time>2024-07-04T20:51:44.388Z</time>
      </trkpt>
      <trkpt lat="49.280086" lon="10.989550">
        <ele>438.792446</ele>
        <time>2024-07-04T20:52:14.716Z</time>
      </trkpt>
      <trkpt lat="49.280186" lon="10.989244">
        <ele>438.713940</ele>
        <time>2024-07-04T20:52:21.623Z</time>
      </trkpt>
      <trkpt lat="49.280214" lon="10.989065">
        <ele>438.671717</ele>
        <time>2024-07-04T20:52:25.226Z</time>
      </trkpt>
      <trkpt lat="49.280266" lon="10.988979">
        <ele>438.644819</ele>
        <time>2024-07-04T20:52:27.753Z</time>
      </trkpt>
      <trkpt lat="49.280375" lon="10.988671">
        <ele>438.564443</ele>
        <time>2024-07-04T20:52:34.993Z</time>
      </trkpt>
      <trkpt lat="49.280552" lon="10.988407">
        <ele>438.477607</ele>
        <time>2024-07-04T20:52:43.286Z</time>
      </trkpt>
      <trkpt lat="49.280707" lon="10.988254">
        <ele>438.412784</ele>
        <time>2024-07-04T20:52:49.532Z</time>
      </trkpt>
      <trkpt lat="49.280903" lon="10.987490">
        <ele>438.224474</ele>
        <time>2024-07-04T20:53:08.254Z</time>
      </trkpt>
      <trkpt lat="49.281387" lon="10.986176">
        <ele>434.028024</ele>
        <time>2024-07-04T20:53:34.699Z</time>
      </trkpt>
      <trkpt lat="49.281770" lon="10.985289">
        <ele>430.503674</ele>
        <time>2024-07-04T20:53:50.361Z</time>
      </trkpt>
      <trkpt lat="49.281769" lon="10.985286">
        <ele>430.492512</ele>
        <time>2024-07-04T20:53:50.405Z</time>
      </trkpt>
      <trkpt lat="49.281575" lon="10.984191">
        <ele>424.843874</ele>
        <time>2024-07-04T20:54:06.838Z</time>
      </trkpt>
      <trkpt lat="49.281545" lon="10.983477">
        <ele>420.522982</ele>
        <time>2024-07-04T20:54:16.943Z</time>
      </trkpt>
      <trkpt lat="49.281486" lon="10.983342">
        <ele>419.541642</ele>
        <time>2024-07-04T20:54:19.240Z</time>
      </trkpt>
      <trkpt lat="49.281490" lon="10.982989">
        <ele>417.409496</ele>
        <time>2024-07-04T20:54:24.172Z</time>
      </trkpt>
      <trkpt lat="49.281764" lon="10.982642">
        <ele>414.119239</ele>
        <time>2024-07-04T20:54:31.762Z</time>
      </trkpt>
      <trkpt lat="49.281490" lon="10.982989">
        <ele>411.031478</ele>
        <time>2024-07-04T20:54:39.423Z</time>
      </trkpt>
      <trkpt lat="49.281490" lon="10.982432">
        <ele>408.107358</ele>
        <time>2024-07-04T20:54:47.362Z</time>
      </trkpt>
      <trkpt lat="49.281447" lon="10.982080">
        <ele>406.227318</ele>
        <time>2024-07-04T20:54:52.605Z</time>
      </trkpt>
      <trkpt lat="49.281402" lon="10.981975">
        <ele>405.567776</ele>
        <time>2024-07-04T20:54:54.449Z</time>
      </trkpt>
      <trkpt lat="49.281380" lon="10.981798">
        <ele>404.621849</ele>
        <time>2024-07-04T20:54:57.112Z</time>
      </trkpt>
      <trkpt lat="49.281269" lon="10.981624">
        <ele>403.344210</ele>
        <time>2024-07-04T20:55:00.766Z</time>
      </trkpt>
      <trkpt lat="49.281056" lon="10.981484">
        <ele>401.479158</ele>
        <time>2024-07-04T20:55:06.010Z</time>
      </trkpt>
      <trkpt lat="49.280913" lon="10.981465">
        <ele>400.324043</ele>
        <time>2024-07-04T20:55:09.213Z</time>
      </trkpt>
      <trkpt lat="49.280541" lon="10.981232">
        <ele>397.340480</ele>
        <time>2024-07-04T20:55:18.243Z</time>
      </trkpt>
      <trkpt lat="49.280355" lon="10.981306">
        <ele>396.270092</ele>
        <time>2024-07-04T20:55:22.569Z</time>
      </trkpt>
      <trkpt lat="49.280049" lon="10.981364">
        <ele>394.552623</ele>
        <time>2024-07-04T20:55:29.594Z</time>
      </trkpt>
      <trkpt lat="49.279178" lon="10.981745">
        <ele>389.507283</ele>
        <time>2024-07-04T20:55:51.029Z</time>
      </trkpt>
      <trkpt lat="49.279093" lon="10.981760">
        <ele>389.030687</ele>
        <time>2024-07-04T20:55:53.198Z</time>
      </trkpt>
      <trkpt lat="49.279059" lon="10.981766">
        <ele>388.840049</ele>
        <time>2024-07-04T20:55:54.070Z</time>
      </trkpt>
      <trkpt lat="49.278897" lon="10.981965">
        <ele>387.833004</ele>
        <time>2024-07-04T20:55:59.351Z</time>
      </trkpt>
      <trkpt lat="49.278658" lon="10.981838">
        <ele>387.471066</ele>
        <time>2024-07-04T20:56:03.347Z</time>
      </trkpt>
      <trkpt lat="49.278422" lon="10.981651">
        <ele>387.090937</ele>
        <time>2024-07-04T20:56:07.754Z</time>
      </trkpt>
      <trkpt lat="49.278074" lon="10.981268">
        <ele>386.477945</ele>
        <time>2024-07-04T20:56:15.096Z</time>
      </trkpt>
      <trkpt lat="49.278022" lon="10.981133">
        <ele>386.331601</ele>
        <time>2024-07-04T20:56:16.874Z</time>
      </trkpt>
      <trkpt lat="49.278226" lon="10.981119">
        <ele>386.039415</ele>
        <time>2024-07-04T20:56:23.066Z</time>
      </trkpt>
      <trkpt lat="49.278371" lon="10.981069">
        <ele>385.826757</ele>
        <time>2024-07-04T20:56:27.451Z</time>
      </trkpt>
      <trkpt lat="49.278413" lon="10.981054">
        <ele>385.765051</ele>
        <time>2024-07-04T20:56:28.810Z</time>
      </trkpt>
      <trkpt lat="49.278544" lon="10.980958">
        <ele>385.557290</ele>
        <time>2024-07-04T20:56:33.351Z</time>
      </trkpt>
      <trkpt lat="49.278916" lon="10.980479">
        <ele>385.829037</ele>
        <time>2024-07-04T20:56:49.354Z</time>
      </trkpt>
      <trkpt lat="49.279198" lon="10.980171">
        <ele>386.400749</ele>
        <time>2024-07-04T20:57:02.348Z</time>
      </trkpt>
      <trkpt lat="49.279799" lon="10.979992">
        <ele>387.411614</ele>
        <time>2024-07-04T20:57:28.219Z</time>
      </trkpt>
      <trkpt lat="49.279881" lon="10.979910">
        <ele>387.573267</ele>
        <time>2024-07-04T20:57:32.531Z</time>
      </trkpt>
      <trkpt lat="49.280685" lon="10.979063">
        <ele>389.939239</ele>
        <time>2024-07-04T20:58:16.733Z</time>
      </trkpt>
      <trkpt lat="49.281161" lon="10.978739">
        <ele>391.518151</ele>
        <time>2024-07-04T20:58:41.433Z</time>
      </trkpt>
      <trkpt lat="49.281657" lon="10.978428">
        <ele>393.142753</ele>
        <time>2024-07-04T20:59:07.244Z</time>
      </trkpt>
      <trkpt lat="49.281859" lon="10.978282">
        <ele>393.782675</ele>
        <time>2024-07-04T20:59:18.208Z</time>
      </trkpt>
      <trkpt lat="49.282211" lon="10.978225">
        <ele>394.393894</ele>
        <time>2024-07-04T20:59:35.382Z</time>
      </trkpt>
      <trkpt lat="49.282481" lon="10.978182">
        <ele>394.862642</ele>
        <time>2024-07-04T20:59:47.688Z</time>
      </trkpt>
      <trkpt lat="49.282680" lon="10.978064">
        <ele>395.231089</ele>
        <time>2024-07-04T20:59:56.183Z</time>
      </trkpt>
      <trkpt lat="49.283060" lon="10.977919">
        <ele>395.907299</ele>
        <time>2024-07-04T21:00:11.236Z</time>
      </trkpt>
      <trkpt lat="49.283268" lon="10.977916">
        <ele>396.266492</ele>
        <time>2024-07-04T21:00:18.886Z</time>
      </trkpt>
      <trkpt lat="49.283559" lon="10.977974">
        <ele>396.773223</ele>
        <time>2024-07-04T21:00:29.288Z</time>
      </trkpt>
      <trkpt lat="49.283834" lon="10.978013">
        <ele>396.392973</ele>
        <time>2024-07-04T21:00:38.522Z</time>
      </trkpt>
      <trkpt lat="49.284217" lon="10.977993">
        <ele>395.673473</ele>
        <time>2024-07-04T21:00:49.876Z</time>
      </trkpt>
      <trkpt lat="49.284475" lon="10.978089">
        <ele>395.175014</ele>
        <time>2024-07-04T21:00:57.220Z</time>
      </trkpt>
      <trkpt lat="49.284720" lon="10.978604">
        <ele>394.394376</ele>
        <time>2024-07-04T21:01:08.035Z</time>
      </trkpt>
      <trkpt lat="49.284862" lon="10.978846">
        <ele>393.995732</ele>
        <time>2024-07-04T21:01:13.472Z</time>
      </trkpt>
      <trkpt lat="49.284985" lon="10.979059">
        <ele>393.647340</ele>
        <time>2024-07-04T21:01:18.140Z</time>
      </trkpt>
      <trkpt lat="49.285196" lon="10.979193">
        <ele>393.176495</ele>
        <time>2024-07-04T21:01:24.064Z</time>
      </trkpt>
      <trkpt lat="49.285354" lon="10.979159">
        <ele>392.825317</ele>
        <time>2024-07-04T21:01:28.069Z</time>
      </trkpt>
      <trkpt lat="49.285690" lon="10.978969">
        <ele>392.037052</ele>
        <time>2024-07-04T21:01:37.517Z</time>
      </trkpt>
      <trkpt lat="49.285957" lon="10.978896">
        <ele>391.440094</ele>
        <time>2024-07-04T21:01:44.840Z</time>
      </trkpt>
      <trkpt lat="49.286247" lon="10.978874">
        <ele>390.801003</ele>
        <time>2024-07-04T21:01:52.583Z</time>
      </trkpt>
      <trkpt lat="49.286451" lon="10.978780">
        <ele>390.332142</ele>
        <time>2024-07-04T21:01:58.265Z</time>
      </trkpt>
      <trkpt lat="49.286640" lon="10.978587">
        <ele>389.832305</ele>
        <time>2024-07-04T21:02:01.707Z</time>
      </trkpt>
      <trkpt lat="49.286529" lon="10.978158">
        <ele>390.009678</ele>
        <time>2024-07-04T21:02:06.695Z</time>
      </trkpt>
      <trkpt lat="49.286640" lon="10.978587">
        <ele>391.014084</ele>
        <time>2024-07-04T21:02:14.244Z</time>
      </trkpt>
      <trkpt lat="49.286451" lon="10.978780">
        <ele>391.771760</ele>
        <time>2024-07-04T21:02:21.789Z</time>
      </trkpt>
      <trkpt lat="49.286247" lon="10.978874">
        <ele>392.482481</ele>
        <time>2024-07-04T21:02:32.320Z</time>
      </trkpt>
      <trkpt lat="49.285957" lon="10.978896">
        <ele>393.451244</ele>
        <time>2024-07-04T21:02:48.112Z</time>
      </trkpt>
      <trkpt lat="49.285690" lon="10.978969">
        <ele>394.356140</ele>
        <time>2024-07-04T21:03:03.493Z</time>
      </trkpt>
      <trkpt lat="49.285354" lon="10.979159">
        <ele>395.607588</ele>
        <time>2024-07-04T21:03:25.672Z</time>
      </trkpt>
      <trkpt lat="49.285196" lon="10.979193">
        <ele>396.789993</ele>
        <time>2024-07-04T21:03:36.370Z</time>
      </trkpt>
      <trkpt lat="49.284912" lon="10.979416">
        <ele>399.154708</ele>
        <time>2024-07-04T21:03:57.788Z</time>
      </trkpt>
      <trkpt lat="49.284709" lon="10.979320">
        <ele>400.729078</ele>
        <time>2024-07-04T21:04:12.754Z</time>
      </trkpt>
      <trkpt lat="49.284463" lon="10.979416">
        <ele>402.610306</ele>
        <time>2024-07-04T21:04:31.844Z</time>
      </trkpt>
      <trkpt lat="49.284052" lon="10.980049">
        <ele>406.927867</ele>
        <time>2024-07-04T21:05:14.774Z</time>
      </trkpt>
      <trkpt lat="49.283703" lon="10.980505">
        <ele>409.567184</ele>
        <time>2024-07-04T21:05:46.282Z</time>
      </trkpt>
      <trkpt lat="49.283542" lon="10.980715">
        <ele>410.336730</ele>
        <time>2024-07-04T21:05:59.721Z</time>
      </trkpt>
      <trkpt lat="49.283366" lon="10.980946">
        <ele>411.180187</ele>
        <time>2024-07-04T21:06:12.893Z</time>
      </trkpt>
      <trkpt lat="49.283117" lon="10.981346">
        <ele>412.493175</ele>
        <time>2024-07-04T21:06:31.136Z</time>
      </trkpt>
      <trkpt lat="49.282705" lon="10.981807">
        <ele>414.350052</ele>
        <time>2024-07-04T21:06:51.361Z</time>
      </trkpt>
      <trkpt lat="49.282396" lon="10.981943">
        <ele>415.403590</ele>
        <time>2024-07-04T21:07:02.925Z</time>
      </trkpt>
      <trkpt lat="49.282207" lon="10.982190">
        <ele>415.544155</ele>
        <time>2024-07-04T21:07:11.280Z</time>
      </trkpt>
      <trkpt lat="49.282108" lon="10.982289">
        <ele>415.611054</ele>
        <time>2024-07-04T21:07:15.082Z</time>
      </trkpt>
      <trkpt lat="49.281812" lon="10.982582">
        <ele>415.810474</ele>
        <time>2024-07-04T21:07:26.336Z</time>
      </trkpt>
      <trkpt lat="49.281764" lon="10.982642">
        <ele>415.845527</ele>
        <time>2024-07-04T21:07:28.162Z</time>
      </trkpt>
      <trkpt lat="49.281490" lon="10.982989">
        <ele>416.046680</ele>
        <time>2024-07-04T21:07:39.701Z</time>
      </trkpt>
      <trkpt lat="49.280919" lon="10.984319">
        <ele>417.659835</ele>
        <time>2024-07-04T21:08:16.689Z</time>
      </trkpt>
      <trkpt lat="49.280079" lon="10.987168">
        <ele>424.611159</ele>
        <time>2024-07-04T21:10:00.794Z</time>
      </trkpt>
      <trkpt lat="49.279377" lon="10.988033">
        <ele>428.379727</ele>
        <time>2024-07-04T21:10:48.952Z</time>
      </trkpt>
      <trkpt lat="49.279120" lon="10.988588">
        <ele>429.767782</ele>
        <time>2024-07-04T21:11:13.728Z</time>
      </trkpt>
      <trkpt lat="49.279287" lon="10.988796">
        <ele>430.165846</ele>
        <time>2024-07-04T21:11:25.223Z</time>
      </trkpt>
      <trkpt lat="49.279649" lon="10.989138">
        <ele>430.952493</ele>
        <time>2024-07-04T21:11:45.878Z</time>
      </trkpt>
      <trkpt lat="49.280086" lon="10.989550">
        <ele>431.901576</ele>
        <time>2024-07-04T21:12:06.349Z</time>
      </trkpt>
      <trkpt lat="49.280186" lon="10.989244">
        <ele>432.314608</ele>
        <time>2024-07-04T21:12:13.669Z</time>
      </trkpt>
      <trkpt lat="49.280214" lon="10.989065">
        <ele>432.536751</ele>
        <time>2024-07-04T21:12:17.167Z</time>
      </trkpt>
      <trkpt lat="49.280266" lon="10.988979">
        <ele>432.678262</ele>
        <time>2024-07-04T21:12:19.283Z</time>
      </trkpt>
      <trkpt lat="49.280375" lon="10.988671">
        <ele>431.708060</ele>
        <time>2024-07-04T21:12:25.665Z</time>
      </trkpt>
      <trkpt lat="49.280186" lon="10.988603">
        <ele>430.744558</ele>
        <time>2024-07-04T21:12:30.640Z</time>
      </trkpt>
      <trkpt lat="49.279812" lon="10.988634">
        <ele>428.885678</ele>
        <time>2024-07-04T21:12:39.899Z</time>
      </trkpt>
      <trkpt lat="49.279511" lon="10.988258">
        <ele>426.958592</ele>
        <time>2024-07-04T21:12:49.042Z</time>
      </trkpt>
      <trkpt lat="49.279377" lon="10.988033">
        <ele>425.972195</ele>
        <time>2024-07-04T21:12:53.571Z</time>
      </trkpt>
      <trkpt lat="49.278930" lon="10.987498">
        <ele>422.821376</ele>
        <time>2024-07-04T21:13:06.317Z</time>
      </trkpt>
      <trkpt lat="49.278842" lon="10.987214">
        <ele>421.267479</ele>
        <time>2024-07-04T21:13:10.941Z</time>
      </trkpt>
      <trkpt lat="49.278629" lon="10.987005">
        <ele>419.351530</ele>
        <time>2024-07-04T21:13:16.685Z</time>
      </trkpt>
      <trkpt lat="49.278548" lon="10.986838">
        <ele>418.323038</ele>
        <time>2024-07-04T21:13:19.735Z</time>
      </trkpt>
      <trkpt lat="49.278132" lon="10.986425">
        <ele>414.568205</ele>
        <time>2024-07-04T21:13:30.882Z</time>
      </trkpt>
      <trkpt lat="49.277911" lon="10.986082">
        <ele>412.185559</ele>
        <time>2024-07-04T21:13:37.901Z</time>
      </trkpt>
      <trkpt lat="49.277874" lon="10.985454">
        <ele>409.034904</ele>
        <time>2024-07-04T21:13:47.101Z</time>
      </trkpt>
      <trkpt lat="49.277995" lon="10.985119">
        <ele>407.083601</ele>
        <time>2024-07-04T21:13:52.693Z</time>
      </trkpt>
      <trkpt lat="49.278020" lon="10.985048">
        <ele>406.672458</ele>
        <time>2024-07-04T21:13:53.886Z</time>
      </trkpt>
      <trkpt lat="49.278193" lon="10.984827">
        <ele>404.913373</ele>
        <time>2024-07-04T21:13:58.926Z</time>
      </trkpt>
      <trkpt lat="49.278372" lon="10.984708">
        <ele>403.389342</ele>
        <time>2024-07-04T21:14:03.305Z</time>
      </trkpt>
      <trkpt lat="49.278462" lon="10.984274">
        <ele>401.068700</ele>
        <time>2024-07-04T21:14:09.922Z</time>
      </trkpt>
      <trkpt lat="49.278634" lon="10.984199">
        <ele>399.671884</ele>
        <time>2024-07-04T21:14:13.894Z</time>
      </trkpt>
      <trkpt lat="49.278826" lon="10.983891">
        <ele>397.501037</ele>
        <time>2024-07-04T21:14:20.067Z</time>
      </trkpt>
      <trkpt lat="49.278942" lon="10.983569">
        <ele>395.729620</ele>
        <time>2024-07-04T21:14:25.407Z</time>
      </trkpt>
      <trkpt lat="49.278973" lon="10.982809">
        <ele>392.658418</ele>
        <time>2024-07-04T21:14:36.607Z</time>
      </trkpt>
      <trkpt lat="49.278902" lon="10.982573">
        <ele>391.610252</ele>
        <time>2024-07-04T21:14:40.510Z</time>
      </trkpt>
      <trkpt lat="49.278972" lon="10.982396">
        <ele>390.775450</ele>
        <time>2024-07-04T21:14:43.630Z</time>
      </trkpt>
      <trkpt lat="49.278938" lon="10.982203">
        <ele>389.969165</ele>
        <time>2024-07-04T21:14:46.692Z</time>
      </trkpt>
      <trkpt lat="49.278957" lon="10.982139">
        <ele>389.685571</ele>
        <time>2024-07-04T21:14:47.781Z</time>
      </trkpt>
      <trkpt lat="49.278897" lon="10.981965">
        <ele>388.891795</ele>
        <time>2024-07-04T21:14:50.810Z</time>
      </trkpt>
      <trkpt lat="49.278658" lon="10.981838">
        <ele>387.327964</ele>
        <time>2024-07-04T21:14:54.391Z</time>
      </trkpt>
      <trkpt lat="49.278422" lon="10.981651">
        <ele>385.685536</ele>
        <time>2024-07-04T21:14:58.212Z</time>
      </trkpt>
      <trkpt lat="49.278074" lon="10.981268">
        <ele>383.353022</ele>
        <time>2024-07-04T21:15:04.375Z</time>
      </trkpt>
      <trkpt lat="49.278022" lon="10.981133">
        <ele>382.822473</ele>
        <time>2024-07-04T21:15:05.825Z</time>
      </trkpt>
      <trkpt lat="49.277777" lon="10.980974">
        <ele>381.442359</ele>
        <time>2024-07-04T21:15:12.159Z</time>
      </trkpt>
      <trkpt lat="49.277543" lon="10.980634">
        <ele>379.769836</ele>
        <time>2024-07-04T21:15:19.736Z</time>
      </trkpt>
      <trkpt lat="49.277363" lon="10.980268">
        <ele>378.218706</ele>
        <time>2024-07-04T21:15:26.800Z</time>
      </trkpt>
      <trkpt lat="49.277254" lon="10.980047">
        <ele>377.281119</ele>
        <time>2024-07-04T21:15:31.076Z</time>
      </trkpt>
      <trkpt lat="49.277163" lon="10.979879">
        <ele>376.542149</ele>
        <time>2024-07-04T21:15:34.339Z</time>
      </trkpt>
      <trkpt lat="49.277059" lon="10.979715">
        <ele>375.768146</ele>
        <time>2024-07-04T21:15:37.905Z</time>
      </trkpt>
      <trkpt lat="49.276919" lon="10.979542">
        <ele>375.457856</ele>
        <time>2024-07-04T21:15:42.206Z</time>
      </trkpt>
      <trkpt lat="49.276557" lon="10.979244">
        <ele>374.914951</ele>
        <time>2024-07-04T21:15:52.691Z</time>
      </trkpt>
      <trkpt lat="49.276427" lon="10.979236">
        <ele>374.743050</ele>
        <time>2024-07-04T21:15:56.328Z</time>
      </trkpt>
      <trkpt lat="49.276363" lon="10.979215">
        <ele>374.656575</ele>
        <time>2024-07-04T21:15:58.133Z</time>
      </trkpt>
      <trkpt lat="49.276111" lon="10.979159">
        <ele>374.320140</ele>
        <time>2024-07-04T21:16:05.613Z</time>
      </trkpt>
      <trkpt lat="49.275945" lon="10.979030">
        <ele>374.074235</ele>
        <time>2024-07-04T21:16:11.143Z</time>
      </trkpt>
      <trkpt lat="49.275689" lon="10.978943">
        <ele>373.727782</ele>
        <time>2024-07-04T21:16:19.756Z</time>
      </trkpt>
      <trkpt lat="49.275182" lon="10.979197">
        <ele>374.194435</ele>
        <time>2024-07-04T21:16:41.194Z</time>
      </trkpt>
      <trkpt lat="49.274948" lon="10.979725">
        <ele>376.021436</ele>
        <time>2024-07-04T21:17:02.061Z</time>
      </trkpt>
      <trkpt lat="49.274820" lon="10.980115">
        <ele>377.271031</ele>
        <time>2024-07-04T21:17:18.104Z</time>
      </trkpt>
      <trkpt lat="49.274656" lon="10.980263">
        <ele>378.105975</ele>
        <time>2024-07-04T21:17:29.852Z</time>
      </trkpt>
      <trkpt lat="49.274588" lon="10.980388">
        <ele>378.571824</ele>
        <time>2024-07-04T21:17:36.870Z</time>
      </trkpt>
      <trkpt lat="49.274510" lon="10.980753">
        <ele>379.671193</ele>
        <time>2024-07-04T21:17:52.596Z</time>
      </trkpt>
      <trkpt lat="49.274333" lon="10.981244">
        <ele>381.312310</ele>
        <time>2024-07-04T21:18:13.933Z</time>
      </trkpt>
      <trkpt lat="49.274314" lon="10.981437">
        <ele>382.086814</ele>
        <time>2024-07-04T21:18:21.045Z</time>
      </trkpt>
      <trkpt lat="49.274307" lon="10.981504">
        <ele>382.356061</ele>
        <time>2024-07-04T21:18:23.414Z</time>
      </trkpt>
      <trkpt lat="49.274815" lon="10.981623">
        <ele>385.481539</ele>
        <time>2024-07-04T21:18:52.647Z</time>
      </trkpt>
      <trkpt lat="49.274907" lon="10.981506">
        <ele>386.208597</ele>
        <time>2024-07-04T21:18:59.680Z</time>
      </trkpt>
      <trkpt lat="49.275011" lon="10.981452">
        <ele>386.876422</ele>
        <time>2024-07-04T21:19:05.923Z</time>
      </trkpt>
      <trkpt lat="49.275580" lon="10.981388">
        <ele>390.346325</ele>
        <time>2024-07-04T21:19:42.690Z</time>
      </trkpt>
      <trkpt lat="49.275701" lon="10.981449">
        <ele>391.121017</ele>
        <time>2024-07-04T21:19:51.346Z</time>
      </trkpt>
      <trkpt lat="49.275799" lon="10.981616">
        <ele>392.012278</ele>
        <time>2024-07-04T21:20:02.100Z</time>
      </trkpt>
      <trkpt lat="49.275925" lon="10.982372">
        <ele>395.901696</ele>
        <time>2024-07-04T21:20:37.789Z</time>
      </trkpt>
      <trkpt lat="49.275925" lon="10.982599">
        <ele>397.041872</ele>
        <time>2024-07-04T21:20:47.583Z</time>
      </trkpt>
      <trkpt lat="49.275895" lon="10.984026">
        <ele>404.213137</ele>
        <time>2024-07-04T21:21:55.803Z</time>
      </trkpt>
      <trkpt lat="49.275897" lon="10.984343">
        <ele>405.805441</ele>
        <time>2024-07-04T21:22:10.442Z</time>
      </trkpt>
      <trkpt lat="49.275935" lon="10.984906">
        <ele>407.801215</ele>
        <time>2024-07-04T21:22:35.379Z</time>
      </trkpt>
      <trkpt lat="49.275967" lon="10.985329">
        <ele>409.263172</ele>
        <time>2024-07-04T21:22:52.789Z</time>
      </trkpt>
      <trkpt lat="49.275928" lon="10.986741">
        <ele>414.115138</ele>
        <time>2024-07-04T21:23:44.043Z</time>
      </trkpt>
      <trkpt lat="49.275853" lon="10.987235">
        <ele>415.656078</ele>
        <time>2024-07-04T21:24:00.097Z</time>
      </trkpt>
      <trkpt lat="49.275839" lon="10.987328">
        <ele>415.827427</ele>
        <time>2024-07-04T21:24:02.954Z</time>
      </trkpt>
      <trkpt lat="49.275831" lon="10.987423">
        <ele>415.999395</ele>
        <time>2024-07-04T21:24:05.798Z</time>
      </trkpt>
      <trkpt lat="49.275771" lon="10.988198">
        <ele>417.400513</ele>
        <time>2024-07-04T21:24:28.729Z</time>
      </trkpt>
      <trkpt lat="49.275750" lon="10.988981">
        <ele>418.807420</ele>
        <time>2024-07-04T21:24:51.641Z</time>
      </trkpt>
      <trkpt lat="49.275671" lon="10.989468">
        <ele>419.708352</ele>
        <time>2024-07-04T21:25:06.173Z</time>
      </trkpt>
      <trkpt lat="49.275661" lon="10.989522">
        <ele>419.809128</ele>
        <time>2024-07-04T21:25:07.793Z</time>
      </trkpt>
      <trkpt lat="49.275686" lon="10.990805">
        <ele>421.677027</ele>
        <time>2024-07-04T21:25:44.323Z</time>
      </trkpt>
      <trkpt lat="49.275753" lon="10.990949">
        <ele>421.914331</ele>
        <time>2024-07-04T21:25:49.279Z</time>
      </trkpt>
      <trkpt lat="49.275842" lon="10.991037">
        <ele>422.132138</ele>
        <time>2024-07-04T21:25:53.783Z</time>
      </trkpt>
      <trkpt lat="49.276412" lon="10.991334">
        <ele>423.370224</ele>
        <time>2024-07-04T21:26:18.328Z</time>
      </trkpt>
      <trkpt lat="49.276530" lon="10.991448">
        <ele>423.657072</ele>
        <time>2024-07-04T21:26:24.302Z</time>
      </trkpt>
      <trkpt lat="49.277023" lon="10.991592">
        <ele>424.241963</ele>
        <time>2024-07-04T21:26:44.218Z</time>
      </trkpt>
      <trkpt lat="49.277099" lon="10.991441">
        <ele>424.308499</ele>
        <time>2024-07-04T21:26:49.610Z</time>
      </trkpt>
      <trkpt lat="49.277650" lon="10.990355">
        <ele>424.788469</ele>
        <time>2024-07-04T21:27:23.092Z</time>
      </trkpt>
      <trkpt lat="49.277987" lon="10.989998">
        <ele>425.007534</ele>
        <time>2024-07-04T21:27:35.304Z</time>
      </trkpt>
      <trkpt lat="49.278652" lon="10.989512">
        <ele>423.155161</ele>
        <time>2024-07-04T21:27:55.338Z</time>
      </trkpt>
      <trkpt lat="49.278768" lon="10.989782">
        <ele>422.553967</ele>
        <time>2024-07-04T21:28:00.613Z</time>
      </trkpt>
      <trkpt lat="49.278943" lon="10.990189">
        <ele>421.647505</ele>
        <time>2024-07-04T21:28:08.561Z</time>
      </trkpt>
      <trkpt lat="49.279055" lon="10.990756">
        <ele>420.545840</ele>
        <time>2024-07-04T21:28:18.478Z</time>
      </trkpt>
      <trkpt lat="49.279142" lon="10.992033">
        <ele>418.516348</ele>
        <time>2024-07-04T21:28:40.026Z</time>
      </trkpt>
      <trkpt lat="49.279204" lon="10.992221">
        <ele>418.204259</ele>
        <time>2024-07-04T21:28:43.590Z</time>
      </trkpt>
      <trkpt lat="49.279731" lon="10.992082">
        <ele>416.989885</ele>
        <time>2024-07-04T21:28:58.220Z</time>
      </trkpt>
      <trkpt lat="49.279863" lon="10.992217">
        <ele>416.629526</ele>
        <time>2024-07-04T21:29:02.650Z</time>
      </trkpt>
      <trkpt lat="49.280051" lon="10.992704">
        <ele>415.828630</ele>
        <time>2024-07-04T21:29:13.305Z</time>
      </trkpt>
      <trkpt lat="49.280221" lon="10.992859">
        <ele>415.763254</ele>
        <time>2024-07-04T21:29:19.192Z</time>
      </trkpt>
      <trkpt lat="49.280471" lon="10.993041">
        <ele>415.671781</ele>
        <time>2024-07-04T21:29:27.541Z</time>
      </trkpt>
      <trkpt lat="49.280598" lon="10.993371">
        <ele>415.589170</ele>
        <time>2024-07-04T21:29:35.527Z</time>
      </trkpt>
      <trkpt lat="49.280620" lon="10.993584">
        <ele>415.542673</ele>
        <time>2024-07-04T21:29:39.721Z</time>
      </trkpt>
      <trkpt lat="49.280597" lon="10.993700">
        <ele>415.516532</ele>
        <time>2024-07-04T21:29:42.113Z</time>
      </trkpt>
      <trkpt lat="49.280569" lon="10.993849">
        <ele>415.483099</ele>
        <time>2024-07-04T21:29:45.122Z</time>
      </trkpt>
      <trkpt lat="49.280406" lon="10.994018">
        <ele>415.418060</ele>
        <time>2024-07-04T21:29:50.908Z</time>
      </trkpt>
      <trkpt lat="49.279923" lon="10.994739">
        <ele>415.820224</ele>
        <time>2024-07-04T21:30:12.140Z</time>
      </trkpt>
      <trkpt lat="49.279503" lon="10.995425">
        <ele>418.416211</ele>
        <time>2024-07-04T21:30:37.517Z</time>
      </trkpt>
      <trkpt lat="49.279251" lon="10.995683">
        <ele>419.698000</ele>
        <time>2024-07-04T21:30:53.439Z</time>
      </trkpt>
      <trkpt lat="49.279111" lon="10.996138">
        <ele>421.086167</ele>
        <time>2024-07-04T21:31:13.387Z</time>
      </trkpt>
      <trkpt lat="49.279018" lon="10.996827">
        <ele>423.194731</ele>
        <time>2024-07-04T21:31:45.727Z</time>
      </trkpt>
      <trkpt lat="49.278887" lon="10.997794">
        <ele>428.459743</ele>
        <time>2024-07-04T21:32:36.097Z</time>
      </trkpt>
      <trkpt lat="49.278887" lon="10.998412">
        <ele>431.754281</ele>
        <time>2024-07-04T21:33:07.424Z</time>
      </trkpt>
      <trkpt lat="49.278775" lon="10.999116">
        <ele>435.617269</ele>
        <time>2024-07-04T21:33:41.731Z</time>
      </trkpt>
      <trkpt lat="49.278887" lon="10.999768">
        <ele>438.607078</ele>
        <time>2024-07-04T21:34:10.854Z</time>
      </trkpt>
      <trkpt lat="49.278880" lon="11.000374">
        <ele>440.665398</ele>
        <time>2024-07-04T21:34:34.785Z</time>
      </trkpt>
      <trkpt lat="49.278876" lon="11.000730">
        <ele>441.874567</ele>
        <time>2024-07-04T21:34:48.057Z</time>
      </trkpt>
      <trkpt lat="49.279044" lon="11.001588">
        <ele>444.916774</ele>
        <time>2024-07-04T21:35:20.115Z</time>
      </trkpt>
      <trkpt lat="49.279205" lon="11.002170">
        <ele>447.017272</ele>
        <time>2024-07-04T21:35:42.042Z</time>
      </trkpt>
      <trkpt lat="49.279234" lon="11.002274">
        <ele>447.286067</ele>
        <time>2024-07-04T21:35:45.868Z</time>
      </trkpt>
      <trkpt lat="49.280354" lon="11.003519">
        <ele>452.326090</ele>
        <time>2024-07-04T21:36:55.181Z</time>
      </trkpt>
      <trkpt lat="49.280608" lon="11.003447">
        <ele>453.267090</ele>
        <time>2024-07-04T21:37:07.844Z</time>
      </trkpt>
      <trkpt lat="49.280720" lon="11.003415">
        <ele>453.563999</ele>
        <time>2024-07-04T21:37:13.383Z</time>
      </trkpt>
      <trkpt lat="49.280864" lon="11.003374">
        <ele>453.811707</ele>
        <time>2024-07-04T21:37:20.192Z</time>
      </trkpt>
      <trkpt lat="49.280968" lon="11.002293">
        <ele>455.017271</ele>
        <time>2024-07-04T21:37:44.932Z</time>
      </trkpt>
      <trkpt lat="49.281075" lon="11.000754">
        <ele>455.961384</ele>
        <time>2024-07-04T21:38:10.671Z</time>
      </trkpt>
      <trkpt lat="49.280904" lon="11.000025">
        <ele>453.866635</ele>
        <time>2024-07-04T21:38:20.182Z</time>
      </trkpt>
      <trkpt lat="49.280652" lon="10.998709">
        <ele>450.158064</ele>
        <time>2024-07-04T21:38:33.877Z</time>
      </trkpt>
      <trkpt lat="49.280335" lon="10.998669">
        <ele>448.509858</ele>
        <time>2024-07-04T21:38:40.916Z</time>
      </trkpt>
      <trkpt lat="49.279911" lon="10.998380">
        <ele>443.546076</ele>
        <time>2024-07-04T21:38:50.784Z</time>
      </trkpt>
      <trkpt lat="49.279549" lon="10.998133">
        <ele>439.307388</ele>
        <time>2024-07-04T21:38:59.099Z</time>
      </trkpt>
      <trkpt lat="49.279333" lon="10.997830">
        <ele>436.175306</ele>
        <time>2024-07-04T21:39:05.276Z</time>
      </trkpt>
      <trkpt lat="49.279183" lon="10.997677">
        <ele>434.247950</ele>
        <time>2024-07-04T21:39:09.035Z</time>
      </trkpt>
      <trkpt lat="49.279172" lon="10.997266">
        <ele>431.377344</ele>
        <time>2024-07-04T21:39:14.706Z</time>
      </trkpt>
      <trkpt lat="49.279210" lon="10.996934">
        <ele>429.013374</ele>
        <time>2024-07-04T21:39:19.327Z</time>
      </trkpt>
      <trkpt lat="49.279118" lon="10.996832">
        <ele>427.780641</ele>
        <time>2024-07-04T21:39:21.697Z</time>
      </trkpt>
      <trkpt lat="49.279018" lon="10.996827">
        <ele>426.694361</ele>
        <time>2024-07-04T21:39:23.796Z</time>
      </trkpt>
      <trkpt lat="49.278669" lon="10.997062">
        <ele>422.555788</ele>
        <time>2024-07-04T21:39:31.810Z</time>
      </trkpt>
      <trkpt lat="49.278435" lon="10.997706">
        <ele>417.334600</ele>
        <time>2024-07-04T21:39:41.972Z</time>
      </trkpt>
      <trkpt lat="49.278297" lon="10.997866">
        <ele>415.456004</ele>
        <time>2024-07-04T21:39:45.628Z</time>
      </trkpt>
      <trkpt lat="49.278382" lon="10.996769">
        <ele>408.004697</ele>
        <time>2024-07-04T21:40:01.197Z</time>
      </trkpt>
      <trkpt lat="49.278076" lon="10.996817">
        <ele>405.135810</ele>
        <time>2024-07-04T21:40:07.805Z</time>
      </trkpt>
      <trkpt lat="49.277872" lon="10.996805">
        <ele>403.231756</ele>
        <time>2024-07-04T21:40:12.171Z</time>
      </trkpt>
      <trkpt lat="49.277660" lon="10.997147">
        <ele>400.361215</ele>
        <time>2024-07-04T21:40:18.739Z</time>
      </trkpt>
      <trkpt lat="49.277537" lon="10.997165">
        <ele>399.208810</ele>
        <time>2024-07-04T21:40:21.379Z</time>
      </trkpt>
      <trkpt lat="49.277355" lon="10.997346">
        <ele>397.185364</ele>
        <time>2024-07-04T21:40:26.098Z</time>
      </trkpt>
      <trkpt lat="49.277152" lon="10.997274">
        <ele>395.242010</ele>
        <time>2024-07-04T21:40:30.705Z</time>
      </trkpt>
      <trkpt lat="49.276838" lon="10.997488">
        <ele>392.783912</ele>
        <time>2024-07-04T21:40:38.480Z</time>
      </trkpt>
      <trkpt lat="49.276610" lon="10.997713">
        <ele>391.542086</ele>
        <time>2024-07-04T21:40:44.780Z</time>
      </trkpt>
      <trkpt lat="49.276421" lon="10.997899">
        <ele>390.513506</ele>
        <time>2024-07-04T21:40:50.127Z</time>
      </trkpt>
      <trkpt lat="49.276392" lon="10.998105">
        <ele>389.883865</ele>
        <time>2024-07-04T21:40:53.466Z</time>
      </trkpt>
      <trkpt lat="49.276319" lon="10.998211">
        <ele>389.423363</ele>
        <time>2024-07-04T21:40:55.910Z</time>
      </trkpt>
      <trkpt lat="49.276270" lon="10.998528">
        <ele>388.450025</ele>
        <time>2024-07-04T21:41:01.197Z</time>
      </trkpt>
      <trkpt lat="49.276211" lon="10.998901">
        <ele>387.303304</ele>
        <time>2024-07-04T21:41:07.503Z</time>
      </trkpt>
      <trkpt lat="49.276068" lon="10.999394">
        <ele>385.691319</ele>
        <time>2024-07-04T21:41:16.654Z</time>
      </trkpt>
      <trkpt lat="49.276068" lon="10.999667">
        <ele>385.307408</ele>
        <time>2024-07-04T21:41:21.562Z</time>
      </trkpt>
      <trkpt lat="49.275846" lon="11.001022">
        <ele>385.732644</ele>
        <time>2024-07-04T21:41:48.221Z</time>
      </trkpt>
      <trkpt lat="49.275872" lon="11.001300">
        <ele>385.818126</ele>
        <time>2024-07-04T21:41:54.257Z</time>
      </trkpt>
      <trkpt lat="49.276150" lon="11.001606">
        <ele>385.977802</ele>
        <time>2024-07-04T21:42:08.439Z</time>
      </trkpt>
      <trkpt lat="49.276106" lon="11.002052">
        <ele>386.196343</ele>
        <time>2024-07-04T21:42:23.042Z</time>
      </trkpt>
      <trkpt lat="49.276166" lon="11.002061">
        <ele>386.494203</ele>
        <time>2024-07-04T21:42:26.778Z</time>
      </trkpt>
      <trkpt lat="49.276175" lon="11.002184">
        <ele>386.893166</ele>
        <time>2024-07-04T21:42:31.149Z</time>
      </trkpt>
      <trkpt lat="49.276204" lon="11.002249">
        <ele>387.146993</ele>
        <time>2024-07-04T21:42:34.268Z</time>
      </trkpt>
      <trkpt lat="49.276364" lon="11.002564">
        <ele>388.433804</ele>
        <time>2024-07-04T21:42:49.913Z</time>
      </trkpt>
      <trkpt lat="49.276529" lon="11.003070">
        <ele>390.257215</ele>
        <time>2024-07-04T21:43:12.699Z</time>
      </trkpt>
      <trkpt lat="49.276798" lon="11.003682">
        <ele>392.635852</ele>
        <time>2024-07-04T21:43:41.789Z</time>
      </trkpt>
      <trkpt lat="49.276811" lon="11.003759">
        <ele>392.892226</ele>
        <time>2024-07-04T21:43:44.942Z</time>
      </trkpt>
      <trkpt lat="49.276954" lon="11.004305">
        <ele>394.788693</ele>
        <time>2024-07-04T21:44:06.973Z</time>
      </trkpt>
      <trkpt lat="49.276985" lon="11.004371">
        <ele>394.996184</ele>
        <time>2024-07-04T21:44:09.849Z</time>
      </trkpt>
      <trkpt lat="49.276979" lon="11.004487">
        <ele>395.015516</ele>
        <time>2024-07-04T21:44:13.618Z</time>
      </trkpt>
      <trkpt lat="49.277046" lon="11.005109">
        <ele>395.120251</ele>
        <time>2024-07-04T21:44:34.144Z</time>
      </trkpt>
      <trkpt lat="49.277082" lon="11.005232">
        <ele>395.142647</ele>
        <time>2024-07-04T21:44:38.058Z</time>
      </trkpt>
      <trkpt lat="49.277110" lon="11.005424">
        <ele>395.175332</ele>
        <time>2024-07-04T21:44:43.778Z</time>
      </trkpt>
      <trkpt lat="49.277224" lon="11.005842">
        <ele>395.250600</ele>
        <time>2024-07-04T21:44:54.156Z</time>
      </trkpt>
      <trkpt lat="49.277216" lon="11.006067">
        <ele>395.288036</ele>
        <time>2024-07-04T21:44:58.509Z</time>
      </trkpt>
      <trkpt lat="49.277214" lon="11.006120">
        <ele>395.296855</ele>
        <time>2024-07-04T21:44:59.490Z</time>
      </trkpt>
      <trkpt lat="49.277241" lon="11.006217">
        <ele>395.314376</ele>
        <time>2024-07-04T21:45:01.355Z</time>
      </trkpt>
      <trkpt lat="49.277214" lon="11.006345">
        <ele>395.336725</ele>
        <time>2024-07-04T21:45:03.763Z</time>
      </trkpt>
      <trkpt lat="49.277232" lon="11.006799">
        <ele>395.412289</ele>
        <time>2024-07-04T21:45:11.373Z</time>
      </trkpt>
      <trkpt lat="49.277208" lon="11.006960">
        <ele>395.439726</ele>
        <time>2024-07-04T21:45:14.067Z</time>
      </trkpt>
      <trkpt lat="49.277247" lon="11.007087">
        <ele>395.205163</ele>
        <time>2024-07-04T21:45:16.304Z</time>
      </trkpt>
      <trkpt lat="49.277108" lon="11.007539">
        <ele>393.474804</ele>
        <time>2024-07-04T21:45:24.170Z</time>
      </trkpt>
      <trkpt lat="49.277093" lon="11.007653">
        <ele>393.072094</ele>
        <time>2024-07-04T21:45:26.001Z</time>
      </trkpt>
      <trkpt lat="49.276927" lon="11.008128">
        <ele>391.206129</ele>
        <time>2024-07-04T21:45:34.278Z</time>
      </trkpt>
      <trkpt lat="49.276644" lon="11.008719">
        <ele>388.667500</ele>
        <time>2024-07-04T21:45:45.409Z</time>
      </trkpt>
      <trkpt lat="49.276619" lon="11.008902">
        <ele>388.020055</ele>
        <time>2024-07-04T21:45:48.240Z</time>
      </trkpt>
      <trkpt lat="49.276474" lon="11.009320">
        <ele>386.380693</ele>
        <time>2024-07-04T21:45:55.475Z</time>
      </trkpt>
      <trkpt lat="49.276451" lon="11.009481">
        <ele>385.857836</ele>
        <time>2024-07-04T21:45:58.019Z</time>
      </trkpt>
      <trkpt lat="49.276346" lon="11.009653">
        <ele>385.455622</ele>
        <time>2024-07-04T21:46:01.715Z</time>
      </trkpt>
      <trkpt lat="49.276364" lon="11.009788">
        <ele>385.220342</ele>
        <time>2024-07-04T21:46:03.859Z</time>
      </trkpt>
      <trkpt lat="49.276271" lon="11.010091">
        <ele>384.648568</ele>
        <time>2024-07-04T21:46:09.183Z</time>
      </trkpt>
      <trkpt lat="49.276197" lon="11.010254">
        <ele>384.309487</ele>
        <time>2024-07-04T21:46:12.333Z</time>
      </trkpt>
      <trkpt lat="49.276147" lon="11.010542">
        <ele>383.800606</ele>
        <time>2024-07-04T21:46:17.302Z</time>
      </trkpt>
      <trkpt lat="49.276142" lon="11.011127">
        <ele>382.801617</ele>
        <time>2024-07-04T21:46:27.396Z</time>
      </trkpt>
      <trkpt lat="49.276120" lon="11.011295">
        <ele>382.509031</ele>
        <time>2024-07-04T21:46:30.370Z</time>
      </trkpt>
      <trkpt lat="49.276009" lon="11.011438">
        <ele>382.129531</ele>
        <time>2024-07-04T21:46:34.546Z</time>
      </trkpt>
      <trkpt lat="49.275588" lon="11.011746">
        <ele>381.581397</ele>
        <time>2024-07-04T21:46:49.218Z</time>
      </trkpt>
      <trkpt lat="49.275537" lon="11.011863">
        <ele>381.901796</ele>
        <time>2024-07-04T21:46:52.333Z</time>
      </trkpt>
      <trkpt lat="49.275889" lon="11.013169">
        <ele>385.119319</ele>
        <time>2024-07-04T21:47:39.571Z</time>
      </trkpt>
      <trkpt lat="49.276032" lon="11.013861">
        <ele>386.772142</ele>
        <time>2024-07-04T21:48:06.688Z</time>
      </trkpt>
      <trkpt lat="49.276037" lon="11.014065">
        <ele>387.236974</ele>
        <time>2024-07-04T21:48:14.403Z</time>
      </trkpt>
      <trkpt lat="49.276045" lon="11.014398">
        <ele>388.146605</ele>
        <time>2024-07-04T21:48:26.618Z</time>
      </trkpt>
      <trkpt lat="49.276206" lon="11.015044">
        <ele>390.176860</ele>
        <time>2024-07-04T21:48:51.986Z</time>
      </trkpt>
      <trkpt lat="49.276341" lon="11.015491">
        <ele>391.622989</ele>
        <time>2024-07-04T21:49:09.796Z</time>
      </trkpt>
      <trkpt lat="49.276359" lon="11.015544">
        <ele>391.798411</ele>
        <time>2024-07-04T21:49:12.052Z</time>
      </trkpt>
      <trkpt lat="49.276460" lon="11.016146">
        <ele>393.623309</ele>
        <time>2024-07-04T21:49:34.750Z</time>
      </trkpt>
      <trkpt lat="49.276592" lon="11.016601">
        <ele>395.085243</ele>
        <time>2024-07-04T21:49:51.877Z</time>
      </trkpt>
      <trkpt lat="49.276788" lon="11.016813">
        <ele>395.996843</ele>
        <time>2024-07-04T21:50:03.466Z</time>
      </trkpt>
      <trkpt lat="49.276956" lon="11.017049">
        <ele>396.733656</ele>
        <time>2024-07-04T21:50:14.208Z</time>
      </trkpt>
      <trkpt lat="49.277028" lon="11.017288">
        <ele>397.288962</ele>
        <time>2024-07-04T21:50:21.845Z</time>
      </trkpt>
      <trkpt lat="49.277096" lon="11.017427">
        <ele>397.655449</ele>
        <time>2024-07-04T21:50:26.953Z</time>
      </trkpt>
      <trkpt lat="49.277204" lon="11.017710">
        <ele>398.347046</ele>
        <time>2024-07-04T21:50:36.362Z</time>
      </trkpt>
      <trkpt lat="49.277241" lon="11.017885">
        <ele>398.735095</ele>
        <time>2024-07-04T21:50:41.541Z</time>
      </trkpt>
      <trkpt lat="49.277259" lon="11.018040">
        <ele>399.067194</ele>
        <time>2024-07-04T21:50:46.254Z</time>
      </trkpt>
      <trkpt lat="49.277271" lon="11.018313">
        <ele>399.644369</ele>
        <time>2024-07-04T21:50:54.360Z</time>
      </trkpt>
      <trkpt lat="49.277578" lon="11.017840">
        <ele>401.051783</ele>
        <time>2024-07-04T21:51:11.487Z</time>
      </trkpt>
      <trkpt lat="49.277764" lon="11.017665">
        <ele>401.929928</ele>
        <time>2024-07-04T21:51:20.373Z</time>
      </trkpt>
      <trkpt lat="49.277883" lon="11.017535">
        <ele>402.620574</ele>
        <time>2024-07-04T21:51:26.437Z</time>
      </trkpt>
      <trkpt lat="49.278149" lon="11.017097">
        <ele>404.465670</ele>
        <time>2024-07-04T21:51:42.919Z</time>
      </trkpt>
      <trkpt lat="49.278215" lon="11.017029">
        <ele>404.841519</ele>
        <time>2024-07-04T21:51:46.340Z</time>
      </trkpt>
      <trkpt lat="49.278330" lon="11.016980">
        <ele>405.405646</ele>
        <time>2024-07-04T21:51:51.354Z</time>
      </trkpt>
      <trkpt lat="49.278419" lon="11.016977">
        <ele>405.826383</ele>
        <time>2024-07-04T21:51:55.177Z</time>
      </trkpt>
      <trkpt lat="49.278663" lon="11.017127">
        <ele>407.068875</ele>
        <time>2024-07-04T21:52:06.910Z</time>
      </trkpt>
      <trkpt lat="49.279027" lon="11.017209">
        <ele>408.807709</ele>
        <time>2024-07-04T21:52:24.511Z</time>
      </trkpt>
      <trkpt lat="49.279573" lon="11.017074">
        <ele>411.959752</ele>
        <time>2024-07-04T21:52:53.263Z</time>
      </trkpt>
      <trkpt lat="49.280197" lon="11.017274">
        <ele>416.027717</ele>
        <time>2024-07-04T21:53:28.663Z</time>
      </trkpt>
      <trkpt lat="49.280367" lon="11.017300">
        <ele>417.117903</ele>
        <time>2024-07-04T21:53:37.927Z</time>
      </trkpt>
      <trkpt lat="49.280881" lon="11.017203">
        <ele>420.422589</ele>
        <time>2024-07-04T21:54:05.494Z</time>
      </trkpt>
      <trkpt lat="49.281010" lon="11.017174">
        <ele>421.254566</ele>
        <time>2024-07-04T21:54:12.666Z</time>
      </trkpt>
      <trkpt lat="49.281122" lon="11.017110">
        <ele>421.941806</ele>
        <time>2024-07-04T21:54:19.027Z</time>
      </trkpt>
      <trkpt lat="49.281254" lon="11.017159">
        <ele>422.708600</ele>
        <time>2024-07-04T21:54:26.058Z</time>
      </trkpt>
      <trkpt lat="49.281427" lon="11.017571">
        <ele>424.513197</ele>
        <time>2024-07-04T21:54:43.083Z</time>
      </trkpt>
      <trkpt lat="49.281610" lon="11.017780">
        <ele>425.801612</ele>
        <time>2024-07-04T21:54:55.456Z</time>
      </trkpt>
      <trkpt lat="49.281718" lon="11.017760">
        <ele>426.415798</ele>
        <time>2024-07-04T21:55:01.039Z</time>
      </trkpt>
      <trkpt lat="49.281774" lon="11.017700">
        <ele>426.801538</ele>
        <time>2024-07-04T21:55:04.662Z</time>
      </trkpt>
      <trkpt lat="49.281825" lon="11.017587">
        <ele>427.307617</ele>
        <time>2024-07-04T21:55:09.569Z</time>
      </trkpt>
      <trkpt lat="49.281831" lon="11.017460">
        <ele>427.776585</ele>
        <time>2024-07-04T21:55:14.031Z</time>
      </trkpt>
      <trkpt lat="49.281511" lon="11.013582">
        <ele>437.265490</ele>
        <time>2024-07-04T21:57:03.946Z</time>
      </trkpt>
      <trkpt lat="49.281256" lon="11.013744">
        <ele>435.601951</ele>
        <time>2024-07-04T21:57:11.172Z</time>
      </trkpt>
      <trkpt lat="49.280744" lon="11.013864">
        <ele>432.480456</ele>
        <time>2024-07-04T21:57:23.481Z</time>
      </trkpt>
      <trkpt lat="49.280554" lon="11.013998">
        <ele>431.220018</ele>
        <time>2024-07-04T21:57:28.165Z</time>
      </trkpt>
      <trkpt lat="49.280454" lon="11.014068">
        <ele>430.557492</ele>
        <time>2024-07-04T21:57:30.600Z</time>
      </trkpt>
      <trkpt lat="49.280313" lon="11.014132">
        <ele>429.671266</ele>
        <time>2024-07-04T21:57:32.600Z</time>
      </trkpt>
      <trkpt lat="49.279971" lon="11.014038">
        <ele>427.577287</ele>
        <time>2024-07-04T21:57:37.280Z</time>
      </trkpt>
      <trkpt lat="49.279790" lon="11.014024">
        <ele>426.110060</ele>
        <time>2024-07-04T21:57:39.691Z</time>
      </trkpt>
      <trkpt lat="49.279608" lon="11.014045">
        <ele>424.142932</ele>
        <time>2024-07-04T21:57:42.107Z</time>
      </trkpt>
      <trkpt lat="49.279482" lon="11.014139">
        <ele>422.632623</ele>
        <time>2024-07-04T21:57:43.954Z</time>
      </trkpt>
      <trkpt lat="49.279341" lon="11.014894">
        <ele>417.110839</ele>
        <time>2024-07-04T21:57:50.753Z</time>
      </trkpt>
      <trkpt lat="49.279276" lon="11.015139">
        <ele>415.251190</ele>
        <time>2024-07-04T21:57:53.041Z</time>
      </trkpt>
      <trkpt lat="49.279318" lon="11.015439">
        <ele>413.093804</ele>
        <time>2024-07-04T21:57:55.712Z</time>
      </trkpt>
      <trkpt lat="49.279228" lon="11.015710">
        <ele>410.955653</ele>
        <time>2024-07-04T21:57:58.332Z</time>
      </trkpt>
      <trkpt lat="49.279123" lon="11.015897">
        <ele>409.220862</ele>
        <time>2024-07-04T21:58:00.527Z</time>
      </trkpt>
      <trkpt lat="49.278852" lon="11.015998">
        <ele>406.990368</ele>
        <time>2024-07-04T21:58:06.637Z</time>
      </trkpt>
      <trkpt lat="49.278511" lon="11.015936">
        <ele>405.399175</ele>
        <time>2024-07-04T21:58:14.429Z</time>
      </trkpt>
      <trkpt lat="49.278255" lon="11.015889">
        <ele>404.204451</ele>
        <time>2024-07-04T21:58:20.497Z</time>
      </trkpt>
      <trkpt lat="49.278126" lon="11.015847">
        <ele>403.593359</ele>
        <time>2024-07-04T21:58:23.750Z</time>
      </trkpt>
      <trkpt lat="49.277847" lon="11.015640">
        <ele>402.157053</ele>
        <time>2024-07-04T21:58:31.484Z</time>
      </trkpt>
      <trkpt lat="49.277671" lon="11.016213">
        <ele>400.242469</ele>
        <time>2024-07-04T21:58:42.678Z</time>
      </trkpt>
      <trkpt lat="49.277504" lon="11.016681">
        <ele>399.421135</ele>
        <time>2024-07-04T21:58:52.853Z</time>
      </trkpt>
      <trkpt lat="49.277457" lon="11.016739">
        <ele>399.503749</ele>
        <time>2024-07-04T21:58:54.668Z</time>
      </trkpt>
      <trkpt lat="49.277504" lon="11.016998">
        <ele>399.743881</ele>
        <time>2024-07-04T21:59:00.179Z</time>
      </trkpt>
      <trkpt lat="49.277477" lon="11.017300">
        <ele>400.016161</ele>
        <time>2024-07-04T21:59:06.780Z</time>
      </trkpt>
      <trkpt lat="49.277449" lon="11.017501">
        <ele>400.199750</ele>
        <time>2024-07-04T21:59:11.497Z</time>
      </trkpt>
      <trkpt lat="49.277363" lon="11.017743">
        <ele>400.445904</ele>
        <time>2024-07-04T21:59:18.430Z</time>
      </trkpt>
      <trkpt lat="49.277259" lon="11.018040">
        <ele>400.746996</ele>
        <time>2024-07-04T21:59:28.290Z</time>
      </trkpt>
      <trkpt lat="49.277271" lon="11.018313">
        <ele>400.991405</ele>
        <time>2024-07-04T21:59:36.112Z</time>
      </trkpt>
      <trkpt lat="49.277440" lon="11.018052">
        <ele>401.319876</ele>
        <time>2024-07-04T21:59:44.377Z</time>
      </trkpt>
      <trkpt lat="49.277578" lon="11.017840">
        <ele>401.587383</ele>
        <time>2024-07-04T21:59:51.286Z</time>
      </trkpt>
      <trkpt lat="49.277764" lon="11.017665">
        <ele>402.302979</ele>
        <time>2024-07-04T21:59:59.526Z</time>
      </trkpt>
      <trkpt lat="49.277883" lon="11.017535">
        <ele>402.959007</ele>
        <time>2024-07-04T22:00:05.181Z</time>
      </trkpt>
      <trkpt lat="49.278149" lon="11.017097">
        <ele>404.711620</ele>
        <time>2024-07-04T22:00:20.854Z</time>
      </trkpt>
      <trkpt lat="49.278215" lon="11.017029">
        <ele>405.068629</ele>
        <time>2024-07-04T22:00:24.177Z</time>
      </trkpt>
      <trkpt lat="49.278330" lon="11.016980">
        <ele>405.604480</ele>
        <time>2024-07-04T22:00:29.191Z</time>
      </trkpt>
      <trkpt lat="49.278419" lon="11.016977">
        <ele>406.004128</ele>
        <time>2024-07-04T22:00:33.014Z</time>
      </trkpt>
      <trkpt lat="49.278663" lon="11.017127">
        <ele>407.184341</ele>
        <time>2024-07-04T22:00:44.747Z</time>
      </trkpt>
      <trkpt lat="49.279027" lon="11.017209">
        <ele>408.836018</ele>
        <time>2024-07-04T22:01:02.348Z</time>
      </trkpt>
      <trkpt lat="49.279573" lon="11.017074">
        <ele>411.966436</ele>
        <time>2024-07-04T22:01:31.100Z</time>
      </trkpt>
      <trkpt lat="49.280197" lon="11.017274">
        <ele>416.031124</ele>
        <time>2024-07-04T22:02:06.500Z</time>
      </trkpt>
      <trkpt lat="49.280367" lon="11.017300">
        <ele>417.120431</ele>
        <time>2024-07-04T22:02:15.764Z</time>
      </trkpt>
      <trkpt lat="49.280881" lon="11.017203">
        <ele>420.422456</ele>
        <time>2024-07-04T22:02:43.331Z</time>
      </trkpt>
      <trkpt lat="49.281010" lon="11.017174">
        <ele>421.253842</ele>
        <time>2024-07-04T22:02:50.503Z</time>
      </trkpt>
      <trkpt lat="49.281122" lon="11.017110">
        <ele>422.024074</ele>
        <time>2024-07-04T22:02:56.864Z</time>
      </trkpt>
      <trkpt lat="49.281254" lon="11.017159">
        <ele>422.899256</ele>
        <time>2024-07-04T22:03:03.895Z</time>
      </trkpt>
      <trkpt lat="49.281427" lon="11.017571">
        <ele>424.958934</ele>
        <time>2024-07-04T22:03:20.920Z</time>
      </trkpt>
      <trkpt lat="49.281610" lon="11.017780">
        <ele>426.429468</ele>
        <time>2024-07-04T22:03:33.293Z</time>
      </trkpt>
      <trkpt lat="49.281718" lon="11.017760">
        <ele>427.130470</ele>
        <time>2024-07-04T22:03:38.876Z</time>
      </trkpt>
      <trkpt lat="49.281774" lon="11.017700">
        <ele>427.570735</ele>
        <time>2024-07-04T22:03:42.499Z</time>
      </trkpt>
      <trkpt lat="49.281825" lon="11.017587">
        <ele>428.148349</ele>
        <time>2024-07-04T22:03:47.406Z</time>
      </trkpt>
      <trkpt lat="49.281831" lon="11.017460">
        <ele>428.683606</ele>
        <time>2024-07-04T22:03:51.868Z</time>
      </trkpt>
      <trkpt lat="49.281511" lon="11.013582">
        <ele>444.174133</ele>
        <time>2024-07-04T22:06:08.875Z</time>
      </trkpt>
      <trkpt lat="49.281292" lon="11.010996">
        <ele>449.540853</ele>
        <time>2024-07-04T22:07:11.386Z</time>
      </trkpt>
      <trkpt lat="49.281371" lon="11.011240">
        <ele>449.166455</ele>
        <time>2024-07-04T22:07:16.957Z</time>
      </trkpt>
      <trkpt lat="49.281390" lon="11.011420">
        <ele>448.915837</ele>
        <time>2024-07-04T22:07:20.705Z</time>
      </trkpt>
      <trkpt lat="49.281436" lon="11.011586">
        <ele>448.667948</ele>
        <time>2024-07-04T22:07:24.268Z</time>
      </trkpt>
      <trkpt lat="49.281544" lon="11.011736">
        <ele>448.360893</ele>
        <time>2024-07-04T22:07:28.536Z</time>
      </trkpt>
      <trkpt lat="49.281596" lon="11.011960">
        <ele>448.034106</ele>
        <time>2024-07-04T22:07:33.065Z</time>
      </trkpt>
      <trkpt lat="49.281600" lon="11.011978">
        <ele>448.007970</ele>
        <time>2024-07-04T22:07:33.413Z</time>
      </trkpt>
      <trkpt lat="49.281534" lon="11.012246">
        <ele>447.614246</ele>
        <time>2024-07-04T22:07:38.532Z</time>
      </trkpt>
      <trkpt lat="49.281506" lon="11.012541">
        <ele>447.204517</ele>
        <time>2024-07-04T22:07:43.795Z</time>
      </trkpt>
      <trkpt lat="49.281534" lon="11.012831">
        <ele>446.801587</ele>
        <time>2024-07-04T22:07:48.812Z</time>
      </trkpt>
      <trkpt lat="49.281625" lon="11.013083">
        <ele>446.405702</ele>
        <time>2024-07-04T22:07:53.657Z</time>
      </trkpt>
      <trkpt lat="49.281748" lon="11.012998">
        <ele>446.121434</ele>
        <time>2024-07-04T22:07:56.865Z</time>
      </trkpt>
      <trkpt lat="49.281815" lon="11.012912">
        <ele>445.937318</ele>
        <time>2024-07-04T22:07:58.986Z</time>
      </trkpt>
      <trkpt lat="49.282177" lon="11.012822">
        <ele>443.132543</ele>
        <time>2024-07-04T22:08:07.505Z</time>
      </trkpt>
      <trkpt lat="49.282266" lon="11.012737">
        <ele>442.170971</ele>
        <time>2024-07-04T22:08:09.923Z</time>
      </trkpt>
      <trkpt lat="49.282396" lon="11.012740">
        <ele>440.978724</ele>
        <time>2024-07-04T22:08:12.811Z</time>
      </trkpt>
      <trkpt lat="49.282495" lon="11.012831">
        <ele>439.920189</ele>
        <time>2024-07-04T22:08:15.372Z</time>
      </trkpt>
      <trkpt lat="49.282536" lon="11.012951">
        <ele>439.109858</ele>
        <time>2024-07-04T22:08:17.333Z</time>
      </trkpt>
      <trkpt lat="49.282560" lon="11.013079">
        <ele>438.313170</ele>
        <time>2024-07-04T22:08:19.252Z</time>
      </trkpt>
      <trkpt lat="49.282520" lon="11.013238">
        <ele>437.293766</ele>
        <time>2024-07-04T22:08:21.650Z</time>
      </trkpt>
      <trkpt lat="49.282569" lon="11.013213">
        <ele>436.820199</ele>
        <time>2024-07-04T22:08:22.352Z</time>
      </trkpt>
      <trkpt lat="49.282604" lon="11.013141">
        <ele>436.283066</ele>
        <time>2024-07-04T22:08:23.154Z</time>
      </trkpt>
      <trkpt lat="49.282669" lon="11.013009">
        <ele>435.293738</ele>
        <time>2024-07-04T22:08:24.622Z</time>
      </trkpt>
      <trkpt lat="49.282728" lon="11.012980">
        <ele>434.725572</ele>
        <time>2024-07-04T22:08:25.921Z</time>
      </trkpt>
      <trkpt lat="49.282811" lon="11.012939">
        <ele>433.925915</ele>
        <time>2024-07-04T22:08:27.760Z</time>
      </trkpt>
      <trkpt lat="49.282907" lon="11.012831">
        <ele>432.833966</ele>
        <time>2024-07-04T22:08:30.284Z</time>
      </trkpt>
      <trkpt lat="49.283042" lon="11.012856">
        <ele>431.587004</ele>
        <time>2024-07-04T22:08:33.156Z</time>
      </trkpt>
      <trkpt lat="49.283115" lon="11.012585">
        <ele>429.833143</ele>
        <time>2024-07-04T22:08:37.130Z</time>
      </trkpt>
      <trkpt lat="49.283207" lon="11.012420">
        <ele>428.274213</ele>
        <time>2024-07-04T22:08:40.080Z</time>
      </trkpt>
      <trkpt lat="49.283346" lon="11.012225">
        <ele>425.940111</ele>
        <time>2024-07-04T22:08:43.961Z</time>
      </trkpt>
      <trkpt lat="49.283504" lon="11.012104">
        <ele>423.752186</ele>
        <time>2024-07-04T22:08:47.609Z</time>
      </trkpt>
      <trkpt lat="49.283684" lon="11.012380">
        <ele>420.598405</ele>
        <time>2024-07-04T22:08:52.875Z</time>
      </trkpt>
      <trkpt lat="49.283830" lon="11.012278">
        <ele>418.610816</ele>
        <time>2024-07-04T22:08:56.180Z</time>
      </trkpt>
      <trkpt lat="49.283913" lon="11.012344">
        <ele>417.452531</ele>
        <time>2024-07-04T22:08:58.111Z</time>
      </trkpt>
      <trkpt lat="49.284063" lon="11.011962">
        <ele>413.849556</ele>
        <time>2024-07-04T22:09:04.134Z</time>
      </trkpt>
      <trkpt lat="49.284292" lon="11.012199">
        <ele>410.426797</ele>
        <time>2024-07-04T22:09:09.860Z</time>
      </trkpt>
      <trkpt lat="49.284300" lon="11.012759">
        <ele>406.097657</ele>
        <time>2024-07-04T22:09:17.507Z</time>
      </trkpt>
      <trkpt lat="49.284343" lon="11.012887">
        <ele>405.143634</ele>
        <time>2024-07-04T22:09:19.470Z</time>
      </trkpt>
      <trkpt lat="49.284322" lon="11.013419">
        <ele>401.612046</ele>
        <time>2024-07-04T22:09:24.129Z</time>
      </trkpt>
      <trkpt lat="49.284313" lon="11.013661">
        <ele>400.005900</ele>
        <time>2024-07-04T22:09:26.272Z</time>
      </trkpt>
      <trkpt lat="49.284689" lon="11.014478">
        <ele>393.380556</ele>
        <time>2024-07-04T22:09:40.324Z</time>
      </trkpt>
      <trkpt lat="49.284903" lon="11.015039">
        <ele>389.074325</ele>
        <time>2024-07-04T22:09:49.626Z</time>
      </trkpt>
      <trkpt lat="49.285005" lon="11.015210">
        <ele>387.807771</ele>
        <time>2024-07-04T22:09:52.913Z</time>
      </trkpt>
      <trkpt lat="49.285199" lon="11.015317">
        <ele>386.188182</ele>
        <time>2024-07-04T22:09:57.439Z</time>
      </trkpt>
      <trkpt lat="49.285549" lon="11.015405">
        <ele>383.402034</ele>
        <time>2024-07-04T22:10:05.146Z</time>
      </trkpt>
      <trkpt lat="49.285945" lon="11.015156">
        <ele>380.039780</ele>
        <time>2024-07-04T22:10:11.093Z</time>
      </trkpt>
      <trkpt lat="49.286206" lon="11.014812">
        <ele>377.335970</ele>
        <time>2024-07-04T22:10:15.954Z</time>
      </trkpt>
      <trkpt lat="49.286357" lon="11.014532">
        <ele>375.474408</ele>
        <time>2024-07-04T22:10:19.380Z</time>
      </trkpt>
      <trkpt lat="49.286443" lon="11.014162">
        <ele>374.174654</ele>
        <time>2024-07-04T22:10:25.455Z</time>
      </trkpt>
      <trkpt lat="49.286509" lon="11.014038">
        <ele>373.870159</ele>
        <time>2024-07-04T22:10:27.943Z</time>
      </trkpt>
      <trkpt lat="49.286602" lon="11.013940">
        <ele>373.540997</ele>
        <time>2024-07-04T22:10:30.733Z</time>
      </trkpt>
      <trkpt lat="49.286979" lon="11.013732">
        <ele>372.372321</ele>
        <time>2024-07-04T22:10:40.973Z</time>
      </trkpt>
      <trkpt lat="49.287210" lon="11.013496">
        <ele>371.562640</ele>
        <time>2024-07-04T22:10:48.238Z</time>
      </trkpt>
      <trkpt lat="49.287577" lon="11.013301">
        <ele>370.429707</ele>
        <time>2024-07-04T22:10:59.098Z</time>
      </trkpt>
      <trkpt lat="49.287954" lon="11.013076">
        <ele>369.355149</ele>
        <time>2024-07-04T22:11:06.107Z</time>
      </trkpt>
      <trkpt lat="49.287986" lon="11.013302">
        <ele>369.380560</ele>
        <time>2024-07-04T22:11:08.767Z</time>
      </trkpt>
      <trkpt lat="49.288074" lon="11.013563">
        <ele>369.412842</ele>
        <time>2024-07-04T22:11:12.395Z</time>
      </trkpt>
      <trkpt lat="49.288203" lon="11.013737">
        <ele>369.441786</ele>
        <time>2024-07-04T22:11:15.782Z</time>
      </trkpt>
      <trkpt lat="49.288336" lon="11.013824">
        <ele>369.466145</ele>
        <time>2024-07-04T22:11:18.766Z</time>
      </trkpt>
      <trkpt lat="49.288428" lon="11.013867">
        <ele>369.482348</ele>
        <time>2024-07-04T22:11:21.290Z</time>
      </trkpt>
      <trkpt lat="49.288482" lon="11.013891">
        <ele>369.491819</ele>
        <time>2024-07-04T22:11:22.632Z</time>
      </trkpt>
      <trkpt lat="49.288886" lon="11.014048">
        <ele>369.562028</ele>
        <time>2024-07-04T22:11:32.800Z</time>
      </trkpt>
      <trkpt lat="49.289047" lon="11.014091">
        <ele>369.589558</ele>
        <time>2024-07-04T22:11:36.848Z</time>
      </trkpt>
      <trkpt lat="49.289699" lon="11.014237">
        <ele>369.652385</ele>
        <time>2024-07-04T22:11:49.345Z</time>
      </trkpt>
      <trkpt lat="49.289894" lon="11.014319">
        <ele>369.652385</ele>
        <time>2024-07-04T22:11:52.838Z</time>
      </trkpt>
      <trkpt lat="49.290189" lon="11.014502">
        <ele>369.652385</ele>
        <time>2024-07-04T22:11:58.188Z</time>
      </trkpt>
      <trkpt lat="49.290351" lon="11.014583">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:00.987Z</time>
      </trkpt>
      <trkpt lat="49.290453" lon="11.014573">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:02.734Z</time>
      </trkpt>
      <trkpt lat="49.290863" lon="11.014520">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:09.634Z</time>
      </trkpt>
      <trkpt lat="49.291461" lon="11.014442">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:19.576Z</time>
      </trkpt>
      <trkpt lat="49.291594" lon="11.014424">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:21.836Z</time>
      </trkpt>
      <trkpt lat="49.291708" lon="11.014525">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:23.977Z</time>
      </trkpt>
      <trkpt lat="49.291805" lon="11.014679">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:26.243Z</time>
      </trkpt>
      <trkpt lat="49.291835" lon="11.014621">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:27.651Z</time>
      </trkpt>
      <trkpt lat="49.291824" lon="11.014400">
        <ele>369.652385</ele>
        <time>2024-07-04T22:12:31.777Z</time>
      </trkpt>
      `,
    },
  ],
});
