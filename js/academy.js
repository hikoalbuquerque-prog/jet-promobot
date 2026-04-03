const academy = {
  _modulos: [],
  _modAtual: null,
  _quizScores: {},

  async render() {
    document.getElementById('app').innerHTML =
      '<div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">'
      + '<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50">'
      + '<div style="font-size:17px;font-weight:700">&#127891; JET Academy</div>'
      + '</div>'
      + '<div style="padding:16px" id="academy-content">'
      + '<div style="text-align:center;padding:40px;color:#a0aec0">Carregando trilha...</div>'
      + '</div>'
      + ui.bottomNav("academy")
      + '</div>';
    try {
      var res = await api.get('GET_ACADEMY_TRILHA');
      academy._modulos = res.modulos || [];
      academy._renderTrilha();
    } catch(e) {
      document.getElementById('academy-content').innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c">Erro ao carregar</div>';
    }
  },

  _renderTrilha() {
    var modulos = academy._modulos;
    var nivelNomes = { BASICO: 'Basico', INTERMEDIARIO: 'Intermediario', AVANCADO: 'Avancado', ESPECIALISTA: 'Especialista', MASTER: 'Master' };
    var nivelCores = { BASICO: '#63b3ed', INTERMEDIARIO: '#f6ad55', AVANCADO: '#68d391', ESPECIALISTA: '#b794f4', MASTER: '#ffd700' };
    var total = modulos.length;
    var conc = modulos.filter(function(m){ return m.concluido; }).length;
    var pct = total > 0 ? Math.round(conc/total*100) : 0;

    var html =
      '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px;margin-bottom:16px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:8px">'
      + '<span style="font-size:13px;font-weight:700">Progresso geral</span>'
      + '<span style="font-size:13px;font-weight:800;color:#63b3ed">' + conc + '/' + total + '</span>'
      + '</div>'
      + '<div style="background:#0a0f1e;border-radius:20px;height:8px;overflow:hidden">'
      + '<div style="background:linear-gradient(90deg,#63b3ed,#68d391);height:100%;width:' + pct + '%;border-radius:20px"></div>'
      + '</div></div>';

    ['BASICO','INTERMEDIARIO','AVANCADO','ESPECIALISTA','MASTER'].forEach(function(nivel) {
      var mods = modulos.filter(function(m){ return m.nivel === nivel; });
      if (!mods.length) return;
      var cor = nivelCores[nivel];
      var concN = mods.filter(function(m){ return m.concluido; }).length;
      html += '<div style="margin-bottom:20px">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
        + '<div style="width:3px;height:20px;background:' + cor + ';border-radius:2px"></div>'
        + '<span style="font-size:12px;font-weight:700;color:' + cor + '">' + nivelNomes[nivel].toUpperCase() + '</span>'
        + '<span style="font-size:11px;color:#718096">' + concN + '/' + mods.length + '</span>'
        + '</div>';

      mods.forEach(function(m) {
        var bloq = !m.desbloqueado;
        var icon = m.concluido ? '\u2705' : bloq ? '\uD83D\uDD12' : '\uD83D\uDCD6';
        var bg   = m.concluido ? 'rgba(104,211,145,0.1)' : bloq ? 'rgba(74,85,104,0.2)' : '#1e2a45';
        var brd  = m.concluido ? 'rgba(104,211,145,0.3)' : '#2a3a55';
        var click = bloq ? '' : 'academy._abrirModulo(this.dataset.id)';
        html += '<div data-id="' + m.modulo_id + '" onclick="' + click + '"'
          + ' style="background:' + bg + ';border:1px solid ' + brd + ';border-radius:12px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:' + (bloq?'default':'pointer') + ';opacity:' + (bloq?'0.5':'1') + '">'
          + '<div style="font-size:22px">' + icon + '</div>'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + m.titulo + '</div>'
          + '<div style="font-size:11px;color:#718096">+' + m.pontos + ' pts' + (bloq ? ' · Conclua o anterior' : '') + '</div></div>'
          + (m.concluido ? '<div style="font-size:10px;font-weight:700;color:#68d391;background:rgba(104,211,145,0.15);padding:2px 8px;border-radius:10px">FEITO</div>' : '')
          + '</div>';
      });
      html += '</div>';
    });

    document.getElementById('academy-content').innerHTML = html;
  },

  _abrirModulo(moduloId) {
    document.getElementById('academy-content').innerHTML = '<div style="text-align:center;padding:40px;color:#a0aec0">Carregando...</div>';
    api.get('GET_ACADEMY_MODULO', { modulo_id: moduloId }).then(function(res) {
      academy._modAtual = res.modulo;
      academy._renderModulo(res.modulo);
    }).catch(function() {
      document.getElementById('academy-content').innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c">Erro</div>';
    });
  },

  _renderModulo(modulo) {
    var html =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'
      + '<button onclick="academy._renderTrilha()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">&#8249;</button>'
      + '<div style="flex:1"><div style="font-size:16px;font-weight:700">' + modulo.titulo + '</div>'
      + '<div style="font-size:11px;color:#718096">+' + modulo.pontos + ' pts ao concluir</div></div>'
      + '</div>';

    (modulo.blocks || []).forEach(function(block, idx) {
      if (block.type === 'welcome_screen') {
        html += '<div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:14px;padding:20px;margin-bottom:10px;text-align:center">'
          + '<div style="font-size:28px;margin-bottom:8px">\u{1F393}</div>'
          + '<div style="font-size:16px;font-weight:800;margin-bottom:6px">' + (block.title||'') + '</div>'
          + '<div style="font-size:13px;color:#a0aec0">' + (block.subtitle||'') + '</div>'
          + '</div>';

      } else if (block.type === 'text_md') {
        var lines = String(block.value||'').split('\n');
        var txt = lines.map(function(ln) {
          if (ln.indexOf('## ') === 0) return '<div style="font-size:15px;font-weight:800;color:#63b3ed;margin:12px 0 6px">' + ln.slice(3) + '</div>';
          if (ln.indexOf('### ') === 0) return '<div style="font-size:13px;font-weight:700;color:#f6ad55;margin:8px 0 4px">' + ln.slice(4) + '</div>';
          if (ln.indexOf('- ') === 0) return '<div style="padding:3px 0 3px 10px;border-left:2px solid #2a3a55;color:#a0aec0;font-size:13px;margin:2px 0">' + ln.slice(2) + '</div>';
          if (ln.trim()) return '<div style="font-size:13px;color:#eaf0fb;margin:2px 0">' + ln + '</div>';
          return '';
        }).join('');
        html += '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:14px;margin-bottom:10px">' + txt + '</div>';

      } else if (block.type === 'script_copy') {
        html += '<div style="background:rgba(99,179,237,0.08);border:1px solid rgba(99,179,237,0.2);border-radius:12px;padding:14px;margin-bottom:10px">'
          + '<div style="font-size:11px;font-weight:700;color:#63b3ed;margin-bottom:6px">' + (block.label||'SCRIPT') + '</div>'
          + '<div style="font-size:13px;color:#eaf0fb;font-style:italic;margin-bottom:8px">' + (block.value||'') + '</div>'
          + '<button class="btn-copy" style="background:rgba(99,179,237,0.15);border:1px solid rgba(99,179,237,0.3);color:#63b3ed;padding:4px 12px;border-radius:6px;font-size:11px;cursor:pointer" onclick="academy._copiar(this.previousElementSibling.textContent)">Copiar</button>'
          + ' style="background:rgba(99,179,237,0.15);border:1px solid rgba(99,179,237,0.3);color:#63b3ed;padding:4px 12px;border-radius:6px;font-size:11px;cursor:pointer">Copiar</button>'
          + '</div>';

      } else if (block.type === 'choice_simulation') {
        html += '<div style="background:#1e2a45;border:1px solid #f6ad55;border-radius:12px;padding:14px;margin-bottom:10px" id="sim' + idx + '">'
          + '<div style="font-size:11px;font-weight:700;color:#f6ad55;margin-bottom:8px">SIMULACAO</div>'
          + '<div style="font-size:13px;color:#a0aec0;margin-bottom:6px">' + (block.scenario||'') + '</div>'
          + '<div style="font-size:14px;font-weight:700;margin-bottom:10px">' + (block.question||'') + '</div>';
        (block.options||[]).forEach(function(opt, oi) {
          html += '<button data-sim="' + idx + '" data-oi="' + oi + '" data-correct="' + block.correct_index + '"'
            + ' data-ok="' + (block.feedback_correct||'').replace(/"/g,'&quot;') + '"'
            + ' data-err="' + (block.feedback_wrong||'').replace(/"/g,'&quot;') + '"'
            + ' onclick="academy._responderSim(this)"'
            + ' style="width:100%;background:#0a0f1e;border:1px solid #2a3a55;color:#eaf0fb;padding:10px 12px;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;margin-bottom:6px">'
            + opt + '</button>';
        });
        html += '<div id="fb' + idx + '" style="display:none;margin-top:8px;padding:8px;border-radius:8px;font-size:12px"></div></div>';

      } else if (block.type === 'quiz') {
        var qid = block.quiz_id;
        var pergs = (modulo.quizzes && modulo.quizzes[qid]) || [];
        html += '<div style="background:#1e2a45;border:1px solid #b794f4;border-radius:12px;padding:14px;margin-bottom:10px" id="quiz' + qid + '">'
          + '<div style="font-size:11px;font-weight:700;color:#b794f4;margin-bottom:12px">QUIZ — ' + pergs.length + ' questoes</div>';
        pergs.forEach(function(q, qi) {
          html += '<div style="margin-bottom:14px">'
            + '<div style="font-size:13px;font-weight:700;margin-bottom:8px">' + (qi+1) + '. ' + q.pergunta + '</div>';
          q.opcoes.forEach(function(opt, oi) {
            var letra = ['a','b','c','d'][oi];
            html += '<label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #2a3a55;border-radius:8px;margin-bottom:4px;cursor:pointer">'
              + '<input type="radio" name="q' + qid + '_' + qi + '" value="' + letra + '" style="accent-color:#b794f4">'
              + '<span style="font-size:13px">' + opt + '</span></label>';
          });
          html += '</div>';
        });
        html += '<button data-qid="' + qid + '" onclick="academy._enviarQuiz(this)"'
          + ' style="width:100%;background:#b794f4;border:none;color:#fff;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">Enviar Quiz</button>'
          + '<div id="qr' + qid + '" style="display:none;margin-top:10px;padding:10px;border-radius:8px;font-size:13px;text-align:center"></div>'
          + '</div>';
      }
    });

    html += '<button data-id="' + modulo.modulo_id + '" data-pts="' + modulo.pontos + '" onclick="academy._concluirModulo(this)"'
      + ' style="width:100%;background:linear-gradient(135deg,#68d391,#38a169);border:none;color:#fff;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px">'
      + '\u2705 Concluir Modulo</button>';

    document.getElementById('academy-content').innerHTML = html;
  },

  _copiar(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
  },
  _responderSim(btn) {
    var idx     = btn.dataset.sim;
    var oi      = parseInt(btn.dataset.oi);
    var correct = parseInt(btn.dataset.correct);
    var acertou = oi === correct;
    var fb = document.getElementById('fb' + idx);
    if (fb) {
      fb.style.display = 'block';
      fb.style.background = acertou ? 'rgba(104,211,145,0.15)' : 'rgba(252,129,129,0.15)';
      fb.style.color = acertou ? '#68d391' : '#fc8181';
      fb.textContent = (acertou ? '\u2705 ' : '\u274C ') + (acertou ? btn.dataset.ok : btn.dataset.err);
    }
    var sim = document.getElementById('sim' + idx);
    if (sim) sim.querySelectorAll('button').forEach(function(b){ b.disabled = true; b.style.opacity = '0.6'; });
  },

  _enviarQuiz(btn) {
    var qid  = btn.dataset.qid;
    var modulo = academy._modAtual;
    var pergs = (modulo && modulo.quizzes && modulo.quizzes[qid]) || [];
    var acertos = 0;
    pergs.forEach(function(q, qi) {
      var sel = document.querySelector('input[name="q' + qid + '_' + qi + '"]:checked');
      if (sel && sel.value === q.correta) acertos++;
    });
    var score = pergs.length > 0 ? Math.round(acertos/pergs.length*100) : 0;
    academy._quizScores[qid] = score;
    var res = document.getElementById('qr' + qid);
    if (res) {
      res.style.display = 'block';
      res.style.background = score >= 70 ? 'rgba(104,211,145,0.15)' : 'rgba(252,129,129,0.15)';
      res.style.color = score >= 70 ? '#68d391' : '#fc8181';
      res.textContent = (score >= 70 ? '\u2705 ' : '\u274C ') + acertos + '/' + pergs.length + ' corretas — ' + score + '%';
    }
    btn.disabled = true;
    btn.style.opacity = '0.6';
  },

  _concluirModulo(btn) {
    var moduloId = btn.dataset.id;
    var pontos   = parseInt(btn.dataset.pts || 0);
    var scores   = Object.values(academy._quizScores);
    var scoreMin = scores.length > 0 ? Math.min.apply(null, scores) : 100;
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    api.post({ evento: 'CONCLUIR_MODULO', modulo_id: moduloId, score_quiz: scoreMin, pontos: pontos }).then(function(res) {
      if (res.ok) {
        ui.toast('+' + pontos + ' pts! Modulo concluido!', 'success');
        // Recarrega trilha do servidor para pegar desbloqueios atualizados
        setTimeout(function(){
          api.get('GET_ACADEMY_TRILHA').then(function(r){
            academy._modulos = r.modulos || [];
            academy._renderTrilha();
          }).catch(function(){ academy._renderTrilha(); });
        }, 1500);
      } else {
        ui.toast(res.erro || 'Erro', 'error');
        btn.disabled = false;
        btn.textContent = '\u2705 Concluir Modulo';
      }
    }).catch(function() {
      ui.toast('Erro de conexao', 'error');
      btn.disabled = false;
    });
  }
};
