const academy = {
  _modulos: [],
  _modAtual: null,
  _quizScores: {},

  async render() {
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50">
          <div style="font-size:17px;font-weight:700">🎓 JET Academy</div>
        </div>
        <div style="padding:16px" id="academy-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando trilha...</div>
        </div>
        ${ui.bottomNav("academy")}
      </div>`;
    try {
      const res = await api.get('GET_ACADEMY_TRILHA');
      academy._modulos = res.modulos || [];
      academy._renderTrilha();
    } catch(e) {
      document.getElementById('academy-content').innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c">Erro ao carregar trilha.</div>';
    }
  },

  _renderTrilha() {
    const modulos = academy._modulos;
    const categorias = ['MANUAL APP', 'BASICO', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
    const catNomes = { 'MANUAL APP': 'Manual do App', 'BASICO': 'Técnica de Vendas', 'INTERMEDIARIO': 'Negociação', 'AVANCADO': 'Performance', 'ESPECIALISTA': 'Liderança', 'MASTER': 'Gestão' };
    const catCores = { 'MANUAL APP': '#4f8ef7', 'BASICO': '#f6ad55', 'INTERMEDIARIO': '#68d391', 'AVANCADO': '#63b3ed', 'ESPECIALISTA': '#b794f4', 'MASTER': '#ffd700' };
    
    const total = modulos.length;
    const conc = modulos.filter(m => m.concluido).length;
    const pct = total > 0 ? Math.round(conc/total*100) : 0;

    let html = `
      <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:700">Progresso na Trilha</span>
          <span style="font-size:13px;font-weight:800;color:#63b3ed">${conc}/${total}</span>
        </div>
        <div style="background:#0a0f1e;border-radius:20px;height:8px;overflow:hidden">
          <div style="background:linear-gradient(90deg,#63b3ed,#68d391);height:100%;width:${pct}%;border-radius:20px"></div>
        </div>
      </div>`;

    categorias.forEach(cat => {
      const mods = modulos.filter(m => m.nivel === cat);
      if (!mods.length) return;
      const cor = catCores[cat];
      const concN = mods.filter(m => m.concluido).length;
      const nivelConcluido = concN === mods.length && mods.length > 0;
      
      html += `
        <div style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:3px;height:18px;background:${cor};border-radius:2px"></div>
              <span style="font-size:12px;font-weight:700;color:${cor}">${(catNomes[cat] || cat).toUpperCase()}</span>
            </div>
            ${nivelConcluido ? `<button onclick="academy._verCertificado('${cat}', '${cor}')" style="background:${cor}22;border:1px solid ${cor}44;color:${cor};font-size:9px;font-weight:800;padding:2px 8px;border-radius:6px;cursor:pointer">📜 VER CERTIFICADO</button>` : `<span style="font-size:11px;color:#718096">${concN}/${mods.length}</span>`}
          </div>`;

      mods.forEach(m => {
        const bloq = !m.desbloqueado;
        const icon = m.concluido ? '✅' : (bloq ? '🔒' : '📖');
        const bg = m.concluido ? 'rgba(104,211,145,0.05)' : (bloq ? 'rgba(74,85,104,0.1)' : '#1e2a45');
        html += `
          <div onclick="${bloq ? '' : `academy._abrirModulo('${m.modulo_id}')`}" 
            style="background:${bg};border:1px solid ${m.concluido ? '#68d39144' : '#2a3a55'};border-radius:12px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:${bloq ? 'default' : 'pointer'};opacity:${bloq ? '0.5' : '1'}">
            <div style="font-size:20px">${icon}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${m.titulo}</div>
              <div style="font-size:11px;color:#718096">+${m.pontos} pts${bloq ? ' · Conclua o anterior' : ''}</div>
            </div>
          </div>`;
      });
      html += '</div>';
    });

    document.getElementById('academy-content').innerHTML = html;
  },

  async _abrirModulo(moduloId) {
    document.getElementById('academy-content').innerHTML = '<div style="text-align:center;padding:40px;color:#a0aec0">Carregando conteúdo...</div>';
    try {
      const res = await api.get('GET_ACADEMY_MODULO', { modulo_id: moduloId });
      academy._modAtual = res.modulo;
      academy._renderModulo(res.modulo);
    } catch(e) { ui.toast('Erro ao abrir módulo', 'error'); this._renderTrilha(); }
  },

  _renderModulo(modulo) {
    let html = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <button onclick="academy._renderTrilha()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700">${modulo.titulo}</div>
          <div style="font-size:11px;color:#718096">${modulo.nivel}</div>
        </div>
      </div>`;

    (modulo.blocks || []).forEach((block, idx) => {
      if (block.type === 'welcome_screen') {
        html += `<div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:14px;padding:24px;margin-bottom:12px;text-align:center">
            <div style="font-size:32px;margin-bottom:10px">🎓</div>
            <div style="font-size:18px;font-weight:800;margin-bottom:6px">${block.title}</div>
            <div style="font-size:13px;color:#a0aec0">${block.subtitle}</div>
          </div>`;
      } else if (block.type === 'video_url') {
        const videoId = this._extractVideoId(block.value);
        html += `<div style="margin-bottom:12px;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:16/9">
          <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>`;
      } else if (block.type === 'text_md') {
        const txt = block.value.split('\n').map(ln => {
          if (ln.startsWith('## ')) return `<div style="font-size:15px;font-weight:800;color:#63b3ed;margin:12px 0 6px">${ln.slice(3)}</div>`;
          if (ln.startsWith('### ')) return `<div style="font-size:13px;font-weight:700;color:#f6ad55;margin:8px 0 4px">${ln.slice(4)}</div>`;
          return `<div style="font-size:13px;color:#eaf0fb;margin:4px 0">${ln}</div>`;
        }).join('');
        html += `<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;margin-bottom:12px">${txt}</div>`;
      } else if (block.type === 'choice_simulation') {
        html += `
          <div style="background:#1e2a45;border:1px solid #f6ad55;border-radius:12px;padding:16px;margin-bottom:12px" id="sim${idx}">
            <div style="font-size:11px;font-weight:700;color:#f6ad55;margin-bottom:8px;text-transform:uppercase">Simulação de Diálogo</div>
            <div style="font-size:13px;color:#a0aec0;margin-bottom:8px">${block.scenario}</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:12px">${block.question}</div>
            ${block.options.map((opt, oi) => `
              <button onclick="academy._responderSim(this, ${idx}, ${oi}, ${block.correct_index}, '${block.feedback_correct.replace(/'/g,"\\'")}', '${block.feedback_wrong.replace(/'/g,"\\'")}')"
                style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;color:#eaf0fb;padding:12px;border-radius:10px;font-size:13px;text-align:left;cursor:pointer;margin-bottom:8px">
                ${opt}
              </button>
            `).join('')}
            <div id="fb${idx}" style="display:none;margin-top:10px;padding:12px;border-radius:8px;font-size:13px;line-height:1.4"></div>
          </div>`;
      } else if (block.type === 'quiz') {
        const qid = block.quiz_id;
        const pergs = (modulo.quizzes && modulo.quizzes[qid]) || [];
        html += `<div style="background:#1e2a45;border:1px solid #b794f4;border-radius:12px;padding:16px;margin-bottom:12px">
            <div style="font-size:11px;font-weight:700;color:#b794f4;margin-bottom:12px;text-transform:uppercase">Quiz Final</div>
            ${pergs.map((q, qi) => `
              <div style="margin-bottom:16px">
                <div style="font-size:13px;font-weight:700;margin-bottom:10px">${qi+1}. ${q.pergunta}</div>
                ${['a','b','c','d'].map((letra, li) => q[letra] ? `
                  <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #2a3a55;border-radius:10px;margin-bottom:6px;cursor:pointer">
                    <input type="radio" name="q${qid}_${qi}" value="${letra}" style="accent-color:#b794f4">
                    <span style="font-size:13px">${q[letra]}</span>
                  </label>
                ` : '').join('')}
              </div>
            `).join('')}
            <button onclick="academy._enviarQuiz(this, '${qid}')" style="width:100%;background:#b794f4;color:#fff;border:none;padding:14px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Enviar Respostas</button>
            <div id="qr${qid}" style="display:none;margin-top:12px;padding:12px;border-radius:10px;font-size:13px;text-align:center"></div>
          </div>`;
      }
    });

    html += `
      <button onclick="academy._concluirModulo(this, '${modulo.modulo_id}', ${modulo.pontos})" 
        style="width:100%;background:linear-gradient(135deg,#68d391,#38a169);border:none;color:#fff;padding:16px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:10px">
        ✅ Concluir Módulo
      </button>`;

    document.getElementById('academy-content').innerHTML = html;
    window.scrollTo(0,0);
  },

  _extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  },

  _responderSim(btn, idx, oi, correct, ok, err) {
    const fb = document.getElementById('fb' + idx);
    const acertou = oi === correct;
    fb.style.display = 'block';
    fb.style.background = acertou ? 'rgba(104,211,145,0.1)' : 'rgba(231,76,60,0.1)';
    fb.style.color = acertou ? '#68d391' : '#fc8181';
    fb.innerHTML = `<b>${acertou ? '🎯 EXCELENTE!' : '⚠️ CONSEQUÊNCIA:'}</b><br>${acertou ? ok : err}`;
    btn.parentElement.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
  },

  _enviarQuiz(btn, qid) {
    const pergs = (this._modAtual.quizzes && this._modAtual.quizzes[qid]) || [];
    let acertos = 0;
    pergs.forEach((q, qi) => {
      const sel = document.querySelector(`input[name="q${qid}_${qi}"]:checked`);
      if (sel && sel.value === q.correta) acertos++;
    });
    const score = Math.round((acertos/pergs.length)*100);
    this._quizScores[qid] = score;
    const resEl = document.getElementById('qr' + qid);
    resEl.style.display = 'block';
    resEl.style.background = score >= 70 ? 'rgba(104,211,145,0.1)' : 'rgba(231,76,60,0.1)';
    resEl.style.color = score >= 70 ? '#68d391' : '#fc8181';
    resEl.textContent = (score >= 70 ? '✅ Aprovado! ' : '❌ Tente novamente. ') + `${acertos}/${pergs.length} corretas (${score}%)`;
    btn.disabled = true; btn.style.opacity = '0.5';
  },

  async _concluirModulo(btn, moduloId, pontos) {
    const scores = Object.values(this._quizScores);
    const scoreMin = scores.length > 0 ? Math.min(...scores) : 100;
    if (scoreMin < 70 && scores.length > 0) { alert('Você precisa de 70% de acerto no quiz para concluir.'); return; }
    
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      const res = await api.post({ evento: 'CONCLUIR_MODULO', modulo_id: moduloId, score_quiz: scoreMin, pontos });
      if (res.ok) {
        ui.toast(res.ja_concluido ? 'Módulo já concluído!' : `+${pontos} pontos! Módulo finalizado!`, 'success');
        setTimeout(() => this.render(), 1000);
      } else { alert(res.erro); btn.disabled = false; btn.textContent = '✅ Concluir Módulo'; }
    } catch(e) { ui.toast('Sem conexão', 'error'); btn.disabled = false; }
  },

  _verCertificado(nivel, cor) {
    const p = state.get('promotor');
    const data = new Date().toLocaleDateString('pt-BR');
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#0a0f1e;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:serif;text-align:center;color:#eaf0fb">
        <div style="background:#16213e;border:8px double ${cor};padding:40px 24px;border-radius:4px;width:100%;max-width:400px;position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.5)">
          <div style="font-size:40px;margin-bottom:20px">🎓</div>
          <div style="font-size:12px;letter-spacing:4px;color:${cor};margin-bottom:10px">CERTIFICADO DE EXCELÊNCIA</div>
          <div style="font-size:10px;color:#a0aec0;margin-bottom:30px;font-family:sans-serif">CONCEDIDO PELA JET ACADEMY A:</div>
          <div style="font-size:24px;font-weight:800;margin-bottom:30px;color:#fff">${p.nome_completo || p.nome}</div>
          <div style="font-size:13px;color:#a0aec0;line-height:1.6;margin-bottom:40px;font-family:sans-serif">
            Pela conclusão com êxito de todos os módulos de nível<br>
            <b style="color:#fff;font-size:16px">${nivel}</b>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-family:sans-serif">
            <div style="text-align:left">
              <div style="font-size:9px;color:#718096">DATA DE EMISSÃO</div>
              <div style="font-size:11px;font-weight:700">${data}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:18px;color:${cor}">✨ JET</div>
            </div>
          </div>
        </div>
        <button onclick="academy.render()" style="margin-top:30px;background:transparent;border:1px solid #4a5568;color:#a0aec0;padding:10px 24px;border-radius:10px;font-family:sans-serif;font-weight:700;cursor:pointer">← Voltar para a Trilha</button>
        <div style="margin-top:12px;font-size:11px;color:#4a5568;font-family:sans-serif">Tire um print para compartilhar sua conquista! 📸</div>
      </div>`;
  }
};
