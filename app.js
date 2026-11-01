/* ========================================
    홈-전체 학생 수 표시
======================================== */


const GAS_URL = "https://script.google.com/macros/s/AKfycbxUCWCbx8Q79oAjtGd_De903gMBAFGI53-6Km132JYKAVFJhxCqasYVWN2zpbj627oujw/exec";

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

/* =====================================
   홈 화면 - 이번 달 상벌점 통계
===================================== */

async function loadMonthlyStats() {
  try {
    const url = new URL(GAS_URL);
    url.searchParams.set("action", "monthlyStats");

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "통계 조회 실패");
    }

    // 이번 달 상점
    const reward = document.getElementById("monthly-reward");
    if (reward) {
      reward.textContent = `${data.meritPoints}점`;
    }

    // 이번 달 벌점
    const penalty = document.getElementById("monthly-penalty");
    if (penalty) {
      penalty.textContent = `${data.demeritPoints}점`;
    }

    // 이번 달 기록 수
    const count = document.getElementById("monthly-record-count");
    if (count) {
      count.textContent = `${data.demeritCount}건`;
    }

    console.log("이번 달 통계 조회 성공:", data);

  } catch (error) {
    console.error("이번 달 통계 조회 오류:", error);
  }
}

document.addEventListener(
  "DOMContentLoaded",
  loadMonthlyStats
);


/* =====================================
   상벌점 부여 기록 조회
===================================== */

function escapeRecordHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/*그 뭔 이상한 T나오는 ISO 8601 형식 지움 */
function formatRecordDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function renderPointRecords(records) {
  const tbody = document.getElementById("student-records-body");
  const count = document.getElementById("records-result-count");

  if (!tbody) return;

  if (!Array.isArray(records)) {
    throw new Error("기록 데이터 형식 오류");
  }

  if (count) {
    count.textContent = `조회 결과 ${records.length}건`;
  }

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">등록된 기록이 없습니다.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(record => `
    <tr>
      <td>${escapeRecordHtml(record.year)}</td>
      <td>${escapeRecordHtml(record.grade)}</td>
      <td>${escapeRecordHtml(record.classNo)}</td>
      <td>${escapeRecordHtml(record.number)}</td>
      <td>${escapeRecordHtml(record.name)}</td>
      <td>${escapeRecordHtml(record.code)}</td>
      <td>${escapeRecordHtml(record.score)}</td>
      <td>${escapeRecordHtml(formatRecordDate(record.date))}</td>
      <td>${escapeRecordHtml(record.requester)}</td>
      <td>${escapeRecordHtml(record.status)}</td>
    </tr>
  `).join("");
}

async function checkRecordsConnection() {
  const count = document.getElementById("records-result-count");
  const tbody = document.getElementById("student-records-body");

  if (!tbody) return;

  try {
    if (typeof GAS_URL === "undefined" || !GAS_URL) {
      throw new Error("GAS_URL이 설정되지 않았습니다.");
    }

    if (count) count.textContent = "불러오는 중...";

    const url = new URL(GAS_URL);
    url.searchParams.set("action", "pointRecords");

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("GAS 응답 확인:", {
      ok: data.ok,
      count: data.records?.length,
      error: data.error
    });

    if (!data.ok) {
      throw new Error(data.error || "기록 조회 실패");
    }

    if (!Array.isArray(data.records)) {
      throw new Error("GAS에서 records 배열을 반환하지 않았습니다.");
    }

    renderPointRecords(data.records);

  } catch (error) {
    console.error("상벌점 기록 조회 오류:", error);

    if (count) count.textContent = "연결 실패";

    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          기록을 불러오지 못했습니다.
        </td>
      </tr>
    `;
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

/* =========================================
   대상자 관리 페이지
========================================= */

let teacherStudents = [];
let teacherCriteria = [];
let teacherRecords = [];
let selectedTeacherStudent = null;

// HTML 특수문자 처리
function studentEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

// 숫자·학번 비교용
function sameNumber(a, b) {
  return Number(a) === Number(b);
}

// 유효 기록 확인
function validStudentRecord(record) {
  return !["취소", "반려"].includes(record.status);
}

// 학생별 점수 계산
function calculateStudentPoints(student) {
  const result = {
    merit: 0,
    demerit: 0,
    offset: 0,
    count: 0
  };

  const records = teacherRecords.filter(record =>
    record.studentId === student.id &&
    validStudentRecord(record)
  );

  for (const record of records) {
    const criterion = teacherCriteria.find(
      item => item.code === record.code
    );

    const type = record.type || criterion?.type;
    const points = Math.abs(Number(record.score) || 0);

    if (type === "상점") result.merit += points;
    if (type === "벌점") result.demerit += points;
    if (type === "상쇄점") result.offset += points;

    result.count++;
  }

  return result;
}

// 검색 조건 적용
function filterTeacherStudents() {
  const name = document.getElementById("students-search")
    ?.value.trim().toLowerCase() || "";

  const grade = document.getElementById("students-grade")
    ?.value || "";

  const classNo = document.getElementById("students-class")
    ?.value || "";

  const number = document.getElementById("students-number")
    ?.value.trim() || "";

  return teacherStudents.filter(student => {
    const nameMatch =
      !name || student.name.toLowerCase().includes(name);

    const gradeMatch =
      !grade || grade === "all" ||
      sameNumber(student.grade, grade);

    const classMatch =
      !classNo || classNo === "all" ||
      sameNumber(student.classNo, classNo);

    const numberMatch =
      !number || sameNumber(student.number, number);

    return nameMatch && gradeMatch &&
      classMatch && numberMatch;
  });
}

// 학생 목록 표시
function renderTeacherStudents() {
  const tbody = document.getElementById("students-table-body");
  const count = document.getElementById("students-result-count");

  if (!tbody) return;

  const students = filterTeacherStudents();

  if (count) {
    count.textContent = `조회 결과 ${students.length}명`;
  }

  if (!students.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">조회된 학생이 없습니다.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(student => {
    const points = calculateStudentPoints(student);

    return `
      <tr>
        <td>${studentEsc(student.grade)}</td>
        <td>${studentEsc(student.classNo)}</td>
        <td>${studentEsc(student.number)}</td>
        <td>${studentEsc(student.name)}</td>
        <td>${points.merit}점</td>
        <td>${points.demerit}점</td>
        <td>${points.offset}점</td>
        <td>
          <button
            type="button"
            class="button secondary small"
            data-teacher-student="${studentEsc(student.id)}"
          >상세 / 등록</button>
        </td>
      </tr>
    `;
  }).join("");
}

// 합계 카드 표시
function renderTeacherSummary() {
  let merit = 0;
  let demerit = 0;

  teacherStudents.forEach(student => {
    const points = calculateStudentPoints(student);
    merit += points.merit;
    demerit += points.demerit;
  });

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText("students-total", `${teacherStudents.length}명`);
  setText("students-reward-total", `${merit}점`);
  setText("students-penalty-total", `${demerit}점`);
}

// 데이터 연결 시 실행
function setTeacherStudentData(data) {
  teacherStudents = Array.isArray(data.students)
    ? data.students : [];

  teacherCriteria = Array.isArray(data.criteria)
    ? data.criteria : [];

  teacherRecords = Array.isArray(data.records)
    ? data.records : [];

  renderTeacherStudents();
  renderTeacherSummary();
}

// 검색 초기화
function resetTeacherStudentSearch() {
  ["students-search", "students-number"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["students-grade", "students-class"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });

  renderTeacherStudents();
}

// 학생 상세 및 기록 표시
function openTeacherStudentDetail(id) {
  const student = teacherStudents.find(s => s.id === id);
  if (!student) return;

  selectedTeacherStudent = student;

  const points = calculateStudentPoints(student);

  const records = teacherRecords.filter(
    record => record.studentId === id
  );

  const message = [
    `${student.name} (${student.grade}학년 ${student.classNo}반 ${student.number}번)`,
    "",
    `상점: ${points.merit}점`,
    `벌점: ${points.demerit}점`,
    `상쇄점: ${points.offset}점`,
    `전체 기록: ${records.length}건`
  ].join("\n");

  alert(message);
}

// 화면 이벤트
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("students-search-btn")
    ?.addEventListener("click", renderTeacherStudents);

  document.getElementById("students-reset-btn")
    ?.addEventListener("click", resetTeacherStudentSearch);

  document.getElementById("students-refresh")
    ?.addEventListener("click", () => {
      renderTeacherStudents();
      renderTeacherSummary();
    });

  ["students-search", "students-number"].forEach(id => {
    document.getElementById(id)
      ?.addEventListener("input", renderTeacherStudents);
  });

  ["students-grade", "students-class"].forEach(id => {
    document.getElementById(id)
      ?.addEventListener("change", renderTeacherStudents);
  });

  document.getElementById("students-table-body")
    ?.addEventListener("click", event => {
      const button = event.target.closest(
        "[data-teacher-student]"
      );

      if (button) {
        openTeacherStudentDetail(
          button.dataset.teacherStudent
        );
      }
    });
});


