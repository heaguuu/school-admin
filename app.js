const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pages = { dashboard: '홈', students: '대상자 관리', records: '기록 내역', criteria: '상벌점 기준', prefects: '선도부원 관리' };
let db = { students: [], criteria: [], records: [] }, loaded = false, busy = false, query = '', selectedId = '', type = 'all', statusFilter = 'active';
const crit = code => db.criteria.find(c => c.code === code);
const active = r => r.status !== '취소' && r.status !== '반려';
const kind = r => crit(r.code)?.type || (Number(r.score) < 0 ? '벌점' : '상점');
const score = r => Math.abs(Number(r.score) || 0);
const studentLabel = s => `${s.grade}학년 ${s.classNo}반 ${s.number}번`;
const counts = id => db.records.filter(r => r.studentId === id && active(r)).reduce((a, r) => { a[kind(r) === '상점' ? 'merit' : 'demerit'] += score(r); a.count++; return a; }, { merit: 0, demerit: 0, count: 0 });
function call(method, ...args) {
  return new Promise((resolve, reject) => {
    if (!window.google?.script?.run)
      return reject(Error('Google Apps Script로 배포한 주소에서 열어 주세요.')); google.script.run.withSuccessHandler(resolve).withFailureHandler(e => reject(Error(e.message || String(e))))[method](...args);
  });
}
function toast(s) { const t = $('#toast'); t.textContent = s; t.hidden = false; setTimeout(() => t.hidden = true, 3500); }
async function refresh() {
  try {
    db = await call('bootstrap');
    loaded = true;
    render();
  }
  catch (e) {
    loaded = false;
    $('#main').innerHTML = `<section class="sheet-panel"><h2>시트 연결 오류</h2><p class="sheet-error">${esc(e.message)}</p><button class="button secondary" id="retry">다시 시도</button></section>`;
    $('#retry').onclick = refresh;
  }
}
function title(t, desc = '', action = '') { return `<div class="page-heading"><div><div class="eyebrow">SCHOOL MANAGEMENT</div><h1>${esc(t)}</h1><p class="page-description">${esc(desc)}</p></div>${action}</div>`; }
function table(headers, rows) { return `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}">표시할 데이터가 없습니다.</td></tr>`}</tbody></table></div>`; }
function badge(t) { return `<span class="badge ${t === '상점' ? 'merit' : t === '벌점' ? 'demerit' : 'neutral'}">${esc(t)}</span>`; }
function render() {
  if (!loaded)
    return; const p = pages[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard'; $('#breadcrumb-current').textContent = pages[p]; $$('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === p)); $$('[data-student-count]').forEach(el => el.textContent = db.students.length); $('#main').innerHTML = ({ dashboard: dashboard, students: students, records: records, criteria: criteria, prefects: prefects })[p](); bind();
}
function dashboard() { const a = db.records.filter(active), m = a.filter(r => kind(r) === '상점'), d = a.filter(r => kind(r) === '벌점'); const rank = [...db.students].map(s => ({ s, t: counts(s.id) })).sort((a, b) => b.t.demerit - a.t.demerit).slice(0, 5); return title('홈', 'Google Sheets에 기록된 상벌점 현황을 확인합니다.', `<button class="button secondary" data-refresh>새로고침</button>`) + `<div class="sheet-stats"><div class="sheet-stat"><span>전체 학생</span><strong>${db.students.length}명</strong></div><div class="sheet-stat"><span>유효 상점 기록</span><strong>${m.length}건</strong></div><div class="sheet-stat"><span>유효 벌점 기록</span><strong>${d.length}건</strong></div><div class="sheet-stat"><span>누적 기록</span><strong>${a.length}건</strong></div></div><section class="sheet-panel"><h2>벌점 누계 상위 5명</h2>${table(['학년', '반', '번호', '이름', '벌점'], rank.map(({ s, t }) => `<tr><td>${esc(s.grade)}</td><td>${esc(s.classNo)}</td><td>${esc(s.number)}</td><td>${esc(s.name)}</td><td>${t.demerit}점</td></tr>`))}</section><section class="sheet-panel"><h2>최근 기록</h2>${recordTable([...db.records].reverse().slice(0, 8))}</section>`; }



function studentTable(ss) { return table(['학년', '반', '번호', '이름', '상점 누계', '벌점 누계', '조회'], ss.map(s => { const t = counts(s.id); return `<tr><td>${esc(s.grade)}</td><td>${esc(s.classNo)}</td><td>${esc(s.number)}</td><td>${esc(s.name)}</td><td>${t.merit}점</td><td>${t.demerit}점</td><td><button class="button secondary small" data-student="${esc(s.id)}">상세 / 등록</button></td></tr>`; })); }
function students() { return title('대상자 관리', '학생 명부를 검색하고 개인별 누계를 확인합니다.') + `<section class="sheet-panel"><div class="sheet-controls"><input id="student-search" placeholder="이름, 학년, 반, 번호로 검색" value="${esc(query)}"><button class="button secondary" data-export="students">CSV 내보내기</button></div><div id="student-results">${studentTable(filteredStudents())}</div></section>`; }
function filteredStudents() { const q = query.trim().toLowerCase(); return db.students.filter(s => !q || [s.name, s.grade, s.classNo, s.number, studentLabel(s)].some(v => String(v).toLowerCase().includes(q))); }
function recordTable(rs) { return table(['일시', '학년', '반', '번호', '이름', '구분', '항목', '점수', '기록자', '상태', '관리'], rs.map(r => `<tr><td>${esc(String(r.date).replace('T', ' ').slice(0, 16))}</td><td>${esc(r.grade)}</td><td>${esc(r.classNo)}</td><td>${esc(r.number)}</td><td>${esc(r.name)}</td><td>${badge(kind(r))}</td><td>${esc(crit(r.code)?.reason || r.code)}</td><td>${score(r)}점</td><td>${esc(r.requester)}</td><td>${r.status === '취소' ? '<span class="badge cancelled">취소</span>' : '<span class="badge merit">유효</span>'}</td><td>${active(r) ? `<button class="button secondary small" data-cancel="${r.row}">기록 취소</button>` : '—'}</td></tr>`)); }
function records() { let rs = [...db.records].reverse().filter(r => statusFilter === 'all' || (statusFilter === 'active' ? active(r) : !active(r))); return title('기록 내역', '선도부원과 담당자가 등록한 기록을 확인하고 취소할 수 있습니다.', `<button class="button primary" data-register>상벌점 등록</button>`) + `<section class="sheet-panel"><div class="sheet-controls"><select id="record-status"><option value="active" ${statusFilter === 'active' ? 'selected' : ''}>유효 기록</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>전체 기록</option><option value="cancel" ${statusFilter === 'cancel' ? 'selected' : ''}>취소 기록</option></select><button class="button secondary" data-export="records">CSV 내보내기</button></div>${recordTable(rs)}</section>`; }
function criteria() { return title('상벌점 기준', 'Google Sheets 점수기준 시트의 사용 중인 항목입니다.') + `<section class="sheet-panel"><div class="sheet-controls"><select id="criterion-type"><option value="all">전체</option><option value="상점" ${type === '상점' ? 'selected' : ''}>상점</option><option value="벌점" ${type === '벌점' ? 'selected' : ''}>벌점</option></select></div>${table(['항목코드', '구분', '사유', '점수'], db.criteria.filter(c => type === 'all' || c.type === type).map(c => `<tr><td>${esc(c.code)}</td><td>${badge(c.type)}</td><td>${esc(c.reason)}</td><td>${esc(c.score)}점</td></tr>`))}</section>`; }
function prefects() { return title('선도부원 관리') + `<section class="sheet-panel sheet-empty"></section>`; }
function openDialog(heading, content) { const m = $('#form-modal'); m.innerHTML = `<div class="drawer-header"><h2 id="modal-title">${esc(heading)}</h2><button class="button secondary small" id="close-form">닫기</button></div><div style="padding:22px">${content}</div>`; m.showModal(); $('#close-form').onclick = () => m.close(); return m; }
function register(id = '') {
  const options = db.students.filter(s => s.status === '재학').map(s => `<option value="${esc(s.id)}" ${s.id === id ? 'selected' : ''}>${esc(studentLabel(s))} ${esc(s.name)}</option>`).join(''); const m = openDialog('상벌점 즉시 등록', `<form id="point-form" class="sheet-form"><label>학생<select name="studentId" required><option value="">학생 선택</option>${options}</select></label><label>상벌점 항목<select name="code" required><option value="">항목 선택</option>${db.criteria.map(c => `<option value="${esc(c.code)}">${esc(c.type)} · ${esc(c.reason)} (${esc(c.score)}점)</option>`).join('')}</select></label><label>비고<textarea name="note" rows="3" maxlength="300" placeholder="선택 입력"></textarea></label><p class="sheet-hint">등록 즉시 Google Sheets의 '점수 부여' 시트에 기록됩니다. 승인 절차는 없습니다.</p><p class="sheet-error" id="form-error"></p><button class="button primary" type="submit">바로 등록하기</button></form>`); $('#point-form').onsubmit = async (e) => {
    e.preventDefault(); if (busy)
      return; const f = e.currentTarget; const data = Object.fromEntries(new FormData(f)); busy = true; f.querySelector('button[type=submit]').disabled = true; try {
        await call('addPoint', data);
        m.close();
        toast('상벌점이 시트에 등록되었습니다.');
        await refresh();
      }
    catch (err) {
      $('#form-error').textContent = err.message;
    }
    finally {
      busy = false;
      f.querySelector('button[type=submit]').disabled = false;
    }
  };
}
function detail(id) {
  const s = db.students.find(s => s.id === id); if (!s)
    return; const t = counts(id), rs = [...db.records].filter(r => r.studentId === id).reverse(); const m = $('#detail-modal'); m.innerHTML = `<div class="drawer-header"><h2 id="detail-title">${esc(s.name)} · ${esc(studentLabel(s))}</h2><button class="button secondary small" id="close-detail">닫기</button></div><div style="padding:20px"><div class="sheet-stats"><div class="sheet-stat"><span>상점</span><strong>${t.merit}점</strong></div><div class="sheet-stat"><span>벌점</span><strong>${t.demerit}점</strong></div></div><button class="button primary" id="detail-register">상벌점 등록</button><div style="margin-top:20px">${recordTable(rs)}</div></div>`; m.showModal(); $('#close-detail').onclick = () => m.close(); $('#detail-register').onclick = () => { m.close(); register(id); };
}
async function cancel(row) {
  if (!confirm('이 기록을 취소할까요? 취소된 기록은 누계에서 제외됩니다.'))
    return; try {
      await call('cancelPoint', Number(row));
      toast('기록을 취소했습니다.');
      await refresh();
    }
  catch (e) {
    alert(e.message);
  }
}
function csv(rows, name) { const cell = x => '"' + String(x ?? '').replaceAll('"', '""') + '"'; const text = '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportCsv(what) {
  if (what === 'students')
    csv([['학년', '반', '번호', '이름', '상점', '벌점'], ...filteredStudents().map(s => { const t = counts(s.id); return [s.grade, s.classNo, s.number, s.name, t.merit, t.demerit]; })], '학생별 누계');
  else
    csv([['일시', '학년', '반', '번호', '이름', '구분', '항목', '점수', '요청자', '상태'], ...db.records.map(r => [r.date, r.grade, r.classNo, r.number, r.name, kind(r), crit(r.code)?.reason || r.code, score(r), r.requester, r.status || '유효'])], '상벌점 기록');
}
function bind() {
  $$('[data-refresh]').forEach(b => b.onclick = refresh); $$('[data-register]').forEach(b => b.onclick = () => register()); $$('[data-student]').forEach(b => b.onclick = () => detail(b.dataset.student)); $$('[data-cancel]').forEach(b => b.onclick = () => cancel(b.dataset.cancel)); $$('[data-export]').forEach(b => b.onclick = () => exportCsv(b.dataset.export)); const q = $('#student-search'); if (q)
    q.oninput = e => { query = e.target.value; $('#student-results').innerHTML = studentTable(filteredStudents()); $$('[data-student]').forEach(b => b.onclick = () => detail(b.dataset.student)); }; const ct = $('#criterion-type'); if (ct)
    ct.onchange = e => { type = e.target.value; render(); }; const rs = $('#record-status'); if (rs)
    rs.onchange = e => { statusFilter = e.target.value; render(); };
}
window.addEventListener('hashchange', render);


/* ========================================
    홈-전체 학생 수 표시
======================================== */


const GAS_URL = "https://script.google.com/macros/s/AKfycbwbA-lc5TleXEEZyzevVO6FFn3-xEFuke4vgge26a4UamvL0FM9VqAsr9huQk2FoeIf/exec";

async function loadStudentCount() {
  const element = document.getElementById("student-count");
  if (!element) return;
  element.textContent = "불러오는 중";

  try {
    const url = new URL(GAS_URL);
    url.searchParams.set("action", "studentCount");

    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error("학생 수 조회 실패");
    }

    element.textContent =
      Number(data.count).toLocaleString("ko-KR") + "명";

  } catch (error) {
    console.error("학생 수 조회 오류:", error);
    element.textContent = "연결 오류";
  }
}
document.addEventListener("DOMContentLoaded", loadStudentCount);

// 기록내역 - 상벌점 부여 기록

function renderPointRecords(records) {
  const tbody = document.getElementById("student-records-body");
  const count = document.getElementById("records-result-count");

  if (!tbody) return;

  if (count) {
    count.textContent = `조회 결과 ${records.length}건`;
  }

  if (records.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10">등록된 기록이 없습니다.</td></tr>';
    return;
  }

  // 외부 데이터가 HTML로 실행되지 않도록 이스케이프
  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  tbody.innerHTML = records.map(record => `
    <tr>
      <td>${escapeHtml(record.year)}</td>
      <td>${escapeHtml(record.grade)}</td>
      <td>${escapeHtml(record.classNo)}</td>
      <td>${escapeHtml(record.number)}</td>
      <td>${escapeHtml(record.name)}</td>
      <td>${escapeHtml(record.code)}</td>
      <td>${escapeHtml(record.score)}</td>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.requester)}</td>
      <td>${escapeHtml(record.status)}</td>
    </tr>
  `).join("");
}

async function checkRecordsConnection() {
  const count = document.getElementById("records-result-count");

  try {
    const url = new URL(GAS_URL);
    url.searchParams.set("action", "recordCount");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error("조회 실패");
    }

    if (count) {
      count.textContent = `시트 연결 확인: ${data.count}건`;
    }

  } catch (error) {
    console.error("GAS 연결 오류:", error);

    if (count) {
      count.textContent = "연결 실패";
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",
  checkRecordsConnection
);


/* ========================================
    상벌점 기준 - 기준 관리
======================================== */
let criteriaData = [];
let pendingCriteria = [];

// HTML 특수문자 처리
function criteriaEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

// 엑셀 날짜를 yyyy-MM-dd로 변환
function criteriaDate(value) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) return "";

    return [
      parsed.y,
      String(parsed.m).padStart(2, "0"),
      String(parsed.d).padStart(2, "0")
    ].join("-");
  }

  const str = String(value ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return "";
}

// 항목코드 자동 생성
function generateCriteriaCode(type, number) {
  const prefix = {
    "상점": "BP",
    "벌점": "RP",
    "상쇄점": "IP"
  }[type];

  return prefix + String(number).padStart(3, "0");
}

// 기존 항목코드 중 가장 큰 번호 확인
function nextCriteriaNumber(type) {
  const prefix = {
    "상점": "BP",
    "벌점": "RP",
    "상쇄점": "IP"
  }[type];

  const numbers = criteriaData
    .filter(item => item.code.startsWith(prefix))
    .map(item => Number(item.code.slice(prefix.length)))
    .filter(Number.isFinite);

  return Math.max(0, ...numbers) + 1;
}

// 엑셀 읽기
async function readCriteriaExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true
  });

  if (!rows.length) {
    throw new Error("엑셀 파일에 데이터가 없습니다.");
  }

  const counters = {
    "상점": nextCriteriaNumber("상점"),
    "벌점": nextCriteriaNumber("벌점"),
    "상쇄점": nextCriteriaNumber("상쇄점")
  };

  return rows.map((row, index) => {
    const type = String(row["구분"]).trim();
    const reason = String(row["사유"]).trim();
    const score = Number(row["점수"]);
    const start = criteriaDate(row["적용시작일"]);

    if (!Object.hasOwn(counters, type)) {
      throw new Error(`${index + 2}행: 구분이 올바르지 않습니다.`);
    }

    if (!reason || !Number.isFinite(score) || score === 0) {
      throw new Error(`${index + 2}행: 사유 또는 점수를 확인하세요.`);
    }

    if (!start) {
      throw new Error(`${index + 2}행: 적용시작일을 확인하세요.`);
    }

    const code = generateCriteriaCode(type, counters[type]++);

    return {
      code,
      type,
      reason,
      score: type === "벌점"
        ? -Math.abs(score)
        : Math.abs(score),
      duplicate: String(row["당일중복허용"] || "불가"),
      status: "사용",
      start
    };
  });
}

// 표의 한 행 생성
function criteriaTableRow(item) {
  const scoreClass = item.score < 0
    ? "criteria-score-negative"
    : "criteria-score-positive";

  const scoreText = item.score > 0
    ? `+${item.score}`
    : String(item.score);

  return `
    <tr>
      <td>${criteriaEscape(item.code)}</td>
      <td>${criteriaEscape(item.type)}</td>
      <td>${criteriaEscape(item.reason)}</td>
      <td class="${scoreClass}">${scoreText}점</td>
      <td>${criteriaEscape(item.start)}</td>
    </tr>
  `;
}

// 업로드 미리보기
function showCriteriaPreview(items) {
  const section = document.getElementById("criteria-preview");

  document.getElementById("criteria-preview-count").textContent =
    `${items.length}개 항목`;

  document.getElementById("criteria-preview-body").innerHTML =
    items.map(criteriaTableRow).join("");

  section.hidden = false;
}

// 적용일별 기준 표시
function renderCriteriaGroups() {
  const container = document.getElementById("criteria-groups");
  const filter = document.getElementById("criteria-date-filter");

  if (!container || !filter) return;

  const selected = filter.value;

  const dates = [...new Set(criteriaData.map(x => x.start))]
    .sort((a, b) => b.localeCompare(a));

  filter.replaceChildren(new Option("전체 적용일", "all"));

  dates.forEach(date => {
    filter.add(new Option(date, date));
  });

  filter.value = dates.includes(selected) ? selected : "all";

  const visibleDates = filter.value === "all"
    ? dates
    : [filter.value];

  if (!visibleDates.length) {
    container.innerHTML =
      '<p class="criteria-empty">등록된 기준이 없습니다.</p>';
    return;
  }

  container.innerHTML = visibleDates.map(date => {
    const items = criteriaData.filter(x => x.start === date);
    const isUsed = items.some(x => x.status === "사용");

    return `
      <section class="criteria-group">
        <div class="criteria-group-header">
          <div>
            <h3>${criteriaEscape(date)}</h3>
            <small>${items.length}개 항목</small>
          </div>
          <span class="criteria-status ${isUsed ? "used" : "ended"}">
            ${isUsed ? "사용" : "종료"}
          </span>
        </div>

        <div class="criteria-table-wrap">
          <table class="criteria-table">
            <thead>
              <tr>
                <th>항목코드</th>
                <th>구분</th>
                <th>사유</th>
                <th>점수</th>
                <th>적용시작일</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(criteriaTableRow).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }).join("");
}

// 파일 선택 및 화면 이벤트
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("criteria-file");
  const fileName = document.getElementById("criteria-file-name");
  const submit = document.getElementById("criteria-upload-submit");
  const cancel = document.getElementById("criteria-preview-cancel");
  const filter = document.getElementById("criteria-date-filter");

  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    fileName.textContent = file.name;

    try {
      pendingCriteria = await readCriteriaExcel(file);
      showCriteriaPreview(pendingCriteria);
    } catch (error) {
      alert(error.message);
      pendingCriteria = [];
      document.getElementById("criteria-preview").hidden = true;
    }
  });

  cancel.addEventListener("click", () => {
    pendingCriteria = [];
    fileInput.value = "";
    fileName.textContent = "";
    document.getElementById("criteria-preview").hidden = true;
  });

  submit.addEventListener("click", () => {
    if (!pendingCriteria.length) return;

    // 현재는 브라우저 화면에만 반영
    criteriaData = [
      ...criteriaData.map(item => ({
        ...item,
        status: "종료"
      })),
      ...pendingCriteria
    ];

    pendingCriteria = [];

    document.getElementById("criteria-preview").hidden = true;
    fileInput.value = "";
    fileName.textContent = "";

    renderCriteriaGroups();
    alert("화면에 새 기준이 반영되었습니다.");
  });

  filter.addEventListener("change", renderCriteriaGroups);

  renderCriteriaGroups();
});


/* ==============================
   선도부원 관리
============================== */

let prefectsData = [];
let pendingPrefects = [];

// HTML 특수문자 처리
function prefectsEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

// 엑셀 읽기
async function readPrefectsExcel(file) {
  if (typeof XLSX === "undefined") {
    throw new Error("엑셀 라이브러리를 불러오지 못했습니다.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false
  });

  if (!rows.length) {
    throw new Error("엑셀 파일에 데이터가 없습니다.");
  }

  const required = ["학년도", "학년", "반", "번호", "이름", "역할"];

  for (const column of required) {
    if (!Object.hasOwn(rows[0], column)) {
      throw new Error(`엑셀에 '${column}' 열이 없습니다.`);
    }
  }

  const members = rows.map((row, index) => {
    const year = String(row["학년도"]).trim();
    const grade = String(row["학년"]).trim();
    const classNo = String(row["반"]).trim();
    const number = String(row["번호"]).trim();
    const name = String(row["이름"]).trim();
    const role = String(row["역할"]).trim();

    if (!year || !grade || !classNo || !number || !name) {
      throw new Error(`${index + 2}행: 필수 정보가 비어 있습니다.`);
    }

    if (!["선도부", "교사"].includes(role)) {
      throw new Error(`${index + 2}행: 역할을 확인하세요.`);
    }

    return {
      year,
      grade,
      classNo,
      number,
      name,
      role,
      key: "",
      status: "사용"
    };
  });

  const ids = members.map(member =>
    [
      member.year,
      member.grade,
      member.classNo,
      member.number
    ].join("-")
  );

  if (new Set(ids).size !== ids.length) {
    throw new Error("엑셀에 중복된 학번이 있습니다.");
  }

  return members;
}

// 명단 표시
function renderPrefects() {
  const tbody = document.getElementById("prefects-table-body");
  const count = document.getElementById("prefects-result-count");
  const yearFilter = document.getElementById("prefects-year-filter");
  const statusFilter = document.getElementById("prefects-status-filter");
  const search = document.getElementById("prefects-search");

  if (!tbody || !yearFilter) return;

  const selectedYear = yearFilter.value;

  const years = [...new Set(prefectsData.map(p => p.year))]
    .sort((a, b) => b.localeCompare(a));

  yearFilter.replaceChildren(
    new Option("전체 학년도", "all")
  );

  years.forEach(year => {
    yearFilter.add(new Option(`${year}학년도`, year));
  });

  yearFilter.value = years.includes(selectedYear)
    ? selectedYear
    : "all";

  const selectedStatus = statusFilter.value;
  const keyword = search.value.trim().toLowerCase();

  const filtered = prefectsData.filter(member => {
    const matchYear =
      yearFilter.value === "all" ||
      member.year === yearFilter.value;

    const matchStatus =
      selectedStatus === "all" ||
      member.status === selectedStatus;

    const matchName =
      member.name.toLowerCase().includes(keyword);

    return matchYear && matchStatus && matchName;
  });

  count.textContent = `조회 결과 ${filtered.length}명`;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="prefects-empty">
          조회된 선도부원이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(member => {
    const active = member.status === "사용";

    const statusClass = active ? "active" : "ended";

    const keyText = member.key
      ? '<span class="prefects-key-issued">발급완료</span>'
      : '<span class="prefects-key-pending">미발급</span>';

    return `
      <tr>
        <td>${prefectsEscape(member.year)}</td>
        <td>${prefectsEscape(member.grade)}</td>
        <td>${prefectsEscape(member.classNo)}</td>
        <td>${prefectsEscape(member.number)}</td>
        <td>${prefectsEscape(member.name)}</td>
        <td>${prefectsEscape(member.role)}</td>
        <td>${keyText}</td>
        <td>
          <span class="prefects-status ${statusClass}">
            ${prefectsEscape(member.status)}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// 업로드 화면 초기화
function resetPrefectsUpload() {
  pendingPrefects = [];

  document.getElementById("prefects-file").value = "";
  document.getElementById("prefects-upload-preview").hidden = true;
}

// 이벤트
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("prefects-file");
  const preview = document.getElementById("prefects-upload-preview");
  const fileName = document.getElementById("prefects-selected-file");
  const uploadCount = document.getElementById("prefects-upload-count");

  const confirm = document.getElementById("prefects-confirm-upload");
  const cancel = document.getElementById("prefects-cancel-upload");

  const yearFilter = document.getElementById("prefects-year-filter");
  const statusFilter = document.getElementById("prefects-status-filter");
  const search = document.getElementById("prefects-search");

  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    try {
      pendingPrefects = await readPrefectsExcel(file);

      fileName.textContent = file.name;
      uploadCount.textContent =
        `${pendingPrefects.length}명 등록 예정`;

      preview.hidden = false;

    } catch (error) {
      alert(error.message);
      resetPrefectsUpload();
    }
  });

  confirm.addEventListener("click", () => {
    if (!pendingPrefects.length) return;

    const approved = confirmPrefectsReplacement();

    if (!approved) return;

    // 현재는 브라우저 화면에서만 반영
    prefectsData = [
      ...prefectsData.map(member => ({
        ...member,
        status: "종료"
      })),
      ...pendingPrefects
    ];

    resetPrefectsUpload();
    renderPrefects();

    alert("명단이 화면에 반영되었습니다.");
  });

  cancel.addEventListener("click", resetPrefectsUpload);

  yearFilter.addEventListener("change", renderPrefects);
  statusFilter.addEventListener("change", renderPrefects);
  search.addEventListener("input", renderPrefects);

  renderPrefects();
});

// 기존 명단 종료 여부 확인
function confirmPrefectsReplacement() {
  return window.confirm(
    "새 명단을 등록하면 기존 사용 명단은 종료 상태로 변경됩니다. 계속할까요?"
  );
}


/* ========================================
   전체 - 화면 전환 기능 코드
======================================== */

document.addEventListener("DOMContentLoaded", () => {

  // 페이지 요소
  const pages = {
    home: document.getElementById("home-page"),
    students: document.getElementById("students-page"),
    records: document.getElementById("records-page"),
    criteria: document.getElementById("criteria-page"),
    prefects: document.getElementById("prefects-page")
  };

  // 사이드바 메뉴
  const navLinks = document.querySelectorAll(
    ".sidebar-nav .nav-link"
  );

  // 대상 페이지 이름
  const pageTitles = {
    home: "홈",
    students: "대상자 관리",
    records: "기록 내역",
    criteria: "상벌점 기준",
    prefects: "선도부원 관리"
  };

  /* 화면 전환 */
  function showPage(pageName) {
    if (!pages[pageName]) {
      console.warn("미구현 페이지:", pageName);
      return;
    }

    // 모든 페이지 숨기기
    Object.values(pages).forEach(page => {
      if (page) {
        page.hidden = true;
      }
    });

    pages[pageName].hidden = false;

    navLinks.forEach(link => {
      const target = link.getAttribute("href");

      link.classList.toggle(
        "active",
        target === "#" + pageName
      );
    });
    const breadcrumb = document.querySelector(
      ".breadcrumb"
    );

    if (breadcrumb) {
      breadcrumb.textContent =
        "생활지도 관리 / " + pageTitles[pageName];
    }
  }
  navLinks.forEach(link => {

    link.addEventListener("click", event => {
      const pageName = link
        .getAttribute("href")
        .replace("#", "");
      if (!pages[pageName]) {
        event.preventDefault();
        return;
      }
      event.preventDefault();

      window.location.hash = pageName;
      showPage(pageName);
    });

  });

  window.addEventListener("hashchange", () => {
    const pageName = window.location.hash.replace("#", "");

    if (pages[pageName]) {
      showPage(pageName);
    }
  });
  const initialPage =
    window.location.hash.replace("#", "") || "home";

  showPage(
    pages[initialPage] ? initialPage : "home"
  );

});


