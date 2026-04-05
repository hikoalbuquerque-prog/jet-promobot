const ranking = {
  _BADGES_DEF: [
    { id: 'JORNADAS', label: 'Jornadas', icon: '💪' },
    { id: 'STREAK', label: 'Streak', icon: '🔥' },
    { id: 'TOP3_MES', label: 'Top 3', icon: '🦸' },
    { id: 'PONTUAL', label: 'Pontualidade', icon: '🎯' },
    { id: 'SEM_CANCELAMENTO_MES', label: 'Mês Perfeito', icon: '🏆' },
    { id: 'MADRUGADOR', label: 'Madrugador', icon: '🚀' },
    { id: 'ACADEMY', label: 'Academy', icon: '🎓' },
    { id: 'INDICACAO', label: 'Indicações', icon: '🤝' },
  ],

  _periodo: 'SEMANAL',
  _aba: 'RANKING', // RANKING | CONQUISTAS | EXTRATO

  async render() {
    document.getElementById('app').innerHTML = `
      <div style="height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:12px">
            <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
            <div style="font-size:17px;font-weight:700">🏆 Meu Score</div>
          </div>
          <div id="streak-top" style="background:rgba(255,107,107,0.1);color:#ff6b6b;font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;display:none">🔥 0 DIAS</div>
        </div>

        <div style="background:#16213e;padding:10px 16px;display:flex;gap:10px;border-bottom:1px solid #2a3a55">
           <button onclick="ranking._setAba('RANKING')" class="tab-btn \${this._aba==='RANKING'?'active':''}" style="flex:1">RANKING</button>
           <button onclick="ranking._setAba('CONQUISTAS')" class="tab-btn \${this._aba==='CONQUISTAS'?'active':''}" style="flex:1">CONQUISTAS</button>
           <button onclick="ranking._setAba('EXTRATO')" class="tab-btn \${this._aba==='EXTRATO'?'active':''}" style="flex:1">EXTRATO</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:100px" id="ranking-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando...</div>
        </div>
        ${ui.bottomNav("ranking")}
      </div>
      <style>
        .tab-btn { background:none;border:none;color:#718096;font-size:11px;font-weight:700;padding:8px;border-radius:8px;cursor:pointer;transition:all 0.2s; }
        .tab-btn.active { background:#1e2a45;color:#4f8ef7; }
        .extrato-item { display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid rgba(255,255,255,0.05); }
      </style>`;
    this._load();
  },

  _setAba(a) { this._aba = a; this.render(); },

  async _load() {
    const el = document.getElementById('ranking-content');
    if (!el) return;
    try {
      const eu = state.get('promotor');
      
      if (this._aba === 'EXTRATO') {
        const res = await api.get('GET_EXTRATO_SCORE');
        this._renderExtrato(res.extrato || []);
        return;
      }

      const [rankRes, badgeRes] = await Promise.all([
        api.get('GET_RANKING_SEMANAL', { periodo: this._periodo }),
        api.get('GET_BADGES')
      ]);

      const badges = badgeRes && badgeRes.badges || [];
      const score = eu ? (eu.score_operacional || 0) : 0;
      const streak = eu ? (eu.streak_dias || 0) : 0;
      const meuRank = rankRes.meuNacional || { posicao: '-', pontos: 0 };

      const stTop = document.getElementById('streak-top');
      if (stTop && streak > 0) { stTop.textContent = `🔥 ${streak} DIAS`; stTop.style.display = 'block'; }

      if (this._aba === 'CONQUISTAS') {
        this._renderConquistas(badges);
        return;
      }

      // ABA RANKING (Padrão)
      let html = `
        <div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:16px;padding:20px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
            <div style="background:rgba(246,173,85,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#f6ad55">${score}</div>
              <div style="font-size:9px;color:#a0aec0">TOTAL</div>
            </div>
            <div style="background:rgba(104,211,145,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#68d391">+${meuRank.pontos}</div>
              <div style="font-size:9px;color:#a0aec0">${this._periodo}</div>
            </div>
            <div style="background:rgba(99,179,237,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#63b3ed">${meuRank.posicao}º</div>
              <div style="font-size:9px;color:#a0aec0">POSIÇÃO</div>
            </div>
          </div>
        </div>

        ${rankRes.minhaEquipeRanking ? `
        <div style="background:rgba(79,142,247,0.1);border:1px solid #4f8ef7;border-radius:12px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;color:#718096;font-weight:700">MINHA EQUIPE</div>
            <div style="font-size:14px;font-weight:700">${rankRes.minhaEquipeRanking.nome || 'Equipe'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:800;color:#4f8ef7">${rankRes.minhaEquipeRanking.posicao}º</div>
            <div style="font-size:10px;color:#718096">${rankRes.minhaEquipeRanking.pontos} pts</div>
          </div>
        </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-bottom:16px">
          ${['SEMANAL', 'MENSAL', 'GERAL'].map(p => `
            <button onclick="ranking._setPeriodo('${p}')" style="flex:1;background:${this._periodo === p ? '#4f8ef7' : '#1e2a45'};color:${this._periodo === p ? '#fff' : '#a0aec0'};border:1px solid ${this._periodo === p ? '#4f8ef7' : '#2a3a55'};border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">${p}</button>
          `).join('')}
        </div>

        <div style="background:#16213e;border-radius:12px;padding:4px;display:flex;margin-bottom:12px">
          <button id="tab-rank-nac" onclick="ranking._switchRank('nacional')" style="flex:1;background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">Individual</button>
          <button id="tab-rank-reg" onclick="ranking._switchRank('regional')" style="flex:1;background:transparent;color:#a0aec0;border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">Equipes</button>
        </div>

        <div id="rank-list-nacional">${this._renderLista(rankRes.nacional, eu)}</div>
        <div id="rank-list-regional" style="display:none">${this._renderListaEquipes(rankRes.equipes, rankRes.minhaEquipeRanking?.equipe_id)}</div>
      `;
      el.innerHTML = html;
    } catch(e) { el.innerHTML = `<div style="text-align:center;padding:40px;color:#fc8181">Erro ao carregar dados.</div>`; }
  },

  _renderConquistas(badges) {
    const el = document.getElementById('ranking-content');
    el.innerHTML = `
      <div style="font-size:11px;color:#a0aec0;font-weight:700;margin-bottom:10px">MINHAS CONQUISTAS</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">
        \${this._BADGES_DEF.map(def => {
          const conquistasDef = badges.filter(b => b.tipo && b.tipo.startsWith(def.id));
          const nivelAtingido = conquistasDef.length;
          const ultimaConquista = nivelAtingido > 0 ? conquistasDef[nivelAtingido-1] : null;
          const opacity = nivelAtingido > 0 ? 1 : 0.3;
          return \`
            <div style="background:#1e2a45;border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px;opacity:\${opacity}">
              <div style="font-size:30px">\${def.icon}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700">\${def.label}</div>
                <div style="font-size:11px;color:#718096">\${ultimaConquista ? ultimaConquista.descricao : 'Ainda não conquistado'}</div>
              </div>
              \${nivelAtingido > 0 ? \`<div style="background:rgba(104,211,145,0.15);color:#68d391;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px">NÍVEL \${nivelAtingido}</div>\` : ''}
            </div>\`;
        }).join('')}
      </div>
    `;
  },

  _renderExtrato(extrato) {
    const el = document.getElementById('ranking-content');
    if (!extrato.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px;color:#a0aec0">Nenhum registro de score encontrado.</div>`;
      return;
    }
    el.innerHTML = `
      <div style="font-size:11px;color:#a0aec0;font-weight:700;margin-bottom:10px">HISTÓRICO RECENTE</div>
      <div style="background:#16213e;border-radius:16px;overflow:hidden">
        \${extrato.map(it => \`
          <div class="extrato-item">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:#fff">\${it.descricao || it.tipo}</div>
              <div style="font-size:10px;color:#718096">\${new Date(it.criado_em).toLocaleDateString('pt-BR')} • \${new Date(it.criado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
            <div style="font-size:15px;font-weight:800;color:\${it.pontos >= 0 ? '#68d391' : '#fc8181'}">
              \${it.pontos >= 0 ? '+' : ''}\${it.pontos}
            </div>
          </div>
        \`).join('')}
      </div>
    `;
  },

  _setPeriodo(p) { this._periodo = p; this._load(); },
  _renderLista(lista, eu) {
    if (!lista || !lista.length) return '<div style="text-align:center;padding:20px;color:#4a5568">Nenhum dado</div>';
    let html = '';
    lista.forEach((p, i) => {
      const isMe = eu && p.user_id === eu.user_id;
      html += `<div style="background:${isMe?'rgba(79,142,247,0.1)':'#1e2a45'};border:1px solid ${isMe?'#4f8ef7':'#2a3a55'};border-radius:12px;padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:10px"><div style="font-size:18px;width:28px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'º'}</div><div style="flex:1"><div style="font-size:13px;font-weight:700">${p.nome}</div><div style="font-size:10px;color:#718096">${p.cidade}</div></div><div style="font-size:16px;font-weight:800;color:#4f8ef7">${p.pontos}</div></div>`;
    });
    return html;
  },
  _renderListaEquipes(lista, minhaEqId) {
    if (!lista || !lista.length) return '<div style="text-align:center;padding:20px;color:#4a5568">Nenhum dado de equipe</div>';
    let html = '';
    lista.forEach((p, i) => {
      const isMe = minhaEqId === p.equipe_id;
      html += `<div style="background:${isMe?'rgba(79,142,247,0.1)':'#1e2a45'};border:1px solid ${isMe?'#4f8ef7':'#2a3a55'};border-radius:12px;padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:10px"><div style="font-size:18px;width:28px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'º'}</div><div style="flex:1"><div style="font-size:13px;font-weight:700">${p.nome}</div><div style="font-size:10px;color:#718096">${p.cidade}</div></div><div style="font-size:16px;font-weight:800;color:#4f8ef7">${p.pontos}</div></div>`;
    });
    return html;
  },
  _switchRank(tipo) {
    const nac = document.getElementById('rank-list-nacional'), reg = document.getElementById('rank-list-regional');
    const bN = document.getElementById('tab-rank-nac'), bR = document.getElementById('tab-rank-reg');
    if (!nac || !reg) return;
    if (tipo === 'nacional') { nac.style.display='block'; reg.style.display='none'; bN.style.background='#4f8ef7'; bR.style.background='none'; bN.style.color='#fff'; bR.style.color='#a0aec0'; }
    else { nac.style.display='none'; reg.style.display='block'; bR.style.background='#4f8ef7'; bN.style.background='none'; bR.style.color='#fff'; bN.style.color='#a0aec0'; }
  }
};
