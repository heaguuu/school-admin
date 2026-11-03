/* ========================================
    홈-전체 학생 수 표시
======================================== */


const GAS_URL = "https://script.google.com/macros/s/AKfycby5jCVwAh8-YVe-gpYuRn2uHiAXYf7dNIARudvf188sr73VcG0P4z0xvLD81SsSLXkh/exec";

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

// [사용]하는 상벌점만 사용



/* ========================================
   상벌점 기준 관리
   엑셀 업로드 + Google Sheets 연동
======================================== */

let criteriaData = [];
let pendingCriteria = [];
let selectedCriteriaType = "상점";

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

// 날짜 기본값: 오늘
function setCriteriaToday() {
  const input = document.getElementById("criteria-start-date");
  if (!input) return;

  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );
  input.value = local.toISOString().slice(0, 10);
}

// 엑셀 파일 읽기
async function readCriteriaUpload(file) {
  if (typeof XLSX === "undefined") {
    throw new Error("엑셀 라이브러리를 불러오지 못했습니다.");
  }

  const workbook = XLSX.read(
    await file.arrayBuffer(),
    { type: "array" }
  );

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false
  });

  if (!rows.length) {
    throw new Error("엑셀에 등록할 항목이 없습니다.");
  }

  if (rows.length > 500) {
    throw new Error("한 번에 500개까지만 등록할 수 있습니다.");
  }

  return rows.map((row, index) => {
    const type = String(row["구분"] ?? "").trim();
    const reason = String(row["사유"] ?? "").trim();
    const rawScore = String(row["점수"] ?? "").trim();
    const score = Number(rawScore);

    if (!["상점", "벌점", "상쇄점"].includes(type)) {
      throw new Error(`엑셀 ${index + 2}행: 구분 오류`);
    }

    if (!reason || reason.length > 150) {
      throw new Error(`엑셀 ${index + 2}행: 사유 오류`);
    }

    if (rawScore === "" ||
      !Number.isInteger(score) ||
      score === 0) {
      throw new Error(`엑셀 ${index + 2}행: 점수 오류`);
    }

    return {
      type,
      reason,
      score
    };
  });
}

// 업로드 미리보기
function showCriteriaUploadPreview() {
  const preview = document.getElementById("criteria-preview");
  const tbody = document.getElementById("criteria-preview-body");
  const count = document.getElementById("criteria-preview-count");
  const startDate =
    document.getElementById("criteria-start-date").value;

  count.textContent = `${pendingCriteria.length}개 항목`;

  tbody.innerHTML = pendingCriteria.map(item => `
    <tr>
      <td>${criteriaEscape(item.type)}</td>
      <td>${criteriaEscape(item.reason)}</td>
      <td>${item.score > 0 ? "+" : ""}${item.score}점</td>
      <td>${criteriaEscape(startDate)}</td>
    </tr>
  `).join("");

  preview.hidden = false;
}

// Google Sheets 기준 목록 조회
async function loadCriteriaList() {
  const status = document.getElementById("criteria-upload-status");

  try {
    const url = new URL(GAS_URL);
    url.searchParams.set("action", "criteriaList");
    url.searchParams.set("_", Date.now());

    const response = await fetch(url.toString(), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.ok || !Array.isArray(result.criteria)) {
      throw new Error(result.error || "기준 조회 실패");
    }

    criteriaData = result.criteria;
    updateCriteriaDateFilter();
    renderCriteriaList();

  } catch (error) {
    console.error("기준 조회 오류:", error);
    if (status) {
      status.textContent = "기준 조회 실패: " + error.message;
    }
  }
}

// 적용일 필터
function updateCriteriaDateFilter() {
  const select = document.getElementById("criteria-date-filter");
  const selected = select.value;

  const dates = [...new Set(
    criteriaData.map(item => item.start).filter(Boolean)
  )].sort().reverse();

  select.replaceChildren(
    new Option("전체 적용일", "all")
  );

  dates.forEach(date => {
    select.add(new Option(date, date));
  });

  select.value = dates.includes(selected) ? selected : "all";
}

// 구분별 기준 목록
function renderCriteriaList() {
  const tbody = document.getElementById("criteria-list-body");
  const title = document.getElementById("criteria-list-title");
  const count = document.getElementById("criteria-result-count");
  const date = document.getElementById("criteria-date-filter").value;

  title.textContent = selectedCriteriaType + " 기준";

  const rows = criteriaData.filter(item => {
    return item.type === selectedCriteriaType &&
      (date === "all" || item.start === date);
  });

  count.textContent = `조회 결과 ${rows.length}개`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="5">등록된 기준이 없습니다.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${criteriaEscape(item.code)}</td>
      <td>${criteriaEscape(item.reason)}</td>
      <td>${item.score > 0 ? "+" : ""}${item.score}점</td>
      <td>${criteriaEscape(item.start)}</td>
      <td>${criteriaEscape(item.status)}</td>
    </tr>
  `).join("");
}

// GAS POST 요청


function uploadCriteriaToGAS(criteria, startDate) {
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID();

    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const field = document.createElement("input");

    iframe.name = "criteria_" + nonce.replaceAll("-", "");
    iframe.hidden = true;

    form.method = "POST";
    form.action = GAS_URL;
    form.target = iframe.name;
    form.hidden = true;

    field.type = "hidden";
    field.name = "packet";
    field.value = JSON.stringify({
      action: "saveCriteriaTest",
      payload: { criteria, startDate },
      nonce,
      replyOrigin: location.origin
    });

    form.append(field);

    console.log("[기준 업로드] 요청 시작", {
      count: criteria.length,
      startDate,
      nonce
    });

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      form.remove();
      iframe.remove();
    }

    function receive(event) {
      const result = event.data;

      if (
        !result ||
        result.channel !== "criteria-upload-v1" ||
        result.nonce !== nonce
      ) return;

      console.log("[기준 업로드] 응답 출처:", event.origin);
      console.log("[기준 업로드] 응답:", result);

      let host;

      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }

      const allowed =
        host === "script.google.com" ||
        host === "script.googleusercontent.com" ||
        host.endsWith(".googleusercontent.com");

      if (!allowed) {
        console.warn("허용되지 않은 응답 출처:", host);
        return;
      }

      cleanup();

      if (result.ok) {
        resolve(result.data);
      } else {
        reject(new Error(result.error || "저장 실패"));
      }
    }

    const timer = setTimeout(() => {
      cleanup();

      reject(new Error(
        "서버 응답 시간 초과. GAS 실행 로그를 확인하세요."
      ));
    }, 45000);

    window.addEventListener("message", receive);

    document.body.append(iframe, form);
    form.submit();
  });
}



// 화면 이벤트
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("criteria-excel");
  const chooseBtn = document.getElementById("criteria-upload-btn");
  const submitBtn = document.getElementById("criteria-upload-submit");
  const cancelBtn = document.getElementById("criteria-preview-cancel");
  const preview = document.getElementById("criteria-preview");
  const status = document.getElementById("criteria-upload-status");
  const fileName = document.getElementById("criteria-file-name");
  const dateInput = document.getElementById("criteria-start-date");

  if (!fileInput || !chooseBtn) return;

  setCriteriaToday();
  loadCriteriaList();

  // 탭 전환
  document.querySelectorAll("[data-criteria-type]")
    .forEach(button => {
      button.addEventListener("click", () => {
        selectedCriteriaType = button.dataset.criteriaType;

        document.querySelectorAll("[data-criteria-type]")
          .forEach(tab => {
            tab.classList.toggle(
              "active",
              tab === button
            );
          });

        renderCriteriaList();
      });
    });

  // 기준 조회
  document.getElementById("criteria-refresh")
    ?.addEventListener("click", loadCriteriaList);

  document.getElementById("criteria-date-filter")
    ?.addEventListener("change", renderCriteriaList);

  // 파일 선택
  chooseBtn.addEventListener("click", () => {
    if (!dateInput.value) {
      alert("적용 시작일을 선택하세요.");
      return;
    }

    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      pendingCriteria = await readCriteriaUpload(file);
      fileName.textContent = file.name;
      status.textContent = "";
      showCriteriaUploadPreview();
    } catch (error) {
      pendingCriteria = [];
      preview.hidden = true;
      fileInput.value = "";
      status.textContent = "오류: " + error.message;
    }
  });

  // 취소
  cancelBtn.addEventListener("click", () => {
    pendingCriteria = [];
    preview.hidden = true;
    fileInput.value = "";
    fileName.textContent = "";
  });

  // 기준 등록
  submitBtn.addEventListener("click", async () => {
    if (!pendingCriteria.length) return;

    const startDate = dateInput.value;

    if (!startDate) {
      alert("적용 시작일을 선택하세요.");
      return;
    }

    if (!confirm(
      `${startDate}부터 적용할 기준 ` +
      `${pendingCriteria.length}개를 등록할까요?`
    )) return;

    submitBtn.disabled = true;
    status.textContent = "Google Sheets에 저장 중...";

    try {
      const result = await uploadCriteriaToGAS(
        pendingCriteria,
        startDate
      );

      status.textContent =
        `${result.saved}개 기준 저장 완료`;

      pendingCriteria = [];
      preview.hidden = true;
      fileInput.value = "";
      fileName.textContent = "";

      await loadCriteriaList();

    } catch (error) {
      status.textContent = "등록 실패: " + error.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
});


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
    prefects: document.getElementById("prefects-page"),
    statistics: document.getElementById("statistics-page")
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
    prefects: "선도부원 관리",
    statistics: "상벌점 통계"
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
  const student = teacherStudents.find(s => String(s.id) === String(id));
  if (!student) return;
  selectedTeacherStudent = student;
  const points = calculateStudentPoints(student);
  document.getElementById("reward-student-name").textContent = student.name;
  document.getElementById("reward-student-class").textContent = `${student.grade}학년 ${student.classNo}반 ${student.number}번`;
  document.getElementById("reward-student-points").textContent = `상점 ${points.merit}점 · 벌점 ${points.demerit}점 · 상쇄점 ${points.offset}점`;
  document.getElementById("reward-student-id").value = student.id;
  document.getElementById("reward-note").value = "";
  document.getElementById("reward-type").value = "상점";
  document.getElementById("reward-status").textContent = "기준을 불러오는 중...";
  document.getElementById("reward-dialog").showModal();
  loadAdminPointCriteria();
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


/* ===== 선도부원 관리: Google Sheets 연동 ===== */
let prefectRows = [];
let pendingPrefectRows = [];

function prefectRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const nonce = (crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`);
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const field = document.createElement('input');
    iframe.name = 'prefect_' + nonce.replace(/[^a-zA-Z0-9]/g, '');
    iframe.hidden = true;
    form.method = 'POST';
    form.action = GAS_URL;
    form.target = iframe.name;
    form.hidden = true;
    field.name = 'packet';
    field.type = 'hidden';
    field.value = JSON.stringify({ action, payload, nonce, replyOrigin: location.origin });
    form.append(field);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      form.remove();
      iframe.remove();
    }
    function receive(event) {
      let host;
      try { host = new URL(event.origin).hostname; } catch { return; }
      if (host !== 'script.google.com' && host !== 'script.googleusercontent.com' && !host.endsWith('-script.googleusercontent.com')) return;
      if (event.data?.channel !== 'prefect-manage-v1' || event.data.nonce !== nonce) return;
      cleanup();
      if (event.data.ok) resolve(event.data.data);
      else reject(new Error(event.data.error || '요청 실패'));
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('서버 응답 시간 초과. 시트를 확인한 뒤 새로고침해 주세요.'));
    }, 45000);
    window.addEventListener('message', receive);
    document.body.append(iframe, form);
    form.submit();
  });
}

function prefectEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderPrefects() {
  const term = document.getElementById('prefects-search')?.value.trim().toLowerCase() || '';
  const rows = prefectRows.filter(x => x.name.toLowerCase().includes(term));
  document.getElementById('prefects-result-count').textContent = `조회 ${rows.length}명 / 전체 ${prefectRows.length}명`;
  document.getElementById('prefects-table-body').innerHTML = rows.length
    ? rows.map(x => `<tr>
        <td>${prefectEsc(x.grade)}</td><td>${prefectEsc(x.classNo)}</td>
        <td>${prefectEsc(x.number)}</td><td>${prefectEsc(x.name)}</td>
        <td>${x.authKey ? prefectEsc(x.authKey) : '미발급'}</td>
        <td><button type="button" class="button secondary small" data-prefect-key="${Number(x.row)}" ${x.authKey ? 'disabled' : ''}>${x.authKey ? '발급 완료' : '인증키 발급'}</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6">등록된 선도부원이 없습니다.</td></tr>';
}

async function loadPrefects() {
  const msg = document.getElementById('prefects-list-message');
  if (msg) msg.textContent = '명부 불러오는 중...';
  try {
    const url = new URL(GAS_URL);
    url.searchParams.set('action', 'prefectList');
    url.searchParams.set('_', String(Date.now()));
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.users)) throw new Error(result.error || '명부 조회 실패');
    prefectRows = result.users;
    renderPrefects();
    if (msg) msg.textContent = '';
  } catch (error) {
    if (msg) msg.textContent = '명부 조회 실패: ' + error.message;
  }
}


// 선도부원 엑셀 파일 읽는다.
async function readPrefectsExcel(file) {
  if (typeof XLSX === 'undefined') throw new Error('엑셀 라이브러리가 없습니다.');
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '', raw: false });
  if (!rows.length) throw new Error('엑셀에 선도부원 명단이 없습니다.');
  const seen = new Set();
  return rows.map((row, index) => {
    const grade = String(row['학년'] ?? '').trim();
    const classNo = String(row['반'] ?? '').trim();
    const number = String(row['번호'] ?? '').trim();
    const name = String(row['이름'] ?? '').trim();
    if (!/^[1-3]$/.test(grade) || !/^\d+$/.test(classNo) || !/^\d+$/.test(number) || !name)
      throw new Error(`엑셀 ${index + 2}행: 학년·반·번호·이름을 확인하세요.`);
    const key = `${grade}-${Number(classNo)}-${Number(number)}`;
    if (seen.has(key)) throw new Error(`엑셀 ${index + 2}행: 학년·반·번호 중복`);
    seen.add(key);
    return { grade, classNo: String(Number(classNo)), number: String(Number(number)), name };
  });
}

// 선도부원 명단 업로드
document.addEventListener('DOMContentLoaded', () => {
  const file = document.getElementById('prefects-file');
  const preview = document.getElementById('prefects-upload-preview');
  const message = document.getElementById('prefects-upload-message');
  const confirmBtn = document.getElementById('prefects-confirm-upload');
  if (!file || !preview || !confirmBtn) return;
  loadPrefects();
  document.getElementById('prefects-refresh')?.addEventListener('click', loadPrefects);
  document.getElementById('prefects-search')?.addEventListener('input', renderPrefects);
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      pendingPrefectRows = await readPrefectsExcel(selected);
      document.getElementById('prefects-selected-file').textContent = selected.name;
      document.getElementById('prefects-upload-count').textContent = `${pendingPrefectRows.length}명`;
      preview.hidden = false;
      message.hidden = true;
    } catch (error) {
      pendingPrefectRows = [];
      preview.hidden = true;
      file.value = '';
      alert(error.message);
    }
  });
  document.getElementById('prefects-cancel-upload')?.addEventListener('click', () => {
    pendingPrefectRows = [];
    file.value = '';
    preview.hidden = true;
  });
  confirmBtn.addEventListener('click', async () => {
    if (!pendingPrefectRows.length) return;
    if (!confirm(`현재 선도부원 명부를 지우고 ${pendingPrefectRows.length}명으로 교체할까요?\n기존 인증키도 초기화됩니다.`)) return;
    confirmBtn.disabled = true;
    message.hidden = false;
    message.textContent = 'Google Sheets에 명부 저장 중...';
    try {
      const result = await prefectRequest('prefectReplace', { users: pendingPrefectRows });
      message.textContent = `${result.saved}명 저장 완료`;
      pendingPrefectRows = [];
      file.value = '';
      await loadPrefects();
      preview.hidden = true;
    } catch (error) {
      message.textContent = '등록 실패: ' + error.message;
    } finally { confirmBtn.disabled = false; }
  });
  document.getElementById('prefects-table-body')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-prefect-key]');
    if (!button || button.disabled) return;
    const row = Number(button.dataset.prefectKey);
    const user = prefectRows.find(x => x.row === row);
    if (!user || !confirm(`${user.name} 학생의 6자리 인증키를 발급할까요?`)) return;
    button.disabled = true;
    const msg = document.getElementById('prefects-list-message');
    if (msg) msg.textContent = '인증키 발급 중...';
    try {
      await prefectRequest('prefectIssueKey', { row, grade: user.grade, classNo: user.classNo, number: user.number, name: user.name });
      await loadPrefects();
    } catch (error) {
      if (msg) msg.textContent = '발급 실패: ' + error.message;
      button.disabled = false;
    }
  });
});

/* ===== 학생 상세: 상벌점 등록 (Google Sheets 연동) ===== */
let adminPointCriteria = [];
function renderAdminPointCriteria() {
  const type = document.getElementById('reward-type').value;
  const select = document.getElementById('reward-criterion');
  select.replaceChildren(new Option('항목을 선택하세요', ''));
  adminPointCriteria.filter(x => x.type === type).forEach(x => {
    select.add(new Option(`${x.reason} (${Number(x.score) > 0 ? '+' : ''}${x.score}점)`, x.code));
  });
  document.getElementById('reward-score').value = '';
}

async function loadAdminPointCriteria() {
  const status = document.getElementById('reward-status');

  try {
    const url = new URL(GAS_URL);

    // Code.gs에 추가한 API와 이름 통일
    url.searchParams.set('action', 'activeCriteria');
    url.searchParams.set('_', String(Date.now()));

    const response = await fetch(url.toString(), {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || '기준 조회 실패');
    }

    if (!Array.isArray(result.criteria)) {
      throw new Error('기준 데이터 형식 오류');
    }

    adminPointCriteria = result.criteria;

    // 기존 항목 표시 함수 유지
    renderAdminPointCriteria();

    if (status) {
      status.textContent =
        `현재 사용 가능한 기준 ${adminPointCriteria.length}개`;
    }

    console.log('불러온 상벌점 기준:', adminPointCriteria);

  } catch (error) {
    adminPointCriteria = [];
    renderAdminPointCriteria();

    if (status) {
      status.textContent =
        '기준 조회 실패: ' + error.message;
    }

    console.error('상벌점 기준 조회 오류:', error);
  }
}

function adminPointPost(payload) {
  return new Promise((resolve, reject) => {
    const nonce = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    const frame = document.createElement('iframe');
    const form = document.createElement('form');
    const field = document.createElement('input');
    frame.name = 'adminpoint_' + nonce.replace(/[^a-zA-Z0-9]/g, '');
    frame.hidden = true;
    form.method = 'POST'; form.action = GAS_URL; form.target = frame.name; form.hidden = true;
    field.type = 'hidden'; field.name = 'packet';
    field.value = JSON.stringify({ action: 'adminPointSubmit', payload, nonce, replyOrigin: location.origin });
    form.append(field);
    function cleanup() { clearTimeout(timer); window.removeEventListener('message', receive); form.remove(); frame.remove(); }
    function receive(event) {
      let host;
      try { host = new URL(event.origin).hostname; } catch { return; }
      if (host !== 'script.google.com' && host !== 'script.googleusercontent.com' && !host.endsWith('-script.googleusercontent.com')) return;
      if (event.data?.channel !== 'admin-point-v1' || event.data.nonce !== nonce) return;
      cleanup();
      if (event.data.ok) resolve(event.data.data);
      else reject(new Error(event.data.error || '저장 실패'));
    }
    const timer = setTimeout(() => { cleanup(); reject(new Error('서버 응답 시간 초과 (시트에 저장되었을 수도 있으니 기록을 확인하세요)')); }, 45000);
    window.addEventListener('message', receive);
    document.body.append(frame, form);
    form.submit();
  });
}
document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('reward-dialog');
  const status = document.getElementById('reward-status');
  const close = () => dialog.close();
  document.getElementById('reward-close').addEventListener('click', close);
  document.getElementById('reward-cancel').addEventListener('click', close);
  document.getElementById('reward-type').addEventListener('change', renderAdminPointCriteria);
  document.getElementById('reward-criterion').addEventListener('change', event => {
    const item = adminPointCriteria.find(x => x.code === event.target.value);
    document.getElementById('reward-score').value = item ? `${item.score}점` : '';
  });
  document.getElementById('reward-form').addEventListener('submit', async event => {
    event.preventDefault();
    const student = selectedTeacherStudent;
    const code = document.getElementById('reward-criterion').value;
    const item = adminPointCriteria.find(x => x.code === code);
    if (!student || !item) { status.textContent = '학생과 항목을 선택하세요.'; return; }
    if (!confirm(`${student.name} 학생에게 ${item.reason} (${item.score}점)을 등록할까요?`)) return;
    const submit = document.getElementById('reward-submit');
    submit.disabled = true; status.textContent = 'Google Sheets에 저장 중...';
    try {
      console.log('[상벌점 등록] 요청 시작', {
        studentId: student.id,
        code
      });

      const result = await adminPointPost({
        studentId: student.id,
        code,
        note: document.getElementById('reward-note').value.trim()
      });

      console.log('[상벌점 등록] 서버 응답', result); status.textContent = `저장 완료 · 시트 ${result.row}행`;
      await Promise.allSettled([loadTeacherStudents(), checkRecordsConnection(), loadMonthlyStats()]);
      alert('상벌점 등록 완료! Google Sheets의 점수 부여 시트를 확인하세요.');
      close();
    } catch (error) { status.textContent = '등록 실패: ' + error.message; }
    finally { submit.disabled = false; }
  });
});



/* ==========================================
   상벌점 기준 조회 및 등록 팝업
   Google Sheets: 점수기준
========================================== */

let activePointCriteria = [];

// 1. Google Sheets에서 사용 중인 상벌점 기준 조회
async function loadActivePointCriteria() {
  const url = new URL(GAS_URL);
  url.searchParams.set("action", "activeCriteria");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("상벌점 기준 서버 연결 실패");
  }

  const result = await response.json();

  if (!result.ok || !Array.isArray(result.criteria)) {
    throw new Error(
      result.error || "상벌점 기준 조회 실패"
    );
  }

  activePointCriteria = result.criteria;
  return activePointCriteria;
}

// 2. 구분에 따라 항목 목록 표시
function renderActivePointCriteria(type) {
  const select = document.getElementById("reward-criterion");
  const scoreInput = document.getElementById("reward-score");

  if (!select || !scoreInput) return;

  // 구분값의 공백을 제거하여 비교
  const filtered = activePointCriteria.filter(item =>
    String(item.type || "").trim() === String(type).trim()
  );

  console.log("전체 상벌점 기준:", activePointCriteria);
  console.log("선택한 구분:", type);
  console.log("필터링된 항목:", filtered);

  select.replaceChildren(
    new Option("항목을 선택하세요", "")
  );

  filtered.forEach(item => {
    select.add(
      new Option(
        `${item.reason} (${item.score}점)`,
        item.code
      )
    );
  });

  scoreInput.value = "";
}

// 3. 항목 선택 시 점수 자동 표시
function initPointCriteriaEvents() {
  const select = document.getElementById("reward-criterion");
  const scoreInput = document.getElementById("reward-score");

  if (!select || !scoreInput) return;

  select.addEventListener("change", () => {
    const selected = activePointCriteria.find(
      item => item.code === select.value
    );

    scoreInput.value = selected
      ? `${selected.score}점`
      : "";
  });
}

// 4. 학생 상세 / 등록 팝업 열기
async function openRewardDialog(student) {
  const dialog = document.getElementById("reward-dialog");

  if (!dialog) {
    alert("상벌점 등록 창을 찾을 수 없습니다.");
    return;
  }

  // 학생 정보 표시
  document.getElementById("reward-student-name").textContent =
    student.name || student.studentName || "";

  document.getElementById("reward-student-class").textContent =
    `${student.grade}학년 ${student.classNo}반 ${student.number}번`;

  document.getElementById("reward-student-id").value =
    student.id || student.studentId || "";

  // 비고 초기화
  document.getElementById("reward-note").value = "";

  // 사용 중인 기준 불러오기
  try {
    await loadActivePointCriteria();
    renderActivePointCriteria("상점");
  } catch (error) {
    alert("상벌점 기준 조회 실패: " + error.message);
    return;
  }

  dialog.showModal();
}

// 5. 페이지 로딩 후 이벤트 연결
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initPointCriteriaEvents
  );
} else {
  initPointCriteriaEvents();
}

/* ========================================
   상벌점 통계
======================================== */

let statisticsData = null;

async function loadPointStatistics() {
  const year = document.getElementById("statistics-year").value;
  const month = document.getElementById("statistics-month").value;
  const status = document.getElementById("statistics-status");

  status.textContent = "통계를 불러오는 중...";

  try {
    const url = new URL(GAS_URL);
    url.searchParams.set("action", "pointStatistics");
    url.searchParams.set("year", year);
    url.searchParams.set("month", month);
    url.searchParams.set("_", Date.now());

    const response = await fetch(url.toString(), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "통계 조회 실패");
    }

    statisticsData = data;

    document.getElementById("statistics-total").textContent =
      `${data.totalDemerit}점`;

    document.getElementById("statistics-count").textContent =
      `${data.totalCount}건`;

    document.getElementById("statistics-class-count").textContent =
      `${data.classes.length}개 학급`;

    renderStatisticsClasses(data.classes);
    renderStatisticsStudents(data.students);

    status.textContent = `${data.month} 통계 조회 완료`;

  } catch (error) {
    statisticsData = null;
    status.textContent = "조회 실패: " + error.message;
    console.error(error);
  }
}

function renderStatisticsClasses(classes) {
  const tbody = document.getElementById("statistics-class-body");

  tbody.innerHTML = classes.length
    ? classes.map(item => `
      <tr>
        <td>${item.rank}위</td>
        <td>${item.grade}학년 ${item.classNo}반</td>
        <td>${item.demerit}점</td>
        <td>${item.count}건</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">해당 월의 벌점 기록이 없습니다.</td></tr>`;
}

function renderStatisticsStudents(students) {
  const tbody = document.getElementById("statistics-student-body");

  tbody.innerHTML = students.length
    ? students.map(item => `
      <tr>
        <td>${item.grade}</td>
        <td>${item.classNo}</td>
        <td>${item.number}</td>
        <td>${escapeRecordHtml(item.name)}</td>
        <td>${item.demerit}점</td>
        <td>${item.count}건</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">해당 월의 벌점 기록이 없습니다.</td></tr>`;
}

function downloadPointStatistics() {
  if (!statisticsData) {
    alert("먼저 통계를 조회하세요.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("엑셀 라이브러리를 불러오지 못했습니다.");
    return;
  }

  const workbook = XLSX.utils.book_new();

  const classRows = statisticsData.classes.map(item => ({
    "순위": item.rank,
    "학년": item.grade,
    "반": item.classNo,
    "벌점 합계": item.demerit,
    "벌점 건수": item.count
  }));

  const studentRows = statisticsData.students.map(item => ({
    "학년": item.grade,
    "반": item.classNo,
    "번호": item.number,
    "이름": item.name,
    "벌점 합계": item.demerit,
    "벌점 건수": item.count
  }));

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(classRows, {
      header: ["순위", "학년", "반", "벌점 합계", "벌점 건수"]
    }),
    "학급별 통계"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(studentRows, {
      header: ["학년", "반", "번호", "이름", "벌점 합계", "벌점 건수"]
    }),
    "학생별 통계"
  );

  XLSX.writeFile(
    workbook,
    `상벌점통계_${statisticsData.month}.xlsx`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("statistics-year");
  const month = document.getElementById("statistics-month");

  if (!year || !month) return;

  const now = new Date();

  year.value = now.getFullYear();
  month.value = now.getMonth() + 1;

  document.getElementById("statistics-search")
    ?.addEventListener("click", loadPointStatistics);

  document.getElementById("statistics-download")
    ?.addEventListener("click", downloadPointStatistics);

  loadPointStatistics();
});
