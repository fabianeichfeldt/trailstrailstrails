/* Trailradar embed snippet — https://trailradar.app/embed.js
 *
 * Usage:
 *   <div id="trailradar-embed"></div>
 *   <script src="https://trailradar.app/embed.js"></script>
 *   <script>
 *     TrailRadar.mount({
 *       token:  'your-token',
 *       target: '#trailradar-embed',  // default: '#trailradar-embed'
 *       center: [47.8, 13.0],         // [lat, lng]
 *       zoom:   12,
 *       height: '500px',              // default: '500px'
 *       baseUrl: 'https://trailradar.app',  // override for self-hosted / local dev
 *     });
 *   </script>
 */
(function () {
  'use strict';

  function mount(opts) {
    if (!opts || !opts.token) {
      console.error('[TrailRadar] mount() requires a token.');
      return;
    }

    var target = typeof opts.target === 'string'
      ? document.querySelector(opts.target)
      : (opts.target || document.getElementById('trailradar-embed'));

    if (!target) {
      console.error('[TrailRadar] Target element not found:', opts.target || '#trailradar-embed');
      return;
    }

    var base = (opts.baseUrl || 'https://trailradar.app').replace(/\/$/, '');
    var params = new URLSearchParams();
    if (opts.center && opts.center.length === 2) {
      params.set('lat',  opts.center[0]);
      params.set('lng',  opts.center[1]);
    }
    if (opts.zoom != null) params.set('zoom', opts.zoom);
    // Pass the parent page's hostname so the server can validate it against the
    // token's allowed_hosts list. The embed page forwards this in its API call.
    params.set('parentHost', window.location.hostname);

    var src = base + '/embed/' + encodeURIComponent(opts.token) + '?' + params.toString();

    var iframe = document.createElement('iframe');
    iframe.src              = src;
    iframe.style.width      = '100%';
    iframe.style.height     = opts.height || '500px';
    iframe.style.border     = 'none';
    iframe.style.display    = 'block';
    iframe.allowFullscreen  = true;
    iframe.title            = 'Trailradar Karteneinbettung';
    iframe.setAttribute('loading', 'lazy');

    target.appendChild(iframe);
    return iframe;
  }

  window.TrailRadar = { mount: mount };
}());
