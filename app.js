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


/* ========================================
   상벌점 업로드
======================================== */
document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("criteria-start-date");
  const fileInput = document.getElementById("criteria-excel");
  const uploadBtn = document.getElementById("criteria-upload-btn");
  const status = document.getElementById("criteria-upload-status");

  if (!dateInput || !fileInput || !uploadBtn || !status) {
    console.error("상벌점 기준 업로드 HTML 요소가 없습니다.");
    return;
  }

  if (!dateInput.value) {
    const now = new Date();
    const localDate = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    );

    dateInput.value = localDate.toISOString().slice(0, 10);
  }

  uploadBtn.addEventListener("click", () => {
    if (!dateInput.value) {
      alert("적용 시작일을 선택해 주세요.");
      return;
    }

    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    uploadBtn.disabled = true;

    try {
      if (typeof XLSX === "undefined") {
        throw new Error("엑셀 라이브러리가 로드되지 않았습니다.");
      }

      status.textContent = "엑셀 파일을 읽는 중입니다.";

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false
      });

      if (!rows.length) {
        throw new Error("엑셀에 등록할 항목이 없습니다.");
      }

      const criteria = rows.map((row, index) => {
        const type = String(row["구분"] || "").trim();
        const reason = String(row["사유"] || "").trim();
        const rawScore = row["점수"];

        if (
          !type ||
          !reason ||
          rawScore === "" ||
          rawScore == null
        ) {
          throw new Error(
            `엑셀 ${index + 2}행에 빈 항목이 있습니다.`
          );
        }

        const score = Number(rawScore);

        if (!["상점", "벌점", "상쇄점"].includes(type)) {
          throw new Error(
            `엑셀 ${index + 2}행: 구분 오류`
          );
        }

        if (!Number.isInteger(score) || score === 0) {
          throw new Error(
            `엑셀 ${index + 2}행: 점수 오류`
          );
        }

        return {
          type,
          reason,
          score
        };
      });

      const confirmed = confirm(
        `파일: ${file.name}\n` +
        `적용 시작일: ${dateInput.value}\n` +
        `등록 항목: ${criteria.length}개\n\n` +
        "이 기준을 Google Sheets에 등록할까요?"
      );

      if (!confirmed) {
        status.textContent = "업로드가 취소되었습니다.";
        return;
      }

      status.textContent = "Google Sheets에 저장 중입니다.";

      const result = await uploadCriteriaToGAS(
        criteria,
        dateInput.value
      );

      status.textContent =
        `저장 완료: ${result.saved}개 항목`;

      alert(
        `상벌점 기준 ${result.saved}개가 저장되었습니다.\n` +
        `시작 행: ${result.startRow}`
      );

    } catch (error) {
      console.error("상벌점 기준 업로드 오류:", error);

      status.textContent = "오류: " + error.message;

      alert("업로드 실패: " + error.message);

    } finally {
      fileInput.value = "";
      uploadBtn.disabled = false;
    }
  });
});

// 상벌점 업로드
function uploadCriteriaToGAS(criteria, startDate) {
  return new Promise((resolve, reject) => {

    const nonce = crypto.randomUUID();
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const input = document.createElement("input");

    iframe.name = "criteria_" + nonce.replaceAll("-", "");
    iframe.hidden = true;

    form.method = "POST";
    form.action = GAS_URL;
    form.target = iframe.name;
    form.hidden = true;

    input.type = "hidden";
    input.name = "packet";
    input.value = JSON.stringify({
      action: "saveCriteriaTest",
      payload: { criteria, startDate },
      nonce,
      replyOrigin: location.origin
    });

    form.appendChild(input);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      form.remove();
      iframe.remove();
    }

    function receive(event) {
      let host;

      try {
        const url = new URL(event.origin);
        if (url.protocol !== "https:") return;
        host = url.hostname;
      } catch {
        return;
      }

      if (
        host !== "script.google.com" &&
        host !== "script.googleusercontent.com" &&
        !host.endsWith("-script.googleusercontent.com")
      ) return;

      const result = event.data;

      if (
        result?.channel !== "criteria-upload-v1" ||
        result.nonce !== nonce
      ) return;

      cleanup();

      if (result.ok) {
        resolve(result.data);
      } else {
        reject(new Error(result.error || "저장 실패"));
      }
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("서버 응답 시간 초과"));
    }, 45000);

    window.addEventListener("message", receive);

    document.body.append(iframe, form);
    form.submit();
  });
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
  return {
    merit: Number(student.merit) || 0,
    demerit: Number(student.demerit) || 0,
    offset: Number(student.offset) || 0,
    total: Number(student.total) || 0,
    classScore: Number(student.classScore) || 0,
    count: 0
  };
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
    ?.addEventListener("click", loadTeacherStudents);

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

async function loadTeacherStudents() {
  const tbody = document.getElementById("students-table-body");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8">학생 데이터를 불러오는 중입니다.</td>
    </tr>
  `;

  try {
    const url = new URL(GAS_URL);
    url.searchParams.set("action", "teacherStudents");
    url.searchParams.set("_", Date.now());

    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "학생 조회 실패");
    }

    // 기존 대상자 관리 기능에 데이터 전달
    setTeacherStudentData(data);

    console.log("학생 데이터 연결 성공:", {
      students: teacherStudents.length,
      criteria: teacherCriteria.length,
      records: teacherRecords.length
    });

  } catch (error) {
    console.error("대상자 관리 오류:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          학생 데이터를 불러오지 못했습니다.
        </td>
      </tr>
    `;

    alert("학생 데이터 조회 실패: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadTeacherStudents();
});


function uploadPrefectsToGAS(users) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "prefectCallback_" + Math.random().toString(36).slice(2);

    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("서버 응답 시간이 초과되었습니다."));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("서버 연결에 실패했습니다."));
    };

    script.src =
      GAS_URL +
      "?action=importPrefects" +
      "&callback=" + encodeURIComponent(callbackName) +
      "&users=" + encodeURIComponent(JSON.stringify(users));

    document.body.appendChild(script);
  });
}
