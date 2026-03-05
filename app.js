/**
 * AIコンサル案件管理 - 音声で自動更新
 * 話した内容を解析して、該当する会社のステータスと最終アクションを自動更新
 */

// ステータス定義
const STATUSES = ['営業中', 'コンサル中', 'アフターフォロー中'];

// サンプルデータ
let cases = [
  { id: '1', company: '株式会社サンプルA', status: '営業中', lastAction: '初回ヒアリング実施', nextAction: '', updatedAt: formatDate(new Date()) },
  { id: '2', company: '株式会社サンプルB', status: 'コンサル中', lastAction: '提案書送付', nextAction: '', updatedAt: formatDate(new Date()) },
  { id: '3', company: '株式会社サンプルC', status: 'アフターフォロー中', lastAction: '導入完了、定期フォロー中', nextAction: '', updatedAt: formatDate(new Date()) },
];

// ストレージキー
const STORAGE_KEY = 'ai-consult-cases';
const API_KEY_STORAGE = 'ai-consult-openai-key';

// 初期化
function init() {
  loadFromStorage();
  renderTable();
  setupEventListeners();
  setupSpeechRecognition();
  updateParseModeDisplay();
}

// 日付フォーマット
function formatDate(date) {
  return new Date(date).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ストレージから読み込み
function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cases = parsed.map(c => ({ ...c, nextAction: c.nextAction ?? '' }));
      }
    }
  } catch (e) {
    console.warn('ストレージの読み込みに失敗しました', e);
  }
}

// ストレージに保存
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

// OpenAI APIキー取得
function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

// 解析モード表示を更新
function updateParseModeDisplay() {
  const el = document.getElementById('parseMode');
  if (el) el.textContent = getApiKey() ? '（AI解析）' : '（ルールベース）';
}

// テーブル描画
function renderTable() {
  const tbody = document.getElementById('casesBody');
  tbody.innerHTML = cases.map(c => `
    <tr data-id="${c.id}">
      <td class="editable-cell company-name" contenteditable="true" data-field="company" data-id="${c.id}">${escapeHtml(c.company)}</td>
      <td class="editable-cell status-cell" data-id="${c.id}">
        <select class="status-select ${getStatusClass(c.status)}" data-id="${c.id}" data-field="status">
          <option value="営業中" ${c.status === '営業中' ? 'selected' : ''}>営業中</option>
          <option value="コンサル中" ${c.status === 'コンサル中' ? 'selected' : ''}>コンサル中</option>
          <option value="アフターフォロー中" ${c.status === 'アフターフォロー中' ? 'selected' : ''}>アフターフォロー中</option>
        </select>
      </td>
      <td class="editable-cell last-action" contenteditable="true" data-field="lastAction" data-id="${c.id}">${escapeHtml(c.lastAction)}</td>
      <td class="editable-cell next-action" contenteditable="true" data-field="nextAction" data-id="${c.id}">${escapeHtml(c.nextAction || '')}</td>
      <td class="updated-at">${escapeHtml(c.updatedAt)}</td>
      <td><button class="delete-btn" data-id="${c.id}" title="削除">🗑️</button></td>
    </tr>
  `).join('');
  setupTableEditListeners();
}

// テーブル編集のイベント設定
function setupTableEditListeners() {
  const tbody = document.getElementById('casesBody');

  // contenteditable（会社名・最終アクション）: フォーカスアウトで保存
  tbody.querySelectorAll('.editable-cell[contenteditable="true"]').forEach(cell => {
    cell.addEventListener('blur', () => saveCellEdit(cell));
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cell.blur();
      }
    });
  });

  // ステータスselect: 変更で保存
  tbody.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', () => {
      const caseId = select.dataset.id;
      const caseItem = cases.find(c => c.id === caseId);
      if (caseItem) {
        caseItem.status = select.value;
        caseItem.updatedAt = formatDate(new Date());
        select.className = 'status-select ' + getStatusClass(select.value);
        saveToStorage();
        const row = select.closest('tr');
        const updatedCell = row?.querySelector('.updated-at');
        if (updatedCell) updatedCell.textContent = caseItem.updatedAt;
      }
    });
  });
}

// セル編集を保存
function saveCellEdit(cell) {
  const caseId = cell.dataset.id;
  const field = cell.dataset.field;
  const value = cell.textContent.trim();
  const caseItem = cases.find(c => c.id === caseId);
  if (!caseItem) return;
  if (field === 'company') {
    caseItem.company = value;
  } else if (field === 'lastAction') {
    caseItem.lastAction = value;
  } else if (field === 'nextAction') {
    caseItem.nextAction = value;
  }
  caseItem.updatedAt = formatDate(new Date());
  saveToStorage();
  // 更新日時セルを即時反映
  const row = cell.closest('tr');
  if (row) {
    const updatedCell = row.querySelector('.updated-at');
    if (updatedCell) updatedCell.textContent = caseItem.updatedAt;
  }
}

function getStatusClass(status) {
  if (status === '営業中') return 'sales';
  if (status === 'コンサル中') return 'consult';
  if (status === 'アフターフォロー中') return 'follow';
  return 'sales';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 音声認識のセットアップ
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('recordStatus').textContent = '※ お使いのブラウザは音声認識に対応していません（Chrome推奨）';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'ja-JP';

  const recordBtn = document.getElementById('recordBtn');
  const transcriptBox = document.getElementById('transcript');
  const statusEl = document.getElementById('recordStatus');

  let isRecording = false;

  recordBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
      recordBtn.classList.remove('recording');
      recordBtn.querySelector('.text').textContent = '話して更新';
      statusEl.textContent = '録音終了。解析ボタンを押して更新してください。';
      isRecording = false;
    } else {
      transcriptBox.textContent = '';
      confirmedText = '';
      recognition.start();
      recordBtn.classList.add('recording');
      recordBtn.querySelector('.text').textContent = '録音中...';
      statusEl.textContent = '聞いています... 案件について話してください';
      isRecording = true;
    }
  });

  // 確定した結果のみ蓄積（途中結果は表示用に別管理）
  let confirmedText = '';
  recognition.onresult = (event) => {
    let finalPart = '';
    let interimPart = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalPart += transcript;
      } else {
        interimPart += transcript;
      }
    }
    if (finalPart) {
      confirmedText += finalPart;
    }
    // 確定分 + 現在の途中結果のみ表示（重複を防ぐ）
    transcriptBox.textContent = confirmedText + interimPart;
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  };
  recognition.onend = () => {
    if (isRecording) return;
    confirmedText = transcriptBox.textContent || '';
  };
  recognition.onstart = () => {
    confirmedText = '';
  };

  recognition.onerror = (event) => {
    if (event.error !== 'aborted') {
      statusEl.textContent = `エラー: ${event.error}`;
    }
    recordBtn.classList.remove('recording');
    recordBtn.querySelector('.text').textContent = '話して更新';
    isRecording = false;
  };
}

// イベントリスナー設定
function setupEventListeners() {
  document.getElementById('parseBtn').addEventListener('click', parseAndUpdate);
  document.getElementById('clearTranscriptBtn').addEventListener('click', () => {
    document.getElementById('transcript').textContent = '';
  });
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('apiKeyInput').value = getApiKey() || '';
    document.getElementById('settingsModal').classList.remove('hidden');
  });
  document.getElementById('cancelSettingsBtn').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key);
      showToast('APIキーを保存しました');
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
      showToast('APIキーを削除しました');
    }
    document.getElementById('settingsModal').classList.add('hidden');
    updateParseModeDisplay();
  });
  document.getElementById('aboutBtn').addEventListener('click', () => {
    document.getElementById('aboutModal').classList.remove('hidden');
  });
  document.getElementById('closeAboutBtn').addEventListener('click', () => {
    document.getElementById('aboutModal').classList.add('hidden');
  });
  document.getElementById('addBtn').addEventListener('click', () => openAddModal());
  document.getElementById('cancelAddBtn').addEventListener('click', () => closeAddModal());
  document.getElementById('confirmAddBtn').addEventListener('click', confirmAdd);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
  document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
  document.getElementById('csvFileInput').addEventListener('change', importCsv);

  document.getElementById('casesBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      deleteCase(e.target.dataset.id);
    }
  });
}

// 解析して更新（コアロジック）- APIキーがあればGPT、なければルールベース
async function parseAndUpdate() {
  const transcript = document.getElementById('transcript').textContent.trim();
  if (!transcript) {
    showToast('話した内容を入力するか、マイクで話してください', true);
    return;
  }

  const parseBtn = document.getElementById('parseBtn');
  parseBtn.disabled = true;
  parseBtn.textContent = '解析中...';

  let updates = [];
  const apiKey = getApiKey();

  try {
    if (apiKey) {
      updates = await parseWithOpenAI(transcript, apiKey);
    }
    if (updates.length === 0) {
      updates = parseTranscript(transcript);
    }
  } catch (err) {
    console.error(err);
    showToast('AI解析でエラーが発生しました。ルールベースで再試行します。', true);
    updates = parseTranscript(transcript);
  }

  parseBtn.disabled = false;
  parseBtn.textContent = '解析して更新';

  if (updates.length === 0) {
    showToast('更新対象が見つかりませんでした。一覧の会社名を含めて話してみてください。', true);
    return;
  }

  let updatedCount = 0;
  for (const update of updates) {
    const matched = update.matchedCase;
    if (matched) {
      if (update.status) matched.status = update.status;
      if (update.lastAction !== undefined) matched.lastAction = update.lastAction;
      if (update.nextAction !== undefined) matched.nextAction = update.nextAction;
      matched.updatedAt = formatDate(new Date());
      updatedCount++;
    }
  }

  saveToStorage();
  renderTable();
  showToast(`${updatedCount}件の案件を更新しました`);
  document.getElementById('transcript').textContent = '';
}

/**
 * OpenAI GPTで発言を解析
 * 既存の会社名リストに基づき、各社のステータス・アクションを抽出
 */
async function parseWithOpenAI(transcript, apiKey) {
  const companyList = cases.map(c => c.company).join('\n');
  const systemPrompt = `あなたはAIコンサルの案件管理アシスタントです。
発言テキストから、既存の案件（会社）ごとの状況を抽出し、JSON形式で返してください。

ステータスは次のいずれかで返すこと：営業中、コンサル中、アフターフォロー中
最終アクション：直近で行ったこと（例：提案書送付、ミーティング実施）
今後やるアクション：これから行う予定のこと（例：フォローメール送付、電話）

発言に含まれていない会社は出力しないでください。
音声認識の誤変換（サンブル→サンプル、シーン→C、AIM→DMなど）を考慮して、既存の会社名と照合してください。`;

  const userPrompt = `【既存の会社一覧】
${companyList}

【発言テキスト】
${transcript}

上記の発言から、各会社の更新内容を抽出し、次のJSON形式のみで返してください（説明文は不要）：
[{"company":"株式会社〇〇","status":"営業中|コンサル中|アフターフォロー中","lastAction":"〇〇","nextAction":"〇〇"}]
更新する項目がない場合は空文字""にしてください。`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API Error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return [];

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.warn('GPT応答のJSON解析に失敗', e);
    return [];
  }
  const updates = [];

  for (const item of parsed) {
    const company = item.company || item.会社名;
    if (!company) continue;

    const matched = cases.find(c =>
      c.company === company ||
      c.company.includes(company) ||
      company.includes(c.company.replace(/^(株式会社|有限会社|合同会社)\s*/, ''))
    );
    if (!matched) continue;

    const status = ['営業中', 'コンサル中', 'アフターフォロー中'].includes(item.status) ? item.status : null;
    const lastAction = item.lastAction || item.最終アクション || undefined;
    const nextAction = item.nextAction || item.今後やるアクション || undefined;

    if (status || lastAction !== undefined || nextAction !== undefined) {
      updates.push({
        matchedCase: matched,
        status,
        lastAction: lastAction || undefined,
        nextAction: nextAction || undefined,
      });
    }
  }

  return updates;
}

/**
 * 音声認識の誤変換を補正（サンブル→サンプル、シーン→C、AIM→DMなど）
 */
function normalizeTranscript(text) {
  return text
    .replace(/サンブル/g, 'サンプル')
    .replace(/サンプル\s*シーン/g, 'サンプルC')
    .replace(/サンプルシーン/g, 'サンプルC')
    .replace(/サンプル\s*シー\b/g, 'サンプルC')
    .replace(/\bAIM\b/g, 'DM');
}

/**
 * 発言テキストを解析 → 既存案件のみ更新（新規追加しない）
 * 音声認識の誤変換（サンブル、シーン等）にも対応
 */
function parseTranscript(text) {
  text = normalizeTranscript(text);
  const updates = [];
  const statusPatterns = [
    { pattern: /アフターフォロー|フォロー中|導入完了|完了後|終了後|適用中/, status: 'アフターフォロー中' },
    { pattern: /コンサル中|実施中|進行中|導入中|契約済/, status: 'コンサル中' },
    { pattern: /営業中|商談中|ヒアリング|提案前|検討中/, status: '営業中' },
  ];

  // 各既存案件について、発言内で言及されているかチェック
  for (const caseItem of cases) {
    const shortName = caseItem.company.replace(/^(株式会社|有限会社|合同会社)\s*/, '');
    const searchNames = [caseItem.company, shortName];

    const mentioned = searchNames.some(name => text.includes(name));
    if (!mentioned) continue;

    const update = { matchedCase: caseItem, status: null, lastAction: undefined, nextAction: undefined };

    // この会社が言及されている部分のテキストを抽出（句読点がなくても対応）
    const context = extractContextForCompany(text, searchNames);
    if (!context) continue;

    // 「〇〇に関しては」「〇〇は」「〇〇が」の後に続く内容を取得
    let rest = '';
    for (const name of searchNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = context.match(new RegExp(escaped + '(?:に関しては|については|は|が)\\s*([\\s\\S]+)'));
      if (m && m[1]) {
        rest = m[1].trim();
        break;
      }
    }
    if (!rest) rest = context;

    // ステータス
    for (const { pattern, status } of statusPatterns) {
      if (pattern.test(rest)) {
        update.status = status;
        break;
      }
    }

    // 最終アクション（「〇〇した」「〇〇送った」「〇〇を送っています」など）
    const lastActionPatterns = [
      /(.+?(?:した|送った|届いた|完了|実施|送付|提出|共有|行いました|行った|送り込んだ|送り込む|送っています))/,
      /(?:提案書|資料|DM|メール)[^。、]*(?:送付|送った|送り|送っています)/,
    ];
    for (const pat of lastActionPatterns) {
      const m = rest.match(pat);
      if (m && m[0] && m[0].length > 2 && m[0].length < 80) {
        update.lastAction = m[0].trim();
        break;
      }
    }
    if (!update.lastAction && /(?:DM|提案書|ミーティング|打ち合わせ)/.test(rest)) {
      const dm = rest.match(/(DM|提案書[^。、]*|ミーティング[^。、]*|打ち合わせ[^。、]*)/);
      if (dm) update.lastAction = dm[1].trim();
    }

    // 今後やるアクション（「これから〇〇」「〇〇予定」「フォローの電話」など）
    const nextPatterns = [
      /(?:これから|今後やるアクションとしては?|次は|今後は?|来週は?|今度は?)\s*([^。、]+?)(?:予定です|ことです|と思います|です)/,
      /(.+?行きたいと思います)/,
      /(?:として|としては)\s*([^。、]+(?:ことです|と思います))/,
    ];
    for (const pat of nextPatterns) {
      const m = rest.match(pat);
      if (m && m[1]) {
        let next = m[1].replace(/\s*(ことです|と思います|行きたいと思います)\s*$/, '').trim();
        if (next.length > 2 && next.length < 80) {
          update.nextAction = next;
          break;
        }
      }
    }

    if (update.status || update.lastAction !== undefined || update.nextAction !== undefined) {
      updates.push(update);
    }
  }

  return updates;
}

// 会社名を含む前後の文脈を抽出
function extractContextForCompany(text, searchNames) {
  for (const name of searchNames) {
    const idx = text.indexOf(name);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 5);
    let chunk = text.slice(start, idx + 180);
    const nextMatch = chunk.slice(name.length).match(/サンプル[A-Za-z]|株式会社/);
    if (nextMatch) {
      const cutIdx = chunk.indexOf(nextMatch[0], name.length);
      if (cutIdx > name.length) chunk = chunk.slice(0, cutIdx);
    }
    return chunk;
  }
  return null;
}

// 会社名のヒントからマッチする案件を検索
function findMatchingCase(hint) {
  if (!hint) return null;
  const normalized = hint.replace(/\s/g, '').toLowerCase();
  return cases.find(c => {
    const cn = c.company.replace(/\s/g, '').toLowerCase();
    return cn.includes(normalized) || normalized.includes(cn) || 
           c.company.includes(hint) || hint.includes(c.company.replace(/^(株式会社|有限会社|合同会社)\s*/, ''));
  });
}

// モーダル
function openAddModal() {
  document.getElementById('addModal').classList.remove('hidden');
  document.getElementById('newCompanyName').value = '';
  document.getElementById('newStatus').value = '営業中';
  document.getElementById('newLastAction').value = '';
  document.getElementById('newNextAction').value = '';
}

function closeAddModal() {
  document.getElementById('addModal').classList.add('hidden');
}

function confirmAdd() {
  const company = document.getElementById('newCompanyName').value.trim();
  if (!company) {
    showToast('会社名を入力してください', true);
    return;
  }
  cases.push({
    id: Date.now().toString(),
    company,
    status: document.getElementById('newStatus').value,
    lastAction: document.getElementById('newLastAction').value.trim(),
    nextAction: document.getElementById('newNextAction').value.trim(),
    updatedAt: formatDate(new Date()),
  });
  saveToStorage();
  renderTable();
  closeAddModal();
  showToast('案件を追加しました');
}

function deleteCase(id) {
  if (confirm('この案件を削除しますか？')) {
    cases = cases.filter(c => c.id !== id);
    saveToStorage();
    renderTable();
    showToast('削除しました');
  }
}

// CSV
function exportCsv() {
  const headers = ['会社名', 'ステータス', '最終アクション', '今後やるアクション', '更新日時'];
  const rows = cases.map(c => [c.company, c.status, c.lastAction, c.nextAction || '', c.updatedAt]);
  const csv = [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ai-consult-cases-${formatDate(new Date()).replace(/[/:]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('CSVをダウンロードしました');
}

function importCsv(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        showToast('CSVの形式が正しくありません', true);
        return;
      }
      const newCases = [];
      const colCount = parseCsvLine(lines[1] || '').length;
      const hasNextAction = colCount >= 5;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols[0]) {
          newCases.push({
            id: Date.now().toString() + i,
            company: cols[0],
            status: STATUSES.includes(cols[1]) ? cols[1] : '営業中',
            lastAction: cols[2] || '',
            nextAction: hasNextAction ? (cols[3] || '') : '',
            updatedAt: (hasNextAction ? cols[4] : cols[3]) || formatDate(new Date()),
          });
        }
      }
      cases = newCases;
      saveToStorage();
      renderTable();
      showToast(`${newCases.length}件の案件を読み込みました`);
    } catch (err) {
      showToast('CSVの読み込みに失敗しました', true);
    }
    e.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\n' && !inQuotes)) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function showToast(message, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 起動
init();
