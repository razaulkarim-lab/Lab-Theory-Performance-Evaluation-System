# Lab ও Theory Performance Evaluation System
## All setup 

---

##  File Structure

```
perf_eval/
├── app.py                  ← Flask Backend (API + Auto DB)
├── requirements.txt        ← Python packages
├── perf_eval.db           ← SQLite Database (auto-created)
├── templates/
│   └── index.html         ← Main Frontend HTML
└── static/
    ├── css/
    │   └── style.css      ← All Styles
    └── js/
        └── app.js         ← All JavaScript Logic
```

---

## ⚙️ Setup systems

### Step 1: install Python 
Python 3.8+ needed। https://python.org 

### Step 2: install Dependencies 
```bash
cd perf_eval
pip install -r requirements.txt
```

### Step 3: Server run
```bash
python app.py
```
✅ Show the run Server:
```
✅ Database initialized with departments and semesters
🚀 Server running on http://localhost:5000
```

### Step 4: Browser এ খুলুন
```
http://localhost:5000
```

---

## First time use

1. **Sign Up** 
2. Name, E-mail, password → Register
3. সফল হলে পপআপ দেখাবে
4. **Login** 
5.  Show Dashboard 

---

## 🗄️ Database (Auto Create)

`perf_eval.db` File **Automatically** Will be made।

### ৯ Default Department (Auto):
CSE, EEE, ME, CE, TE, FT, Arch, ET, RAC

### 8 semesters per department (Auto):
Semester 1 → Semester 8 (স্বয়ংক্রিয়)

### Adding a new department:
8 Semesters will be automatically created. ✓✓✓✓

---

## 📊 Marking System

### Lab (Total 50 marks)
| Component | Mid | Final |
|-----------|-----|-------|
| Attendance | ✓ | ✓ |
| Lab Report | ✓ | ✓ |
| Viva | ✓ | ✓ |
| Practical | ✓ | ✓ |
| **Exam Marks** | **Max 20** | **Max 30** |

### Theory (Total 50 marks)
| Component | Mid | Final |
|-----------|-----|-------|
| Class Test | ✓ | ✓ |
| Quiz | ✓ | ✓ |
| Presentation | ✓ | ✓ |
| Viva | ✓ | ✓ |
| Assignment | ✓ | ✓ |
| **Exam Marks** | **Max 20** | **Max 30** |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|--------|
| POST | /api/auth/register | Registration |
| POST | /api/auth/login | Login |
| GET/PUT | /api/auth/profile | Profile |
| GET/POST | /api/departments | Department |
| GET | /api/departments/:id/semesters | Semester |
| GET/POST | /api/students | Student |
| GET/PUT/DELETE | /api/students/:id | Student Details |
| GET/POST | /api/lab-marks | Lab Marks |
| DELETE | /api/lab-marks/:id | Lab Delete marks |
| GET/POST | /api/theory-marks | Theory Marks |
| DELETE | /api/theory-marks/:id | Theory Delete marks |
| GET | /api/stats/dashboard | Dashboard Stats |

---

## 📱 Features

- ✅ Mobile Responsive
- ✅ Desktop Responsive  
- ✅ JWT Authentication
- ✅ Auto SQLite Database
- ✅ 9 Departments (Auto)
- ✅ 8 Semesters per Dept (Auto)
- ✅ Lab & Theory Separate Modules
- ✅ Mid & Final Exam Tracking
- ✅ Student Search by ID
- ✅ PDF Report Generation
- ✅ Graph Charts (Bar, Line, Radar, Doughnut)
- ✅ Weak Student Detection
- ✅ Profile Image Upload
- ✅ Animated Header (Right to Left)
- ✅ Sidebar Navigation
- ✅ Back Button Navigation
