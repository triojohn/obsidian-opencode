# obsidian-opencode — внутренний форк - тест 1

Форк плагина Obsidian `kriss-spy/obsidian-opencode` для личного использования в vault `aaz_vault`.

## Зачем форк
1. Клик по иконке открывает консоль выбора сессии для текущей директории (вместо окна ввода).
2. Если последняя сессия сегодняшняя — открывать её сразу.
3. Починить вкладку сессий: сейчас показывает странные/пустые сессии, возможно сессии сабагентов.
4. Поддержка внешних рабочих папок (opencode `references` / `permission.external_directory`).

## Раскладка
- Код: `C:\GitHub\obsidian-opencode` (этот репозиторий), рабочая ветка `vault`.
- Волт: только карточка проекта; исходников в волте нет.
- Собранный `main.js` ставится в `<vault>\.obsidian\plugins\opencode\`.

## Upstream
- MIT, ветка `main`, версия 2.3.1, исходники в `src/` (TypeScript), сборка esbuild (`npm run build`, `npm run dev`), требуется Node >= 22.12.

## Факты opencode
- cwd — один на сессию (`opencode run --dir`).
- Мульти-директории подключаются через `references` в `opencode.jsonc`.
- Доступ к внешним путям регулирует `permission.external_directory`.

## TODO
- [ ] Проверить Node >= 22.12
- [ ] Собрать плагин без изменений (baseline)
- [ ] Пункт 1: иконка → выбор сессии
- [ ] Пункт 2: авто-открытие сегодняшней сессии
- [ ] Пункт 3: разобрать источник списка сессий

## Источник
- Реальный путь репозитория: `C:\GitHub\obsidian-opencode`
- Этот файл: `C:\GitHub\obsidian-opencode\PROJECT.md`
- Зеркало в vault: `10-projects/obsidian-opencode/PROJECT.md` (односторонняя копия git -> vault, плагин Synaptic Bridge)
- Редактировать только в репозитории. Правка зеркала в vault будет перезаписана.

## Что изменено относительно upstream

### 2026-10-08
- **Открытие терминала по активной заметке.** Клик по ribbon-иконке opencode: cwd = папка активной заметки (fallback: последний активный .md, затем defaultWorkingDirectory / корень vault). Если последняя сессия этой папки обновлялась не позже `resumeWithinDays` дней — продолжает её (`-s <id>`); иначе создаёт новую сессию и автоматически вставляет `@<путь заметки>` в композер (без отправки). Настройка `resumeWithinDays` (0–30, default 1).
- **Вкладка conversations: список всех сессий проекта.** Запрос `GET /api/session?project=<id>&parentID=null&limit=20&order=desc[&cursor=…]` — project-scope покрывает все подпапки vault, у каждой сессии показана папка, лимит 20, догрузка при прокрутке.
- **Убрана кнопка «+» (New session)** из шапки вкладки conversations.
- **Нижний паддинг терминала** равен высоте статус-бара Obsidian, чтобы нижняя строка состояния TUI была видна и кликабельна.

### Сборка и установка
- Требуется Node ≥22.12 (на рабочей машине — портативный `C:\Tools\node22`, v22.23.3).
- `npm ci` → `npm run build` → скопировать `main.js` и `styles.css` в `<vault>\.obsidian\plugins\opencode\`.
