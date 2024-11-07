const authorizeButton = document.getElementById('authorize');
authorizeButton?.addEventListener('click', async () => {
    await chrome.storage.local.set({ authorized: true });
    window.close();
});