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
      // Tenta carregar do cache primeiro para evitar 0/0
      const cached = localStorage.getItem('academy_trilha');
      if (cached) {
        academy._modulos = JSON.parse(cached);
        academy._renderTrilha();
      }

      const res = await api.get('GET_ACADEMY_TRILHA');
      academy._modulos = res.modulos || [];
      localStorage.setItem('academy_trilha', JSON.stringify(academy._modulos));
      academy._renderTrilha();
    } catch(e) {
      if (!academy._modulos.length) {
        document.getElementById('academy-content').innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c">Erro ao carregar trilha.</div>';
      }
    }
  },

  _renderTrilha() {
    const modulos = academy._modulos;
    const categorias = ['MANUAL APP', 'BASICO', 'INTERMEDIARIO', 'AVANCADO', 'ESPECIALISTA', 'MASTER'];
    const catNomes = { 'MANUAL APP': 'Manual do App', 'BASICO': 'Técnica de Vendas', 'INTERMEDIARIO': 'Negociação', 'AVANCADO': 'Performance', 'ESPECIALISTA': 'Liderança', 'MASTER': 'Gestão Master' };
    const catCores = { 'MANUAL APP': '#4f8ef7', 'BASICO': '#f6ad55', 'INTERMEDIARIO': '#68d391', 'AVANCADO': '#63b3ed', 'ESPECIALISTA': '#b794f4', 'MASTER': '#ffd700' };
    
    const total = modulos.length;
    const conc = modulos.filter(m => m.concluido).length;
    const pct = total > 0 ? Math.round(conc/total*100) : 0;

    let html = `
      <div style="background:linear-gradient(135deg,#1e2a45,#16213e);border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:700">Progresso Geral</span>
          <span style="font-size:13px;font-weight:800;color:#63b3ed">${conc}/${total}</span>
        </div>
        <div style="background:#0a0f1e;border-radius:20px;height:8px;overflow:hidden">
          <div style="background:linear-gradient(90deg,#63b3ed,#68d391);height:100%;width:${pct}%;border-radius:20px;transition:width 0.5s ease"></div>
        </div>
      </div>`;

    categorias.forEach(cat => {
      const mods = modulos.filter(m => m.nivel === cat);
      if (!mods.length) return;
      const cor = catCores[cat];
      const concN = mods.filter(m => m.concluido).length;
      const nivelConcluido = concN === mods.length && mods.length > 0;
      
      html += `
        <div style="margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:4px;height:20px;background:${cor};border-radius:2px"></div>
              <span style="font-size:13px;font-weight:800;color:${cor};letter-spacing:0.5px">${(catNomes[cat] || cat).toUpperCase()}</span>
            </div>
            ${nivelConcluido ? `<button onclick="academy._verCertificado('${cat}', '${cor}')" style="background:${cor}22;border:1px solid ${cor}44;color:${cor};font-size:10px;font-weight:800;padding:4px 10px;border-radius:8px;cursor:pointer">📜 CERTIFICADO</button>` : `<span style="font-size:11px;color:#718096;font-weight:600">${concN}/${mods.length} concluídos</span>`}
          </div>`;

      mods.forEach(m => {
        const bloq = !m.desbloqueado;
        const icon = m.concluido ? '✅' : (bloq ? '🔒' : '🚀');
        const bg = m.concluido ? 'rgba(104,211,145,0.05)' : (bloq ? 'rgba(74,85,104,0.1)' : '#1e2a45');
        html += `
          <div onclick="${bloq ? '' : `academy._abrirModulo('${m.modulo_id}')`}" 
            style="background:${bg};border:1px solid ${m.concluido ? '#68d39144' : (bloq ? '#2a3a5544' : '#2a3a55')};border-radius:14px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;cursor:${bloq ? 'default' : 'pointer'};opacity:${bloq ? '0.5' : '1'};transition:transform 0.2s ease"
            onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
            <div style="font-size:22px;filter:${bloq ? 'grayscale(1)' : 'none'}">${icon}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700;color:${m.concluido ? '#68d391' : '#eaf0fb'}">${m.titulo}</div>
              <div style="font-size:11px;color:#718096;margin-top:2px;font-weight:500">+${m.pontos} pontos${bloq ? ' · Conclua o anterior' : ''}</div>
            </div>
            ${!bloq && !m.concluido ? `<div style="font-size:18px;color:#718096">›</div>` : ''}
          </div>`;
      });
      html += '</div>';
    });

    document.getElementById('academy-content').innerHTML = html;
    window.scrollTo(0,0);
  },

  async _abrirModulo(moduloId) {
    document.getElementById('academy-content').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:100px 0;gap:16px">
        <div class="spinner" style="width:30px;height:30px;border:3px solid #2a3a55;border-top-color:#63b3ed;border-radius:50%;animation:spin 1s linear infinite"></div>
        <div style="font-size:13px;color:#718096;font-weight:600">Preparando treinamento...</div>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>`;
    try {
      const res = await api.get('GET_ACADEMY_MODULO', { modulo_id: moduloId });
      academy._modAtual = res.modulo;
      academy._renderModulo(res.modulo);
    } catch(e) { ui.toast('Erro ao abrir módulo', 'error'); this._renderTrilha(); }
  },

  _renderModulo(modulo) {
    let html = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button onclick="academy._renderTrilha()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800">${modulo.titulo}</div>
          <div style="font-size:11px;color:#718096;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${modulo.nivel}</div>
        </div>
      </div>`;

    (modulo.blocks || []).forEach((block, idx) => {
      if (block.type === 'welcome_screen') {
        html += `
          <div style="background:linear-gradient(135deg,#2c5282,#1a365d);border:1px solid #4299e144;border-radius:16px;padding:32px 20px;margin-bottom:16px;text-align:center;box-shadow:0 10px 20px rgba(0,0,0,0.2)">
            <div style="font-size:40px;margin-bottom:12px">🚀</div>
            <div style="font-size:20px;font-weight:800;margin-bottom:8px;color:#fff">${block.title}</div>
            <div style="font-size:13px;color:#bee3f8;line-height:1.5">${block.subtitle}</div>
          </div>`;
      } else if (block.type === 'text_md') {
        const txt = block.value.split('\n').map(ln => {
          if (ln.startsWith('## ')) return `<div style="font-size:16px;font-weight:800;color:#63b3ed;margin:20px 0 8px">${ln.slice(3)}</div>`;
          if (ln.startsWith('### ')) return `<div style="font-size:14px;font-weight:700;color:#f6ad55;margin:14px 0 6px">${ln.slice(4)}</div>`;
          if (ln.startsWith('> ')) return `<div style="background:#0a0f1e;border-left:4px solid #f6ad55;padding:12px;border-radius:4px;font-size:13px;font-style:italic;color:#f6ad55;margin:12px 0">${ln.slice(2)}</div>`;
          return `<div style="font-size:14px;color:#eaf0fb;line-height:1.6;margin:6px 0">${ln}</div>`;
        }).join('');
        html += `<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">${txt}</div>`;
      } else if (block.type === 'choice_simulation') {
        html += `
          <div style="background:#1e2a45;border:1px solid #f6ad55;border-radius:16px;padding:20px;margin-bottom:16px" id="sim${idx}">
            <div style="font-size:11px;font-weight:800;color:#f6ad55;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Simulação Prática</div>
            <div style="background:#0a0f1e;padding:12px;border-radius:8px;font-size:13px;color:#a0aec0;margin-bottom:12px;border-left:4px solid #f6ad55">${block.scenario}</div>
            <div style="font-size:15px;font-weight:800;margin-bottom:16px;color:#fff">${block.question}</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${block.options.map((opt, oi) => `
                <button onclick="academy._responderSim(this, ${idx}, ${oi}, ${block.correct_index}, '${block.feedback_correct.replace(/'/g,"\\'")}', '${block.feedback_wrong.replace(/'/g,"\\'")}')"
                  style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;color:#eaf0fb;padding:14px;border-radius:12px;font-size:13px;text-align:left;cursor:pointer;font-weight:600;transition:all 0.2s ease">
                  ${opt}
                </button>
              `).join('')}
            </div>
            <div id="fb${idx}" style="display:none;margin-top:16px;padding:14px;border-radius:10px;font-size:13px;line-height:1.5;animation:fadeIn 0.3s ease"></div>
          </div>`;
      } else if (block.type === 'quiz') {
        const qid = block.quiz_id;
        const pergs = (modulo.quizzes && modulo.quizzes[qid]) || [];
        html += `
          <div style="background:#1e2a45;border:1px solid #b794f4;border-radius:16px;padding:20px;margin-bottom:16px" id="quiz_container_${qid}">
            <div style="font-size:11px;font-weight:800;color:#b794f4;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px">Desafio de Conhecimento</div>
            ${pergs.map((q, qi) => `
              <div style="margin-bottom:20px">
                <div style="font-size:14px;font-weight:700;margin-bottom:12px;color:#fff">${qi+1}. ${q.pergunta}</div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${['a','b','c','d'].map((letra, li) => q[letra] ? `
                    <label style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #2a3a55;border-radius:12px;cursor:pointer;transition:background 0.2s ease" onchange="this.style.background='rgba(183,148,244,0.05)'">
                      <input type="radio" name="q${qid}_${qi}" value="${letra}" style="width:18px;height:18px;accent-color:#b794f4">
                      <span style="font-size:13px;font-weight:500">${q[letra]}</span>
                    </label>
                  ` : '').join('')}
                </div>
              </div>
            `).join('')}
            <button onclick="academy._enviarQuiz(this, '${qid}')" style="width:100%;background:#b794f4;color:#fff;border:none;padding:16px;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 4px 15px rgba(183,148,244,0.3)">Enviar Respostas</button>
            <div id="qr${qid}" style="display:none;margin-top:16px;padding:14px;border-radius:12px;font-size:14px;text-align:center;font-weight:700"></div>
          </div>`;
      }
    });

    html += `
      <div id="btn-concluir-container" style="margin-top:20px">
        <button onclick="academy._concluirModulo(this, '${modulo.modulo_id}', ${modulo.pontos})" 
          style="width:100%;background:linear-gradient(135deg,#68d391,#38a169);border:none;color:#fff;padding:18px;border-radius:16px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 10px 20px rgba(56,161,105,0.2)">
          ✅ Finalizar Treinamento
        </button>
      </div>`;

    document.getElementById('academy-content').innerHTML = html;
    window.scrollTo(0,0);
  },

  _responderSim(btn, idx, oi, correct, ok, err) {
    const fb = document.getElementById('fb' + idx);
    const acertou = oi === correct;
    fb.style.display = 'block';
    fb.style.background = acertou ? 'rgba(104,211,145,0.1)' : 'rgba(231,76,60,0.1)';
    fb.style.border = `1px solid ${acertou ? '#68d39144' : '#fc818144'}`;
    fb.style.color = acertou ? '#68d391' : '#fc8181';
    fb.innerHTML = `<b>${acertou ? '🎯 EXCELENTE ESCOLHA!' : '⚠️ CONSEQUÊNCIA NO CAMPO:'}</b><br>${acertou ? ok : err}`;
    
    const buttons = btn.parentElement.querySelectorAll('button');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === oi) {
        b.style.border = `2px solid ${acertou ? '#68d391' : '#fc8181'}`;
        b.style.background = acertou ? 'rgba(104,211,145,0.05)' : 'rgba(231,76,60,0.05)';
      } else {
        b.style.opacity = '0.3';
      }
    });
  },

  _enviarQuiz(btn, qid) {
    const pergs = (this._modAtual.quizzes && this._modAtual.quizzes[qid]) || [];
    let acertos = 0;
    let todasRespondidas = true;

    pergs.forEach((q, qi) => {
      const sel = document.querySelector(`input[name="q${qid}_${qi}"]:checked`);
      if (!sel) todasRespondidas = false;
      if (sel && sel.value === q.correta) acertos++;
    });

    if (!todasRespondidas) { ui.toast('Responda todas as perguntas!', 'warning'); return; }

    const score = Math.round((acertos/pergs.length)*100);
    this._quizScores[qid] = score;
    const resEl = document.getElementById('qr' + qid);
    resEl.style.display = 'block';
    resEl.style.background = score >= 70 ? 'rgba(104,211,145,0.1)' : 'rgba(231,76,60,0.1)';
    resEl.style.color = score >= 70 ? '#68d391' : '#fc8181';
    resEl.innerHTML = (score >= 70 ? '✅ APROVADO! ' : '❌ REPROVADO. ') + `<br><span style="font-size:12px;font-weight:500">Você acertou ${acertos} de ${pergs.length} (${score}%)</span>`;
    
    if (score < 70) {
      setTimeout(() => {
        resEl.style.display = 'none';
        document.querySelectorAll(`input[name^="q${qid}_"]`).forEach(i => i.checked = false);
        ui.toast('Tente novamente para atingir 70%', 'info');
      }, 3000);
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.textContent = 'Desafio Concluído';
      document.querySelectorAll(`input[name^="q${qid}_"]`).forEach(i => i.disabled = true);
    }
  },

  async _concluirModulo(btn, moduloId, pontos) {
    const scores = Object.values(this._quizScores);
    const scoreMin = scores.length > 0 ? Math.min(...scores) : 100;
    
    const quizzesCount = (this._modAtual.blocks || []).filter(b => b.type === 'quiz').length;
    if (scores.length < quizzesCount) { ui.toast('Conclua o desafio antes!', 'warning'); return; }
    if (scoreMin < 70 && scores.length > 0) { ui.toast('Atinga pelo menos 70% no quiz', 'warning'); return; }
    
    btn.disabled = true; btn.textContent = 'Sincronizando...';
    try {
      const res = await api.post({ evento: 'CONCLUIR_MODULO', modulo_id: moduloId, score_quiz: scoreMin, pontos });
      if (res.ok) {
        ui.toast(res.ja_concluido ? 'Módulo já concluído!' : `🎊 Parabéns! +${pontos} pontos!`, 'success');
        setTimeout(() => this.render(), 1500);
      } else { ui.toast(res.erro, 'error'); btn.disabled = false; btn.textContent = '✅ Finalizar Treinamento'; }
    } catch(e) { ui.toast('Sem conexão', 'error'); btn.disabled = false; }
  },

  _verCertificado(nivel, cor) {
    const p = state.get('promotor');
    const data = new Date().toLocaleDateString('pt-BR');
    document.getElementById('app').innerHTML = `
      <div style="min-height:100dvh;background:#0a0f1e;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:serif;text-align:center;color:#eaf0fb">
        <div style="background:#16213e;border:8px double ${cor};padding:40px 24px;border-radius:4px;width:100%;max-width:400px;position:relative;box-shadow:0 20px 50px rgba(0,0,0,0.5)">
          <div style="font-size:48px;margin-bottom:20px">🏆</div>
          <div style="font-size:12px;letter-spacing:4px;color:${cor};margin-bottom:10px;font-weight:700">CERTIFICADO DE PROFICIÊNCIA</div>
          <div style="font-size:10px;color:#a0aec0;margin-bottom:30px;font-family:sans-serif;letter-spacing:1px">CONCEDIDO PELA JET ACADEMY A:</div>
          <div style="font-size:26px;font-weight:900;margin-bottom:30px;color:#fff;text-transform:uppercase">${p.nome_completo || p.nome}</div>
          <div style="font-size:13px;color:#a0aec0;line-height:1.6;margin-bottom:40px;font-family:sans-serif">
            Pela excelência demonstrada e conclusão de todos os módulos de nível<br>
            <b style="color:${cor};font-size:18px">${nivel}</b>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-family:sans-serif">
            <div style="text-align:left">
              <div style="font-size:9px;color:#718096">DATA DE EMISSÃO</div>
              <div style="font-size:12px;font-weight:800;color:#fff">${data}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:22px;color:${cor};font-weight:900">✨ JET</div>
            </div>
          </div>
          <div style="position:absolute;bottom:-15px;right:-15px;width:60px;height:60px;background:${cor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 5px 15px ${cor}44">🎗️</div>
        </div>
        <button onclick="academy.render()" style="margin-top:40px;background:#1e2a45;border:1px solid #2a3a55;color:#fff;padding:14px 32px;border-radius:12px;font-family:sans-serif;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.2)">← Voltar para a Trilha</button>
        <div style="margin-top:16px;font-size:12px;color:#718096;font-family:sans-serif;font-weight:500">Tire um print para compartilhar sua conquista! 📸</div>
      </div>`;
  }
};
