// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ =====
// После загрузки DOM подключаются основные функции интерфейса
document.addEventListener('DOMContentLoaded', () => {
    loadDoctors(); // загрузка списка врачей

    // при выборе врача загружаются доступные слоты
    document.getElementById('doctorSelect')
        .addEventListener('change', e => loadSlots(e.target.value));

    // отправка формы записи
    document.getElementById('submitBtn')
        .addEventListener('click', submitAppointment);
});


// ===== ЗАГРУЗКА ВРАЧЕЙ =====
// Получение списка врачей с сервера и добавление в select
async function loadDoctors() {
    const res = await fetch('/api/doctors');
    const doctors = await res.json();

    const sel = document.getElementById('doctorSelect');

    doctors.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.full_name;
        sel.appendChild(opt);
    });
}


// ===== ЗАГРУЗКА СЛОТОВ ВРАЧА =====
// Получение доступного расписания выбранного врача
async function loadSlots(doctorId) {
    if (!doctorId) return;

    const sel = document.getElementById('slotSelect');

    // временное состояние загрузки
    sel.innerHTML = '<option>Загрузка...</option>';

    const res = await fetch(`/api/slots/all?doctor_id=${doctorId}`);
    const slots = await res.json();

    sel.innerHTML = '<option disabled selected>Выберите время</option>';

    slots.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;

        // ===== ФОРМАТИРОВАНИЕ ДАТЫ =====
        const dateObj = new Date(s.slot_date);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();

        const formattedDate = `${day}.${month}.${year}`;
        const time = s.start_time.substring(0, 5);

        opt.textContent = `${formattedDate} — ${time}`;
        sel.appendChild(opt);
    });
}


// ===== ОТПРАВКА ЗАПИСИ НА ПРИЁМ =====
// Проверка всех полей и отправка данных на сервер
async function submitAppointment() {
    const doctorSel = document.getElementById('doctorSelect');
    const slotSel = document.getElementById('slotSelect');
    const fio = document.getElementById('fio');
    const birthYear = document.getElementById('birthYear');
    const phone = document.getElementById('phone');
    const email = document.getElementById('email');
    const problem = document.getElementById('problem');

    // ===== ВАЛИДАЦИЯ ПОЛЕЙ =====
    if (!doctorSel.value) return alert('Выберите врача!');
    if (!slotSel.value || slotSel.options[slotSel.selectedIndex].disabled)
        return alert('Выберите время!');
    if (!fio.value.trim()) return alert('Введите ФИО!');
    if (!birthYear.value) return alert('Введите год рождения!');
    if (!phone.value.trim() || phone.value.length < 12)
        return alert('Введите корректный телефон!');
    if (!email.value.trim()) return alert('Введите Email!');
    if (!problem.value.trim()) return alert('Опишите проблему!');

    // ===== ФОРМИРОВАНИЕ ДАННЫХ =====
    const data = {
        doctor_id: doctorSel.value,
        slot_id: slotSel.value,
        patient_name: fio.value,
        birth_year: birthYear.value,
        phone: phone.value,
        email: email.value,
        problem: problem.value
    };

    // ===== ОТПРАВКА НА СЕРВЕР =====
    const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const result = await res.json();

    alert(result.success ? 'Записано!' : 'Ошибка: ' + result.error);

    if (result.success) location.reload();
}
