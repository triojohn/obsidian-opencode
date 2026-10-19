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
- Установочные артефакты `main.js`, `styles.css` и каталог `native/node-pty/` ставятся в `<vault>\.obsidian\plugins\obsidian-opencode\` (`native/node-pty/` — вендоренный node-pty с bundled ConPTY для мыши на Windows x64).

## Upstream
- MIT, ветка `main`, версия upstream 2.3.1 (собственный `manifest.json` форка — `1.0.0`), исходники в `src/` (TypeScript), сборка esbuild (`npm run build`, `npm run dev`), требуется Node >= 22.12.

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
- Зеркало в vault: `30-resources/obsidian-plugins/obsidian-opencode/PROJECT.md` (односторонняя копия git -> vault, плагин Synaptic Bridge)
- Редактировать только в репозитории. Правка зеркала в vault будет перезаписана.

## Файл табов TUI

Плагин **не читает и не пишет** состояние табов TUI opencode (`~/.local/state/opencode/<channel>/tui/tabs.json`). Раньше при открытии терминала для папки в этот файл дописывались последние сессии папки (`mergeSessionTabs`, настройка `recentTabsCount`); логика удалена целиком — табами управляет сам TUI.

Переключение сессии в уже запущенном TUI идёт через командный файл моста (`tuiBridge.ts`, `tui-cmd.json` в системном temp), а не через `tabs.json`.

## Мост переключения сессий

- **Когда работает.** Если терминал открыт и готов к вводу, а запрошенная сессия лежит в том же проекте (корень vault), плагин пишет команду `focus` в файл моста и не перезапускает PTY. Раньше требовалось точное совпадение папки сессии и cwd TUI.
- **Когда перезапуск.** Сессия вне проекта, терминал не готов, либо к сессии нужно приложить заметку (`@path`): prefill выполняется только при старте PTY, поэтому при наличии attach-пути мост не используется.
- **Windows rename-конфликт.** Запись командного файла идёт через temp-файл и `renameWithRetry` (`EBUSY`/`EPERM`, несколько коротких повторов с backoff).

## Что изменено относительно upstream

### 2026-10-08
- **Открытие терминала по активной заметке.** Клик по ribbon-иконке opencode: cwd = папка активной заметки (fallback: последний активный .md, затем defaultWorkingDirectory / корень vault). Если последняя сессия этой папки обновлялась не позже `resumeWithinDays` дней — продолжает её (`-s <id>`); иначе создаёт новую сессию и автоматически вставляет `@<путь заметки>` в композер (без отправки). Настройка `resumeWithinDays` (0–30, default 1).
- **Вкладка conversations: список всех сессий проекта.** Запрос `GET /api/session?project=<id>&parentID=null&limit=20&order=desc[&cursor=…]` — project-scope покрывает все подпапки vault, у каждой сессии показана папка, лимит 20, догрузка при прокрутке.
- **Убрана кнопка «+» (New session)** из шапки вкладки conversations.
- **Нижний паддинг терминала** равен высоте статус-бара Obsidian, чтобы нижняя строка состояния TUI была видна и кликабельна.

### Сборка и установка
- Требуется Node ≥22.12 (на рабочей машине — портативный `C:\Tools\node22`, v22.23.3).
- `npm ci` → `npm run build` → скопировать `main.js`, `styles.css` и каталог `native/node-pty/` в `<vault>\.obsidian\plugins\obsidian-opencode\`.

## Смена идентификатора плагина (own id)

- 2026-10-12: плагин отделён от community-плагина `opencode`. `manifest.json`: `id` = `obsidian-opencode`, `name` = `OpenCode Vault`, `author` = `triojohn`, добавлен `authorUrl`, версия = `1.0.0`; `versions.json` дополнен записью `1.0.0` -> `1.7.2`. Установочная папка в vault переименована `.obsidian/plugins/opencode` -> `.obsidian/plugins/obsidian-opencode` (settings `data.json` сохранены 1:1), `community-plugins.json` обновлён. Логика плагина id не хардкодит — использует `this.manifest.id`.
