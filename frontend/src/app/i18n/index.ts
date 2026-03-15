import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ru: {
    translation: {
      appName: "RadAssist PRO",
      login: {
        title: "Вход в систему",
        subtitle: "Введите учетные данные",
        email: "Email",
        password: "Пароль",
        submit: "Войти",
        invalid: "Неверный логин или пароль",
      },
      accessDenied: {
        title: "Доступ запрещен",
        description: "У вашей роли нет доступа к этому разделу.",
      },
      loading: "Загрузка...",
    },
  },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: "ru",
  fallbackLng: "ru",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
