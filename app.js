(() => {
  const STORAGE_KEY = 'orcamento_prestador_v1';
  const NUMERO_KEY = 'orcamento_numero_v1';

  const $ = (id) => document.getElementById(id);

  const fields = {
    numero: $('fNumero'), dataEnvio: $('fDataEnvio'), validade: $('fValidade'),
    referencia: $('fReferencia'),
    pNome: $('pNome'), pDoc: $('pDoc'), pTelefone: $('pTelefone'), pEmail: $('pEmail'), pEndereco: $('pEndereco'),
    cNome: $('cNome'), cDoc: $('cDoc'), cTelefone: $('cTelefone'), cEmail: $('cEmail'),
    desconto: $('fDesconto'), descontoTipo: $('fDescontoTipo'), imposto: $('fImposto'),
    pagamento: $('fPagamento'), observacoes: $('fObservacoes'),
  };

  let items = [
    { desc: '', qtd: 1, valor: 0 },
  ];

  // ---------- Helpers ----------
  const brl = (n) => (isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const parseDateLocal = (isoStr) => {
    if (!isoStr) return null;
    const [y, m, d] = isoStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ---------- Prestador cache ----------
  function loadPrestador() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      fields.pNome.value = data.nome || '';
      fields.pDoc.value = data.doc || '';
      fields.pTelefone.value = data.telefone || '';
      fields.pEmail.value = data.email || '';
      fields.pEndereco.value = data.endereco || '';
    } catch (e) { /* ignora dados corrompidos */ }
  }

  function savePrestador() {
    const data = {
      nome: fields.pNome.value, doc: fields.pDoc.value, telefone: fields.pTelefone.value,
      email: fields.pEmail.value, endereco: fields.pEndereco.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  $('clearPrestador').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    ['pNome', 'pDoc', 'pTelefone', 'pEmail', 'pEndereco'].forEach((k) => (fields[k].value = ''));
    render();
  });

  // ---------- Número automático ----------
  function initNumero() {
    const saved = localStorage.getItem(NUMERO_KEY);
    if (saved) fields.numero.value = saved;
  }
  function bumpNumeroCacheOnExport() {
    const current = parseInt(fields.numero.value, 10);
    if (!isNaN(current)) localStorage.setItem(NUMERO_KEY, String(current + 1).padStart(String(current + 1).length, '0'));
  }

  // ---------- Items rendering (form side) ----------
  const itemsList = $('itemsList');

  function renderItemsForm() {
    itemsList.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'items-head';
    head.innerHTML = '<span>Descrição</span><span>Qtd</span><span>Valor unit.</span><span>Total</span><span></span>';
    itemsList.appendChild(head);

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      const amount = (item.qtd || 0) * (item.valor || 0);
      row.innerHTML = `
        <input type="text" placeholder="Ex: Sessão de fotos" data-field="desc" data-idx="${idx}" value="${escapeAttr(item.desc)}">
        <input type="number" min="0" step="1" data-field="qtd" data-idx="${idx}" value="${item.qtd}">
        <input type="number" min="0" step="0.01" data-field="valor" data-idx="${idx}" value="${item.valor}">
        <div class="item-amount">${brl(amount)}</div>
        <button type="button" class="item-remove" data-remove="${idx}" title="Remover item">×</button>
      `;
      itemsList.appendChild(row);
    });

    itemsList.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.idx);
        const field = e.target.dataset.field;
        let val = e.target.value;
        if (field === 'qtd' || field === 'valor') val = parseFloat(val) || 0;
        items[idx][field] = val;
        render(true);
      });
    });

    itemsList.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.dataset.remove);
        if (items.length === 1) { items[idx] = { desc: '', qtd: 1, valor: 0 }; }
        else items.splice(idx, 1);
        renderItemsForm();
        render();
      });
    });
  }

  $('addItem').addEventListener('click', () => {
    items.push({ desc: '', qtd: 1, valor: 0 });
    renderItemsForm();
    render();
  });

  function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
  }
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- Cálculos ----------
  function computeTotals() {
    const subtotal = items.reduce((s, it) => s + (it.qtd || 0) * (it.valor || 0), 0);
    let desconto = parseFloat(fields.desconto.value) || 0;
    if (fields.descontoTipo.value === 'percentual') desconto = subtotal * (desconto / 100);
    const baseImposto = Math.max(subtotal - desconto, 0);
    const impostoPct = parseFloat(fields.imposto.value) || 0;
    const imposto = baseImposto * (impostoPct / 100);
    const total = baseImposto + imposto;
    return { subtotal, desconto, imposto, total, impostoPct };
  }

  // ---------- Render preview ----------
  function render(skipItemsFormRerender) {
    $('pvNumero').textContent = fields.numero.value || '—';

    const dataEnvio = parseDateLocal(fields.dataEnvio.value) || new Date();
    $('pvDataEnvio').textContent = formatDate(dataEnvio);

    const dias = parseInt(fields.validade.value, 10);
    if (dias > 0) {
      const validade = new Date(dataEnvio);
      validade.setDate(validade.getDate() + dias);
      $('pvValidade').textContent = formatDate(validade);
    } else {
      $('pvValidade').textContent = 'Sem validade definida';
    }

    const ref = fields.referencia.value.trim();
    $('pvRefWrap').hidden = !ref;
    $('pvRef').textContent = ref;

    $('pvPrestadorNome').textContent = fields.pNome.value.trim() || 'Seu nome';
    const prestadorExtra = [fields.pDoc.value, fields.pTelefone.value, fields.pEmail.value, fields.pEndereco.value]
      .filter(Boolean).map(escapeHtml).join('<br>');
    $('pvPrestador').innerHTML = `<strong>${escapeHtml(fields.pNome.value.trim() || 'Seu nome')}</strong>${prestadorExtra ? '<br>' + prestadorExtra : ''}`;

    const clienteExtra = [fields.cDoc.value, fields.cTelefone.value, fields.cEmail.value]
      .filter(Boolean).map(escapeHtml).join('<br>');
    $('pvCliente').innerHTML = `<strong>${escapeHtml(fields.cNome.value.trim() || 'Nome do cliente')}</strong>${clienteExtra ? '<br>' + clienteExtra : ''}`;

    const body = $('pvItemsBody');
    body.innerHTML = '';
    items.forEach((it) => {
      const amount = (it.qtd || 0) * (it.valor || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(it.desc) || '<span style="color:var(--muted)">Item sem descrição</span>'}</td>
        <td class="num">${it.qtd || 0}</td><td class="num">${brl(it.valor || 0)}</td><td class="num">${brl(amount)}</td>`;
      body.appendChild(tr);
    });

    const { subtotal, desconto, imposto, total, impostoPct } = computeTotals();
    $('pvSubtotal').textContent = brl(subtotal);
    $('pvDescontoRow').hidden = desconto <= 0;
    $('pvDesconto').textContent = '– ' + brl(desconto);
    $('pvImpostoRow').hidden = imposto <= 0;
    $('pvImposto').textContent = brl(imposto) + (impostoPct ? ` (${impostoPct}%)` : '');
    $('pvTotal').textContent = brl(total);

    const pag = fields.pagamento.value.trim();
    $('pvPagamentoWrap').hidden = !pag;
    $('pvPagamento').textContent = pag;

    const obs = fields.observacoes.value.trim();
    $('pvObsWrap').hidden = !obs;
    $('pvObservacoes').textContent = obs;

    // Resumos da sanfona
    const validadeLabel = dias > 0 ? `${dias} dias` : 'sem validade';
    $('sumDetalhes').textContent = `${fields.numero.value || '001'} · ${validadeLabel}`;
    $('sumPrestador').textContent = fields.pNome.value.trim() ? 'Adicionado' : 'Nenhum';
    $('sumCliente').textContent = fields.cNome.value.trim() ? 'Adicionado' : 'Nenhum';
    const itensPreenchidos = items.filter((it) => it.desc.trim() || it.valor > 0).length;
    $('sumItens').textContent = itensPreenchidos > 0 ? `${itensPreenchidos} ${itensPreenchidos === 1 ? 'item' : 'itens'}` : 'Nenhum';
    $('sumPagamento').textContent = pag ? 'Adicionado' : 'Nenhum';
    $('sumObservacoes').textContent = obs ? 'Adicionada' : 'Nenhuma';

    if (!skipItemsFormRerender) {
      // atualiza apenas os totais exibidos na linha de itens do formulário
      itemsList.querySelectorAll('.item-row').forEach((row, idx) => {
        const amountEl = row.querySelector('.item-amount');
        const it = items[idx];
        if (amountEl && it) amountEl.textContent = brl((it.qtd || 0) * (it.valor || 0));
      });
    }
  }

  // ---------- Eventos ----------
  Object.entries(fields).forEach(([key, el]) => {
    el.addEventListener('input', () => {
      if (['pNome', 'pDoc', 'pTelefone', 'pEmail', 'pEndereco'].includes(key)) savePrestador();
      render();
    });
  });

  // ---------- Sanfona (accordion) ----------
  document.querySelectorAll('.acc-header').forEach((header) => {
    header.addEventListener('click', () => {
      header.closest('.acc-item').classList.toggle('is-open');
    });
  });

  // ---------- Alternar Editar / Visualizar (mobile) ----------
  function showPane(pane) {
    $('paneEdit').classList.toggle('is-visible', pane === 'edit');
    $('panePreview').classList.toggle('is-visible', pane === 'preview');
  }
  $('toggleViewBtn').addEventListener('click', () => showPane('preview'));
  $('editBtn').addEventListener('click', () => showPane('edit'));
  showPane('edit');

  // ---------- Exportar PDF ----------
  $('exportBtn').addEventListener('click', async () => {
    const btn = $('exportBtn');
    const original = btn.textContent;
    btn.textContent = 'Gerando...';
    btn.disabled = true;

    // A prévia pode estar com display:none (ex: você está na aba "Editar" no celular).
    // html2canvas não consegue capturar um elemento oculto, então clonamos o conteúdo
    // para fora da tela (visível para o navegador, invisível para você) antes de gerar o PDF.
    const original_paper = $('paper');
    const clone = original_paper.cloneNode(true);
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '-99999px';
    wrapper.style.background = '#ffffff';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        // divide em múltiplas páginas se o orçamento for longo
        let remaining = canvas.height;
        let position = 0;
        const pageCanvasHeight = (pageHeight * canvas.width) / imgWidth;
        while (remaining > 0) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.min(pageCanvasHeight, remaining);
          sliceCanvas.getContext('2d').drawImage(canvas, 0, position, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
          const sliceImg = sliceCanvas.toDataURL('image/png');
          if (position > 0) pdf.addPage();
          pdf.addImage(sliceImg, 'PNG', 0, 0, imgWidth, (sliceCanvas.height * imgWidth) / canvas.width);
          position += sliceCanvas.height;
          remaining -= sliceCanvas.height;
        }
      }

      const hoje = new Date();
      const dd = String(hoje.getDate()).padStart(2, '0');
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      const yy = String(hoje.getFullYear()).slice(-2);
      const dataArquivo = `${dd}-${mm}-${yy}`;
      const nomeCliente = (fields.cNome.value.trim() || 'cliente').replace(/[^a-zA-Z0-9]+/g, '-');
      pdf.save(`${dataArquivo}-${nomeCliente}.pdf`);
      bumpNumeroCacheOnExport();
    } catch (err) {
      alert('Não foi possível gerar o PDF. Tente novamente.');
      console.error(err);
    } finally {
      document.body.removeChild(wrapper);
      btn.textContent = original;
      btn.disabled = false;
    }
  });

  // ---------- Inicialização ----------
  function init() {
    loadPrestador();
    initNumero();
    if (!fields.dataEnvio.value) {
      const today = new Date();
      fields.dataEnvio.value = today.toISOString().slice(0, 10);
    }
    renderItemsForm();
    render();
  }

  init();
})();
