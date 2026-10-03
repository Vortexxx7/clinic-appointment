// ===== ОТКРЫТИЕ МОДАЛЬНОГО ОКНА =====
// При нажатии на кнопку логина показывается модальное окно
document.getElementById("logIn").onclick = () => {
  document.getElementById("modal").style.display = "flex";
};


// ===== ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА =====
// Закрытие окна при клике вне формы (по фону модалки)
window.onclick = (e) => {
  if (e.target === document.getElementById("modal")) {
    document.getElementById("modal").style.display = "none";
  }
};


// ===== ОБРАБОТКА ЛОГИНА =====
// Отправка данных формы входа на сервер и проверка авторизации
document.getElementById("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault(); // отключение стандартной отправки формы

  // ===== ПОЛУЧЕНИЕ ДАННЫХ ИЗ ФОРМЫ =====
  const username = e.target.querySelector('input[type="text"]').value;
  const password = e.target.querySelector('input[type="password"]').value;

  // ===== ОТПРАВКА НА СЕРВЕР =====
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();

  // ===== РЕЗУЛЬТАТ АВТОРИЗАЦИИ =====
  if (data.success) {
    // переход в админ-панель через сервер (с проверкой сессии)
    window.location.href = "/admin";
  } else {
    alert("Неверно");
  }
});
