/* 
   Lab & Theory Performance Evaluation System
   Main JavaScript Application
*/

const API = 'http://localhost:5000/api';
let TOKEN = localStorage.getItem('token') || '';
let USER = JSON.parse(localStorage.getItem('user') || 'null');
let pageHistory = [];
let currentPage = 'dashboard';
let departments = [];
let charts = {};

/* ─── INIT ───── */
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  if (TOKEN && USER) {
    enterApp();
  }
});

function updateClock() {
  const el = document.getElementById('currentTime');
  if (el) el.textContent = new Date().toLocaleString('bn-BD', {
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
  });
}

/* ─── AUTH ───────────*/
function showLogin() {
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('signupForm').classList.remove('active');
}
function showSignup() {
  document.getElementById('signupForm').classList.add('active');
  document.getElementById('loginForm').classList.remove('active');
}

async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) { showToast('Fill up all information', 'error'); return; }
  const res = await api('/auth/register', 'POST', { name, email, password });
  if (res.message) {
    showPopup('Success!', 'Registration is complete! Login now.');
    showLogin();
  } else {
    showToast(res.error || 'An error occurred.', 'error');
  }
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('Enter email and password.', 'error'); return; }
  const res = await api('/auth/login', 'POST', { email, password });
  if (res.token) {
    TOKEN = res.token;
    USER = res.user;
    localStorage.setItem('token', TOKEN);
    localStorage.setItem('user', JSON.stringify(USER));
    enterApp();
  } else {
    showToast(res.error || 'Login failed.', 'error');
  }
}

function doLogout() {
  TOKEN = ''; USER = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('authOverlay').classList.add('active');
  document.getElementById('authOverlay').classList.remove('hidden');
  showLogin();
}

async function enterApp() {
  document.getElementById('authOverlay').classList.remove('active');
  document.getElementById('authOverlay').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  if (USER) {
    const avatar = USER.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(USER.name)}&background=1a56db&color=fff`;
    document.getElementById('topbarAvatar').src = avatar;
  }
  await loadDepartments();
  navigate('dashboard');
}

/* ─── NAVIGATION ───── */
function navigate(page) {
  if (currentPage !== page) {
    pageHistory.push(currentPage);
  }
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`.nav-item[onclick*="${page}"]`).forEach(n => n.classList.add('active'));

  const backBtn = document.getElementById('backBtn');
  if (pageHistory.length > 0 && page !== 'dashboard') {
    backBtn.style.display = 'flex';
  } else {
    backBtn.style.display = 'none';
  }

  // Page-specific loaders
  const loaders = {
    'dashboard': loadDashboard,
    'departments': loadDeptAccordion,
    'students': () => { populateDeptDropdowns('filterDept','filterSem'); loadStudents(); },
    'add-student': () => { populateDeptDropdowns('addDept','addSem'); },
    'marks-entry': () => { populateDeptDropdowns('meDept','meSem'); renderMarksForm(); },
    'marks-view': () => { populateDeptDropdowns('mvDept','mvSem'); },
    'graph': () => { populateGraphFilters(); loadGraphData(); },
    'pdf-gen': () => { populateDeptDropdowns('pdfDept','pdfSem'); },
    'profile': loadProfile,
  };
  if (loaders[page]) loaders[page]();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function goBack() {
  if (pageHistory.length > 0) {
    const prev = pageHistory.pop();
    navigate(prev);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.querySelector('.main-wrapper');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    wrapper.classList.toggle('expanded');
  }
}

/* ─── API HELPER ──────── */
async function api(endpoint, method='GET', body=null) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + endpoint, opts);
    return await res.json();
  } catch(e) {
    console.error(e);
    return { error: 'Server connection problem' };
  }
}

/* ─── LOAD DEPARTMENTS ───────── */
async function loadDepartments() {
  const data = await api('/departments');
  if (Array.isArray(data)) departments = data;
  return departments;
}

function populateDeptDropdowns(deptId, semId) {
  const el = document.getElementById(deptId);
  if (!el) return;
  el.innerHTML = '<option value=""> Choose a department </option>';
  departments.forEach(d => {
    el.innerHTML += `<option value="${d.id}">${d.code} - ${d.name}</option>`;
  });
  el.onchange = () => loadSemestersFor(d => d.id == el.value, semId, deptId);
}

async function loadSemestersFor(matchFn, semId, deptId) {
  const deptEl = document.getElementById(deptId);
  const semEl = document.getElementById(semId);
  if (!semEl || !deptEl || !deptEl.value) return;
  const data = await api(`/departments/${deptEl.value}/semesters`);
  semEl.innerHTML = '<option value=""> Choose a semester </option>';
  if (Array.isArray(data)) {
    data.forEach(s => {
      semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`;
    });
  }
}

/* ─── DASHBOARD ─────────────────────────────────── */
async function loadDashboard() {
  const data = await api('/stats/dashboard');
  if (data.error) return;

  // Stats cards
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card" style="border-left-color:#1a56db">
      <div class="stat-icon" style="background:#e8eefb;color:#1a56db"><i class="fas fa-users"></i></div>
      <div class="stat-info"><h3>${data.total_students}</h3><p> Total students </p></div>
    </div>
    <div class="stat-card" style="border-left-color:#10b981">
      <div class="stat-icon" style="background:#d1fae5;color:#10b981"><i class="fas fa-building"></i></div>
      <div class="stat-info"><h3>${data.total_departments}</h3><p> Departments </p></div>
    </div>
    <div class="stat-card" style="border-left-color:#f59e0b">
      <div class="stat-icon" style="background:#fef3c7;color:#f59e0b"><i class="fas fa-flask"></i></div>
      <div class="stat-info"><h3>Lab</h3><p> Performance module </p></div>
    </div>
    <div class="stat-card" style="border-left-color:#06b6d4">
      <div class="stat-icon" style="background:#e0f2fe;color:#06b6d4"><i class="fas fa-book"></i></div>
      <div class="stat-info"><h3>Theory</h3><p> Performance module </p></div>
    </div>
  `;

  // Dept cards
  const colors = ['#1a56db','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6'];
  const cardsHtml = (data.dept_performance || []).map((d, i) => `
    <div class="dept-card" onclick="navigate('students')" style="border-top-color:${colors[i%colors.length]}">
      <div class="dept-card-code" style="color:${colors[i%colors.length]}">${d.code}</div>
      <div class="dept-card-name">${d.name}</div>
      <div class="dept-card-stats">
        <div class="dept-card-stat"><div class="val">${d.student_count}</div><div class="lbl"> student </div></div>
        <div class="dept-card-stat"><div class="val">${d.lab_avg}</div><div class="lbl">Lab Avg</div></div>
        <div class="dept-card-stat"><div class="val">${d.theory_avg}</div><div class="lbl">Theory Avg</div></div>
      </div>
      <div class="dept-card-bar">
        <div class="dept-card-bar-fill" style="width:${Math.min(d.overall*2,100)}%;background:${colors[i%colors.length]}"></div>
      </div>
    </div>
  `).join('');
  document.getElementById('deptCardsGrid').innerHTML = cardsHtml || '<p style="color:#94a3b8;padding:20px"> There is no department problem </p>';

  // Bar Chart
  const labels = (data.dept_performance || []).map(d => d.code);
  const labData = (data.dept_performance || []).map(d => d.lab_avg);
  const thData = (data.dept_performance || []).map(d => d.theory_avg);

  if (charts.deptBar) charts.deptBar.destroy();
  const ctx = document.getElementById('deptBarChart');
  if (ctx) {
    charts.deptBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Lab Average', data: labData, backgroundColor: 'rgba(26,86,219,0.7)', borderRadius: 6 },
          { label: 'Theory Average', data: thData, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 6 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { max: 30, beginAtZero: true } } }
    });
  }

  // Weak students
  const weakHtml = (data.dept_performance || [])
    .filter(d => d.overall < 15 && d.student_count > 0)
    .map(d => `
      <div class="weak-item">
        <div><div class="name">${d.name} (${d.code})</div><div class="score">Overall: ${d.overall}</div></div>
        <span class="weak-badge">Weak</span>
      </div>
    `).join('');
  document.getElementById('weakStudentList').innerHTML = weakHtml || '<p style="color:#10b981;font-weight:600;padding:12px">✓ All departments are performing well.</p>';
}

/* ─── DEPT ACCORDION ─────────────────────────────── */
async function loadDeptAccordion() {
  await loadDepartments();
  let html = '';
  for (const d of departments) {
    const sems = await api(`/departments/${d.id}/semesters`);
    const semHtml = Array.isArray(sems) ? sems.map(s => `
      <div class="sem-badge" onclick="gotoSemStudents(${d.id},${s.id})">
        <i class="fas fa-layer-group"></i> Semester ${s.number}
      </div>`).join('') : '';
    html += `
      <div class="dept-item">
        <div class="dept-item-header" onclick="toggleAccordion(this)">
          <span><i class="fas fa-building" style="margin-right:10px"></i>${d.code} — ${d.name}</span>
          <i class="fas fa-chevron-down"></i>
        </div>
        <div class="dept-item-body">
          <div class="sem-badges">${semHtml}</div>
        </div>
      </div>`;
  }
  document.getElementById('deptAccordion').innerHTML = html || '<p>No department</p>';
}

function toggleAccordion(header) {
  const body = header.nextElementSibling;
  const icon = header.querySelector('.fa-chevron-down, .fa-chevron-up');
  body.classList.toggle('open');
  if (icon) icon.className = body.classList.contains('open') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

function gotoSemStudents(deptId, semId) {
  navigate('students');
  setTimeout(() => {
    const dEl = document.getElementById('filterDept');
    if (dEl) { dEl.value = deptId; loadStudentSemesters(() => {
      const sEl = document.getElementById('filterSem');
      if (sEl) { sEl.value = semId; loadStudents(); }
    }); }
  }, 200);
}

function showAddDeptModal() {
  document.getElementById('modalTitle').textContent = 'Add new department';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>Department Name</label><input type="text" id="newDeptName" placeholder="example: Computer Science"></div>
    <div class="form-group"><label>Short code</label><input type="text" id="newDeptCode" placeholder="example: CSE"></div>
    <button class="btn-primary" onclick="addDepartment()"><i class="fas fa-save"></i> Add (8 semesters will be automatically created.)</button>
  `;
  openModal();
}

async function addDepartment() {
  const name = document.getElementById('newDeptName').value.trim();
  const code = document.getElementById('newDeptCode').value.trim().toUpperCase();
  if (!name || !code) { showToast('Give all the information.', 'error'); return; }
  const res = await api('/departments', 'POST', { name, code });
  if (res.message) {
    showToast(res.message, 'success');
    closeModal();
    await loadDepartments();
    loadDeptAccordion();
  } else {
    showToast(res.error || 'Error', 'error');
  }
}

/* ─── STUDENTS ───────────────────────────────────── */
async function loadStudentSemesters(cb) {
  const deptId = document.getElementById('filterDept')?.value;
  const semEl = document.getElementById('filterSem');
  if (!semEl) return;
  semEl.innerHTML = '<option value="">All Semester</option>';
  if (deptId) {
    const data = await api(`/departments/${deptId}/semesters`);
    if (Array.isArray(data)) data.forEach(s => { semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`; });
  }
  if (cb) cb();
  else loadStudents();
}

async function loadStudents() {
  const dept = document.getElementById('filterDept')?.value;
  const sem = document.getElementById('filterSem')?.value;
  const batch = document.getElementById('filterBatch')?.value;
  const search = document.getElementById('searchStudent')?.value;
  let url = '/students?';
  if (dept) url += `department_id=${dept}&`;
  if (sem) url += `semester_id=${sem}&`;
  if (batch) url += `batch=${encodeURIComponent(batch)}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  const data = await api(url);
  const tbody = document.getElementById('studentsBody');
  if (!tbody) return;
  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">No students found.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((s, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${s.student_id}</strong></td>
      <td>${s.name}</td>
      <td><span style="background:#e8eefb;color:#1a56db;padding:3px 8px;border-radius:12px;font-size:12px;font-weight:600">${s.batch}</span></td>
      <td>${s.dept_code || s.dept_name}</td>
      <td>Semester ${s.sem_number}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" onclick="editStudentModal(${s.id})" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete" onclick="deleteStudent(${s.id})" title="Delete"><i class="fas fa-trash"></i></button>
          <button class="btn-icon print" onclick="printStudentPDF(${s.id})" title="PDF"><i class="fas fa-file-pdf"></i></button>
        </div>
      </td>
    </tr>`).join('');

  // Populate dept dropdown if empty
  const dEl = document.getElementById('filterDept');
  if (dEl && dEl.options.length <= 1) {
    departments.forEach(d => { dEl.innerHTML += `<option value="${d.id}">${d.code} - ${d.name}</option>`; });
  }
}

async function addStudent() {
  const data = {
    student_id: document.getElementById('addStudentId').value.trim(),
    name: document.getElementById('addStudentName').value.trim(),
    batch: document.getElementById('addBatch').value,
    department_id: parseInt(document.getElementById('addDept').value),
    semester_id: parseInt(document.getElementById('addSem').value),
    email: document.getElementById('addStudentEmail').value.trim(),
    phone: document.getElementById('addStudentPhone').value.trim()
  };
  if (!data.student_id || !data.name || !data.department_id || !data.semester_id) {
    showToast('Fill in the required information.', 'error'); return;
  }
  const res = await api('/students', 'POST', data);
  if (res.message) {
    showToast('Student added!', 'success');
    ['addStudentId','addStudentName','addStudentEmail','addStudentPhone'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  } else {
    showToast(res.error || 'Error', 'error');
  }
}

async function loadAddSemesters() {
  const deptId = document.getElementById('addDept').value;
  const semEl = document.getElementById('addSem');
  semEl.innerHTML = '<option value="">Loading...</option>';
  if (!deptId) { semEl.innerHTML = '<option value="">Choose a department first.</option>'; return; }
  const data = await api(`/departments/${deptId}/semesters`);
  semEl.innerHTML = '<option value="">Choose a semester</option>';
  if (Array.isArray(data)) data.forEach(s => { semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`; });
}

async function editStudentModal(id) {
  const s = await api(`/students/${id}`);
  document.getElementById('modalTitle').textContent = 'Edit student';
  const deptOpts = departments.map(d => `<option value="${d.id}" ${d.id==s.department_id?'selected':''}>${d.code} - ${d.name}</option>`).join('');
  const semsData = await api(`/departments/${s.department_id}/semesters`);
  const semOpts = (Array.isArray(semsData)?semsData:[]).map(sm => `<option value="${sm.id}" ${sm.id==s.semester_id?'selected':''}>Semester ${sm.number}</option>`).join('');
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group"><label>Batch</label>
      <select id="editBatch"><option value="Day Batch" ${s.batch=='Day Batch'?'selected':''}>Day Batch</option><option value="Diploma Batch" ${s.batch=='Diploma Batch'?'selected':''}>Diploma Batch</option></select></div>
    <div class="form-group"><label>Department</label><select id="editDept">${deptOpts}</select></div>
    <div class="form-group"><label>Semester</label><select id="editSem">${semOpts}</select></div>
    <div class="form-group"><label>Student ID</label><input id="editSid" value="${s.student_id}" disabled></div>
    <div class="form-group"><label>Name</label><input id="editName" value="${s.name}"></div>
    <div class="form-group"><label>E-mail</label><input id="editEmail" value="${s.email||''}"></div>
    <div class="form-group"><label>Phone</label><input id="editPhone" value="${s.phone||''}"></div>
    <button class="btn-primary" onclick="saveEditStudent(${id})"><i class="fas fa-save"></i> আপডেট করুন</button>
  `;
  openModal();
}

async function saveEditStudent(id) {
  const data = {
    name: document.getElementById('editName').value.trim(),
    batch: document.getElementById('editBatch').value,
    department_id: parseInt(document.getElementById('editDept').value),
    semester_id: parseInt(document.getElementById('editSem').value),
    email: document.getElementById('editEmail').value.trim(),
    phone: document.getElementById('editPhone').value.trim()
  };
  const res = await api(`/students/${id}`, 'PUT', data);
  if (res.message) { showToast('Updated!', 'success'); closeModal(); loadStudents(); }
  else showToast(res.error||'ত্রুটি','error');
}

async function deleteStudent(id) {
  if (!confirm('All information about this student will be deleted. Are you sure?')) return;
  const res = await api(`/students/${id}`, 'DELETE');
  if (res.message) { showToast('Deleted!', 'success'); loadStudents(); }
  else showToast(res.error||'Error','error');
}

/* ─── MARKS ENTRY ────────────────────────────────── */
async function loadMeSemesters() {
  const deptId = document.getElementById('meDept').value;
  const semEl = document.getElementById('meSem');
  semEl.innerHTML = '<option value="">Semester</option>';
  if (!deptId) return;
  const data = await api(`/departments/${deptId}/semesters`);
  if (Array.isArray(data)) data.forEach(s => { semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`; });
  document.getElementById('meDept').onchange = null;
  semEl.onchange = loadMeStudents;
}

async function loadMeStudents() {
  const dept = document.getElementById('meDept').value;
  const sem = document.getElementById('meSem').value;
  const batch = document.getElementById('meBatch').value;
  const el = document.getElementById('meStudent');
  el.innerHTML = '<option value="">Choose a student</option>';
  if (!dept || !sem) return;
  let url = `/students?department_id=${dept}&semester_id=${sem}`;
  if (batch) url += `&batch=${encodeURIComponent(batch)}`;
  const data = await api(url);
  if (Array.isArray(data)) data.forEach(s => { el.innerHTML += `<option value="${s.id}">${s.student_id} - ${s.name}</option>`; });
}

function renderMarksForm() {
  const type = document.getElementById('meType')?.value;
  const examType = document.getElementById('meExamType')?.value;
  const maxExam = examType === 'mid' ? 20 : 30;
  let html = `<div class="marks-form-grid">`;
  if (type === 'lab') {
    html += `
      <div class="form-group"><label><i class="fas fa-calendar-check"></i> Attendance </label><input type="number" id="mAttn" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-file-alt"></i> Lab Report</label><input type="number" id="mLabRep" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-microphone"></i> Viva Marks</label><input type="number" id="mViva" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-flask"></i> Practical Performance</label><input type="number" id="mPractical" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-star" style="color:#f59e0b"></i> ${examType==='mid'?'Mid':'Final'} Exam (Max ${maxExam})</label><input type="number" id="mExam" min="0" max="${maxExam}" placeholder="0-${maxExam}"></div>`;
  } else {
    const num = examType === 'mid' ? '1' : '2';
    html += `
      <div class="form-group"><label><i class="fas fa-pencil-alt"></i> Class Test_${num}</label><input type="number" id="mCT" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-question-circle"></i> Quiz_${num}</label><input type="number" id="mQuiz" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-chalkboard-teacher"></i> Presentation_${num}</label><input type="number" id="mPres" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-microphone"></i> Viva_${num}</label><input type="number" id="mViva" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-tasks"></i> Assignment_${num}</label><input type="number" id="mAssign" min="0" max="10" placeholder="0-10"></div>
      <div class="form-group"><label><i class="fas fa-star" style="color:#f59e0b"></i> ${examType==='mid'?'Mid':'Final'} Exam (Max ${maxExam})</label><input type="number" id="mExam" min="0" max="${maxExam}" placeholder="0-${maxExam}"></div>`;
  }
  html += `</div>`;
  html += `<div class="marks-note"><i class="fas fa-info-circle"></i> ${examType==='mid'?'Mid Exam: Maximum 20 marks':'Final Exam: Maximum 30 marks'} — Lab+Theory Total 100 marks </div>`;
  document.getElementById('dynamicMarksForm').innerHTML = html;
}

async function saveMarks() {
  const type = document.getElementById('meType').value;
  const semId = parseInt(document.getElementById('meSem').value);
  const studentId = parseInt(document.getElementById('meStudent').value);
  const examType = document.getElementById('meExamType').value;
  const maxExam = examType === 'mid' ? 20 : 30;
  if (!semId || !studentId) { showToast('Select semester and Student', 'error'); return; }
  const examMarks = Math.min(parseFloat(document.getElementById('mExam')?.value)||0, maxExam);
  let body = { student_id: studentId, semester_id: semId, exam_type: examType, exam_marks: examMarks };
  if (type === 'lab') {
    body = { ...body, attendance: parseFloat(document.getElementById('mAttn')?.value)||0,
      lab_report: parseFloat(document.getElementById('mLabRep')?.value)||0,
      viva: parseFloat(document.getElementById('mViva')?.value)||0,
      practical: parseFloat(document.getElementById('mPractical')?.value)||0 };
  } else {
    body = { ...body, class_test: parseFloat(document.getElementById('mCT')?.value)||0,
      quiz: parseFloat(document.getElementById('mQuiz')?.value)||0,
      presentation: parseFloat(document.getElementById('mPres')?.value)||0,
      viva: parseFloat(document.getElementById('mViva')?.value)||0,
      assignment: parseFloat(document.getElementById('mAssign')?.value)||0 };
  }
  const endpoint = type === 'lab' ? '/lab-marks' : '/theory-marks';
  const res = await api(endpoint, 'POST', body);
  if (res.message) showToast('Marks saved!', 'success');
  else showToast(res.error||'Error','error');
}

/* ─── MARKS VIEW ───────── */
async function loadMvSemesters() {
  const deptId = document.getElementById('mvDept').value;
  const semEl = document.getElementById('mvSem');
  semEl.innerHTML = '<option value="">Semesters</option>';
  if (!deptId) return;
  const data = await api(`/departments/${deptId}/semesters`);
  if (Array.isArray(data)) data.forEach(s => { semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`; });
}

async function loadMvMarks() {
  const dept = document.getElementById('mvDept').value;
  const sem = document.getElementById('mvSem').value;
  const type = document.getElementById('mvType').value;
  const search = document.getElementById('mvSearch').value;
  let url = `/${type}-marks?`;
  if (dept) url += `department_id=${dept}&`;
  if (sem) url += `semester_id=${sem}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  const data = await api(url);
  const container = document.getElementById('mvTableContainer');
  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:32px;color:#94a3b8">No marks found.</p>';
    return;
  }

  let headers, rows;
  if (type === 'lab') {
    headers = `<tr><th>#</th><th>Student ID</th><th>Name</th><th>Batch</th><th>Exam</th><th>Attendance</th><th>Lab Report</th><th>Viva</th><th>Practical</th><th>Exam Marks</th><th>Action</th></tr>`;
    rows = data.map((m,i) => `
      <tr>
        <td>${i+1}</td><td><strong>${m.roll}</strong></td><td>${m.student_name}</td>
        <td>${m.batch}</td><td><span style="background:${m.exam_type==='mid'?'#dbeafe':'#d1fae5'};color:${m.exam_type==='mid'?'#1e40af':'#065f46'};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700">${m.exam_type.toUpperCase()}</span></td>
        <td>${m.attendance}</td><td>${m.lab_report}</td><td>${m.viva}</td><td>${m.practical}</td>
        <td><strong style="color:#1a56db">${m.exam_marks}/${m.exam_type==='mid'?20:30}</strong></td>
        <td><div class="action-btns">
          <button class="btn-icon edit" onclick="editMarkModal('lab',${m.id},'${m.exam_type}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete" onclick="deleteMark('lab',${m.id})"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  } else {
    headers = `<tr><th>#</th><th>Student ID</th><th>Name</th><th>Batch</th><th>Exam</th><th>Class Test</th><th>Quiz</th><th>Presentation</th><th>Viva</th><th>Assignment</th><th>Exam</th><th>Action</th></tr>`;
    rows = data.map((m,i) => `
      <tr>
        <td>${i+1}</td><td><strong>${m.roll}</strong></td><td>${m.student_name}</td>
        <td>${m.batch}</td><td><span style="background:${m.exam_type==='mid'?'#dbeafe':'#d1fae5'};color:${m.exam_type==='mid'?'#1e40af':'#065f46'};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700">${m.exam_type.toUpperCase()}</span></td>
        <td>${m.class_test}</td><td>${m.quiz}</td><td>${m.presentation}</td><td>${m.viva}</td><td>${m.assignment}</td>
        <td><strong style="color:#1a56db">${m.exam_marks}/${m.exam_type==='mid'?20:30}</strong></td>
        <td><div class="action-btns">
          <button class="btn-icon edit" onclick="editMarkModal('theory',${m.id},'${m.exam_type}')"><i class="fas fa-edit"></i></button>
          <button class="btn-icon delete" onclick="deleteMark('theory',${m.id})"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  }
  container.innerHTML = `<div style="overflow-x:auto"><table class="data-table"><thead>${headers}</thead><tbody>${rows}</tbody></table></div>`;
  if (dept) {
    const dEl = document.getElementById('mvDept');
    if (dEl && dEl.options.length <= 1) departments.forEach(d => { dEl.innerHTML += `<option value="${d.id}">${d.code}</option>`; });
  }
}

async function deleteMark(type, id) {
  if (!confirm('Will these marks be deleted?')) return;
  const res = await api(`/${type}-marks/${id}`, 'DELETE');
  if (res.message) { showToast('Deleted!', 'success'); loadMvMarks(); }
  else showToast(res.error||'Erroe','error');
}

function editMarkModal(type, id, examType) {
  showToast('Edit Feature: Delete and re-enter from Marks View', 'info');
}

/* ─── GRAPH ──────────── */
async function populateGraphFilters() {
  const dEl = document.getElementById('graphDept');
  if (dEl && dEl.options.length <= 1) {
    departments.forEach(d => { dEl.innerHTML += `<option value="${d.id}">${d.code} - ${d.name}</option>`; });
  }
  dEl.onchange = async () => {
    const semEl = document.getElementById('graphSem');
    semEl.innerHTML = '<option value="">All Semester</option>';
    if (dEl.value) {
      const sems = await api(`/departments/${dEl.value}/semesters`);
      if (Array.isArray(sems)) sems.forEach(s => { semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`; });
    }
    loadGraphData();
  };
}

async function loadGraphData() {
  const data = await api('/stats/dashboard');
  if (data.error) return;

  // Overall dept performance
  const labels = (data.dept_performance||[]).map(d => d.code);
  const labVals = (data.dept_performance||[]).map(d => d.lab_avg);
  const thVals = (data.dept_performance||[]).map(d => d.theory_avg);
  const overall = (data.dept_performance||[]).map(d => d.overall);

  if (charts.semGraph) charts.semGraph.destroy();
  const c1 = document.getElementById('semGraph');
  if (c1) charts.semGraph = new Chart(c1, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Lab Avg', data: labVals, borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)', fill: true, tension: 0.4 },
      { label: 'Theory Avg', data: thVals, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
      { label: 'Overall', data: overall, borderColor: '#f59e0b', borderWidth: 2, tension: 0.4 }
    ]},
    options: { responsive: true, plugins: { legend: { position: 'top' } } }
  });

  if (charts.labTheory) charts.labTheory.destroy();
  const c2 = document.getElementById('labTheoryChart');
  if (c2) charts.labTheory = new Chart(c2, {
    type: 'radar',
    data: { labels, datasets: [
      { label: 'Lab', data: labVals, backgroundColor: 'rgba(26,86,219,0.2)', borderColor: '#1a56db' },
      { label: 'Theory', data: thVals, backgroundColor: 'rgba(16,185,129,0.2)', borderColor: '#10b981' }
    ]},
    options: { responsive: true }
  });

  if (charts.allDept) charts.allDept.destroy();
  const c3 = document.getElementById('allDeptChart');
  const colors = ['#1a56db','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6'];
  if (c3) charts.allDept = new Chart(c3, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: (data.dept_performance||[]).map(d=>d.student_count||1), backgroundColor: colors }] },
    options: { responsive: true, plugins: { legend: { position: 'right' } } }
  });
}

/* ─── PDF GENERATOR ─────── */
async function loadPdfSemesters() {
  const deptId = document.getElementById('pdfDept').value;
  const semEl = document.getElementById('pdfSem');
  semEl.innerHTML = '<option value="">Semester</option>';
  if (!deptId) return;
  const data = await api(`/departments/${deptId}/semesters`);
  if (Array.isArray(data)) data.forEach(s => { semEl.innerHTML += `<option value="${s.id}">Semester ${s.number}</option>`; });
}

async function generatePDF(type, examType) {
  const deptId = document.getElementById('pdfDept').value;
  const semId = document.getElementById('pdfSem').value;
  const batch = document.getElementById('pdfBatch').value;
  if (!deptId || !semId) { showToast('Select department and semester', 'error'); return; }
  let url = `/${type}-marks?department_id=${deptId}&semester_id=${semId}&`;
  if (batch) url += `batch=${encodeURIComponent(batch)}&`;
  const data = await api(url);
  const dept = departments.find(d => d.id == deptId);
  const maxMark = examType === 'mid' ? 20 : 30;
  const title = `${dept?.name||'Department'} — ${type.toUpperCase()} ${examType.toUpperCase()} Report`;

  let tableHead = '', tableRows = '';
  if (type === 'lab') {
    tableHead = `<tr><th>SL</th><th>Student ID</th><th>Name</th><th>Batch</th><th>Attendance</th><th>Lab Report</th><th>Viva</th><th>Practical</th><th>Exam (/${maxMark})</th></tr>`;
    tableRows = (Array.isArray(data)?data:[]).filter(m => m.exam_type === examType).map((m,i) => `
      <tr><td>${i+1}</td><td>${m.roll}</td><td>${m.student_name}</td><td>${m.batch}</td>
      <td>${m.attendance}</td><td>${m.lab_report}</td><td>${m.viva}</td><td>${m.practical}</td>
      <td><strong>${m.exam_marks}</strong></td></tr>`).join('');
  } else {
    tableHead = `<tr><th>SL</th><th>Student ID</th><th>Name</th><th>Batch</th><th>Class Test</th><th>Quiz</th><th>Presentation</th><th>Viva</th><th>Assignment</th><th>Exam (/${maxMark})</th></tr>`;
    tableRows = (Array.isArray(data)?data:[]).filter(m => m.exam_type === examType).map((m,i) => `
      <tr><td>${i+1}</td><td>${m.roll}</td><td>${m.student_name}</td><td>${m.batch}</td>
      <td>${m.class_test}</td><td>${m.quiz}</td><td>${m.presentation}</td><td>${m.viva}</td><td>${m.assignment}</td>
      <td><strong>${m.exam_marks}</strong></td></tr>`).join('');
  }

  const preview = `
    <div class="pdf-preview-box" id="pdfContent">
      <div class="pdf-watermark">Lab ও Theory Performance Evaluation System</div>
      <div class="pdf-header">
        <h2>${title}</h2>
        <p>Date: ${new Date().toLocaleDateString('bn-BD')} | Batch: ${batch||'All'}</p>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>${tableHead}</thead>
          <tbody>${tableRows || '<tr><td colspan="10" style="text-align:center;padding:20px">No information</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    

    <button class="btn-primary" style="margin-top:16px;width:auto;padding:12px 24px" onclick="window.print()">  
      <i class="fas fa-print"></i> PDF Print
    </button>`;
  document.getElementById('pdfPreview').innerHTML = preview;
  showToast('PDF Preview created. Click the button to print.', 'success');
}

//onclick="triggerPrint()  একটি আলাদা ফাংশন কল করুন যা শুধুমাত্র নির্দিষ্ট এরিয়াটুকু প্রিন্ট করবে।
/*

function triggerPrint() {
  const printContents = document.getElementById('pdfContent').innerHTML;
  const originalContents = document.body.innerHTML;

  // সাময়িকভাবে পুরো পেজকে শুধু পিডিএফ এরিয়া দিয়ে রিপ্লেস করা
  document.body.innerHTML = `
    <html>
      <head>
        <title>Print Report</title>
        <style>
          /* এখানে আপনার টেবিল ও পিডিএফ এর সিএসএস স্টাইলগুলো পেস্ট করুন যেন প্রিন্টটা সুন্দর দেখায় *//*
          body { font-family: sans-serif; padding: 20px; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .pdf-watermark { color: #ccc; font-size: 12px; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        ${printContents}
      </body>
    </html>
  `;

  window.print();

  // প্রিন্ট শেষে মূল পেজ আবার আগের অবস্থায় ফিরিয়ে আনা
  document.body.innerHTML = originalContents;
  window.location.reload(); // পেজ রিলোড করে জাভাস্ক্রিপ্ট ইভেন্টগুলো সচল রাখা
}


*/


/* ─── PROFILE ────────────────────────────────────── */
async function loadProfile() {
  const data = await api('/auth/profile');
  if (data.id) {
    document.getElementById('profileName').value = data.name;
    document.getElementById('profileEmail').value = data.email;
    const avatar = data.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=1a56db&color=fff&size=120`;
    document.getElementById('profileImg').src = avatar;
  }
}

async function updateProfile() {
  const data = { name: document.getElementById('profileName').value.trim() };
  const pw = document.getElementById('profilePassword').value;
  if (pw) data.password = pw;
  const res = await api('/auth/profile', 'PUT', data);
  if (res.message) {
    showToast('Profile updated!', 'success');
    USER.name = data.name;
    localStorage.setItem('user', JSON.stringify(USER));
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=1a56db&color=fff`;
    document.getElementById('topbarAvatar').src = avatar;
  }
  else showToast(res.error||'Error','error');
}

function uploadAvatar() {
  const file = document.getElementById('avatarInput').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    document.getElementById('profileImg').src = base64;
    document.getElementById('topbarAvatar').src = base64;
    await api('/auth/profile', 'PUT', { profile_image: base64 });
    showToast('Profile picture updated!', 'success');
  };
  reader.readAsDataURL(file);
}

async function printStudentPDF(id) {
  const s = await api(`/students/${id}`);
  const lab = await api(`/lab-marks?student_id=${id}`);
  const theory = await api(`/theory-marks?student_id=${id}`);
  const labMid = (Array.isArray(lab)?lab:[]).find(m=>m.exam_type==='mid');
  const labFinal = (Array.isArray(lab)?lab:[]).find(m=>m.exam_type==='final');
  const thMid = (Array.isArray(theory)?theory:[]).find(m=>m.exam_type==='mid');
  const thFinal = (Array.isArray(theory)?theory:[]).find(m=>m.exam_type==='final');
  const labTotal = (labMid?.exam_marks||0) + (labFinal?.exam_marks||0);
  const thTotal = (thMid?.exam_marks||0) + (thFinal?.exam_marks||0);
  const grand = labTotal + thTotal;
  const grade = grand>=90?'A+':grand>=80?'A':grand>=70?'B+':grand>=60?'B':grand>=50?'C':'F';

  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Result - ${s.name}</title>
  <style>body{font-family:sans-serif;padding:40px;max-width:700px;margin:0 auto}
  .hdr{text-align:center;border-bottom:3px solid #1a56db;padding-bottom:16px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{background:#1a56db;color:white;padding:10px}td{padding:9px;border:1px solid #ddd;text-align:center}
  .total{font-weight:700;font-size:18px;color:#1a56db}.wm{text-align:center;background:#e8eefb;padding:8px;border-radius:6px;margin-bottom:16px;font-weight:700;font-size:13px;color:#1a56db}
  @media print{button{display:none}}</style></head><body>
  <div class="wm">Lab ও Theory Performance Evaluation System</div>
  <div class="hdr"><h2>Student Performance Report</h2><p>${s.name} | ${s.student_id} | ${s.dept_name} | Semester ${s.sem_number}</p></div>
  <table><tr><th>ধরন</th><th>Mid (${labMid?20:'-'})</th><th>Final (${labFinal?30:'-'})</th><th>মোট (৫০)</th></tr>
  <tr><td>Lab</td><td>${labMid?.exam_marks||0}</td><td>${labFinal?.exam_marks||0}</td><td>${labTotal}</td></tr>
  <tr><td>Theory</td><td>${thMid?.exam_marks||0}</td><td>${thFinal?.exam_marks||0}</td><td>${thTotal}</td></tr>
  <tr><td colspan="3"><strong>Grand Total (100)</strong></td><td class="total">${grand} — Grade: ${grade}</td></tr></table>
  <button onclick="window.print()" style="padding:10px 20px;background:#1a56db;color:white;border:none;border-radius:6px;cursor:pointer">Print now</button>
  </body></html>`);
  win.document.close();
}

/* ─── MODAL ────────── */
function openModal() {
  document.getElementById('modal').classList.add('show');
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modal').classList.remove('show');
  document.getElementById('modalOverlay').classList.remove('show');
}

/* ─── POPUP ─────────── */
function showPopup(title, msg) {
  document.getElementById('popupTitle').textContent = title;
  document.getElementById('popupMsg').textContent = msg;
  document.getElementById('successPopup').classList.add('show');
}
function closePopup() { document.getElementById('successPopup').classList.remove('show'); }

/* ─── TOAST ────────────── */
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.classList.remove('show'); }, 3000);
}

/* ─── MARK VIEW POPULATE ──────── */
// Populate dropdowns when marks-view page loads
document.addEventListener('DOMContentLoaded', () => {
  // Defer until departments loaded
  setTimeout(() => {
    ['mvDept','pdfDept','graphDept'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.options.length <= 1) {
        departments.forEach(d => { el.innerHTML += `<option value="${d.id}">${d.code} - ${d.name}</option>`; });
      }
    });
    ['meDept','addDept','filterDept'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.options.length <= 1) {
        departments.forEach(d => { el.innerHTML += `<option value="${d.id}">${d.code} - ${d.name}</option>`; });
      }
    });
  }, 1500);

  // Marks entry type change
  const meType = document.getElementById('meType');
  const meExam = document.getElementById('meExamType');
  const meDept = document.getElementById('meDept');
  if (meType) meType.onchange = renderMarksForm;
  if (meExam) meExam.onchange = renderMarksForm;
  if (meDept) meDept.onchange = loadMeSemesters;
});
