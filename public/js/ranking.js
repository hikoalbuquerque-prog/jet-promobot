const ranking = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:50">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700;flex:1">🏆 Ranking Semanal</div>
        </div>
        <div style="padding:16px" id="ranking-content">
          <div style="text-align:center;padding:40px;color:#a0aec0;font-size:14px">Carregando...</div>
        </div>
        ${ui.bottomNav('ranking')}
      </div>`;

    try {
      const [rankRes, meRes] = await Promise.all([
        api.get('GET_RANKING_SEMANAL'),
        api.get('GET_ME')
      ]);

      const el      = document.getElementById('ranking-content');
      const lista   = rankRes.ranking || [];
      const eu      = meRes?.user;
      const meuScore = eu?.score_operacional || 0;
      const meuStreak = eu?.streak_dias || 0;

      el.innerHTML = `
        <!-- Meu score -->
        <div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:16px;padding:20px;margin-bottom:16px;text-align:center">
          <div style="font-size:12px;color:#a0aec0;letter-spacing:1px;margin-bottom:8px">SEU SCORE</div>
          <div style="font-size:48px;font-weight:800;color:#f6ad55">${meuScore}</div>
          <div style="font-size:13px;color:#a0aec0;margin-top:4px">pontos esta semana</div>
          ${meuStreak > 0 ? `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:rgba(246,173,85,0.15);border:1px solid rgba(246,173,85,0.3);border-radius:20px;padding:4px 14px">
            <span style="font-size:16px">🔥</span>
            <span style="font-size:13px;font-weight:700;color:#f6ad55">${meuStreak} dias consecutivos</span>
          </div>` : ''}
        </div>

        <!-- Ranking -->
        <div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin-bottom:10px">TOP PROMOTORES</div>
        ${lista.length === 0
          ? '<div style="text-align:center;padding:40px;color:#a0aec0;font-size:14px">Nenhum dado ainda esta semana</div>'
          : lista.map((p, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
              const isMe  = p.user_id === eu?.user_id;
              const cor   = i === 0 ? '#f6ad55' : i === 1 ? '#a0aec0' : i === 2 ? '#cd7f32' : '#4f8ef7';
              return `
                <div style="background:${isMe ? 'rgba(79,142,247,0.1)' : '#1e2a45'};border:1px solid ${isMe ? '#4f8ef7' : '#2a3a55'};border-radius:12px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
                  <div style="font-size:24px;width:36px;text-align:center">${medal}</div>
                  <div style="flex:1">
                    <div style="font-size:14px;font-weight:700;color:${isMe ? '#4f8ef7' : '#eaf0fb'}">${p.nome}${isMe ? ' (você)' : ''}</div>
                    <div style="font-size:11px;color:#6c7a8d;margin-top:2px">${p.pontos} pontos</div>
                  </div>
                  <div style="font-size:20px;font-weight:800;color:${cor}">${p.pontos}</div>
                </div>`;
            }).join('')}

        <!-- Tabela de pontos -->
        <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;margin-top:16px">
          <div style="font-size:12px;font-weight:700;color:#a0aec0;letter-spacing:1px;margin-bottom:12px">COMO GANHAR PONTOS</div>
          ${[
            ['✅ Check-in pontual', '+10'],
            ['✅ Check-in com atraso', '+5'],
            ['🏁 Checkout completo', '+5'],
            ['🔥 Streak bônus (a cada 5 dias)', '+25'],
            ['❌ Cancelamento de slot', '-20'],
          ].map(([desc, pts]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2a3a55">
              <span style="font-size:13px;color:#eaf0fb">${desc}</span>
              <span style="font-size:13px;font-weight:700;color:${pts.startsWith('+') ? '#68d391' : '#fc8181'}">${pts}</span>
            </div>`).join('')}
        </div>`;
    } catch(e) {
      const el = document.getElementById('ranking-content');
      if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c;font-size:13px">Erro ao carregar ranking</div>`;
    }
  }
};
