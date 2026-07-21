# Сборка Android APK (Capacitor)

Игра — веб-приложение (Phaser). Capacitor упаковывает её в нативное Android-приложение.
Ниже — как получить `.apk` и поставить на телефон. Все команды выполняются **на твоём
компьютере** (не в облачной сессии — там нет Android SDK).

## Что нужно один раз установить

- **Node.js 18+** (уже нужен для игры).
- **JDK 17** (Android Gradle требует именно 17).
- **Android SDK** — проще всего через **Android Studio**
  (https://developer.android.com/studio). При первом запуске он поставит SDK и
  build-tools. Либо только command-line tools + `sdkmanager`.
- Прописать переменную окружения `ANDROID_HOME` на папку SDK
  (напр. `~/Android/Sdk` на Linux/Mac, `%LOCALAPPDATA%\Android\Sdk` на Windows),
  либо создать `android/local.properties` со строкой:
  ```
  sdk.dir=/абсолютный/путь/к/Android/Sdk
  ```

## Вариант 1 — через Android Studio (рекомендуется)

```bash
npm install
npm run build            # собирает веб в dist/
npx cap sync android     # копирует dist/ в нативный проект
npx cap open android     # открывает проект в Android Studio
```
В Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
Готовый файл: `android/app/build/outputs/apk/debug/app-debug.apk`.

Либо запустить прямо на подключённом телефоне кнопкой ▶ Run (с включённой
отладкой по USB).

## Вариант 2 — из командной строки (без Studio)

Нужен установленный SDK и заданный `ANDROID_HOME` (или `local.properties`).

```bash
npm run apk
# = npm run build && cap sync android && cd android && ./gradlew assembleDebug
```
Результат: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Установка на телефон

- **Через кабель:** `adb install android/app/build/outputs/apk/debug/app-debug.apk`
- **Без кабеля:** перекинуть `app-debug.apk` на телефон (мессенджер/облако/USB),
  открыть его и разрешить «Установку из неизвестных источников».

> Debug-APK подписан отладочным ключом — годится для себя и тестов. Для публикации
> в Google Play нужен release-APK/AAB с собственным ключом подписи (`assembleRelease`
> + keystore) — это отдельный шаг, когда понадобится.

## После изменений в игре

Любое изменение кода игры → пересобрать и синхронизировать:
```bash
npm run cap:sync    # = npm run build && cap sync android
```
затем снова собрать APK (Вариант 1 или 2).

## Ориентация

Приложение зафиксировано в **альбомной** ориентации (`sensorLandscape` в
`AndroidManifest.xml`) — игра рассчитана на горизонтальный экран 960×640.
Управление — виртуальный джойстик слева и кнопки справа (см. README).
