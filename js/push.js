const pushManager = {
  publicKey: 'BCyAa3hD-bzlH4gr3iYvr7fSOXU0MTU6kKMRGiBaW-kBN5vGbbAxloNDjnGWit-G31tpf-wHkmSqMaWYVWs9QNc',

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[PUSH] Navegador não suporta Push.');
      return;
    }
    if (Notification.permission === 'granted') {
      this.subscribe();
    }
  },

  async requestPermission() {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await this.subscribe();
      return true;
    }
    return false;
  },

  async subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
      });

      const user = state.get('promotor');
      if (user?.user_id) {
        await api.post({
          evento: 'REGISTRAR_PUSH_TOKEN',
          subscription_json: JSON.stringify(subscription)
        });
        console.log('[PUSH] Inscrito com sucesso.');
      }
    } catch (err) {
      console.error('[PUSH] Erro ao inscrever:', err);
    }
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
};
