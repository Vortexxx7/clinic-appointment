// ===== ФОРМАТИРОВАНИЕ ДАТЫ =====
// Преобразует строку даты в формат dd.mm.yyyy (русская локаль)
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU');
};


// ===== ЗАГРУЗКА СПИСКА ВРАЧЕЙ =====
// Получает врачей с сервера и обновляет таблицу и выпадающий список
const loadDoctors = async () => {
  const res = await fetch('/api/doctors');
  const doctors = await res.json();

  const tbody = document.getElementById('tbody-doctors'); // таблица врачей
  const select = document.getElementById('select-slot-doctor'); // select для слотов

  tbody.innerHTML = '';
  select.innerHTML = '<option value="" disabled selected>Выбрать врача</option>';

  doctors.forEach(d => {
    // ===== ДОБАВЛЕНИЕ В ТАБЛИЦУ =====
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.full_name}</td>
      <td class="actions">
        <button onclick="deleteDoctor(${d.id})">Удалить</button>
      </td>`;
    tbody.appendChild(tr);

    // ===== ДОБАВЛЕНИЕ В SELECT =====
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.full_name;
    select.appendChild(opt);
  });
};


// ===== ЗАГРУЗКА СЛОТОВ =====
// Получает все расписания врачей и отображает в таблице
const loadSlots = async () => {
  const res = await fetch('/api/admin/slots');
  const slots = await res.json();

  const tbody = document.getElementById('tbody-slots');
  tbody.innerHTML = '';

  slots.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.doctor_name}</td>
      <td>${formatDate(s.slot_date)}</td>
      <td>${s.start_time.substring(0, 5)}</td>
      <td class="actions">
        <button onclick="deleteSlot(${s.id})">Удалить</button>
      </td>`;
    tbody.appendChild(tr);
  });
};


// ===== ЗАГРУЗКА ЗАПИСЕЙ =====
// Получает все записи пациентов и обновляет таблицу + select списки
const loadAppointments = async () => {
  const res = await fetch('/api/admin/appointments');
  const apps = await res.json();

  const tbody = document.getElementById('tbody-appointments');
  const manageSel = document.getElementById('select-manage-appointment');
  const resultSel = document.getElementById('select-result-appointment');

  tbody.innerHTML = '';
  manageSel.innerHTML = '<option value="" disabled selected>Выбрать запись</option>';
  resultSel.innerHTML = '<option value="" disabled selected>Выбрать запись</option>';

  apps.forEach(a => {
    const tr = document.createElement('tr');

    // ===== БЕЗОПАСНАЯ ПЕРЕДАЧА ДАННЫХ В МОДАЛКУ =====
    const dataJson = encodeURIComponent(JSON.stringify(a));

    tr.innerHTML = `
      <td>${a.patient_name}</td>
      <td>${a.doctor_name}</td>
      <td>${formatDate(a.slot_date)}</td>
      <td>${a.start_time.substring(0, 5)}</td>
      <td style="color: black; font-size: 16px;">${a.status}</td>
      <td>
        <button class="desc-btn" onclick="openModal('${dataJson}')">
          Описание
        </button>
      </td>`;
    tbody.appendChild(tr);

    // ===== ДОБАВЛЕНИЕ В SELECT (только активные записи) =====
    if (a.status === 'wait' || a.status === 'confirmed') {
      const label = `${a.patient_name} — ${formatDate(a.slot_date)} ${a.start_time.substring(0, 5)}`;

      [manageSel, resultSel].forEach(sel => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = label;
        sel.appendChild(opt);
      });
    }
  });
};


// ===== ДОБАВЛЕНИЕ ВРАЧА =====
// Отправка нового врача на сервер
const addDoctor = async () => {
  const name = document.getElementById('input-doctor-name').value;

  if (!name) return alert('Введите ФИО');

  await fetch('/api/admin/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: name })
  });

  document.getElementById('input-doctor-name').value = '';
  loadDoctors();
};


// ===== УДАЛЕНИЕ ВРАЧА =====
// Удаляет врача по id после подтверждения
const deleteDoctor = async (id) => {
  if (!confirm('Удалить врача?')) return;

  await fetch(`/api/admin/doctors/${id}`, { method: 'DELETE' });
  loadDoctors();
};


// ===== ДОБАВЛЕНИЕ СЛОТА =====
// Создает новое время приема врача
const addSlot = async () => {
  const doctor_id = document.getElementById('select-slot-doctor').value;
  const slot_date = document.getElementById('input-slot-date').value;
  const start_time = document.getElementById('input-slot-time').value;

  if (!doctor_id || !slot_date || !start_time) {
    return alert('Заполните все поля');
  }

  await fetch('/api/admin/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctor_id, slot_date, start_time })
  });

  loadSlots();
};


// ===== УДАЛЕНИЕ СЛОТА =====
// Удаляет расписание врача
const deleteSlot = async (id) => {
  if (!confirm('Удалить слот?')) return;

  await fetch(`/api/admin/slots/${id}`, { method: 'DELETE' });
  loadSlots();
};


// ===== ОБНОВЛЕНИЕ СТАТУСА ЗАПИСИ =====
// Подтверждение или удаление записи пациента
const updateStatus = async () => {
  const id = document.getElementById('select-manage-appointment').value;
  const action = document.getElementById('select-new-status').value;

  if (!id) return alert('Выберите запись');

  if (action === 'confirmed') {
    await fetch('/api/admin/appointments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  } 
  else if (action === 'cancelled') {
    await fetch(`/api/admin/appointments/${id}`, { method: 'DELETE' });
  }

  loadAppointments();
};


// ===== ОТПРАВКА РЕЗУЛЬТАТА =====
// Локальное удаление записи из интерфейса + очистка формы
const sendResult = () => {
  const id = document.getElementById('select-result-appointment').value;

  if (!id) return alert('Выберите запись');

  // Удаление строки из интерфейса (без БД)
  const row = document.querySelector(`#tbody-appointments tr:nth-child(${id})`);
  if (row) row.remove();

  // Очистка полей
  document.getElementById('input-diagnosis').value = '';
  document.getElementById('input-analyses').value = '';
  document.getElementById('textarea-prescription').value = '';
  document.getElementById('select-result-appointment').value = '';

  alert('Результат отправлен');
};


// ===== МОДАЛЬНОЕ ОКНО (ОТКРЫТИЕ) =====
// Показывает подробную информацию о записи
window.openModal = function (dataJson) {
  const data = JSON.parse(decodeURIComponent(dataJson));

  document.getElementById('modal-patient-info').textContent =
    `${data.patient_name} (${data.birth_year || 'не указан'})`;

  document.getElementById('modal-problem').textContent =
    data.problem_description || 'Нет описания';

  document.getElementById('modal-phone').textContent =
    data.phone || 'Не указан';

  document.getElementById('modal-email').textContent =
    data.email || 'Не указан';

  document.getElementById('modal-description').style.display = 'flex';
};


// ===== МОДАЛЬНОЕ ОКНО (ЗАКРЫТИЕ) =====
// Скрывает окно с описанием
window.closeModal = function () {
  document.getElementById('modal-description').style.display = 'none';
};


// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ =====
// Загружает данные и подключает обработчики кнопок
document.addEventListener('DOMContentLoaded', () => {
  loadDoctors();
  loadSlots();
  loadAppointments();

  document.getElementById('btn-add-doctor').onclick = addDoctor;
  document.getElementById('btn-add-slot').onclick = addSlot;
  document.getElementById('btn-apply-status').onclick = updateStatus;
  document.getElementById('btn-send-result').onclick = sendResult;

  // закрытие модального окна по клику вне блока
  document.getElementById('modal-description').onclick = (e) => {
    if (e.target.id === 'modal-description') closeModal();
  };
});
