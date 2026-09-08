/* Load the shared shell before the Firebase app module. */
const assetBase = window.SUPPORTLY_ASSET_BASE || './';
const shellUrl = new URL('components/shell.html', new URL(assetBase, window.location.href)).href;

async function boot() {
  try {
    const response = await fetch(shellUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Shell request failed: ${response.status}`);
    document.body.insertAdjacentHTML('afterbegin', await response.text());

    const module = document.createElement('script');
    module.type = 'module';
    module.src = new URL('js/app.js', new URL(assetBase, window.location.href)).href;
    document.body.appendChild(module);
  } catch (error) {
    document.body.innerHTML = `<main class="bootstrap-error"><h1>Supportly could not load</h1><p>Please check your connection and reload the page.</p><button onclick="location.reload()">Reload</button></main>`;
    console.error(error);
  }
}

boot();
