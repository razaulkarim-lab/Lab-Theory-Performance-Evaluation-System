from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3, hashlib, jwt, datetime, os, json

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, supports_credentials=True)
app.config['SECRET_KEY'] = 'PERF_EVAL_SECRET_2024'
DB_PATH = 'perf_eval.db'

DEPARTMENTS = [
    "CSE","EEE","BBA","English","Fashon Design(FD)","MBA","MPH","EMBA","M.ED"
]

# ─── DB INIT ─────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'teacher',
        profile_image TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY(department_id) REFERENCES departments(id),
        UNIQUE(department_id, number)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        batch TEXT NOT NULL,
        department_id INTEGER NOT NULL,
        semester_id INTEGER NOT NULL,
        email TEXT,
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id),
        FOREIGN KEY(semester_id) REFERENCES semesters(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS lab_marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        exam_type TEXT NOT NULL,
        attendance REAL DEFAULT 0,
        lab_report REAL DEFAULT 0,
        viva REAL DEFAULT 0,
        practical REAL DEFAULT 0,
        exam_marks REAL DEFAULT 0,
        total REAL DEFAULT 0,
        semester_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id),
        UNIQUE(student_id, exam_type, semester_id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS theory_marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        exam_type TEXT NOT NULL,
        class_test REAL DEFAULT 0,
        quiz REAL DEFAULT 0,
        presentation REAL DEFAULT 0,
        viva REAL DEFAULT 0,
        assignment REAL DEFAULT 0,
        exam_marks REAL DEFAULT 0,
        total REAL DEFAULT 0,
        semester_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id),
        UNIQUE(student_id, exam_type, semester_id)
    )''')

    # Insert default departments
    for i, dept in enumerate(DEPARTMENTS):
        c.execute('INSERT OR IGNORE INTO departments(name, code) VALUES(?,?)', (dept, dept))

    conn.commit()

    # Auto-create 8 semesters for each department
    c.execute('SELECT id FROM departments')
    depts = c.fetchall()
    for dept in depts:
        for sem in range(1, 9):
            c.execute('INSERT OR IGNORE INTO semesters(department_id, number, name) VALUES(?,?,?)',
                      (dept['id'], sem, f'Semester {sem}'))
    conn.commit()
    conn.close()
    print("✅ Database initialized with departments and semesters")

# ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def make_token(user_id, email, role):
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    try:
        return jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except:
        return None

def auth_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        data = verify_token(token)
        if not data:
            return jsonify({'error': 'Unauthorized'}), 401
        request.user = data
        return f(*args, **kwargs)
    return decorated

# ─── AUTH ROUTES ─────────────────────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
def register():
    d = request.json
    if not d or not d.get('name') or not d.get('email') or not d.get('password'):
        return jsonify({'error': 'All fields required'}), 400
    conn = get_db()
    try:
        conn.execute('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)',
                     (d['name'], d['email'], hash_password(d['password']), d.get('role','teacher')))
        conn.commit()
        return jsonify({'message': 'Registration successful!'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 409
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    d = request.json
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email=? AND password=?',
                        (d.get('email',''), hash_password(d.get('password','')))).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    token = make_token(user['id'], user['email'], user['role'])
    return jsonify({'token': token, 'user': {
        'id': user['id'], 'name': user['name'],
        'email': user['email'], 'role': user['role'],
        'profile_image': user['profile_image']
    }})

@app.route('/api/auth/profile', methods=['GET', 'PUT'])
@auth_required
def profile():
    conn = get_db()
    if request.method == 'GET':
        user = conn.execute('SELECT id,name,email,role,profile_image,created_at FROM users WHERE id=?',
                            (request.user['user_id'],)).fetchone()
        conn.close()
        return jsonify(dict(user))
    d = request.json
    updates = []
    vals = []
    for field in ['name', 'profile_image']:
        if field in d:
            updates.append(f'{field}=?')
            vals.append(d[field])
    if d.get('password'):
        updates.append('password=?')
        vals.append(hash_password(d['password']))
    vals.append(request.user['user_id'])
    conn.execute(f'UPDATE users SET {", ".join(updates)} WHERE id=?', vals)
    conn.commit()
    conn.close()
    return jsonify({'message': 'Profile updated'})

# ─── DEPARTMENT & SEMESTER ────────────────────────────────────────────────────
@app.route('/api/departments', methods=['GET', 'POST'])
@auth_required
def departments():
    conn = get_db()
    if request.method == 'GET':
        depts = conn.execute('SELECT * FROM departments ORDER BY name').fetchall()
        conn.close()
        return jsonify([dict(d) for d in depts])
    d = request.json
    try:
        conn.execute('INSERT INTO departments(name,code) VALUES(?,?)', (d['name'], d['code']))
        dept_id = conn.execute('SELECT id FROM departments WHERE code=?', (d['code'],)).fetchone()['id']
        for sem in range(1, 9):
            conn.execute('INSERT OR IGNORE INTO semesters(department_id,number,name) VALUES(?,?,?)',
                         (dept_id, sem, f'Semester {sem}'))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Department added with 8 semesters!'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Department already exists'}), 409

@app.route('/api/departments/<int:dept_id>/semesters', methods=['GET'])
@auth_required
def get_semesters(dept_id):
    conn = get_db()
    sems = conn.execute('SELECT * FROM semesters WHERE department_id=? ORDER BY number', (dept_id,)).fetchall()
    conn.close()
    return jsonify([dict(s) for s in sems])

# ─── STUDENTS ─────────────────────────────────────────────────────────────────
@app.route('/api/students', methods=['GET', 'POST'])
@auth_required
def students():
    conn = get_db()
    if request.method == 'GET':
        dept_id = request.args.get('department_id')
        sem_id = request.args.get('semester_id')
        batch = request.args.get('batch')
        search = request.args.get('search', '')
        q = '''SELECT s.*, d.name as dept_name, d.code as dept_code,
               sem.number as sem_number
               FROM students s
               JOIN departments d ON s.department_id = d.id
               JOIN semesters sem ON s.semester_id = sem.id
               WHERE 1=1'''
        params = []
        if dept_id:
            q += ' AND s.department_id=?'; params.append(dept_id)
        if sem_id:
            q += ' AND s.semester_id=?'; params.append(sem_id)
        if batch:
            q += ' AND s.batch=?'; params.append(batch)
        if search:
            q += ' AND (s.student_id LIKE ? OR s.name LIKE ?)'; params += [f'%{search}%', f'%{search}%']
        q += ' ORDER BY s.name'
        rows = conn.execute(q, params).fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    d = request.json
    try:
        conn.execute('''INSERT INTO students(student_id,name,batch,department_id,semester_id,email,phone)
                        VALUES(?,?,?,?,?,?,?)''',
                     (d['student_id'], d['name'], d['batch'], d['department_id'],
                      d['semester_id'], d.get('email',''), d.get('phone','')))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Student added!'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Student ID already exists'}), 409

@app.route('/api/students/<int:sid>', methods=['GET', 'PUT', 'DELETE'])
@auth_required
def student_detail(sid):
    conn = get_db()
    if request.method == 'GET':
        s = conn.execute('''SELECT s.*, d.name as dept_name, sem.number as sem_number
                            FROM students s JOIN departments d ON s.department_id=d.id
                            JOIN semesters sem ON s.semester_id=sem.id WHERE s.id=?''', (sid,)).fetchone()
        conn.close()
        return jsonify(dict(s)) if s else (jsonify({'error':'Not found'}),404)
    if request.method == 'PUT':
        d = request.json
        conn.execute('''UPDATE students SET name=?,batch=?,department_id=?,semester_id=?,email=?,phone=?
                        WHERE id=?''',
                     (d['name'],d['batch'],d['department_id'],d['semester_id'],
                      d.get('email',''),d.get('phone',''),sid))
        conn.commit(); conn.close()
        return jsonify({'message': 'Updated!'})
    conn.execute('DELETE FROM students WHERE id=?', (sid,))
    conn.execute('DELETE FROM lab_marks WHERE student_id=?', (sid,))
    conn.execute('DELETE FROM theory_marks WHERE student_id=?', (sid,))
    conn.commit(); conn.close()
    return jsonify({'message': 'Deleted!'})

# ─── LAB MARKS ───────────────────────────────────────────────────────────────
@app.route('/api/lab-marks', methods=['GET', 'POST'])
@auth_required
def lab_marks():
    conn = get_db()
    if request.method == 'GET':
        dept_id = request.args.get('department_id')
        sem_id = request.args.get('semester_id')
        batch = request.args.get('batch')
        student_id = request.args.get('student_id')
        q = '''SELECT lm.*, s.name as student_name, s.student_id as roll,
               s.batch, d.name as dept_name
               FROM lab_marks lm
               JOIN students s ON lm.student_id = s.id
               JOIN departments d ON s.department_id = d.id
               WHERE 1=1'''
        params = []
        if dept_id: q += ' AND s.department_id=?'; params.append(dept_id)
        if sem_id: q += ' AND lm.semester_id=?'; params.append(sem_id)
        if batch: q += ' AND s.batch=?'; params.append(batch)
        if student_id: q += ' AND lm.student_id=?'; params.append(student_id)
        rows = conn.execute(q, params).fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    d = request.json
    max_exam = 20 if d['exam_type'] == 'mid' else 30
    exam_marks = min(float(d.get('exam_marks', 0)), max_exam)
    total = exam_marks
    try:
        conn.execute('''INSERT INTO lab_marks(student_id,exam_type,attendance,lab_report,viva,practical,exam_marks,total,semester_id)
                        VALUES(?,?,?,?,?,?,?,?,?)
                        ON CONFLICT(student_id,exam_type,semester_id) DO UPDATE SET
                        attendance=excluded.attendance,lab_report=excluded.lab_report,
                        viva=excluded.viva,practical=excluded.practical,
                        exam_marks=excluded.exam_marks,total=excluded.total,
                        updated_at=CURRENT_TIMESTAMP''',
                     (d['student_id'],d['exam_type'],d.get('attendance',0),
                      d.get('lab_report',0),d.get('viva',0),d.get('practical',0),
                      exam_marks,total,d['semester_id']))
        conn.commit(); conn.close()
        return jsonify({'message': 'Lab marks saved!'})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lab-marks/<int:mid>', methods=['PUT', 'DELETE'])
@auth_required
def lab_mark_detail(mid):
    conn = get_db()
    if request.method == 'DELETE':
        conn.execute('DELETE FROM lab_marks WHERE id=?', (mid,))
        conn.commit(); conn.close()
        return jsonify({'message': 'Deleted!'})
    d = request.json
    max_exam = 20 if d['exam_type'] == 'mid' else 30
    exam_marks = min(float(d.get('exam_marks', 0)), max_exam)
    conn.execute('''UPDATE lab_marks SET attendance=?,lab_report=?,viva=?,practical=?,
                    exam_marks=?,total=?,updated_at=CURRENT_TIMESTAMP WHERE id=?''',
                 (d.get('attendance',0),d.get('lab_report',0),d.get('viva',0),
                  d.get('practical',0),exam_marks,exam_marks,mid))
    conn.commit(); conn.close()
    return jsonify({'message': 'Updated!'})

# ─── THEORY MARKS ─────────────────────────────────────────────────────────────
@app.route('/api/theory-marks', methods=['GET', 'POST'])
@auth_required
def theory_marks():
    conn = get_db()
    if request.method == 'GET':
        dept_id = request.args.get('department_id')
        sem_id = request.args.get('semester_id')
        batch = request.args.get('batch')
        student_id = request.args.get('student_id')
        q = '''SELECT tm.*, s.name as student_name, s.student_id as roll,
               s.batch, d.name as dept_name
               FROM theory_marks tm
               JOIN students s ON tm.student_id = s.id
               JOIN departments d ON s.department_id = d.id
               WHERE 1=1'''
        params = []
        if dept_id: q += ' AND s.department_id=?'; params.append(dept_id)
        if sem_id: q += ' AND tm.semester_id=?'; params.append(sem_id)
        if batch: q += ' AND s.batch=?'; params.append(batch)
        if student_id: q += ' AND tm.student_id=?'; params.append(student_id)
        rows = conn.execute(q, params).fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    d = request.json
    max_exam = 20 if d['exam_type'] == 'mid' else 30
    exam_marks = min(float(d.get('exam_marks', 0)), max_exam)
    try:
        conn.execute('''INSERT INTO theory_marks(student_id,exam_type,class_test,quiz,presentation,viva,assignment,exam_marks,total,semester_id)
                        VALUES(?,?,?,?,?,?,?,?,?,?)
                        ON CONFLICT(student_id,exam_type,semester_id) DO UPDATE SET
                        class_test=excluded.class_test,quiz=excluded.quiz,
                        presentation=excluded.presentation,viva=excluded.viva,
                        assignment=excluded.assignment,exam_marks=excluded.exam_marks,
                        total=excluded.total,updated_at=CURRENT_TIMESTAMP''',
                     (d['student_id'],d['exam_type'],d.get('class_test',0),
                      d.get('quiz',0),d.get('presentation',0),d.get('viva',0),
                      d.get('assignment',0),exam_marks,exam_marks,d['semester_id']))
        conn.commit(); conn.close()
        return jsonify({'message': 'Theory marks saved!'})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/theory-marks/<int:mid>', methods=['PUT', 'DELETE'])
@auth_required
def theory_mark_detail(mid):
    conn = get_db()
    if request.method == 'DELETE':
        conn.execute('DELETE FROM theory_marks WHERE id=?', (mid,))
        conn.commit(); conn.close()
        return jsonify({'message': 'Deleted!'})
    d = request.json
    max_exam = 20 if d['exam_type'] == 'mid' else 30
    exam_marks = min(float(d.get('exam_marks', 0)), max_exam)
    conn.execute('''UPDATE theory_marks SET class_test=?,quiz=?,presentation=?,viva=?,
                    assignment=?,exam_marks=?,total=?,updated_at=CURRENT_TIMESTAMP WHERE id=?''',
                 (d.get('class_test',0),d.get('quiz',0),d.get('presentation',0),
                  d.get('viva',0),d.get('assignment',0),exam_marks,exam_marks,mid))
    conn.commit(); conn.close()
    return jsonify({'message': 'Updated!'})

# ─── DASHBOARD / STATS ────────────────────────────────────────────────────────
@app.route('/api/stats/dashboard', methods=['GET'])
@auth_required
def dashboard_stats():
    conn = get_db()
    total_students = conn.execute('SELECT COUNT(*) as c FROM students').fetchone()['c']
    total_depts = conn.execute('SELECT COUNT(*) as c FROM departments').fetchone()['c']
    dept_stats = conn.execute('''
        SELECT d.name, d.code, d.id,
               COUNT(s.id) as student_count
        FROM departments d
        LEFT JOIN students s ON s.department_id = d.id
        GROUP BY d.id ORDER BY d.name
    ''').fetchall()

    dept_performance = []
    for dept in dept_stats:
        lab_avg = conn.execute('''SELECT AVG(lm.exam_marks) as avg FROM lab_marks lm
                                   JOIN students s ON lm.student_id=s.id
                                   WHERE s.department_id=?''', (dept['id'],)).fetchone()['avg'] or 0
        th_avg = conn.execute('''SELECT AVG(tm.exam_marks) as avg FROM theory_marks tm
                                  JOIN students s ON tm.student_id=s.id
                                  WHERE s.department_id=?''', (dept['id'],)).fetchone()['avg'] or 0
        dept_performance.append({
            **dict(dept),
            'lab_avg': round(lab_avg, 1),
            'theory_avg': round(th_avg, 1),
            'overall': round((lab_avg + th_avg) / 2, 1)
        })
    conn.close()
    return jsonify({
        'total_students': total_students,
        'total_departments': total_depts,
        'dept_performance': dept_performance
    })

@app.route('/api/stats/semester/<int:sem_id>', methods=['GET'])
@auth_required
def semester_stats(sem_id):
    conn = get_db()
    students = conn.execute('''
        SELECT s.id, s.name, s.student_id as roll,
               COALESCE(lm_mid.exam_marks,0) + COALESCE(lm_fin.exam_marks,0) as lab_total,
               COALESCE(tm_mid.exam_marks,0) + COALESCE(tm_fin.exam_marks,0) as theory_total
        FROM students s
        LEFT JOIN lab_marks lm_mid ON lm_mid.student_id=s.id AND lm_mid.exam_type='mid' AND lm_mid.semester_id=?
        LEFT JOIN lab_marks lm_fin ON lm_fin.student_id=s.id AND lm_fin.exam_type='final' AND lm_fin.semester_id=?
        LEFT JOIN theory_marks tm_mid ON tm_mid.student_id=s.id AND tm_mid.exam_type='mid' AND tm_mid.semester_id=?
        LEFT JOIN theory_marks tm_fin ON tm_fin.student_id=s.id AND tm_fin.exam_type='final' AND tm_fin.semester_id=?
        WHERE s.semester_id=?
    ''', (sem_id,sem_id,sem_id,sem_id,sem_id)).fetchall()
    result = []
    for st in students:
        lab_total = st['lab_total'] or 0
        th_total = st['theory_total'] or 0
        grand = lab_total + th_total
        grade = 'A+' if grand>=90 else 'A' if grand>=80 else 'B+' if grand>=70 else 'B' if grand>=60 else 'C' if grand>=50 else 'F'
        result.append({**dict(st), 'grand_total': round(grand,1), 'grade': grade,
                       'lab_total': round(lab_total,1), 'theory_total': round(th_total,1)})
    conn.close()
    return jsonify(result)

# ─── SERVE FRONTEND ───────────────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.template_folder, 'index.html')

if __name__ == '__main__':
    init_db()
    print("🚀 Server running on http://localhost:5000")
    app.run(debug=True, port=5000)
