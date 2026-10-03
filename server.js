// ===== ПОДКЛЮЧЕНИЕ МОДУЛЕЙ =====
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const path = require("path");

// ===== СОЗДАНИЕ И НАСТРОЙКА СЕРВЕРА =====
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: false,
}));

// ===== ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ =====
const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "clinic",
    user: "postgres",
    password: "admin",
});

pool.connect((err, client, release) => {
    if (err) return console.error("❌ Ошибка БД:", err.message);
    console.log("✅ База данных подключена");
    release();
});

// ===== API ДЛЯ ПОЛЬЗОВАТЕЛЕЙ =====

// получить список врачей
app.get("/api/doctors", async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, full_name FROM doctors`);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// получить свободные слоты врача
app.get('/api/slots/all', async (req, res) => {
    const { doctor_id } = req.query;
    try {
        const result = await pool.query(
            `SELECT s.id, s.slot_date, s.start_time 
            FROM schedule_slots s
            LEFT JOIN appointments a ON s.id = a.slot_id 
            WHERE s.doctor_id = $1 AND a.id IS NULL
            ORDER BY s.slot_date, s.start_time`,
            [doctor_id]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// создать запись к врачу
app.post("/api/appointments", async (req, res) => {
    const { doctor_id, slot_id, patient_name, birth_year, phone, email, problem } = req.body;

    try {
        // проверка что слот свободен
        const slotCheck = await pool.query(
            `SELECT s.id FROM schedule_slots s
            LEFT JOIN appointments a ON s.id = a.slot_id 
            WHERE s.id = $1 AND a.id IS NULL`, 
            [slot_id]
        );
        
        if (slotCheck.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Это время уже занято' });
        }

        // поиск пациента по телефону
        let p = await pool.query('SELECT id FROM patients WHERE phone = $1', [phone]);
        let pid = p.rows[0]?.id;
        
        // если нет — создаём
        if (!pid) {
            const newP = await pool.query(
                'INSERT INTO patients (full_name, birth_year, phone, email) VALUES ($1,$2,$3,$4) RETURNING id',
                [patient_name, birth_year, phone, email]
            );
            pid = newP.rows[0].id;
        }

        // создаём запись
        await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, slot_id, problem_description, status) 
            VALUES ($1, $2, $3, $4, 'wait')`,
            [pid, doctor_id, slot_id, problem]
        );

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== АВТОРИЗАЦИЯ АДМИНА =====

// вход
app.post("/api/admin/login", (req, res) => {
    if (req.body.username === "admin" && req.body.password === "admin") {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

// доступ к админке
app.get("/admin", (req, res) => {
    if (req.session.isAdmin) 
        res.sendFile(path.join(__dirname, "protected/admin.html"));
    else 
        res.redirect("/index.html");
});

// выход
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/index.html"));
});

// ===== API ДЛЯ АДМИНА =====

// добавить врача
app.post("/api/admin/doctors", async (req, res) => {
    const { full_name } = req.body;
    if (!full_name) return res.status(400).json({ error: "ФИО обязательно" });
    try {
        await pool.query("INSERT INTO doctors (full_name) VALUES ($1)", [full_name]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// удалить врача
app.delete("/api/admin/doctors/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM doctors WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// получить слоты
app.get("/api/admin/slots", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.slot_date, s.start_time, d.full_name as doctor_name 
            FROM schedule_slots s
            JOIN doctors d ON s.doctor_id = d.id
            ORDER BY s.slot_date DESC, s.start_time
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// добавить слот
app.post("/api/admin/slots", async (req, res) => {
    const { doctor_id, slot_date, start_time } = req.body;
    if (!doctor_id || !slot_date || !start_time) {
        return res.status(400).json({ error: "Заполните все поля" });
    }
    try {
        await pool.query(
            "INSERT INTO schedule_slots (doctor_id, slot_date, start_time) VALUES ($1, $2, $3)",
            [doctor_id, slot_date, start_time]
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// удалить слот
app.delete("/api/admin/slots/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM schedule_slots WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// получить записи
app.get("/api/admin/appointments", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.id, a.status, a.problem_description,
                p.full_name as patient_name, p.birth_year, p.phone, p.email,
                d.full_name as doctor_name,
                s.slot_date, s.start_time
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            JOIN schedule_slots s ON a.slot_id = s.id
            ORDER BY s.slot_date DESC, s.start_time DESC
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// подтвердить запись
app.post("/api/admin/appointments/confirm", async (req, res) => {
    const { id } = req.body;
    try {
        await pool.query("UPDATE appointments SET status = 'confirmed' WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// удалить запись
app.delete("/api/admin/appointments/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM appointments WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// отправить результат и удалить запись
app.post("/api/admin/appointments/result", async (req, res) => {
    const { id, diagnosis, analyses, prescription } = req.body;
    if (!id || !prescription) return res.status(400).json({ error: "Заполните назначения" });
    
    try {
        const patientRes = await pool.query(`
            SELECT p.email, p.full_name FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = $1
        `, [id]);
        
        if (patientRes.rows.length === 0) {
            return res.status(404).json({ error: "Запись не найдена" });
        }
        
        const { email, full_name } = patientRes.rows[0];
        
        console.log(`[EMAIL] To: ${email} (${full_name})`);
        console.log(`[EMAIL] Diagnosis: ${diagnosis}`);
        console.log(`[EMAIL] Analyses: ${analyses}`);
        console.log(`[EMAIL] Prescription: ${prescription}`);
        
        await pool.query("DELETE FROM appointments WHERE id = $1", [id]);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ===== ЗАПУСК СЕРВЕРА =====
app.listen(PORT, () => console.log(`🚀 Сервер: http://localhost:${PORT}`));
